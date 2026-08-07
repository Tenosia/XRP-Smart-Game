// Lightweight, dependency-free bot-detection helpers.
//   1. Honeypot — a hidden form field real users never fill.
//   2. Velocity guard — per-key sliding-window action throttle (catches scripts
//      hammering endpoints far faster than a human could).
//   3. Account flagging — repeat offenders get marked `flagged` in the DB.
import { db } from '../db.js';

const buckets = new Map(); // key -> [timestamps]

// Periodic prune so the map can't grow unbounded.
setInterval(() => {
  const now = Date.now();
  for (const [k, arr] of buckets) {
    const kept = arr.filter((t) => now - t < 120_000);
    if (kept.length) buckets.set(k, kept);
    else buckets.delete(k);
  }
}, 60_000).unref?.();

// Reject if the hidden honeypot field is present/non-empty.
export function honeypot(field = 'hp') {
  return (req, res, next) => {
    if (req.body && typeof req.body[field] === 'string' && req.body[field].trim() !== '') {
      return res.status(400).json({ error: 'Request rejected (automated activity detected).' });
    }
    next();
  };
}

// Sliding-window throttle. `key(req)` chooses what to bucket on (IP or user id).
export function velocityGuard({ key, windowMs, max, flagUser = false, message }) {
  return (req, res, next) => {
    const id = String(key(req));
    const now = Date.now();
    const arr = (buckets.get(id) || []).filter((t) => now - t < windowMs);
    arr.push(now);
    buckets.set(id, arr);
    if (arr.length > max) {
      if (flagUser && req.user?.id) {
        db.prepare('UPDATE users SET flagged=1 WHERE id=?').run(req.user.id);
      }
      return res
        .status(429)
        .json({ error: message || 'Too many actions too quickly — please slow down.' });
    }
    next();
  };
}

export const ipKey = (req) => req.ip || req.headers['x-forwarded-for'] || 'unknown';
export const userKey = (req) => req.user?.id || ipKey(req);

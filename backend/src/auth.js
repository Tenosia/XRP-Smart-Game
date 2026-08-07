import jwt from 'jsonwebtoken';
import { config } from './config.js';
import { db } from './db.js';
import { stroopsToXlm } from './money.js';

export function signToken(user) {
  return jwt.sign({ uid: user.id, role: user.role }, config.jwtSecret, { expiresIn: '7d' });
}

// Public user shape — never leaks password hash or custodial secret.
export function serializeUser(u) {
  return {
    id: u.id,
    email: u.email,
    displayName: u.display_name || u.email.split('@')[0],
    role: u.role,
    balance: stroopsToXlm(u.balance_stroops),
    depositAddress: u.deposit_public,
    createdAt: u.created_at,
  };
}

export function requireAuth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ error: 'Authentication required' });
  try {
    const payload = jwt.verify(token, config.jwtSecret);
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid);
    if (!user) return res.status(401).json({ error: 'Invalid session' });
    req.user = user;
    next();
  } catch {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
}

// Sets req.user if a valid token is present, but never rejects the request.
export function optionalAuth(req, _res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (token) {
    try {
      const payload = jwt.verify(token, config.jwtSecret);
      req.user = db.prepare('SELECT * FROM users WHERE id = ?').get(payload.uid) || undefined;
    } catch {
      /* ignore — treat as anonymous */
    }
  }
  next();
}

export function requireAdmin(req, res, next) {
  if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin access required' });
  next();
}

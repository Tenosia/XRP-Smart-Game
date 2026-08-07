import { config } from '../config.js';

// Cloudflare Turnstile ("Verify you are human") server-side verification.
// Docs: https://developers.cloudflare.com/turnstile/
const VERIFY_URL = 'https://challenges.cloudflare.com/turnstile/v0/siteverify';

export async function verifyTurnstile(token, ip) {
  if (!config.turnstile.secret) return true; // not configured → don't block
  if (!token) return false;
  try {
    const body = new URLSearchParams({ secret: config.turnstile.secret, response: token });
    if (ip) body.append('remoteip', ip);
    const res = await fetch(VERIFY_URL, { method: 'POST', body });
    const data = await res.json();
    return !!data.success;
  } catch {
    return false;
  }
}

// Middleware: requires a valid Turnstile token (sent as turnstileToken or the
// standard cf-turnstile-response field).
export function requireTurnstile(req, res, next) {
  const token = req.body?.turnstileToken || req.body?.['cf-turnstile-response'];
  verifyTurnstile(token, req.ip).then((ok) =>
    ok ? next() : res.status(400).json({ error: 'Please complete the "Verify you are human" check.' })
  );
}

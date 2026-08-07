import { Router } from 'express';
import bcrypt from 'bcryptjs';
import { z } from 'zod';
import { db } from '../db.js';
import { signToken, requireAuth, serializeUser } from '../auth.js';
import { generateKeypair } from '../stellar.js';
import { encrypt } from '../crypto.js';
import { honeypot, velocityGuard, ipKey } from '../services/botGuard.js';
import { requireTurnstile } from '../services/turnstile.js';

const router = Router();

const registerSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  displayName: z.string().min(2).max(40).optional(),
});

router.post(
  '/register',
  honeypot('hp'),
  requireTurnstile,
  velocityGuard({ key: ipKey, windowMs: 60 * 60_000, max: 12, message: 'Too many sign-ups from this network. Try later.' }),
  (req, res) => {
  const parsed = registerSchema.safeParse(req.body);
  if (!parsed.success) {
    return res.status(400).json({ error: parsed.error.issues[0].message });
  }
  const email = parsed.data.email.toLowerCase();
  const exists = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
  if (exists) return res.status(409).json({ error: 'An account with this email already exists' });

  // Generate a dedicated custodial Stellar deposit wallet for the user.
  const kp = generateKeypair();
  const passwordHash = bcrypt.hashSync(parsed.data.password, 10);

  const info = db
    .prepare(
      `INSERT INTO users (email, password_hash, display_name, deposit_public, deposit_secret_enc)
       VALUES (?, ?, ?, ?, ?)`
    )
    .run(email, passwordHash, parsed.data.displayName || null, kp.publicKey, encrypt(kp.secret));

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(info.lastInsertRowid);
  return res.json({ token: signToken(user), user: serializeUser(user) });
});

const loginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

router.post('/login', (req, res) => {
  const parsed = loginSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid credentials' });
  const email = parsed.data.email.toLowerCase();
  const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
  if (!user || !bcrypt.compareSync(parsed.data.password, user.password_hash)) {
    return res.status(401).json({ error: 'Invalid email or password' });
  }
  return res.json({ token: signToken(user), user: serializeUser(user) });
});

router.get('/me', requireAuth, (req, res) => {
  res.json({ user: serializeUser(req.user) });
});

export default router;

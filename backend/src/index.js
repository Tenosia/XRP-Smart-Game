import express from 'express';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { db } from './db.js';
import { generateKeypair, initHotWallet } from './stellar.js';
import { encrypt } from './crypto.js';
import { startSchedulers } from './services/scheduler.js';
import { verifyTurnstile } from './services/turnstile.js';

import authRoutes from './routes/auth.routes.js';
import walletRoutes from './routes/wallet.routes.js';
import ideasRoutes from './routes/ideas.routes.js';
import adminRoutes from './routes/admin.routes.js';
import rankingsRoutes from './routes/rankings.routes.js';
import feedRoutes from './routes/feed.routes.js';

const app = express();
app.set('trust proxy', 1);
app.use(cors({ origin: config.clientOrigins, credentials: true }));
app.use(express.json());

// Basic abuse protection.
app.use(
  '/api/',
  rateLimit({ windowMs: 60_000, max: 240, standardHeaders: true, legacyHeaders: false })
);
app.use(
  '/api/auth/',
  rateLimit({ windowMs: 15 * 60_000, max: 40, standardHeaders: true, legacyHeaders: false })
);

app.get('/api/health', (_req, res) =>
  res.json({ ok: true, network: config.stellar.network, time: new Date().toISOString() })
);

// Public, non-sensitive configuration for the frontend.
app.get('/api/config', (_req, res) =>
  res.json({
    network: config.stellar.network,
    ideaFeeXlm: config.ideaFeeXlm,
    minWithdrawXlm: config.minWithdrawXlm,
    minStakeXlm: config.minStakeXlm,
    turnstileSiteKey: config.turnstile.siteKey,
    split: {
      winners: config.split.winnersBps / 100,
      owner: config.split.ownerBps / 100,
      dev: config.split.devBps / 100,
      marketing: config.split.marketingBps / 100,
    },
  })
);

// Site-wide human gate: the frontend verifies a Turnstile token here before
// granting access to the app (once per browser session).
app.post('/api/human/verify', async (req, res) => {
  const token = req.body?.turnstileToken || req.body?.['cf-turnstile-response'];
  const ok = await verifyTurnstile(token, req.ip);
  if (!ok) return res.status(400).json({ error: 'Human verification failed — please try again.' });
  res.json({ ok: true });
});

app.use('/api/auth', authRoutes);
app.use('/api/wallet', walletRoutes);
app.use('/api/ideas', ideasRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/rankings', rankingsRoutes);
app.use('/api/feed', feedRoutes);

// Central error handler.
app.use((err, _req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

function bootstrapAdmin() {
  const existing = db.prepare('SELECT id, role FROM users WHERE email=?').get(config.admin.email);
  if (existing) {
    if (existing.role !== 'admin') {
      db.prepare("UPDATE users SET role='admin' WHERE id=?").run(existing.id);
    }
    return;
  }
  const kp = generateKeypair();
  db.prepare(
    `INSERT INTO users (email, password_hash, display_name, role, deposit_public, deposit_secret_enc)
     VALUES (?, ?, 'Project Owner', 'admin', ?, ?)`
  ).run(
    config.admin.email,
    bcrypt.hashSync(config.admin.password, 10),
    kp.publicKey,
    encrypt(kp.secret)
  );
  console.log(`👑 Bootstrapped admin account: ${config.admin.email}`);
}

async function main() {
  bootstrapAdmin();
  await initHotWallet();
  startSchedulers();
  // Bind to loopback only — the API is reached through the nginx reverse proxy.
  app.listen(config.port, '127.0.0.1', () => {
    console.log(`\n🚀 MyIdea backend on http://127.0.0.1:${config.port}`);
    console.log(`   Network: ${config.stellar.network}`);
    console.log(`   Split:   ${config.split.winnersBps / 100}% winners / ${
      config.split.ownerBps / 100
    }% owner / ${config.split.devBps / 100}% dev / ${config.split.marketingBps / 100}% marketing\n`);
  });
}

main().catch((e) => {
  console.error('Fatal startup error:', e);
  process.exit(1);
});

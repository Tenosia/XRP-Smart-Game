import { Router } from 'express';
import { z } from 'zod';
import { db, recordLedger, adjustUserBalance } from '../db.js';
import { requireAuth } from '../auth.js';
import { config } from '../config.js';
import { xlmToStroops, stroopsToXlm } from '../money.js';
import {
  sendNative,
  getHotWallet,
  isValidStellarAddress,
  getNativeBalanceStroops,
} from '../stellar.js';
import { syncUserDeposits } from '../services/deposits.js';

const router = Router();

router.get('/', requireAuth, (req, res) => {
  res.json({
    balance: stroopsToXlm(req.user.balance_stroops),
    depositAddress: req.user.deposit_public,
    network: config.stellar.network,
    minWithdraw: config.minWithdrawXlm,
  });
});

router.get('/transactions', requireAuth, (req, res) => {
  const rows = db
    .prepare('SELECT * FROM ledger WHERE user_id=? ORDER BY id DESC LIMIT 100')
    .all(req.user.id);
  res.json({
    transactions: rows.map((r) => ({
      id: r.id,
      type: r.type,
      amount: stroopsToXlm(r.amount_stroops),
      ref: r.ref,
      status: r.status,
      createdAt: r.created_at,
    })),
  });
});

// On-demand: check the chain for new deposits to this user's address right now.
router.post('/refresh', requireAuth, async (req, res) => {
  try {
    await syncUserDeposits(req.user.id);
    const u = db.prepare('SELECT balance_stroops FROM users WHERE id=?').get(req.user.id);
    res.json({ balance: stroopsToXlm(u.balance_stroops) });
  } catch (e) {
    res.status(502).json({ error: `Could not reach the Stellar network: ${e.message}` });
  }
});

const withdrawSchema = z.object({
  destination: z.string().min(1),
  amount: z.number().positive(),
});

router.post('/withdraw', requireAuth, async (req, res) => {
  const parsed = withdrawSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid withdrawal request' });
  const { destination, amount } = parsed.data;

  if (!isValidStellarAddress(destination)) {
    return res.status(400).json({ error: 'Invalid Stellar address (must start with G...)' });
  }
  if (amount < config.minWithdrawXlm) {
    return res.status(400).json({ error: `Minimum withdrawal is ${config.minWithdrawXlm} XLM` });
  }
  if (config.maxWithdrawXlm > 0 && amount > config.maxWithdrawXlm) {
    return res.status(400).json({ error: `Maximum withdrawal is ${config.maxWithdrawXlm} XLM per transaction` });
  }
  const amountStroops = xlmToStroops(amount);

  // Atomically reserve the funds (debit) and write a pending ledger row.
  const reserve = db.transaction(() => {
    const u = db.prepare('SELECT balance_stroops FROM users WHERE id=?').get(req.user.id);
    if (u.balance_stroops < amountStroops) throw new Error('INSUFFICIENT');
    adjustUserBalance(req.user.id, -amountStroops);
    const info = db
      .prepare(
        `INSERT INTO ledger (user_id, type, amount_stroops, ref, status)
         VALUES (?, 'withdraw', ?, ?, 'pending')`
      )
      .run(req.user.id, -amountStroops, destination);
    return info.lastInsertRowid;
  });

  let ledgerId;
  try {
    ledgerId = reserve();
  } catch (e) {
    if (e.message === 'INSUFFICIENT') return res.status(400).json({ error: 'Insufficient balance' });
    throw e;
  }

  // Pay out from the hot wallet.
  try {
    const hot = getHotWallet();
    const hash = await sendNative({
      fromSecret: hot.secret,
      toPublic: destination,
      stroops: amountStroops,
      memo: 'MyIdea withdrawal',
    });
    db.prepare("UPDATE ledger SET status='completed', ref=? WHERE id=?").run(hash, ledgerId);
    res.json({ hash, amount, destination });
  } catch (e) {
    // Roll the funds back to the user's balance.
    adjustUserBalance(req.user.id, amountStroops);
    db.prepare("UPDATE ledger SET status='failed' WHERE id=?").run(ledgerId);
    res.status(502).json({
      error: `Withdrawal failed and your balance was restored: ${e.message}`,
    });
  }
});

export default router;

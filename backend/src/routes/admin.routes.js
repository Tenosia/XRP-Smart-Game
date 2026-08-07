import { Router } from 'express';
import { z } from 'zod';
import {
  db,
  recordLedger,
  adjustUserBalance,
  creditPlatform,
  getPlatformBalance,
} from '../db.js';
import { requireAuth, requireAdmin } from '../auth.js';
import { config } from '../config.js';
import { xlmToStroops, stroopsToXlm } from '../money.js';
import { resolveIdea, serializeIdea } from '../services/markets.js';
import { sendNative, getHotWallet, isValidStellarAddress } from '../stellar.js';

const router = Router();
router.use(requireAuth, requireAdmin);

// Queue + full list for the review console.
router.get('/ideas', (req, res) => {
  const status = req.query.status;
  const rows = status
    ? db.prepare('SELECT * FROM ideas WHERE status=? ORDER BY id DESC').all(status)
    : db.prepare('SELECT * FROM ideas ORDER BY id DESC').all();
  res.json({ ideas: rows.map((i) => ({ ...serializeIdea(i), creatorId: i.creator_id })) });
});

router.post('/ideas/:id/approve', (req, res) => {
  const idea = db.prepare('SELECT * FROM ideas WHERE id=?').get(req.params.id);
  if (!idea) return res.status(404).json({ error: 'Idea not found' });
  if (idea.status !== 'pending') return res.status(400).json({ error: 'Idea is not pending review' });

  db.transaction(() => {
    db.prepare(
      "UPDATE ideas SET status='open', approved_at=datetime('now') WHERE id=?"
    ).run(idea.id);
    // The submission fee is earned by the platform on approval.
    if (idea.fee_stroops > 0) {
      creditPlatform(idea.fee_stroops);
      recordLedger({ type: 'idea_fee', amount: idea.fee_stroops, ref: `idea:${idea.id}` });
    }
  })();

  const updated = db.prepare('SELECT * FROM ideas WHERE id=?').get(idea.id);
  res.json({ idea: serializeIdea(updated) });
});

const rejectSchema = z.object({ reason: z.string().max(280).optional() });

router.post('/ideas/:id/reject', (req, res) => {
  const idea = db.prepare('SELECT * FROM ideas WHERE id=?').get(req.params.id);
  if (!idea) return res.status(404).json({ error: 'Idea not found' });
  if (idea.status !== 'pending') return res.status(400).json({ error: 'Idea is not pending review' });
  const { reason } = rejectSchema.parse(req.body || {});

  db.transaction(() => {
    db.prepare("UPDATE ideas SET status='rejected', reject_reason=? WHERE id=?").run(
      reason || 'Did not meet listing criteria',
      idea.id
    );
    // Refund the submission fee on rejection.
    if (idea.fee_stroops > 0) {
      adjustUserBalance(idea.creator_id, idea.fee_stroops);
      recordLedger({
        userId: idea.creator_id,
        type: 'idea_fee_refund',
        amount: idea.fee_stroops,
        ref: `idea:${idea.id}`,
      });
    }
  })();

  const updated = db.prepare('SELECT * FROM ideas WHERE id=?').get(idea.id);
  res.json({ idea: serializeIdea(updated) });
});

const resolveSchema = z.object({ winningOption: z.enum(['A', 'B']) });

router.post('/ideas/:id/resolve', (req, res) => {
  const parsed = resolveSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'winningOption must be "A" or "B"' });
  try {
    const result = resolveIdea(Number(req.params.id), parsed.data.winningOption);
    const updated = db.prepare('SELECT * FROM ideas WHERE id=?').get(req.params.id);
    res.json({ result, idea: serializeIdea(updated) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Approve the result the idea owner submitted → pays out using that option.
router.post('/ideas/:id/approve-result', (req, res) => {
  const idea = db.prepare('SELECT * FROM ideas WHERE id=?').get(req.params.id);
  if (!idea) return res.status(404).json({ error: 'Idea not found' });
  if (idea.result_status !== 'proposed' || !idea.proposed_option) {
    return res.status(400).json({ error: 'No result has been submitted for this market' });
  }
  try {
    const result = resolveIdea(Number(req.params.id), idea.proposed_option);
    db.prepare("UPDATE ideas SET result_status='approved' WHERE id=?").run(idea.id);
    const updated = db.prepare('SELECT * FROM ideas WHERE id=?').get(idea.id);
    res.json({ result, idea: serializeIdea(updated) });
  } catch (e) {
    res.status(400).json({ error: e.message });
  }
});

// Reject the submitted result so the idea owner can resubmit.
const rejectResultSchema = z.object({ reason: z.string().max(280).optional() });

router.post('/ideas/:id/reject-result', (req, res) => {
  const idea = db.prepare('SELECT * FROM ideas WHERE id=?').get(req.params.id);
  if (!idea) return res.status(404).json({ error: 'Idea not found' });
  if (idea.result_status !== 'proposed') {
    return res.status(400).json({ error: 'There is no pending result to reject' });
  }
  const { reason } = rejectResultSchema.parse(req.body || {});
  db.prepare(
    "UPDATE ideas SET result_status='rejected', result_note=? WHERE id=?"
  ).run(reason || 'Result needs review — please resubmit', idea.id);
  const updated = db.prepare('SELECT * FROM ideas WHERE id=?').get(idea.id);
  res.json({ idea: serializeIdea(updated) });
});

// All users with their betting totals.
router.get('/users', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT u.id, u.email, u.display_name, u.role, u.balance_stroops, u.created_at, u.flagged,
        (SELECT COUNT(*) FROM contributions c WHERE c.user_id=u.id) AS bets,
        (SELECT COALESCE(SUM(amount_stroops),0) FROM contributions c WHERE c.user_id=u.id) AS total_bet,
        (SELECT COALESCE(SUM(amount_stroops),0) FROM ledger l WHERE l.user_id=u.id AND l.type IN ('payout','owner_payout','refund','idea_fee_refund')) AS total_won,
        (SELECT COUNT(*) FROM ideas i WHERE i.creator_id=u.id) AS ideas_created,
        (SELECT COALESCE(SUM(amount_stroops),0) FROM ledger l WHERE l.user_id=u.id AND l.type IN ('payout','owner_payout','refund','idea_fee_refund','contribution','idea_fee')) AS net
       FROM users u ORDER BY total_bet DESC, u.id`
    )
    .all();
  res.json({
    users: rows.map((r) => ({
      id: r.id,
      email: r.email,
      name: r.display_name || r.email.split('@')[0],
      role: r.role,
      flagged: !!r.flagged,
      balance: stroopsToXlm(r.balance_stroops),
      bets: r.bets,
      totalBet: stroopsToXlm(r.total_bet),
      totalWon: stroopsToXlm(r.total_won),
      net: stroopsToXlm(r.net),
      ideasCreated: r.ideas_created,
      createdAt: r.created_at,
    })),
  });
});

// Global money flow — the entire ledger to date.
router.get('/ledger', (req, res) => {
  const limit = Math.min(500, Math.max(1, parseInt(req.query.limit) || 200));
  const rows = db
    .prepare(
      `SELECT l.id, l.user_id, l.type, l.amount_stroops, l.ref, l.status, l.created_at,
              u.display_name, u.email
       FROM ledger l LEFT JOIN users u ON u.id=l.user_id
       ORDER BY l.id DESC LIMIT ?`
    )
    .all(limit);
  res.json({
    ledger: rows.map((r) => ({
      id: r.id,
      type: r.type,
      amount: stroopsToXlm(r.amount_stroops),
      who: r.user_id ? r.display_name || r.email.split('@')[0] : 'platform',
      ref: r.ref,
      status: r.status,
      at: r.created_at,
    })),
  });
});

router.get('/stats', (_req, res) => {
  const counts = db
    .prepare(
      `SELECT
        (SELECT COUNT(*) FROM users) AS users,
        (SELECT COUNT(*) FROM ideas) AS ideas,
        (SELECT COUNT(*) FROM ideas WHERE status='pending') AS pending,
        (SELECT COUNT(*) FROM ideas WHERE status='open') AS open,
        (SELECT COUNT(*) FROM ideas WHERE status IN ('resolved','refunded')) AS settled,
        (SELECT COALESCE(SUM(amount_stroops),0) FROM ledger WHERE type='contribution') AS volume`
    )
    .get();
  const devTotal = db.prepare("SELECT COALESCE(SUM(amount_stroops),0) AS s FROM ledger WHERE type='dev_fee'").get().s;
  const mktTotal = db.prepare("SELECT COALESCE(SUM(amount_stroops),0) AS s FROM ledger WHERE type='marketing_fee'").get().s;
  res.json({
    users: counts.users,
    ideas: counts.ideas,
    pending: counts.pending,
    open: counts.open,
    settled: counts.settled,
    volume: stroopsToXlm(Math.abs(counts.volume)),
    platformBalance: stroopsToXlm(getPlatformBalance()),
    devTotal: stroopsToXlm(devTotal),
    marketingTotal: stroopsToXlm(mktTotal),
  });
});

const withdrawSchema = z.object({
  destination: z.string().min(1),
  amount: z.number().positive(),
});

// Project owners withdraw accrued platform revenue.
router.post('/withdraw', async (req, res) => {
  const parsed = withdrawSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Invalid request' });
  const { destination, amount } = parsed.data;
  if (!isValidStellarAddress(destination)) {
    return res.status(400).json({ error: 'Invalid Stellar address' });
  }
  const amountStroops = xlmToStroops(amount);
  if (getPlatformBalance() < amountStroops) {
    return res.status(400).json({ error: 'Insufficient platform balance' });
  }

  creditPlatform(-amountStroops);
  try {
    const hot = getHotWallet();
    const hash = await sendNative({
      fromSecret: hot.secret,
      toPublic: destination,
      stroops: amountStroops,
      memo: 'MyIdea platform',
    });
    recordLedger({ type: 'platform_withdraw', amount: -amountStroops, ref: hash });
    res.json({ hash, amount });
  } catch (e) {
    creditPlatform(amountStroops); // roll back
    res.status(502).json({ error: `Withdrawal failed and was rolled back: ${e.message}` });
  }
});

export default router;

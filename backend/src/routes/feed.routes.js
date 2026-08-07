import { Router } from 'express';
import { db } from '../db.js';
import { stroopsToXlm } from '../money.js';

const router = Router();

const mask = (u) => {
  const base = u?.display_name || u?.email?.split('@')[0] || 'anon';
  return base.slice(0, 3) + '•••';
};

// Real-time "who just earned" feed — recent winner + owner payouts.
router.get('/wins', (_req, res) => {
  const rows = db
    .prepare(
      `SELECT l.id, l.type, l.amount_stroops, l.ref, l.created_at,
              u.display_name, u.email
       FROM ledger l JOIN users u ON u.id = l.user_id
       WHERE l.type IN ('payout','owner_payout') AND l.amount_stroops > 0
       ORDER BY l.id DESC LIMIT 20`
    )
    .all();

  const wins = rows.map((r) => {
    const ideaId = Number(String(r.ref || '').split(':')[1]) || null;
    const idea = ideaId ? db.prepare('SELECT title FROM ideas WHERE id=?').get(ideaId) : null;
    return {
      id: r.id,
      name: mask(r),
      amount: stroopsToXlm(r.amount_stroops),
      kind: r.type === 'owner_payout' ? 'owner' : 'win',
      ideaId,
      ideaTitle: idea?.title || null,
      at: r.created_at,
    };
  });
  res.json({ wins });
});

export default router;

import { Router } from 'express';
import { db } from '../db.js';
import { stroopsToXlm } from '../money.js';
import { serializeIdea } from '../services/markets.js';

const router = Router();

const nameOf = (u) => u?.display_name || u?.email?.split('@')[0] || 'anon';

// Public leaderboards. All amounts returned in XLM.
router.get('/', (_req, res) => {
  // 1) Idea owners by earnings (sum of owner_payout).
  const owners = db
    .prepare(
      `SELECT l.user_id, SUM(l.amount_stroops) AS earned,
              (SELECT COUNT(*) FROM ideas i WHERE i.creator_id=l.user_id) AS ideas
       FROM ledger l WHERE l.type='owner_payout'
       GROUP BY l.user_id ORDER BY earned DESC LIMIT 20`
    )
    .all()
    .map((r) => {
      const u = db.prepare('SELECT display_name, email FROM users WHERE id=?').get(r.user_id);
      return { userId: r.user_id, name: nameOf(u), earned: stroopsToXlm(r.earned), ideas: r.ideas };
    });

  // 2) Ideas by total money raised.
  const ideas = db
    .prepare(
      `SELECT * FROM ideas WHERE status IN ('open','closed','resolved','refunded')
       ORDER BY (pool_a_stroops + pool_b_stroops) DESC LIMIT 20`
    )
    .all()
    .map((i) => {
      const s = serializeIdea(i);
      return {
        id: s.id,
        title: s.title,
        category: s.category,
        total: s.total,
        backers: s.backers,
        status: s.status,
        creator: s.creator,
      };
    });

  // 3) Users by net earnings (all gameplay ledger flows, signed).
  const users = db
    .prepare(
      `SELECT user_id, SUM(amount_stroops) AS net
       FROM ledger
       WHERE user_id IS NOT NULL
         AND type IN ('payout','owner_payout','refund','idea_fee_refund','contribution','idea_fee')
       GROUP BY user_id ORDER BY net DESC LIMIT 20`
    )
    .all()
    .map((r) => {
      const u = db.prepare('SELECT display_name, email, role FROM users WHERE id=?').get(r.user_id);
      return { userId: r.user_id, name: nameOf(u), net: stroopsToXlm(r.net), admin: u?.role === 'admin' };
    });

  res.json({ owners, ideas, users });
});

export default router;

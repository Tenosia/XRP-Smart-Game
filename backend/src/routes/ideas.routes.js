import { Router } from 'express';
import { z } from 'zod';
import { db, recordLedger, adjustUserBalance } from '../db.js';
import { requireAuth, optionalAuth } from '../auth.js';
import { config } from '../config.js';
import { xlmToStroops } from '../money.js';
import { serializeIdea } from '../services/markets.js';
import { honeypot, velocityGuard, userKey } from '../services/botGuard.js';

const router = Router();

const PUBLIC_STATUSES = ['open', 'closed', 'resolved', 'refunded'];

// List ideas — paginated, searchable, sortable. Anonymous-friendly.
router.get('/', optionalAuth, (req, res) => {
  const page = Math.max(1, parseInt(req.query.page) || 1);
  const limit = Math.min(48, Math.max(1, parseInt(req.query.limit) || 12));
  const offset = (page - 1) * limit;
  const { status, category, sort } = req.query;
  const q = (req.query.q || '').trim().toLowerCase();

  const where = [];
  const args = { limit, offset };
  if (status && PUBLIC_STATUSES.includes(status)) {
    where.push('status=@status');
    args.status = status;
  } else if (status === 'settled') {
    where.push("status IN ('resolved','refunded')");
  } else {
    where.push("status IN ('open','closed','resolved','refunded')");
  }
  if (category && category !== 'All') {
    where.push('category=@category');
    args.category = category;
  }
  if (q) {
    where.push('(LOWER(title) LIKE @q OR LOWER(description) LIKE @q OR LOWER(category) LIKE @q)');
    args.q = `%${q}%`;
  }
  const whereSql = `WHERE ${where.join(' AND ')}`;

  const orderSql =
    sort === 'new'
      ? 'ORDER BY id DESC'
      : sort === 'popular' || sort === 'fund'
      ? 'ORDER BY (pool_a_stroops + pool_b_stroops) DESC, id DESC'
      : sort === 'backers'
      ? 'ORDER BY (SELECT COUNT(DISTINCT user_id) FROM contributions c WHERE c.idea_id=ideas.id) DESC, id DESC'
      : `ORDER BY CASE status WHEN 'open' THEN 0 WHEN 'closed' THEN 1 ELSE 2 END, closes_at ASC`;

  const total = db.prepare(`SELECT COUNT(*) AS n FROM ideas ${whereSql}`).get(args).n;
  const rows = db.prepare(`SELECT * FROM ideas ${whereSql} ${orderSql} LIMIT @limit OFFSET @offset`).all(args);

  res.json({
    ideas: rows.map((i) => serializeIdea(i, { viewerId: req.user?.id })),
    total,
    page,
    pages: Math.max(1, Math.ceil(total / limit)),
    limit,
  });
});

// Hot ideas: blended score of money + number of backers (open ideas only).
router.get('/hot', optionalAuth, (req, res) => {
  const rows = db
    .prepare(`SELECT * FROM ideas WHERE status='open' ORDER BY (pool_a_stroops+pool_b_stroops) DESC LIMIT 40`)
    .all();
  const ser = rows.map((i) => serializeIdea(i, { viewerId: req.user?.id }));
  ser.sort((a, b) => b.total + b.backers * 50 - (a.total + a.backers * 50));
  res.json({ ideas: ser.slice(0, 8) });
});

// Ideas I created + my positions.
router.get('/mine', requireAuth, (req, res) => {
  const created = db.prepare('SELECT * FROM ideas WHERE creator_id=? ORDER BY id DESC').all(req.user.id);

  const positions = db
    .prepare(
      `SELECT c.idea_id, c.option,
              SUM(c.amount_stroops) AS staked,
              SUM(c.payout_stroops) AS payout
       FROM contributions c WHERE c.user_id=?
       GROUP BY c.idea_id, c.option`
    )
    .all(req.user.id);

  const ideaIds = [...new Set(positions.map((p) => p.idea_id))];
  const ideaMap = {};
  for (const id of ideaIds) {
    const idea = db.prepare('SELECT * FROM ideas WHERE id=?').get(id);
    if (idea) ideaMap[id] = serializeIdea(idea, { viewerId: req.user.id });
  }

  res.json({
    created: created.map((i) => serializeIdea(i, { viewerId: req.user.id })),
    positions: positions.map((p) => ({
      ideaId: p.idea_id,
      option: p.option,
      staked: p.staked / 1e7,
      payout: p.payout / 1e7,
      idea: ideaMap[p.idea_id],
    })),
  });
});

router.get('/:id', optionalAuth, (req, res) => {
  const idea = db.prepare('SELECT * FROM ideas WHERE id=?').get(req.params.id);
  if (!idea) return res.status(404).json({ error: 'Idea not found' });

  // Bettors grouped by side (one row per user per option, biggest first).
  const rows = db
    .prepare(
      `SELECT c.user_id, c.option, SUM(c.amount_stroops) AS amt, MAX(c.created_at) AS at,
              u.display_name, u.email
       FROM contributions c JOIN users u ON u.id=c.user_id
       WHERE c.idea_id=? GROUP BY c.user_id, c.option ORDER BY amt DESC`
    )
    .all(idea.id);

  const bettors = { A: [], B: [] };
  for (const r of rows) {
    const name = (r.display_name || r.email.split('@')[0]).slice(0, 3) + '•••';
    bettors[r.option]?.push({ name, amount: r.amt / 1e7, at: r.at });
  }

  res.json({ idea: serializeIdea(idea, { viewerId: req.user?.id }), bettors });
});

const optUrl = z.union([z.string().trim().url().max(200), z.literal('')]).optional();
const clean = (v) => (v && v.trim() ? v.trim() : null);

const createSchema = z.object({
  title: z.string().min(8).max(140),
  description: z.string().min(10).max(1200),
  category: z.string().max(40).optional(),
  optionA: z.string().min(1).max(40),
  optionB: z.string().min(1).max(40),
  closesAt: z.string().refine((s) => {
    const t = Date.parse(s);
    return !Number.isNaN(t) && t > Date.now() + 60_000;
  }, 'Funding deadline must be a valid date in the future'),
  endsAt: z.string().refine((s) => !Number.isNaN(Date.parse(s)), 'Invalid end date'),
  xUrl: optUrl,
  telegramUrl: optUrl,
  discordUrl: optUrl,
}).refine((d) => Date.parse(d.endsAt) >= Date.parse(d.closesAt), {
  message: 'The idea end time must be at or after the funding deadline',
  path: ['endsAt'],
});

router.post(
  '/',
  requireAuth,
  honeypot('hp'),
  velocityGuard({ key: userKey, windowMs: 60_000, max: 5, flagUser: true, message: 'You are creating ideas too quickly.' }),
  (req, res) => {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: parsed.error.issues[0].message });
    const d = parsed.data;
    // Admins (project owners) create ideas for free.
    const feeStroops = req.user.role === 'admin' ? 0 : xlmToStroops(config.ideaFeeXlm);

    try {
      const ideaId = db.transaction(() => {
        if (feeStroops > 0) {
          const u = db.prepare('SELECT balance_stroops FROM users WHERE id=?').get(req.user.id);
          if (u.balance_stroops < feeStroops) throw new Error('INSUFFICIENT_FEE');
          adjustUserBalance(req.user.id, -feeStroops);
          recordLedger({ userId: req.user.id, type: 'idea_fee', amount: -feeStroops });
        }
        const info = db
          .prepare(
            `INSERT INTO ideas (creator_id, title, description, category, option_a, option_b,
                                closes_at, ends_at, fee_stroops, status, x_url, telegram_url, discord_url)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', ?, ?, ?)`
          )
          .run(
            req.user.id,
            d.title,
            d.description,
            d.category || 'General',
            d.optionA,
            d.optionB,
            new Date(d.closesAt).toISOString(),
            new Date(d.endsAt).toISOString(),
            feeStroops,
            clean(d.xUrl),
            clean(d.telegramUrl),
            clean(d.discordUrl)
          );
        return info.lastInsertRowid;
      })();

      const idea = db.prepare('SELECT * FROM ideas WHERE id=?').get(ideaId);
      res.json({ idea: serializeIdea(idea, { viewerId: req.user.id }) });
    } catch (e) {
      if (e.message === 'INSUFFICIENT_FEE') {
        return res.status(400).json({ error: `You need ${config.ideaFeeXlm} XLM to submit an idea for review` });
      }
      throw e;
    }
  }
);

// Idea owner submits the proposed result — ONLY after the idea's end date.
const proposeSchema = z.object({ winningOption: z.enum(['A', 'B']) });

router.post('/:id/propose-result', requireAuth, (req, res) => {
  const parsed = proposeSchema.safeParse(req.body);
  if (!parsed.success) return res.status(400).json({ error: 'Choose A or B as the result' });

  const idea = db.prepare('SELECT * FROM ideas WHERE id=?').get(req.params.id);
  if (!idea) return res.status(404).json({ error: 'Idea not found' });
  if (idea.creator_id !== req.user.id) {
    return res.status(403).json({ error: 'Only the idea owner can submit the result' });
  }
  if (!['open', 'closed'].includes(idea.status)) {
    return res.status(400).json({ error: 'This idea cannot take a result right now' });
  }
  const endsAt = idea.ends_at || idea.closes_at;
  if (Date.parse(endsAt) > Date.now()) {
    return res.status(400).json({ error: 'You can submit the result only after the idea end time has passed' });
  }

  db.prepare(
    `UPDATE ideas SET proposed_option=?, proposed_at=datetime('now'),
                      result_status='proposed', result_note=NULL
     WHERE id=?`
  ).run(parsed.data.winningOption, idea.id);

  const updated = db.prepare('SELECT * FROM ideas WHERE id=?').get(idea.id);
  res.json({ idea: serializeIdea(updated, { viewerId: req.user.id }) });
});

const contributeSchema = z.object({
  option: z.enum(['A', 'B']),
  amount: z.number().positive(),
});

router.post(
  '/:id/contribute',
  requireAuth,
  velocityGuard({ key: userKey, windowMs: 15_000, max: 8, flagUser: true, message: 'Too many selections too quickly — slow down.' }),
  (req, res) => {
    const parsed = contributeSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: 'Choose a side and a valid amount' });
    const { option, amount } = parsed.data;
    const amountStroops = xlmToStroops(amount);
    const minStroops = xlmToStroops(config.minStakeXlm);
    if (amountStroops < minStroops) {
      return res.status(400).json({ error: `Minimum selection is ${config.minStakeXlm} XLM` });
    }

    const idea = db.prepare('SELECT * FROM ideas WHERE id=?').get(req.params.id);
    if (!idea) return res.status(404).json({ error: 'Idea not found' });
    if (idea.status !== 'open') return res.status(400).json({ error: 'This idea is not open for selections' });
    if (Date.parse(idea.closes_at) <= Date.now()) {
      return res.status(400).json({ error: 'This idea has closed' });
    }

    try {
      db.transaction(() => {
        const u = db.prepare('SELECT balance_stroops FROM users WHERE id=?').get(req.user.id);
        if (u.balance_stroops < amountStroops) throw new Error('INSUFFICIENT');
        adjustUserBalance(req.user.id, -amountStroops);
        db.prepare(
          `INSERT INTO contributions (idea_id, user_id, option, amount_stroops) VALUES (?, ?, ?, ?)`
        ).run(idea.id, req.user.id, option, amountStroops);
        const col = option === 'A' ? 'pool_a_stroops' : 'pool_b_stroops';
        db.prepare(`UPDATE ideas SET ${col} = ${col} + ? WHERE id=?`).run(amountStroops, idea.id);
        recordLedger({
          userId: req.user.id,
          type: 'contribution',
          amount: -amountStroops,
          ref: `idea:${idea.id}:${option}`,
        });
      })();
    } catch (e) {
      if (e.message === 'INSUFFICIENT') return res.status(400).json({ error: 'Insufficient balance' });
      throw e;
    }

    const updated = db.prepare('SELECT * FROM ideas WHERE id=?').get(idea.id);
    res.json({ idea: serializeIdea(updated, { viewerId: req.user.id }) });
  }
);

export default router;

import { db, recordLedger, creditPlatform, adjustUserBalance } from '../db.js';
import { config } from '../config.js';
import { splitByBps, proRata, stroopsToXlm } from '../money.js';

// ── Resolution + payout ───────────────────────────────────────────────
// Winners NEVER lose: every winner gets their full stake back. Only the
// LOSERS' pool is redistributed:
//   70% → winning contributors, pro-rata by stake (their profit)
//   20% → idea creator (the "owner")
//   10% → platform (project owners)
// So each winner receives:  their stake  +  70% of losers' pool × (stake / winners' stake)
// Edge cases:
//   • No contributions at all          → just mark resolved
//   • Nobody backed the winning side   → refund every contributor their stake
//   • No losers (everyone won)         → everyone simply gets their stake back
export const resolveIdea = db.transaction((ideaId, winningOption) => {
  const idea = db.prepare('SELECT * FROM ideas WHERE id = ?').get(ideaId);
  if (!idea) throw new Error('Idea not found');
  if (!['open', 'closed'].includes(idea.status)) {
    throw new Error(`Cannot resolve an idea in status "${idea.status}"`);
  }
  if (!['A', 'B'].includes(winningOption)) throw new Error('winningOption must be "A" or "B"');

  const total = idea.pool_a_stroops + idea.pool_b_stroops;
  const winnersStake = winningOption === 'A' ? idea.pool_a_stroops : idea.pool_b_stroops;
  const losersPool = winningOption === 'A' ? idea.pool_b_stroops : idea.pool_a_stroops;
  const now = new Date().toISOString();

  // No money in the pool — nothing to pay.
  if (total === 0) {
    db.prepare(
      `UPDATE ideas SET status='resolved', winning_option=?, resolved_at=? WHERE id=?`
    ).run(winningOption, now, ideaId);
    return { status: 'resolved', total: 0, payouts: 0 };
  }

  // No winners — refund all contributors their original stake.
  if (winnersStake === 0) {
    const contribs = db
      .prepare('SELECT * FROM contributions WHERE idea_id = ?')
      .all(ideaId);
    for (const c of contribs) {
      adjustUserBalance(c.user_id, c.amount_stroops);
      db.prepare('UPDATE contributions SET payout_stroops=? WHERE id=?').run(
        c.amount_stroops,
        c.id
      );
      recordLedger({
        userId: c.user_id,
        type: 'refund',
        amount: c.amount_stroops,
        ref: `idea:${ideaId}`,
      });
    }
    db.prepare(
      `UPDATE ideas SET status='refunded', winning_option=?, resolved_at=? WHERE id=?`
    ).run(winningOption, now, ideaId);
    return { status: 'refunded', total, refunded: contribs.length };
  }

  // Normal payout: ONLY the losers' pool is split 70/20/5/5. Winners keep their stake.
  const [winnersBonus, ownerCut, devCut, marketingCut] = splitByBps(losersPool, [
    config.split.winnersBps,
    config.split.ownerBps,
    config.split.devBps,
    config.split.marketingBps,
  ]);
  const platformCut = devCut + marketingCut;

  const winners = db
    .prepare('SELECT * FROM contributions WHERE idea_id = ? AND option = ?')
    .all(ideaId, winningOption);

  // Each winner's profit is their pro-rata slice of the 70% bonus.
  const bonusShares = proRata(winnersBonus, winners.map((w) => w.amount_stroops));
  const perUser = new Map();
  winners.forEach((w, i) => {
    const payout = w.amount_stroops + bonusShares[i]; // stake returned + profit
    db.prepare('UPDATE contributions SET payout_stroops=? WHERE id=?').run(payout, w.id);
    perUser.set(w.user_id, (perUser.get(w.user_id) || 0) + payout);
  });

  for (const [userId, amount] of perUser) {
    adjustUserBalance(userId, amount);
    recordLedger({ userId, type: 'payout', amount, ref: `idea:${ideaId}` });
  }

  // Idea creator (owner) cut — from the losers' pool only.
  if (ownerCut > 0) {
    adjustUserBalance(idea.creator_id, ownerCut);
    recordLedger({
      userId: idea.creator_id,
      type: 'owner_payout',
      amount: ownerCut,
      ref: `idea:${ideaId}`,
    });
  }

  // Platform cut — split into dev + marketing buckets, both held in the platform balance.
  if (platformCut > 0) {
    creditPlatform(platformCut);
    if (devCut > 0)
      recordLedger({ userId: null, type: 'dev_fee', amount: devCut, ref: `idea:${ideaId}` });
    if (marketingCut > 0)
      recordLedger({ userId: null, type: 'marketing_fee', amount: marketingCut, ref: `idea:${ideaId}` });
  }

  db.prepare(
    `UPDATE ideas SET status='resolved', winning_option=?, resolved_at=? WHERE id=?`
  ).run(winningOption, now, ideaId);

  return {
    status: 'resolved',
    total,
    losersPool,
    winnersBonus,
    ownerCut,
    devCut,
    marketingCut,
    winners: winners.length,
  };
});

// Close betting on ideas whose deadline has passed (open → closed).
export function closeExpiredIdeas() {
  const res = db
    .prepare(
      `UPDATE ideas SET status='closed'
       WHERE status='open' AND closes_at <= datetime('now')`
    )
    .run();
  return res.changes;
}

// ── Serialization for API responses ───────────────────────────────────
export function serializeIdea(idea, { viewerId } = {}) {
  const poolA = idea.pool_a_stroops;
  const poolB = idea.pool_b_stroops;
  const total = poolA + poolB;

  let myStakeA = 0;
  let myStakeB = 0;
  if (viewerId) {
    const rows = db
      .prepare(
        `SELECT option, COALESCE(SUM(amount_stroops),0) AS s
         FROM contributions WHERE idea_id=? AND user_id=? GROUP BY option`
      )
      .all(idea.id, viewerId);
    for (const r of rows) {
      if (r.option === 'A') myStakeA = r.s;
      else if (r.option === 'B') myStakeB = r.s;
    }
  }

  const creator = db
    .prepare('SELECT display_name, email FROM users WHERE id=?')
    .get(idea.creator_id);

  // Per-side participation counts (distinct backers per option).
  const counts = db
    .prepare(
      `SELECT option, COUNT(DISTINCT user_id) AS users, COUNT(*) AS bets
       FROM contributions WHERE idea_id=? GROUP BY option`
    )
    .all(idea.id);
  let countA = 0;
  let countB = 0;
  for (const c of counts) {
    if (c.option === 'A') countA = c.users;
    else if (c.option === 'B') countB = c.users;
  }
  const backers = db
    .prepare('SELECT COUNT(DISTINCT user_id) AS n FROM contributions WHERE idea_id=?')
    .get(idea.id).n;

  return {
    id: idea.id,
    title: idea.title,
    description: idea.description,
    category: idea.category,
    optionA: idea.option_a,
    optionB: idea.option_b,
    status: idea.status,
    closesAt: idea.closes_at, // funding window end (no bets after this)
    endsAt: idea.ends_at || idea.closes_at, // idea end / resolution time
    closed: Date.parse(idea.closes_at) <= Date.now(), // funding closed
    fundingClosed: Date.parse(idea.closes_at) <= Date.now(),
    ended: Date.parse(idea.ends_at || idea.closes_at) <= Date.now(),
    winningOption: idea.winning_option,
    createdAt: idea.created_at,
    resolvedAt: idea.resolved_at,
    rejectReason: idea.reject_reason,
    // Result-proposal flow (owner proposes → admin approves)
    proposedOption: idea.proposed_option || null,
    proposedAt: idea.proposed_at || null,
    resultStatus: idea.result_status || null,
    resultNote: idea.result_note || null,
    // Optional promotion links set by the idea owner
    xUrl: idea.x_url || null,
    telegramUrl: idea.telegram_url || null,
    discordUrl: idea.discord_url || null,
    creator: { id: idea.creator_id, name: creator?.display_name || creator?.email?.split('@')[0] },
    backers,
    countA, // users on option A ("first answer")
    countB, // users on option B ("second answer")
    poolA: stroopsToXlm(poolA),
    poolB: stroopsToXlm(poolB),
    total: stroopsToXlm(total),
    // Implied probability for each side = its share of the pool.
    oddsA: total > 0 ? poolA / total : 0.5,
    oddsB: total > 0 ? poolB / total : 0.5,
    myStakeA: stroopsToXlm(myStakeA),
    myStakeB: stroopsToXlm(myStakeB),
  };
}

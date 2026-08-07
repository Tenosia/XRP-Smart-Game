import { db, recordLedger, adjustUserBalance } from '../db.js';
import { decrypt } from '../crypto.js';
import { listIncomingNative, sweepToHotWallet, getHotWallet } from '../stellar.js';
import { stroopsToXlm } from '../money.js';

// Credit a single detected deposit, idempotently keyed by the Horizon paging cursor.
const creditDeposit = db.transaction((user, deposit) => {
  // Cursor monotonically increases; skip anything we've already processed.
  if (user.deposit_cursor && deposit.cursor <= user.deposit_cursor) return false;
  adjustUserBalance(user.id, deposit.stroops);
  db.prepare('UPDATE users SET deposit_cursor=? WHERE id=?').run(deposit.cursor, user.id);
  recordLedger({
    userId: user.id,
    type: 'deposit',
    amount: deposit.stroops,
    ref: deposit.hash,
  });
  return true;
});

async function processUser(user) {
  const { deposits, cursor } = await listIncomingNative(user.deposit_public, user.deposit_cursor);
  let credited = 0;
  let creditedAny = false;
  for (const dep of deposits) {
    // re-read latest cursor each loop (transaction guards against dupes)
    const fresh = db.prepare('SELECT * FROM users WHERE id=?').get(user.id);
    if (creditDeposit(fresh, dep)) {
      credited += dep.stroops;
      creditedAny = true;
      console.log(
        `💰 Deposit credited: ${stroopsToXlm(dep.stroops)} XLM → user ${user.id} (${user.email})`
      );
    }
  }
  // Keep cursor advancing even if no creditable deposits were found.
  if (cursor && (!user.deposit_cursor || cursor > user.deposit_cursor)) {
    db.prepare('UPDATE users SET deposit_cursor=? WHERE id=?').run(cursor, user.id);
  }

  // Best-effort sweep of new funds into the hot wallet (so withdrawals are payable).
  if (creditedAny) {
    try {
      const secret = decrypt(user.deposit_secret_enc);
      const hash = await sweepToHotWallet(secret, getHotWallet().publicKey);
      if (hash) console.log(`   ↳ swept user ${user.id} deposit account → hot wallet (${hash})`);
    } catch (e) {
      console.warn(`   ↳ sweep failed for user ${user.id}: ${e.message}`);
    }
  }
  return credited;
}

// Force an on-demand deposit check for a single user (used by the "Refresh" button).
export async function syncUserDeposits(userId) {
  const user = db.prepare('SELECT * FROM users WHERE id=?').get(userId);
  if (!user) return 0;
  return processUser(user);
}

let running = false;
export async function pollDeposits() {
  if (running) return; // avoid overlap
  running = true;
  try {
    const users = db.prepare('SELECT * FROM users').all();
    for (const user of users) {
      try {
        await processUser(user);
      } catch (e) {
        console.warn(`deposit poll failed for user ${user.id}: ${e.message}`);
      }
    }
  } finally {
    running = false;
  }
}

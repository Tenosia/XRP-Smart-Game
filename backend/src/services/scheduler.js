import { pollDeposits } from './deposits.js';
import { closeExpiredIdeas } from './markets.js';

// Lightweight in-process schedulers (no external cron dependency).
export function startSchedulers() {
  // Close betting on expired ideas every 15s.
  setInterval(() => {
    try {
      const n = closeExpiredIdeas();
      if (n > 0) console.log(`⏰ Closed ${n} expired idea(s)`);
    } catch (e) {
      console.warn('closeExpiredIdeas failed:', e.message);
    }
  }, 15_000);

  // Poll the Stellar network for incoming deposits every 20s.
  setInterval(() => {
    pollDeposits().catch((e) => console.warn('pollDeposits failed:', e.message));
  }, 20_000);

  // Kick off an initial deposit poll shortly after boot.
  setTimeout(() => pollDeposits().catch(() => {}), 3_000);

  console.log('🗓️  Schedulers started (idea-close: 15s, deposit-poll: 20s)');
}

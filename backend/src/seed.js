// Optional demo data so the marketplace looks alive without real testnet deposits.
// Run with:  npm run seed
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { db, adjustUserBalance } from './db.js';
import { generateKeypair } from './stellar.js';
import { encrypt } from './crypto.js';
import { xlmToStroops } from './money.js';

if (config.stellar.network === 'public') {
  console.error('❌ Refusing to seed demo data on MAINNET (it would create fake balances). Aborting.');
  process.exit(1);
}

const existing = db.prepare("SELECT COUNT(*) AS n FROM ideas").get().n;
if (existing > 0) {
  console.log(`Skipping seed — ${existing} idea(s) already exist.`);
  process.exit(0);
}

function makeUser(email, name, balanceXlm, role = 'user') {
  const found = db.prepare('SELECT * FROM users WHERE email=?').get(email);
  if (found) return found;
  const kp = generateKeypair();
  const info = db
    .prepare(
      `INSERT INTO users (email, password_hash, display_name, role, deposit_public, deposit_secret_enc, balance_stroops)
       VALUES (?,?,?,?,?,?,?)`
    )
    .run(email, bcrypt.hashSync('password123', 10), name, role, kp.publicKey, encrypt(kp.secret), xlmToStroops(balanceXlm));
  return db.prepare('SELECT * FROM users WHERE id=?').get(info.lastInsertRowid);
}

const oracle = makeUser('oracle@predixo.app', 'Oracle Labs', 50000);
const alice = makeUser('alice@predixo.app', 'Alice', 5000);
const bob = makeUser('bob@predixo.app', 'Bob', 5000);
const carol = makeUser('carol@predixo.app', 'Carol', 5000);

function daysFromNow(d) {
  return new Date(Date.now() + d * 86400_000).toISOString();
}

function createIdea({ creator, title, description, category, optionA, optionB, closesAt, bets }) {
  const endsAt = new Date(Date.parse(closesAt) + 86400_000).toISOString(); // ends 1 day after funding closes
  const info = db
    .prepare(
      `INSERT INTO ideas (creator_id, title, description, category, option_a, option_b, closes_at, ends_at, status, approved_at)
       VALUES (?,?,?,?,?,?,?,?, 'open', datetime('now'))`
    )
    .run(creator.id, title, description, category, optionA, optionB, closesAt, endsAt);
  const ideaId = info.lastInsertRowid;

  for (const [user, option, amount] of bets) {
    const stroops = xlmToStroops(amount);
    adjustUserBalance(user.id, -stroops);
    db.prepare(
      `INSERT INTO contributions (idea_id, user_id, option, amount_stroops) VALUES (?,?,?,?)`
    ).run(ideaId, user.id, option, stroops);
    const col = option === 'A' ? 'pool_a_stroops' : 'pool_b_stroops';
    db.prepare(`UPDATE ideas SET ${col}=${col}+? WHERE id=?`).run(stroops, ideaId);
    db.prepare(
      `INSERT INTO ledger (user_id, type, amount_stroops, ref) VALUES (?, 'contribution', ?, ?)`
    ).run(user.id, -stroops, `idea:${ideaId}:${option}`);
  }
  console.log(`  • ${title}`);
}

console.log('Seeding demo markets…');

createIdea({
  creator: oracle,
  title: 'Will France beat Brazil in the June 25th friendly?',
  description:
    'Full-time result of the France vs. Brazil international friendly on June 25th. "Yes" if France wins in regulation; "No" for a draw or Brazil win.',
  category: 'Sports',
  optionA: 'France wins',
  optionB: 'Draw or Brazil',
  closesAt: daysFromNow(2),
  bets: [
    [alice, 'A', 420],
    [bob, 'B', 300],
    [carol, 'A', 180],
  ],
});

createIdea({
  creator: oracle,
  title: 'Will BTC close higher on June 27th than today?',
  description:
    'Resolves "Up" if the Bitcoin price at the close of June 27th (UTC) is strictly higher than the price at market creation; otherwise "Down".',
  category: 'Crypto',
  optionA: 'Up',
  optionB: 'Down',
  closesAt: daysFromNow(4),
  bets: [
    [alice, 'A', 650],
    [bob, 'A', 220],
    [carol, 'B', 510],
  ],
});

createIdea({
  creator: oracle,
  title: 'Will it rain in London on June 30th?',
  description:
    'Resolves "Yes" if the Met Office records measurable precipitation at Heathrow on June 30th, otherwise "No".',
  category: 'Weather',
  optionA: 'Yes',
  optionB: 'No',
  closesAt: daysFromNow(7),
  bets: [
    [bob, 'A', 120],
    [carol, 'B', 90],
  ],
});

console.log('\nDone. Demo logins (password: password123):');
console.log('  oracle@predixo.app, alice@predixo.app, bob@predixo.app, carol@predixo.app');

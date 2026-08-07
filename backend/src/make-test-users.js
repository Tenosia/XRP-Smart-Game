// Create N test users, each with a fixed XLM balance, and print their credentials.
// Usage:  node src/make-test-users.js [count] [balanceXLM] [password]
import bcrypt from 'bcryptjs';
import { config } from './config.js';
import { db } from './db.js';
import { generateKeypair } from './stellar.js';
import { encrypt } from './crypto.js';
import { xlmToStroops, stroopsToXlm } from './money.js';

if (config.stellar.network === 'public') {
  console.error('❌ Refusing to create test users on MAINNET (fake balances). Aborting.');
  process.exit(1);
}

const COUNT = Number(process.argv[2] || 10);
const BALANCE_XLM = Number(process.argv[3] || 5000);
const PASSWORD = process.argv[4] || 'Test@12345';

const rows = [];
for (let i = 1; i <= COUNT; i++) {
  const email = `test${i}@predixo.app`;
  const name = `Test User ${i}`;
  const existing = db.prepare('SELECT * FROM users WHERE email=?').get(email);

  if (existing) {
    db.prepare('UPDATE users SET balance_stroops=?, password_hash=? WHERE id=?').run(
      xlmToStroops(BALANCE_XLM),
      bcrypt.hashSync(PASSWORD, 10),
      existing.id
    );
    rows.push({ email, address: existing.deposit_public });
  } else {
    const kp = generateKeypair();
    db.prepare(
      `INSERT INTO users (email, password_hash, display_name, role, deposit_public, deposit_secret_enc, balance_stroops)
       VALUES (?,?,?,'user',?,?,?)`
    ).run(email, bcrypt.hashSync(PASSWORD, 10), name, kp.publicKey, encrypt(kp.secret), xlmToStroops(BALANCE_XLM));
    rows.push({ email, address: kp.publicKey });
  }
}

console.log(`\n✅ Created/updated ${COUNT} test users — ${BALANCE_XLM} XLM each (shared password: ${PASSWORD})\n`);
console.log('  #  | Email                  | Password    | Balance  | Deposit address');
console.log('  ---+------------------------+-------------+----------+------------------------------------------------------------');
rows.forEach((r, i) => {
  console.log(
    `  ${String(i + 1).padEnd(2)} | ${r.email.padEnd(22)} | ${PASSWORD.padEnd(11)} | ${String(BALANCE_XLM).padEnd(8)} | ${r.address}`
  );
});

const total = db.prepare("SELECT COALESCE(SUM(balance_stroops),0) AS s FROM users WHERE email LIKE 'test%@predixo.app'").get().s;
console.log(`\nTotal test-user balance: ${stroopsToXlm(total)} XLM\n`);

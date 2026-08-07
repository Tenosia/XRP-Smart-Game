import Database from 'better-sqlite3';
import { fileURLToPath } from 'node:url';
import path from 'node:path';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DB_PATH = path.join(__dirname, '..', 'predixo.db');

export const db = new Database(DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS users (
  id                 INTEGER PRIMARY KEY AUTOINCREMENT,
  email              TEXT UNIQUE NOT NULL,
  password_hash      TEXT NOT NULL,
  role               TEXT NOT NULL DEFAULT 'user',      -- 'user' | 'admin'
  display_name       TEXT,
  deposit_public     TEXT NOT NULL,
  deposit_secret_enc TEXT NOT NULL,
  deposit_cursor     TEXT,                              -- Horizon paging token
  balance_stroops    INTEGER NOT NULL DEFAULT 0,        -- available balance
  created_at         TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ideas (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  creator_id      INTEGER NOT NULL REFERENCES users(id),
  title           TEXT NOT NULL,
  description     TEXT NOT NULL,
  category        TEXT NOT NULL DEFAULT 'General',
  option_a        TEXT NOT NULL,
  option_b        TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending',      -- pending|open|closed|resolved|rejected|refunded
  closes_at       TEXT NOT NULL,                        -- betting deadline (ISO)
  winning_option  TEXT,                                 -- 'A' | 'B'
  fee_stroops     INTEGER NOT NULL DEFAULT 0,
  pool_a_stroops  INTEGER NOT NULL DEFAULT 0,
  pool_b_stroops  INTEGER NOT NULL DEFAULT 0,
  reject_reason   TEXT,
  created_at      TEXT NOT NULL DEFAULT (datetime('now')),
  approved_at     TEXT,
  resolved_at     TEXT
);

CREATE TABLE IF NOT EXISTS contributions (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  idea_id        INTEGER NOT NULL REFERENCES ideas(id),
  user_id        INTEGER NOT NULL REFERENCES users(id),
  option         TEXT NOT NULL,                         -- 'A' | 'B'
  amount_stroops INTEGER NOT NULL,
  payout_stroops INTEGER NOT NULL DEFAULT 0,            -- filled on resolution
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS ledger (
  id             INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id        INTEGER REFERENCES users(id),          -- null = platform
  type           TEXT NOT NULL,
  amount_stroops INTEGER NOT NULL,                      -- signed (+credit / -debit)
  ref            TEXT,
  status         TEXT NOT NULL DEFAULT 'completed',
  created_at     TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS platform (
  id              INTEGER PRIMARY KEY CHECK (id = 1),
  balance_stroops INTEGER NOT NULL DEFAULT 0
);

INSERT OR IGNORE INTO platform (id, balance_stroops) VALUES (1, 0);

CREATE TABLE IF NOT EXISTS feedback (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  user_id     INTEGER REFERENCES users(id),
  email       TEXT,
  message     TEXT NOT NULL,
  created_at  TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_contrib_idea ON contributions(idea_id);
CREATE INDEX IF NOT EXISTS idx_contrib_user ON contributions(user_id);
CREATE INDEX IF NOT EXISTS idx_ledger_user ON ledger(user_id);
CREATE INDEX IF NOT EXISTS idx_ideas_status ON ideas(status);
`);

// ── Lightweight migrations (add columns if missing) ───────────────────
function ensureColumn(table, col, decl) {
  const cols = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!cols.some((c) => c.name === col)) {
    db.exec(`ALTER TABLE ${table} ADD COLUMN ${col} ${decl}`);
  }
}

// Result-proposal flow: the idea owner proposes the winning option, the
// project owner (admin) approves it to trigger payout.
ensureColumn('ideas', 'proposed_option', 'TEXT');           // 'A' | 'B'
ensureColumn('ideas', 'proposed_at', 'TEXT');
ensureColumn('ideas', 'result_status', 'TEXT');             // 'proposed' | 'rejected' | 'approved' | null
ensureColumn('ideas', 'result_note', 'TEXT');               // admin reason on rejection

// Second deadline: when the idea actually ends/resolves (>= funding close).
// closes_at = funding window end (no bets after this); ends_at = idea end (result known).
ensureColumn('ideas', 'ends_at', 'TEXT');

// Optional promotion links an idea owner can attach to market their idea.
ensureColumn('ideas', 'x_url', 'TEXT');
ensureColumn('ideas', 'telegram_url', 'TEXT');
ensureColumn('ideas', 'discord_url', 'TEXT');

// Bot-detection flag.
ensureColumn('users', 'flagged', 'INTEGER NOT NULL DEFAULT 0');

// ── Small reusable statements / helpers ──────────────────────────────
export const ledgerInsert = db.prepare(
  `INSERT INTO ledger (user_id, type, amount_stroops, ref, status)
   VALUES (@user_id, @type, @amount_stroops, @ref, @status)`
);

export function recordLedger({ userId = null, type, amount, ref = null, status = 'completed' }) {
  ledgerInsert.run({ user_id: userId, type, amount_stroops: amount, ref, status });
}

export function getPlatformBalance() {
  return db.prepare('SELECT balance_stroops FROM platform WHERE id = 1').get().balance_stroops;
}

export function creditPlatform(stroops) {
  db.prepare('UPDATE platform SET balance_stroops = balance_stroops + ? WHERE id = 1').run(stroops);
}

export function adjustUserBalance(userId, deltaStroops) {
  db.prepare('UPDATE users SET balance_stroops = balance_stroops + ? WHERE id = ?').run(
    deltaStroops,
    userId
  );
}

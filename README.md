# 🔮 MyIdea — Stake on what you know

A full-stack **prediction-market entertainment platform** settled on the **Stellar** network in
native **XLM**. Users float simple, knowable yes/no questions ("Will France beat Brazil on June
25th?", "Will BTC close higher on June 27th?"), the crowd splits into two camps and stakes XLM, and
when the outcome is known the pool is paid out automatically.

| | |
|---|---|
| **Frontend** | React 18 + Vite + Tailwind CSS + Framer Motion |
| **Backend** | Node.js + Express + better-sqlite3 |
| **Blockchain** | Stellar (testnet by default), `stellar-sdk`, XLM |
| **Auth** | Email + password, JWT |

---

## ✨ Features

- **Idea marketplace** — paginated, searchable lobby; each idea shows **who created it**, the pool, backer count and a live countdown.
- **Anyone can earn** — any user can become an idea owner (pay the listing fee) and earn 20% of every losing pool.
- **Leaderboards** (`/rankings`) — top idea owners (by earnings), top ideas (by money raised), top users (by net winnings).
- **Live wins ticker** — real-time feed of who just earned money (`/api/feed/wins`), on the lobby and landing.
- **Hot ideas** + **sorting** — by newest, most funded, or most backers.
- **Idea rule** — the answer must be *unpredictable now but obvious by the end date*; shown on Create with a required acknowledgement, enforced in review.
- **Split visualisation** — a donut chart of the 70/20/5/5 payout split on Create & Whitepaper.
- **Feedback** (`/feedback`) — users send feedback; admins read it in the console.
- **Timezone-aware** closing time — shows your local zone + the exact UTC instant.
- **Shareable idea links** — every idea page has a one-click **Copy link** for owners to market their idea.
- **Owner promotion** — idea owners can attach optional **X / Telegram / Discord** links, shown on the idea page. Site-wide socials live in the footer (edit `frontend/src/lib/site.js`).
- **Minimum stake** of 100 XLM (`MIN_STAKE_XLM`).
- **Result after end date** — owners can submit the outcome only once the idea's end date has passed; the platform approves it to pay out.
- **Bot protection** — a visible self-hosted **CAPTCHA** on sign-up (distorted SVG, verified statelessly via a short-lived signed token — no third-party service), plus hidden honeypot fields, per-IP/per-account velocity throttling, and account flagging.
- **Whitepaper** (`/whitepaper`) and **FAQ** (`/faq`).
- **Admin per-idea stats** — user count, Option A count, Option B count, and total fund for each idea.

## 🎭 Roles

- **Users** — sign up with email, get a personal Stellar deposit address, fund it, and stake on markets.
- **Idea Owners** — any user who pays the listing fee and submits a market. They earn **20%** of every pool their market generates.
- **Project Owners (admins)** — the operators. They review submissions, settle outcomes, and collect the **10%** platform cut.

## 💸 The economics — winners never lose

When a market settles, **every winner gets their full stake back**. Only the **losers' pool** is
redistributed:

| Share of the **losers' pool** | Recipient | Basis points (env) |
|------:|-----------|--------------------|
| **70%** | Winning backers, pro-rata by stake (their profit) | `SPLIT_WINNERS_BPS` |
| **20%** | The idea owner (creator) | `SPLIT_OWNER_BPS` |
| **5%** | Development fund | `SPLIT_DEV_BPS` |
| **5%** | Marketing fund | `SPLIT_MARKETING_BPS` |

So each winner receives **`their stake` + `70% of losers' pool × (their stake ÷ total winning stake)`**.
Only the losers lose money.

> **Example** — pool of 600 on the winning side, 400 on the losing side.
> Losers' pool = 400 → winners share 280 (70%), owner 80 (20%), dev 20 (5%), marketing 20 (5%).
> A winner who backed 60 (10% of the winning side) gets **60 back + 28 profit = 88**.

- A **listing fee** (default **1,000 XLM**, `IDEA_FEE_XLM`) is charged when a market is submitted. It is **kept by the platform on approval** and **refunded on rejection**.
- If **nobody backed the winning side**, every stake is **refunded** in full.
- If **there are no losers** (everyone picked the winning side), everyone simply gets their stake back.
- All internal accounting is done in integer **stroops** (1 XLM = 10,000,000 stroops) so there is never floating-point drift; rounding dust is conserved into the pool.

## 🔁 Market lifecycle

```
 submit (pay fee)        admin approves           deadline passes        admin sets winner
USER ───────────► pending ─────────────► open ───────────────► closed ───────────────► resolved
                     │                     ▲                                               │
                     │ admin rejects       │ users stake XLM                  pool paid 70/20/10
                     ▼                     │                                               │
                  rejected            (live odds)                   (no winners ⇒ refunded)
                (fee refunded)
```

Open markets auto-close at their deadline (a 15s scheduler). Admins can also resolve early if the
outcome is already known.

---

## 🚀 Quick start

**Prerequisites:** Node.js 18+ (tested on Node 22).

### 1. Backend

```bash
cd backend
npm install
cp .env.example .env          # a ready-to-run .env is already included for local dev
npm run seed                  # optional: load demo markets + demo users
npm start
```

On first boot the server will, on **testnet**, automatically generate a **hot wallet** and fund it
via Friendbot (printed once and saved to `backend/.hotwallet.json`). It also bootstraps the admin
account from `ADMIN_EMAIL` / `ADMIN_PASSWORD`.

The API listens on **http://localhost:4000**.

### 2. Frontend

```bash
cd frontend
npm install
npm run dev
```

Open **http://localhost:5173**. The Vite dev server proxies `/api` to the backend, so no CORS setup
is needed in development.

### 3. Log in

| Account | Email | Password | Role |
|---------|-------|----------|------|
| Project Owner | `admin@predixo.app` | `changeme123` | admin |
| Demo users (after `npm run seed`) | `alice@predixo.app`, `bob@predixo.app`, `carol@predixo.app`, `oracle@predixo.app` | `password123` | user |

The demo users start with a play-money balance so you can stake immediately. Real accounts start at
0 and fund themselves by depositing XLM to their address.

---

## 🏦 How money moves (custodial model)

MyIdea is a **custodial** platform, the same model exchanges use:

1. **Deposit** — every account gets a dedicated Stellar keypair. Send XLM to that address; a
   poller (every 20s) detects incoming payments via Horizon and credits the user's internal balance.
   Deposited funds are then **swept** into the platform hot wallet so withdrawals are always payable.
2. **Internal ledger** — staking, payouts and fees all move balances inside the database (instant,
   feeless). Every movement is recorded in the `ledger` table and shown in the user's history.
3. **Withdraw** — paid on-chain from the hot wallet to any Stellar address (new accounts are created
   automatically). The balance is reserved first and rolled back if the transaction fails.

Custodial secret keys are encrypted at rest with **AES-256-GCM** (`WALLET_ENCRYPTION_KEY`).

---

## 🔌 API reference

All bodies are JSON. Authenticated routes require `Authorization: Bearer <token>`.

### Auth
| Method | Path | Body | Notes |
|--------|------|------|-------|
| POST | `/api/auth/register` | `{email, password, displayName?}` | returns `{token, user}`, generates deposit wallet |
| POST | `/api/auth/login` | `{email, password}` | returns `{token, user}` |
| GET | `/api/auth/me` | — | current user |

### Wallet
| Method | Path | Body |
|--------|------|------|
| GET | `/api/wallet` | — |
| GET | `/api/wallet/transactions` | — |
| POST | `/api/wallet/refresh` | — (on-demand deposit check) |
| POST | `/api/wallet/withdraw` | `{destination, amount}` |

### Markets
| Method | Path | Body |
|--------|------|------|
| GET | `/api/ideas?status=open\|closed\|resolved` | — |
| GET | `/api/ideas/:id` | — (includes activity feed) |
| GET | `/api/ideas/mine` | — (created + positions) |
| POST | `/api/ideas` | `{title, description, category, optionA, optionB, closesAt}` |
| POST | `/api/ideas/:id/contribute` | `{option:'A'\|'B', amount}` |

### Admin (project owners)
| Method | Path | Body |
|--------|------|------|
| GET | `/api/admin/ideas?status=` | — |
| GET | `/api/admin/stats` | — |
| POST | `/api/admin/ideas/:id/approve` | — |
| POST | `/api/admin/ideas/:id/reject` | `{reason?}` |
| POST | `/api/admin/ideas/:id/resolve` | `{winningOption:'A'\|'B'}` |
| POST | `/api/admin/withdraw` | `{destination, amount}` (platform revenue) |

### Public
`GET /api/health` · `GET /api/config` (network, fee, split)

---

## ⚙️ Configuration (`backend/.env`)

| Variable | Default | Description |
|----------|---------|-------------|
| `PORT` | `4000` | API port |
| `CLIENT_ORIGIN` | `http://localhost:5173` | allowed CORS origin(s), comma-separated |
| `JWT_SECRET` | — | session signing secret |
| `WALLET_ENCRYPTION_KEY` | — | 64 hex chars (32 bytes) for encrypting custodial keys |
| `STELLAR_NETWORK` | `testnet` | `testnet` or `public` (mainnet) |
| `HORIZON_URL` | testnet Horizon | Horizon endpoint |
| `HOTWALLET_SECRET` | — | hot-wallet secret; auto-generated+funded on testnet if blank |
| `SPLIT_WINNERS_BPS` / `SPLIT_OWNER_BPS` / `SPLIT_DEV_BPS` / `SPLIT_MARKETING_BPS` | `7000/2000/500/500` | must sum to `10000` |
| `IDEA_FEE_XLM` | `1000` | idea listing fee |
| `MIN_WITHDRAW_XLM` | `1` | minimum withdrawal |
| `MIN_STAKE_XLM` | `100` | minimum stake per bet |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | `admin@predixo.app` / `changeme123` | bootstrap admin |

---

## 🛡️ Going to mainnet — checklist

This is a complete, working reference implementation. Before handling real money:

- [ ] Set `STELLAR_NETWORK=public`, a real `HORIZON_URL`, and a properly secured `HOTWALLET_SECRET` (cold/hot split, multisig).
- [ ] Generate strong, unique `JWT_SECRET` and `WALLET_ENCRYPTION_KEY`; store them in a secrets manager, **not** in `.env`.
- [ ] Move custodial key storage to an HSM/KMS; the current AES-256-GCM-at-rest is a starting point, not a vault.
- [ ] Add deposit confirmation thresholds, withdrawal limits/approvals, and KYC/AML as your jurisdiction requires.
- [ ] Swap SQLite for Postgres for concurrency/durability at scale.
- [ ] Add a robust resolution/oracle process (and dispute handling) instead of single-admin resolution.
- [ ] **Legal**: prediction markets / wagering are regulated in most jurisdictions. Obtain the appropriate licensing and legal review before operating with real funds.

## 📁 Project structure

```
predixo/
├── backend/
│   └── src/
│       ├── index.js            # Express app + bootstrap (admin, hot wallet, schedulers)
│       ├── config.js           # env + economic constants
│       ├── db.js               # SQLite schema + ledger helpers
│       ├── money.js            # stroop math, bps splits, pro-rata
│       ├── crypto.js           # AES-256-GCM for custodial keys
│       ├── stellar.js          # Horizon client, keypairs, deposits, sends, sweeps
│       ├── auth.js             # JWT + middleware + user serializer
│       ├── seed.js             # demo data
│       ├── routes/             # auth, wallet, ideas, admin
│       └── services/           # markets (resolve/payout), deposits, scheduler
└── frontend/
    └── src/
        ├── pages/              # Landing, Login, Register, Markets, IdeaDetail, CreateIdea, Wallet, Portfolio, Admin
        ├── components/         # Navbar, IdeaCard, OddsBar, Countdown, StatusBadge, …
        ├── context/            # Auth + Toast providers
        └── lib/                # api client, formatters
```

---

*Built on Stellar. Play responsibly.*

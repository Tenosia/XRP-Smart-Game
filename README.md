# MyIdea

MyIdea is a full-stack prediction-market platform settled on the Stellar network in native XLM. Anyone can pose a simple yes/no question whose answer will be obvious by a set date. The crowd splits into two sides and stakes XLM. When the outcome is known, the pool is paid out automatically and winners never lose their stake.

## At a glance

| Area | Details |
|------|---------|
| Frontend | React 18, Vite, Tailwind CSS, Framer Motion, React Router |
| Backend | Node.js, Express, SQLite (better-sqlite3), Zod validation |
| Blockchain | Stellar via stellar-sdk, XLM only, testnet by default |
| Auth | Email and password (bcrypt), JWT sessions valid for 7 days |
| Bot protection | Cloudflare Turnstile, honeypot fields, rate limits, account flagging |

## How it works

1. A user submits an idea: a question, two answer options, a funding deadline and an end time, and pays a listing fee.
2. A project owner reviews it. Approval lists it publicly. Rejection refunds the fee.
3. While the idea is open, users stake XLM on Option A or Option B. The split of money between the sides is the crowd's implied probability, shown live on the idea page.
4. At the funding deadline staking closes automatically (checked every 15 seconds).
5. After the end time, the idea owner submits the real-world result.
6. A project owner approves it, and the pool settles instantly. If the result is rejected, the owner can resubmit with the admin's note. Admins can also resolve an idea directly.

The idea rule: the answer must be unpredictable now but objectively obvious by the end date, such as a match result or a closing price. Opinions and anything that might never resolve are rejected in review.

Idea statuses: pending, open, closed, resolved, refunded, rejected.

## Roles

- **Visitors** can browse live ideas, idea pages, the whitepaper and the FAQ.
- **Users** sign up, get a personal Stellar deposit address, fund it, stake on ideas, and withdraw.
- **Idea owners** are any users who pay the listing fee and submit an idea. They earn 20% of the losing pool of every idea they create, and can attach optional X, Telegram and Discord links and a shareable link to promote it.
- **Project owners (admins)** review submissions, approve or reject results, monitor users and money flow, and withdraw platform revenue. Their own ideas carry no listing fee.

## Economics

When an idea settles, every winner gets their full stake back. Only the losing pool is redistributed:

| Share of the losing pool | Recipient |
|-------------------------:|-----------|
| 70% | Winning backers, pro-rata by stake (their profit) |
| 20% | The idea owner |
| 5% | Development fund (platform) |
| 5% | Marketing fund (platform) |

Example: 600 XLM on the winning side and 400 on the losing side. The losing pool of 400 pays 280 to winners, 80 to the owner, 20 to development and 20 to marketing. A winner who staked 60 (10% of the winning side) receives 60 back plus 28 profit, 88 in total.

- The listing fee (default 1,000 XLM) is kept by the platform on approval and refunded on rejection.
- The minimum stake per bet is 100 XLM by default.
- If nobody backed the winning side, every stake is refunded.
- If there are no losers, everyone simply gets their stake back.
- All balances are integer stroops (1 XLM = 10,000,000 stroops), so there is no floating-point drift. Rounding remainders are assigned deterministically so totals always balance exactly.

## Wallet and custody

MyIdea is custodial, like an exchange.

- **Deposits:** each account has its own Stellar keypair. A poller checks for incoming payments every 20 seconds (users can also refresh on demand), credits the internal balance, and sweeps funds into the platform hot wallet, leaving a small reserve behind.
- **Internal ledger:** staking, payouts and fees move balances inside the database, instantly and without fees. Every movement is recorded in a ledger shown in the user's history and in the admin money-flow view.
- **Withdrawals:** paid on-chain from the hot wallet to any Stellar address. The balance is reserved first and restored if the transaction fails. Destinations that do not exist yet are created automatically.
- **Key storage:** custodial secret keys are encrypted at rest with AES-256-GCM.
- **Hot wallet:** on testnet it is generated and funded automatically on first start and saved to a git-ignored file. On mainnet a funded secret must be supplied, and the server refuses to start without it.

## Pages

- Home: live ideas ranked by money raised and number of backers, refreshing automatically.
- Idea page: odds bar, countdown, backers per side, shareable link, owner result submission, and a live rankings panel (top idea owners, top ideas, top users).
- Create idea: guided form with the idea rule acknowledgement, times shown in the local timezone with the exact UTC instant.
- Wallet: balance, deposit address, withdrawals, transaction history.
- Portfolio: your positions and the ideas you created.
- Admin console: review queue, result resolution, users (with flagged accounts), money flow, treasury, and all ideas with per-option user counts and pool totals.
- Whitepaper and FAQ.

## Abuse protection

- Site-wide human check with Cloudflare Turnstile once per browser session, and again on sign-up.
- Hidden honeypot fields on sign-up and idea creation.
- Rate limits on the whole API, with a stricter limit on authentication, per-network sign-up limits, and velocity guards on creating ideas and staking.
- Accounts that act faster than a human can are throttled and flagged for admin review.
- The API binds to loopback only and is meant to sit behind a reverse proxy.

## Getting started

Requires Node.js 18 or newer.

Backend:

```bash
cd backend
npm install
cp .env.example .env
npm run seed      # optional: demo users and sample ideas (testnet only)
npm start         # or: npm run dev for watch mode
```

On first start the server creates the database, bootstraps the admin account from the environment, and on testnet generates and funds the hot wallet. It listens on port 4000.

Frontend:

```bash
cd frontend
npm install
npm run dev       # development server on port 5173
npm run build     # production build into dist
```

In development the Vite server proxies API requests to the backend, so no CORS setup is needed. In production, serve the built frontend and route API requests to the backend through a reverse proxy.

Utility: `node src/make-test-users.js [count] [balance] [password]` (run from backend) creates test users with a play-money balance. Like the seed script, it refuses to run on mainnet.

## Configuration

Set in `backend/.env`. See `backend/.env.example` for defaults and comments.

| Variable | Default | Purpose |
|----------|---------|---------|
| PORT | 4000 | Backend port |
| CLIENT_ORIGIN | local frontend | Allowed CORS origins, comma-separated |
| JWT_SECRET | placeholder | Session signing secret |
| WALLET_ENCRYPTION_KEY | zeros | 64 hex characters used to encrypt custodial keys |
| STELLAR_NETWORK | testnet | testnet or public |
| HORIZON_URL | testnet Horizon | Horizon endpoint |
| HOTWALLET_SECRET | empty | Hot wallet secret; auto-generated on testnet if blank, required on mainnet |
| SPLIT_WINNERS_BPS, SPLIT_OWNER_BPS, SPLIT_DEV_BPS, SPLIT_MARKETING_BPS | 7000, 2000, 500, 500 | Losing-pool split in basis points, must sum to 10000 |
| IDEA_FEE_XLM | 1000 | Listing fee |
| MIN_STAKE_XLM | 100 | Minimum stake per bet |
| MIN_WITHDRAW_XLM | 1 | Minimum withdrawal |
| MAX_WITHDRAW_XLM | 0 | Per-transaction withdrawal cap, 0 means no cap |
| ADMIN_EMAIL, ADMIN_PASSWORD | see .env.example | Bootstrap admin account |
| TURNSTILE_SITE_KEY, TURNSTILE_SECRET | Cloudflare test keys | Human verification keys |

The default Turnstile keys always pass, so they give no real protection. Replace them with real keys before going public. The site-wide social links shown in the footer are edited in `frontend/src/lib/site.js`.

## Project structure

```
myidea/
  backend/
    src/
      index.js        Express app, bootstrap, schedulers
      config.js       Environment and economic constants
      db.js           SQLite schema, migrations, ledger helpers
      money.js        Stroop math, basis-point splits, pro-rata
      crypto.js       AES-256-GCM for custodial keys
      stellar.js      Horizon client, deposits, sends, sweeps, hot wallet
      auth.js         JWT and access middleware
      seed.js         Demo data
      make-test-users.js
      routes/         auth, wallet, ideas, admin, rankings, feed
      services/       markets (settlement), deposits, scheduler, botGuard, turnstile
  frontend/
    src/
      pages/          Landing, IdeaDetail, CreateIdea, Wallet, Portfolio, Admin,
                      Login, Register, Whitepaper, FAQ
      components/     Layout, Navbar, IdeaCard, OddsBar, HumanGate, and others
      context/        Auth and toast providers
      lib/            API client, formatters, site settings
```

## Before going to mainnet

This is a working reference implementation. Before handling real money:

- Set the network to public, use a real Horizon endpoint, and secure the hot wallet (cold/hot split, multisig).
- Generate strong, unique values for the JWT secret and wallet encryption key, and keep them in a secrets manager rather than a file.
- Move custodial key storage to an HSM or KMS. AES-256-GCM at rest is a starting point, not a vault.
- Change the default admin credentials and install real Turnstile keys.
- Add deposit confirmation thresholds, withdrawal limits and approvals, and KYC/AML as your jurisdiction requires.
- Replace SQLite with Postgres for concurrency and durability at scale.
- Replace single-admin resolution with a robust oracle and dispute process.
- Legal: prediction markets and wagering are regulated in most jurisdictions. Obtain licensing and legal review before operating with real funds.

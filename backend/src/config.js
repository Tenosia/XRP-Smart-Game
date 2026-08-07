import 'dotenv/config';

const num = (v, d) => (v === undefined || v === '' ? d : Number(v));

export const config = {
  port: num(process.env.PORT, 4000),
  clientOrigins: (process.env.CLIENT_ORIGIN || 'http://localhost:5173')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean),

  jwtSecret: process.env.JWT_SECRET || 'dev-insecure-secret-change-me',
  walletEncryptionKey:
    process.env.WALLET_ENCRYPTION_KEY ||
    '0000000000000000000000000000000000000000000000000000000000000000',

  stellar: {
    network: (process.env.STELLAR_NETWORK || 'testnet').toLowerCase(),
    horizonUrl: process.env.HORIZON_URL || 'https://horizon-testnet.stellar.org',
    hotwalletSecret: process.env.HOTWALLET_SECRET || '',
  },

  // Economic split in basis points (1/100 of a percent), applied to the LOSERS' pool
  // only — winners always get their stake back. Must total 10000.
  split: {
    winnersBps: num(process.env.SPLIT_WINNERS_BPS, 7000),
    ownerBps: num(process.env.SPLIT_OWNER_BPS, 2000),
    devBps: num(process.env.SPLIT_DEV_BPS, 500),
    marketingBps: num(process.env.SPLIT_MARKETING_BPS, 500),
  },

  ideaFeeXlm: num(process.env.IDEA_FEE_XLM, 1000),
  minWithdrawXlm: num(process.env.MIN_WITHDRAW_XLM, 1),
  maxWithdrawXlm: num(process.env.MAX_WITHDRAW_XLM, 0), // 0 = no cap
  minStakeXlm: num(process.env.MIN_STAKE_XLM, 100),

  admin: {
    email: (process.env.ADMIN_EMAIL || 'admin@predixo.app').toLowerCase(),
    password: process.env.ADMIN_PASSWORD || 'changeme123',
  },

  // Cloudflare Turnstile ("Verify you are human"). Defaults are Cloudflare's
  // ALWAYS-PASS test keys — replace with real keys from the Cloudflare dashboard
  // (Turnstile → add site myidea.today) for actual bot protection.
  turnstile: {
    siteKey: process.env.TURNSTILE_SITE_KEY || '1x00000000000000000000AA',
    secret: process.env.TURNSTILE_SECRET || '1x0000000000000000000000000000000AA',
  },
};

const totalBps =
  config.split.winnersBps +
  config.split.ownerBps +
  config.split.devBps +
  config.split.marketingBps;
if (totalBps !== 10000) {
  throw new Error(
    `Split basis points must sum to 10000, got ${totalBps}. Check SPLIT_* env vars.`
  );
}

export const STROOPS_PER_XLM = 10_000_000;

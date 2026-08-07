import * as StellarSdk from 'stellar-sdk';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { config } from './config.js';
import { stroopsToAmountString, xlmToStroops } from './money.js';

const { Horizon, Keypair, Networks, Asset, Operation, TransactionBuilder, Memo, BASE_FEE } =
  StellarSdk;

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export const networkPassphrase =
  config.stellar.network === 'public' ? Networks.PUBLIC : Networks.TESTNET;

export const server = new Horizon.Server(config.stellar.horizonUrl);
export const isTestnet = config.stellar.network !== 'public';

export function generateKeypair() {
  const kp = Keypair.random();
  return { publicKey: kp.publicKey(), secret: kp.secret() };
}

export function isValidStellarAddress(addr) {
  try {
    Keypair.fromPublicKey(addr);
    return true;
  } catch {
    return false;
  }
}

// Fund a brand-new account on testnet via Friendbot (no-op on mainnet).
export async function fundWithFriendbot(publicKey) {
  if (!isTestnet) throw new Error('Friendbot is only available on testnet');
  const res = await fetch(`https://friendbot.stellar.org/?addr=${encodeURIComponent(publicKey)}`);
  if (!res.ok) throw new Error(`Friendbot funding failed: ${res.status}`);
  return res.json();
}

async function accountExists(publicKey) {
  try {
    await server.loadAccount(publicKey);
    return true;
  } catch (e) {
    if (e?.response?.status === 404 || e?.name === 'NotFoundError') return false;
    throw e;
  }
}

// Native (XLM) balance in stroops; 0 if the account does not yet exist on-ledger.
export async function getNativeBalanceStroops(publicKey) {
  try {
    const acct = await server.loadAccount(publicKey);
    const native = acct.balances.find((b) => b.asset_type === 'native');
    return native ? xlmToStroops(native.balance) : 0;
  } catch (e) {
    if (e?.response?.status === 404 || e?.name === 'NotFoundError') return 0;
    throw e;
  }
}

// Incoming native value to `publicKey` since `cursor`. Returns deposits + the new cursor.
export async function listIncomingNative(publicKey, cursor) {
  const deposits = [];
  let lastCursor = cursor || null;
  try {
    let builder = server.payments().forAccount(publicKey).order('asc').limit(50);
    if (cursor) builder = builder.cursor(cursor);
    const page = await builder.call();
    for (const rec of page.records) {
      lastCursor = rec.paging_token;
      if (rec.type === 'create_account' && rec.account === publicKey) {
        deposits.push({
          stroops: xlmToStroops(rec.starting_balance),
          cursor: rec.paging_token,
          hash: rec.transaction_hash,
          from: rec.funder,
        });
      } else if (
        rec.type === 'payment' &&
        rec.to === publicKey &&
        rec.asset_type === 'native'
      ) {
        deposits.push({
          stroops: xlmToStroops(rec.amount),
          cursor: rec.paging_token,
          hash: rec.transaction_hash,
          from: rec.from,
        });
      }
    }
  } catch (e) {
    if (e?.response?.status === 404 || e?.name === 'NotFoundError') {
      return { deposits: [], cursor: lastCursor }; // account not created yet
    }
    throw e;
  }
  return { deposits, cursor: lastCursor };
}

// Send native XLM. Auto-uses createAccount if the destination is not yet on-ledger.
export async function sendNative({ fromSecret, toPublic, stroops, memo }) {
  const source = Keypair.fromSecret(fromSecret);
  const account = await server.loadAccount(source.publicKey());
  const destExists = await accountExists(toPublic);
  const amount = stroopsToAmountString(stroops);

  const op = destExists
    ? Operation.payment({ destination: toPublic, asset: Asset.native(), amount })
    : Operation.createAccount({ destination: toPublic, startingBalance: amount });

  const builder = new TransactionBuilder(account, {
    fee: BASE_FEE,
    networkPassphrase,
  }).addOperation(op);

  if (memo) builder.addMemo(Memo.text(String(memo).slice(0, 28)));

  const tx = builder.setTimeout(180).build();
  tx.sign(source);
  const res = await server.submitTransaction(tx);
  return res.hash;
}

// Sweep a user's deposit account into the hot wallet, leaving ~1.5 XLM for reserves+fee.
export async function sweepToHotWallet(userSecret, hotPublic) {
  const kp = Keypair.fromSecret(userSecret);
  const balance = await getNativeBalanceStroops(kp.publicKey());
  const keepBack = xlmToStroops(1.5); // base reserve (1) + buffer for fees/entries
  const movable = balance - keepBack;
  if (movable <= 0) return null;
  return sendNative({ fromSecret: userSecret, toPublic: hotPublic, stroops: movable });
}

// ── Hot wallet bootstrap ────────────────────────────────────────────
let hotWallet = null;
const HOT_FILE = path.join(__dirname, '..', '.hotwallet.json');

export async function initHotWallet() {
  if (config.stellar.hotwalletSecret) {
    const kp = Keypair.fromSecret(config.stellar.hotwalletSecret);
    hotWallet = { publicKey: kp.publicKey(), secret: kp.secret() };
    if (!isTestnet) {
      const bal = await getNativeBalanceStroops(kp.publicKey());
      console.log(`🪙  Mainnet hot wallet ${kp.publicKey()} balance: ${bal / 1e7} XLM`);
      if (bal === 0) {
        console.warn('⚠️  Hot wallet has 0 XLM — fund it before users can withdraw.');
      }
    }
  } else if (isTestnet && fs.existsSync(HOT_FILE)) {
    // Auto-generated testnet keyfile is only ever reused on testnet.
    hotWallet = JSON.parse(fs.readFileSync(HOT_FILE, 'utf8'));
  } else if (isTestnet) {
    const kp = generateKeypair();
    await fundWithFriendbot(kp.publicKey);
    hotWallet = kp;
    fs.writeFileSync(HOT_FILE, JSON.stringify(kp, null, 2));
    console.log('🪙  Generated + funded testnet hot wallet:', kp.publicKey);
    console.log('    (stored in backend/.hotwallet.json)');
  } else {
    throw new Error(
      'HOTWALLET_SECRET is required on mainnet (public). Set it to a FUNDED Stellar account secret in backend/.env.'
    );
  }
  return hotWallet;
}

export function getHotWallet() {
  if (!hotWallet) throw new Error('Hot wallet not initialised — call initHotWallet() first');
  return hotWallet;
}

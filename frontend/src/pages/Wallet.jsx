import { useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import {
  Copy,
  Check,
  RefreshCw,
  ArrowDownToLine,
  ArrowUpFromLine,
  Wallet as WalletIcon,
  ExternalLink,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Page, Spinner, EmptyState } from '../components/Bits.jsx';
import AnimatedNumber from '../components/AnimatedNumber.jsx';
import { fmtXLM, fmtDate, txLabel, shortAddr } from '../lib/format.js';

const CREDIT_TYPES = ['deposit', 'payout', 'owner_payout', 'refund', 'idea_fee_refund'];

export default function Wallet() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const [wallet, setWallet] = useState(null);
  const [txs, setTxs] = useState([]);
  const [copied, setCopied] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [wd, setWd] = useState({ destination: '', amount: '' });
  const [wdBusy, setWdBusy] = useState(false);

  const loadAll = async () => {
    const [w, t] = await Promise.all([api.wallet(), api.transactions()]);
    setWallet(w);
    setTxs(t.transactions);
  };

  useEffect(() => {
    loadAll().catch(() => {});
  }, []);

  const explorer = (hash) =>
    `https://stellar.expert/explorer/${wallet?.network === 'public' ? 'public' : 'testnet'}/${
      hash?.length === 56 && hash.startsWith('G') ? 'account' : 'tx'
    }/${hash}`;

  const copy = () => {
    navigator.clipboard.writeText(wallet.depositAddress);
    setCopied(true);
    toast.success('Deposit address copied');
    setTimeout(() => setCopied(false), 1800);
  };

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await api.refreshDeposits();
      await Promise.all([loadAll(), refresh()]);
      toast.info('Checked the network for new deposits');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setRefreshing(false);
    }
  };

  const withdraw = async (e) => {
    e.preventDefault();
    const amount = Number(wd.amount);
    if (!wd.destination.trim()) return toast.error('Enter a destination address');
    if (amount <= 0) return toast.error('Enter an amount');
    setWdBusy(true);
    try {
      const res = await api.withdraw({ destination: wd.destination.trim(), amount });
      toast.success(`Sent ${fmtXLM(amount)} XLM`);
      setWd({ destination: '', amount: '' });
      await Promise.all([loadAll(), refresh()]);
      if (res.hash) window.open(explorer(res.hash), '_blank');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setWdBusy(false);
    }
  };

  if (!wallet) return <Page><Spinner /></Page>;

  return (
    <Page className="max-w-5xl">
      <h1 className="mb-6 text-3xl font-bold">Wallet</h1>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Balance + deposit */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="space-y-6">
          <div className="card relative overflow-hidden p-6">
            <div className="pointer-events-none absolute -right-10 -top-10 h-40 w-40 rounded-full bg-brand-grad opacity-20 blur-2xl" />
            <div className="flex items-center gap-2 text-sm text-slate-400">
              <WalletIcon className="h-4 w-4 text-cyanx" /> Available balance
            </div>
            <p className="mt-2 font-display text-5xl font-bold text-white">
              <AnimatedNumber value={wallet.balance} dp={4} /> <span className="text-2xl text-slate-500">XLM</span>
            </p>
            <span className="mt-3 inline-block chip bg-white/5 text-slate-400">
              {wallet.network === 'public' ? 'Stellar mainnet' : 'Stellar testnet'}
            </span>
          </div>

          <div className="card p-6">
            <div className="mb-3 flex items-center justify-between">
              <h3 className="flex items-center gap-2 font-semibold text-white">
                <ArrowDownToLine className="h-4 w-4 text-yes" /> Deposit XLM
              </h3>
              <button onClick={onRefresh} disabled={refreshing} className="btn-ghost px-3 py-1.5 text-xs">
                <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? 'animate-spin' : ''}`} /> Check
              </button>
            </div>
            <p className="text-sm text-slate-400">
              Send XLM to your personal address below. Deposits are credited automatically within a
              minute (or hit “Check”).
            </p>
            <div className="mt-3 flex items-center gap-2 rounded-xl border border-white/10 bg-ink-850 p-3">
              <code className="flex-1 break-all font-mono text-xs text-cyanx">{wallet.depositAddress}</code>
              <button onClick={copy} className="btn-ghost shrink-0 px-3 py-2">
                {copied ? <Check className="h-4 w-4 text-yes" /> : <Copy className="h-4 w-4" />}
              </button>
            </div>
            <a
              href={explorer(wallet.depositAddress)}
              target="_blank"
              rel="noreferrer"
              className="mt-2 inline-flex items-center gap-1 text-xs text-slate-500 hover:text-brand-300"
            >
              View on explorer <ExternalLink className="h-3 w-3" />
            </a>
          </div>
        </motion.div>

        {/* Withdraw */}
        <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
          <form onSubmit={withdraw} className="card space-y-4 p-6">
            <h3 className="flex items-center gap-2 font-semibold text-white">
              <ArrowUpFromLine className="h-4 w-4 text-no" /> Withdraw XLM
            </h3>
            <div>
              <label className="label">Destination address</label>
              <input
                className="input font-mono text-sm"
                placeholder="G…"
                value={wd.destination}
                onChange={(e) => setWd({ ...wd, destination: e.target.value })}
              />
            </div>
            <div>
              <label className="label">Amount (XLM)</label>
              <input
                type="number"
                min={wallet.minWithdraw}
                step="any"
                className="input font-mono"
                placeholder="0.00"
                value={wd.amount}
                onChange={(e) => setWd({ ...wd, amount: e.target.value })}
              />
              <div className="mt-2 flex items-center justify-between text-xs text-slate-500">
                <span>Min {fmtXLM(wallet.minWithdraw)} XLM</span>
                <button
                  type="button"
                  onClick={() => setWd({ ...wd, amount: String(wallet.balance) })}
                  className="text-brand-300 hover:text-brand-200"
                >
                  Withdraw max
                </button>
              </div>
            </div>
            <button disabled={wdBusy} className="btn-primary w-full py-3">
              {wdBusy ? <Spinner className="h-5 w-5" /> : 'Withdraw'}
            </button>
            <p className="text-xs text-slate-500">
              Funds are sent on-chain from the platform hot wallet. New destination accounts are
              created automatically.
            </p>
          </form>
        </motion.div>
      </div>

      {/* Transactions */}
      <div className="mt-8">
        <h2 className="mb-4 text-xl font-bold">Transaction history</h2>
        {txs.length === 0 ? (
          <EmptyState icon={WalletIcon} title="No transactions yet">
            Deposit some XLM to get started.
          </EmptyState>
        ) : (
          <div className="card divide-y divide-white/5 overflow-hidden">
            {txs.map((t) => {
              const credit = CREDIT_TYPES.includes(t.type) || t.amount > 0;
              return (
                <div key={t.id} className="flex items-center justify-between gap-3 px-5 py-3.5">
                  <div className="min-w-0">
                    <p className="font-medium text-white">{txLabel(t.type)}</p>
                    <p className="truncate text-xs text-slate-500">
                      {fmtDate(t.createdAt)}
                      {t.ref && t.ref.length === 64 && (
                        <>
                          {' · '}
                          <a href={explorer(t.ref)} target="_blank" rel="noreferrer" className="hover:text-brand-300">
                            {shortAddr(t.ref)}
                          </a>
                        </>
                      )}
                      {t.status === 'pending' && ' · pending'}
                      {t.status === 'failed' && ' · failed'}
                    </p>
                  </div>
                  <span className={`shrink-0 font-mono font-semibold ${credit ? 'text-yes' : 'text-slate-300'}`}>
                    {credit ? '+' : ''}
                    {fmtXLM(Math.abs(t.amount), 4)} XLM
                  </span>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Page>
  );
}

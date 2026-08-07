import { useEffect, useState, useCallback } from 'react';
import { Link } from 'react-router-dom';
import {
  Shield,
  Check,
  X,
  Gavel,
  Users,
  Coins,
  Clock,
  Landmark,
  ArrowUpFromLine,
  Hourglass,
  History,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useToast } from '../context/ToastContext.jsx';
import { useAuth } from '../context/AuthContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import Countdown from '../components/Countdown.jsx';
import { Page, Loading, EmptyState, Stat, Spinner } from '../components/Bits.jsx';
import { fmtXLM, fmtDate, cn, txLabel } from '../lib/format.js';

const TABS = [
  { key: 'review', label: 'Review queue' },
  { key: 'resolve', label: 'Resolve' },
  { key: 'users', label: 'Users' },
  { key: 'flow', label: 'Money flow' },
  { key: 'treasury', label: 'Treasury' },
  { key: 'all', label: 'All ideas' },
];

export default function Admin() {
  const toast = useToast();
  const { refresh } = useAuth();
  const [tab, setTab] = useState('review');
  const [ideas, setIdeas] = useState(null);
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [ledger, setLedger] = useState([]);
  const [acting, setActing] = useState(null);

  const load = useCallback(async () => {
    const [a, s, u, l] = await Promise.all([
      api.adminIdeas(),
      api.adminStats(),
      api.adminUsers(),
      api.adminLedger(300),
    ]);
    setIdeas(a.ideas);
    setStats(s);
    setUsers(u.users);
    setLedger(l.ledger);
  }, []);

  useEffect(() => {
    load().catch(() => {});
  }, [load]);

  const run = async (key, fn, okMsg) => {
    setActing(key);
    try {
      await fn();
      await load();
      if (okMsg) toast.success(okMsg);
    } catch (e) {
      toast.error(e.message);
    } finally {
      setActing(null);
    }
  };

  const approve = (id) => run(`a${id}`, () => api.approveIdea(id), 'Idea approved and listed');
  const reject = (id) => {
    const reason = window.prompt('Reason for rejection (the listing fee is refunded):', '');
    if (reason === null) return;
    run(`r${id}`, () => api.rejectIdea(id, reason), 'Idea rejected, fee refunded');
  };
  const resolve = (id, option, label) => {
    if (!window.confirm(`Resolve as "${label}"? This pays out winners immediately and cannot be undone.`)) return;
    run(`s${id}${option}`, () => api.resolveIdea(id, option), 'Idea resolved and paid out');
  };
  const approveResult = (idea) => {
    const label = idea.proposedOption === 'A' ? idea.optionA : idea.optionB;
    if (!window.confirm(`Approve the owner's result "${label}"? This pays out winners immediately.`)) return;
    run(`ar${idea.id}`, () => api.approveResult(idea.id), 'Result approved — winners paid out');
  };
  const rejectResult = (idea) => {
    const reason = window.prompt('Send this result back to the owner. Reason (optional):', '');
    if (reason === null) return;
    run(`rr${idea.id}`, () => api.rejectResult(idea.id, reason), 'Result sent back to the owner');
  };

  if (!ideas || !stats) return <Loading label="Loading admin console…" />;

  const pending = ideas.filter((i) => i.status === 'pending');
  const resolvable = ideas
    .filter((i) => i.status === 'open' || i.status === 'closed')
    .sort((a, b) => (b.resultStatus === 'proposed') - (a.resultStatus === 'proposed'));
  const proposedCount = resolvable.filter((i) => i.resultStatus === 'proposed').length;

  return (
    <Page>
      <div className="mb-6 flex items-center gap-3">
        <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-grad-soft text-brand-300">
          <Shield className="h-5 w-5" />
        </span>
        <div>
          <h1 className="text-2xl font-bold">Project owner console</h1>
          <p className="text-sm text-slate-400">Review submissions, settle outcomes, manage treasury.</p>
        </div>
      </div>

      {/* Stats */}
      <div className="mb-8 grid gap-4 grid-cols-2 lg:grid-cols-4">
        <Stat label="Platform balance" value={`${fmtXLM(stats.platformBalance)} XLM`} accent="text-yes" sub="Accrued fees" />
        <Stat label="Total volume" value={`${fmtXLM(stats.volume)} XLM`} accent="text-cyanx" />
        <Stat label="Users" value={stats.users} />
        <Stat label="In review" value={stats.pending} accent={stats.pending ? 'text-amber-300' : 'text-white'} />
      </div>

      {/* Tabs */}
      <div className="mb-6 flex flex-wrap gap-1.5">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'relative rounded-lg px-3.5 py-2 text-sm font-medium transition',
              tab === t.key ? 'bg-brand-grad text-white shadow-glow' : 'bg-white/5 text-slate-400 hover:text-white'
            )}
          >
            {t.label}
            {t.key === 'review' && pending.length > 0 && (
              <span className="ml-2 rounded-full bg-amber-400/20 px-1.5 py-0.5 text-xs text-amber-300">
                {pending.length}
              </span>
            )}
            {t.key === 'resolve' && proposedCount > 0 && (
              <span className="ml-2 rounded-full bg-yes/20 px-1.5 py-0.5 text-xs text-yes">
                {proposedCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Review queue */}
      {tab === 'review' &&
        (pending.length === 0 ? (
          <EmptyState icon={Check} title="Queue is clear">Nothing is waiting for review.</EmptyState>
        ) : (
          <div className="space-y-4">
            {pending.map((idea) => (
              <div key={idea.id} className="card p-5">
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <span className="chip bg-white/5 text-slate-300">{idea.category}</span>
                      <StatusBadge status={idea.status} />
                    </div>
                    <h3 className="text-lg font-semibold text-white">{idea.title}</h3>
                    <p className="mt-1.5 text-sm text-slate-400">{idea.description}</p>
                    <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-slate-400">
                      <span><span className="text-cyanx">A:</span> {idea.optionA}</span>
                      <span><span className="text-no">B:</span> {idea.optionB}</span>
                      <span className="inline-flex items-center gap-1.5"><Clock className="h-3.5 w-3.5" /> Closes {fmtDate(idea.closesAt)}</span>
                      <span>By {idea.creator.name}</span>
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => approve(idea.id)} disabled={acting} className="btn-yes">
                      {acting === `a${idea.id}` ? <Spinner className="h-4 w-4" /> : <><Check className="h-4 w-4" /> Approve</>}
                    </button>
                    <button onClick={() => reject(idea.id)} disabled={acting} className="btn-no">
                      {acting === `r${idea.id}` ? <Spinner className="h-4 w-4" /> : <><X className="h-4 w-4" /> Reject</>}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ))}

      {/* Resolve */}
      {tab === 'resolve' &&
        (resolvable.length === 0 ? (
          <EmptyState icon={Gavel} title="Nothing to settle">No open or awaiting-result ideas.</EmptyState>
        ) : (
          <div className="space-y-4">
            {resolvable.map((idea) => (
              <div key={idea.id} className={cn('card p-5', idea.resultStatus === 'proposed' && 'border-yes/40')}>
                {idea.resultStatus === 'proposed' && (
                  <div className="mb-4 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-yes/30 bg-yes/10 p-3.5">
                    <span className="inline-flex items-center gap-2 text-sm text-yes">
                      <Hourglass className="h-4 w-4" />
                      Owner submitted result:{' '}
                      <strong className="text-white">
                        {idea.proposedOption === 'A' ? idea.optionA : idea.optionB} won
                      </strong>
                    </span>
                    <div className="flex gap-2">
                      <button onClick={() => approveResult(idea)} disabled={acting} className="btn-yes">
                        {acting === `ar${idea.id}` ? <Spinner className="h-4 w-4" /> : <><Check className="h-4 w-4" /> Approve & pay out</>}
                      </button>
                      <button onClick={() => rejectResult(idea)} disabled={acting} className="btn-no">
                        {acting === `rr${idea.id}` ? <Spinner className="h-4 w-4" /> : <><X className="h-4 w-4" /> Send back</>}
                      </button>
                    </div>
                  </div>
                )}
                <div className="flex flex-wrap items-start justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex items-center gap-2">
                      <StatusBadge status={idea.status} />
                      <Countdown to={idea.closesAt} className="text-xs text-slate-400" />
                    </div>
                    <Link to={`/ideas/${idea.id}`} className="text-lg font-semibold text-white hover:text-brand-200">
                      {idea.title}
                    </Link>
                    <p className="mt-1 flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-400">
                      <span className="inline-flex items-center gap-1.5 font-semibold text-ember-300">
                        <Coins className="h-3.5 w-3.5" /> {fmtXLM(idea.total)} XLM
                      </span>
                      <span className="inline-flex items-center gap-1.5">
                        <Users className="h-3.5 w-3.5" /> {idea.backers} users
                      </span>
                      <span className="text-cyanx">{idea.optionA}: {idea.countA} ({fmtXLM(idea.poolA)})</span>
                      <span className="text-no">{idea.optionB}: {idea.countB} ({fmtXLM(idea.poolB)})</span>
                    </p>
                  </div>
                  <div className="flex flex-col items-stretch gap-2 sm:flex-row">
                    <button onClick={() => resolve(idea.id, 'A', idea.optionA)} disabled={acting} className="btn bg-cyanx/15 text-cyanx border border-cyanx/30 hover:bg-cyanx/25">
                      {acting === `s${idea.id}A` ? <Spinner className="h-4 w-4" /> : `${idea.optionA} wins`}
                    </button>
                    <button onClick={() => resolve(idea.id, 'B', idea.optionB)} disabled={acting} className="btn-no">
                      {acting === `s${idea.id}B` ? <Spinner className="h-4 w-4" /> : `${idea.optionB} wins`}
                    </button>
                  </div>
                </div>
                {idea.status === 'open' && (
                  <p className="mt-3 text-xs text-amber-300/80">
                    Tip: this idea is still open for staking. It auto-closes at the deadline; owners can submit the result after the end date.
                  </p>
                )}
              </div>
            ))}
          </div>
        ))}

      {/* Users — total betting history */}
      {tab === 'users' && (
        <div className="card overflow-x-auto">
          <table className="w-full min-w-[760px] text-sm">
            <thead>
              <tr className="border-b border-white/5 text-left text-[11px] font-bold uppercase tracking-wider text-slate-500">
                <th className="px-4 py-3">User</th>
                <th className="px-4 py-3 text-right">Selections</th>
                <th className="px-4 py-3 text-right">Total selected</th>
                <th className="px-4 py-3 text-right">Total won</th>
                <th className="px-4 py-3 text-right">Net</th>
                <th className="px-4 py-3 text-right">Balance</th>
                <th className="px-4 py-3 text-right">Ideas</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5">
              {users.map((u) => (
                <tr key={u.id} className="hover:bg-white/[0.03]">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-grad text-xs font-bold text-white">
                        {u.name[0]?.toUpperCase()}
                      </span>
                      <div className="min-w-0">
                        <p className="truncate font-medium text-white">
                          {u.name}
                          {u.role === 'admin' && <span className="chip ml-1 bg-white/10 text-slate-300">admin</span>}
                          {u.flagged && <span className="chip ml-1 bg-no/15 text-no">flagged</span>}
                        </p>
                        <p className="truncate text-xs text-slate-500">{u.email}</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-right font-mono">{u.bets}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-300">{fmtXLM(u.totalBet)}</td>
                  <td className="px-4 py-3 text-right font-mono text-yes">{fmtXLM(u.totalWon)}</td>
                  <td className={cn('px-4 py-3 text-right font-mono font-semibold', u.net >= 0 ? 'text-yes' : 'text-no')}>
                    {u.net >= 0 ? '+' : ''}{fmtXLM(u.net)}
                  </td>
                  <td className="px-4 py-3 text-right font-mono text-white">{fmtXLM(u.balance)}</td>
                  <td className="px-4 py-3 text-right font-mono text-slate-400">{u.ideasCreated}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* Money flow — the entire ledger to date */}
      {tab === 'flow' && (
        <div className="card divide-y divide-white/5 overflow-hidden">
          {ledger.length === 0 ? (
            <EmptyState icon={History} title="No activity yet">Money movements appear here.</EmptyState>
          ) : (
            ledger.map((l) => {
              const credit = l.amount > 0;
              return (
                <div key={l.id} className="flex items-center justify-between gap-3 px-5 py-3">
                  <div className="min-w-0">
                    <p className="font-medium text-white">
                      {txLabel(l.type)} <span className="text-slate-500">· {l.who}</span>
                    </p>
                    <p className="text-xs text-slate-500">
                      {fmtDate(l.at)}{l.status && l.status !== 'completed' ? ` · ${l.status}` : ''}
                    </p>
                  </div>
                  <span className={cn('shrink-0 font-mono font-semibold', credit ? 'text-yes' : 'text-slate-300')}>
                    {credit ? '+' : ''}{fmtXLM(Math.abs(l.amount), 4)} XLM
                  </span>
                </div>
              );
            })
          )}
        </div>
      )}

      {/* Treasury */}
      {tab === 'treasury' && <Treasury stats={stats} onDone={async () => { await load(); refresh(); }} />}

      {/* All */}
      {tab === 'all' && (
        <div className="card divide-y divide-white/5 overflow-hidden">
          {ideas.map((idea) => (
            <div key={idea.id} className="flex items-center justify-between gap-4 px-5 py-3.5">
              <div className="min-w-0">
                <Link to={`/ideas/${idea.id}`} className="truncate font-medium text-white hover:text-brand-200">
                  {idea.title}
                </Link>
                <p className="text-xs text-slate-500">
                  {idea.category} · {idea.backers} users · {idea.optionA} {idea.countA} / {idea.optionB} {idea.countB} · {fmtXLM(idea.total)} XLM
                </p>
              </div>
              <StatusBadge status={idea.status} />
            </div>
          ))}
        </div>
      )}
    </Page>
  );
}

function Treasury({ stats, onDone }) {
  const toast = useToast();
  const [form, setForm] = useState({ destination: '', amount: '' });
  const [busy, setBusy] = useState(false);

  const submit = async (e) => {
    e.preventDefault();
    const amount = Number(form.amount);
    if (!form.destination.trim() || amount <= 0) return toast.error('Enter a destination and amount');
    setBusy(true);
    try {
      await api.adminWithdraw({ destination: form.destination.trim(), amount });
      toast.success(`Withdrew ${fmtXLM(amount)} XLM from the treasury`);
      setForm({ destination: '', amount: '' });
      onDone();
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <div className="card p-6">
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <Landmark className="h-4 w-4 text-yes" /> Treasury balance
        </div>
        <p className="mt-2 font-display text-4xl font-bold text-white">
          {fmtXLM(stats.platformBalance, 4)} <span className="text-xl text-slate-500">XLM</span>
        </p>
        <div className="mt-5 grid grid-cols-2 gap-4 text-sm">
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-slate-400">Development fund</p>
            <p className="mt-0.5 font-semibold text-ember-300">{fmtXLM(stats.devTotal || 0)} XLM</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-slate-400">Marketing fund</p>
            <p className="mt-0.5 font-semibold text-cyanx">{fmtXLM(stats.marketingTotal || 0)} XLM</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-slate-400">Settled ideas</p>
            <p className="mt-0.5 font-semibold text-white">{stats.settled}</p>
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-3">
            <p className="text-slate-400">Lifetime volume</p>
            <p className="mt-0.5 font-semibold text-white">{fmtXLM(stats.volume)} XLM</p>
          </div>
        </div>
      </div>

      <form onSubmit={submit} className="card space-y-4 p-6">
        <h3 className="flex items-center gap-2 font-semibold text-white">
          <ArrowUpFromLine className="h-4 w-4 text-no" /> Withdraw platform revenue
        </h3>
        <div>
          <label className="label">Destination address</label>
          <input className="input font-mono text-sm" placeholder="G…" value={form.destination} onChange={(e) => setForm({ ...form, destination: e.target.value })} />
        </div>
        <div>
          <label className="label">Amount (XLM)</label>
          <input type="number" min="0" step="any" className="input font-mono" placeholder="0.00" value={form.amount} onChange={(e) => setForm({ ...form, amount: e.target.value })} />
        </div>
        <button disabled={busy} className="btn-primary w-full py-3">
          {busy ? <Spinner className="h-5 w-5" /> : 'Withdraw to wallet'}
        </button>
      </form>
    </div>
  );
}

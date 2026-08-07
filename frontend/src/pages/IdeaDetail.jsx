import { useEffect, useState, useCallback } from 'react';
import { Link, useParams, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowLeft,
  Coins,
  Users,
  TrendingUp,
  Activity,
  Trophy,
  Lock,
  Wallet,
  Gavel,
  AlertCircle,
  Hourglass,
  Copy,
  Check,
  Clock,
} from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import StatusBadge from '../components/StatusBadge.jsx';
import OddsBar from '../components/OddsBar.jsx';
import Countdown from '../components/Countdown.jsx';
import { SocialRow } from '../components/SocialIcons.jsx';
import AnimatedNumber from '../components/AnimatedNumber.jsx';
import CoinBurst from '../components/CoinBurst.jsx';
import RankingsPanel from '../components/RankingsPanel.jsx';
import { Page, Loading, Spinner } from '../components/Bits.jsx';
import { fmtXLM, pct, fmtDate, cn, urgencyTier } from '../lib/format.js';

const URGENCY = { red: 'urgency-red', yellow: 'urgency-yellow', green: 'urgency-green' };

const WINNERS_SHARE = 0.7; // matches backend default split

export default function IdeaDetail() {
  const { id } = useParams();
  const { user, refresh } = useAuth();
  const toast = useToast();
  const nav = useNavigate();

  const [data, setData] = useState(null);
  const [side, setSide] = useState('A');
  const [amount, setAmount] = useState('');
  const [busy, setBusy] = useState(false);
  const [proposing, setProposing] = useState(false);
  const [cfg, setCfg] = useState({ minStakeXlm: 100 });
  const [copied, setCopied] = useState(false);
  const [burst, setBurst] = useState(0);
  const [burstLabel, setBurstLabel] = useState('');

  const load = useCallback(() => {
    api.idea(id).then(setData).catch(() => setData({ notFound: true }));
  }, [id]);

  useEffect(() => {
    load();
    const t = setInterval(load, 5_000); // live-ish refresh
    return () => clearInterval(t);
  }, [load]);

  useEffect(() => {
    api.config().then(setCfg).catch(() => {});
  }, []);

  if (!data) return <Loading label="Loading idea…" />;
  if (data.notFound)
    return (
      <Page>
        <div className="card p-12 text-center">
          <h2 className="text-xl font-bold">Idea not found</h2>
          <Link to="/" className="btn-ghost mt-4">Back to ideas</Link>
        </div>
      </Page>
    );

  const idea = data.idea;
  const isOpen = idea.status === 'open';
  const amt = Number(amount) || 0;
  const minStake = cfg.minStakeXlm || 100;
  const tier = urgencyTier(idea.closesAt, idea.status);

  // Payout preview: winners get their stake back PLUS a pro-rata slice of 70%
  // of the losers' pool. Winners never lose their own money.
  const poolSide = side === 'A' ? idea.poolA : idea.poolB;
  const losersPool = side === 'A' ? idea.poolB : idea.poolA;
  const mySideStake = side === 'A' ? idea.myStakeA : idea.myStakeB;
  const poolSideAfter = poolSide + amt;
  const myStakeAfter = mySideStake + amt;
  const profit = poolSideAfter > 0 ? (WINNERS_SHARE * losersPool * myStakeAfter) / poolSideAfter : 0;
  const potentialPayout = myStakeAfter + profit; // stake returned + profit
  const multiple = myStakeAfter > 0 ? potentialPayout / myStakeAfter : 0;

  const place = async () => {
    if (!user) return nav('/login');
    if (amt < minStake) return toast.error(`Minimum selection is ${minStake} XLM`);
    if (amt > user.balance) return toast.error('Insufficient balance — top up your wallet');
    setBusy(true);
    try {
      const res = await api.contribute(idea.id, { option: side, amount: amt });
      setData((d) => ({ ...d, idea: res.idea }));
      // money-movement effect
      setBurstLabel(`+${fmtXLM(amt)} XLM`);
      setBurst((b) => b + 1);
      setAmount('');
      await refresh();
      toast.success(`Selected ${fmtXLM(amt)} XLM on "${side === 'A' ? idea.optionA : idea.optionB}"`);
      load();
    } catch (e) {
      toast.error(e.message);
    } finally {
      setBusy(false);
    }
  };

  const isCreator = user && idea.creator?.id === user.id;
  const notSettled = idea.status === 'open' || idea.status === 'closed';
  const ended = idea.ended; // past the idea end time (time 2)
  const canPropose = isCreator && notSettled && ended;

  const copyLink = () => {
    const url = `${window.location.origin}/ideas/${idea.id}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    toast.success('Idea link copied — share it to attract a crowd!');
    setTimeout(() => setCopied(false), 1800);
  };

  const submitResult = async (option) => {
    setProposing(true);
    try {
      const res = await api.proposeResult(idea.id, option);
      setData((d) => ({ ...d, idea: res.idea }));
      toast.success('Result submitted — awaiting Project Owner approval');
    } catch (e) {
      toast.error(e.message);
    } finally {
      setProposing(false);
    }
  };

  const SideButton = ({ value, label, odds, color }) => (
    <button
      onClick={() => setSide(value)}
      className={cn(
        'flex-1 rounded-xl border p-4 text-left transition',
        side === value
          ? color === 'cyan'
            ? 'border-cyanx/60 bg-cyanx/10 shadow-glow-cyan'
            : 'border-no/60 bg-no/10'
          : 'border-white/10 bg-white/5 hover:border-white/20'
      )}
    >
      <div className="flex items-center justify-between">
        <span className="text-xs uppercase tracking-wide text-slate-400">
          {value === 'A' ? 'Option A' : 'Option B'}
        </span>
        <span className={cn('font-mono text-sm font-semibold', color === 'cyan' ? 'text-cyanx' : 'text-no')}>
          {pct(odds)}
        </span>
      </div>
      <p className="mt-1 font-semibold text-white">{label}</p>
    </button>
  );

  return (
    <Page>
      <Link to="/" className="mb-5 inline-flex items-center gap-1.5 text-sm text-slate-400 hover:text-white">
        <ArrowLeft className="h-4 w-4" /> All ideas
      </Link>

      <div className="grid gap-6 lg:grid-cols-3">
        {/* Main column */}
        <div className="space-y-6 lg:col-span-2">
          <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className={cn('card p-6', tier && URGENCY[tier])}>
            <div className="mb-3 flex items-center justify-between gap-3">
              <span className="chip bg-white/5 text-slate-300">{idea.category}</span>
              <div className="flex items-center gap-2">
                <button onClick={copyLink} className="btn-ghost px-3 py-1.5 text-xs" title="Copy shareable link">
                  {copied ? <Check className="h-3.5 w-3.5 text-yes" /> : <Copy className="h-3.5 w-3.5" />} Copy link
                </button>
                <StatusBadge status={idea.status} />
              </div>
            </div>
            <h1 className="text-2xl font-extrabold leading-snug text-white sm:text-3xl">{idea.title}</h1>
            <p className="mt-3 whitespace-pre-line text-slate-300">{idea.description}</p>

            <div className="mt-5 flex flex-wrap items-center gap-x-6 gap-y-3 text-sm text-slate-400">
              <span className="inline-flex items-center gap-2">
                <span className="grid h-7 w-7 place-items-center rounded-full bg-brand-grad text-xs font-bold text-white">
                  {(idea.creator?.name || '?')[0].toUpperCase()}
                </span>
                by <span className="font-semibold text-slate-200">{idea.creator?.name}</span>
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Lock className="h-3.5 w-3.5" /> Funding closes {fmtDate(idea.closesAt)}
                <Countdown to={idea.closesAt} className="text-slate-300" />
              </span>
              <span className="inline-flex items-center gap-1.5">
                <Trophy className="h-3.5 w-3.5" /> Ends {fmtDate(idea.endsAt)}
              </span>
              <SocialRow x={idea.xUrl} telegram={idea.telegramUrl} discord={idea.discordUrl} size="h-4 w-4" />
            </div>
          </motion.div>

          {/* Resolved banner */}
          {(idea.status === 'resolved' || idea.status === 'refunded') && (
            <div className={cn('card flex items-center gap-4 p-5', idea.status === 'refunded' ? 'border-cyanx/30' : 'border-brand-400/30')}>
              <span className="grid h-12 w-12 place-items-center rounded-xl bg-brand-grad-soft">
                <Trophy className="h-6 w-6 text-brand-300" />
              </span>
              <div>
                {idea.status === 'refunded' ? (
                  <>
                    <p className="font-semibold text-white">Refunded</p>
                    <p className="text-sm text-slate-400">Nobody selected the winning side — all selections were returned.</p>
                  </>
                ) : (
                  <>
                    <p className="font-semibold text-white">
                      Settled · Winner: {idea.winningOption === 'A' ? idea.optionA : idea.optionB}
                    </p>
                    <p className="text-sm text-slate-400">
                      Winnings have been credited to winners' balances.
                    </p>
                  </>
                )}
              </div>
            </div>
          )}

          {/* Owner: submit the result for project-owner approval (after end date) */}
          {isCreator && notSettled && (
            <div className="card border-brand-400/30 p-6">
              <div className="mb-1 flex items-center gap-2 text-sm font-semibold text-white">
                <Gavel className="h-4 w-4 text-brand-300" /> Submit the result
              </div>
              <p className="text-sm text-slate-400">
                You created this idea. After the end date, tell us which side won — the Project Owner
                reviews and approves it to release payouts.
              </p>

              {!ended && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-white/10 bg-white/5 p-3 text-sm text-slate-300">
                  <Clock className="h-4 w-4 shrink-0 text-ember-400" />
                  You can submit the result once the idea ends (<Countdown to={idea.endsAt} className="text-ember-300" />).
                </div>
              )}

              {ended && idea.resultStatus === 'proposed' && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-amber-400/30 bg-amber-400/10 p-3 text-sm text-amber-200">
                  <Hourglass className="h-4 w-4 shrink-0" />
                  You submitted{' '}
                  <strong className="text-white">
                    {idea.proposedOption === 'A' ? idea.optionA : idea.optionB}
                  </strong>{' '}
                  — awaiting approval. You can change it below until it's approved.
                </div>
              )}
              {ended && idea.resultStatus === 'rejected' && (
                <div className="mt-4 flex items-center gap-2 rounded-xl border border-no/30 bg-no/10 p-3 text-sm text-no">
                  <AlertCircle className="h-4 w-4 shrink-0" />
                  Your result was sent back{idea.resultNote ? `: ${idea.resultNote}` : ''}. Please resubmit.
                </div>
              )}

              {ended && (
                <div className="mt-4 flex gap-3">
                  {[
                    { v: 'A', label: idea.optionA, cls: 'border-cyanx/40 bg-cyanx/10 text-cyanx' },
                    { v: 'B', label: idea.optionB, cls: 'border-no/40 bg-no/10 text-no' },
                  ].map((o) => (
                    <button
                      key={o.v}
                      disabled={proposing}
                      onClick={() => submitResult(o.v)}
                      className={cn(
                        'btn flex-1 border py-3',
                        idea.proposedOption === o.v ? o.cls : 'border-white/10 bg-white/5 text-slate-200 hover:bg-white/10'
                      )}
                    >
                      {proposing ? <Spinner className="h-4 w-4" /> : <>{o.label} won{idea.proposedOption === o.v ? ' ✓' : ''}</>}
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Odds + pools */}
          <div className="card p-6">
            <div className="mb-4 flex items-center gap-2 text-sm font-semibold text-slate-300">
              <TrendingUp className="h-4 w-4 text-brand-400" /> Crowd odds
            </div>
            <OddsBar
              oddsA={idea.oddsA}
              oddsB={idea.oddsB}
              labelA={idea.optionA}
              labelB={idea.optionB}
              winningOption={idea.winningOption}
            />
            <div className="mt-5 grid grid-cols-3 gap-4">
              <div>
                <p className="text-xs text-slate-400">Total pool</p>
                <p className="mt-0.5 font-mono text-lg font-semibold text-white">
                  <AnimatedNumber value={idea.total} /> <span className="text-xs text-slate-500">XLM</span>
                </p>
              </div>
              <div>
                <p className="text-xs text-cyanx">{idea.optionA}</p>
                <p className="mt-0.5 font-mono text-lg font-semibold text-white">
                  <AnimatedNumber value={idea.poolA} />
                </p>
              </div>
              <div>
                <p className="text-xs text-no">{idea.optionB}</p>
                <p className="mt-0.5 font-mono text-lg font-semibold text-white">
                  <AnimatedNumber value={idea.poolB} />
                </p>
              </div>
            </div>
            {(idea.myStakeA > 0 || idea.myStakeB > 0) && (
              <div className="mt-5 rounded-xl border border-white/10 bg-white/5 p-3 text-sm">
                <span className="text-slate-400">Your position: </span>
                {idea.myStakeA > 0 && <span className="text-cyanx">{fmtXLM(idea.myStakeA)} on {idea.optionA}</span>}
                {idea.myStakeA > 0 && idea.myStakeB > 0 && <span className="text-slate-500"> · </span>}
                {idea.myStakeB > 0 && <span className="text-no">{fmtXLM(idea.myStakeB)} on {idea.optionB}</span>}
              </div>
            )}
          </div>

          {/* Bettors on each side */}
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              { key: 'A', label: idea.optionA, list: data.bettors?.A || [], cyan: true },
              { key: 'B', label: idea.optionB, list: data.bettors?.B || [], cyan: false },
            ].map((g) => (
              <div key={g.key} className={cn('card p-5', g.cyan ? 'border-cyanx/20' : 'border-no/20')}>
                <div className="mb-3 flex items-center justify-between">
                  <span className={cn('flex items-center gap-1.5 text-sm font-bold', g.cyan ? 'text-cyanx' : 'text-no')}>
                    <Users className="h-4 w-4" /> {g.label}
                  </span>
                  <span className="text-xs text-slate-500">
                    {g.list.length} selection{g.list.length === 1 ? '' : 's'}
                  </span>
                </div>
                {g.list.length ? (
                  <ul className="max-h-72 space-y-2 overflow-y-auto pr-1 scrollbar-none">
                    {g.list.map((b, i) => (
                      <li key={i} className="flex items-center justify-between rounded-lg bg-white/5 px-3 py-2 text-sm">
                        <span className="flex items-center gap-2">
                          <span className={cn('grid h-6 w-6 place-items-center rounded-full text-[10px] font-bold text-white', g.cyan ? 'bg-cyanx/30' : 'bg-no/30')}>
                            {b.name[0]?.toUpperCase()}
                          </span>
                          <span className="font-mono text-slate-400">{b.name}</span>
                        </span>
                        <span className={cn('font-mono font-semibold', g.cyan ? 'text-cyanx' : 'text-no')}>
                          {fmtXLM(b.amount)} XLM
                        </span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className="py-6 text-center text-sm text-slate-500">No selections yet — be the first.</p>
                )}
              </div>
            ))}
          </div>
        </div>

        {/* Betting sidebar */}
        <div className="lg:col-span-1">
          <div className="card sticky top-20 overflow-hidden p-6 relative">
            {burst > 0 && <CoinBurst key={burst} label={burstLabel} />}
            {isOpen ? (
              <>
                <h3 className="mb-4 text-lg font-bold">Make your selection</h3>
                <div className="flex gap-3">
                  <SideButton value="A" label={idea.optionA} odds={idea.oddsA} color="cyan" />
                  <SideButton value="B" label={idea.optionB} odds={idea.oddsB} color="rose" />
                </div>

                <div className="mt-5">
                  <label className="label">Amount (XLM) · min {fmtXLM(minStake, 3)}</label>
                  <input
                    type="number"
                    min={minStake}
                    step="any"
                    className="input font-mono text-lg"
                    placeholder={String(minStake)}
                    value={amount}
                    onChange={(e) => setAmount(e.target.value)}
                  />
                  <div className="mt-2 flex gap-2">
                    {[minStake, minStake * 10, minStake * 100].map((v) => (
                      <button
                        key={v}
                        onClick={() => setAmount(String(v))}
                        className="flex-1 rounded-lg bg-white/5 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10"
                      >
                        {fmtXLM(v, 3)}
                      </button>
                    ))}
                    {user && (
                      <button
                        onClick={() => setAmount(String(user.balance))}
                        className="flex-1 rounded-lg bg-white/5 py-1.5 text-xs font-medium text-slate-300 hover:bg-white/10"
                      >
                        Max
                      </button>
                    )}
                  </div>
                </div>

                {amt > 0 && (
                  <div className="mt-4 space-y-1.5 rounded-xl border border-white/10 bg-white/5 p-3.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-400">Selection returned</span>
                      <span className="font-mono text-slate-200">{fmtXLM(myStakeAfter)} XLM</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-400">Profit (from losers' pool)</span>
                      <span className="font-mono text-yes">+{fmtXLM(profit)} XLM</span>
                    </div>
                    <div className="flex justify-between border-t border-white/10 pt-1.5">
                      <span className="text-slate-400">Total payout</span>
                      <span className="font-mono font-semibold text-yes">{fmtXLM(potentialPayout)} XLM ({multiple.toFixed(2)}×)</span>
                    </div>
                    <p className="pt-1 text-xs text-slate-500">
                      If "{side === 'A' ? idea.optionA : idea.optionB}" wins you always get your money
                      back; the profit shifts as others select. If it loses, you forfeit your selection.
                    </p>
                  </div>
                )}

                {user ? (
                  <>
                    <button onClick={place} disabled={busy} className="btn-primary mt-4 w-full py-3">
                      {busy ? <Spinner className="h-5 w-5" /> : <>Select {amt > 0 ? `${fmtXLM(amt)} XLM` : 'this side'}</>}
                    </button>
                    <p className="mt-3 flex items-center justify-center gap-1.5 text-xs text-slate-500">
                      <Wallet className="h-3.5 w-3.5" /> Balance:{' '}
                      <AnimatedNumber value={user.balance} className="font-mono text-slate-300" /> XLM
                    </p>
                  </>
                ) : (
                  <Link to="/login" className="btn-primary mt-4 w-full py-3">
                    Sign in to select
                  </Link>
                )}
              </>
            ) : (
              <div className="py-6 text-center">
                <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-white/5">
                  {idea.status === 'closed' ? <Lock className="h-6 w-6 text-amber-300" /> : <Trophy className="h-6 w-6 text-brand-300" />}
                </span>
                <p className="font-semibold text-white">
                  {idea.status === 'closed' ? 'Selection has closed' : 'Idea settled'}
                </p>
                <p className="mt-1 text-sm text-slate-400">
                  {idea.status === 'closed'
                    ? 'Awaiting the real-world result.'
                    : 'This idea has been resolved.'}
                </p>
              </div>
            )}

            <div className="mt-5 flex items-center justify-between border-t border-white/5 pt-4 text-xs text-slate-500">
              <span className="inline-flex items-center gap-1.5"><Users className="h-3.5 w-3.5" /> {idea.backers} selections</span>
              <span className="inline-flex items-center gap-1.5"><Coins className="h-3.5 w-3.5" /> {fmtXLM(idea.total)} XLM</span>
            </div>
          </div>

          {/* Live, real-time rankings side panel */}
          <div className="mt-6">
            <RankingsPanel />
          </div>
        </div>
      </div>
    </Page>
  );
}

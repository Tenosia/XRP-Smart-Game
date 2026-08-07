import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Lightbulb, Info, Sparkles, Megaphone, Clock, CheckCircle2, ShieldQuestion, Globe } from 'lucide-react';
import { api } from '../lib/api.js';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { Page, Spinner } from '../components/Bits.jsx';
import { XIcon, TelegramIcon, DiscordIcon } from '../components/SocialIcons.jsx';
import { fmtXLM } from '../lib/format.js';

const CATEGORIES = ['Sports', 'Crypto', 'Politics', 'Weather', 'Entertainment', 'Finance', 'General'];

const TZ = Intl.DateTimeFormat().resolvedOptions().timeZone;
const RULES = [
  'The answer is unknown today but will be objectively obvious by the end date.',
  'It resolves from a clear, public source (scoreboard, price, official result).',
  'Exactly two outcomes, and one of them must be true by the deadline.',
  'No opinions, no "maybe", nothing that could stay unresolved forever.',
];

// datetime-local string `days` from now (in the user's local time).
function localInput(days) {
  const d = new Date(Date.now() + days * 86400_000);
  d.setSeconds(0, 0);
  const off = d.getTimezoneOffset();
  return new Date(d.getTime() - off * 60_000).toISOString().slice(0, 16);
}

export default function CreateIdea() {
  const { user, refresh } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [cfg, setCfg] = useState({ ideaFeeXlm: 1000, minStakeXlm: 100, split: { winners: 70, owner: 20, dev: 5, marketing: 5 } });
  const [busy, setBusy] = useState(false);
  const [agree, setAgree] = useState(false);
  const [form, setForm] = useState({
    title: '',
    description: '',
    category: 'Sports',
    optionA: '',
    optionB: '',
    closesAt: localInput(3),
    endsAt: localInput(4),
    xUrl: '',
    telegramUrl: '',
    discordUrl: '',
    hp: '', // honeypot — must stay empty
  });

  const utcOf = (v) => (v && !Number.isNaN(Date.parse(v)) ? new Date(v).toUTCString() : null);
  const closesUtc = utcOf(form.closesAt);
  const endsUtc = utcOf(form.endsAt);
  const badOrder =
    form.closesAt && form.endsAt && Date.parse(form.endsAt) < Date.parse(form.closesAt);

  useEffect(() => {
    api.config().then(setCfg).catch(() => {});
  }, []);

  const set = (k) => (e) => setForm({ ...form, [k]: e.target.value });
  const isAdmin = user?.role === 'admin';
  const canAfford = isAdmin || (user?.balance || 0) >= cfg.ideaFeeXlm;

  const submit = async (e) => {
    e.preventDefault();
    if (badOrder) return toast.error('The idea end time must be at or after the funding deadline');
    if (!agree) return toast.error('Please confirm your idea follows the rules');
    if (!canAfford) return toast.error(`You need ${fmtXLM(cfg.ideaFeeXlm)} XLM for the listing fee`);
    setBusy(true);
    try {
      await api.createIdea({
        ...form,
        closesAt: new Date(form.closesAt).toISOString(),
        endsAt: new Date(form.endsAt).toISOString(),
      });
      await refresh();
      toast.success('Submitted! Your idea is now in review.');
      nav('/portfolio');
    } catch (err) {
      toast.error(err.message);
    } finally {
      setBusy(false);
    }
  };

  return (
    <Page className="max-w-3xl">
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }}>
        <div className="mb-6 flex items-center gap-3">
          <span className="grid h-11 w-11 place-items-center rounded-xl bg-brand-grad-soft text-brand-300">
            <Lightbulb className="h-5 w-5" />
          </span>
          <div>
            <h1 className="text-3xl font-extrabold">Create an idea</h1>
            <p className="text-sm text-slate-400">A simple, knowable question with two outcomes. Anyone can be an idea owner.</p>
          </div>
        </div>

        <form onSubmit={submit} className="space-y-5">
          {/* honeypot — hidden from humans, catches bots */}
          <input
            type="text"
            name="hp"
            value={form.hp}
            onChange={set('hp')}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute left-[-9999px] h-0 w-0 opacity-0"
          />

          {/* Rules for a valid idea */}
          <div className="card border-ember-500/30 p-6">
            <div className="flex items-center gap-2 font-semibold text-white">
              <ShieldQuestion className="h-5 w-5 text-ember-400" /> What makes a valid idea
            </div>
            <p className="mt-1 text-sm text-ember-200/90">
              The answer must be <strong>unpredictable now, but obvious in the future.</strong>
            </p>
            <ul className="mt-3 space-y-2">
              {RULES.map((r) => (
                <li key={r} className="flex items-start gap-2 text-sm text-slate-300">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-yes" /> {r}
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              Our team reviews every idea against these rules before it goes live (the fee is refunded if rejected).
            </p>
          </div>

          <div className="card space-y-5 p-6">
            <div>
              <label className="label">Question</label>
              <input
                className="input"
                placeholder="Will France beat Brazil on June 25th?"
                value={form.title}
                onChange={set('title')}
                required
                minLength={8}
                maxLength={140}
              />
              <p className="mt-1 text-xs text-slate-500">Must be objectively answerable by the closing time.</p>
            </div>

            <div>
              <label className="label">Resolution details</label>
              <textarea
                className="input min-h-[100px] resize-y"
                placeholder="Explain exactly how this resolves and what data source decides the winner."
                value={form.description}
                onChange={set('description')}
                required
                minLength={10}
                maxLength={1200}
              />
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div>
                <label className="label">Option A <span className="text-cyanx">(teal)</span></label>
                <input className="input" placeholder="France wins" value={form.optionA} onChange={set('optionA')} required maxLength={40} />
              </div>
              <div>
                <label className="label">Option B <span className="text-no">(rose)</span></label>
                <input className="input" placeholder="Draw or Brazil" value={form.optionB} onChange={set('optionB')} required maxLength={40} />
              </div>
            </div>

            <div>
              <label className="label">Category</label>
              <select className="input sm:max-w-xs" value={form.category} onChange={set('category')}>
                {CATEGORIES.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            </div>

            {/* Two deadlines */}
            <div className="rounded-xl border border-white/10 bg-white/[0.03] p-4">
              <p className="mb-3 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-slate-400">
                <Globe className="h-3.5 w-3.5" /> Times · your timezone is {TZ}
              </p>
              <div className="grid gap-4 sm:grid-cols-2">
                <div>
                  <label className="label flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-ember-400" /> 1 · Funding closes
                  </label>
                  <input type="datetime-local" className="input" value={form.closesAt} onChange={set('closesAt')} required />
                  <p className="mt-1 text-xs text-slate-500">No selections accepted after this.{closesUtc ? ` · ${closesUtc} UTC` : ''}</p>
                </div>
                <div>
                  <label className="label flex items-center gap-1.5">
                    <Clock className="h-3.5 w-3.5 text-no" /> 2 · Idea ends / resolves
                  </label>
                  <input type="datetime-local" className="input" value={form.endsAt} onChange={set('endsAt')} required />
                  <p className={`mt-1 text-xs ${badOrder ? 'text-no' : 'text-slate-500'}`}>
                    {badOrder ? 'Must be at or after funding closes.' : `Outcome is known here; result can be submitted after this.${endsUtc ? ` · ${endsUtc} UTC` : ''}`}
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Promote your idea */}
          <div className="card space-y-4 p-6">
            <div className="flex items-center gap-2 text-sm font-semibold text-white">
              <Megaphone className="h-4 w-4 text-ember-400" /> Promote your idea
              <span className="font-normal text-slate-500">(optional)</span>
            </div>
            <p className="text-sm text-slate-400">
              Add your channels so your audience can follow and share. They appear on your idea page next to your name.
            </p>
            <div className="grid gap-4 sm:grid-cols-3">
              <div>
                <label className="label flex items-center gap-1.5"><XIcon className="h-3.5 w-3.5" /> X (Twitter)</label>
                <input className="input" placeholder="https://x.com/you" value={form.xUrl} onChange={set('xUrl')} />
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><TelegramIcon className="h-3.5 w-3.5" /> Telegram</label>
                <input className="input" placeholder="https://t.me/you" value={form.telegramUrl} onChange={set('telegramUrl')} />
              </div>
              <div>
                <label className="label flex items-center gap-1.5"><DiscordIcon className="h-3.5 w-3.5" /> Discord</label>
                <input className="input" placeholder="https://discord.gg/..." value={form.discordUrl} onChange={set('discordUrl')} />
              </div>
            </div>
          </div>

          {/* Fee + economics */}
          <div className="card space-y-3 p-6">
            <div className="flex items-start gap-3">
              <Info className="mt-0.5 h-5 w-5 shrink-0 text-brand-400" />
              <div className="text-sm text-slate-400">
                {isAdmin ? (
                  <>As a project owner, your listing fee is <span className="font-semibold text-yes">free</span>. </>
                ) : (
                  <>Submitting costs a <span className="font-semibold text-white">{fmtXLM(cfg.ideaFeeXlm)} XLM</span> listing
                  fee. It's refunded if your idea is rejected in review. </>
                )}
                When it settles you earn{' '}
                <span className="font-semibold text-brand-300">{cfg.split.owner}%</span> of the losing side's pool as the idea owner.
                Each selection must be at least <span className="font-semibold text-white">{fmtXLM(cfg.minStakeXlm, 3)} XLM</span>.
              </div>
            </div>
            {!isAdmin && (
              <div className="flex items-center justify-between rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm">
                <span className="text-slate-400">Your balance</span>
                <span className={`font-mono font-semibold ${canAfford ? 'text-white' : 'text-no'}`}>
                  {fmtXLM(user?.balance || 0)} XLM
                </span>
              </div>
            )}
            {!canAfford && (
              <p className="text-sm text-no">
                You need {fmtXLM(cfg.ideaFeeXlm - (user?.balance || 0))} more XLM. Top up in your wallet first.
              </p>
            )}
          </div>

          {/* Acknowledgement */}
          <label className="card flex cursor-pointer items-start gap-3 p-5">
            <input
              type="checkbox"
              checked={agree}
              onChange={(e) => setAgree(e.target.checked)}
              className="mt-0.5 h-5 w-5 accent-brand-500"
            />
            <span className="text-sm text-slate-300">
              I confirm this idea has a clear, objective answer that is{' '}
              <strong className="text-white">unpredictable now but obvious by the end date</strong>, and resolves from a public source.
            </span>
          </label>

          <button disabled={busy || !canAfford || !agree || badOrder} className="btn-primary w-full py-3.5 text-base">
            {busy ? <Spinner className="h-5 w-5" /> : <><Sparkles className="h-4 w-4" /> Submit for review · {isAdmin ? 'Free' : `${fmtXLM(cfg.ideaFeeXlm)} XLM`}</>}
          </button>
        </form>
      </motion.div>
    </Page>
  );
}

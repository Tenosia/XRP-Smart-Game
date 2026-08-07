import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { FileText, ArrowRight } from 'lucide-react';
import { api } from '../lib/api.js';
import { Page } from '../components/Bits.jsx';
import SplitChart from '../components/SplitChart.jsx';

function Section({ n, title, children }) {
  return (
    <section className="border-t border-white/[0.06] py-8">
      <h2 className="mb-3 text-2xl font-extrabold text-white">
        <span className="mr-2 text-brand-400">{n}.</span>
        {title}
      </h2>
      <div className="space-y-3 text-[15px] leading-relaxed text-slate-300">{children}</div>
    </section>
  );
}

export default function Whitepaper() {
  const [cfg, setCfg] = useState({ ideaFeeXlm: 1000, minStakeXlm: 100, split: { winners: 70, owner: 20, dev: 5, marketing: 5 } });
  useEffect(() => {
    api.config().then(setCfg).catch(() => {});
  }, []);

  return (
    <Page className="max-w-3xl">
      <div className="mb-6 flex items-center gap-3">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-grad shadow-glow">
          <FileText className="h-7 w-7 text-white" />
        </span>
        <div>
          <h1 className="text-4xl font-extrabold">Whitepaper</h1>
          <p className="text-slate-400">How MyIdea works — in plain language.</p>
        </div>
      </div>

      <div className="card p-6 sm:p-9">
        <p className="text-lg leading-relaxed text-slate-200">
          <strong className="text-white">MyIdea</strong> is a Stellar-powered idea market. Anyone
          can pose a simple, knowable yes/no question. The crowd takes sides by selecting an option with XLM,
          and when the outcome is known the pool is settled — <strong className="text-white">winners
          never lose their money</strong>, and only the losing side funds the rewards.
        </p>

        <Section n="1" title="Roles">
          <p><strong className="text-white">Users</strong> sign up by email, get a personal Stellar deposit address, fund it with XLM, and select sides on ideas.</p>
          <p><strong className="text-white">Idea Owners</strong> — anyone who pays the listing fee and submits an idea. They earn {cfg.split.owner}% of the losing pool of every idea they create. Anyone can be an idea owner; anyone can earn.</p>
          <p><strong className="text-white">Project Owners</strong> (the platform) review submissions, approve results, and take {cfg.split.dev}% (development) + {cfg.split.marketing}% (marketing) of losing pools.</p>
        </Section>

        <Section n="2" title="Lifecycle of an idea">
          <div className="mb-3 rounded-xl border border-ember-500/30 bg-ember-500/[0.08] p-4 text-sm">
            <strong className="text-white">The golden rule.</strong> A valid idea has an answer that is{' '}
            <strong className="text-ember-200">unpredictable today but objectively obvious by the end date</strong>{' '}
            — a match result, a price on a given day, an election outcome. No opinions, and nothing that
            might never resolve.
          </div>
          <p>1. An owner submits an idea (question, two options, an end date) and pays the listing fee. Optionally they attach X / Telegram / Discord links to attract a crowd.</p>
          <p>2. The platform reviews it. If approved it goes live; if rejected the fee is refunded.</p>
          <p>3. While live, users select Option A or Option B with XLM. The pool split is the crowd's implied probability.</p>
          <p>4. At the end date staking closes. <strong className="text-white">After</strong> the end date, the owner submits the real-world result, which the platform approves.</p>
          <p>5. On approval the pool settles instantly and winnings hit balances.</p>
        </Section>

        <Section n="3" title="Economics — winners never lose">
          <p>At settlement every winner gets their <strong className="text-white">full selection back</strong>. Only the losing side's pool is redistributed:</p>
          <div className="my-5 rounded-2xl border border-white/10 bg-white/5 p-6">
            <SplitChart split={cfg.split} />
          </div>
          <div className="rounded-xl border border-white/10 bg-white/5 p-4 text-sm">
            <strong className="text-white">Example.</strong> 600 XLM on the winning side, 400 on the losing side.
            Losers' pool = 400 → 280 to winners, 80 to the owner, 20 development, 20 marketing. A winner who
            selected 60 (10% of the winning side) receives 60 back + 28 profit = <strong className="text-yes">88 XLM</strong>.
          </div>
          <p className="mt-3 text-sm text-slate-400">If nobody backed the winning side, every backing is refunded. If there are no losers, everyone simply gets their money back.</p>
        </Section>

        <Section n="4" title="Wallet & custody">
          <p>Every account gets a dedicated Stellar address. Deposits are credited automatically and swept to the platform hot wallet; withdrawals are paid on-chain to any address, any time. Selections, payouts and fees move instantly on an internal ledger recorded down to the stroop.</p>
        </Section>

        <Section n="5" title="Fairness & bot protection">
          <p>The minimum selection is <strong className="text-white">{cfg.minStakeXlm} XLM</strong> to keep pools meaningful. Sign-up requires a CAPTCHA, forms carry hidden honeypots, sign-ups and actions are rate-limited, and accounts that fire actions faster than a human can are throttled and flagged for review.</p>
        </Section>

        <Section n="6" title="Built on Stellar (XLM)">
          <p>MyIdea settles in Stellar's native asset, XLM — fast (~5s) and low-fee. The reference build runs on the Stellar testnet and switches to mainnet with a single configuration change.</p>
        </Section>
      </div>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link to="/" className="btn-primary px-6 py-3 text-base">Browse ideas <ArrowRight className="h-4 w-4" /></Link>
        <Link to="/faq" className="btn-ghost px-6 py-3 text-base">Read the FAQ</Link>
      </div>
    </Page>
  );
}

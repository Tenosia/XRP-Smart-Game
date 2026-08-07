import { useState } from 'react';
import { Link } from 'react-router-dom';
import { HelpCircle, ChevronDown } from 'lucide-react';
import { Page } from '../components/Bits.jsx';
import { cn } from '../lib/format.js';

const FAQS = [
  {
    q: 'What is MyIdea?',
    a: 'An idea market on the Stellar network. Anyone can pose a simple yes/no question; the crowd backs a side with XLM, and when it resolves the pool is shared out. Winners keep their money and split the losing side\'s pool.',
  },
  {
    q: 'Do winners ever lose money?',
    a: 'No. Every winner gets their full selection back. Only the losing side funds the rewards — 70% of the losers\' pool goes to winners (pro-rata), 20% to the idea owner, 5% to development, 5% to marketing.',
  },
  {
    q: 'What makes a valid idea?',
    a: 'The golden rule: the answer must be unpredictable today but objectively obvious by the end date — like a match result, a price on a given day, or an election outcome. No opinions, and nothing that might never resolve. Our team reviews every idea against this rule before it goes live.',
  },
  {
    q: 'How do I earn as an idea owner?',
    a: 'Create an idea (pay the listing fee). When it settles you earn 20% of the losing side\'s pool. Anyone can be an idea owner — and you can attach your X, Telegram and Discord links plus a shareable idea link to bring in a crowd.',
  },
  {
    q: 'How do I add money / cash out?',
    a: 'Sign up and open your Wallet to get a personal Stellar deposit address. Send XLM there and it\'s credited automatically. Withdraw to any Stellar address at any time.',
  },
  {
    q: 'Is there a minimum amount per selection?',
    a: 'Yes — the minimum selection is 100 XLM per idea, to keep pools meaningful for everyone.',
  },
  {
    q: 'When can the result be submitted?',
    a: 'Only after the idea\'s end date has passed. The idea owner submits the real-world result and a project owner reviews and approves it, which triggers the payout.',
  },
  {
    q: 'How are the odds set?',
    a: 'There is no house-set line. The split of money between the two sides is the crowd\'s implied probability, and it shifts as people bet on each side.',
  },
  {
    q: 'What stops bots and abuse?',
    a: 'Sign-up requires a CAPTCHA, forms use hidden honeypots, sign-ups and actions are rate-limited per network and per account, and accounts acting faster than humanly possible are throttled and flagged. All balances are tracked on an auditable internal ledger.',
  },
  {
    q: 'Which blockchain and token?',
    a: 'Stellar, settled in its native token XLM — fast and low-fee. The reference build runs on testnet and flips to mainnet with one config change.',
  },
];

function Item({ q, a }) {
  const [open, setOpen] = useState(false);
  return (
    <button
      onClick={() => setOpen((o) => !o)}
      className="card w-full p-5 text-left transition hover:border-white/20"
    >
      <div className="flex items-center justify-between gap-4">
        <span className="text-lg font-bold text-white">{q}</span>
        <ChevronDown className={cn('h-5 w-5 shrink-0 text-slate-400 transition', open && 'rotate-180 text-brand-300')} />
      </div>
      {open && <p className="mt-3 text-[15px] leading-relaxed text-slate-300">{a}</p>}
    </button>
  );
}

export default function FAQ() {
  return (
    <Page className="max-w-3xl">
      <div className="mb-8 flex items-center gap-3">
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-brand-grad shadow-glow">
          <HelpCircle className="h-7 w-7 text-white" />
        </span>
        <div>
          <h1 className="text-4xl font-extrabold">FAQ</h1>
          <p className="text-slate-400">Frequently asked questions.</p>
        </div>
      </div>

      <div className="space-y-3">
        {FAQS.map((f) => (
          <Item key={f.q} {...f} />
        ))}
      </div>

      <div className="mt-8 card p-6 text-center">
        <p className="text-slate-300">Still have a question?</p>
        <Link to="/whitepaper" className="btn-primary mt-3 px-6 py-3 text-base">Read the whitepaper</Link>
      </div>
    </Page>
  );
}

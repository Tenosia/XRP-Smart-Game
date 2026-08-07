import { Link } from 'react-router-dom';
import Logo from './Logo.jsx';
import { SITE } from '../lib/site.js';
import { XIcon, TelegramIcon, DiscordIcon } from './SocialIcons.jsx';

const socials = [
  { url: SITE.x, Icon: XIcon, label: 'X' },
  { url: SITE.telegram, Icon: TelegramIcon, label: 'Telegram' },
  { url: SITE.discord, Icon: DiscordIcon, label: 'Discord' },
];

export default function Footer() {
  return (
    <footer className="mt-20 border-t border-white/[0.06] bg-ink-950/60">
      <div className="mx-auto max-w-[1400px] px-5 py-12 sm:px-8">
        <div className="flex flex-col items-start justify-between gap-8 lg:flex-row">
          <div className="max-w-sm">
            <Logo />
            <p className="mt-4 text-lg font-semibold text-white">{SITE.tagline}</p>
            <p className="mt-2 text-sm text-slate-400">
              A Stellar-powered idea market. Float a question, the crowd backs it with XLM, winners
              keep their money and share the losers' pool.
            </p>
          </div>

          <div className="flex flex-wrap gap-12">
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Explore</p>
              <ul className="space-y-2 text-sm">
                <li><Link to="/" className="text-slate-300 hover:text-white">Ideas</Link></li>
                <li><Link to="/create" className="text-slate-300 hover:text-white">Create an idea</Link></li>
                <li><Link to="/wallet" className="text-slate-300 hover:text-white">Wallet</Link></li>
              </ul>
            </div>
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Learn</p>
              <ul className="space-y-2 text-sm">
                <li><Link to="/whitepaper" className="text-slate-300 hover:text-white">Whitepaper</Link></li>
                <li><Link to="/faq" className="text-slate-300 hover:text-white">FAQ</Link></li>
              </ul>
            </div>
            <div>
              <p className="mb-3 text-xs font-bold uppercase tracking-widest text-slate-500">Community</p>
              <div className="flex gap-2">
                {socials.map(({ url, Icon, label }) => (
                  <a
                    key={label}
                    href={url}
                    target="_blank"
                    rel="noreferrer"
                    title={label}
                    className="grid h-11 w-11 place-items-center rounded-xl border border-white/10 bg-white/5 text-slate-300 transition hover:bg-brand-grad hover:text-white"
                  >
                    <Icon className="h-5 w-5" />
                  </a>
                ))}
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 border-t border-white/[0.06] pt-6 text-sm text-slate-500">
          © {SITE.name} · Built on Stellar · Play responsibly.
        </div>
      </div>
    </footer>
  );
}

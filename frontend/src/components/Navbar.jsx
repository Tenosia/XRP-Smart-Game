import { Link, NavLink, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import { Coins, Plus, LogOut, Menu, X, FileText, HelpCircle, LayoutGrid, PlusCircle } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { fmtXLM, cn } from '../lib/format.js';
import AnimatedNumber from './AnimatedNumber.jsx';
import Logo from './Logo.jsx';

const LINKS = [
  { to: '/', label: 'Ideas', icon: LayoutGrid },
  { to: '/create', label: 'Create', icon: PlusCircle },
  { to: '/whitepaper', label: 'Whitepaper', icon: FileText },
  { to: '/faq', label: 'FAQ', icon: HelpCircle },
];

export default function Navbar() {
  const { user, logout } = useAuth();
  const nav = useNavigate();
  const [open, setOpen] = useState(false);

  const linkClass = ({ isActive }) =>
    cn(
      'rounded-xl px-3.5 py-2 text-[15px] font-semibold transition',
      isActive ? 'bg-white/10 text-white' : 'text-slate-300 hover:text-white hover:bg-white/5'
    );

  return (
    <header className="sticky top-0 z-40 border-b border-white/[0.06] bg-ink-950/85 backdrop-blur-xl">
      <div className="mx-auto flex h-20 max-w-[1400px] items-center gap-4 px-5 sm:px-8">
        <Logo />

        <nav className="ml-4 hidden items-center gap-1 lg:flex">
          {LINKS.map((l) => (
            <NavLink key={l.label} to={l.to} className={linkClass} end={l.to === '/'}>
              {l.label}
            </NavLink>
          ))}
        </nav>

        <div className="ml-auto flex items-center gap-2 sm:gap-3">
          {user ? (
            <>
              <Link to="/create" className="btn-primary hidden px-4 py-2.5 text-[15px] sm:inline-flex">
                <Plus className="h-4 w-4" /> Create idea
              </Link>
              <div className="pill">
                <Coins className="h-5 w-5 text-ember-400" />
                <AnimatedNumber value={user.balance} className="font-mono text-sm font-bold text-white" />
                <Link to="/wallet" className="btn-primary ml-1 px-3 py-1 text-xs">Deposit</Link>
              </div>
              <Link
                to="/portfolio"
                className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-brand-grad text-base font-bold text-white ring-1 ring-white/20"
                title="Portfolio"
              >
                {(user.displayName || user.email)[0].toUpperCase()}
              </Link>
              <button onClick={() => { logout(); nav('/'); }} className="hidden text-slate-400 hover:text-white sm:block" title="Log out">
                <LogOut className="h-5 w-5" />
              </button>
            </>
          ) : (
            <>
              <Link to="/login" className="btn-ghost px-4 py-2.5 text-[15px]">Sign in</Link>
              <Link to="/register" className="btn-primary px-5 py-2.5 text-[15px]">Get started</Link>
            </>
          )}
          <button className="text-slate-200 lg:hidden" onClick={() => setOpen((o) => !o)}>
            {open ? <X className="h-7 w-7" /> : <Menu className="h-7 w-7" />}
          </button>
        </div>
      </div>

      {open && (
        <div className="border-t border-white/[0.06] px-5 py-3 lg:hidden">
          <nav className="flex flex-col gap-1">
            {LINKS.map((l) => (
              <NavLink
                key={l.label}
                to={l.to}
                end={l.to === '/'}
                onClick={() => setOpen(false)}
                className="flex items-center gap-3 rounded-xl px-3.5 py-3 text-base font-semibold text-slate-200 hover:bg-white/5"
              >
                <l.icon className="h-5 w-5 text-ember-400" /> {l.label}
              </NavLink>
            ))}
            {user && (
              <Link to="/create" onClick={() => setOpen(false)} className="btn-primary mt-2 py-3 text-base">
                <Plus className="h-5 w-5" /> Create idea
              </Link>
            )}
          </nav>
        </div>
      )}
    </header>
  );
}

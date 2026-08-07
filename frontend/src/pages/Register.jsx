import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Mail, Lock, User, ArrowRight, Check } from 'lucide-react';
import { useAuth } from '../context/AuthContext.jsx';
import { useToast } from '../context/ToastContext.jsx';
import { api } from '../lib/api.js';
import { Spinner } from '../components/Bits.jsx';
import Turnstile from '../components/Turnstile.jsx';
import Logo from '../components/Logo.jsx';

const perks = [
  'A personal Stellar deposit wallet',
  'Select a side on any live idea in seconds',
  'Create your own ideas and earn 20%',
];

export default function Register() {
  const { register } = useAuth();
  const toast = useToast();
  const nav = useNavigate();
  const [form, setForm] = useState({ email: '', displayName: '', password: '', hp: '' });
  const [siteKey, setSiteKey] = useState('');
  const [turnstileToken, setTurnstileToken] = useState('');
  const [resetKey, setResetKey] = useState(0); // bump to re-render the widget
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    api.config().then((c) => setSiteKey(c.turnstileSiteKey || '')).catch(() => {});
  }, []);

  const submit = async (e) => {
    e.preventDefault();
    if (siteKey && !turnstileToken) return toast.error('Please complete the "Verify you are human" check');
    setBusy(true);
    try {
      await register({
        email: form.email,
        password: form.password,
        displayName: form.displayName || undefined,
        hp: form.hp,
        turnstileToken,
      });
      toast.success('Account created — here is your deposit wallet.');
      nav('/wallet');
    } catch (err) {
      toast.error(err.message);
      setTurnstileToken('');
      setResetKey((k) => k + 1); // fresh challenge after any failure
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="mx-auto grid min-h-[calc(100vh-4rem)] max-w-5xl items-center gap-10 px-4 py-12 lg:grid-cols-2">
      <motion.div
        initial={{ opacity: 0, x: -20 }}
        animate={{ opacity: 1, x: 0 }}
        className="hidden lg:block"
      >
        <Logo />
        <h1 className="mt-8 font-display text-4xl font-bold leading-tight text-white">
          Turn what you know into <span className="gradient-text">winnings.</span>
        </h1>
        <p className="mt-4 max-w-md text-slate-400">
          Join MyIdea, fund your XLM wallet, and start selecting the outcomes you see coming.
        </p>
        <ul className="mt-8 space-y-3">
          {perks.map((p) => (
            <li key={p} className="flex items-center gap-3 text-slate-300">
              <span className="grid h-6 w-6 place-items-center rounded-full bg-yes/15 text-yes">
                <Check className="h-3.5 w-3.5" />
              </span>
              {p}
            </li>
          ))}
        </ul>
      </motion.div>

      <motion.div initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} className="w-full">
        <div className="mb-6 text-center lg:hidden">
          <Logo />
        </div>
        <form onSubmit={submit} className="card space-y-4 p-7">
          <input
            type="text"
            name="hp"
            value={form.hp}
            onChange={(e) => setForm({ ...form, hp: e.target.value })}
            tabIndex={-1}
            autoComplete="off"
            aria-hidden="true"
            className="absolute left-[-9999px] h-0 w-0 opacity-0"
          />
          <h2 className="text-xl font-bold">Create your account</h2>
          <div>
            <label className="label">Email</label>
            <div className="relative">
              <Mail className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
              <input
                type="email"
                required
                className="input pl-10"
                placeholder="you@example.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">Display name <span className="text-slate-600">(optional)</span></label>
            <div className="relative">
              <User className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
              <input
                className="input pl-10"
                placeholder="Satoshi"
                value={form.displayName}
                onChange={(e) => setForm({ ...form, displayName: e.target.value })}
              />
            </div>
          </div>
          <div>
            <label className="label">Password</label>
            <div className="relative">
              <Lock className="pointer-events-none absolute left-3.5 top-3 h-4 w-4 text-slate-500" />
              <input
                type="password"
                required
                minLength={8}
                className="input pl-10"
                placeholder="At least 8 characters"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
              />
            </div>
          </div>
          {siteKey && (
            <div>
              <label className="label">Verify you're human</label>
              <Turnstile key={resetKey} siteKey={siteKey} onToken={setTurnstileToken} />
            </div>
          )}
          <button disabled={busy} className="btn-primary w-full py-3">
            {busy ? <Spinner className="h-5 w-5" /> : <>Create account <ArrowRight className="h-4 w-4" /></>}
          </button>
          <p className="text-center text-sm text-slate-400">
            Already have an account?{' '}
            <Link to="/login" className="font-semibold text-brand-300 hover:text-brand-200">
              Sign in
            </Link>
          </p>
        </form>
      </motion.div>
    </div>
  );
}

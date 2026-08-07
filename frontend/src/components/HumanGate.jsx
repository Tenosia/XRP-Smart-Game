import { useEffect, useState } from 'react';
import { ShieldCheck } from 'lucide-react';
import { api } from '../lib/api.js';
import Turnstile from './Turnstile.jsx';
import Logo from './Logo.jsx';
import { Spinner } from './Bits.jsx';

const KEY = 'myidea_human';

// Site-wide bot gate: a visitor must pass Cloudflare Turnstile once per browser
// session before the app is shown. If Turnstile isn't configured, it's a no-op.
export default function HumanGate({ children }) {
  const [ok, setOk] = useState(() => sessionStorage.getItem(KEY) === '1');
  const [siteKey, setSiteKey] = useState(undefined); // undefined = still loading
  const [verifying, setVerifying] = useState(false);
  const [err, setErr] = useState('');

  useEffect(() => {
    if (ok) return;
    api
      .config()
      .then((c) => setSiteKey(c.turnstileSiteKey || ''))
      .catch(() => setSiteKey('')); // on failure, don't lock people out
  }, [ok]);

  // No Turnstile configured → don't gate.
  useEffect(() => {
    if (siteKey === '') setOk(true);
  }, [siteKey]);

  if (ok) return children;

  const onToken = async (token) => {
    if (!token) return;
    setVerifying(true);
    setErr('');
    try {
      await api.verifyHuman(token);
      sessionStorage.setItem(KEY, '1');
      setOk(true);
    } catch {
      setErr('Verification failed — please try again.');
    } finally {
      setVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center bg-ink-950 px-4">
      <div
        className="pointer-events-none absolute inset-0 opacity-60"
        style={{
          backgroundImage:
            'radial-gradient(55rem 42rem at 100% -5%, rgba(255,106,26,0.18), transparent 55%), radial-gradient(45rem 45rem at -5% 105%, rgba(255,59,48,0.14), transparent 55%)',
        }}
      />
      <div className="card relative w-full max-w-sm p-8 text-center">
        <div className="mb-5 flex justify-center">
          <Logo />
        </div>
        <span className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-xl bg-brand-grad-soft text-ember-300">
          <ShieldCheck className="h-6 w-6" />
        </span>
        <h1 className="text-xl font-bold text-white">Verify you are human</h1>
        <p className="mt-2 text-sm text-slate-400">A quick check to keep MyIdea safe from bots.</p>
        <div className="mt-5 flex min-h-[70px] justify-center">
          {siteKey === undefined ? <Spinner /> : <Turnstile siteKey={siteKey} onToken={onToken} />}
        </div>
        {verifying && <p className="mt-3 text-sm text-slate-400">Verifying…</p>}
        {err && <p className="mt-3 text-sm text-no">{err}</p>}
      </div>
    </div>
  );
}

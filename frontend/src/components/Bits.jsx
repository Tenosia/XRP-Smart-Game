import { Loader2 } from 'lucide-react';

export function Spinner({ className = 'h-6 w-6' }) {
  return <Loader2 className={`animate-spin text-brand-400 ${className}`} />;
}

export function Loading({ label = 'Loading…' }) {
  return (
    <div className="flex min-h-[40vh] flex-col items-center justify-center gap-3 text-slate-400">
      <Spinner className="h-7 w-7" />
      <span className="text-sm">{label}</span>
    </div>
  );
}

export function EmptyState({ icon: Icon, title, children }) {
  return (
    <div className="card flex flex-col items-center gap-3 px-6 py-16 text-center">
      {Icon && (
        <span className="grid h-14 w-14 place-items-center rounded-2xl bg-white/5">
          <Icon className="h-7 w-7 text-slate-400" />
        </span>
      )}
      <h3 className="text-lg font-semibold text-white">{title}</h3>
      {children && <p className="max-w-sm text-sm text-slate-400">{children}</p>}
    </div>
  );
}

export function Stat({ label, value, sub, accent }) {
  return (
    <div className="card p-5">
      <p className="text-xs font-semibold uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`mt-1 font-display text-2xl font-bold ${accent || 'text-white'}`}>{value}</p>
      {sub && <p className="mt-0.5 text-xs text-slate-500">{sub}</p>}
    </div>
  );
}

export function Page({ children, className = '' }) {
  return (
    <div className={`mx-auto max-w-[1400px] px-5 py-8 sm:px-8 ${className}`}>{children}</div>
  );
}

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Trophy, Crown, TrendingUp, Lightbulb } from 'lucide-react';
import { api } from '../lib/api.js';
import AnimatedNumber from './AnimatedNumber.jsx';
import { cn } from '../lib/format.js';

const TABS = [
  { key: 'users', label: 'Earners', icon: TrendingUp },
  { key: 'owners', label: 'Owners', icon: Crown },
  { key: 'ideas', label: 'Ideas', icon: Lightbulb },
];
const medal = (i) => (i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}`);

// Live leaderboard that re-sorts in real time as money moves. Polls every 5s.
export default function RankingsPanel() {
  const [data, setData] = useState(null);
  const [tab, setTab] = useState('users');

  useEffect(() => {
    let alive = true;
    const load = () => api.rankings().then((d) => alive && setData(d)).catch(() => {});
    load();
    const t = setInterval(load, 5000);
    return () => {
      alive = false;
      clearInterval(t);
    };
  }, []);

  const rows = data ? (tab === 'users' ? data.users : tab === 'owners' ? data.owners : data.ideas) : [];

  return (
    <div className="card p-5">
      <div className="mb-3 flex items-center gap-2">
        <Trophy className="h-4 w-4 text-ember-400" />
        <h3 className="text-sm font-bold text-white">Live rankings</h3>
        <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-yes/15 px-1.5 py-0.5 text-[10px] font-bold text-yes">
          <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-yes" /> LIVE
        </span>
      </div>

      <div className="mb-3 grid grid-cols-3 gap-1">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              'flex items-center justify-center gap-1 rounded-lg px-2 py-1.5 text-xs font-semibold transition',
              tab === t.key ? 'bg-fire-btn text-white shadow-glow' : 'bg-white/5 text-slate-400 hover:text-white'
            )}
          >
            <t.icon className="h-3.5 w-3.5" /> {t.label}
          </button>
        ))}
      </div>

      <motion.div layout className="space-y-1.5">
        <AnimatePresence initial={false}>
          {rows.slice(0, 8).map((r, i) => (
            <motion.div
              key={`${tab}-${r.userId || r.id}`}
              layout
              initial={{ opacity: 0, y: 6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0 }}
              transition={{ type: 'spring', stiffness: 420, damping: 34 }}
              className={cn(
                'flex items-center gap-2 rounded-lg px-2.5 py-2 text-sm',
                i < 3 ? 'bg-ember-500/[0.08]' : 'bg-white/[0.04]'
              )}
            >
              <span className="w-5 shrink-0 text-center text-xs font-bold">{medal(i)}</span>
              {tab === 'ideas' ? (
                <Link to={`/ideas/${r.id}`} className="min-w-0 flex-1 truncate font-medium text-white hover:text-brand-200">
                  {r.title}
                </Link>
              ) : (
                <span className="min-w-0 flex-1 truncate font-medium text-white">
                  {r.name}
                  {r.admin && <span className="ml-1 text-[10px] text-slate-500">team</span>}
                </span>
              )}
              <span
                className={cn(
                  'shrink-0 font-mono text-xs font-bold',
                  tab === 'ideas' ? 'text-ember-300' : tab === 'owners' ? 'text-yes' : r.net < 0 ? 'text-no' : 'text-yes'
                )}
              >
                {tab === 'users' && r.net >= 0 ? '+' : ''}
                <AnimatedNumber value={tab === 'ideas' ? r.total : tab === 'owners' ? r.earned : r.net} dp={0} />
                <span className="ml-0.5 text-[9px] text-slate-500">XLM</span>
              </span>
            </motion.div>
          ))}
          {!rows.length && <p className="py-4 text-center text-xs text-slate-500">No data yet.</p>}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

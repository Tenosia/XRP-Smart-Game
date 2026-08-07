import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Users, Coins } from 'lucide-react';
import StatusBadge from './StatusBadge.jsx';
import OddsBar from './OddsBar.jsx';
import Countdown from './Countdown.jsx';
import { fmtXLM, urgencyTier, cn } from '../lib/format.js';

const URGENCY = {
  red: 'urgency-red',
  yellow: 'urgency-yellow',
  green: 'urgency-green',
};

export default function IdeaCard({ idea }) {
  const tier = urgencyTier(idea.closesAt, idea.status);
  return (
    <motion.div whileHover={{ y: -5 }} transition={{ type: 'spring', stiffness: 300, damping: 24 }}>
      <Link
        to={`/ideas/${idea.id}`}
        className={cn(
          'card group flex h-full flex-col gap-4 p-5 hover:shadow-glow',
          tier ? URGENCY[tier] : 'hover:border-brand-400/40'
        )}
      >
        <div className="flex items-start justify-between gap-3">
          <span className="chip bg-white/5 text-slate-300">{idea.category}</span>
          <StatusBadge status={idea.status} />
        </div>

        <h3 className="line-clamp-2 text-lg font-bold leading-snug text-white">{idea.title}</h3>

        {/* who made this */}
        <div className="flex items-center gap-2 text-sm text-slate-400">
          <span className="grid h-6 w-6 place-items-center rounded-full bg-brand-grad text-[11px] font-bold text-white">
            {(idea.creator?.name || '?')[0].toUpperCase()}
          </span>
          by <span className="font-medium text-slate-200">{idea.creator?.name}</span>
        </div>

        <div className="mt-auto space-y-3">
          <OddsBar
            oddsA={idea.oddsA}
            oddsB={idea.oddsB}
            labelA={idea.optionA}
            labelB={idea.optionB}
            winningOption={idea.winningOption}
          />
          <div className="flex items-center justify-between text-sm text-slate-400">
            <span className="inline-flex items-center gap-1.5 font-semibold text-ember-300">
              <Coins className="h-4 w-4" /> {fmtXLM(idea.total)} XLM
            </span>
            <span className="inline-flex items-center gap-1.5">
              <Users className="h-4 w-4" /> {idea.backers}
            </span>
            <Countdown
              to={idea.closesAt}
              className={tier === 'red' ? 'text-no' : tier === 'yellow' ? 'text-ember-300' : ''}
            />
          </div>
        </div>
      </Link>
    </motion.div>
  );
}

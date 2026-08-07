import { pct } from '../lib/format.js';

// Two-sided implied-probability bar. A = teal, B = rose.
export default function OddsBar({ oddsA, oddsB, labelA, labelB, winningOption }) {
  const a = Math.max(0, Math.min(1, oddsA));
  const aPct = Math.round(a * 100);
  return (
    <div>
      <div className="mb-1.5 flex items-center justify-between text-xs font-medium">
        <span className={winningOption === 'A' ? 'text-cyanx' : 'text-cyanx/90'}>
          {labelA} · {pct(oddsA)}
          {winningOption === 'A' && ' ✓'}
        </span>
        <span className={winningOption === 'B' ? 'text-no' : 'text-no/90'}>
          {winningOption === 'B' && '✓ '}
          {labelB} · {pct(oddsB)}
        </span>
      </div>
      <div className="flex h-2.5 overflow-hidden rounded-full bg-ink-800">
        <div
          className="h-full bg-gradient-to-r from-cyanx to-cyan-300 transition-all duration-500"
          style={{ width: `${aPct}%` }}
        />
        <div
          className="h-full flex-1 bg-gradient-to-r from-no to-rose-300 transition-all duration-500"
        />
      </div>
    </div>
  );
}

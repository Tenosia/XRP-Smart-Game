// Donut chart visualising how the LOSERS' pool is split.
const COLORS = {
  winners: '#34d399',
  owner: '#ff3b30',
  dev: '#ff8a1a',
  marketing: '#22b8ff',
};
const LABELS = {
  winners: 'Winners',
  owner: 'Idea owner',
  dev: 'Development',
  marketing: 'Marketing',
};

export default function SplitChart({ split, size = 184, thickness = 24 }) {
  const order = ['winners', 'owner', 'dev', 'marketing'];
  const segs = order
    .filter((k) => split?.[k] != null)
    .map((k) => ({ key: k, label: LABELS[k], value: Number(split[k]) || 0, color: COLORS[k] }));
  const total = segs.reduce((a, s) => a + s.value, 0) || 100;

  const r = (size - thickness) / 2;
  const c = 2 * Math.PI * r;
  const cx = size / 2;
  let offset = 0;

  return (
    <div className="flex flex-col items-center gap-6 sm:flex-row sm:items-center sm:gap-8">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`} className="shrink-0">
        <g transform={`rotate(-90 ${cx} ${cx})`}>
          <circle cx={cx} cy={cx} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={thickness} />
          {segs.map((s) => {
            const len = (s.value / total) * c;
            const el = (
              <circle
                key={s.key}
                cx={cx}
                cy={cx}
                r={r}
                fill="none"
                stroke={s.color}
                strokeWidth={thickness}
                strokeDasharray={`${len} ${c - len}`}
                strokeDashoffset={-offset}
              />
            );
            offset += len;
            return el;
          })}
        </g>
        <text x={cx} y={cx - 2} textAnchor="middle" fill="#fff" fontSize="26" fontWeight="800">
          {segs[0]?.value}%
        </text>
        <text x={cx} y={cx + 16} textAnchor="middle" fill="#94a3b8" fontSize="11">
          to winners
        </text>
      </svg>

      <ul className="w-full space-y-2.5">
        {segs.map((s) => (
          <li key={s.key} className="flex items-center gap-3">
            <span className="h-3.5 w-3.5 shrink-0 rounded-sm" style={{ background: s.color }} />
            <span className="flex-1 text-sm text-slate-300">{s.label}</span>
            <span className="font-mono text-sm font-bold text-white">{s.value}%</span>
          </li>
        ))}
        <li className="border-t border-white/10 pt-2 text-xs text-slate-500">
          Applied to the losing side's pool · winners always get their money back.
        </li>
      </ul>
    </div>
  );
}

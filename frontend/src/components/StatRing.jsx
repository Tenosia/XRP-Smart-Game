import { useEffect, useState } from 'react';

// A circular progress ring with the value in the center and a caption below.
// The arc animates from 0 → percent on mount.
export default function StatRing({ value, caption, percent = 100, color = '#ff3b30', size = 150, thickness = 12 }) {
  const r = (size - thickness) / 2;
  const circ = 2 * Math.PI * r;
  const [p, setP] = useState(0);

  useEffect(() => {
    const t = setTimeout(() => setP(Math.max(0, Math.min(100, percent))), 120);
    return () => clearTimeout(t);
  }, [percent]);

  const dash = (circ * p) / 100;

  return (
    <div className="card flex flex-col items-center gap-3 p-6">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="rgba(255,255,255,0.08)" strokeWidth={thickness} />
          <circle
            cx={size / 2}
            cy={size / 2}
            r={r}
            fill="none"
            stroke={color}
            strokeWidth={thickness}
            strokeLinecap="round"
            strokeDasharray={`${dash} ${circ - dash}`}
            style={{ transition: 'stroke-dasharray 1.2s cubic-bezier(.22,1,.36,1)', filter: `drop-shadow(0 0 6px ${color}66)` }}
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className="font-display text-3xl font-extrabold sm:text-4xl" style={{ color }}>
            {value}
          </span>
        </div>
      </div>
      <p className="text-center text-sm text-slate-400">{caption}</p>
    </div>
  );
}

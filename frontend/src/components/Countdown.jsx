import { useEffect, useState } from 'react';
import { Clock } from 'lucide-react';
import { timeLeft } from '../lib/format.js';

export default function Countdown({ to, className = '', showIcon = true }) {
  const [, setTick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 1000);
    return () => clearInterval(t);
  }, []);
  const left = timeLeft(to);
  const closed = left === 'Closed';
  return (
    <span className={`inline-flex items-center gap-1.5 font-mono ${closed ? 'text-slate-500' : ''} ${className}`}>
      {showIcon && <Clock className="h-3.5 w-3.5" />}
      {closed ? 'Closed' : left}
    </span>
  );
}

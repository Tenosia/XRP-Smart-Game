import { useEffect, useRef, useState } from 'react';

// Smoothly counts from the old value to the new one and briefly flashes
// green (up) / red (down) — the "money is moving" feel from betting sites.
export default function AnimatedNumber({
  value,
  dp = 2,
  duration = 700,
  className = '',
  flash = true,
}) {
  const [display, setDisplay] = useState(Number(value) || 0);
  const [dir, setDir] = useState(0);
  const fromRef = useRef(Number(value) || 0);
  const rafRef = useRef();
  const flashTimer = useRef();

  useEffect(() => {
    const from = fromRef.current;
    const to = Number(value) || 0;
    if (from === to) return;
    setDir(to > from ? 1 : -1);

    const start = performance.now();
    cancelAnimationFrame(rafRef.current);
    const tick = (now) => {
      const t = Math.min(1, (now - start) / duration);
      const eased = 1 - Math.pow(1 - t, 3);
      setDisplay(from + (to - from) * eased);
      if (t < 1) rafRef.current = requestAnimationFrame(tick);
      else {
        fromRef.current = to;
        setDisplay(to);
        clearTimeout(flashTimer.current);
        flashTimer.current = setTimeout(() => setDir(0), 600);
      }
    };
    rafRef.current = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(rafRef.current);
  }, [value, duration]);

  const flashCls = flash && dir === 1 ? 'text-yes' : flash && dir === -1 ? 'text-no' : '';
  return (
    <span className={`tabular-nums transition-colors duration-300 ${flashCls} ${className}`}>
      {display.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: dp })}
    </span>
  );
}

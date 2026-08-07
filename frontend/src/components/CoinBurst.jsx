import { motion } from 'framer-motion';

// A burst of gold coins flying up/out from the center — fired on a bet.
// Remount with a changing `key` to replay.
const N = 16;
const coins = Array.from({ length: N }, (_, i) => i);

export default function CoinBurst({ label }) {
  return (
    <div className="pointer-events-none absolute inset-0 z-40 flex items-center justify-center overflow-hidden">
      {coins.map((i) => {
        const angle = (Math.PI * (i / (N - 1))) - Math.PI; // upward fan
        const dist = 90 + Math.random() * 170;
        const x = Math.cos(angle) * dist * (0.6 + Math.random() * 0.8);
        const y = -Math.abs(Math.sin(angle) * dist) - 30 - Math.random() * 80;
        return (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: 0, y: 10, scale: 0.4, rotate: 0 }}
            animate={{ opacity: [0, 1, 1, 0], x, y, scale: 1, rotate: Math.random() * 540 - 270 }}
            transition={{ duration: 0.9 + Math.random() * 0.5, ease: 'easeOut' }}
            className="absolute grid h-7 w-7 place-items-center rounded-full text-sm font-black text-amber-900 shadow-glow-ember"
            style={{ background: 'radial-gradient(circle at 35% 30%, #ffe27a, #f5a300 70%)' }}
          >
            $
          </motion.div>
        );
      })}
      {label && (
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.8 }}
          animate={{ opacity: [0, 1, 1, 0], y: -70, scale: 1.1 }}
          transition={{ duration: 1.3, ease: 'easeOut' }}
          className="absolute font-display text-2xl font-extrabold text-yes drop-shadow-lg"
        >
          {label}
        </motion.div>
      )}
    </div>
  );
}

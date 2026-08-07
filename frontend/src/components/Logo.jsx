import { Link } from 'react-router-dom';

// MyIdea mark: a lightbulb with a flame inside (an idea that's on fire) on the
// brand gradient tile. Scales to any size via the `size` class.
export function LogoMark({ className = 'h-9 w-9' }) {
  return (
    <svg viewBox="0 0 100 100" className={`${className} shadow-glow rounded-[26%]`} role="img" aria-label="MyIdea">
      <defs>
        <linearGradient id="miLogoGrad" x1="8" y1="6" x2="92" y2="96" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ff9d2e" />
          <stop offset="0.5" stopColor="#ff3b30" />
          <stop offset="1" stopColor="#d6140c" />
        </linearGradient>
      </defs>
      <rect width="100" height="100" rx="26" fill="url(#miLogoGrad)" />
      <rect x="2.25" y="2.25" width="95.5" height="95.5" rx="23.75" fill="none" stroke="#fff" strokeOpacity="0.18" strokeWidth="1.5" />
      <g fill="#fff">
        <path d="M50 22C36 22 25 32 25 45C25 53 29 58.5 33 63C35.5 66 37 68 37.5 71L62.5 71C63 68 64.5 66 67 63C71 58.5 75 53 75 45C75 32 64 22 50 22Z" />
        <rect x="40.5" y="74.5" width="19" height="5.2" rx="2.6" />
        <rect x="43.5" y="82.5" width="13" height="4.6" rx="2.3" />
      </g>
      <path d="M50 33C47 40 44 43.5 44 49C44 54 47 57 50.5 57C54 57 56.5 54 56.5 49.2C56.5 46 55 44 52.8 41.6C51.8 44.2 50.8 45.2 49.2 46C50.6 42 50.6 37.2 50 33Z" fill="url(#miLogoGrad)" />
    </svg>
  );
}

export default function Logo({ to = '/', compact = false }) {
  return (
    <Link to={to} className="group flex items-center gap-2.5">
      <LogoMark className="h-9 w-9 transition-transform group-hover:scale-105" />
      {!compact && (
        <span className="font-display text-xl font-extrabold tracking-tight text-white">
          My<span className="gradient-text">Idea</span>
        </span>
      )}
    </Link>
  );
}

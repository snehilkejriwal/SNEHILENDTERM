import { Link } from 'react-router-dom';

// The SettleWise emblem: an interlocking geometric shield and resolution scale
export function Mark({ className = 'h-8 w-8', light = false }) {
  return (
    <span
      className={`${className} relative inline-flex items-center justify-center shrink-0 rounded-xl overflow-hidden shadow-sm transition-transform duration-300 group-hover:scale-110 ${
        light
          ? 'bg-gradient-to-br from-emerald-950 via-slate-950 to-midnight-800 ring-1 ring-emerald-400/40 shadow-[0_0_15px_rgba(16,185,129,0.35)]'
          : 'bg-gradient-to-br from-slate-900 via-emerald-950 to-midnight-800 text-white ring-1 ring-emerald-600/30 shadow-sm'
      }`}
      aria-hidden="true"
    >
      <svg viewBox="0 0 32 32" fill="none" className="h-[72%] w-[72%]" xmlns="http://www.w3.org/2000/svg">
        <path d="M16 3L27 9V17C27 23.5 22.3 27.8 16 29.5C9.7 27.8 5 23.5 5 17V9L16 3Z" stroke="#34D399" strokeWidth="2" strokeLinejoin="round" />
        <path d="M11 16.5L14.5 20L21 13.5" stroke="#FBBF24" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" />
        <circle cx="16" cy="9" r="1.5" fill="#FFFFFF" />
      </svg>
    </span>
  );
}

export default function Logo({ to = '/', light = false }) {
  return (
    <Link
      to={to}
      className={`group inline-flex items-center gap-2.5 transition-all ${light ? 'text-white' : 'text-ink'}`}
      aria-label="SettleWise home"
    >
      <Mark light={light} />
      <span className="text-[20px] tracking-tight">
        <span className="font-serif text-[25px] tracking-normal font-normal">Settle</span>
        <span className={`font-black ml-0.5 tracking-tight ${light ? 'text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 via-mint to-amber-300' : 'text-transparent bg-clip-text bg-gradient-to-r from-emerald-600 to-teal-600'}`}>Wise</span>
      </span>
    </Link>
  );
}

import { lazy, Suspense } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, ShieldCheck } from 'lucide-react';
import Logo from '../ui/Logo';
import { scrollToId } from '../ui/SmoothScroll';
import { useAuth } from '../../context/AuthContext';
import { useMedia } from '../../lib/useMedia';

const HeroScene = lazy(() => import('../three/HeroScene'));
const ease = [0.22, 1, 0.36, 1];

const LINES = [
  [['KNOW', 'serif'], ['WHAT', 'black']],
  [['THE LAW', 'serif'], ['SAYS', 'black']],
  [['IS', 'serif'], ['YOURS', 'black']],
];

const STEPS = [
  { title: 'Read', subtitle: 'Automated Extraction', text: 'Upload payslips, e-tickets, or tenancy contracts. Data is extracted into structured fields for your review.' },
  { title: 'Verify', subtitle: 'Statutory Engine', text: 'Tested against Code on Wages, DGCA passenger rules, and Model Tenancy regulations with citations.' },
  { title: 'Settle', subtitle: 'Recovery & Tracking', text: 'Get exact shortfall ledgers, signed legal notice PDFs, and live countdowns for portal escalation.' },
];

export default function Hero() {
  const { user } = useAuth();
  const startHref = user ? '/cases/new' : '/register';
  const show3d = useMedia('(min-width: 768px)');

  return (
    <section className="relative overflow-hidden">
      {/* Floating luminous emerald & gold ambient glow orbs */}
      <div className="pointer-events-none absolute -top-24 -left-24 w-[600px] h-[600px] rounded-full bg-gradient-to-br from-emerald-600/25 via-teal-500/15 to-transparent blur-3xl animate-pulse-slow" aria-hidden="true" />
      <div className="pointer-events-none absolute top-1/3 -right-24 w-[500px] h-[500px] rounded-full bg-gradient-to-bl from-amber-500/15 via-emerald-500/10 to-transparent blur-3xl animate-pulse-slow" style={{ animationDelay: '3s' }} aria-hidden="true" />

      <div className="relative min-h-svh flex flex-col justify-between">
        {/* Navigation header */}
        <header className="relative z-20 flex items-center justify-between gap-4 px-5 sm:px-8 pt-5">
          <Logo light />
          <nav className="hidden md:flex rounded-full p-1 text-sm bg-white/[0.06] backdrop-blur-xl border border-white/15 shadow-glass" aria-label="Sections">
            {[['how', 'How it works'], ['types', 'Case types'], ['trust', 'Why trust it']].map(([id, label]) => (
              <button key={id} onClick={() => scrollToId(id)} className="rounded-full px-4 py-2 text-white/80 hover:text-white hover:bg-white/15 transition">{label}</button>
            ))}
          </nav>
          <div className="flex items-center gap-2.5">
            {user ? (
              <Link to="/dashboard" className="btn-white">Your claims</Link>
            ) : (
              <>
                <Link to="/login" className="hidden sm:inline-flex btn text-white hover:bg-white/10">Log in</Link>
                <Link to="/register" className="btn-primary">
                  <span>Start a claim</span>
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </>
            )}
          </div>
        </header>

        {show3d && (
          <Suspense fallback={null}>
            <motion.div className="absolute inset-y-0 right-0 left-[38%] lg:left-[50%] z-0" initial={{ opacity: 0, scale: 0.94 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 1.4, ease, delay: 0.4 }}>
              <HeroScene className="h-full w-full opacity-50 lg:opacity-100" />
            </motion.div>
          </Suspense>
        )}

        {/* Hero content */}
        <div className="relative z-10 flex flex-col justify-center px-5 sm:px-8 lg:px-12 pt-16 pb-8 pointer-events-none">
          <motion.div className="eyebrow self-start mb-6 pointer-events-auto" initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease, delay: 0.1 }}>
            <span className="relative flex h-2 w-2">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
              <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-400" />
            </span>
            <span>Settlement Engine · Jobs · Flight Delays · Rental Security</span>
          </motion.div>

          <h1 className="w-full max-w-[min(100%,640px)]" aria-label="Know what the law says is yours">
            {LINES.map((line, i) => (
              <span key={i} className="block overflow-hidden pb-[0.12em]">
                <motion.span className="flex justify-between gap-[0.25em] text-[clamp(44px,6.2vw,96px)]" initial={{ y: '105%' }} animate={{ y: 0 }} transition={{ duration: 1.1, ease, delay: 0.15 + i * 0.12 }}>
                  {line.map(([w, style]) => <span key={w} className={`whitespace-nowrap ${style === 'serif' ? 'display-serif text-white/95' : 'display-black'} ${w === 'YOURS' ? 'text-aurora' : ''}`}>{w}</span>)}
                </motion.span>
              </span>
            ))}
          </h1>

          <motion.div className="mt-8 max-w-lg pointer-events-auto" initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.9, ease, delay: 0.75 }}>
            <p className="text-[17px] leading-relaxed text-white/80">
              Left your job and your final settlement looks incomplete? Flight delayed or cancelled without compensation? Landlord withheld your rental deposit? <strong className="text-emerald-300 font-semibold">SettleWise</strong> verifies your records against statutory rules, calculates exact amounts due with complete ledger breakdown, drafts formal notice letters, and tracks escalation timelines.
            </p>
            <div className="mt-7 flex flex-wrap items-center gap-3.5">
              <Link to={startHref} className="btn-primary h-12 px-7 font-semibold">
                <ShieldCheck className="h-4 w-4" />
                <span>Start a claim</span>
              </Link>
              <button onClick={() => scrollToId('how')} className="btn h-12 px-6 text-white bg-white/5 border border-white/20 backdrop-blur-md hover:bg-white/10 hover:border-white/40 transition">
                See how it works
              </button>
            </div>
            <p className="mt-4 text-xs text-white/50">Guidance, not legal advice. Calculations rely on confirmed factual inputs.</p>
          </motion.div>
        </div>

        {/* Step overview banner */}
        <motion.div className="relative z-10 mx-5 sm:mx-8 lg:mx-12 mb-6 pointer-events-auto" initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 1, delay: 0.9 }}>
          <ol className="grid sm:grid-cols-3 gap-3 p-3 rounded-2xl border border-white/15 bg-white/[0.04] backdrop-blur-xl shadow-glass">
            {STEPS.map((s, i) => (
              <li key={s.title} className="rounded-xl p-4 transition-colors hover:bg-white/[0.05] border border-transparent hover:border-emerald-400/20">
                <div className="flex items-center gap-2">
                  <span className="grid h-6 w-6 place-items-center rounded-full bg-emerald-500/25 text-[11px] font-bold text-emerald-300 tabular">0{i + 1}</span>
                  <p className="font-serif text-[24px] text-white leading-none">{s.title}</p>
                </div>
                <p className="text-xs font-semibold text-emerald-400 mt-2 uppercase tracking-wider">{s.subtitle}</p>
                <p className="text-xs text-white/65 mt-1 leading-relaxed">{s.text}</p>
              </li>
            ))}
          </ol>
        </motion.div>
      </div>
    </section>
  );
}

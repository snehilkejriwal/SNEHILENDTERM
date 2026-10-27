import { Link } from 'react-router-dom';
import { motion, useReducedMotion } from 'framer-motion';
import { Mail, Sparkles } from 'lucide-react';
import Logo from '../ui/Logo';
import { scrollToId } from '../ui/SmoothScroll';

const ease = [0.22, 1, 0.36, 1];

export default function Closing() {
  const reduce = useReducedMotion();
  const rise = (i) => (reduce ? {} : { initial: { y: '100%' }, whileInView: { y: 0 }, viewport: { once: true, margin: '-80px' }, transition: { duration: 1, ease, delay: i * 0.1 } });
  const fade = (d) => (reduce ? {} : { initial: { opacity: 0, y: 14 }, whileInView: { opacity: 1, y: 0 }, viewport: { once: true, margin: '-60px' }, transition: { duration: 0.8, ease, delay: d } });

  return (
    <section className="border-t border-white/[0.08] relative overflow-hidden">
      {/* Ambient background glows */}
      <div className="pointer-events-none absolute -bottom-20 left-1/2 -translate-x-1/2 w-[700px] h-[350px] rounded-full bg-gradient-to-t from-emerald-600/20 via-teal-500/10 to-transparent blur-3xl animate-pulse-slow" aria-hidden="true" />

      <div className="relative px-6 sm:px-12 pt-28 sm:pt-36 pb-12 overflow-hidden z-10">
        <div className="relative text-center">
          <motion.div className="eyebrow" {...fade(0)}>
            <Sparkles className="h-3.5 w-3.5 text-emerald-400" />
            <span>Statutory Rights Backed by Legal Precision</span>
          </motion.div>
          <h2 aria-label="Your rights, in writing" className="mt-8 text-[clamp(48px,9.5vw,152px)] leading-none">
            <span className="block overflow-hidden pb-[0.1em]">
              <motion.span className="flex items-baseline justify-center gap-[0.22em]" {...rise(0)}>
                <span className="display-serif">YOUR</span>
                <span className="display-black text-aurora pb-[0.08em]">RIGHTS,</span>
              </motion.span>
            </span>
            <span className="block overflow-hidden pb-[0.2em]">
              <motion.span className="flex items-baseline justify-center gap-[0.22em]" {...rise(1)}>
                <span className="display-black">IN</span>
                <span className="display-serif italic normal-case tracking-normal text-white/90">writing.</span>
              </motion.span>
            </span>
          </h2>
          <motion.p className="mx-auto mt-8 max-w-xl text-lg leading-relaxed text-white/70" {...fade(0.2)}>
            Questions about our deterministic rule engine, suggestions for new statutory case packs, or partnership inquiries: we would love to connect.
          </motion.p>
          <motion.div className="mt-9 flex justify-center" {...fade(0.3)}>
            <Link to="/contact" className="btn-primary h-12 px-9 font-semibold text-base shadow-brand">
              <Mail className="h-4 w-4" />
              <span>Contact us</span>
            </Link>
          </motion.div>
        </div>

        <footer className="relative mt-28 pt-8 border-t border-white/10 grid gap-8 text-sm sm:grid-cols-[1.4fr_1fr_1fr]">
          <div>
            <Logo light />
            <p className="mt-4 text-white/50 max-w-sm leading-relaxed text-xs">
              SettleWise provides statutory computation models and legal escalation guidance, not formal advocate representation. Check every figure against your source documents before dispatching letters.
            </p>
          </div>
          <nav aria-label="Footer">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-emerald-400">Platform</p>
            <ul className="mt-3 space-y-2">
              {[['how', 'How it works'], ['types', 'Case types'], ['trust', 'Why trust it']].map(([id, label]) => (
                <li key={id}><button onClick={() => scrollToId(id)} className="text-white/70 hover:text-white transition-colors">{label}</button></li>
              ))}
              <li><Link to="/contact" className="text-white/70 hover:text-white transition-colors">Contact us</Link></li>
            </ul>
          </nav>
          <div className="sm:text-right">
            <p className="text-xs font-semibold uppercase tracking-[0.18em] text-amber-400">Engineering</p>
            <p className="mt-3 text-white/90 font-medium text-base">SNEHIL</p>
            <p className="text-white/50 text-xs mt-0.5">SettleWise MERN Platform</p>
            <p className="text-emerald-400/80 text-xs mt-1">MongoDB · Express · React · Node</p>
          </div>
        </footer>
      </div>
    </section>
  );
}

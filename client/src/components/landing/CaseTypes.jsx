import { lazy, Suspense, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { usePacks } from '../../api/hooks';
import { useAuth } from '../../context/AuthContext';
import { Briefcase, Plane, KeyRound } from 'lucide-react';
import { useMedia } from '../../lib/useMedia';

const CaseObject = lazy(() => import('../three/CaseObject'));
const ICONS = { employment: Briefcase, flight: Plane, rent: KeyRound };

// Shown if the API is still waking up, so the landing page never looks empty.
const FALLBACK = [
  { key: 'employment', name: 'Job exit and final settlement', tagline: 'Left a job and your dues are late or short?', status: 'live' },
  { key: 'flight', name: 'Cancelled, delayed or overbooked flight', tagline: 'Airline offered only a refund, or nothing?', status: 'live' },
  { key: 'rent', name: 'Deposit not returned', tagline: 'Landlord kept your deposit?', status: 'live' },
];

export default function CaseTypes() {
  const { data } = usePacks();
  const { user } = useAuth();
  const packs = data?.length ? data : FALLBACK;
  return (
    <section id="types" className="border-t border-white/[0.08]">
      <div className="px-6 sm:px-12 py-20 sm:py-28">
        <div className="max-w-3xl">
          <h2 className="font-serif text-[clamp(44px,6.5vw,96px)] leading-[0.92]">Pick what happened to you</h2>
          <p className="mt-5 text-lg text-white/60 max-w-xl">Each kind of case is a pack of rules, calculations and letters, ready to use today.</p>
        </div>
        <ul className="mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-3">
          {packs.map((p, i) => {
            const href = user ? `/cases/new?pack=${p.key}` : `/register?next=${encodeURIComponent(`/cases/new?pack=${p.key}`)}`;
            return (
              <motion.li key={p.key} initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-60px' }} transition={{ duration: 0.7, delay: i * 0.08, ease: [0.22, 1, 0.36, 1] }}>
                <CaseCard pack={p} href={href} />
              </motion.li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}

const HOVER_GLOW = {
  employment: 'hover:border-emerald-400/50 hover:shadow-[0_12px_40px_-8px_rgba(16,185,129,0.35)]',
  flight: 'hover:border-sky-400/50 hover:shadow-[0_12px_40px_-8px_rgba(2,132,199,0.35)]',
  rent: 'hover:border-amber-400/50 hover:shadow-[0_12px_40px_-8px_rgba(245,158,11,0.35)]',
};

const SCENE_BG = {
  employment: 'bg-[radial-gradient(55%_65%_at_50%_45%,rgba(16,185,129,.25),rgba(4,120,87,.08)_70%)]',
  flight: 'bg-[radial-gradient(55%_65%_at_50%_45%,rgba(2,132,199,.25),rgba(8,47,73,.08)_70%)]',
  rent: 'bg-[radial-gradient(55%_65%_at_50%_45%,rgba(245,158,11,.25),rgba(120,53,15,.08)_70%)]',
};

function CaseCard({ pack, href }) {
  const [hovered, setHovered] = useState(false);
  const live = pack.status === 'live';
  // Four small 3D scenes are fine on a desktop; phones get a flat icon instead.
  const show3d = useMedia('(min-width: 768px)');
  const Icon = ICONS[pack.key] || Briefcase;
  const glow = HOVER_GLOW[pack.key] || 'hover:border-white/40';
  const sceneBg = SCENE_BG[pack.key] || 'bg-[radial-gradient(55%_65%_at_50%_45%,rgba(255,255,255,.16),rgba(255,255,255,.03)_70%)]';
  const icon = <div className="absolute inset-0 grid place-items-center"><Icon className={`h-12 w-12 ${live ? 'text-white' : 'text-white/40'}`} strokeWidth={1.25} /></div>;
  const body = (
    <>
      <div className={`relative -mx-2 -mt-2 h-40 rounded-[18px] ${sceneBg} overflow-hidden border border-white/10`}>
        {show3d ? (
          <Suspense fallback={icon}>
            <CaseObject packKey={pack.key} hovered={hovered} muted={!live} className="absolute inset-0" />
          </Suspense>
        ) : icon}
        <span className={`absolute top-3 right-3 rounded-full px-2.5 py-1 text-[11px] font-semibold flex items-center gap-1.5 ${live ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-400/30' : 'bg-white/10 text-white/60'}`}>
          {live && <span className="h-1.5 w-1.5 rounded-full bg-emerald-400 animate-pulse" />}
          {live ? 'Statutory Live' : 'Coming soon'}
        </span>
      </div>
      <h3 className="mt-6 font-serif text-[28px] leading-[1.04] text-white">{pack.name}</h3>
      <p className="mt-2 text-white/60 text-sm leading-relaxed">{pack.tagline}</p>
      <p className={`mt-6 text-sm font-semibold flex items-center gap-1 transition-all ${live ? 'text-sky-400 group-hover:text-sky-300' : 'text-white/40'}`}>
        {live ? 'Start this claim →' : 'Coming soon'}
      </p>
    </>
  );
  const hover = { onMouseEnter: () => setHovered(true), onMouseLeave: () => setHovered(false) };
  return live ? (
    <Link to={href} {...hover} onFocus={() => setHovered(true)} onBlur={() => setHovered(false)} className={`group block h-full rounded-[24px] bg-white/[0.04] border border-white/10 backdrop-blur-md p-4 pb-7 transition duration-300 hover:-translate-y-1.5 ${glow} hover:bg-white/[0.07]`}>{body}</Link>
  ) : (
    <div {...hover} className="h-full rounded-[24px] bg-white/[0.015] border border-white/[0.06] p-4 pb-7" aria-disabled="true">{body}</div>
  );
}

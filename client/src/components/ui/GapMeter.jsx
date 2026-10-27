import { motion, useInView, animate, useReducedMotion } from 'framer-motion';
import { useEffect, useRef, useState } from 'react';
import { inr } from '../../lib/format';

function CountUp({ value, start }) {
  const [n, setN] = useState(0);
  const reduce = useReducedMotion();
  useEffect(() => {
    if (!start) return undefined;
    if (reduce) { setN(value); return undefined; }
    const c = animate(0, value, { duration: 1.4, ease: [0.22, 1, 0.36, 1], onUpdate: setN });
    return () => c.stop();
  }, [value, start, reduce]);
  return <span className="tabular">{inr(n)}</span>;
}

// Offered vs owed, drawn as two bars on one scale. The gap is the product's whole point.
export default function GapMeter({ offered = 0, owed = 0, owedLabel, dark = false }) {
  const ref = useRef(null);
  const inView = useInView(ref, { once: true, margin: '-80px' });
  const max = Math.max(owed, offered, 1);
  const gap = owed - offered;
  const muted = dark ? 'text-white/60' : 'text-steel';
  return (
    <div ref={ref}>
      <div className="flex items-end justify-between gap-6">
        <div>
          <p className={`text-sm ${muted}`}>{gap > 0 ? 'Estimated shortfall' : 'No shortfall found'}</p>
          <p className="font-serif text-[clamp(44px,7vw,84px)] leading-none mt-1"><CountUp value={Math.max(0, gap)} start={inView} /></p>
        </div>
      </div>
      <div className="mt-6 space-y-3">
        {[
          { label: 'Offered or paid', value: offered, color: dark ? 'bg-white/30' : 'bg-slate-400/40' },
          { label: owedLabel || 'Estimated due under the rules', value: owed, color: dark ? 'bg-gradient-to-r from-emerald-400 via-teal-400 to-amber-300 shadow-[0_0_12px_rgba(16,185,129,0.7)]' : 'bg-gradient-to-r from-emerald-600 to-teal-500' },
        ].map((row, i) => (
          <div key={row.label}>
            <div className={`flex justify-between text-sm mb-1.5 ${muted}`}><span>{row.label}</span><span className="tabular font-medium">{inr(row.value)}</span></div>
            <div className={`h-3 rounded-full ${dark ? 'bg-white/10' : 'bg-mist'} overflow-hidden`}>
              <motion.div className={`h-full rounded-full ${row.color}`} initial={{ width: 0 }} animate={{ width: inView ? `${(row.value / max) * 100}%` : 0 }} transition={{ duration: 1.2, delay: 0.15 * i, ease: [0.22, 1, 0.36, 1] }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

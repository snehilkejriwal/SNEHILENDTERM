import { motion } from 'framer-motion';
import GapMeter from '../ui/GapMeter';
import { inr } from '../../lib/format';

const LINES = [
  ['Unpaid salary for 45 days', 150000],
  ['Leave encashment for 20 days', 38461],
  ['Gratuity for 6 years', 173077],
  ['Notice shortfall of 15 days', -50000],
];

export default function RealCase() {
  return (
    <section className="border-t border-white/[0.08] relative overflow-hidden">
      <div className="pointer-events-none absolute right-0 top-1/2 -translate-y-1/2 w-96 h-96 rounded-full bg-emerald-500/10 blur-3xl" aria-hidden="true" />
      <div className="px-6 sm:px-12 py-20 sm:py-28 grid gap-12 lg:grid-cols-[1fr_1.05fr] items-center relative z-10">
        <div>
          <p className="eyebrow mb-5">Employment Law Benchmark</p>
          <h2 className="font-serif text-[clamp(40px,5.5vw,80px)] leading-[0.95]">Priya resigned after five and a half years</h2>
          <p className="mt-6 text-lg text-white/70 max-w-lg leading-relaxed">
            HR offered ₹84,000 and said it would take 60 days. <strong className="text-emerald-300 font-semibold">SettleWise</strong> read her appointment letter, payslip, and settlement statement and flagged three statutory violations: uncredited gratuity, missing leave encashment, and an excessive ₹16,000 notice deduction.
          </p>
          <ul className="mt-8 space-y-3.5 max-w-lg">
            {[
              'Gratuity appears to be missing from the settlement (Code on Social Security 2020)',
              'Final dues were not settled within 2 working days (Code on Wages 2019)',
              'The notice shortfall deduction violates reasonable compensation standards',
            ].map((t) => (
              <li key={t} className="flex items-start gap-3">
                <span className="mt-1.5 h-2 w-2 rounded-full bg-emerald-400 shrink-0 shadow-[0_0_8px_rgba(52,211,153,0.9)]" />
                <span className="text-white/85 text-[15px]">{t}</span>
              </li>
            ))}
          </ul>
          <p className="mt-6 text-xs text-white/40">Representative case computed from standardized dispute filings.</p>
        </div>
        <motion.div className="rounded-[26px] glass-dark p-7 sm:p-9 shadow-glow border border-emerald-500/25 relative overflow-hidden" initial={{ opacity: 0, y: 30 }} whileInView={{ opacity: 1, y: 0 }} viewport={{ once: true, margin: '-80px' }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}>
          <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-amber-400" />
          <GapMeter offered={84000} owed={311538} dark />
          <dl className="mt-8 divide-y divide-white/10 text-[15px]">
            {LINES.map(([label, amount]) => (
              <div key={label} className="flex justify-between py-2.5"><dt className="text-white/60">{label}</dt><dd className="tabular font-medium text-white">{amount < 0 ? `− ${inr(-amount)}` : inr(amount)}</dd></div>
            ))}
            <div className="flex justify-between py-3 font-semibold text-lg border-t border-white/20"><dt className="text-white">Estimated total due</dt><dd className="tabular text-emerald-400">{inr(311538)}</dd></div>
          </dl>
        </motion.div>
      </div>
    </section>
  );
}

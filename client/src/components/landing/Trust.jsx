const ROW_A = [
  ['Gratuity appears to be missing', 'Code on Social Security, 2020, s.53'],
  ['Final dues were not paid within 2 working days', 'Code on Wages, 2019, s.17(2)'],
  ['Cancellation compensation may be due', 'DGCA CAR Section 3, Series M, Part IV'],
  ['The notice deduction looks too high', 'Indian Contract Act, 1872, s.74'],
  ['At least half your pay counts as wages', 'Code on Wages, 2019, s.2(y)'],
  ['Damage was deducted without proof', 'Your rental agreement; Indian Contract Act, 1872, s.73'],
];
const ROW_B = [
  ['Denied boarding compensation may be due', 'DGCA CAR, para 3.5'],
  ['Your non-compete may not be enforceable', 'Indian Contract Act, 1872, s.27'],
  ['Meals may have been owed during the delay', 'DGCA CAR, para 3.8'],
  ['Fixed-term gratuity after one year', 'Code on Social Security, 2020, s.53(1)'],
  ['A full refund may be due', 'DGCA CAR Section 3, Series M, Part IV'],
  ['Repainting may be normal wear and tear', 'Your rental agreement'],
];

function Row({ items, reverse }) {
  const doubled = [...items, ...items];
  return (
    <div className="overflow-hidden">
      <div className={`marquee ${reverse ? 'marquee-reverse' : ''} gap-4 py-2`}>
        {doubled.map(([title, cite], i) => (
          <div key={i} className="glass-dark rounded-2xl px-6 py-5 w-[360px] shrink-0 border border-emerald-500/15 hover:border-emerald-400/40 transition-colors">
            <p className="text-white text-[16px] font-medium leading-snug">{title}</p>
            <p className="text-emerald-300/85 text-xs mt-3 font-mono tracking-tight flex items-center gap-1.5">
              <span className="text-amber-400 font-bold">§</span>
              <span>{cite}</span>
            </p>
          </div>
        ))}
      </div>
    </div>
  );
}

// Dark interlude: real findings scroll past, behind the one idea that matters.
export default function Trust() {
  return (
    <section id="trust" className="border-t border-white/[0.08] relative overflow-hidden">
      <div className="relative py-20 sm:py-28">
        <div className="space-y-4 opacity-60" aria-hidden="true">
          <Row items={ROW_A} />
          <Row items={ROW_B} reverse />
          <Row items={[...ROW_A].reverse()} />
        </div>
        <div className="absolute inset-0 grid place-items-center px-6 pointer-events-none">
          <div className="text-center max-w-3xl bg-midnight/85 backdrop-blur-xl border border-emerald-400/30 shadow-[0_0_50px_rgba(16,185,129,0.22)] rounded-[32px] px-6 sm:px-12 py-10 pointer-events-auto relative overflow-hidden">
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-emerald-400 via-teal-400 to-amber-400" />
            <p className="eyebrow mb-4">Statutory Determinism</p>
            <h2 className="font-serif text-[clamp(48px,8vw,120px)] leading-[0.9]">Rules, <span className="text-aurora">not guesses</span></h2>
            <p className="mt-6 text-lg text-white/80 max-w-xl mx-auto leading-relaxed">
              AI only reads your documents, and you confirm what it found. Every finding comes from a codified statutory rule citing the exact Act and section, so you can verify it yourself.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}

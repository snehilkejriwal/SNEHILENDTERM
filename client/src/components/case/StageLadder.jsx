import { Check } from 'lucide-react';

export default function StageLadder({ stages, stageIndex, status }) {
  const finished = status === 'resolved' || status === 'closed';
  return (
    <ol className="grid gap-3 md:grid-cols-3" aria-label="Escalation stages">
      {stages.map((s, i) => {
        const done = i < stageIndex || (finished && i === stageIndex);
        const current = i === stageIndex && !finished;
        return (
          <li key={s.key} className={`rounded-2xl border p-4 transition-all ${current ? 'border-emerald-600 bg-white shadow-brand ring-2 ring-emerald-500/20' : done ? 'border-emerald-200 bg-emerald-50/50' : 'border-dashed border-line bg-white/40'}`} aria-current={current ? 'step' : undefined}>
            <div className="flex items-center gap-2.5">
              <span className={`h-7 w-7 rounded-full grid place-items-center text-xs font-bold ${done ? 'bg-emerald-600 text-white shadow-sm' : current ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white shadow-brand' : 'bg-slate-200 text-steel'}`}>
                {done ? <Check className="h-4 w-4 stroke-[2.5]" /> : i + 1}
              </span>
              <p className={`font-semibold ${current ? 'text-emerald-950 font-bold' : done ? 'text-emerald-900' : 'text-steel'}`}>{s.label}</p>
            </div>
            <p className="text-xs text-steel mt-2 font-medium">{s.recipient}</p>
          </li>
        );
      })}
    </ol>
  );
}

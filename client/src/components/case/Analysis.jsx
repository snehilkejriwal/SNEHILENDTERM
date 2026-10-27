import { motion } from 'framer-motion';
import GapMeter from '../ui/GapMeter';
import { inr, SEVERITY } from '../../lib/format';

export function Findings({ findings }) {
  if (!findings?.length) return <p className="text-steel">No issues were found with these facts.</p>;
  return (
    <ul className="space-y-3">
      {findings.map((f, i) => {
        const s = SEVERITY[f.severity] || SEVERITY.info;
        return (
          <motion.li key={f.code} className={`rounded-2xl border ${s.ring} bg-white p-5`} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: i * 0.06 }}>
            <div className="flex items-center gap-2 text-xs font-semibold text-steel"><span className={`h-2 w-2 rounded-full ${s.dot}`} />{s.label}</div>
            <h3 className="mt-2 text-lg font-semibold">{f.title}</h3>
            <p className="mt-1 text-ink/80 leading-relaxed">{f.message}</p>
            <p className="mt-3 text-sm text-steel">{f.citation}</p>
          </motion.li>
        );
      })}
    </ul>
  );
}

export function Calculation({ calc }) {
  return (
    <div>
      <GapMeter offered={calc.offered} owed={calc.owed} owedLabel={calc.owedLabel} />
      <table className="mt-8 w-full text-[15px]">
        <caption className="sr-only">How the amount was calculated</caption>
        <tbody className="divide-y divide-line">
          {calc.items.map((it) => (
            <tr key={it.key}>
              <th scope="row" className="py-3 text-left font-normal">
                {it.label}
                {it.note && <span className="block text-xs text-steel mt-0.5">{it.note}</span>}
              </th>
              <td className={`py-3 text-right tabular font-medium ${it.kind === 'debit' ? 'text-crimson' : ''}`}>{it.kind === 'debit' ? `− ${inr(it.amount)}` : inr(it.amount)}</td>
            </tr>
          ))}
          <tr><th scope="row" className="py-3 text-left">{calc.owedLabel || 'Estimated total due'}</th><td className="py-3 text-right tabular font-semibold">{inr(calc.owed)}</td></tr>
          <tr><th scope="row" className="py-3 text-left font-normal text-steel">Offered or paid</th><td className="py-3 text-right tabular text-steel">{inr(calc.offered)}</td></tr>
        </tbody>
      </table>
      {calc.notes?.length > 0 && (
        <ul className="mt-5 space-y-1.5 text-sm text-steel">
          {calc.notes.map((n) => <li key={n}>{n}</li>)}
        </ul>
      )}
    </div>
  );
}

import { inr, date, dateTime } from '../../lib/format';

function show(f, v) {
  if (v === undefined || v === null || v === '') return '—';
  if (f.type === 'boolean') return v ? 'Yes' : 'No';
  if (f.type === 'date') return date(v);
  if (f.type === 'datetime') return dateTime(v);
  if (f.type === 'enum') return f.options.find((o) => o.value === v)?.label || v;
  if (f.unit === 'INR') return inr(v);
  if (f.type === 'number' && f.unit) return `${v} ${f.unit}`;
  return String(v);
}

export default function FactsSummary({ pack, facts }) {
  return (
    <dl className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-3 text-sm">
      {pack.factSchema.filter((f) => facts?.[f.key] !== undefined).map((f) => (
        <div key={f.key} className="border-b border-line/70 pb-2.5">
          <dt className="text-steel">{f.label}</dt>
          <dd className="font-medium mt-0.5 tabular">{show(f, facts[f.key])}</dd>
        </div>
      ))}
    </dl>
  );
}

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AlertCircle, ChevronDown } from 'lucide-react';
import { useUpdateFacts, useTransition } from '../../api/hooks';
import { errorMessage, fieldErrors } from '../../api/client';
import { Spinner } from '../ui/Feedback';
import { evaluate } from '../../lib/conditions';

const pad = (n) => String(n).padStart(2, '0');
const toLocalInput = (iso) => { if (!iso) return ''; const d = new Date(iso); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`; };

function toForm(schema, facts) {
  const v = {};
  for (const f of schema) {
    const x = facts?.[f.key];
    if (x === undefined || x === null) v[f.key] = '';
    else if (f.type === 'date') v[f.key] = String(x).slice(0, 10);
    else if (f.type === 'datetime') v[f.key] = toLocalInput(x);
    else if (f.type === 'boolean') v[f.key] = x ? 'yes' : 'no';
    else v[f.key] = String(x);
  }
  return v;
}

function fromForm(schema, values) {
  const out = {};
  for (const f of schema) {
    const x = values[f.key];
    if (x === '' || x === undefined) { out[f.key] = null; continue; }
    if (f.type === 'boolean') out[f.key] = x === 'yes';
    else if (f.type === 'number') out[f.key] = Number(x);
    else if (f.type === 'datetime') out[f.key] = new Date(x).toISOString();
    else out[f.key] = x;
  }
  return out;
}

function Input({ field, value, onChange, invalid }) {
  const common = { id: field.key, 'aria-invalid': invalid || undefined };
  if (field.type === 'enum') {
    return (
      <select {...common} className="field" value={value} onChange={(e) => onChange(e.target.value)}>
        <option value="">Choose</option>
        {field.options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
      </select>
    );
  }
  if (field.type === 'boolean') {
    return (
      <div className="inline-flex rounded-xl border border-line bg-white p-1" role="radiogroup" aria-labelledby={`${field.key}-l`}>
        {[['yes', 'Yes'], ['no', 'No']].map(([v, l]) => (
          // Clicking the selected answer again clears it.
          <button type="button" key={v} role="radio" aria-checked={value === v} onClick={() => onChange(value === v ? '' : v)} className={`px-3.5 h-9 rounded-lg text-sm transition ${value === v ? 'bg-ink text-white' : 'text-steel hover:bg-frost'}`}>{l}</button>
        ))}
      </div>
    );
  }
  const type = { number: 'number', date: 'date', datetime: 'datetime-local' }[field.type] || 'text';
  return (
    <div className="relative">
      {field.unit === 'INR' && <span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-steel">₹</span>}
      <input {...common} type={type} min={type === 'number' ? 0 : undefined} step={type === 'number' ? 'any' : undefined} inputMode={type === 'number' ? 'decimal' : undefined}
        className={`field ${field.unit === 'INR' ? 'pl-8' : ''}`} value={value} onChange={(e) => onChange(e.target.value)} />
      {field.unit && field.unit !== 'INR' && <span className="absolute right-3.5 top-1/2 -translate-y-1/2 text-sm text-steel">{field.unit}</span>}
    </div>
  );
}

export default function FactsForm({ caseData, pack }) {
  const schema = pack.factSchema;
  const update = useUpdateFacts(caseData.id);
  const transition = useTransition(caseData.id);
  const [values, setValues] = useState(() => toForm(schema, caseData.facts));
  const [errors, setErrors] = useState({});
  const [dirty, setDirty] = useState(false);
  const low = new Set(caseData.extraction?.lowConfidence || []);

  // When documents fill facts in, show them straight away. If the user has unsaved edits,
  // only fill the boxes that are still empty so nothing they typed is lost.
  useEffect(() => {
    const fresh = toForm(schema, caseData.facts);
    setValues((v) => {
      if (!dirty) return fresh;
      const merged = { ...v };
      for (const [k, val] of Object.entries(fresh)) if (merged[k] === '' && val !== '') merged[k] = val;
      return merged;
    });
  }, [caseData.facts, schema]); // eslint-disable-line react-hooks/exhaustive-deps
  const fromDocs = new Set(caseData.extraction?.filled || []);
  const savedForm = useMemo(() => toForm(schema, caseData.facts), [schema, caseData.facts]);

  // Only the questions that apply to the answers so far; recomputed as the user types.
  const visible = useMemo(() => {
    const facts = fromForm(schema, values);
    return schema.filter((f) => evaluate(f.showIf, facts));
  }, [schema, values]);
  const visibleKeys = useMemo(() => new Set(visible.map((f) => f.key)), [visible]);
  const advanced = visible.filter((f) => f.advanced);

  const groups = useMemo(() => {
    const g = new Map();
    for (const f of visible) {
      if (f.advanced) continue;
      if (!g.has(f.group)) g.set(f.group, []);
      g.get(f.group).push(f);
    }
    return [...g.entries()];
  }, [visible]);

  // Optional details start closed, but open by themselves once any of them has an answer.
  const advancedFilled = advanced.some((f) => values[f.key] !== '');
  const [showAdvanced, setShowAdvanced] = useState(advancedFilled);
  useEffect(() => { if (advancedFilled) setShowAdvanced(true); }, [advancedFilled]);

  const set = (k) => (v) => { setValues((s) => ({ ...s, [k]: v })); setErrors((e) => ({ ...e, [k]: undefined })); setDirty(true); };

  const save = async () => {
    try {
      // Answers to questions that no longer apply are cleared, so they cannot affect the result.
      const facts = fromForm(schema, values);
      for (const f of schema) if (!visibleKeys.has(f.key)) facts[f.key] = null;
      await update.mutateAsync({ facts });
      setDirty(false);
      return true;
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
      return false;
    }
  };

  const confirm = async () => {
    const missing = visible.filter((f) => f.required && values[f.key] === '');
    if (missing.some((f) => f.advanced)) setShowAdvanced(true);
    if (missing.length) {
      setErrors(Object.fromEntries(missing.map((f) => [f.key, 'Required'])));
      document.getElementById(missing[0].key)?.focus();
      return toast.error(`Fill in ${missing.length} required fact${missing.length > 1 ? 's' : ''} first.`);
    }
    if (dirty && !(await save())) return;
    try {
      await transition.mutateAsync({ action: 'confirm' });
      toast.success('Facts confirmed');
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    }
  };

  const required = visible.filter((f) => f.required);
  const requiredFilled = required.filter((f) => values[f.key] !== '').length;

  const renderField = (f) => (
    <div key={f.key} className={low.has(f.key) ? 'rounded-xl ring-2 ring-marigold/60 ring-offset-4 ring-offset-white' : ''}>
      <label htmlFor={f.key} id={`${f.key}-l`} className="label flex items-center gap-1.5">
        {f.label}{f.required && <><span className="h-1.5 w-1.5 rounded-full bg-crimson" aria-hidden="true" /><span className="sr-only">(required)</span></>}
        {fromDocs.has(f.key) && values[f.key] !== '' && values[f.key] === savedForm[f.key] && (
          <span className="ml-auto text-[11px] font-semibold text-emerald">From your documents</span>
        )}
      </label>
      <Input field={f} value={values[f.key]} onChange={set(f.key)} invalid={Boolean(errors[f.key])} />
      {errors[f.key] ? <p className="mt-1 text-sm text-crimson">{errors[f.key]}</p> : f.help && <p className="mt-1 text-xs text-steel">{f.help}</p>}
    </div>
  );

  return (
    <section className="card p-6 sm:p-8" aria-labelledby="facts-h">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h2 id="facts-h" className="font-serif text-3xl">Check the facts</h2>
          <p className="text-steel text-sm mt-1">Everything SettleWise concludes depends on these. Fields marked with a dot are required.</p>
        </div>
        <p className="text-sm text-steel tabular" aria-live="polite">{requiredFilled} of {required.length} required filled</p>
      </div>
      {caseData.extraction?.source === 'ai' && low.size > 0 && (
        <p className="mt-5 flex items-start gap-2 rounded-xl bg-marigold/10 text-[#7A4E0E] px-4 py-3 text-sm">
          <AlertCircle className="h-4 w-4 mt-0.5 shrink-0" />The highlighted facts were inferred rather than read directly. Check them against your documents.
        </p>
      )}
      <div className="mt-6 space-y-8">
        {groups.map(([group, fields]) => (
          <fieldset key={group}>
            <legend className="font-semibold mb-4">{group}</legend>
            <div className="grid sm:grid-cols-2 gap-x-5 gap-y-4">
              {fields.map(renderField)}
            </div>
          </fieldset>
        ))}
        {advanced.length > 0 && (
          <details open={showAdvanced} onToggle={(e) => setShowAdvanced(e.currentTarget.open)} className="group rounded-2xl border border-line">
            <summary className="flex cursor-pointer list-none items-center justify-between gap-3 rounded-2xl px-5 py-4 font-semibold [&::-webkit-details-marker]:hidden">
              <span>Optional details <span className="ml-1 font-normal text-sm text-steel">{advanced.length} more question{advanced.length > 1 ? 's' : ''}</span></span>
              <ChevronDown className="h-4 w-4 text-steel transition-transform group-open:rotate-180" aria-hidden="true" />
            </summary>
            <div className="grid sm:grid-cols-2 gap-x-5 gap-y-4 px-5 pb-5 pt-1">
              {advanced.map(renderField)}
            </div>
          </details>
        )}
      </div>
      <div className="mt-8 flex flex-wrap gap-2 sticky bottom-4 z-10 w-fit bg-white border border-line shadow-lift rounded-full p-1.5">
        <button type="button" className="btn-ghost bg-white" onClick={async () => (await save()) && toast.success('Facts saved')} disabled={update.isPending || !dirty}>
          {update.isPending && <Spinner />}Save draft
        </button>
        <button type="button" className="btn-ink" onClick={confirm} disabled={transition.isPending || update.isPending}>
          {transition.isPending && <Spinner />}Confirm facts
        </button>
      </div>
    </section>
  );
}

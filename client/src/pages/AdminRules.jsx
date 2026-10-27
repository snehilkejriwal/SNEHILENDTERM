import { useState } from 'react';
import { toast } from 'sonner';
import { Plus } from 'lucide-react';
import Page from '../components/ui/Page';
import AppShell from '../components/ui/AppShell';
import { Skeleton, ErrorState, Modal, Spinner } from '../components/ui/Feedback';
import { useRules, useSaveRule, useAdminOverview, usePacks } from '../api/hooks';
import { errorMessage, fieldErrors } from '../api/client';
import { SEVERITY, date } from '../lib/format';

const EMPTY = { packKey: 'employment', code: '', title: '', message: '', citation: '', severity: 'medium', condition: '{\n  "fact": "gapAmount",\n  "op": "gt",\n  "value": 0\n}', effectiveFrom: '', effectiveTo: '', active: true };

function RuleForm({ initial, onDone }) {
  const save = useSaveRule();
  const { data: packs } = usePacks();
  const [v, setV] = useState(initial);
  const [errors, setErrors] = useState({});
  const isNew = !initial.id;
  const set = (k) => (e) => setV((s) => ({ ...s, [k]: e.target.type === 'checkbox' ? e.target.checked : e.target.value }));

  const submit = async (e) => {
    e.preventDefault();
    let condition;
    try { condition = JSON.parse(v.condition); } catch { return setErrors({ condition: 'Condition must be valid JSON.' }); }
    const body = { title: v.title, message: v.message, citation: v.citation, severity: v.severity, condition, active: v.active, effectiveFrom: v.effectiveFrom || null, effectiveTo: v.effectiveTo || null };
    try {
      await save.mutateAsync(isNew ? { ...body, packKey: v.packKey, code: v.code } : { id: v.id, ...body });
      toast.success(isNew ? 'Rule created' : 'Rule saved');
      onDone();
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    }
  };

  const err = (k) => errors[k] && <p className="mt-1 text-sm text-crimson">{errors[k]}</p>;
  return (
    <form onSubmit={submit} className="space-y-4">
      {isNew && (
        <div className="grid sm:grid-cols-2 gap-4">
          <div><label className="label" htmlFor="r-pack">Case type</label><select id="r-pack" className="field" value={v.packKey} onChange={set('packKey')}>{packs?.filter((p) => p.status === 'live').map((p) => <option key={p.key} value={p.key}>{p.name}</option>)}</select></div>
          <div><label className="label" htmlFor="r-code">Code</label><input id="r-code" className="field uppercase" value={v.code} onChange={set('code')} placeholder="NEW_RULE" />{err('code')}</div>
        </div>
      )}
      <div><label className="label" htmlFor="r-title">Title</label><input id="r-title" className="field" value={v.title} onChange={set('title')} />{err('title')}</div>
      <div><label className="label" htmlFor="r-msg">Message shown to the user</label><textarea id="r-msg" rows={3} className="field h-auto py-3" value={v.message} onChange={set('message')} /><p className="text-xs text-steel mt-1">Use {'{{factName}}'} or {'{{amount:inr}}'} to insert values.</p>{err('message')}</div>
      <div><label className="label" htmlFor="r-cite">Legal citation</label><input id="r-cite" className="field" value={v.citation} onChange={set('citation')} />{err('citation')}</div>
      <div className="grid sm:grid-cols-3 gap-4">
        <div><label className="label" htmlFor="r-sev">Severity</label><select id="r-sev" className="field" value={v.severity} onChange={set('severity')}>{Object.entries(SEVERITY).map(([k, s]) => <option key={k} value={k}>{s.label}</option>)}</select></div>
        <div><label className="label" htmlFor="r-from">In force from</label><input id="r-from" type="date" className="field" value={v.effectiveFrom} onChange={set('effectiveFrom')} /></div>
        <div><label className="label" htmlFor="r-to">In force until</label><input id="r-to" type="date" className="field" value={v.effectiveTo} onChange={set('effectiveTo')} /></div>
      </div>
      <div><label className="label" htmlFor="r-cond">Condition (JSON)</label><textarea id="r-cond" rows={7} spellCheck={false} className="field h-auto py-3 font-[ui-monospace,monospace] text-sm" value={v.condition} onChange={set('condition')} />{err('condition')}</div>
      <label className="flex items-center gap-2 text-sm"><input type="checkbox" checked={v.active} onChange={set('active')} className="accent-ink h-4 w-4" />Rule is active</label>
      <button className="btn-ink w-full" disabled={save.isPending}>{save.isPending && <Spinner />}{isNew ? 'Create rule' : 'Save rule'}</button>
    </form>
  );
}

export default function AdminRules() {
  const { data: rules, isLoading, isError, error, refetch } = useRules();
  const { data: overview } = useAdminOverview();
  const save = useSaveRule();
  const [editing, setEditing] = useState(null);

  const open = (r) => setEditing(r ? { ...r, id: r._id, condition: JSON.stringify(r.condition, null, 2), effectiveFrom: r.effectiveFrom?.slice(0, 10) || '', effectiveTo: r.effectiveTo?.slice(0, 10) || '' } : EMPTY);
  const toggle = async (r) => {
    try { await save.mutateAsync({ id: r._id, active: !r.active }); toast.success(r.active ? 'Rule switched off' : 'Rule switched on'); } catch (err) { toast.error(errorMessage(err)); }
  };
  const grouped = (rules || []).reduce((acc, r) => ((acc[r.packKey] ||= []).push(r), acc), {});

  return (
    <Page>
      <AppShell>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="font-serif text-[clamp(44px,6vw,76px)] leading-none">Rules</h1>
            <p className="mt-3 text-steel max-w-xl">Rules are data. Change one here and every new analysis uses it, with no deploy. Dates decide which version of the law applies to a case.</p>
          </div>
          <button className="btn-ink" onClick={() => open(null)}><Plus className="h-4 w-4" />New rule</button>
        </div>
        {overview && (
          <dl className="mt-8 card grid grid-cols-3 divide-x divide-line">
            {[['Users', overview.users], ['Claims', overview.cases], ['Active rules', overview.activeRules]].map(([l, n]) => (
              <div key={l} className="p-5"><dt className="text-sm text-steel">{l}</dt><dd className="font-serif text-4xl tabular">{n}</dd></div>
            ))}
          </dl>
        )}
        {isLoading && <Skeleton className="mt-8 h-72" />}
        {isError && <div className="mt-8"><ErrorState message={errorMessage(error)} onRetry={refetch} /></div>}
        {Object.entries(grouped).map(([packKey, list]) => (
          <section key={packKey} className="mt-10">
            <h2 className="font-serif text-3xl capitalize">{packKey}</h2>
            <div className="mt-4 card overflow-x-auto">
              <table className="w-full text-sm min-w-[720px]">
                <thead className="text-left text-steel"><tr className="border-b border-line"><th className="p-4 font-medium">Rule</th><th className="p-4 font-medium">Severity</th><th className="p-4 font-medium">In force</th><th className="p-4 font-medium">Active</th><th className="p-4" /></tr></thead>
                <tbody className="divide-y divide-line">
                  {list.map((r) => (
                    <tr key={r._id} className={r.active ? '' : 'opacity-50'}>
                      <td className="p-4"><p className="font-semibold">{r.title}</p><p className="text-steel text-xs mt-0.5">{r.code}: {r.citation}</p></td>
                      <td className="p-4"><span className="inline-flex items-center gap-2"><span className={`h-2 w-2 rounded-full ${SEVERITY[r.severity].dot}`} />{SEVERITY[r.severity].label}</span></td>
                      <td className="p-4 text-steel whitespace-nowrap">{r.effectiveFrom ? `From ${date(r.effectiveFrom)}` : r.effectiveTo ? `Until ${date(r.effectiveTo)}` : 'Always'}</td>
                      <td className="p-4">
                        <button role="switch" aria-checked={r.active} aria-label={`${r.active ? 'Switch off' : 'Switch on'} ${r.title}`} onClick={() => toggle(r)} className={`relative h-6 w-11 rounded-full transition ${r.active ? 'bg-emerald' : 'bg-line'}`}>
                          <span className={`absolute top-0.5 h-5 w-5 rounded-full bg-white shadow transition-all ${r.active ? 'left-[22px]' : 'left-0.5'}`} />
                        </button>
                      </td>
                      <td className="p-4 text-right"><button className="btn-ghost h-9" onClick={() => open(r)}>Edit</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        ))}
        <Modal open={Boolean(editing)} onClose={() => setEditing(null)} title={editing?.id ? 'Edit rule' : 'New rule'} width="max-w-2xl">
          {editing && <RuleForm key={editing.id || 'new'} initial={editing} onDone={() => setEditing(null)} />}
        </Modal>
      </AppShell>
    </Page>
  );
}

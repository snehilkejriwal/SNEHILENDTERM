import { useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { toast } from 'sonner';
import { ArrowLeft, Trash2, Archive, Scale, PencilLine } from 'lucide-react';
import Page from '../components/ui/Page';
import AppShell from '../components/ui/AppShell';
import Gem from '../components/ui/Gem';
import { Skeleton, StatusBadge, ErrorState, Modal, Spinner } from '../components/ui/Feedback';
import StageLadder from '../components/case/StageLadder';
import DocumentsPanel from '../components/case/DocumentsPanel';
import FactsForm from '../components/case/FactsForm';
import FactsSummary from '../components/case/FactsSummary';
import { Calculation, Findings } from '../components/case/Analysis';
import ActionPanel from '../components/case/ActionPanel';
import { useCase, usePack, useTransition, useDeleteCase } from '../api/hooks';
import { errorMessage } from '../api/client';
import { inr, dateTime } from '../lib/format';

const ACTION_LABEL = { create: 'Claim opened', documents: 'Documents added', confirm: 'Facts confirmed', unlock: 'Facts unlocked for editing', analyze: 'Analysis run', mark_sent: 'Letter sent', escalate: 'Escalated', resolve: 'Resolved', close: 'Closed' };

export default function CaseDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const { data: c, isLoading, isError, error, refetch } = useCase(id);
  const { data: pack } = usePack(c?.packKey);
  const t = useTransition(id);
  const del = useDeleteCase();
  const [confirmDelete, setConfirmDelete] = useState(false);

  const act = async (action, success) => {
    try { await t.mutateAsync({ action }); toast.success(success); } catch (err) { toast.error(errorMessage(err)); }
  };

  const loading = isLoading || (c && !pack);
  const analysed = c?.calculation?.at;

  return (
    <Page>
      <AppShell>
        <Link to="/dashboard" className="inline-flex items-center gap-1.5 text-sm text-steel hover:text-ink"><ArrowLeft className="h-4 w-4" />All claims</Link>
        {loading && <div className="mt-6 space-y-4"><Skeleton className="h-28" /><Skeleton className="h-64" /></div>}
        {isError && <div className="mt-6"><ErrorState title="Claim not found" message={errorMessage(error)} onRetry={refetch} /></div>}

        {c && pack && (
          <>
            <div className="mt-4 flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-start gap-4 min-w-0">
                <Gem packKey={c.packKey} size={56} />
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2"><StatusBadge status={c.status} /><span className="text-sm text-steel">{pack.name}</span></div>
                  <h1 className="font-serif text-[clamp(36px,5vw,60px)] leading-[0.98] mt-1 break-words">{c.title}</h1>
                </div>
              </div>
              <div className="flex gap-2">
                {c.actions.includes('close') && <button className="btn-ghost h-10" onClick={() => act('close', 'Claim closed')}><Archive className="h-4 w-4" />Close</button>}
                <button className="btn-ghost h-10 text-crimson" onClick={() => setConfirmDelete(true)}><Trash2 className="h-4 w-4" />Delete</button>
              </div>
            </div>

            <div className="mt-8"><StageLadder stages={c.stages} stageIndex={c.stageIndex} status={c.status} /></div>

            {c.status === 'draft' && (
              <div className="mt-8 space-y-6">
                <DocumentsPanel caseData={c} editable />
                <FactsForm caseData={c} pack={pack} />
              </div>
            )}

            {c.status === 'confirmed' && (
              <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_380px] items-start">
                <section className="card p-6 sm:p-8">
                  <h2 className="font-serif text-3xl">Confirmed facts</h2>
                  <div className="mt-5"><FactsSummary pack={pack} facts={c.facts} /></div>
                  <button className="btn-ghost mt-6" onClick={() => act('unlock', 'Facts unlocked')} disabled={t.isPending}><PencilLine className="h-4 w-4" />Edit facts</button>
                </section>
                <section className="rounded-panel glacier-wash text-white p-7">
                  <Scale className="h-8 w-8" />
                  <h2 className="font-serif text-4xl mt-4 leading-none">Check against the law</h2>
                  <p className="mt-3 text-white/85">{pack.ruleCount} rules for this case type will run on your facts. Nothing is sent anywhere.</p>
                  <button className="btn-white mt-6 w-full h-12" onClick={() => act('analyze', 'Analysis complete')} disabled={t.isPending}>{t.isPending && <Spinner />}Run the analysis</button>
                </section>
              </div>
            )}

            {analysed && c.status !== 'draft' && c.status !== 'confirmed' && (
              <div className="mt-8 grid gap-6 lg:grid-cols-[1fr_400px] items-start">
                <div className="space-y-6 min-w-0">
                  <section className="card p-6 sm:p-8"><Calculation calc={c.calculation} /></section>
                  <section aria-labelledby="find-h">
                    <h2 id="find-h" className="font-serif text-3xl mb-4">What we found</h2>
                    <Findings findings={c.findings} />
                  </section>
                  <details className="card p-6 sm:p-8 group">
                    <summary className="cursor-pointer font-serif text-2xl list-none flex justify-between">Facts used <span className="text-sm font-sans text-steel group-open:hidden">Show</span></summary>
                    <div className="mt-5"><FactsSummary pack={pack} facts={c.facts} /></div>
                    {c.actions.includes('unlock') && <button className="btn-ghost mt-6" onClick={() => act('unlock', 'Facts unlocked')}><PencilLine className="h-4 w-4" />Edit facts</button>}
                  </details>
                </div>
                <div className="lg:sticky lg:top-24 space-y-4">
                  {['letter_ready', 'awaiting_response'].includes(c.status) && <ActionPanel caseData={c} />}
                  {c.status === 'resolved' && (
                    <section className="rounded-panel bg-emerald text-white p-7">
                      <p className="text-white/80">Recovered</p>
                      <p className="font-serif text-6xl mt-1 tabular">{inr(c.amountRecovered)}</p>
                      <p className="mt-3 text-white/85">This claim is resolved.</p>
                    </section>
                  )}
                  {c.status === 'closed' && <section className="card p-7"><p className="font-serif text-3xl">Claim closed</p><p className="text-steel mt-2">Closed claims keep their history but cannot be changed.</p></section>}
                </div>
              </div>
            )}

            <section className="mt-12" aria-labelledby="hist-h">
              <h2 id="hist-h" className="font-serif text-3xl">History</h2>
              <ol className="mt-4 border-l border-line ml-2">
                {c.history.map((h, i) => (
                  <li key={i} className="pl-6 pb-5 relative">
                    <span className="absolute -left-[5px] top-1.5 h-2.5 w-2.5 rounded-full bg-ink" />
                    <p className="font-medium">{ACTION_LABEL[h.action] || h.action}{h.note ? `: ${h.note}` : ''}</p>
                    <p className="text-sm text-steel">{dateTime(h.at)}</p>
                  </li>
                ))}
              </ol>
            </section>

            <Modal open={confirmDelete} onClose={() => setConfirmDelete(false)} title="Delete this claim?">
              <p className="text-steel">The claim, its facts and its history will be permanently deleted. Letters you already downloaded are not affected.</p>
              <div className="mt-6 flex gap-3 justify-end">
                <button className="btn-ghost" onClick={() => setConfirmDelete(false)}>Keep it</button>
                <button className="btn-danger" disabled={del.isPending} onClick={async () => {
                  try { await del.mutateAsync(c.id); toast.success('Claim deleted'); navigate('/dashboard'); } catch (err) { toast.error(errorMessage(err)); }
                }}>{del.isPending && <Spinner />}Delete claim</button>
              </div>
            </Modal>
          </>
        )}
      </AppShell>
    </Page>
  );
}

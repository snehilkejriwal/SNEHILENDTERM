import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Download, Send, ArrowUpRight, CheckCircle2, FileText, PencilLine, Copy, Check, ExternalLink, Mail, MessageSquareReply, FolderDown, Plus, X } from 'lucide-react';
import { useTransition } from '../../api/hooks';
import { api, downloadLetter, blobErrorMessage, errorMessage, fieldErrors } from '../../api/client';
import { Modal, Spinner } from '../ui/Feedback';
import { date, inr } from '../../lib/format';

const today = () => new Date().toISOString().slice(0, 10);
const CHANNELS = [['email', 'Email'], ['post', 'Registered post'], ['portal', 'Portal'], ['hand', 'By hand']];
const OUTCOMES = [['no_response', 'No reply'], ['rejected', 'Rejected'], ['partial', 'Paid part'], ['paid_full', 'Paid in full']];
const OUTCOME_LABEL = Object.fromEntries(OUTCOMES);
const CHANNEL_LABEL = Object.fromEntries(CHANNELS);

// Plain text of a letter, for email bodies.
const letterText = (draft, signOff) => [...draft.paragraphs, '', 'Yours faithfully,', signOff].join('\n\n').replace(/\n{3,}/g, '\n\n');

async function copyText(text) {
  try {
    await navigator.clipboard.writeText(text);
  } catch {
    // Fallback for browsers that block the clipboard API.
    const el = document.createElement('textarea');
    el.value = text;
    el.setAttribute('readonly', '');
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    el.remove();
  }
}

async function downloadCaseFile(caseId) {
  const res = await api.get(`/cases/${caseId}/case-file`, { responseType: 'blob' });
  const url = URL.createObjectURL(res.data);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'settlewise-case-file.pdf';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

// ---------------------------------------------------------------- Prepare: letter

function LetterPaper({ draft, findings, calc, signOff }) {
  const issues = (findings || []).filter((f) => f.severity !== 'info');
  const body = draft.paragraphs.slice(0, -1);
  const last = draft.paragraphs[draft.paragraphs.length - 1];
  return (
    <article className="rounded-xl border border-line bg-white shadow-lift px-6 py-7 sm:px-9 sm:py-9 text-[14.5px] leading-relaxed text-ink">
      <p className="text-steel text-sm">{date(new Date())}</p>
      <p className="mt-5">To,</p>
      <p className="font-medium">{draft.to}</p>
      {draft.recipientEmail && <p className="text-steel text-sm">{draft.recipientEmail}</p>}
      <p className="mt-5 font-semibold">Subject: {draft.subject}</p>
      <p className="mt-5">Dear Sir or Madam,</p>
      {body.map((p, i) => <p key={i} className="mt-3 text-justify">{p}</p>)}
      {issues.length > 0 && (
        <div className="mt-5">
          <p className="font-semibold">The issues</p>
          <ol className="mt-2 space-y-2.5">
            {issues.map((f, i) => (
              <li key={f.code}>
                <p className="font-semibold text-[14px]">{i + 1}. {f.title}</p>
                <p className="text-[14px]">{f.message}</p>
                <p className="text-xs text-steel">{f.citation}</p>
              </li>
            ))}
          </ol>
        </div>
      )}
      {calc?.items?.length > 0 && (
        <div className="mt-5">
          <p className="font-semibold">Amount due</p>
          <table className="mt-2 w-full text-[14px]">
            <tbody>
              {calc.items.map((it) => (
                <tr key={it.key}><td className="py-1 pr-4">{it.label}</td><td className="py-1 text-right tabular">{it.kind === 'debit' ? '− ' : ''}{inr(it.amount)}</td></tr>
              ))}
              <tr className="border-t border-line font-semibold"><td className="pt-2">{calc.owedLabel || 'Total due'}</td><td className="pt-2 text-right tabular">{inr(calc.owed)}</td></tr>
              <tr><td className="py-1">Already offered or paid</td><td className="py-1 text-right tabular">{inr(calc.offered)}</td></tr>
              <tr className="font-semibold"><td>Outstanding</td><td className="text-right tabular">{inr(Math.max(0, calc.gap))}</td></tr>
            </tbody>
          </table>
        </div>
      )}
      {last && <p className="mt-5 text-justify">{last}</p>}
      <p className="mt-6">Yours faithfully,</p>
      <p className="mt-6 font-semibold">{signOff}</p>
    </article>
  );
}

function LetterEditor({ draft, onCancel, onSave, saving, errors }) {
  const [form, setForm] = useState(() => ({ ...draft, paragraphs: [...draft.paragraphs] }));
  const setPara = (i, v) => setForm((f) => ({ ...f, paragraphs: f.paragraphs.map((p, j) => (j === i ? v : p)) }));
  const err = (k) => errors?.[k] && <p className="mt-1 text-sm text-crimson">{errors[k]}</p>;
  return (
    <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); onSave(form); }} noValidate>
      <div>
        <label htmlFor="l-to" className="label">To</label>
        <input id="l-to" className="field" value={form.to} onChange={(e) => setForm({ ...form, to: e.target.value })} />
        {err('to')}
      </div>
      <div>
        <label htmlFor="l-email" className="label">Recipient email <span className="font-normal">(optional)</span></label>
        <input id="l-email" type="email" className="field" placeholder="hr@company.com" value={form.recipientEmail || ''} onChange={(e) => setForm({ ...form, recipientEmail: e.target.value })} />
        {err('recipientEmail')}
      </div>
      <div>
        <label htmlFor="l-subject" className="label">Subject</label>
        <input id="l-subject" className="field" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
        {err('subject')}
      </div>
      <fieldset className="space-y-3">
        <legend className="label">Paragraphs</legend>
        <p className="text-xs text-steel -mt-1">The issues and the amount table are added to the PDF between the last two paragraphs.</p>
        {form.paragraphs.map((p, i) => (
          <div key={i} className="relative">
            <textarea aria-label={`Paragraph ${i + 1}`} rows={Math.min(8, Math.max(3, Math.ceil(p.length / 80)))} className="field h-auto py-2.5 pr-10 resize-y" value={p} onChange={(e) => setPara(i, e.target.value)} />
            {form.paragraphs.length > 1 && (
              <button type="button" onClick={() => setForm((f) => ({ ...f, paragraphs: f.paragraphs.filter((_, j) => j !== i) }))} className="absolute right-2 top-2 rounded-full p-1.5 text-steel hover:bg-mist" aria-label={`Remove paragraph ${i + 1}`}><X className="h-4 w-4" /></button>
            )}
          </div>
        ))}
        {err('paragraphs')}
        <button type="button" className="btn-ghost h-9 px-4" onClick={() => setForm((f) => ({ ...f, paragraphs: [...f.paragraphs, ''] }))}><Plus className="h-4 w-4" />Add paragraph</button>
      </fieldset>
      <div className="flex justify-end gap-2 pt-2">
        <button type="button" className="btn-ghost" onClick={onCancel}>Cancel</button>
        <button className="btn-ink" disabled={saving}>{saving && <Spinner />}Save letter</button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------- Prepare: portal

function FilingPack({ filing }) {
  const [copied, setCopied] = useState(null);
  const [ticked, setTicked] = useState({});
  const [done, setDone] = useState({});
  const copy = async (label, value) => {
    await copyText(value);
    setCopied(label);
    setTimeout(() => setCopied((c) => (c === label ? null : c)), 1600);
  };
  const url = filing.entryUrl || filing.portalUrl;
  return (
    <div className="space-y-6">
      <p className="rounded-xl bg-mist px-4 py-3 text-sm text-steel">
        Portals ask you to log in with your own mobile number and OTP. SettleWise can't log in or file for you, but everything you need to paste is here.
      </p>

      {filing.filingSteps?.length > 0 && (
        <section aria-labelledby="how-file-h">
          <div className="flex items-baseline justify-between gap-3">
            <h3 id="how-file-h" className="font-semibold">How to file on {filing.portalName}</h3>
            <span className="text-xs text-steel tabular">{Object.values(done).filter(Boolean).length} of {filing.filingSteps.length} done</span>
          </div>
          <ol className="mt-3 space-y-2">
            {filing.filingSteps.map((step, i) => (
              <li key={i}>
                <label className={`flex items-start gap-3 rounded-xl border p-3 text-sm cursor-pointer transition ${done[i] ? 'border-line bg-frost' : 'border-line hover:border-ink/30'}`}>
                  <input type="checkbox" className="mt-0.5 accent-ink" checked={Boolean(done[i])} onChange={(e) => setDone((d) => ({ ...d, [i]: e.target.checked }))} />
                  <span className="grid h-5 w-5 shrink-0 place-items-center rounded-full bg-ink text-[11px] font-semibold text-white tabular">{i + 1}</span>
                  <span className={done[i] ? 'text-steel line-through' : ''}>{step}</span>
                </label>
              </li>
            ))}
          </ol>
          <p className="mt-2 text-xs text-steel">Button and menu names on the portal may change slightly over time.</p>
          {filing.alternatives?.length > 0 && (
            <div className="mt-4">
              <p className="text-sm font-semibold">Other ways to file</p>
              <ul className="mt-1.5 list-disc pl-5 space-y-1 text-sm text-steel">
                {filing.alternatives.map((a) => <li key={a}>{a}</li>)}
              </ul>
            </div>
          )}
        </section>
      )}

      {url && (
        <a href={url} target="_blank" rel="noopener noreferrer" className="btn-ink w-full"><ExternalLink className="h-4 w-4" />Open {filing.portalName} (you'll log in first)</a>
      )}

      <section aria-labelledby="fields-h">
        <h3 id="fields-h" className="font-semibold">What to paste</h3>
        <ol className="mt-3 space-y-4">
          {filing.fields.map((f) => {
            const over = f.maxLength && f.value.length > f.maxLength;
            return (
              <li key={f.label} className="rounded-xl border border-line p-4">
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="font-semibold text-sm">{f.label}</p>
                    <span className={`text-xs tabular ${over ? 'text-crimson font-semibold' : 'text-steel'}`}>{f.value.length}{f.maxLength ? ` / ${f.maxLength}` : ''} characters</span>
                  </div>
                  <div className="flex items-center gap-2">
                    {f.pasteInto && <span className="rounded-full bg-mist px-2.5 py-1 text-xs text-steel">Paste into: <span className="font-semibold text-ink">{f.pasteInto}</span></span>}
                    <button type="button" className="btn-ghost h-8 px-3 text-xs" onClick={() => copy(f.label, f.value)} aria-label={`Copy ${f.label}`}>
                      {copied === f.label ? <><Check className="h-3.5 w-3.5" />Copied</> : <><Copy className="h-3.5 w-3.5" />Copy</>}
                    </button>
                  </div>
                </div>
                <p className="mt-2 whitespace-pre-wrap text-[14px] leading-relaxed max-h-56 overflow-y-auto">{f.value}</p>
              </li>
            );
          })}
        </ol>
      </section>

      <section aria-labelledby="attach-h">
        <h3 id="attach-h" className="font-semibold">Attach these</h3>
        <ul className="mt-2 space-y-1.5">
          {filing.attachments.map((a, i) => (
            <li key={i}>
              <label className="flex items-start gap-2.5 text-sm cursor-pointer">
                <input type="checkbox" className="mt-0.5 accent-ink" checked={Boolean(ticked[i])} onChange={(e) => setTicked((t) => ({ ...t, [i]: e.target.checked }))} />
                <span className={ticked[i] ? 'text-steel line-through' : ''}>{a}</span>
              </label>
            </li>
          ))}
        </ul>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------- Panel

export default function ActionPanel({ caseData }) {
  const qc = useQueryClient();
  const t = useTransition(caseData.id);
  const stage = caseData.stages[caseData.stageIndex];
  const portal = stage.type === 'portal';
  const d = caseData.deadline;
  const hasNext = caseData.stageIndex < caseData.stages.length - 1;
  const sent = caseData.status === 'awaiting_response';
  const log = (caseData.stageLog || []).find((s) => s.stageIndex === caseData.stageIndex);
  const replies = log?.replies || [];
  const lastReply = replies[replies.length - 1];
  const signOff = caseData.facts?.employeeName || caseData.facts?.passengerName || caseData.facts?.tenantName || '';
  const caseKey = ['case', String(caseData.id)];
  const putCase = (c) => { qc.setQueryData(caseKey, c); qc.invalidateQueries({ queryKey: ['cases'] }); };

  const [step, setStep] = useState(sent ? 'track' : 'prepare');
  useEffect(() => { setStep(sent ? 'track' : 'prepare'); }, [sent, caseData.stageIndex]);
  const [modal, setModal] = useState(null);

  // Letter draft (letter stages) and filing pack (portal stages) for the current stage.
  const draftKey = ['letter-draft', String(caseData.id), caseData.stageIndex];
  const draftQ = useQuery({ queryKey: draftKey, enabled: !portal, queryFn: async () => (await api.get(`/cases/${caseData.id}/letter-draft`, { params: { stage: caseData.stageIndex } })).data.draft });
  const filingQ = useQuery({ queryKey: ['filing-pack', String(caseData.id), caseData.stageIndex, caseData.updatedAt], enabled: portal, queryFn: async () => (await api.get(`/cases/${caseData.id}/filing-pack`, { params: { stage: caseData.stageIndex } })).data.filing });
  const draft = draftQ.data;

  const [editing, setEditing] = useState(false);
  const [draftErrors, setDraftErrors] = useState({});
  const saveDraft = useMutation({
    mutationFn: async (body) => (await api.put(`/cases/${caseData.id}/letter-draft`, body)).data,
    onSuccess: (data) => { qc.setQueryData(draftKey, data.draft); putCase(data.case); },
  });

  const [downloading, setDownloading] = useState(null);
  const getPdf = async (kind) => {
    setDownloading(kind);
    try {
      if (kind === 'letter') { await downloadLetter(caseData.id, caseData.stageIndex); toast.success('Letter downloaded'); }
      else { await downloadCaseFile(caseData.id); toast.success('Case file downloaded'); }
    } catch (err) { toast.error(await blobErrorMessage(err)); } finally { setDownloading(null); }
  };

  // Send
  const [channel, setChannel] = useState(portal ? 'portal' : 'email');
  const [sentAt, setSentAt] = useState(today());
  const [email, setEmail] = useState('');
  const [reference, setReference] = useState('');
  useEffect(() => { setChannel(portal ? 'portal' : 'email'); setReference(''); setSentAt(today()); }, [portal, caseData.stageIndex]);
  useEffect(() => { if (draft?.recipientEmail) setEmail(draft.recipientEmail); }, [draft?.recipientEmail]);
  const refOk = reference.trim().length >= 3;
  const canSend = !t.isPending && (!portal || refOk) && (channel !== 'portal' || refOk);

  const mailLinks = useMemo(() => {
    if (!draft) return null;
    const body = `${letterText(draft, signOff)}\n\n(The full letter with the amounts is attached as a PDF.)`;
    const enc = encodeURIComponent;
    return {
      gmail: `https://mail.google.com/mail/?view=cm&to=${enc(email)}&su=${enc(draft.subject)}&body=${enc(body)}`,
      mailto: `mailto:${enc(email)}?subject=${enc(draft.subject)}&body=${enc(body)}`,
    };
  }, [draft, email, signOff]);

  const run = async (body, success) => {
    try {
      await t.mutateAsync(body);
      toast.success(success);
      setModal(null);
      // The server keeps the letter as sent, and escalation opens a new stage.
      qc.invalidateQueries({ queryKey: ['letter-draft', String(caseData.id)] });
      return true;
    } catch (err) { toast.error(errorMessage(err)); return false; }
  };

  const markSent = () => {
    const recipient = channel === 'email' ? email.trim() : channel === 'portal' ? (stage.portalName || stage.recipient) : (draft?.to || stage.recipient);
    run({ action: 'mark_sent', channel, recipient: recipient || undefined, referenceNumber: reference.trim() || undefined, sentAt }, portal ? 'Marked as filed. The countdown has started.' : 'Marked as sent. The countdown has started.');
  };

  // Track
  const [reply, setReply] = useState({ receivedAt: today(), outcome: 'rejected', amountPaid: '', text: '' });
  const [lastPaid, setLastPaid] = useState(null);
  const sendReply = useMutation({
    mutationFn: async (body) => (await api.post(`/cases/${caseData.id}/replies`, body)).data,
    onSuccess: (data) => putCase(data.case),
  });
  const logReply = async () => {
    const body = { receivedAt: reply.receivedAt, outcome: reply.outcome, text: reply.text.trim() || undefined };
    if (['partial', 'paid_full'].includes(reply.outcome) && reply.amountPaid !== '') body.amountPaid = Number(reply.amountPaid);
    try {
      const data = await sendReply.mutateAsync(body);
      setModal(null);
      setReply({ receivedAt: today(), outcome: 'rejected', amountPaid: '', text: '' });
      if (body.outcome === 'paid_full') toast.success('Paid in full. The claim is resolved.');
      else if (body.amountPaid) {
        setLastPaid(body.amountPaid);
        toast.success(`Payment recorded. Outstanding now ${inr(Math.max(0, data.case.calculation.gap))}.`);
      } else toast.success('Reply recorded');
    } catch (err) { toast.error(errorMessage(err)); }
  };

  // Same rule as the server: escalate after a rejection or part payment, or once the deadline passes.
  const replyAllowsEscalation = ['rejected', 'partial'].includes(lastReply?.outcome);
  const canEscalate = hasNext && (replyAllowsEscalation || d?.canEscalateForNoResponse);
  const escalateReason = replyAllowsEscalation ? lastReply.outcome : 'no_response';

  const [amount, setAmount] = useState('');

  const steps = [['prepare', '1', 'Prepare'], ['send', '2', 'Send'], ['track', '3', 'Track']];
  const stepEnabled = { prepare: true, send: !sent, track: sent };

  return (
    <section className="rounded-panel glacier-wash text-white p-6 sm:p-8 border border-indigo-400/20 shadow-lift relative overflow-hidden" aria-labelledby="next-h">
      <div className="pointer-events-none absolute top-0 right-0 w-64 h-64 rounded-full bg-cyan-500/10 blur-3xl" />
      <p className="text-sky-300 text-xs font-semibold uppercase tracking-wider">Stage {caseData.stageIndex + 1} of {caseData.stages.length}{portal ? ' · Online complaint' : ' · Letter'}</p>
      <h2 id="next-h" className="font-serif text-4xl mt-1">{stage.label}</h2>
      <p className="mt-2 text-white/80">To: {portal ? stage.portalName || stage.recipient : stage.recipient}</p>
      <p className="mt-1 text-white/60 text-sm">{stage.howToSend}</p>

      <div className="mt-6 grid grid-cols-3 gap-1 rounded-full bg-white/[0.08] p-1 border border-white/10" role="tablist" aria-label="Steps for this stage">
        {steps.map(([key, n, label]) => (
          <button key={key} type="button" role="tab" aria-selected={step === key} disabled={!stepEnabled[key]} onClick={() => setStep(key)}
            className={`rounded-full px-2 py-2 text-sm transition disabled:opacity-35 ${step === key ? 'bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-bold shadow-brand' : 'text-white/75 hover:bg-white/10'}`}>
            <span className="tabular mr-1 text-xs">{n}</span>{label}
          </button>
        ))}
      </div>

      {/* ---------------------------------------------------- 1. Prepare */}
      {step === 'prepare' && (
        <div className="mt-6" role="tabpanel">
          {portal ? (
            <>
              <p className="text-white/75 text-sm">This stage is filed online on {stage.portalName}. SettleWise has prepared every field for you to copy.</p>
              <div className="mt-5 flex flex-wrap gap-3">
                <button className="btn-white" onClick={() => setModal('filing')} disabled={filingQ.isLoading}>{filingQ.isLoading ? <Spinner /> : <FileText className="h-4 w-4" />}Open filing pack</button>
                {(stage.entryUrl || stage.portalUrl) && <a href={stage.entryUrl || stage.portalUrl} target="_blank" rel="noopener noreferrer" className="btn glass-dark text-white hover:bg-white/10"><ExternalLink className="h-4 w-4" />Open {stage.portalName} (you'll log in first)</a>}
              </div>
              {filingQ.isError && <p className="mt-3 text-sm text-[#FFB4A8]">{errorMessage(filingQ.error)}</p>}
            </>
          ) : (
            <>
              {draftQ.isLoading && <p className="text-white/60 text-sm flex items-center gap-2"><Spinner />Preparing your letter…</p>}
              {draftQ.isError && <p className="text-sm text-[#FFB4A8]">{errorMessage(draftQ.error)}</p>}
              {draft && (
                <div className="rounded-2xl bg-white/[0.06] border border-white/10 p-4">
                  <p className="text-xs text-white/50">Subject</p>
                  <p className="mt-0.5 font-medium">{draft.subject}</p>
                  <p className="mt-2 text-xs text-white/50">{draft.saved ? `Edited ${date(draft.editedAt)}` : 'Written from your facts'}{draft.recipientEmail ? ` · ${draft.recipientEmail}` : ''}</p>
                </div>
              )}
              <div className="mt-5 flex flex-wrap gap-3">
                <button className="btn-white" onClick={() => { setEditing(false); setModal('letter'); }} disabled={!draft}><FileText className="h-4 w-4" />Preview and edit</button>
                <button className="btn glass-dark text-white hover:bg-white/10" onClick={() => getPdf('letter')} disabled={downloading === 'letter'}>{downloading === 'letter' ? <Spinner /> : <Download className="h-4 w-4" />}Download PDF</button>
              </div>
            </>
          )}
          {!sent && <button type="button" className="mt-6 text-sm text-white/70 underline underline-offset-4 hover:text-white" onClick={() => setStep('send')}>Ready? Go to step 2: Send</button>}
        </div>
      )}

      {/* ---------------------------------------------------- 2. Send */}
      {step === 'send' && !sent && (
        <div className="mt-6 space-y-5" role="tabpanel">
          <fieldset>
            <legend className="label-dark">How are you sending it?</legend>
            <div className="grid grid-cols-2 gap-2">
              {CHANNELS.map(([v, l]) => (
                <label key={v} className={`cursor-pointer rounded-xl border px-3 py-2.5 text-sm transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-white ${channel === v ? 'border-white bg-white text-ink font-semibold' : 'border-white/15 text-white/80 hover:border-white/40'}`}>
                  <input type="radio" name="channel" value={v} checked={channel === v} onChange={() => setChannel(v)} className="sr-only" />{l}
                </label>
              ))}
            </div>
          </fieldset>

          {channel === 'email' && !portal && (
            <div className="space-y-3">
              <div>
                <label htmlFor="s-email" className="label-dark">Recipient email</label>
                <input id="s-email" type="email" className="field-dark h-11" placeholder="hr@company.com" value={email} onChange={(e) => setEmail(e.target.value)} />
              </div>
              <div className="flex flex-wrap gap-2">
                <a href={mailLinks?.gmail} target="_blank" rel="noopener noreferrer" className={`btn-white h-10 px-4 ${!mailLinks ? 'pointer-events-none opacity-50' : ''}`}><Mail className="h-4 w-4" />Open in Gmail</a>
                <a href={mailLinks?.mailto} className={`btn glass-dark h-10 px-4 text-white hover:bg-white/10 ${!mailLinks ? 'pointer-events-none opacity-50' : ''}`}><Send className="h-4 w-4" />Open in mail app</a>
              </div>
              <p className="text-xs text-white/55">The subject and letter text are filled in for you. Remember to attach the PDF from step 1 before sending.</p>
            </div>
          )}

          {channel === 'post' && (
            <div>
              <label htmlFor="s-track" className="label-dark">Tracking number <span className="font-normal">(optional)</span></label>
              <input id="s-track" className="field-dark h-11" placeholder="e.g. RP123456789IN" value={reference} onChange={(e) => setReference(e.target.value)} />
            </div>
          )}

          {(channel === 'portal' || portal) && (
            <div>
              <label htmlFor="s-ref" className="label-dark">Complaint / reference number from {stage.portalName || 'the portal'}</label>
              <input id="s-ref" className="field-dark h-11" required aria-describedby="s-ref-help" value={reference} onChange={(e) => setReference(e.target.value)} />
              <p id="s-ref-help" className="mt-1.5 text-xs text-white/55">You get this after submitting on the portal. For testing, any number works, e.g. SAM/2026/000123.</p>
            </div>
          )}

          <div>
            <label htmlFor="s-date" className="label-dark">{portal || channel === 'portal' ? 'Date filed' : 'Date sent'}</label>
            <input id="s-date" type="date" className="field-dark h-11 [color-scheme:dark]" max={today()} value={sentAt} onChange={(e) => setSentAt(e.target.value)} />
            <p className="mt-1.5 text-xs text-white/55">The {stage.responseDays}-day reply window counts from this date.</p>
          </div>

          <button className="btn-white w-full h-12" disabled={!canSend} onClick={markSent}>{t.isPending ? <Spinner /> : <Send className="h-4 w-4" />}I've sent it</button>
        </div>
      )}

      {/* ---------------------------------------------------- 3. Track */}
      {step === 'track' && sent && (
        <div className="mt-6" role="tabpanel">
          {d?.dueAt && (
            <div>
              <div className="flex justify-between text-sm">
                <span>Sent {date(d.sentAt)}</span>
                <span className={d.state === 'overdue' ? 'text-[#FFB4A8] font-semibold' : d.state === 'due_soon' ? 'text-marigold font-semibold' : 'text-white/75'}>
                  {d.state === 'overdue' ? `Reply overdue by ${Math.abs(d.daysLeft)} days` : `${d.daysLeft} days left, until ${date(d.dueAt)}`}
                </span>
              </div>
              <div className="mt-2 h-2 rounded-full bg-white/10 overflow-hidden">
                <div className={`h-full rounded-full ${d.state === 'overdue' ? 'bg-[#FF8A7A]' : 'bg-marigold'}`} style={{ width: `${Math.round(d.progress * 100)}%` }} />
              </div>
              <p className="mt-2 text-xs text-white/50">{stage.basis}</p>
            </div>
          )}

          {log && (
            <p className="mt-4 text-sm text-white/65">
              {CHANNEL_LABEL[log.channel] || 'Sent'}{log.recipient ? ` to ${log.recipient}` : ''}{log.referenceNumber ? ` · Ref ${log.referenceNumber}` : ''}
            </p>
          )}

          {(caseData.paidTotal > 0 || lastPaid) && (
            <div className="mt-4 grid grid-cols-2 gap-2">
              <div className="rounded-xl bg-white/[0.06] p-3"><p className="text-xs text-white/55">Paid so far</p><p className="font-serif text-2xl tabular">{inr(caseData.paidTotal)}</p></div>
              <div className="rounded-xl bg-white/[0.06] p-3"><p className="text-xs text-white/55">Outstanding now</p><p className="font-serif text-2xl tabular">{inr(Math.max(0, caseData.calculation?.gap ?? 0))}</p></div>
            </div>
          )}

          {replies.length > 0 && (
            <ul className="mt-4 space-y-2">
              {replies.map((r, i) => (
                <li key={i} className="rounded-xl border border-white/10 px-3.5 py-2.5 text-sm">
                  <p><span className="font-semibold">{OUTCOME_LABEL[r.outcome]}</span> <span className="text-white/55">· {date(r.receivedAt)}</span>{r.amountPaid ? <span className="text-white/80"> · {inr(r.amountPaid)} paid</span> : null}</p>
                  {r.text && <p className="mt-1 text-white/65 line-clamp-3">“{r.text}”</p>}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-6 flex flex-wrap gap-3">
            <button className="btn-white" onClick={() => setModal('reply')}><MessageSquareReply className="h-4 w-4" />Log their reply</button>
            {hasNext && (
              <button className="btn glass-dark text-white hover:bg-white/10 disabled:opacity-40" disabled={!canEscalate} onClick={() => setModal('escalate')}
                title={canEscalate ? undefined : `Available after a rejection or part payment, or after ${date(d?.dueAt)}`}>
                <ArrowUpRight className="h-4 w-4" />Escalate
              </button>
            )}
          </div>
          {hasNext && !canEscalate && <p className="mt-2 text-xs text-white/55">You can escalate once they reject or part-pay your claim, or after {date(d?.dueAt)} if there's no reply.</p>}
          {!hasNext && <p className="mt-2 text-xs text-white/55">This is the last stage. Log the outcome when you hear back.</p>}
        </div>
      )}

      {/* After escalating, before the next letter goes out, a payment can still end the claim. */}
      <div className="mt-7 pt-5 border-t border-white/10 flex flex-wrap gap-3">
        <button className="btn glass-dark h-10 px-4 text-white hover:bg-white/10" onClick={() => getPdf('file')} disabled={downloading === 'file'}>{downloading === 'file' ? <Spinner /> : <FolderDown className="h-4 w-4" />}Download case file</button>
        {caseData.status === 'letter_ready' && caseData.stageLog.length > 0 && (
          <button className="btn glass-dark h-10 px-4 text-white hover:bg-white/10" onClick={() => setModal('resolve')}><CheckCircle2 className="h-4 w-4" />I got paid</button>
        )}
      </div>

      {/* ---------------------------------------------------- Modals */}
      <Modal open={modal === 'letter'} onClose={() => { setModal(null); setEditing(false); }} title={editing ? 'Edit the letter' : 'Your letter'} width="max-w-3xl">
        {draft && (editing ? (
          <LetterEditor
            draft={draft}
            errors={draftErrors}
            saving={saveDraft.isPending}
            onCancel={() => { setEditing(false); setDraftErrors({}); }}
            onSave={async (form) => {
              try {
                await saveDraft.mutateAsync({ stageIndex: caseData.stageIndex, to: form.to, recipientEmail: form.recipientEmail || '', subject: form.subject, paragraphs: form.paragraphs });
                setEditing(false);
                setDraftErrors({});
                toast.success('Letter saved. The PDF will use your version.');
              } catch (err) { setDraftErrors(fieldErrors(err)); toast.error(errorMessage(err)); }
            }}
          />
        ) : (
          <>
            <LetterPaper draft={draft} findings={caseData.findings} calc={caseData.calculation} signOff={signOff} />
            <div className="mt-5 flex flex-wrap justify-end gap-2">
              <button className="btn-ghost" onClick={() => setEditing(true)}><PencilLine className="h-4 w-4" />Edit</button>
              <button className="btn-ink" onClick={() => getPdf('letter')} disabled={downloading === 'letter'}>{downloading === 'letter' ? <Spinner /> : <Download className="h-4 w-4" />}Download PDF</button>
            </div>
          </>
        ))}
      </Modal>

      <Modal open={modal === 'filing'} onClose={() => setModal(null)} title={`Filing pack for ${stage.portalName || stage.label}`} width="max-w-3xl">
        {filingQ.data && <FilingPack filing={filingQ.data} />}
      </Modal>

      <Modal open={modal === 'reply'} onClose={() => setModal(null)} title="Log their reply">
        <form className="space-y-4" onSubmit={(e) => { e.preventDefault(); logReply(); }} noValidate>
          <fieldset>
            <legend className="label">What happened?</legend>
            <div className="grid grid-cols-2 gap-2">
              {OUTCOMES.map(([v, l]) => (
                <label key={v} className={`flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer text-sm ${reply.outcome === v ? 'border-ink' : 'border-line'}`}>
                  <input type="radio" name="reply-outcome" value={v} checked={reply.outcome === v} onChange={() => setReply({ ...reply, outcome: v })} className="accent-ink" />{l}
                </label>
              ))}
            </div>
          </fieldset>
          <div>
            <label htmlFor="r-date" className="label">{reply.outcome === 'no_response' ? 'Date you checked' : 'Date received'}</label>
            <input id="r-date" type="date" className="field" min={log?.sentAt ? String(log.sentAt).slice(0, 10) : undefined} max={today()} value={reply.receivedAt} onChange={(e) => setReply({ ...reply, receivedAt: e.target.value })} />
          </div>
          {['partial', 'paid_full'].includes(reply.outcome) && (
            <div>
              <label htmlFor="r-amount" className="label">Amount paid</label>
              <div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-steel">₹</span><input id="r-amount" type="number" min="0" inputMode="decimal" className="field pl-8" value={reply.amountPaid} onChange={(e) => setReply({ ...reply, amountPaid: e.target.value })} /></div>
              <p className="mt-1 text-xs text-steel">Outstanding before this payment: {inr(Math.max(0, caseData.calculation?.gap ?? 0))}</p>
            </div>
          )}
          <div>
            <label htmlFor="r-text" className="label">Their message <span className="font-normal">(optional)</span></label>
            <textarea id="r-text" rows={4} maxLength={5000} className="field h-auto py-2.5 resize-y" placeholder="Paste or summarise what they said" value={reply.text} onChange={(e) => setReply({ ...reply, text: e.target.value })} />
          </div>
          {reply.outcome === 'paid_full' && <p className="text-sm text-steel">This closes the claim as resolved.</p>}
          <button className="btn-ink w-full" disabled={sendReply.isPending || (reply.outcome === 'partial' && !(Number(reply.amountPaid) > 0))}>{sendReply.isPending && <Spinner />}Save reply</button>
        </form>
      </Modal>

      <Modal open={modal === 'escalate'} onClose={() => setModal(null)} title="Escalate to the next stage">
        <p className="text-steel">Next: <span className="font-semibold text-ink">{caseData.stages[caseData.stageIndex + 1]?.label}</span>.</p>
        <p className="mt-2 text-steel">
          Reason: {escalateReason === 'rejected' ? 'they rejected the claim' : escalateReason === 'partial' ? 'they paid only part of it' : 'no reply by the deadline'}. The next {caseData.stages[caseData.stageIndex + 1]?.type === 'portal' ? 'complaint' : 'letter'} will refer to this stage.
        </p>
        <button className="btn-ink mt-6 w-full" disabled={t.isPending || !canEscalate} onClick={() => run({ action: 'escalate', outcome: escalateReason }, 'Escalated. The next stage is ready.')}>{t.isPending && <Spinner />}Escalate</button>
      </Modal>

      <Modal open={modal === 'resolve'} onClose={() => setModal(null)} title="Close this claim as paid">
        <label htmlFor="amount" className="label">Amount you recovered</label>
        <div className="relative"><span className="absolute left-3.5 top-1/2 -translate-y-1/2 text-steel">₹</span><input id="amount" type="number" min="0" inputMode="decimal" className="field pl-8" value={amount} onChange={(e) => setAmount(e.target.value)} /></div>
        <button className="btn-ink mt-6 w-full" disabled={t.isPending || amount === ''} onClick={() => run({ action: 'resolve', amountRecovered: Number(amount) }, 'Claim resolved. Well done.')}>{t.isPending && <Spinner />}Mark as resolved</button>
      </Modal>
    </section>
  );
}

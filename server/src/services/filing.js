import { getPackLogic } from './packs/registry.js';
import { generateLetter, earlierStages, historyParagraph } from './letters/compose.js';
import { paidTotal } from './workflow.js';
import { isoDay } from '../utils/dates.js';
import { inr } from '../utils/money.js';
import { badRequest } from '../utils/AppError.js';

export const DESCRIPTION_MAX = 2000;

// Portal forms often mangle the rupee sign, so filing text uses "Rs.".
const plain = (s) => String(s ?? '').replace(/₹/g, 'Rs. ').replace(/\s+/g, ' ').trim();
const rs = (n) => plain(inr(n));

// Fits the description into the portal's limit: drop citations first, then whole findings,
// and only then cut the text itself.
function fitDescription(head, issues, tail, max = DESCRIPTION_MAX) {
  const build = (list, withCites) => {
    const lines = list.map((f, i) => `${i + 1}. ${f.title}${withCites && f.citation ? ` (${f.citation})` : ''}.`);
    return plain([head, lines.length ? `Issues: ${lines.join(' ')}` : '', tail].filter(Boolean).join(' '));
  };
  for (const withCites of [true, false]) {
    for (let n = issues.length; n >= 0; n -= 1) {
      const text = build(issues.slice(0, n), withCites);
      if (text.length <= max) return text;
    }
  }
  return `${build([], false).slice(0, max - 1)}…`;
}

// Everything the user needs to copy into a portal complaint form, field by field.
export function buildFilingPack(c, pack, stageIndex, user) {
  const stage = pack.stages[stageIndex];
  if (!stage) throw badRequest('Unknown stage.');
  if (stageIndex > c.stageIndex) throw badRequest('That stage is not open yet.');
  if (stage.type !== 'portal') throw badRequest(`${stage.label} is sent as a letter, not filed on a portal.`);

  const logic = getPackLogic(pack.key);
  const calc = c.calculation || { owed: 0, offered: 0, gap: 0 };
  const text = logic.filing(stage.key, { facts: c.facts || {}, calc });
  const letter = generateLetter(c, pack, stageIndex, user);
  const earlier = earlierStages(c, pack, stageIndex);
  const paid = paidTotal(c);
  const outstanding = Math.max(0, calc.gap || 0);

  const head = `${letter.paragraphs[0]} Amount due: ${rs(calc.owed)}. Offered or paid so far: ${rs(calc.offered)}. Outstanding: ${rs(outstanding)}.`;
  const issues = (c.findings || []).filter((f) => f.severity !== 'info');
  const tail = [historyParagraph(earlier, paid), 'Copies of the documents and earlier correspondence are attached.'].filter(Boolean).join(' ');

  const refs = earlier.filter((e) => e.log.referenceNumber).map((e) => `${e.stage.label}: ${e.log.referenceNumber} (${isoDay(e.log.sentAt)})`);

  const attachments = [
    ...(c.documents || []).map((d) => d.name),
    ...earlier.flatMap(({ stage: s, log }) => {
      const sent = isoDay(log.sentAt);
      const own = s.type === 'portal'
        ? `Acknowledgement of ${s.portalName || s.label} complaint${log.referenceNumber ? ` ${log.referenceNumber}` : ''} dated ${sent}`
        : `Copy of letter to ${log.recipient || s.recipient} dated ${sent} (${s.label})`;
      const replies = (log.replies || []).filter((r) => r.outcome !== 'no_response').map((r) => `Reply to ${s.label} received on ${isoDay(r.receivedAt)} (${r.outcome.replace('_', ' ')})`);
      return [own, ...replies];
    }),
    'Calculation sheet (SettleWise case file)',
  ].filter((a, i, all) => all.indexOf(a) === i);

  return {
    stageIndex,
    stageLabel: stage.label,
    portalName: stage.portalName || stage.label,
    portalUrl: stage.portalUrl || null,
    entryUrl: stage.entryUrl || stage.portalUrl || null,
    filingSteps: stage.filingSteps || [],
    alternatives: stage.alternatives || [],
    // `pasteInto` names the section of the portal form each value belongs in.
    fields: [
      { key: 'category', label: 'Complaint category', value: plain(text.category) },
      { key: 'opponent', label: 'Opposite party', value: plain(text.opponent) || 'Not recorded' },
      { key: 'subject', label: 'Subject', value: plain(text.subject), maxLength: 200 },
      { key: 'description', label: 'Description', value: fitDescription(head, issues, tail), maxLength: DESCRIPTION_MAX },
      { key: 'relief', label: 'Relief sought', value: plain(text.relief), maxLength: 1000 },
      { key: 'amount', label: 'Amount claimed', value: rs(outstanding) },
      { key: 'reference', label: 'Previous complaint / reference number', value: refs.length ? refs.join('; ') : 'None' },
    ].map(({ key, ...f }) => ({
      ...f,
      pasteInto: text.pasteInto?.[key] || 'Complaint details',
      ...(f.maxLength && f.value.length > f.maxLength ? { value: `${f.value.slice(0, f.maxLength - 1)}…` } : {}),
    })),
    attachments,
  };
}

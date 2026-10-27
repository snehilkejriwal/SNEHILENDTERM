import { getPackLogic } from '../packs/registry.js';
import { paidTotal } from '../workflow.js';
import { isoDay } from '../../utils/dates.js';
import { inr } from '../../utils/money.js';
import { badRequest } from '../../utils/AppError.js';

const CHANNEL = { email: 'by email', post: 'by registered post', portal: 'online', hand: 'by hand' };

// What happened at each stage before `stageIndex`, in order.
export function earlierStages(c, pack, stageIndex) {
  return (c.stageLog || [])
    .filter((l) => l.stageIndex < stageIndex && l.sentAt)
    .sort((a, b) => a.stageIndex - b.stageIndex)
    .map((l) => {
      const stage = pack.stages[l.stageIndex] || {};
      const replies = l.replies || [];
      return { stage, log: l, reply: replies[replies.length - 1] || null };
    });
}

function stageSentence({ stage, log, reply }) {
  const date = isoDay(log.sentAt);
  const how = CHANNEL[log.channel] ? ` ${CHANNEL[log.channel]}` : '';
  const ref = log.referenceNumber ? ` (reference ${log.referenceNumber})` : '';
  const action = stage.type === 'portal'
    ? `filed a complaint on ${stage.portalName || stage.label}${how}${ref}`
    : `wrote to ${log.recipient || stage.recipient || 'them'}${how}${ref}`;
  let result;
  if (reply?.outcome === 'rejected') result = `On ${isoDay(reply.receivedAt)} the claim was rejected.`;
  else if (reply?.outcome === 'partial') result = `On ${isoDay(reply.receivedAt)} only part of the claim was paid${reply.amountPaid ? ` (${inr(reply.amountPaid)})` : ''}.`;
  else if (log.outcome === 'no_response' || reply?.outcome === 'no_response') result = `No reply was received within the ${stage.responseDays}-day period.`;
  else result = 'No satisfactory reply has been received.';
  return `On ${date}, I ${action}. ${result}`;
}

// One paragraph telling the reader what has already been tried, and what has been paid.
export function historyParagraph(earlier, paid) {
  const parts = earlier.map(stageSentence);
  if (paid > 0) parts.push(`In total ${inr(paid)} has been paid so far, and the amounts in this claim take that into account.`);
  return parts.length ? parts.join(' ') : null;
}

// The letter as the pack would write it today, with the earlier stages referenced.
export function generateLetter(c, pack, stageIndex, user) {
  const stage = pack.stages[stageIndex];
  if (!stage) throw badRequest('Unknown stage.');
  const logic = getPackLogic(pack.key);
  const facts = c.facts || {};
  const derived = logic.derive(facts);
  derived.previousSentAt = (c.stageLog || []).find((s) => s.stageIndex === stageIndex - 1)?.sentAt;
  const history = historyParagraph(earlierStages(c, pack, stageIndex), paidTotal(c));
  return logic.letter(stage.key, { facts, derived, calc: c.calculation, findings: c.findings, userName: user?.name, history });
}

const findSaved = (c, stageIndex) => (c.letters || []).find((l) => l.stageIndex === stageIndex);

function checkStage(c, pack, stageIndex) {
  if (!Number.isInteger(stageIndex) || stageIndex < 0 || !pack.stages[stageIndex]) throw badRequest('Unknown stage.');
  if (stageIndex > c.stageIndex) throw badRequest('That stage is not open yet.');
}

// The saved draft for a stage, or a freshly generated one. `letter` is ready for the PDF renderer.
export function getLetterDraft(c, pack, stageIndex, user) {
  checkStage(c, pack, stageIndex);
  const generated = generateLetter(c, pack, stageIndex, user);
  const saved = findSaved(c, stageIndex);
  if (!saved) {
    return {
      letter: generated,
      draft: { stageIndex, to: generated.to, recipientEmail: '', subject: generated.subject, paragraphs: generated.paragraphs, editedAt: null, saved: false },
    };
  }
  const draft = { stageIndex, to: saved.to, recipientEmail: saved.recipientEmail || '', subject: saved.subject, paragraphs: [...saved.paragraphs], editedAt: saved.editedAt, saved: true };
  return { letter: { ...generated, to: draft.to, subject: draft.subject, paragraphs: draft.paragraphs, recipientEmail: draft.recipientEmail }, draft };
}

export function saveLetterDraft(c, pack, { stageIndex, to, recipientEmail, subject, paragraphs }, now = new Date()) {
  checkStage(c, pack, stageIndex);
  const clean = { to: to.trim(), recipientEmail: (recipientEmail || '').trim(), subject: subject.trim(), paragraphs: paragraphs.map((p) => p.trim()).filter(Boolean), editedAt: now };
  if (!clean.paragraphs.length) throw badRequest('A letter needs at least one paragraph.', { fields: { paragraphs: 'Write at least one paragraph.' } });
  const saved = findSaved(c, stageIndex);
  if (saved) Object.assign(saved, clean);
  else {
    c.letters = c.letters || [];
    c.letters.push({ stageIndex, ...clean });
  }
  return { stageIndex, ...clean, saved: true };
}

import { addDays, toDate } from '../utils/dates.js';
import { round2, inr } from '../utils/money.js';
import { badRequest, conflict } from '../utils/AppError.js';

// Escalation workflow rules, kept free of the database so they can be unit tested.
// Each function works on a Mongoose case document or a plain object of the same shape.

export const paidTotal = (c) => round2((c.payments || []).reduce((s, p) => s + (Number(p.amount) || 0), 0));

// Payments received after claims count as paid, so the gap shrinks as money comes in.
export function withPayments(calc, payments = []) {
  const paid = round2(payments.reduce((s, p) => s + (Number(p.amount) || 0), 0));
  if (!paid) return { ...calc, paid: 0 };
  const offered = round2((calc.offered || 0) + paid);
  const notes = [...(calc.notes || []), `Includes ${inr(paid)} paid after your claims were sent.`];
  return { ...calc, offered, paid, gap: round2((calc.owed || 0) - offered), notes };
}

export const currentLog = (c) => (c.stageLog || []).find((s) => s.stageIndex === c.stageIndex);
export const lastReply = (log) => (log?.replies?.length ? log.replies[log.replies.length - 1] : null);

// Builds the stage log entry for mark_sent. Portal complaints must carry their reference number.
export function sentEntry(stage, stageIndex, { channel, recipient, referenceNumber, sentAt } = {}, now = new Date()) {
  const when = toDate(sentAt) || now;
  if (when > now) throw badRequest('The sent date cannot be in the future.');
  const ref = (referenceNumber || '').trim();
  if (stage.type === 'portal' && !ref) {
    throw badRequest(`Enter the complaint or reference number ${stage.portalName || 'the portal'} gave you.`, { fields: { referenceNumber: 'Reference number is required for portal complaints.' } });
  }
  return {
    stageIndex,
    stageKey: stage.key,
    sentAt: when,
    dueAt: addDays(when, stage.responseDays),
    outcome: 'pending',
    channel: channel || (stage.type === 'portal' ? 'portal' : 'email'),
    recipient: (recipient || '').trim() || stage.recipient,
    referenceNumber: ref || undefined,
    replies: [],
  };
}

// Records a reply on the current stage. Returns what the caller still has to do.
export function recordReply(c, { receivedAt, outcome, amountPaid, text }, now = new Date()) {
  if (c.status !== 'awaiting_response') throw conflict('Replies can only be recorded while you are waiting for a response.');
  const log = currentLog(c);
  if (!log) throw conflict('Mark the letter as sent before recording a reply.');
  const when = toDate(receivedAt) || now;
  if (when > now) throw badRequest('The reply date cannot be in the future.');
  if (log.sentAt && when < toDate(log.sentAt)) throw badRequest('The reply cannot be dated before the letter was sent.');
  const amount = round2(Number(amountPaid) || 0);

  log.replies = log.replies || [];
  log.replies.push({ receivedAt: when, outcome, amountPaid: amount || undefined, text: text?.trim() || undefined });
  if (amount > 0) {
    c.payments = c.payments || [];
    c.payments.push({ amount, date: when, stageIndex: c.stageIndex });
  }

  const resolved = outcome === 'paid_full';
  if (resolved) {
    log.outcome = 'resolved';
    c.status = 'resolved';
    c.amountRecovered = paidTotal(c);
  } else {
    log.outcome = outcome;
  }
  return { resolved, paymentAdded: amount > 0 };
}

// Why we are escalating. An explicit choice wins, then the latest reply, else "no reply".
// Rejected or part-paid claims can move on at once; silence must wait for the deadline.
export function escalationReason(c, explicit, deadline) {
  const reply = lastReply(currentLog(c));
  const reason = explicit || (reply && reply.outcome !== 'paid_full' ? reply.outcome : 'no_response');
  if (reason === 'no_response' && !deadline?.canEscalateForNoResponse) {
    const due = deadline?.dueAt ? new Date(deadline.dueAt).toLocaleDateString('en-IN') : 'the reply deadline';
    throw conflict(`Give them until ${due} to reply. You can escalate earlier only if they rejected or part-paid your claim.`);
  }
  return reason;
}

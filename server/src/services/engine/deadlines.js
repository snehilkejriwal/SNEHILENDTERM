import { addDays, toDate } from '../../utils/dates.js';

const DAY = 24 * 60 * 60 * 1000;

// Deadlines are computed when a case is read, not by a background job.
// Free hosting (Render) sleeps idle servers, so a cron job could silently miss runs;
// computing on read is always correct.
export function computeDeadline(caseDoc, pack, now = new Date()) {
  const log = (caseDoc.stageLog || []).find((s) => s.stageIndex === caseDoc.stageIndex);
  const stage = pack?.stages?.[caseDoc.stageIndex];
  if (!stage) return null;
  if (!log?.sentAt || caseDoc.status !== 'awaiting_response') {
    return { stageIndex: caseDoc.stageIndex, stageLabel: stage.label, state: 'not_started' };
  }
  const dueAt = log.dueAt ? toDate(log.dueAt) : addDays(log.sentAt, stage.responseDays);
  const daysLeft = Math.ceil((dueAt - now) / DAY);
  let state = 'on_track';
  if (daysLeft < 0) state = 'overdue';
  else if (daysLeft <= 3) state = 'due_soon';
  const total = stage.responseDays * DAY;
  const progress = Math.min(1, Math.max(0, (now - toDate(log.sentAt)) / total));
  return {
    stageIndex: caseDoc.stageIndex,
    stageLabel: stage.label,
    sentAt: log.sentAt,
    dueAt,
    daysLeft,
    state,
    progress,
    canEscalateForNoResponse: daysLeft < 0,
    hasNextStage: caseDoc.stageIndex < pack.stages.length - 1,
  };
}

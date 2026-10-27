import { Case } from '../models/Case.js';
import { Pack } from '../models/Pack.js';
import { Rule } from '../models/Rule.js';
import { getPackLogic } from './packs/registry.js';
import { runRules } from './engine/rulesEngine.js';
import { computeDeadline } from './engine/deadlines.js';
import { availableActions } from './engine/stateMachine.js';
import { withPayments, paidTotal } from './workflow.js';
import { notFound, badRequest } from '../utils/AppError.js';

export async function loadPack(key) {
  const pack = await Pack.findOne({ key }).lean();
  if (!pack) throw notFound('That case type does not exist.');
  return pack;
}

// A claim belongs to the person who opened it; nobody else (admins included) can read or change it.
// Returns 404 (not 403) for other people's cases so their existence isn't revealed.
export async function getOwnedCase(id, user) {
  const c = await Case.findById(id);
  if (!c) throw notFound('Case not found.');
  if (String(c.owner) !== String(user._id)) throw notFound('Case not found.');
  return c;
}

// The heart of the product: derived facts → calculation → rules in force → findings.
export async function analyzeCase(caseDoc, pack) {
  const logic = getPackLogic(pack.key);
  if (!logic) throw badRequest('This case type cannot be analysed yet.');
  const facts = caseDoc.facts || {};
  const derived = logic.derive(facts);
  // Money received after claims were sent counts as paid, so the gap shrinks.
  const calc = withPayments(logic.calculate(facts, derived), caseDoc.payments || []);
  // Rules compare whole rupees, so a few paise left after a payment never count as a shortfall.
  const combined = { ...facts, ...derived, owedAmount: calc.owed, offeredTotal: calc.offered, gapAmount: Math.round(calc.gap) };
  const rules = await Rule.find({ packKey: pack.key }).lean();
  const findings = runRules(rules, combined, facts[pack.referenceDateField]);
  caseDoc.calculation = { ...calc, at: new Date() };
  caseDoc.findings = findings;
  return { derived, calc, findings };
}

export function serializeCase(caseDoc, pack) {
  const c = caseDoc.toObject ? caseDoc.toObject() : caseDoc;
  return {
    id: c._id,
    packKey: c.packKey,
    packName: pack?.name,
    title: c.title,
    status: c.status,
    stageIndex: c.stageIndex,
    stages: pack?.stages || [],
    facts: c.facts,
    extraction: c.extraction,
    documents: (c.documents || []).map((d) => ({ id: d._id, name: d.name, kind: d.kind, size: d.size, charCount: d.charCount, uploadedAt: d.uploadedAt, textPreview: d.textPreview })),
    findings: c.findings,
    calculation: c.calculation,
    stageLog: c.stageLog,
    letters: c.letters || [],
    payments: c.payments || [],
    paidTotal: paidTotal(c),
    amountRecovered: c.amountRecovered,
    history: [...(c.history || [])].reverse(),
    deadline: pack ? computeDeadline(c, pack) : null,
    actions: availableActions(c),
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  };
}

export function summarizeCase(c, pack) {
  return {
    id: c._id,
    packKey: c.packKey,
    packName: pack?.name,
    title: c.title,
    status: c.status,
    stageIndex: c.stageIndex,
    stageLabel: pack?.stages?.[c.stageIndex]?.label,
    stageCount: pack?.stages?.length || 0,
    owed: c.calculation?.owed ?? null,
    gap: c.calculation?.gap ?? null,
    amountRecovered: c.amountRecovered,
    topSeverity: c.findings?.[0]?.severity || null,
    findingCount: c.findings?.length || 0,
    deadline: pack ? computeDeadline(c, pack) : null,
    updatedAt: c.updatedAt,
  };
}

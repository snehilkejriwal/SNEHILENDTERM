import { Case } from '../models/Case.js';
import { Pack } from '../models/Pack.js';
import { loadPack, getOwnedCase, analyzeCase, serializeCase, summarizeCase } from '../services/caseService.js';
import { extractText } from '../services/extraction/pdfText.js';
import { extractFacts } from '../services/extraction/extractFacts.js';
import { extractByPatterns } from '../services/extraction/patternExtract.js';
import { env } from '../config/env.js';
import { coerceFacts, missingRequired } from '../services/extraction/coerce.js';
import { nextStatus } from '../services/engine/stateMachine.js';
import { computeDeadline } from '../services/engine/deadlines.js';
import { renderLetterPdf } from '../services/letters/pdfLetter.js';
import { renderCaseFilePdf } from '../services/letters/pdfCaseFile.js';
import { getLetterDraft, saveLetterDraft } from '../services/letters/compose.js';
import { buildFilingPack } from '../services/filing.js';
import { sentEntry, recordReply, escalationReason, currentLog, paidTotal } from '../services/workflow.js';
import { badRequest, conflict } from '../utils/AppError.js';

const record = (c, action, from, note) => c.history.push({ action, from, to: c.status, stageIndex: c.stageIndex, note });

export async function createCase(req, res) {
  const pack = await loadPack(req.body.packKey);
  if (pack.status !== 'live') throw badRequest(`${pack.name} cases are coming soon.`);
  // Pre-fill answers we already know, such as the account holder's name.
  const facts = {};
  for (const f of pack.factSchema) if (f.prefill === 'userName' && req.user.name) facts[f.key] = req.user.name;
  const c = new Case({ owner: req.user._id, packKey: pack.key, title: req.body.title, facts });
  record(c, 'create', null, `Opened a ${pack.name} case`);
  await c.save();
  res.status(201).json({ case: serializeCase(c, pack) });
}

export async function listCases(req, res) {
  const filter = { owner: req.user._id };
  if (req.query.status) filter.status = req.query.status;
  const [cases, packs] = await Promise.all([Case.find(filter).sort({ updatedAt: -1 }).lean(), Pack.find().lean()]);
  const byKey = Object.fromEntries(packs.map((p) => [p.key, p]));
  const items = cases.map((c) => summarizeCase(c, byKey[c.packKey]));

  const open = items.filter((c) => !['resolved', 'closed'].includes(c.status));
  const summary = {
    total: items.length,
    open: open.length,
    overdue: open.filter((c) => c.deadline?.state === 'overdue').length,
    claimed: open.reduce((s, c) => s + Math.max(0, c.gap || 0), 0),
    recovered: items.reduce((s, c) => s + (c.amountRecovered || 0), 0),
  };
  res.json({ cases: items, summary });
}

export async function getCase(req, res) {
  const c = await getOwnedCase(req.params.id, req.user);
  res.json({ case: serializeCase(c, await loadPack(c.packKey)) });
}

export async function deleteCase(req, res) {
  const c = await getOwnedCase(req.params.id, req.user);
  await c.deleteOne();
  res.status(204).end();
}

export async function addDocuments(req, res) {
  const c = await getOwnedCase(req.params.id, req.user);
  const pack = await loadPack(c.packKey);
  if (c.status !== 'draft') throw conflict('Unlock the case to add documents.');

  const files = req.files || [];
  const pasted = (req.body.text || '').trim();
  if (!files.length && !pasted) throw badRequest('Add at least one PDF, or paste the text of your documents.');

  const texts = [];
  for (const f of files) {
    const text = await extractText(f);
    texts.push(`[${f.originalname}]\n${text}`);
    c.documents.push({ name: f.originalname, kind: f.mimetype, size: f.size, textPreview: text.slice(0, 600), charCount: text.length });
  }
  if (pasted) {
    const text = pasted.slice(0, 20000);
    texts.push(`[Pasted text]\n${text}`);
    c.documents.push({ name: 'Pasted text', kind: 'text/plain', size: text.length, textPreview: text.slice(0, 600), charCount: text.length });
  }
  if (c.documents.length > 12) throw badRequest('A case can hold at most 12 documents.');

  // Fill facts in two passes, never overwriting anything already filled in:
  //   1. patterns: fast, free and exact for common ticket / payslip / settlement layouts
  //   2. AI (if configured): fills whatever is still empty, e.g. unusual layouts
  // Anything found in neither pass stays empty for the user to fill.
  const allText = texts.join('\n\n');
  const current = { ...(c.facts || {}) };
  const isEmpty = (k) => current[k] === undefined || current[k] === null || current[k] === '';
  const byPattern = [];
  const byAi = [];

  const { facts: patternFacts } = coerceFacts(pack.factSchema, extractByPatterns(pack.key, allText));
  for (const [k, v] of Object.entries(patternFacts)) if (isEmpty(k)) { current[k] = v; byPattern.push(k); }

  let lowConfidence = [];
  let aiMessage = null;
  if (env.LLM_PROVIDER !== 'none') {
    try {
      const result = await extractFacts(pack, allText);
      for (const [k, v] of Object.entries(result.facts)) if (isEmpty(k)) { current[k] = v; byAi.push(k); }
      lowConfidence = result.lowConfidence.filter((k) => byAi.includes(k));
    } catch (err) {
      aiMessage = err.expose ? err.message : 'The AI reader failed.';
    }
  }

  c.facts = current;
  c.markModified('facts');
  const source = byAi.length && byPattern.length ? 'pattern+ai' : byAi.length ? 'ai' : byPattern.length ? 'pattern' : 'manual';
  const filled = [...byPattern, ...byAi];
  const previouslyFilled = (c.extraction?.filled || []).filter((k) => !filled.includes(k));
  c.extraction = { source, lowConfidence, filled: [...previouslyFilled, ...filled], warnings: aiMessage ? [aiMessage] : [], at: new Date() };
  const extraction = { ok: filled.length > 0 || !aiMessage, filled, byPattern, byAi, message: filled.length ? null : aiMessage || 'No facts could be read from these documents. Fill them in below.' };
  record(c, 'documents', c.status, `Added ${files.length + (pasted ? 1 : 0)} document(s)`);
  await c.save();
  res.json({ case: serializeCase(c, pack), extraction });
}

export async function updateFacts(req, res) {
  const c = await getOwnedCase(req.params.id, req.user);
  const pack = await loadPack(c.packKey);
  if (c.status !== 'draft') throw conflict('Unlock the case before editing facts.');

  const incoming = req.body.facts;
  const { facts, errors } = coerceFacts(pack.factSchema, incoming);
  if (Object.keys(errors).length) throw badRequest('Some facts need attention.', { fields: errors });

  const next = { ...(c.facts || {}), ...facts };
  // A key sent as null or '' clears that fact.
  for (const [k, v] of Object.entries(incoming)) if (v === null || v === '') delete next[k];
  c.facts = next;
  c.markModified('facts');
  if (req.body.title) c.title = req.body.title;
  if (c.extraction?.lowConfidence?.length) {
    c.extraction.lowConfidence = c.extraction.lowConfidence.filter((k) => !(k in facts));
  }
  await c.save();
  res.json({ case: serializeCase(c, pack) });
}

export async function transition(req, res) {
  const c = await getOwnedCase(req.params.id, req.user);
  const pack = await loadPack(c.packKey);
  const { action, note, outcome, amountRecovered, sentAt, channel, recipient, referenceNumber } = req.body;
  const from = c.status;
  const to = nextStatus(from, action);
  if (!to) throw conflict(`You can't ${action.replace('_', ' ')} a case that is ${from.replace('_', ' ')}.`);

  switch (action) {
    case 'confirm': {
      const missing = missingRequired(pack.factSchema, c.facts || {});
      if (missing.length) throw badRequest('Fill in the required facts before confirming.', { fields: Object.fromEntries(missing.map((f) => [f.key, `${f.label} is required.`])) });
      break;
    }
    case 'unlock':
      if (c.stageLog.length) throw conflict('Facts are locked once a letter has been sent.');
      c.findings = [];
      c.calculation = undefined;
      break;
    case 'analyze':
      await analyzeCase(c, pack);
      break;
    case 'mark_sent': {
      if (!c.calculation?.at) throw conflict('Analyse the case before sending a letter.');
      // Portal stages must carry the complaint number the portal issued.
      const stage = pack.stages[c.stageIndex];
      c.stageLog.push(sentEntry(stage, c.stageIndex, { channel, recipient, referenceNumber, sentAt }));
      // Keep the letter exactly as sent, so later payments don't rewrite it in the case file.
      if (stage.type !== 'portal' && !(c.letters || []).some((l) => l.stageIndex === c.stageIndex)) {
        const { draft } = getLetterDraft(c, pack, c.stageIndex, req.user);
        saveLetterDraft(c, pack, draft);
      }
      break;
    }
    case 'escalate': {
      if (c.stageIndex >= pack.stages.length - 1) throw conflict('This is already the last stage. Mark the case resolved or close it.');
      // Rejected or part-paid claims can move on at once; silence must wait for the deadline.
      const reason = escalationReason(c, outcome, computeDeadline(c, pack));
      const log = currentLog(c);
      if (log) log.outcome = reason;
      c.stageIndex += 1;
      break;
    }
    case 'resolve': {
      const log = c.stageLog.find((s) => s.stageIndex === c.stageIndex);
      if (log) log.outcome = 'resolved';
      c.amountRecovered = amountRecovered ?? null;
      break;
    }
    default:
      break;
  }
  c.status = to;
  record(c, action, from, note);
  await c.save();
  res.json({ case: serializeCase(c, pack) });
}

// Letters and filings need the analysis, and only stages already reached can be opened.
function stageParam(req, c) {
  const n = req.query.stage ?? c.stageIndex;
  if (n > c.stageIndex) throw badRequest('That stage is not open yet.');
  return n;
}

export async function downloadLetter(req, res) {
  const c = await getOwnedCase(req.params.id, req.user);
  const pack = await loadPack(c.packKey);
  if (!c.calculation?.at) throw conflict('Analyse the case before generating a letter.');
  const stageIndex = stageParam(req, c);
  const stage = pack.stages[stageIndex];
  if (!stage) throw badRequest('Unknown stage.');
  // Uses the user's edited draft when there is one.
  const { letter } = getLetterDraft(c, pack, stageIndex, req.user);

  const filename = `settlewise-${pack.key}-${stage.key}.pdf`;
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  renderLetterPdf({ letter, user: req.user, stage }).pipe(res);
}

export async function getLetterDraftHandler(req, res) {
  const c = await getOwnedCase(req.params.id, req.user);
  const pack = await loadPack(c.packKey);
  if (!c.calculation?.at) throw conflict('Analyse the case before drafting a letter.');
  const { draft } = getLetterDraft(c, pack, stageParam(req, c), req.user);
  res.json({ draft });
}

export async function saveLetterDraftHandler(req, res) {
  const c = await getOwnedCase(req.params.id, req.user);
  const pack = await loadPack(c.packKey);
  if (!c.calculation?.at) throw conflict('Analyse the case before drafting a letter.');
  const draft = saveLetterDraft(c, pack, req.body);
  record(c, 'letter_edit', c.status, `Edited the letter for ${pack.stages[draft.stageIndex].label}`);
  await c.save();
  res.json({ draft, case: serializeCase(c, pack) });
}

export async function filingPack(req, res) {
  const c = await getOwnedCase(req.params.id, req.user);
  const pack = await loadPack(c.packKey);
  if (!c.calculation?.at) throw conflict('Analyse the case before preparing a complaint.');
  res.json({ filing: buildFilingPack(c, pack, stageParam(req, c), req.user) });
}

export async function addReply(req, res) {
  const c = await getOwnedCase(req.params.id, req.user);
  const pack = await loadPack(c.packKey);
  const from = c.status;
  const { resolved, paymentAdded } = recordReply(c, req.body);
  if (paymentAdded) await analyzeCase(c, pack);
  const label = req.body.outcome.replace('_', ' ');
  record(c, resolved ? 'resolve' : 'reply', from, `Reply recorded: ${label}${req.body.amountPaid ? `, ${req.body.amountPaid} paid` : ''}`);
  await c.save();
  res.status(201).json({ case: serializeCase(c, pack) });
}

export async function caseFile(req, res) {
  const c = await getOwnedCase(req.params.id, req.user);
  const pack = await loadPack(c.packKey);
  if (!c.calculation?.at) throw conflict('Analyse the case before downloading the case file.');
  const facts = c.facts || {};
  const entries = (c.stageLog || []).map((log) => {
    const stage = pack.stages[log.stageIndex];
    if (!stage) return null;
    return stage.type === 'portal'
      ? { stage, index: log.stageIndex, log, filing: buildFilingPack(c, pack, log.stageIndex, req.user) }
      : { stage, index: log.stageIndex, log, letter: getLetterDraft(c, pack, log.stageIndex, req.user).letter };
  }).filter(Boolean);

  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition', `attachment; filename="settlewise-case-file-${pack.key}.pdf"`);
  renderCaseFilePdf({
    caseData: c.toObject(),
    pack,
    user: req.user,
    claimant: facts.employeeName || facts.passengerName || facts.tenantName || req.user.name,
    opponent: facts.employerName || facts.airline || facts.landlordName || 'Not recorded',
    paid: paidTotal(c),
    entries,
  }).pipe(res);
}

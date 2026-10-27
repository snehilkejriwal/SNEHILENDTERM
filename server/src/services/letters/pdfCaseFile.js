import PDFDocument from 'pdfkit';
import { inr } from '../../utils/money.js';
import { isoDay } from '../../utils/dates.js';
import { clean, INK, MUTED, RULE } from './pdfLetter.js';

const M = 56; // page margin
const OUTCOME = { pending: 'Awaiting reply', no_response: 'No reply', rejected: 'Rejected', partial: 'Part paid', resolved: 'Resolved', paid_full: 'Paid in full' };
const CHANNEL = { email: 'Email', post: 'Registered post', portal: 'Online portal', hand: 'By hand' };

// One PDF with everything about a claim: cover, calculation, findings, correspondence and the letters.
// `entries` has one item per stage reached: { stage, index, log, letter?, filing? }.
export function renderCaseFilePdf({ caseData: c, pack, user, claimant, opponent, paid, entries }) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: M, bottom: M, left: M, right: M }, bufferPages: true, info: { Title: clean(`Case file: ${c.title}`), Author: claimant } });
  const width = doc.page.width - 2 * M;
  const bottom = () => doc.page.height - M;
  const room = (h) => { if (doc.y + h > bottom()) doc.addPage(); };

  const heading = (text) => {
    room(60);
    doc.moveDown(0.6).fillColor(INK).font('Helvetica-Bold').fontSize(14).text(clean(text), M, doc.y, { width });
    doc.moveTo(M, doc.y + 4).lineTo(M + width, doc.y + 4).strokeColor(RULE).stroke();
    doc.moveDown(0.9).font('Helvetica').fontSize(10);
  };
  // Label on the left, value on the right; used for the cover and the money table.
  const row = (label, value, { bold = false, labelWidth = width - 140 } = {}) => {
    room(18);
    const y = doc.y;
    doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).fillColor(INK);
    doc.text(clean(label), M, y, { width: labelWidth });
    const h1 = doc.y - y;
    doc.text(clean(value), M + labelWidth, y, { width: width - labelWidth, align: 'right' });
    doc.y = y + Math.max(h1, doc.y - y) + 4;
  };
  const field = (label, value) => {
    if (value === undefined || value === null || value === '') return;
    room(16);
    const y = doc.y;
    doc.font('Helvetica').fontSize(9.5).fillColor(MUTED).text(clean(label), M, y, { width: 130 });
    doc.fillColor(INK).text(clean(value), M + 130, y, { width: width - 130 });
    doc.y = Math.max(doc.y, y + 12) + 2;
  };

  const calc = c.calculation || { items: [], owed: 0, offered: 0, gap: 0 };
  const outstanding = Math.max(0, calc.gap || 0);

  // ---- Cover ----
  doc.font('Helvetica').fontSize(9).fillColor(MUTED).text('CASE FILE', M, M + 40, { characterSpacing: 2 });
  doc.moveDown(0.6).font('Helvetica-Bold').fontSize(24).fillColor(INK).text(clean(c.title), { width });
  doc.moveDown(0.3).font('Helvetica').fontSize(12).fillColor(MUTED).text(clean(pack.name), { width });
  doc.moveDown(2);
  field('Claimant', `${claimant}${user.email ? `, ${user.email}` : ''}`);
  field('Opposite party', opponent);
  field('Claim type', pack.name);
  field('Status', String(c.status).replace(/_/g, ' '));
  field('Current stage', pack.stages[c.stageIndex]?.label);
  field('Prepared on', isoDay(new Date()));
  doc.moveDown(1.5);
  row(calc.owedLabel || 'Amount owed', inr(calc.owed), { bold: true });
  row('Offered or paid before claims', inr((calc.offered || 0) - paid));
  row('Paid after claims', inr(paid));
  row('Outstanding', inr(outstanding), { bold: true });
  doc.moveDown(3).font('Helvetica').fontSize(8.5).fillColor(MUTED)
    .text('Prepared with SettleWise from the facts confirmed by the claimant. Amounts are estimates under the rules cited. This is guidance, not legal advice.', M, doc.y, { width });

  // ---- Calculation ----
  doc.addPage();
  heading('1. Calculation');
  (calc.items || []).forEach((it) => {
    row(it.label, `${it.kind === 'debit' ? '- ' : ''}${inr(it.amount)}`);
    if (it.note) doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(clean(it.note), M, doc.y - 2, { width: width - 140 }).moveDown(0.3);
  });
  doc.moveTo(M, doc.y + 2).lineTo(M + width, doc.y + 2).strokeColor(RULE).stroke();
  doc.moveDown(0.5);
  row(calc.owedLabel || 'Total owed', inr(calc.owed), { bold: true });
  row('Offered or paid', inr(calc.offered));
  row('Outstanding', inr(outstanding), { bold: true });
  if (calc.notes?.length) {
    doc.moveDown(0.5);
    calc.notes.forEach((n) => { room(20); doc.font('Helvetica').fontSize(8.5).fillColor(MUTED).text(`- ${clean(n)}`, M, doc.y, { width }); });
  }

  // ---- Findings ----
  heading('2. Findings');
  if (!c.findings?.length) doc.fillColor(MUTED).text('No issues were found with these facts.');
  (c.findings || []).forEach((f, i) => {
    room(50);
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(`${i + 1}. ${clean(f.title)}`, M, doc.y, { width });
    doc.font('Helvetica').fontSize(10).text(clean(f.message), { width, lineGap: 1.5 });
    doc.fontSize(8.5).fillColor(MUTED).text(clean(f.citation), { width }).moveDown(0.6);
  });

  // ---- Correspondence log ----
  heading('3. Correspondence log');
  pack.stages.forEach((stage, i) => {
    const entry = entries.find((e) => e.index === i);
    room(40);
    doc.font('Helvetica-Bold').fontSize(10.5).fillColor(INK).text(`Stage ${i + 1}: ${clean(stage.label)}`, M, doc.y, { width });
    doc.moveDown(0.3);
    if (!entry?.log?.sentAt) {
      doc.font('Helvetica').fontSize(9.5).fillColor(MUTED).text(i <= c.stageIndex ? 'Not sent yet.' : 'Not reached.', M, doc.y, { width }).moveDown(0.6);
      return;
    }
    const { log } = entry;
    field('Sent', isoDay(log.sentAt));
    field('Channel', CHANNEL[log.channel] || log.channel);
    field('Recipient', log.recipient || stage.recipient);
    field('Reference number', log.referenceNumber);
    field('Reply due by', isoDay(log.dueAt));
    field('Result', OUTCOME[log.outcome] || log.outcome);
    (log.replies || []).forEach((r) => {
      field(`Reply ${isoDay(r.receivedAt)}`, `${OUTCOME[r.outcome] || r.outcome}${r.amountPaid ? `, ${inr(r.amountPaid)} paid` : ''}${r.text ? `. "${r.text.slice(0, 600)}${r.text.length > 600 ? '…' : ''}"` : ''}`);
    });
    (c.payments || []).filter((p) => p.stageIndex === i).forEach((p) => field('Payment', `${inr(p.amount)} on ${isoDay(p.date)}`));
    doc.moveDown(0.6);
  });

  // ---- Letters and complaints, in full ----
  entries.filter((e) => e.log?.sentAt && (e.letter || e.filing)).forEach((e, n) => {
    doc.addPage();
    heading(`${n === 0 ? '4. Letters and complaints. ' : ''}Stage ${e.index + 1}: ${e.stage.label}`);
    if (e.letter) {
      const l = e.letter;
      field('To', l.to);
      field('Email', l.recipientEmail);
      field('Subject', l.subject);
      field('Sent', isoDay(e.log.sentAt));
      doc.moveDown(0.8).font('Helvetica').fontSize(10.5).fillColor(INK);
      l.paragraphs.forEach((p) => { room(30); doc.text(clean(p), M, doc.y, { width, align: 'justify', lineGap: 2 }).moveDown(0.7); });
      doc.moveDown(0.6).text('Yours faithfully,').moveDown(1).font('Helvetica-Bold').text(clean(l.signOff || claimant));
    } else {
      field('Filed on', `${e.filing.portalName}${e.filing.portalUrl ? ` (${e.filing.portalUrl})` : ''}`);
      field('Filed', isoDay(e.log.sentAt));
      field('Reference number', e.log.referenceNumber);
      doc.moveDown(0.6);
      e.filing.fields.forEach((f) => field(f.label, f.value));
    }
  });

  // Page numbers on every page.
  const range = doc.bufferedPageRange();
  for (let i = range.start; i < range.start + range.count; i += 1) {
    doc.switchToPage(i);
    // Writing inside the bottom margin would otherwise start a new page.
    doc.page.margins.bottom = 0;
    doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(`${clean(c.title)}  |  Page ${i + 1} of ${range.count}`, M, doc.page.height - M + 18, { width, align: 'center', lineBreak: false });
  }
  doc.end();
  return doc;
}

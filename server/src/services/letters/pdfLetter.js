import PDFDocument from 'pdfkit';
import { inr } from '../../utils/money.js';

// PDFKit's built-in fonts have no rupee glyph, so amounts are written as "Rs." in letters.
export const clean = (s) => String(s ?? '').replace(/₹/g, 'Rs. ');

export const INK = '#16233B';
export const MUTED = '#5B6577';
export const RULE = '#D6DCE4';

export function renderLetterPdf({ letter, user, stage }) {
  const doc = new PDFDocument({ size: 'A4', margins: { top: 64, bottom: 64, left: 64, right: 64 }, info: { Title: clean(letter.subject), Author: user.name } });
  const width = doc.page.width - 128;

  doc.fillColor(INK).font('Helvetica-Bold').fontSize(11).text(clean(letter.signOff));
  doc.font('Helvetica').fillColor(MUTED).fontSize(9.5).text(user.email);
  doc.moveDown(0.3).text(new Date().toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }));
  doc.moveDown(1.2);

  doc.fillColor(INK).fontSize(10.5).font('Helvetica').text('To,');
  doc.text(clean(letter.to));
  if (letter.recipientEmail) doc.fillColor(MUTED).text(clean(letter.recipientEmail)).fillColor(INK);
  doc.moveDown(1);
  doc.font('Helvetica-Bold').text(`Subject: ${clean(letter.subject)}`, { width });
  doc.moveDown(1);
  doc.font('Helvetica').text('Dear Sir or Madam,');
  doc.moveDown(0.6);

  for (const p of letter.paragraphs.slice(0, -1)) {
    doc.text(clean(p), { width, align: 'justify', lineGap: 2 });
    doc.moveDown(0.7);
  }

  const issues = (letter.findings || []).filter((f) => f.severity !== 'info');
  if (issues.length) {
    doc.font('Helvetica-Bold').text('The issues');
    doc.moveDown(0.4);
    issues.forEach((f, i) => {
      doc.font('Helvetica-Bold').fontSize(10).text(`${i + 1}. ${clean(f.title)}`, { width });
      doc.font('Helvetica').fontSize(10).text(clean(f.message), { width, lineGap: 1.5 });
      doc.fillColor(MUTED).fontSize(8.5).text(clean(f.citation), { width });
      doc.fillColor(INK).fontSize(10.5).moveDown(0.5);
    });
    doc.moveDown(0.3);
  }

  const { calc } = letter;
  if (calc?.items?.length) {
    doc.font('Helvetica-Bold').text('Amount due');
    doc.moveDown(0.4);
    const row = (label, amount, bold) => {
      const y = doc.y;
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fontSize(10).text(clean(label), 64, y, { width: width - 120 });
      doc.text(clean(amount), 64 + width - 120, y, { width: 120, align: 'right' });
      doc.moveDown(0.25);
    };
    calc.items.forEach((it) => row(it.label, `${it.kind === 'debit' ? '- ' : ''}${inr(it.amount)}`));
    doc.moveTo(64, doc.y + 2).lineTo(64 + width, doc.y + 2).strokeColor(RULE).stroke();
    doc.moveDown(0.5);
    row(calc.owedLabel || 'Total due', inr(calc.owed), true);
    row('Already offered or paid', inr(calc.offered));
    row('Outstanding', inr(Math.max(0, calc.gap)), true);
    doc.x = 64;
    doc.moveDown(0.8);
  }

  doc.font('Helvetica').fontSize(10.5).fillColor(INK);
  doc.text(clean(letter.paragraphs[letter.paragraphs.length - 1]), 64, doc.y, { width, align: 'justify', lineGap: 2 });
  doc.moveDown(1.4);
  doc.text('Yours faithfully,');
  doc.moveDown(2);
  doc.font('Helvetica-Bold').text(clean(letter.signOff));

  doc.moveDown(2);
  doc.font('Helvetica').fontSize(8).fillColor(MUTED).text(
    `Stage: ${clean(stage.label)}. How to send: ${clean(stage.howToSend || 'by email and registered post')}. Prepared with SettleWise. This letter is guidance, not legal advice.`,
    { width }
  );
  doc.end();
  return doc;
}

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as rent from '../src/services/packs/rent/index.js';
import { rules } from '../src/seed/rules.js';
import { runRules } from '../src/services/engine/rulesEngine.js';
import { extractByPatterns } from '../src/services/extraction/patternExtract.js';

const RENT_RULES = rules.filter((r) => r.packKey === 'rent').map((r) => ({ active: true, ...r }));

// The same steps as analyzeCase: derive, calculate, then run the rules on facts + derived + totals.
function analyse(facts, now = new Date('2026-10-27')) {
  const derived = rent.derive(facts, now);
  const calc = rent.calculate(facts, derived);
  const combined = { ...facts, ...derived, owedAmount: calc.owed, offeredTotal: calc.offered, gapAmount: calc.gap };
  const findings = runRules(RENT_RULES, combined, facts.moveOutDate);
  return { derived, calc, codes: findings.map((f) => f.code) };
}

const base = {
  tenantName: 'Ananya Iyer', landlordName: 'Suresh Gowda', propertyAddress: 'Flat 302, HSR Layout, Bengaluru', state: 'Karnataka', followsMTA: 'not_sure',
  monthlyRent: 25000, depositPaid: 100000, moveOutDate: '2026-09-30',
  paintingDeduction: 15000, damageDeduction: 20000, unpaidRent: 0, amountReturned: 50000,
};

test('rent: unproven damage and painting the agreement is silent on are not deducted', () => {
  const { derived, calc, codes } = analyse(base);
  assert.equal(derived.refundDue, 100000);
  assert.equal(derived.disputedDeductions, 35000);
  assert.equal(calc.owed, 100000);
  assert.equal(calc.offered, 50000);
  assert.equal(calc.gap, 50000);
  assert.equal(calc.owedLabel, 'Estimated refund due under your agreement');
  assert.ok(calc.notes.some((n) => n.startsWith('This is an estimate based on your agreement and the evidence.')));
  for (const code of ['RENT_REFUND_SHORTFALL', 'RENT_DAMAGE_NO_PROOF', 'RENT_PAINTING_CLEANING']) assert.ok(codes.includes(code), `${code} expected`);
  assert.ok(codes.includes('RENT_STATE_UNSURE'));
  assert.ok(!codes.includes('RENT_MTA_REFUND_ON_HANDOVER'), 'MTA is only used when the state follows it');
});

test('rent: damage with proof is deducted', () => {
  const { derived, calc, codes } = analyse({ ...base, damageHasProof: true });
  assert.equal(derived.allowedDamage, 20000);
  assert.equal(derived.refundDue, 80000);
  assert.equal(calc.gap, 30000);
  assert.ok(calc.items.some((i) => i.key === 'damage' && i.kind === 'debit' && i.amount === 20000));
  assert.ok(!codes.includes('RENT_DAMAGE_NO_PROOF'));
  assert.ok(codes.includes('RENT_PAINTING_CLEANING'), 'painting is still disputable');
});

test('rent: notice shortfall, agreement deadline and MTA facts', () => {
  const { derived, codes } = analyse({ ...base, followsMTA: 'yes', depositPaid: 75000, agreementNoticeDays: 30, noticeGivenDays: 20, agreementRefundDays: 15, agreementAllowsPaintingDeduction: true, damageHasProof: true, amountReturned: 10000 });
  // 75,000 − (8,333.33 notice + 15,000 painting + 20,000 damage) = 31,666.67 due; only 10,000 returned.
  assert.equal(derived.refundDue, 31666.67);
  assert.equal(derived.noticeShortfallDays, 10);
  assert.equal(derived.allowedNoticeDeduction, 8333.33);
  assert.equal(derived.allowedPainting, 15000);
  assert.equal(derived.daysSinceMoveOut, 27);
  assert.equal(derived.refundLate, true);
  assert.equal(derived.depositAboveMtaCap, true);
  for (const code of ['RENT_LATE_REFUND', 'RENT_MTA_CAP', 'RENT_NOTICE_SHORT', 'RENT_MTA_REFUND_ON_HANDOVER']) assert.ok(codes.includes(code), `${code} expected`);
  assert.ok(!codes.includes('RENT_PAINTING_CLEANING'), 'the agreement allows painting here');
});

test('rent: letters list each disputed deduction and the amount still due', () => {
  const { derived, calc } = analyse(base);
  const l = rent.letter('legal_notice', { facts: base, derived, calc, findings: [], userName: 'x', history: null });
  const text = l.paragraphs.join(' ');
  assert.match(text, /₹15,000 for painting and cleaning/);
  assert.match(text, /₹20,000 for damage: no bills or photos/);
  assert.match(text, /₹50,000 is still to be refunded/);
  assert.doesNotMatch(text, /Model Tenancy Act/, 'not cited unless the state follows it');
  assert.equal(l.signOff, 'Ananya Iyer');
});

test('rent: pattern extractor reads a short agreement and a landlord message', () => {
  const agreement = `RENTAL AGREEMENT
This agreement is made between Mr. Suresh Gowda (hereinafter called the Landlord) and Ms. Ananya Iyer (hereinafter called the Tenant) for the premises at Flat 302, Lakeview Residency, HSR Layout, Bengaluru 560102 (the Premises).
The Tenant shall pay a monthly rent of Rs. 25,000.
The Tenant has paid a security deposit of Rs. 1,00,000.
Either party may end this agreement by giving one month's written notice.
The deposit shall be refunded within 15 days of the Tenant vacating the premises.`;
  const f = extractByPatterns('rent', agreement);
  assert.equal(f.monthlyRent, 25000);
  assert.equal(f.depositPaid, 100000);
  assert.equal(f.agreementNoticeDays, 30);
  assert.equal(f.agreementRefundDays, 15);
  assert.equal(f.landlordName, 'Suresh Gowda');
  assert.equal(f.tenantName, 'Ananya Iyer');
  assert.equal(f.propertyAddress, 'Flat 302, Lakeview Residency, HSR Layout, Bengaluru 560102');
  assert.equal(f.paintingDeduction, undefined, 'nothing that is not in the text');

  // PDF text breaks lines mid-sentence; names and the address must not run on or stop short.
  const pdfLike = extractByPatterns('rent', 'This agreement is made between Mr. Suresh Gowda (hereinafter called the Landlord) and Ms. Ananya Iyer (hereinafter called the Tenant) for the premises at Flat\n302, Lakeview Residency, 4th Cross, HSR Layout, Bengaluru 560102 (the Premises).\nLandlord: Suresh Gowda\nTenant: Ananya Iyer');
  assert.equal(pdfLike.landlordName, 'Suresh Gowda');
  assert.equal(pdfLike.tenantName, 'Ananya Iyer');
  assert.equal(pdfLike.propertyAddress, 'Flat 302, Lakeview Residency, 4th Cross, HSR Layout, Bengaluru 560102');

  const msg = extractByPatterns('rent', 'Painting charges Rs. 15,000\nCleaning Rs. 3,000\nDamage Rs. 20,000\nElectricity dues Rs. 1,200\nReturning Rs. 50,000 today.');
  assert.deepEqual(msg, { paintingDeduction: 15000, cleaningDeduction: 3000, damageDeduction: 20000, utilityDuesDeduction: 1200, amountReturned: 50000 });
});

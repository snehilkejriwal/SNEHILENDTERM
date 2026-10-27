import { daysBetween, toDate, isoDay } from '../../../utils/dates.js';
import { round2, inr } from '../../../utils/money.js';

// Rental deposit refunds. The law here differs by state, so this pack works from the rental
// agreement and the evidence. The Model Tenancy Act, 2021 is used only when the user says their
// state follows it, and only for s.11: a residential deposit of at most two months' rent, refundable
// when the landlord takes back vacant possession, after deducting proven dues.
// No state-specific deposit cap or refund deadline is assumed.

export const OWED_LABEL = 'Estimated refund due under your agreement';
const ESTIMATE_NOTE = 'This is an estimate based on your agreement and the evidence. Rules differ by state; check your agreement before sending.';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const has = (v) => typeof v === 'number' && Number.isFinite(v);

export function derive(f, now = new Date()) {
  const d = {};
  const rent = num(f.monthlyRent);
  d.dailyRent = round2(rent / 30);

  // Rent for notice not given can fairly be kept, at the daily rate.
  d.noticeShortfallDays = has(f.agreementNoticeDays) && has(f.noticeGivenDays) ? Math.max(0, f.agreementNoticeDays - f.noticeGivenDays) : 0;
  // Multiply before rounding, so 10 days of ₹25,000 rent is ₹8,333.33, not ₹8,333.30.
  d.allowedNoticeDeduction = round2((d.noticeShortfallDays * rent) / 30);

  // A deduction counts only if the agreement allows it (painting, cleaning) or it is proven (damage, utilities).
  d.paintingCleaning = round2(num(f.paintingDeduction) + num(f.cleaningDeduction));
  d.allowedPainting = f.agreementAllowsPaintingDeduction === true ? d.paintingCleaning : 0;
  d.allowedDamage = f.damageHasProof === true ? num(f.damageDeduction) : 0;
  d.allowedUtility = f.utilityHasProof === true ? num(f.utilityDuesDeduction) : 0;
  d.allowedDeductions = round2(num(f.unpaidRent) + d.allowedNoticeDeduction + d.allowedPainting + d.allowedDamage + d.allowedUtility);
  d.disputedDeductions = round2((d.paintingCleaning - d.allowedPainting) + (num(f.damageDeduction) - d.allowedDamage) + (num(f.utilityDuesDeduction) - d.allowedUtility));
  d.refundDue = Math.max(0, round2(num(f.depositPaid) - d.allowedDeductions));

  // Deadline: the agreement's, else (MTA states) on handover, else none we can rely on.
  d.refundDeadlineDays = has(f.agreementRefundDays) ? f.agreementRefundDays : f.followsMTA === 'yes' ? 0 : null;
  const out = toDate(f.moveOutDate);
  const until = toDate(f.refundReceivedDate) || now;
  d.daysSinceMoveOut = out ? Math.max(0, daysBetween(out, until)) : null;
  d.refundLate = d.refundDeadlineDays !== null && d.daysSinceMoveOut !== null && d.daysSinceMoveOut > d.refundDeadlineDays && num(f.amountReturned) < d.refundDue;
  d.depositAboveMtaCap = f.followsMTA === 'yes' && num(f.depositPaid) > 2 * rent;
  return d;
}

export function calculate(f, d) {
  const items = [{ key: 'deposit', label: 'Security deposit paid', amount: num(f.depositPaid), kind: 'credit', note: 'From your rental agreement or receipt' }];
  if (num(f.unpaidRent)) items.push({ key: 'unpaidRent', label: 'Unpaid rent', amount: num(f.unpaidRent), kind: 'debit', note: 'Rent still owed at move-out can be deducted' });
  if (d.allowedNoticeDeduction) {
    items.push({ key: 'notice', label: `Rent for ${d.noticeShortfallDays} days of notice not given`, amount: d.allowedNoticeDeduction, kind: 'debit', note: `Your agreement asks for ${num(f.agreementNoticeDays)} days' notice; monthly rent ÷ 30 × days short` });
  }
  if (d.allowedPainting) items.push({ key: 'painting', label: 'Painting and cleaning', amount: d.allowedPainting, kind: 'debit', note: 'Your agreement says these come out of the deposit' });
  if (d.allowedDamage) items.push({ key: 'damage', label: 'Damage', amount: d.allowedDamage, kind: 'debit', note: 'The landlord showed bills or photos for it' });
  if (d.allowedUtility) items.push({ key: 'utility', label: 'Utility dues', amount: d.allowedUtility, kind: 'debit', note: 'The landlord showed the bills' });

  const notes = [ESTIMATE_NOTE];
  if (d.disputedDeductions > 0) notes.push(`${inr(d.disputedDeductions)} of the landlord's deductions is not counted, because the agreement doesn't allow it or there is no proof.`);
  if (f.followsMTA === 'yes') notes.push('As your state follows the Model Tenancy Act, 2021, the deposit is refundable when the landlord takes back vacant possession, after deducting proven dues (s.11).');

  const owed = d.refundDue;
  const offered = num(f.amountReturned);
  return { items, owed, offered, gap: round2(owed - offered), notes, owedLabel: OWED_LABEL };
}

// Each deduction the landlord took that the agreement or the evidence doesn't support, and why.
function disputedLines(f, d) {
  const lines = [];
  if (d.paintingCleaning > d.allowedPainting) {
    lines.push(`${inr(d.paintingCleaning - d.allowedPainting)} for painting and cleaning: our agreement does not say these come out of the deposit, and routine repainting is normal wear and tear.`);
  }
  if (num(f.damageDeduction) > d.allowedDamage) {
    lines.push(`${inr(num(f.damageDeduction) - d.allowedDamage)} for damage: no bills or photos have been shown, and a deduction can only cover an actual, proven loss.`);
  }
  if (num(f.utilityDuesDeduction) > d.allowedUtility) {
    lines.push(`${inr(num(f.utilityDuesDeduction) - d.allowedUtility)} for utility dues: no bills have been shown for this amount.`);
  }
  return lines;
}

// `history` is a paragraph describing earlier stages (dates, references, replies, payments), or null.
export function letter(stageKey, { facts: f, derived: d, calc, findings, userName, history }) {
  const name = f.tenantName || userName;
  const landlord = f.landlordName || 'the landlord';
  const address = f.propertyAddress || 'the rented premises';
  const intro = `I, ${name}, was your tenant at ${address}${f.moveInDate ? ` from ${isoDay(f.moveInDate)}` : ''}, at a monthly rent of ${inr(f.monthlyRent)}. I paid a security deposit of ${inr(f.depositPaid)} and handed back the keys and vacant possession on ${isoDay(f.moveOutDate) || 'the date I moved out'}.`;
  const disputed = disputedLines(f, d);
  const disputedPara = disputed.length
    ? `The following deductions are not supported by our agreement or by any evidence: ${disputed.map((l, i) => `(${i + 1}) ${l}`).join(' ')}`
    : null;
  const deadline = has(f.agreementRefundDays) ? `Our agreement requires the deposit to be refunded within ${f.agreementRefundDays} days of vacating${d.daysSinceMoveOut !== null ? `, and ${d.daysSinceMoveOut} days have now passed` : ''}.` : null;
  const mta = f.followsMTA === 'yes' ? `As ${f.state || 'my state'} follows the Model Tenancy Act, 2021, the deposit is refundable when the landlord takes back vacant possession, after deducting only proven dues (section 11).` : null;
  const amountLine = `Going by our agreement, the refund due to me is ${inr(calc.owed)}. You have returned ${inr(calc.offered)}, so ${inr(Math.max(0, calc.gap))} is still to be refunded.`;
  const extra = (...xs) => xs.filter(Boolean);

  const byStage = {
    landlord_demand: {
      to: `${landlord}, landlord of ${address}`,
      subject: `Refund of security deposit: ${address}`,
      paragraphs: [
        intro,
        ...extra(history, disputedPara, deadline, mta),
        amountLine,
        `Please refund ${inr(Math.max(0, calc.gap))} to my bank account within 7 days of this message and confirm in writing. If any deduction is for a real cost, please share the bills or photos.`,
      ],
    },
    legal_notice: {
      to: `${landlord}, landlord of ${address}`,
      subject: `Notice for refund of security deposit: ${address}`,
      paragraphs: [
        intro,
        history || 'I wrote to you earlier asking for my deposit to be refunded. The amount has not been refunded.',
        ...extra(disputedPara, deadline, mta),
        amountLine,
        `Take notice that unless ${inr(Math.max(0, calc.gap))} is refunded within 15 days of receiving this notice, I will apply to the Rent Controller / Rent Authority or the civil court for its recovery, with interest and costs, without further notice.`,
      ],
    },
    rent_authority: {
      to: 'The Rent Controller / Rent Authority (or the competent civil court)',
      subject: `Application for refund of security deposit against ${landlord}`,
      paragraphs: [
        intro,
        `I ask for an order directing the landlord, ${landlord}, to refund the balance of my security deposit. My demand and formal notice have not resulted in a refund.`,
        ...extra(history, disputedPara, deadline, mta),
        amountLine,
        `I request that ${landlord} be directed to refund ${inr(Math.max(0, calc.gap))}, with interest and the costs of this application. Copies of the rental agreement, payment proof for the deposit, my letters and any replies are enclosed.`,
      ],
    },
  };
  const base = byStage[stageKey] || byStage.landlord_demand;
  return { ...base, findings, calc, signOff: name };
}

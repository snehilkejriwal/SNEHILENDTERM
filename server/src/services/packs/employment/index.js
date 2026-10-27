import { daysBetween, toDate, workingDaysAfter, isoDay } from '../../../utils/dates.js';
import { round2, inr } from '../../../utils/money.js';

// The four Labour Codes came into force on 21 November 2025.
export const LABOUR_CODES_DATE = new Date('2025-11-21T00:00:00.000Z');
const GRATUITY_CEILING = 2000000; // ₹20 lakh

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);

// Turns the confirmed facts into the numbers the rules and letters need.
export function derive(f, now = new Date()) {
  const joining = toDate(f.joiningDate);
  const lastDay = toDate(f.lastWorkingDate);
  const d = {};
  if (!joining || !lastDay || lastDay < joining) return d;

  d.underLabourCodes = lastDay >= LABOUR_CODES_DATE;
  d.serviceDays = daysBetween(joining, lastDay) + 1;
  d.serviceYears = round2(d.serviceDays / 365.25);
  const completed = Math.floor(d.serviceDays / 365.25);
  const remainderMonths = (d.serviceDays - completed * 365.25) / 30.44;
  d.completedYears = completed;

  // Wages for gratuity/leave = basic + DA. Under the Code on Wages, if excluded allowances
  // exceed 50% of total pay, the excess counts as wages, so wages can't be below 50% of gross.
  const basic = num(f.monthlyBasic);
  const gross = num(f.monthlyGross) || basic;
  d.wageRuleApplied = d.underLabourCodes && gross > 0 && basic < gross * 0.5;
  d.statutoryWages = d.wageRuleApplied ? round2(gross * 0.5) : basic;

  // Gratuity eligibility: 5 years of continuous service. Fixed-term employees who joined on or
  // after 21 Nov 2025 qualify after 1 year, pro rata (Labour Ministry FAQ reading of the Code).
  const fixedTermNewRule = f.employmentType === 'fixed_term' && joining >= LABOUR_CODES_DATE;
  d.gratuityRule = fixedTermNewRule ? 'fixed_term_one_year' : 'five_years';
  d.gratuityEligible = fixedTermNewRule ? completed >= 1 : completed >= 5;
  // A part-year of more than six months counts as a full year; fixed-term gratuity is pro rata.
  d.gratuityYears = fixedTermNewRule ? d.serviceYears : completed + (remainderMonths > 6 ? 1 : 0);
  d.gratuityAmount = d.gratuityEligible
    ? Math.min(GRATUITY_CEILING, round2((15 / 26) * d.statutoryWages * d.gratuityYears))
    : 0;
  d.gratuityMissing = d.gratuityEligible && f.gratuityIncludedInOffer === false;

  // Final settlement timing.
  const paid = toDate(f.settlementPaidDate);
  d.settlementPaid = Boolean(paid);
  d.settlementWorkingDays = workingDaysAfter(lastDay, paid || now);
  d.daysSinceExit = daysBetween(lastDay, now);

  // Notice period recovery can't exceed the unserved notice, valued at full daily gross.
  d.noticeShortfallDays = Math.max(0, num(f.noticePeriodDays) - num(f.noticeServedDays));
  d.justifiedNoticeRecovery = round2(d.noticeShortfallDays * (gross / 30));
  d.excessNoticeRecovery = Math.max(0, round2(num(f.noticeRecoveryDeducted) - d.justifiedNoticeRecovery));

  d.pendingSalaryAmount = round2(num(f.pendingSalaryDays) * (gross / 30));
  d.leaveEncashmentAmount = f.leaveEncashable === false ? 0 : round2(num(f.earnedLeaveBalance) * (d.statutoryWages / 26));
  return d;
}

export function calculate(f, d) {
  const items = [];
  const notes = [];
  if (d.pendingSalaryAmount) {
    items.push({ key: 'pendingSalary', label: `Unpaid salary for ${num(f.pendingSalaryDays)} days`, amount: d.pendingSalaryAmount, kind: 'credit', note: 'Monthly gross ÷ 30 × days worked' });
  }
  if (d.leaveEncashmentAmount) {
    items.push({ key: 'leave', label: `Leave encashment for ${num(f.earnedLeaveBalance)} days`, amount: d.leaveEncashmentAmount, kind: 'credit', note: 'Wages ÷ 26 × unused leave days' });
  }
  if (d.gratuityEligible) {
    items.push({ key: 'gratuity', label: `Gratuity for ${d.gratuityYears} year${d.gratuityYears === 1 ? '' : 's'}`, amount: d.gratuityAmount, kind: 'credit', note: '15 ÷ 26 × monthly wages × years of service (capped at ₹20 lakh)' });
  } else {
    notes.push(`Not yet eligible for gratuity: ${d.completedYears ?? 0} completed year(s) of service.`);
  }
  const recovery = Math.min(num(f.noticeRecoveryDeducted), d.justifiedNoticeRecovery || 0);
  if (recovery) {
    items.push({ key: 'notice', label: `Notice shortfall of ${d.noticeShortfallDays} days`, amount: recovery, kind: 'debit', note: 'Only the unserved notice can be recovered' });
  }
  if (d.wageRuleApplied) {
    notes.push(`Basic pay is under half of gross, so ${inr(d.statutoryWages)} (50% of gross) is used as wages under the Code on Wages.`);
  }
  notes.push('Leave encashment uses wages ÷ 26 per day. Your company policy may use a more generous formula.');

  const owed = round2(items.reduce((s, i) => s + (i.kind === 'credit' ? i.amount : i.kind === 'debit' ? -i.amount : 0), 0));
  const offered = num(f.offeredAmount);
  return { items, owed, offered, gap: round2(owed - offered), notes };
}

// `history` is a paragraph describing earlier stages (dates, references, replies, payments), or null.
export function letter(stageKey, { facts: f, derived: d, calc, findings, userName, history }) {
  const name = f.employeeName || userName;
  const employer = f.employerName || 'the Company';
  const period = `${isoDay(f.joiningDate)} to ${isoDay(f.lastWorkingDate)}`;
  const intro = `I, ${name}, was employed with ${employer}${f.designation ? ` as ${f.designation}` : ''} from ${period}. My employment ended by ${String(f.separationType || 'resignation').replace('_', ' ')}.`;
  const owedLine = `By my calculation, the amount due to me is ${inr(calc.owed)}, against ${inr(calc.offered)} offered or already paid, leaving a shortfall of ${inr(Math.max(0, calc.gap))}.`;

  const byStage = {
    hr: {
      to: `The HR Manager, ${employer}`,
      subject: `Request for full and final settlement of dues: ${name}`,
      paragraphs: [
        intro,
        'I am writing about my final settlement, which has not been paid correctly. The issues are set out below with the provisions they rely on.',
        ...(history ? [history] : []),
        owedLine,
        `Please pay the balance and share an itemised settlement statement within 7 days of this letter. If I do not hear from you, I will have to pursue the matter formally.`,
      ],
    },
    legal_notice: {
      to: `The Managing Director / Authorised Signatory, ${employer}`,
      subject: `Notice for non-payment of final dues: ${name}`,
      paragraphs: [
        intro,
        history || `I wrote to your HR department on ${isoDay(d.previousSentAt) || 'an earlier date'} asking for my dues. That request has not been resolved.`,
        owedLine,
        'Take notice that unless the amount is paid within 15 days of receipt of this notice, I will file a claim before the competent labour authority under the Code on Wages, 2019 and pursue all other remedies, at your cost.',
      ],
    },
    labour_authority: {
      to: 'The Inspector-cum-Facilitator / Labour Commissioner (competent authority)',
      subject: `Claim for unpaid wages and dues against ${employer}`,
      paragraphs: [
        intro,
        'My employer has not paid my final dues despite a written demand and a formal notice. I request the authority to direct payment of the amounts below.',
        ...(history ? [history] : []),
        owedLine,
        'Copies of my appointment letter, payslips, resignation acceptance, the settlement statement and my earlier letters are enclosed.',
      ],
    },
  };
  const base = byStage[stageKey] || byStage.hr;
  return { ...base, findings, calc, signOff: name };
}

// Text for portal complaint forms (see services/filing.js).
export function filing(stageKey, { facts: f, calc }) {
  const employer = f.employerName || 'my former employer';
  const outstanding = inr(Math.max(0, calc.gap));
  return {
    category: 'Non-payment or short payment of wages and final settlement dues (Code on Wages, 2019)',
    subject: `Unpaid final settlement dues: ${f.employeeName || 'employee'} v. ${employer}`,
    relief: `Direct ${employer} to pay the outstanding dues of ${outstanding}, with any interest or compensation the authority finds due, and to issue an itemised final settlement statement.`,
    opponent: f.employerName || '',
    // Where each field goes on the SAMADHAN claim form.
    pasteInto: { category: 'Claim type', opponent: 'Details against whom', subject: 'Claim details', description: 'Claim details', relief: 'Claim details', amount: 'Amount claimed', reference: 'Claim details' },
  };
}

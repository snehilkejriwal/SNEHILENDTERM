import { hoursBetween, toDate, isoDay } from '../../../utils/dates.js';
import { round2, inr } from '../../../utils/money.js';

const num = (v) => (typeof v === 'number' && Number.isFinite(v) ? v : 0);
const TWO_WEEKS_HOURS = 14 * 24;

// Figures follow DGCA CAR Section 3, Series M, Part IV.
export function cancellationCap(blockMinutes) {
  if (blockMinutes <= 60) return 5000;
  if (blockMinutes <= 120) return 7500;
  return 10000;
}

export function mealThresholdHours(blockMinutes) {
  if (blockMinutes <= 150) return 2;
  if (blockMinutes <= 300) return 3;
  return 4;
}

export function derive(f) {
  const d = {};
  const sched = toDate(f.scheduledDeparture);
  if (!sched) return d;
  const block = num(f.blockTimeMinutes);
  d.fareBase = round2(num(f.basicFare) + num(f.fuelCharge));
  d.noticeHours = f.notifiedAt ? round2(hoursBetween(f.notifiedAt, sched)) : null;
  d.alternateGapHours = f.alternateOffered && f.alternateDeparture ? round2(hoursBetween(sched, f.alternateDeparture)) : null;
  d.delayHours = f.actualDeparture ? round2(hoursBetween(sched, f.actualDeparture)) : null;
  d.compensationCap = cancellationCap(block);
  d.mealThresholdHours = mealThresholdHours(block);
  const excused = f.extraordinaryCircumstances === true;

  d.cancellationCompensation = 0;
  d.cancellationEligible = false;
  if (f.incidentType === 'cancellation' && !excused && d.noticeHours !== null && d.noticeHours < TWO_WEEKS_HOURS) {
    // No compensation when told 24h–2 weeks ahead AND offered a flight within 2 hours of the original time.
    const goodAlternate = d.noticeHours >= 24 && d.alternateGapHours !== null && d.alternateGapHours <= 2;
    if (!goodAlternate) {
      d.cancellationEligible = true;
      d.cancellationCompensation = Math.min(d.compensationCap, d.fareBase);
    }
  }

  d.deniedBoardingCompensation = 0;
  d.deniedBoardingEligible = false;
  if (f.incidentType === 'denied_boarding' && !excused && f.checkedInOnTime !== false) {
    if (d.alternateGapHours !== null && d.alternateGapHours <= 1) {
      d.deniedBoardingCompensation = 0;
    } else if (d.alternateGapHours !== null && d.alternateGapHours <= 24 && f.acceptedAlternate) {
      d.deniedBoardingEligible = true;
      d.deniedBoardingCompensation = Math.min(2 * d.fareBase, 10000);
    } else {
      d.deniedBoardingEligible = true;
      d.deniedBoardingCompensation = Math.min(4 * d.fareBase, 20000);
    }
  }

  d.longDelay = f.incidentType === 'delay' && d.delayHours !== null && d.delayHours >= 6;
  d.mealsOwed = f.incidentType === 'delay' && d.delayHours !== null && d.delayHours >= d.mealThresholdHours;
  d.mealsMissing = d.mealsOwed && f.mealsProvided === false;

  const refundCase = f.incidentType === 'cancellation' || f.incidentType === 'denied_boarding' || d.longDelay;
  d.refundDue = refundCase && f.acceptedAlternate !== true ? num(f.ticketTotal) : 0;
  d.refundShortfall = Math.max(0, round2(d.refundDue - num(f.refundReceived)));
  d.compensationDue = d.cancellationCompensation + d.deniedBoardingCompensation;
  d.compensationShortfall = Math.max(0, round2(d.compensationDue - num(f.compensationOffered)));
  return d;
}

export function calculate(f, d) {
  const items = [];
  const notes = [];
  if (d.refundDue) items.push({ key: 'refund', label: 'Full ticket refund', amount: d.refundDue, kind: 'credit', note: 'You did not accept the alternate flight' });
  if (d.cancellationCompensation) {
    items.push({ key: 'cancel', label: 'Cancellation compensation', amount: d.cancellationCompensation, kind: 'credit', note: `Lower of ${inr(d.compensationCap)} (block time ${num(f.blockTimeMinutes)} min) or basic fare + fuel charge` });
  }
  if (d.deniedBoardingCompensation) {
    items.push({ key: 'denied', label: 'Denied boarding compensation', amount: d.deniedBoardingCompensation, kind: 'credit', note: 'Percentage of basic fare + fuel charge, capped by the CAR' });
  }
  if (f.incidentType === 'delay') {
    notes.push('The CAR gives meals, refreshments and (for long delays) a refund or alternate flight, not cash compensation for delay alone.');
  }
  if (f.extraordinaryCircumstances) notes.push('Airlines are not liable to pay compensation for extraordinary circumstances outside their control (for example, severe weather).');
  const owed = round2(items.reduce((s, i) => s + i.amount, 0));
  const offered = round2(num(f.refundReceived) + num(f.compensationOffered));
  return { items, owed, offered, gap: round2(owed - offered), notes };
}

// `history` is a paragraph describing earlier stages (dates, references, replies, payments), or null.
export function letter(stageKey, { facts: f, calc, findings, userName, history }) {
  const name = f.passengerName || userName;
  const airline = f.airline || 'the airline';
  const flight = `${f.flightNumber || 'flight'} from ${f.origin || '—'} to ${f.destination || '—'} on ${isoDay(f.scheduledDeparture) || '—'}`;
  const what = { cancellation: 'was cancelled', denied_boarding: 'was a flight on which I was denied boarding', delay: 'was delayed' }[f.incidentType] || 'was disrupted';
  const intro = `I held a confirmed booking (PNR ${f.pnr || '—'}) on ${airline} ${flight}, which ${what}.`;
  const owedLine = `Under DGCA CAR Section 3, Series M, Part IV, I am owed ${inr(calc.owed)}. I have received ${inr(calc.offered)}, leaving ${inr(Math.max(0, calc.gap))} outstanding.`;

  const byStage = {
    airline: {
      to: `The Nodal Officer / Grievance Officer, ${airline}`,
      subject: `Claim under DGCA CAR: PNR ${f.pnr || ''}, ${f.flightNumber || ''}`,
      paragraphs: [intro, ...(history ? [history] : []), owedLine, 'Please pay the outstanding amount to my original mode of payment within 30 days and confirm in writing.'],
    },
    airsewa: {
      to: 'AirSewa, Ministry of Civil Aviation',
      subject: `Complaint against ${airline}: PNR ${f.pnr || ''}`,
      paragraphs: [intro, history || `I raised a claim with the airline's nodal officer, which has not been resolved.`, owedLine, 'I request that the airline be directed to pay the amount due under the CAR.'],
    },
    consumer: {
      to: 'The President, District Consumer Disputes Redressal Commission',
      subject: `Consumer complaint: deficiency in service by ${airline}`,
      paragraphs: [intro, 'The airline has failed to pay what the DGCA CAR requires despite a claim and an AirSewa complaint. This is a deficiency in service under the Consumer Protection Act, 2019.', ...(history ? [history] : []), owedLine, 'I seek payment of the outstanding amount with interest, and compensation for the inconvenience caused.'],
    },
  };
  const base = byStage[stageKey] || byStage.airline;
  return { ...base, findings, calc, signOff: name };
}

const INCIDENT = { cancellation: 'Flight cancellation', denied_boarding: 'Denied boarding', delay: 'Flight delay' };

// Text for portal complaint forms (see services/filing.js).
export function filing(stageKey, { facts: f, calc }) {
  const airline = f.airline || 'the airline';
  const outstanding = inr(Math.max(0, calc.gap));
  const what = INCIDENT[f.incidentType] || 'Flight disruption';
  const subject = `${what}: ${airline} ${f.flightNumber || ''} on ${isoDay(f.scheduledDeparture) || ''}, PNR ${f.pnr || ''}`.replace(/\s+/g, ' ').trim();
  if (stageKey === 'consumer') {
    return {
      category: 'Deficiency in service by an airline (Consumer Protection Act, 2019)',
      subject,
      relief: `Direct ${airline} to pay ${outstanding} due under DGCA CAR Section 3, Series M, Part IV, with interest, compensation for the inconvenience and harassment caused, and the cost of this complaint.`,
      opponent: f.airline || '',
      // Where each field goes on the e-Jagriti complaint form.
      pasteInto: { category: 'Nature of complaint', opponent: 'Opposite party', subject: 'Complaint subject', description: 'Complaint details', relief: 'Relief sought', amount: 'Amount claimed', reference: 'Complaint details' },
    };
  }
  return {
    category: `${what}: refund or compensation under DGCA CAR`,
    subject,
    relief: `Direct ${airline} to pay ${outstanding} due under DGCA CAR Section 3, Series M, Part IV to my original mode of payment.`,
    opponent: f.airline || '',
    // Where each field goes on the AirSewa grievance form.
    pasteInto: { category: 'Grievance category', opponent: 'Organisation (airline)', subject: 'Grievance subject', description: 'Grievance description', relief: 'Grievance description', amount: 'Grievance description', reference: 'Grievance description' },
  };
}

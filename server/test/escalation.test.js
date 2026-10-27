import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as flight from '../src/services/packs/flight/index.js';
import { withPayments, recordReply, sentEntry, escalationReason } from '../src/services/workflow.js';
import { getLetterDraft, saveLetterDraft } from '../src/services/letters/compose.js';
import { buildFilingPack, DESCRIPTION_MAX } from '../src/services/filing.js';

const STAGES = [
  { key: 'airline', label: 'Claim to the airline', recipient: 'Nodal officer', responseDays: 30, type: 'letter' },
  { key: 'airsewa', label: 'Complaint on AirSewa', recipient: 'AirSewa', responseDays: 30, type: 'portal', portalName: 'AirSewa', portalUrl: 'https://airsewa.gov.in', entryUrl: 'https://airsewa.gov.in/start', filingSteps: ['Step one'], alternatives: ['Use the app'] },
  { key: 'consumer', label: 'Consumer Commission complaint', recipient: 'District Commission', responseDays: 90, type: 'portal', portalName: 'e-Jagriti' },
];
const pack = { key: 'flight', name: 'Flight', stages: STAGES };
const facts = { incidentType: 'cancellation', scheduledDeparture: '2026-09-10T18:00:00+05:30', notifiedAt: '2026-09-10T15:00:00+05:30', blockTimeMinutes: 150, basicFare: 6200, fuelCharge: 800, ticketTotal: 7900, refundReceived: 7900, acceptedAlternate: false, airline: 'SkyAir', flightNumber: 'SA 101', pnr: 'ABC123', passengerName: 'Asha' };
const baseCalc = () => flight.calculate(facts, flight.derive(facts));
const user = { name: 'Asha', email: 'asha@example.com' };

// A case waiting for the airline's reply, sent on 1 Oct 2026.
function waitingCase() {
  return {
    status: 'awaiting_response',
    stageIndex: 0,
    facts,
    findings: [{ code: 'X', title: 'Cancellation compensation may be due', message: 'm', citation: 'DGCA CAR, para 3.6', severity: 'high' }],
    calculation: baseCalc(),
    stageLog: [{ stageIndex: 0, stageKey: 'airline', sentAt: new Date('2026-10-01'), dueAt: new Date('2026-10-31'), outcome: 'pending', channel: 'email', recipient: 'Nodal officer', referenceNumber: 'EML-77', replies: [] }],
    letters: [],
    payments: [],
    documents: [{ name: 'e-ticket.pdf' }],
  };
}

test('partial payment reduces the gap and allows escalating at once', () => {
  const c = waitingCase();
  const before = baseCalc();
  assert.equal(before.gap, 7000);
  const r = recordReply(c, { receivedAt: '2026-10-05', outcome: 'partial', amountPaid: 2500 }, new Date('2026-10-06'));
  assert.equal(r.paymentAdded, true);
  assert.equal(c.payments.length, 1);
  assert.equal(c.status, 'awaiting_response', 'a partial payment does not close the case');
  const after = withPayments(before, c.payments);
  assert.equal(after.paid, 2500);
  assert.equal(after.offered, before.offered + 2500);
  assert.equal(after.gap, 4500);
  // Before the deadline, a partial reply still lets the user escalate.
  assert.equal(escalationReason(c, undefined, { canEscalateForNoResponse: false }), 'partial');
});

test('silence before the deadline cannot be escalated', () => {
  assert.throws(() => escalationReason(waitingCase(), undefined, { canEscalateForNoResponse: false, dueAt: new Date('2026-10-31') }), /Give them until/);
});

test('paid_full resolves the case with everything paid as the amount recovered', () => {
  const c = waitingCase();
  recordReply(c, { receivedAt: '2026-10-03', outcome: 'partial', amountPaid: 2000 }, new Date('2026-10-10'));
  const r = recordReply(c, { receivedAt: '2026-10-09', outcome: 'paid_full', amountPaid: 5000 }, new Date('2026-10-10'));
  assert.equal(r.resolved, true);
  assert.equal(c.status, 'resolved');
  assert.equal(c.amountRecovered, 7000);
  assert.equal(c.stageLog[0].outcome, 'resolved');
  assert.throws(() => recordReply(c, { receivedAt: '2026-10-09', outcome: 'rejected' }, new Date('2026-10-10')), /only be recorded while/);
});

test('portal stage requires a reference number; letter stage does not', () => {
  const now = new Date('2026-11-01');
  assert.throws(() => sentEntry(STAGES[1], 1, { sentAt: '2026-10-20' }, now), /reference number/i);
  const portal = sentEntry(STAGES[1], 1, { sentAt: '2026-10-20', referenceNumber: ' AS-2026-555 ' }, now);
  assert.equal(portal.referenceNumber, 'AS-2026-555');
  assert.equal(portal.channel, 'portal');
  const letter = sentEntry(STAGES[0], 0, { sentAt: '2026-10-20' }, now);
  assert.equal(letter.channel, 'email');
  assert.equal(letter.referenceNumber, undefined);
});

test('letter draft saves, reloads, and later letters cite earlier stages', () => {
  const c = waitingCase();
  // Nothing saved yet: a generated draft comes back.
  const fresh = getLetterDraft(c, pack, 0, user);
  assert.equal(fresh.draft.saved, false);
  assert.match(fresh.draft.subject, /ABC123/);

  saveLetterDraft(c, pack, { stageIndex: 0, to: 'Nodal Officer, SkyAir', recipientEmail: 'nodal@skyair.example', subject: 'My claim', paragraphs: ['First.', '  ', 'Last.'] }, new Date('2026-10-01'));
  const reloaded = getLetterDraft(c, pack, 0, user);
  assert.equal(reloaded.draft.saved, true);
  assert.deepEqual(reloaded.draft.paragraphs, ['First.', 'Last.'], 'blank paragraphs are dropped');
  assert.equal(reloaded.letter.subject, 'My claim', 'the PDF uses the saved draft');
  assert.equal(reloaded.letter.recipientEmail, 'nodal@skyair.example');

  // Saving again updates rather than duplicating.
  saveLetterDraft(c, pack, { stageIndex: 0, to: 'Nodal Officer, SkyAir', subject: 'My claim v2', paragraphs: ['Only.'] });
  assert.equal(c.letters.length, 1);
  assert.equal(getLetterDraft(c, pack, 0, user).draft.subject, 'My claim v2');

  // A stage not yet reached cannot be drafted.
  assert.throws(() => saveLetterDraft(c, pack, { stageIndex: 2, to: 'x x x', subject: 'abc', paragraphs: ['p'] }), /not open yet/);

  // After a rejection and a part payment, the next stage refers back to them.
  recordReply(c, { receivedAt: '2026-10-05', outcome: 'partial', amountPaid: 1500 }, new Date('2026-10-06'));
  c.stageIndex = 1;
  const next = getLetterDraft(c, pack, 1, user).letter.paragraphs.join(' ');
  assert.match(next, /2026-10-01/);
  assert.match(next, /by email/);
  assert.match(next, /EML-77/);
  assert.match(next, /only part of the claim was paid/);
  assert.match(next, /₹1,500 has been paid so far/);
});

test('filing pack lists fields, earlier references and attachments within limits', () => {
  const c = waitingCase();
  c.stageIndex = 1;
  c.stageLog[0].outcome = 'rejected';
  c.stageLog[0].replies.push({ receivedAt: new Date('2026-10-04'), outcome: 'rejected' });
  const f = buildFilingPack(c, pack, 1, user);
  assert.equal(f.portalUrl, 'https://airsewa.gov.in');
  const byLabel = Object.fromEntries(f.fields.map((x) => [x.label, x.value]));
  assert.match(byLabel['Previous complaint / reference number'], /EML-77/);
  assert.equal(byLabel['Amount claimed'], 'Rs. 7,000');
  assert.ok(byLabel.Description.length <= DESCRIPTION_MAX);
  assert.ok(!byLabel.Description.includes('₹'));
  assert.ok(f.attachments.includes('e-ticket.pdf'));
  assert.ok(f.attachments.some((a) => /Copy of letter to Nodal officer dated 2026-10-01/.test(a)));
  assert.ok(f.fields.every((x) => x.pasteInto), 'every field says where to paste it');
  assert.equal(f.fields.find((x) => x.label === 'Description').pasteInto, 'Grievance description');
  assert.equal(byLabel['Opposite party'], 'SkyAir');
  assert.deepEqual(f.filingSteps, ['Step one']);
  assert.equal(f.entryUrl, 'https://airsewa.gov.in/start');
  assert.throws(() => buildFilingPack(c, pack, 0, user), /sent as a letter/);
});

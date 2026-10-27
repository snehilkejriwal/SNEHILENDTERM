import { test } from 'node:test';
import assert from 'node:assert/strict';
import { extractByPatterns, parseDate } from '../src/services/extraction/patternExtract.js';

test('dates: Indian formats are read day-first', () => {
  assert.deepEqual(parseDate('01-06-2020'), { y: 2020, mo: 5, d: 1, index: 0, length: 10 });
  assert.equal(parseDate('10 Sep 2026, 18:00').mo, 8);
  assert.equal(parseDate('5 September 2026').d, 5);
  assert.equal(parseDate('no date here'), null);
});

test('flight ticket and cancellation email fill the right facts and nothing else', () => {
  const text = `SkyIndia Airways: E-Ticket
Passenger Rahul Verma
PNR K7QX2M
Flight SI 2145
From Bengaluru (BLR)
To Pune (PNQ)
Scheduled departure 10 Sep 2026, 18:00 IST
Scheduled flight duration 1 h 45 min (105 minutes)
Basic fare Rs. 6,200
Fuel charge Rs. 800
Total Rs. 7,900
Sent 10 September 2026, 15:00 IST
Your flight SI 2145 has been cancelled. We were unable to offer an alternate flight. A full refund of Rs. 7,900 has been initiated.`;
  const f = extractByPatterns('flight', text);
  assert.equal(f.pnr, 'K7QX2M');
  assert.equal(f.flightNumber, 'SI 2145');
  assert.equal(f.passengerName, 'Rahul Verma');
  assert.equal(f.incidentType, 'cancellation');
  assert.equal(f.blockTimeMinutes, 105);
  assert.equal(f.scheduledDeparture, '2026-09-10T18:00:00+05:30');
  assert.equal(f.notifiedAt, '2026-09-10T15:00:00+05:30');
  assert.equal(f.ticketTotal, 7900);
  assert.equal(f.basicFare, 6200);
  assert.equal(f.alternateOffered, false);
  assert.equal(f.actualDeparture, undefined, 'facts not in the document stay empty');
  assert.equal(f.mealsProvided, undefined);
});

test('settlement statement fills employment facts', () => {
  const text = `Nimbus Softech Private Limited
Employee Priya Sharma
Date of joining 01-06-2020
Last working day 15-12-2025
Reason for exit Resignation
Notice period as per contract 60 days
Notice period served 45 days
Salary for November 2025 (unpaid, 30 days) Rs. 1,00,000
Salary for 1-15 December 2025 (15 days) Rs. 50,000
Less: notice period recovery - Rs. 66,000
Gratuity Not applicable
Net amount payable Rs. 84,000`;
  const f = extractByPatterns('employment', text);
  assert.equal(f.employeeName, 'Priya Sharma');
  assert.equal(f.employerName, 'Nimbus Softech Private Limited');
  assert.equal(f.joiningDate, '2020-06-01');
  assert.equal(f.lastWorkingDate, '2025-12-15');
  assert.equal(f.separationType, 'resignation');
  assert.equal(f.noticePeriodDays, 60);
  assert.equal(f.noticeServedDays, 45);
  assert.equal(f.noticeRecoveryDeducted, 66000);
  assert.equal(f.pendingSalaryDays, 45);
  assert.equal(f.offeredAmount, 84000);
  assert.equal(f.gratuityIncludedInOffer, false);
  assert.equal(f.monthlyBasic, undefined, 'not in this document, so left empty');
});

import { test } from 'node:test';
import assert from 'node:assert/strict';
import * as employment from '../src/services/packs/employment/index.js';
import * as flight from '../src/services/packs/flight/index.js';

test('employment: Priya demo case', () => {
  const f = {
    employmentType: 'permanent', separationType: 'resignation',
    joiningDate: '2020-06-01', lastWorkingDate: '2025-12-15',
    monthlyBasic: 40000, monthlyGross: 100000,
    pendingSalaryDays: 45, earnedLeaveBalance: 20,
    noticePeriodDays: 60, noticeServedDays: 45, noticeRecoveryDeducted: 66000,
    offeredAmount: 84000, gratuityIncludedInOffer: false,
  };
  const d = employment.derive(f, new Date('2026-02-01'));
  assert.equal(d.wageRuleApplied, true);
  assert.equal(d.statutoryWages, 50000);
  assert.equal(d.gratuityEligible, true);
  assert.equal(d.gratuityYears, 6);
  assert.equal(d.gratuityMissing, true);
  assert.equal(d.excessNoticeRecovery, 16000);
  const calc = employment.calculate(f, d);
  assert.equal(calc.owed, 311538.46);
  assert.equal(calc.gap, 227538.46);
});

test('employment: fixed-term joiner after the Labour Codes is eligible after one year', () => {
  const d = employment.derive({ employmentType: 'fixed_term', joiningDate: '2025-12-01', lastWorkingDate: '2027-03-31', monthlyBasic: 30000, monthlyGross: 50000 }, new Date('2027-04-10'));
  assert.equal(d.gratuityEligible, true);
  assert.equal(d.gratuityRule, 'fixed_term_one_year');
  assert.ok(d.gratuityAmount > 0);
});

test('flight: short-notice cancellation pays the block-time cap', () => {
  const f = { incidentType: 'cancellation', scheduledDeparture: '2026-09-10T18:00:00+05:30', notifiedAt: '2026-09-10T15:00:00+05:30', blockTimeMinutes: 150, basicFare: 6200, fuelCharge: 800, ticketTotal: 7900, refundReceived: 7900, acceptedAlternate: false };
  const d = flight.derive(f);
  assert.equal(d.cancellationCompensation, 7000, 'capped by basic fare + fuel (7,000) below ₹10,000');
  const calc = flight.calculate(f, d);
  assert.equal(calc.owed, 14900);
  assert.equal(calc.gap, 7000);
});

test('flight: 3 days notice with alternate within 2 hours means no compensation', () => {
  const d = flight.derive({ incidentType: 'cancellation', scheduledDeparture: '2026-09-10T18:00:00Z', notifiedAt: '2026-09-07T10:00:00Z', alternateOffered: true, alternateDeparture: '2026-09-10T19:30:00Z', blockTimeMinutes: 100, basicFare: 5000 });
  assert.equal(d.cancellationEligible, false);
});

test('flight: denied boarding with alternate after 24h pays 400% capped at ₹20,000', () => {
  const d = flight.derive({ incidentType: 'denied_boarding', scheduledDeparture: '2026-09-10T08:00:00Z', alternateOffered: true, alternateDeparture: '2026-09-11T12:00:00Z', acceptedAlternate: true, checkedInOnTime: true, blockTimeMinutes: 120, basicFare: 4000, fuelCharge: 500 });
  assert.equal(d.deniedBoardingCompensation, 18000);
});

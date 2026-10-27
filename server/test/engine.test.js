import { test } from 'node:test';
import assert from 'node:assert/strict';
import { evaluate, validateCondition } from '../src/services/engine/conditions.js';
import { runRules, rulesInForce } from '../src/services/engine/rulesEngine.js';
import { canTransition, nextStatus, availableActions } from '../src/services/engine/stateMachine.js';
import { computeDeadline } from '../src/services/engine/deadlines.js';
import { workingDaysAfter } from '../src/utils/dates.js';
import { coerceFacts, missingRequired, isVisible } from '../src/services/extraction/coerce.js';

test('conditions: all / any / not / valueFact', () => {
  const facts = { a: 5, b: 3, flag: true, kind: 'x' };
  assert.equal(evaluate({ all: [{ fact: 'a', op: 'gt', valueFact: 'b' }, { fact: 'flag', op: 'eq', value: true }] }, facts), true);
  assert.equal(evaluate({ any: [{ fact: 'a', op: 'lt', value: 0 }, { fact: 'kind', op: 'in', value: ['x'] }] }, facts), true);
  assert.equal(evaluate({ not: { fact: 'flag', op: 'truthy' } }, facts), false);
  assert.equal(evaluate({ fact: 'missingFact', op: 'gt', value: 1 }, facts), false, 'missing numbers never pass comparisons');
});

test('conditions: validation rejects unknown operators', () => {
  assert.match(validateCondition({ fact: 'a', op: 'eval', value: 1 }), /Unknown operator/);
  assert.equal(validateCondition({ all: [{ fact: 'a', op: 'gte', value: 1 }] }), null);
});

test('rules engine respects effective dates', () => {
  const rules = [
    { code: 'OLD', active: true, effectiveTo: new Date('2025-11-20'), condition: { fact: 'x', op: 'truthy' }, title: 'Old', message: 'old', citation: 'c', severity: 'medium' },
    { code: 'NEW', active: true, effectiveFrom: new Date('2025-11-21'), condition: { fact: 'x', op: 'truthy' }, title: 'New', message: 'Owed {{amt:inr}}', citation: 'c', severity: 'high' },
  ];
  assert.deepEqual(rulesInForce(rules, '2025-01-10').map((r) => r.code), ['OLD']);
  const findings = runRules(rules, { x: true, amt: 127538 }, '2026-01-10');
  assert.deepEqual(findings.map((f) => f.code), ['NEW']);
  assert.equal(findings[0].message, 'Owed ₹1,27,538');
});

test('state machine only allows valid moves', () => {
  assert.equal(canTransition('draft', 'mark_sent'), false);
  assert.equal(nextStatus('draft', 'confirm'), 'confirmed');
  assert.equal(nextStatus('awaiting_response', 'escalate'), 'letter_ready');
  assert.equal(nextStatus('resolved', 'close'), null);
  assert.ok(!availableActions({ status: 'letter_ready', stageIndex: 1, stageLog: [{}] }).includes('unlock'));
});

test('deadlines: overdue after the response window', () => {
  const pack = { stages: [{ key: 'hr', label: 'HR', responseDays: 7 }, { key: 'n', label: 'Notice', responseDays: 15 }] };
  const c = { status: 'awaiting_response', stageIndex: 0, stageLog: [{ stageIndex: 0, sentAt: new Date('2026-01-01') }] };
  const d = computeDeadline(c, pack, new Date('2026-01-10'));
  assert.equal(d.state, 'overdue');
  assert.equal(d.canEscalateForNoResponse, true);
  assert.equal(computeDeadline(c, pack, new Date('2026-01-03')).state, 'on_track');
});

test('working days skip weekends', () => {
  // Fri 2 Jan 2026 -> Tue 6 Jan 2026: Mon 5 and Tue 6 are working days
  assert.equal(workingDaysAfter('2026-01-02', '2026-01-06'), 2);
});

test('fact coercion drops unknown keys and validates types', () => {
  const schema = [{ key: 'amount', label: 'Amount', type: 'number', required: true }, { key: 'kind', label: 'Kind', type: 'enum', options: [{ value: 'a' }] }];
  const { facts, errors } = coerceFacts(schema, { amount: '₹1,20,000', kind: 'zzz', injected: 'x' });
  assert.deepEqual(facts, { amount: 120000 });
  assert.ok(errors.kind);
  assert.equal(missingRequired(schema, {}).length, 1);
});

test('required fields with showIf only count as missing when they apply', () => {
  const field = { key: 'actualDeparture', label: 'Actual departure', type: 'datetime', required: true, showIf: { fact: 'incidentType', op: 'eq', value: 'delay' } };
  const schema = [field];
  assert.deepEqual(missingRequired(schema, { incidentType: 'delay' }).map((f) => f.key), ['actualDeparture']);
  assert.equal(missingRequired(schema, { incidentType: 'cancellation' }).length, 0);
  assert.equal(missingRequired(schema, {}).length, 0, 'hidden until the incident type is known');
  assert.equal(missingRequired(schema, { incidentType: 'delay', actualDeparture: '2026-01-10T10:00:00.000Z' }).length, 0);
  assert.equal(isVisible({ key: 'x' }, {}), true, 'no condition means always shown');
});

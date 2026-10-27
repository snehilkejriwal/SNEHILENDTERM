import { evaluate } from './conditions.js';
import { toDate } from '../../utils/dates.js';
import { inr } from '../../utils/money.js';

// Only rules in force on the case's reference date apply (e.g. the employee's last working day).
export function rulesInForce(rules, referenceDate) {
  const ref = toDate(referenceDate);
  return rules.filter((r) => {
    if (!r.active) return false;
    if (!ref) return !r.effectiveFrom && !r.effectiveTo;
    if (r.effectiveFrom && ref < toDate(r.effectiveFrom)) return false;
    if (r.effectiveTo && ref > toDate(r.effectiveTo)) return false;
    return true;
  });
}

// Fills {{fact}} placeholders. Keys ending in "Amount"/money-like values are shown as rupees.
export function renderMessage(template, facts) {
  return template.replace(/\{\{\s*(\w+)(?::(inr|days))?\s*\}\}/g, (_, key, fmt) => {
    const v = facts[key];
    if (v === undefined || v === null) return '—';
    if (fmt === 'inr') return inr(v);
    if (fmt === 'days') return `${v} day${v === 1 ? '' : 's'}`;
    return typeof v === 'number' ? v.toLocaleString('en-IN') : String(v);
  });
}

const SEVERITY_ORDER = { high: 0, medium: 1, info: 2 };

export function runRules(rules, facts, referenceDate) {
  return rulesInForce(rules, referenceDate)
    .filter((r) => evaluate(r.condition, facts))
    .map((r) => ({
      code: r.code,
      title: r.title,
      message: renderMessage(r.message, facts),
      citation: r.citation,
      severity: r.severity,
    }))
    .sort((a, b) => SEVERITY_ORDER[a.severity] - SEVERITY_ORDER[b.severity]);
}

import { toDate } from '../../utils/dates.js';
import { evaluate } from '../engine/conditions.js';

// Converts raw values (from the AI or a form) into the types the pack expects.
// Unknown keys are dropped, so neither the AI nor a client can inject extra fields.
export function coerceFacts(schema, raw = {}) {
  const facts = {};
  const errors = {};
  for (const field of schema) {
    const v = raw[field.key];
    if (v === undefined || v === null || v === '') continue;
    switch (field.type) {
      case 'number': {
        const n = typeof v === 'number' ? v : Number(String(v).replace(/[₹,\s]/g, ''));
        if (Number.isFinite(n) && n >= 0) facts[field.key] = n;
        else errors[field.key] = `${field.label} must be a positive number.`;
        break;
      }
      case 'date':
      case 'datetime': {
        const d = toDate(v);
        if (d) facts[field.key] = d.toISOString();
        else errors[field.key] = `${field.label} must be a valid date.`;
        break;
      }
      case 'boolean': {
        if (typeof v === 'boolean') facts[field.key] = v;
        else if (['true', 'yes', '1'].includes(String(v).toLowerCase())) facts[field.key] = true;
        else if (['false', 'no', '0'].includes(String(v).toLowerCase())) facts[field.key] = false;
        else errors[field.key] = `${field.label} must be yes or no.`;
        break;
      }
      case 'enum': {
        const allowed = (field.options || []).map((o) => o.value);
        if (allowed.includes(v)) facts[field.key] = v;
        else errors[field.key] = `${field.label} must be one of: ${allowed.join(', ')}.`;
        break;
      }
      default:
        facts[field.key] = String(v).trim().slice(0, 300);
    }
  }
  return { facts, errors };
}

// A question applies when it has no condition, or its condition holds for the current facts.
export const isVisible = (field, facts) => !field.showIf || evaluate(field.showIf, facts);

// Only questions that apply to this case can be missing.
export function missingRequired(schema, facts) {
  return schema.filter((f) => f.required && isVisible(f, facts) && (facts[f.key] === undefined || facts[f.key] === null || facts[f.key] === ''));
}

// A tiny, safe condition language for rules stored in the database.
// No eval: rules are plain JSON such as
//   { "all": [ { "fact": "serviceYears", "op": "gte", "value": 5 },
//              { "fact": "gratuityIncludedInOffer", "op": "eq", "value": false } ] }
// A "value" can point at another fact: { "fact": "noticeRecoveryDeducted", "op": "gt", "valueFact": "justifiedNoticeRecovery" }

const OPS = {
  eq: (a, b) => a === b,
  neq: (a, b) => a !== b,
  gt: (a, b) => typeof a === 'number' && typeof b === 'number' && a > b,
  gte: (a, b) => typeof a === 'number' && typeof b === 'number' && a >= b,
  lt: (a, b) => typeof a === 'number' && typeof b === 'number' && a < b,
  lte: (a, b) => typeof a === 'number' && typeof b === 'number' && a <= b,
  in: (a, b) => Array.isArray(b) && b.includes(a),
  nin: (a, b) => Array.isArray(b) && !b.includes(a),
  truthy: (a) => Boolean(a),
  falsy: (a) => !a,
  exists: (a) => a !== undefined && a !== null && a !== '',
  missing: (a) => a === undefined || a === null || a === '',
};

export const OPERATORS = Object.keys(OPS);

export function evaluate(condition, facts) {
  if (!condition || typeof condition !== 'object') return false;
  if (Array.isArray(condition.all)) return condition.all.every((c) => evaluate(c, facts));
  if (Array.isArray(condition.any)) return condition.any.some((c) => evaluate(c, facts));
  if (condition.not) return !evaluate(condition.not, facts);
  const op = OPS[condition.op];
  if (!op || typeof condition.fact !== 'string') return false;
  const left = facts[condition.fact];
  const right = condition.valueFact ? facts[condition.valueFact] : condition.value;
  return op(left, right);
}

// Validates a condition's structure before an admin can save it.
export function validateCondition(condition, depth = 0) {
  if (depth > 6) return 'Condition is nested too deeply.';
  if (!condition || typeof condition !== 'object' || Array.isArray(condition)) return 'Condition must be an object.';
  if (condition.all || condition.any) {
    const list = condition.all || condition.any;
    if (!Array.isArray(list) || list.length === 0) return '"all"/"any" must be a non-empty list.';
    for (const c of list) {
      const err = validateCondition(c, depth + 1);
      if (err) return err;
    }
    return null;
  }
  if (condition.not) return validateCondition(condition.not, depth + 1);
  if (typeof condition.fact !== 'string') return 'Each test needs a "fact" name.';
  if (!OPS[condition.op]) return `Unknown operator "${condition.op}". Use one of: ${OPERATORS.join(', ')}.`;
  return null;
}

// Client copy of the server's condition language (server/src/services/engine/conditions.js),
// used to decide live which questions apply. Same JSON, e.g.
//   { "all": [ { "fact": "incidentType", "op": "eq", "value": "delay" } ] }

const OPS = {
  eq: (a, b) => a === b,
  neq: (a, b) => a !== b,
  gt: (a, b) => typeof a === 'number' && typeof b === 'number' && a > b,
  in: (a, b) => Array.isArray(b) && b.includes(a),
  exists: (a) => a !== undefined && a !== null && a !== '',
  truthy: (a) => Boolean(a),
};

// A missing condition means "show".
export function evaluate(condition, facts) {
  if (condition === undefined || condition === null) return true;
  if (typeof condition !== 'object') return false;
  if (Array.isArray(condition.all)) return condition.all.every((c) => evaluate(c, facts));
  if (Array.isArray(condition.any)) return condition.any.some((c) => evaluate(c, facts));
  if (condition.not) return !evaluate(condition.not, facts);
  const op = OPS[condition.op];
  if (!op || typeof condition.fact !== 'string') return false;
  const right = condition.valueFact ? facts[condition.valueFact] : condition.value;
  return op(facts[condition.fact], right);
}

const DAY = 24 * 60 * 60 * 1000;

export const toDate = (v) => {
  if (v === null || v === undefined || v === '') return null;
  const d = v instanceof Date ? v : new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
};

export const daysBetween = (a, b) => Math.floor((toDate(b) - toDate(a)) / DAY);
export const addDays = (d, n) => new Date(toDate(d).getTime() + n * DAY);
export const hoursBetween = (a, b) => (toDate(b) - toDate(a)) / (60 * 60 * 1000);
export const minutesBetween = (a, b) => (toDate(b) - toDate(a)) / (60 * 1000);

// Working days after `start` up to and including `end`, skipping Saturdays and Sundays.
// Public holidays differ by state, so this is a slight over-count of working days; that is noted in the UI.
export function workingDaysAfter(start, end) {
  const s = toDate(start);
  const e = toDate(end);
  if (!s || !e || e <= s) return 0;
  let count = 0;
  const cur = new Date(Date.UTC(s.getUTCFullYear(), s.getUTCMonth(), s.getUTCDate()));
  const last = new Date(Date.UTC(e.getUTCFullYear(), e.getUTCMonth(), e.getUTCDate()));
  while (cur < last) {
    cur.setUTCDate(cur.getUTCDate() + 1);
    const day = cur.getUTCDay();
    if (day !== 0 && day !== 6) count += 1;
  }
  return count;
}

export const isoDay = (d) => (toDate(d) ? toDate(d).toISOString().slice(0, 10) : null);

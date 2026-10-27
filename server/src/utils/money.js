export const round2 = (n) => Math.round((Number(n) || 0) * 100) / 100;
export const inr = (n) =>
  '₹' + Math.round(Number(n) || 0).toLocaleString('en-IN', { maximumFractionDigits: 0 });

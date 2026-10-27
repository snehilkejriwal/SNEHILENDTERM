export const inr = (n) => (n === null || n === undefined ? '—' : '₹' + Math.round(Number(n)).toLocaleString('en-IN'));
export const date = (d) => (d ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—');
export const dateTime = (d) => (d ? new Date(d).toLocaleString('en-IN', { day: 'numeric', month: 'short', year: 'numeric', hour: 'numeric', minute: '2-digit' }) : '—');
export const ago = (d) => {
  const s = (Date.now() - new Date(d).getTime()) / 1000;
  if (s < 60) return 'just now';
  if (s < 3600) return `${Math.floor(s / 60)} min ago`;
  if (s < 86400) return `${Math.floor(s / 3600)} h ago`;
  return date(d);
};

export const STATUS = {
  draft: { label: 'Collecting facts', tone: 'bg-slate-100 text-slate-700 border border-slate-200/80 shadow-sm' },
  confirmed: { label: 'Facts confirmed', tone: 'bg-teal-50 text-teal-800 border border-teal-200 shadow-sm' },
  letter_ready: { label: 'Letter ready', tone: 'bg-amber-50 text-amber-900 border border-amber-200 shadow-sm font-semibold' },
  awaiting_response: { label: 'Waiting for reply', tone: 'bg-emerald-50 text-emerald-800 border border-emerald-200 shadow-sm' },
  resolved: { label: 'Resolved', tone: 'bg-emerald-100/70 text-emerald-900 border border-emerald-300 shadow-sm font-bold' },
  closed: { label: 'Closed', tone: 'bg-slate-100 text-slate-500 border border-slate-200' },
};

export const SEVERITY = {
  high: { label: 'Strong statutory point', dot: 'bg-rose-500 shadow-[0_0_8px_rgba(244,63,94,0.7)]', ring: 'border-rose-200 bg-rose-50/40' },
  medium: { label: 'Worth raising', dot: 'bg-amber-500 shadow-[0_0_8px_rgba(245,158,11,0.7)]', ring: 'border-amber-200 bg-amber-50/40' },
  info: { label: 'Good to know', dot: 'bg-teal-500 shadow-[0_0_8px_rgba(20,184,166,0.7)]', ring: 'border-teal-100 bg-teal-50/30' },
};

// SettleWise jewel gems
export const GEMS = {
  employment: { name: 'Emerald', mid: '#059669', deep: '#022C22', light: '#6EE7B7', shadow: 'rgba(5,150,105,0.45)' },
  flight: { name: 'Sapphire', mid: '#0284C7', deep: '#082F49', light: '#7DD3FC', shadow: 'rgba(2,132,199,0.45)' },
  rent: { name: 'Amber', mid: '#D97706', deep: '#451A03', light: '#FCD34D', shadow: 'rgba(217,119,6,0.45)' },
};

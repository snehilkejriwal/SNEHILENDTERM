import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { AlertTriangle, Clock, CheckCircle2 } from 'lucide-react';
import Page from '../components/ui/Page';
import AppShell from '../components/ui/AppShell';
import Gem from '../components/ui/Gem';
import { Skeleton, StatusBadge, ErrorState } from '../components/ui/Feedback';
import { useCases } from '../api/hooks';
import { useAuth } from '../context/AuthContext';
import { errorMessage } from '../api/client';
import { inr, ago } from '../lib/format';

// What to show next to a claim: its reply countdown while waiting, otherwise where it stands.
function Deadline({ d, status, sent }) {
  if (status === 'resolved') return <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-emerald"><CheckCircle2 className="h-4 w-4" />Resolved</span>;
  if (status === 'closed') return <span className="text-sm text-steel">Closed</span>;
  if (status === 'draft' || status === 'confirmed') return <span className="text-sm text-steel">Collecting facts</span>;
  if (!d || d.state === 'not_started') return <span className="text-sm text-steel">{sent ? 'Next stage ready to send' : 'Letter ready to send'}</span>;
  if (d.state === 'overdue') return <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-crimson"><AlertTriangle className="h-4 w-4" />{Math.abs(d.daysLeft)} days overdue</span>;
  return <span className={`inline-flex items-center gap-1.5 text-sm ${d.state === 'due_soon' ? 'text-[#8A5A12] font-semibold' : 'text-steel'}`}><Clock className="h-4 w-4" />{d.daysLeft} days left to reply</span>;
}

export default function Dashboard() {
  const { user } = useAuth();
  const { data, isLoading, isError, error, refetch } = useCases();
  const first = user?.name?.split(' ')[0];

  return (
    <Page>
      <AppShell>
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <p className="text-steel">Hello, {first}</p>
            <h1 className="font-serif text-[clamp(44px,6vw,76px)] leading-none mt-1">Your claims</h1>
          </div>
          <Link to="/cases/new" className="btn-primary">Start a new claim</Link>
        </div>

        {isLoading && <div className="mt-10 space-y-3"><Skeleton className="h-24" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>}
        {isError && <div className="mt-10"><ErrorState message={errorMessage(error)} onRetry={refetch} /></div>}

        {data && (
          <>
            <div className="mt-8 grid grid-cols-2 lg:grid-cols-4 gap-3.5">
              {[
                { label: 'Open claims', value: data.summary.open, tone: 'text-ink', border: 'from-emerald-500 to-teal-400' },
                { label: 'Overdue replies', value: data.summary.overdue, tone: data.summary.overdue ? 'text-crimson font-bold' : 'text-steel', border: 'from-rose-500 to-amber-500' },
                { label: 'Being claimed', value: inr(data.summary.claimed), tone: 'text-emerald-700 font-semibold', border: 'from-teal-600 to-emerald-500' },
                { label: 'Recovered', value: inr(data.summary.recovered), tone: 'text-emerald-600 font-bold', border: 'from-emerald-500 to-teal-300' },
              ].map((m) => (
                <div key={m.label} className="card p-5 relative overflow-hidden bg-white/95">
                  <div className={`absolute top-0 inset-x-0 h-1 bg-gradient-to-r ${m.border}`} />
                  <dt className="text-xs uppercase tracking-wider font-semibold text-steel">{m.label}</dt>
                  <dd className={`mt-2 font-serif text-[38px] leading-none tabular ${m.tone}`}>{m.value}</dd>
                </div>
              ))}
            </div>

            {data.cases.length === 0 ? (
              <div className="mt-6 rounded-panel glacier-wash text-white p-10 sm:p-14 shadow-lift border border-emerald-500/25 relative overflow-hidden">
                <div className="pointer-events-none absolute right-0 bottom-0 w-80 h-80 rounded-full bg-emerald-500/10 blur-3xl" />
                <p className="eyebrow mb-4">Ready to start</p>
                <h2 className="font-serif text-5xl leading-none">No active claims yet</h2>
                <p className="mt-4 max-w-md text-white/80 leading-relaxed">Start with whatever documentation you have: an offer letter and payslips, an e-ticket and cancellation message, or your rental agreement and landlord communications.</p>
                <Link to="/cases/new" className="btn-primary mt-7 font-semibold">Start your first claim</Link>
              </div>
            ) : (
              <ul className="mt-6 space-y-3">
                {data.cases.map((c, i) => (
                  <motion.li key={c.id} initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.3 + i * 0.05 }}>
                    <Link to={`/cases/${c.id}`} className="card flex flex-col md:flex-row md:items-center gap-4 p-5 hover:border-emerald-300 hover:shadow-brand hover:-translate-y-1 transition duration-200">
                      <Gem packKey={c.packKey} size={42} />
                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h2 className="font-semibold text-lg truncate">{c.title}</h2>
                          <StatusBadge status={c.status} />
                        </div>
                        <p className="text-sm text-steel mt-0.5">{c.packName}. Stage {c.stageIndex + 1} of {c.stageCount}: {c.stageLabel}. Updated {ago(c.updatedAt)}.</p>
                      </div>
                      <div className="md:w-48"><Deadline d={c.deadline} status={c.status} sent={c.stageIndex > 0} /></div>
                      <div className="md:w-36 md:text-right">
                        <p className="text-xs text-steel">{c.status === 'resolved' ? 'Recovered' : 'Shortfall'}</p>
                        <p className="font-serif text-2xl tabular">{c.status === 'resolved' ? inr(c.amountRecovered) : c.gap === null ? '—' : inr(Math.max(0, c.gap))}</p>
                      </div>
                    </Link>
                  </motion.li>
                ))}
              </ul>
            )}
          </>
        )}
      </AppShell>
    </Page>
  );
}

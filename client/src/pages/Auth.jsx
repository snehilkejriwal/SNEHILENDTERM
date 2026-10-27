import { lazy, Suspense, useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { toast } from 'sonner';
import Page from '../components/ui/Page';
import Logo from '../components/ui/Logo';
import { Spinner } from '../components/ui/Feedback';
import { useAuth } from '../context/AuthContext';
import { errorMessage, fieldErrors } from '../api/client';

const HeroScene = lazy(() => import('../components/three/HeroScene'));

// Only allow redirects within this site.
// Only same-site paths: "//evil.com" and "/\\evil.com" are treated by browsers as other sites.
const safeNext = (n) => (n && n.startsWith('/') && !n.startsWith('//') && !n.includes('\\') ? n : '/dashboard');

export default function Auth({ mode }) {
  const isRegister = mode === 'register';
  const { authenticate } = useAuth();
  const navigate = useNavigate();
  const [params] = useSearchParams();
  const [form, setForm] = useState({ name: '', email: '', password: '' });
  const [errors, setErrors] = useState({});
  const [busy, setBusy] = useState(false);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };

  const submit = async (e) => {
    e.preventDefault();
    const local = {};
    if (isRegister && form.name.trim().length < 2) local.name = 'Enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) local.email = 'Enter a valid email address.';
    if (form.password.length < (isRegister ? 8 : 1)) local.password = isRegister ? 'Use at least 8 characters.' : 'Enter your password.';
    if (Object.keys(local).length) return setErrors(local);
    setBusy(true);
    try {
      const body = isRegister ? form : { email: form.email, password: form.password };
      const user = await authenticate(mode, body);
      toast.success(isRegister ? `Welcome, ${user.name.split(' ')[0]}` : 'Logged in');
      navigate(safeNext(params.get('next')), { replace: true });
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    } finally {
      setBusy(false);
    }
  };

  const otherHref = `${isRegister ? '/login' : '/register'}${params.get('next') ? `?next=${encodeURIComponent(params.get('next'))}` : ''}`;

  return (
    <Page>
      <main className="min-h-svh p-2.5 sm:p-4 grid lg:grid-cols-[minmax(380px,480px)_1fr] gap-2.5 sm:gap-4">
        <motion.section className="rounded-panel bg-white p-7 sm:p-10 flex flex-col" initial={{ x: -40, opacity: 0 }} animate={{ x: 0, opacity: 1 }} transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1], delay: 0.3 }}>
          <Logo />
          <div className="my-auto py-12">
            <h1 className="font-serif text-[52px] leading-[0.95]">{isRegister ? 'Open your first claim' : 'Welcome back'}</h1>
            <p className="mt-3 text-steel">{isRegister ? 'Create an account to keep your cases, letters and deadlines in one place.' : 'Log in to see your claims and deadlines.'}</p>
            <form onSubmit={submit} className="mt-8 space-y-4" noValidate>
              {isRegister && (
                <div>
                  <label htmlFor="name" className="label">Full name</label>
                  <input id="name" className="field" autoComplete="name" value={form.name} onChange={set('name')} aria-invalid={Boolean(errors.name)} />
                  {errors.name && <p className="mt-1 text-sm text-crimson">{errors.name}</p>}
                </div>
              )}
              <div>
                <label htmlFor="email" className="label">Email</label>
                <input id="email" type="email" className="field" autoComplete="email" value={form.email} onChange={set('email')} aria-invalid={Boolean(errors.email)} />
                {errors.email && <p className="mt-1 text-sm text-crimson">{errors.email}</p>}
              </div>
              <div>
                <label htmlFor="password" className="label">Password</label>
                <input id="password" type="password" className="field" autoComplete={isRegister ? 'new-password' : 'current-password'} value={form.password} onChange={set('password')} aria-invalid={Boolean(errors.password)} />
                {errors.password && <p className="mt-1 text-sm text-crimson">{errors.password}</p>}
              </div>
              <button className="btn-primary w-full h-12" disabled={busy}>{busy && <Spinner />}{isRegister ? 'Create account' : 'Log in'}</button>
            </form>
            <p className="mt-6 text-sm text-steel">
              {isRegister ? 'Already have an account?' : 'New to SettleWise?'}{' '}
              <Link to={otherHref} className="font-semibold text-emerald-400 underline underline-offset-4 hover:text-emerald-300">{isRegister ? 'Log in' : 'Create an account'}</Link>
            </p>
          </div>
          <p className="text-xs text-steel">Guidance, not legal advice. Your documents are read and then discarded; only the extracted text is kept.</p>
        </motion.section>
        <section className="hidden lg:block relative rounded-panel glacier-wash overflow-hidden border border-indigo-400/20">
          <div className="pointer-events-none absolute top-10 right-10 w-80 h-80 rounded-full bg-cyan-500/15 blur-3xl animate-pulse-slow" />
          <Suspense fallback={null}><HeroScene className="absolute inset-0" /></Suspense>
          <div className="absolute left-10 bottom-10 right-10">
            <span className="eyebrow mb-3">Statutory Claims Platform</span>
            <p className="text-white display-serif text-[clamp(48px,6vw,96px)]">What is yours, <span className="text-aurora">in writing</span></p>
          </div>
        </section>
      </main>
    </Page>
  );
}

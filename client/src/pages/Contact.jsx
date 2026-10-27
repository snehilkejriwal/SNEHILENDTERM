import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import { toast } from 'sonner';
import Page from '../components/ui/Page';
import Logo from '../components/ui/Logo';
import { Spinner } from '../components/ui/Feedback';
import { useSendContact } from '../api/hooks';
import { errorMessage, fieldErrors } from '../api/client';

const TOPICS = [['question', 'A question'], ['feedback', 'Feedback'], ['partnership', 'Partnership'], ['other', 'Something else']];
const MAX = 2000;
const ease = [0.22, 1, 0.36, 1];

export default function Contact() {
  // Same dark backdrop as the landing page.
  useEffect(() => {
    document.body.classList.add('page-dark');
    return () => document.body.classList.remove('page-dark');
  }, []);

  const send = useSendContact();
  const [form, setForm] = useState({ name: '', email: '', topic: 'question', message: '', website: '' });
  const [errors, setErrors] = useState({});
  const [sent, setSent] = useState(false);

  const set = (k) => (e) => { setForm((f) => ({ ...f, [k]: e.target.value })); setErrors((x) => ({ ...x, [k]: undefined })); };

  const submit = async (e) => {
    e.preventDefault();
    const local = {};
    if (form.name.trim().length < 2) local.name = 'Enter your name.';
    if (!/^\S+@\S+\.\S+$/.test(form.email)) local.email = 'Enter a valid email address.';
    if (form.message.trim().length < 10) local.message = 'Write at least a sentence or two.';
    if (Object.keys(local).length) return setErrors(local);
    try {
      await send.mutateAsync(form);
      setSent(true);
    } catch (err) {
      setErrors(fieldErrors(err));
      toast.error(errorMessage(err));
    }
  };

  const err = (k) => errors[k] && <p id={`${k}-error`} className="mt-1.5 text-sm text-[#FCA5A5]">{errors[k]}</p>;

  return (
    <Page>
      <main className="min-h-svh text-white px-5 sm:px-8 lg:px-12 pb-16">
        <header className="flex items-center justify-between pt-5">
          <Logo light />
          <Link to="/" className="btn h-10 px-4 text-white/80 hover:text-white hover:bg-white/10"><ArrowLeft className="h-4 w-4" />Back to home</Link>
        </header>

        <div className="mx-auto mt-14 sm:mt-20 grid max-w-6xl gap-12 lg:grid-cols-[1fr_1.1fr] lg:gap-16">
          <motion.section initial={{ opacity: 0, y: 16 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease, delay: 0.3 }}>
            <p className="eyebrow">Contact us</p>
            <h1 className="mt-6 font-serif text-[clamp(48px,7vw,96px)] leading-[0.92]">Write to <span className="italic">us</span></h1>
            <p className="mt-6 max-w-md text-lg leading-relaxed text-white/65">
              Questions about how SettleWise works, feedback on a result, or an idea for a new case type: send it here and it reaches the team.
            </p>
            <ul className="mt-10 space-y-4 max-w-md text-[15px]">
              {[
                ['Not legal advice', 'We can explain how the rules and estimates work, but we cannot advise on your specific case.'],
                ['Keep it general', 'Please do not send documents, account numbers or other sensitive details in this form.'],
              ].map(([t, d]) => (
                <li key={t} className="border-l border-white/15 pl-4">
                  <p className="font-semibold text-white/90">{t}</p>
                  <p className="mt-1 text-white/55 leading-relaxed">{d}</p>
                </li>
              ))}
            </ul>
          </motion.section>

          <motion.section className="rounded-[28px] glass-dark shadow-glow p-6 sm:p-9" initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8, ease, delay: 0.4 }}>
            <AnimatePresence mode="wait" initial={false}>
              {sent ? (
                <motion.div key="done" className="py-14 text-center" initial={{ opacity: 0, scale: 0.96 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4, ease }} role="status">
                  <CheckCircle2 className="mx-auto h-12 w-12" strokeWidth={1.5} aria-hidden="true" />
                  <h2 className="mt-6 font-serif text-4xl">Message sent</h2>
                  <p className="mx-auto mt-3 max-w-sm text-white/60">Thank you, {form.name.split(' ')[0]}. Your message has reached the team.</p>
                  <div className="mt-8 flex flex-wrap justify-center gap-3">
                    <Link to="/" className="btn-white">Back to home</Link>
                    <button className="btn text-white border border-white/15 hover:bg-white/10" onClick={() => { setSent(false); setForm((f) => ({ ...f, message: '' })); }}>Send another</button>
                  </div>
                </motion.div>
              ) : (
                <motion.form key="form" onSubmit={submit} noValidate className="space-y-5" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
                  <div className="grid gap-5 sm:grid-cols-2">
                    <div>
                      <label htmlFor="name" className="label-dark">Your name</label>
                      <input id="name" className="field-dark h-11" autoComplete="name" value={form.name} onChange={set('name')} aria-invalid={Boolean(errors.name)} aria-describedby={errors.name ? 'name-error' : undefined} />
                      {err('name')}
                    </div>
                    <div>
                      <label htmlFor="email" className="label-dark">Email</label>
                      <input id="email" type="email" className="field-dark h-11" autoComplete="email" value={form.email} onChange={set('email')} aria-invalid={Boolean(errors.email)} aria-describedby={errors.email ? 'email-error' : undefined} />
                      {err('email')}
                    </div>
                  </div>
                  <fieldset>
                    <legend className="label-dark">What is it about?</legend>
                    <div className="flex flex-wrap gap-2">
                      {TOPICS.map(([value, label]) => (
                        <label key={value} className={`cursor-pointer rounded-full border px-4 py-2 text-sm transition has-[:focus-visible]:outline has-[:focus-visible]:outline-2 has-[:focus-visible]:outline-white has-[:focus-visible]:outline-offset-2 ${form.topic === value ? 'border-sky-400 bg-gradient-to-r from-indigo-600 to-indigo-700 text-white font-semibold shadow-brand' : 'border-white/15 text-white/75 hover:border-white/40 hover:bg-white/[0.04]'}`}>
                          <input type="radio" name="topic" value={value} checked={form.topic === value} onChange={set('topic')} className="sr-only" />
                          {label}
                        </label>
                      ))}
                    </div>
                  </fieldset>
                  <div>
                    <div className="flex items-baseline justify-between">
                      <label htmlFor="message" className="label-dark">Message</label>
                      <span className={`text-xs tabular ${form.message.length > MAX ? 'text-[#FCA5A5]' : 'text-white/40'}`}>{form.message.length} / {MAX}</span>
                    </div>
                    <textarea id="message" rows={6} maxLength={MAX} className="field-dark py-3 resize-y min-h-[140px]" value={form.message} onChange={set('message')} aria-invalid={Boolean(errors.message)} aria-describedby={errors.message ? 'message-error' : undefined} />
                    {err('message')}
                  </div>
                  {/* Honeypot: hidden from people and screen readers, filled in by bots. */}
                  <div className="hidden" aria-hidden="true">
                    <label htmlFor="website">Website</label>
                    <input id="website" tabIndex={-1} autoComplete="off" value={form.website} onChange={set('website')} />
                  </div>
                  <button className="btn-primary w-full h-12 text-base font-semibold" disabled={send.isPending}>{send.isPending && <Spinner />}Send message</button>
                  <p className="text-xs text-white/40">We only use your email to reply to this message.</p>
                </motion.form>
              )}
            </AnimatePresence>
          </motion.section>
        </div>
      </main>
    </Page>
  );
}

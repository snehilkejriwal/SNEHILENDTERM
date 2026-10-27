import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import Page from '../components/ui/Page';
import AppShell from '../components/ui/AppShell';
import Gem from '../components/ui/Gem';
import { Skeleton, Spinner, ErrorState } from '../components/ui/Feedback';
import { usePacks, useCreateCase } from '../api/hooks';
import { errorMessage, fieldErrors } from '../api/client';

export default function NewCase() {
  const [params] = useSearchParams();
  const { data: packs, isLoading, isError, error, refetch } = usePacks();
  const create = useCreateCase();
  const navigate = useNavigate();
  const [packKey, setPackKey] = useState(params.get('pack') || '');
  const [title, setTitle] = useState('');
  const [titleError, setTitleError] = useState('');

  // Suggested titles come from the pack data. A title is only replaced while it is empty or still
  // another pack's suggestion, so anything the user typed is kept.
  const suggestedFor = (key) => packs?.find((p) => p.key === key)?.suggestedTitle || '';
  const isSuggestion = (t) => !t.trim() || Boolean(packs?.some((p) => p.suggestedTitle && p.suggestedTitle === t));
  const choose = (key) => { setPackKey(key); if (isSuggestion(title)) setTitle(suggestedFor(key)); };

  // Opening /cases/new?pack=… fills the title once the packs have loaded.
  useEffect(() => {
    if (packs && packKey && isSuggestion(title)) setTitle(suggestedFor(packKey));
  }, [packs]); // eslint-disable-line react-hooks/exhaustive-deps

  const submit = async (e) => {
    e.preventDefault();
    if (!packKey) return toast.error('Choose what happened first.');
    if (title.trim().length < 3) return setTitleError('Give the claim a short title.');
    try {
      const { case: c } = await create.mutateAsync({ packKey, title: title.trim() });
      toast.success('Claim opened');
      navigate(`/cases/${c.id}`);
    } catch (err) {
      setTitleError(fieldErrors(err).title || '');
      toast.error(errorMessage(err));
    }
  };

  return (
    <Page>
      <AppShell>
        <h1 className="font-serif text-[clamp(44px,6vw,76px)] leading-none">What happened?</h1>
        <p className="mt-3 text-steel max-w-xl">Choose the situation. You will add documents and check the facts on the next screen.</p>
        {isLoading && <div className="mt-8 grid sm:grid-cols-2 gap-4"><Skeleton className="h-52" /><Skeleton className="h-52" /></div>}
        {isError && <div className="mt-8"><ErrorState message={errorMessage(error)} onRetry={refetch} /></div>}
        {packs && (
          <form onSubmit={submit} className="mt-8">
            <fieldset>
              <legend className="sr-only">Case type</legend>
              <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {packs.map((p) => {
                  const live = p.status === 'live';
                  const selected = packKey === p.key;
                  return (
                    <label key={p.key} className={`relative rounded-[24px] p-6 border transition-all cursor-pointer ${!live ? 'opacity-55 cursor-not-allowed bg-white/50 border-line' : selected ? 'bg-white border-indigo-600 ring-2 ring-indigo-500/20 shadow-brand' : 'bg-white border-line hover:border-indigo-200 hover:-translate-y-1 hover:shadow-md'}`}>
                      <input type="radio" name="pack" value={p.key} disabled={!live} checked={selected} onChange={() => choose(p.key)} className="sr-only" />
                      <motion.div animate={{ rotate: selected ? -8 : 0, scale: selected ? 1.08 : 1 }}><Gem packKey={p.key} size={60} /></motion.div>
                      <p className="mt-6 font-serif text-[26px] leading-[1.05]">{p.name}</p>
                      <p className="mt-2 text-sm text-steel">{live ? p.description : 'Coming soon'}</p>
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div className="mt-8 card p-6 sm:p-8 max-w-2xl">
              <label htmlFor="title" className="label">Name this claim</label>
              <input id="title" className="field" value={title} onChange={(e) => { setTitle(e.target.value); setTitleError(''); }} placeholder="For example: Final settlement from Nimbus Softech" maxLength={120} />
              {titleError && <p className="mt-1 text-sm text-crimson">{titleError}</p>}
              <button className="btn-primary mt-5" disabled={create.isPending || !packKey}>{create.isPending && <Spinner />}Open claim</button>
            </div>
          </form>
        )}
      </AppShell>
    </Page>
  );
}

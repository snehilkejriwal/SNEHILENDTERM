import { useRef, useState } from 'react';
import { FileText, UploadCloud, X, Sparkles } from 'lucide-react';
import { toast } from 'sonner';
import { useUploadDocs } from '../../api/hooks';
import { errorMessage } from '../../api/client';
import { Spinner } from '../ui/Feedback';

const MAX = 5 * 1024 * 1024;

export default function DocumentsPanel({ caseData, editable }) {
  const upload = useUploadDocs(caseData.id);
  const input = useRef(null);
  const [files, setFiles] = useState([]);
  const [text, setText] = useState('');
  const [drag, setDrag] = useState(false);
  const [showPaste, setShowPaste] = useState(false);

  const add = (list) => {
    const next = [...files];
    for (const f of list) {
      if (!['application/pdf', 'text/plain'].includes(f.type)) { toast.error(`${f.name} is not a PDF or .txt file.`); continue; }
      if (f.size > MAX) { toast.error(`${f.name} is over 5 MB.`); continue; }
      if (next.length >= 5) { toast.error('Add up to 5 files at a time.'); break; }
      next.push(f);
    }
    setFiles(next);
  };

  const submit = async () => {
    if (!files.length && !text.trim()) return toast.error('Add a PDF or paste some text first.');
    try {
      const res = await upload.mutateAsync({ files, text: text.trim() });
      setFiles([]); setText(''); setShowPaste(false);
      const n = res.extraction.filled.length;
      if (n) toast.success(`Filled ${n} fact${n > 1 ? 's' : ''} from your documents. Check them below; empty boxes weren't in the documents.`, { duration: 7000 });
      else toast.warning(res.extraction.message || 'No new facts were found in these documents.', { duration: 8000 });
    } catch (err) {
      toast.error(errorMessage(err));
    }
  };

  return (
    <section className="card p-6 sm:p-8" aria-labelledby="docs-h">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 id="docs-h" className="font-serif text-3xl">Documents</h2>
          <p className="text-steel text-sm mt-1 max-w-lg">Add the documents you have. SettleWise reads them and fills in the facts for you to check. Files are read and discarded; only their text is kept.</p>
        </div>
      </div>

      {caseData.documents.length > 0 && (
        <ul className="mt-5 grid sm:grid-cols-2 gap-2">
          {caseData.documents.map((d) => (
            <li key={d.id} className="flex items-center gap-3 rounded-xl bg-frost px-3.5 py-2.5 text-sm">
              <FileText className="h-4 w-4 text-glacier-700 shrink-0" />
              <span className="truncate flex-1">{d.name}</span>
              <span className="text-steel tabular">{(d.charCount / 1000).toFixed(1)}k chars</span>
            </li>
          ))}
        </ul>
      )}

      {editable && (
        <div className="mt-5">
          <div
            onDragOver={(e) => { e.preventDefault(); setDrag(true); }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => { e.preventDefault(); setDrag(false); add(e.dataTransfer.files); }}
            className={`rounded-2xl border-2 border-dashed p-8 text-center transition ${drag ? 'border-glacier-500 bg-glacier-100/60' : 'border-line bg-frost/50'}`}
          >
            <UploadCloud className="h-8 w-8 mx-auto text-glacier-700" />
            <p className="mt-3 font-medium">Drop PDFs here</p>
            <p className="text-sm text-steel">PDF or .txt, up to 5 MB each</p>
            <div className="mt-4 flex flex-wrap justify-center gap-2">
              <button type="button" className="btn-ghost h-10" onClick={() => input.current?.click()}>Choose files</button>
              <button type="button" className="btn-ghost h-10" onClick={() => setShowPaste((v) => !v)}>{showPaste ? 'Hide text box' : 'Paste text instead'}</button>
            </div>
            <input ref={input} type="file" accept="application/pdf,text/plain" multiple className="sr-only" aria-label="Choose PDF or text files to upload" onChange={(e) => { add(e.target.files); e.target.value = ''; }} />
          </div>

          {showPaste && (
            <div className="mt-4">
              <label htmlFor="paste" className="label">Paste the text of an email, SMS or letter</label>
              <textarea id="paste" rows={6} className="field h-auto py-3" value={text} onChange={(e) => setText(e.target.value)} maxLength={20000} />
            </div>
          )}

          {files.length > 0 && (
            <ul className="mt-4 flex flex-wrap gap-2">
              {files.map((f, i) => (
                <li key={f.name + i} className="inline-flex items-center gap-2 rounded-full bg-ink text-white pl-3.5 pr-1.5 py-1.5 text-sm">
                  {f.name}
                  <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))} className="rounded-full p-1 hover:bg-white/20" aria-label={`Remove ${f.name}`}><X className="h-3.5 w-3.5" /></button>
                </li>
              ))}
            </ul>
          )}

          <button type="button" className="btn-ink mt-5" onClick={submit} disabled={upload.isPending || (!files.length && !text.trim())}>
            {upload.isPending ? <Spinner /> : <Sparkles className="h-4 w-4" />}
            {upload.isPending ? 'Reading your documents' : 'Read documents and fill facts'}
          </button>
        </div>
      )}
    </section>
  );
}

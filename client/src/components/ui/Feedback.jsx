import { motion, AnimatePresence } from 'framer-motion';
import { X, Loader2 } from 'lucide-react';
import { useEffect } from 'react';
import { createPortal } from 'react-dom';
import { STATUS } from '../../lib/format';

export const Spinner = ({ className = 'h-4 w-4' }) => <Loader2 className={`animate-spin ${className}`} aria-hidden="true" />;

export function Skeleton({ className = '' }) {
  return <div className={`animate-pulse rounded-xl bg-mist ${className}`} />;
}

export function StatusBadge({ status }) {
  const s = STATUS[status] || STATUS.draft;
  return <span className={`inline-flex items-center rounded-full px-2.5 py-1 text-xs font-semibold ${s.tone}`}>{s.label}</span>;
}

export function ErrorState({ title = 'This page could not load', message, onRetry }) {
  return (
    <div className="card p-8 text-center max-w-lg mx-auto" role="alert">
      <h2 className="font-serif text-3xl">{title}</h2>
      {message && <p className="mt-2 text-steel">{message}</p>}
      {onRetry && <button className="btn-ink mt-5" onClick={onRetry}>Try again</button>}
    </div>
  );
}

export function Modal({ open, onClose, title, children, width = 'max-w-lg' }) {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prevOverflow; };
  }, [open, onClose]);

  if (typeof document === 'undefined') return null;

  return createPortal(
    <AnimatePresence>
      {open && (
        <motion.div key="modal" className="fixed inset-0 flex items-center justify-center p-4" style={{ zIndex: 1000 }} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}>
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" style={{ zIndex: 0 }} onClick={onClose} aria-hidden="true" />
          <motion.div
            role="dialog" aria-modal="true" aria-label={title} data-lenis-prevent
            className={`relative w-full ${width} rounded-[28px] bg-white p-6 sm:p-8 shadow-2xl border border-line/80 max-h-[88vh] overflow-y-auto`}
            style={{ zIndex: 1, color: '#0E1726' }}
            initial={{ y: 24, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 16, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 320, damping: 30 }}
          >
            <div className="absolute top-0 inset-x-0 h-1 bg-gradient-to-r from-sky-400 via-indigo-500 to-emerald-400" />
            <div className="flex items-start justify-between gap-4 mb-4">
              <h2 className="font-serif text-[28px] leading-tight">{title}</h2>
              <button onClick={onClose} className="rounded-full p-2 hover:bg-black/5" aria-label="Close"><X className="h-5 w-5" /></button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>,
    document.body
  );
}

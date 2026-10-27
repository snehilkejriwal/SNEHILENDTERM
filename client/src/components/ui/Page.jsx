import { motion, useReducedMotion } from 'framer-motion';

const ease = [0.76, 0, 0.24, 1];

// Every route is wrapped in <Page>. On navigation a glacier curtain sweeps up over the old page,
// then lifts off the new one, so moving between pages feels like turning a sheet.
export default function Page({ children, className = '' }) {
  const reduce = useReducedMotion();
  if (reduce) return <div className={className}>{children}</div>;
  return (
    <>
      <motion.div
        className="fixed inset-0 z-[80] glacier-wash pointer-events-none"
        style={{ originY: 1 }}
        initial={{ scaleY: 0 }}
        animate={{ scaleY: 0 }}
        exit={{ scaleY: 1, transition: { duration: 0.55, ease } }}
      />
      <motion.div
        className="fixed inset-0 z-[80] glacier-wash pointer-events-none"
        style={{ originY: 0 }}
        initial={{ scaleY: 1 }}
        animate={{ scaleY: 0, transition: { duration: 0.65, ease, delay: 0.05 } }}
        exit={{ scaleY: 0 }}
      />
      <motion.div
        className={className}
        initial={{ opacity: 0, y: 24 }}
        animate={{ opacity: 1, y: 0, transition: { duration: 0.7, ease: [0.22, 1, 0.36, 1], delay: 0.25 } }}
        exit={{ opacity: 0, transition: { duration: 0.2 } }}
      >
        {children}
      </motion.div>
    </>
  );
}

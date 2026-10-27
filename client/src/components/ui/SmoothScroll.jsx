import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import Lenis from 'lenis';

let lenis = null;

// Lenis gives the inertia-style smooth scrolling. Disabled for people who prefer reduced motion.
export default function SmoothScroll() {
  const { pathname } = useLocation();

  useEffect(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return undefined;
    lenis = new Lenis({ duration: 1.15, smoothWheel: true });
    let id;
    const raf = (t) => { lenis.raf(t); id = requestAnimationFrame(raf); };
    id = requestAnimationFrame(raf);
    return () => { cancelAnimationFrame(id); lenis.destroy(); lenis = null; };
  }, []);

  useEffect(() => {
    // Wait for the page curtain to cover the screen, then jump to the top.
    const t = setTimeout(() => (lenis ? lenis.scrollTo(0, { immediate: true }) : window.scrollTo(0, 0)), 500);
    return () => clearTimeout(t);
  }, [pathname]);

  return null;
}

export const scrollToId = (id) => {
  const el = document.getElementById(id);
  if (!el) return;
  if (lenis) lenis.scrollTo(el, { offset: -24 });
  else el.scrollIntoView({ behavior: 'smooth' });
};

import { useEffect } from 'react';
import Page from '../components/ui/Page';
import Hero from '../components/landing/Hero';
import StepsScroll from '../components/landing/StepsScroll';
import CaseTypes from '../components/landing/CaseTypes';
import Trust from '../components/landing/Trust';
import RealCase from '../components/landing/RealCase';
import Closing from '../components/landing/Closing';

export default function Landing() {
  // The landing page sits on one dark backdrop; app pages keep the light one.
  useEffect(() => {
    document.body.classList.add('page-dark');
    return () => document.body.classList.remove('page-dark');
  }, []);
  return (
    <Page>
      <main className="text-white">
        <Hero />
        <StepsScroll />
        <CaseTypes />
        <Trust />
        <RealCase />
        <Closing />
      </main>
    </Page>
  );
}

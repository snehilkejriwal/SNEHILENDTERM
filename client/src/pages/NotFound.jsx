import { Link } from 'react-router-dom';
import Page from '../components/ui/Page';

export default function NotFound() {
  return (
    <Page>
      <main className="min-h-svh p-2.5 sm:p-4">
        <div className="min-h-[calc(100svh-32px)] rounded-panel glacier-wash chamfer text-white grid place-items-center p-8 text-center">
          <div>
            <p className="display-black text-[clamp(120px,24vw,320px)]">404</p>
            <p className="font-serif text-4xl mt-4">This page is not on file</p>
            <Link to="/" className="btn-white mt-8">Go to the home page</Link>
          </div>
        </div>
      </main>
    </Page>
  );
}

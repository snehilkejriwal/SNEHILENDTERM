import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate, useLocation } from 'react-router-dom';
import { AnimatePresence } from 'framer-motion';
import { useAuth } from './context/AuthContext';
import SmoothScroll from './components/ui/SmoothScroll';
import { Spinner } from './components/ui/Feedback';
import Landing from './pages/Landing';
import Auth from './pages/Auth';
import NotFound from './pages/NotFound';

// App pages load on demand so the landing page stays light.
const Dashboard = lazy(() => import('./pages/Dashboard'));
const NewCase = lazy(() => import('./pages/NewCase'));
const CaseDetail = lazy(() => import('./pages/CaseDetail'));
const AdminRules = lazy(() => import('./pages/AdminRules'));
const Contact = lazy(() => import('./pages/Contact'));

const Loading = () => <div className="min-h-svh grid place-items-center"><Spinner className="h-6 w-6 text-glacier-700" /></div>;

function Protected({ children, role }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Loading />;
  if (!user) return <Navigate to={`/login?next=${encodeURIComponent(location.pathname + location.search)}`} replace />;
  if (role && user.role !== role) return <Navigate to="/dashboard" replace />;
  return children;
}

function GuestOnly({ children }) {
  const { user, loading } = useAuth();
  if (loading) return <Loading />;
  return user ? <Navigate to="/dashboard" replace /> : children;
}

export default function App() {
  const location = useLocation();
  return (
    <>
      <SmoothScroll />
      <Suspense fallback={<Loading />}>
        <AnimatePresence mode="wait">
          <Routes location={location} key={location.pathname}>
            <Route path="/" element={<Landing />} />
            <Route path="/contact" element={<Contact />} />
            <Route path="/login" element={<GuestOnly><Auth mode="login" /></GuestOnly>} />
            <Route path="/register" element={<GuestOnly><Auth mode="register" /></GuestOnly>} />
            <Route path="/dashboard" element={<Protected><Dashboard /></Protected>} />
            <Route path="/cases/new" element={<Protected><NewCase /></Protected>} />
            <Route path="/cases/:id" element={<Protected><CaseDetail /></Protected>} />
            <Route path="/admin" element={<Protected role="admin"><AdminRules /></Protected>} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </AnimatePresence>
      </Suspense>
    </>
  );
}

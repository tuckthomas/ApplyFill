import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import TooltipPortal from './components/ui/TooltipPortal';
import { APP_BRAND } from './constants/brand';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const ResumeBuilder = lazy(() => import('./pages/ResumeBuilder'));
const ProfileEditor = lazy(() => import('./pages/ProfileEditor'));
const Resumes = lazy(() => import('./pages/Resumes'));
const Settings = lazy(() => import('./pages/Settings'));

function RouteFallback() {
  return (
    <div className="surface-panel" style={{ padding: '24px' }} role="status" aria-live="polite">
      Loading
    </div>
  );
}

function App() {
  useEffect(() => {
    document.title = APP_BRAND.name;
  }, []);

  return (
    <>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Suspense fallback={<RouteFallback />}><Dashboard /></Suspense>} />
            <Route path="profile" element={<Suspense fallback={<RouteFallback />}><ProfileEditor /></Suspense>} />
            <Route path="resumes/builder" element={<Suspense fallback={<RouteFallback />}><ResumeBuilder /></Suspense>} />
            <Route path="resumes" element={<Suspense fallback={<RouteFallback />}><Resumes /></Suspense>} />
            <Route path="settings" element={<Suspense fallback={<RouteFallback />}><Settings /></Suspense>} />
          </Route>
        </Routes>
      </BrowserRouter>
      <TooltipPortal />
    </>
  );
}

export default App;

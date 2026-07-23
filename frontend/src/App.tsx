import { lazy, Suspense, useEffect } from 'react';
import { BrowserRouter, Navigate, Routes, Route, useLocation } from 'react-router-dom';
import { MainLayout } from './components/layout/MainLayout';
import TooltipPortal from './components/ui/TooltipPortal';
import { APP_BRAND } from './constants/brand';
import { DateFormatPreferenceProvider } from './features/preferences/DateFormatProvider';

const Dashboard = lazy(() => import('./pages/Dashboard'));
const ResumeBuilder = lazy(() => import('./pages/ResumeBuilder'));
const ProfileEditor = lazy(() => import('./pages/ProfileEditor'));
const MyProfile = lazy(() => import('./pages/MyProfile'));
const Resumes = lazy(() => import('./pages/Resumes'));
const JobTracker = lazy(() => import('./pages/JobTracker'));
const JobApplicationEditor = lazy(() => import('./pages/JobApplicationEditor'));
const Settings = lazy(() => import('./pages/Settings'));

function RouteFallback() {
  return (
    <div className="surface-panel" style={{ padding: '24px' }} role="status" aria-live="polite">
      Loading
    </div>
  );
}

function LegacyProfileRedirect({ to }: { to: string }) {
  const { search } = useLocation();
  return <Navigate replace to={`${to}${search}`} />;
}

function App() {
  useEffect(() => {
    document.title = APP_BRAND.name;
  }, []);

  return (
    <DateFormatPreferenceProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<MainLayout />}>
            <Route index element={<Suspense fallback={<RouteFallback />}><Dashboard /></Suspense>} />
            <Route path="job-profile" element={<Suspense fallback={<RouteFallback />}><MyProfile /></Suspense>} />
            <Route path="job-profile/builder" element={<Suspense fallback={<RouteFallback />}><ProfileEditor /></Suspense>} />
            <Route path="job-profile/wizard" element={<LegacyProfileRedirect to="/job-profile/builder" />} />
            <Route path="profile" element={<LegacyProfileRedirect to="/job-profile" />} />
            <Route path="profile/wizard" element={<LegacyProfileRedirect to="/job-profile/builder" />} />
            <Route path="resumes/builder" element={<Suspense fallback={<RouteFallback />}><ResumeBuilder /></Suspense>} />
            <Route path="resumes/builder/:resumeId" element={<Suspense fallback={<RouteFallback />}><ResumeBuilder /></Suspense>} />
            <Route path="resumes" element={<Suspense fallback={<RouteFallback />}><Resumes /></Suspense>} />
            <Route path="job-tracker" element={<Suspense fallback={<RouteFallback />}><JobTracker /></Suspense>} />
            <Route path="job-tracker/new" element={<Suspense fallback={<RouteFallback />}><JobApplicationEditor /></Suspense>} />
            <Route path="job-tracker/:applicationId/edit" element={<Suspense fallback={<RouteFallback />}><JobApplicationEditor /></Suspense>} />
            <Route path="agent/*" element={<Navigate replace to="/job-tracker" />} />
            <Route path="settings" element={<Suspense fallback={<RouteFallback />}><Settings /></Suspense>} />
          </Route>
        </Routes>
      </BrowserRouter>
      <TooltipPortal />
    </DateFormatPreferenceProvider>
  );
}

export default App;

import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router';
import { useEffect, useState } from 'react';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import GlobalBanner from './components/GlobalBanner';
import HomePage from './pages/HomePage';
import TrackerPage from './pages/TrackerPage';
import ReportScamPage from './pages/ReportScamPage';
import EducationPage from './pages/EducationPage';
import ShutdownPage from './pages/ShutdownPage';
import DisclaimerPage from './pages/DisclaimerPage';
import TriagePage from './pages/TriagePage';
import LivestreamSafetyPage from './pages/LivestreamSafetyPage';
import DonatePage from './pages/DonatePage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const [hasAccepted, setHasAccepted] = useState<boolean | null>(null);

  useEffect(() => {
    const accepted = localStorage.getItem('disclaimer_accepted') === 'true';
    setHasAccepted(accepted);
  }, []);

  if (hasAccepted === null) {
    return null;
  }

  if (!hasAccepted) {
    return <Navigate to="/disclaimer" replace />;
  }

  return <>{children}</>;
}

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200">
        <Routes>
          <Route path="/disclaimer" element={<DisclaimerPage />} />
          <Route
            path="/*"
            element={
              <ProtectedRoute>
                <div className="flex flex-col min-h-screen">
                  <GlobalBanner />
                  <Navigation />
                  <div className="flex-1">
                    <Routes>
                      <Route path="/" element={<Navigate to="/home" replace />} />
                      <Route path="/home" element={<HomePage />} />
                      <Route path="/tracker" element={<TrackerPage />} />
                      <Route path="/shutdown" element={<ShutdownPage />} />
                      <Route path="/report" element={<ReportScamPage />} />
                      <Route path="/education" element={<EducationPage />} />
                      <Route path="/stream-safety" element={<LivestreamSafetyPage />} />
                      <Route path="/triage" element={<TriagePage />} />
                      <Route path="/donate" element={<DonatePage />} />
                    </Routes>
                  </div>
                  <Footer />
                </div>
              </ProtectedRoute>
            }
          />
        </Routes>
      </div>
    </Router>
  );
}

export default App;

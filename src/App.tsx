import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router';
import Navigation from './components/Navigation';
import Footer from './components/Footer';
import GlobalBanner from './components/GlobalBanner';
import TermsBanner from './components/TermsBanner';
import HomePage from './pages/HomePage';
import TrackerPage from './pages/TrackerPage';
import ReportScamPage from './pages/ReportScamPage';
import EducationPage from './pages/EducationPage';
import ShutdownPage from './pages/ShutdownPage';
import DisclaimerPage from './pages/DisclaimerPage';
import TriagePage from './pages/TriagePage';
import LivestreamSafetyPage from './pages/LivestreamSafetyPage';

function App() {
  return (
    <Router>
      <div className="min-h-screen bg-slate-50 dark:bg-slate-950 transition-colors duration-200 flex flex-col relative">
        <GlobalBanner />
        <Navigation />

        <div className="flex-1 pb-16">
          <Routes>
            <Route path="/" element={<Navigate to="/home" replace />} />
            <Route path="/home" element={<HomePage />} />
            <Route path="/tracker" element={<TrackerPage />} />
            <Route path="/shutdown" element={<ShutdownPage />} />
            <Route path="/report" element={<ReportScamPage />} />
            <Route path="/education" element={<EducationPage />} />
            <Route path="/stream-safety" element={<LivestreamSafetyPage />} />
            <Route path="/triage" element={<TriagePage />} />
            <Route path="/disclaimer" element={<DisclaimerPage />} />
            <Route path="*" element={<Navigate to="/home" replace />} />
          </Routes>
        </div>

        <Footer />
        <TermsBanner />
      </div>
    </Router>
  );
}

export default App;

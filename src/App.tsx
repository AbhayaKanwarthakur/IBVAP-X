import { Component, lazy, Suspense, useState, type ErrorInfo, type ReactNode } from 'react';
import Layout from './components/Layout';

const CommandCenter = lazy(() => import('./pages/CommandCenter'));
const LiveSurveillance = lazy(() => import('./pages/LiveSurveillance'));
const LicensePlates = lazy(() => import('./pages/LicensePlates'));
const VideoAnalysis = lazy(() => import('./pages/VideoAnalysis'));
const Incidents = lazy(() => import('./pages/Incidents'));
const ThreatIntelligence = lazy(() => import('./pages/ThreatIntelligence'));
const EntityTracking = lazy(() => import('./pages/EntityTracking'));
const SectorMap = lazy(() => import('./pages/SectorMap'));
const Analytics = lazy(() => import('./pages/Analytics'));
const EvidenceCenter = lazy(() => import('./pages/EvidenceCenter'));
const SystemHealth = lazy(() => import('./pages/SystemHealth'));
const Settings = lazy(() => import('./pages/Settings'));

type Page = 'command' | 'surveillance' | 'plates' | 'analysis' | 'incidents' | 'threat' | 'tracking' | 'map' | 'analytics' | 'evidence' | 'health' | 'settings';

class AppErrorBoundary extends Component<{ children: ReactNode }, { hasError: boolean }> {
  state = { hasError: false };

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Application render failed', error, info.componentStack);
  }

  render() {
    if (this.state.hasError) {
      return (
        <div className="flex h-full items-center justify-center p-6" style={{ background: '#07090c' }}>
          <div className="max-w-md text-center">
            <div className="font-rajdhani font-700 tracking-widest" style={{ color: '#ef4444', fontSize: 18 }}>SYSTEM VIEW UNAVAILABLE</div>
            <p className="font-mono mt-2" style={{ color: '#64748b', fontSize: 11 }}>The dashboard could not render this view. Reload the application to try again.</p>
            <button className="btn-danger mt-4" onClick={() => window.location.reload()}>RELOAD APPLICATION</button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

export default function App() {
  const [page, setPage] = useState<Page>('surveillance');
  const pages: Record<Page, React.ReactNode> = {
    command: <CommandCenter />,
    surveillance: <LiveSurveillance />,
    plates: <LicensePlates />,
    analysis: <VideoAnalysis />,
    incidents: <Incidents />,
    threat: <ThreatIntelligence />,
    tracking: <EntityTracking />,
    map: <SectorMap />,
    analytics: <Analytics />,
    evidence: <EvidenceCenter />,
    health: <SystemHealth />,
    settings: <Settings />,
  };

  return (
    <div className="h-full relative">
      <AppErrorBoundary>
        <Layout page={page} setPage={(p) => setPage(p as Page)}>
          <Suspense fallback={
            <div className="flex h-full items-center justify-center" style={{ background: '#07090c' }}>
              <div className="font-mono" style={{ color: '#00d4ff', fontSize: 11, letterSpacing: '0.12em' }}>LOADING VIEW...</div>
            </div>
          }>
            {pages[page]}
          </Suspense>
        </Layout>
      </AppErrorBoundary>

    </div>
  );
}

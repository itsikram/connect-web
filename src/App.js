import React, { Fragment, useEffect, useState, lazy, Suspense } from 'react';
import Main from './pages/Main';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import './assets/fontawesome/css/all.min.css';
import './assets/css/style.scss';
import './assets/css/auth.css';
import './assets/css/video-call.css';
import 'nprogress/nprogress.css';
import './assets/css/nprogress-overrides.css';
import './assets/css/portfolio.scss';
import './assets/css/ui-polish.css';
import process from 'process';
import { AuthProvider } from './contexts/AuthContext';
import { CallMinimizeProvider } from './contexts/CallMinimizeContext';
import { WatchPipProvider } from './contexts/WatchPipContext';
import ErrorBoundary from './components/ErrorBoundary';
import VoiceInputEnhancer from './components/VoiceInputEnhancer';
import './utils/configValidation';
window.process = process;

const DownloadAppModal = lazy(() =>
  import('./components/modal/DownloadAppModal')
);

function App() {
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  // Wake emotion-detection service after first paint so it does not compete with feed load
  useEffect(() => {
    const wake = () => {
      fetch("https://emotion-detection-z1b2.onrender.com").catch(() => {});
    };
    const idle = window.requestIdleCallback
      ? window.requestIdleCallback(wake, { timeout: 8000 })
      : window.setTimeout(wake, 4000);
    return () => {
      if (window.cancelIdleCallback && typeof idle === "number") {
        window.cancelIdleCallback(idle);
      } else {
        window.clearTimeout(idle);
      }
    };
  }, []);

  // Block pinch / multi-touch zoom on mobile (esp. iOS Safari / home-screen app)
  useEffect(() => {
    const preventGesture = (e) => e.preventDefault();
    const preventMultiTouch = (e) => {
      if (e.touches && e.touches.length > 1) e.preventDefault();
    };

    document.addEventListener('gesturestart', preventGesture, { passive: false });
    document.addEventListener('gesturechange', preventGesture, { passive: false });
    document.addEventListener('gestureend', preventGesture, { passive: false });
    document.addEventListener('touchmove', preventMultiTouch, { passive: false });

    return () => {
      document.removeEventListener('gesturestart', preventGesture);
      document.removeEventListener('gesturechange', preventGesture);
      document.removeEventListener('gestureend', preventGesture);
      document.removeEventListener('touchmove', preventMultiTouch);
    };
  }, []);


  // Offer the native app only to phone visitors who are not already in the
  // installed app, and not the moment the page opens. iPhones get the
  // dedicated iOS install banner instead.
  useEffect(() => {
    try {
      if (localStorage.getItem('download_app_modal_dismissed')) return undefined;
    } catch (e) {
      // ignore
    }
    const ua = window.navigator.userAgent.toLowerCase();
    const isIos =
      /iphone|ipad|ipod/.test(ua) ||
      (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
    const isPhone =
      /android|mobi/.test(ua) ||
      (window.matchMedia?.('(pointer: coarse)').matches && window.innerWidth < 900);
    const isStandalone =
      window.navigator.standalone === true ||
      window.matchMedia?.('(display-mode: standalone)').matches;
    if (isIos || !isPhone || isStandalone) return undefined;
    const timer = window.setTimeout(() => setShowDownloadModal(true), 12000);
    return () => window.clearTimeout(timer);
  }, []);

  const handleCloseDownloadModal = () => {
    try {
      localStorage.setItem('download_app_modal_dismissed', 'true');
    } catch (e) {
      // Ignore localStorage errors
    }
    setShowDownloadModal(false);
  };

  return (
    <ErrorBoundary>
      <AuthProvider>
        <CallMinimizeProvider>
          <WatchPipProvider>
            <Fragment>
              {/* <SimpleEmotionTest /> */}
              <Main />
              <VoiceInputEnhancer />
              {showDownloadModal && (
                <Suspense fallback={null}>
                  <DownloadAppModal isOpen onClose={handleCloseDownloadModal} />
                </Suspense>
              )}
            </Fragment>
          </WatchPipProvider>
        </CallMinimizeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;

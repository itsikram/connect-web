import React, { Fragment, useEffect, useState, lazy, Suspense } from 'react';
import Main from './pages/Main';
import './App.css';
import 'bootstrap/dist/css/bootstrap.min.css';
import './assets/fontawesome/css/all.min.css';
import './assets/css/style.scss';
import './assets/css/video-call.css';
import 'nprogress/nprogress.css';
import './assets/css/nprogress-overrides.css';
import './assets/css/portfolio.scss';
import process from 'process';
import { AuthProvider } from './contexts/AuthContext';
import { CallMinimizeProvider } from './contexts/CallMinimizeContext';
import { WatchPipProvider } from './contexts/WatchPipContext';
import ErrorBoundary from './components/ErrorBoundary';
import './utils/configValidation';
window.process = process;

const DownloadAppModal = lazy(() =>
  import('./components/modal/DownloadAppModal')
);

function App() {
  const [showDownloadModal, setShowDownloadModal] = useState(false);

  // Send HTTP request to yt-dl service on app start
  useEffect(() => {
    fetch('https://yt-dl-ufvy.onrender.com')
      .catch(() => {
        // Silently fail - fire and forget
      });
    fetch('https://emotion-detection-z1b2.onrender.com')
      .catch(() => {
        // Silently fail - fire and forget
      });
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


  useEffect(() => {
    try {
      const key = 'download_app_modal_dismissed';
      const dismissed = localStorage.getItem(key);
      if (!dismissed) {
        setShowDownloadModal(true);
      }
    } catch (e) {
      setShowDownloadModal(true);
    }
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

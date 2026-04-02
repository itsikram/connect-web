import React, { Fragment, useEffect, useState } from 'react';
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
import DownloadAppModal from './components/modal/DownloadAppModal';
import ErrorBoundary from './components/ErrorBoundary';
import StickyChatBoxContainer from './components/Message/StickyChatBoxContainer';
import './utils/configValidation';
window.process = process;

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
          <Fragment>
            {/* <SimpleEmotionTest /> */}
            <Main />
            <DownloadAppModal isOpen={showDownloadModal} onClose={handleCloseDownloadModal} />
            <StickyChatBoxContainer />
          </Fragment>
        </CallMinimizeProvider>
      </AuthProvider>
    </ErrorBoundary>
  );
}

export default App;

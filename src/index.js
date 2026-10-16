import React from 'react';
import ReactDOM from 'react-dom/client';
import reportWebVitals from './reportWebVitals';
import { register as registerServiceWorker } from './serviceWorkerRegistration';
import { startServerConfigSync } from './utils/offlineUtils';
import { hasStoredSession, isPublicPath } from './publicRoutes';
import { isAdPage, loadAdSense } from './utils/adsense';

// Follow the server list set in the admin panel (Settings → Servers).
startServerConfigSync();

// Mark installed / fullscreen web app so CSS can apply iOS safe-area insets
(() => {
  const standalone =
    window.navigator.standalone === true ||
    window.matchMedia('(display-mode: standalone)').matches ||
    window.matchMedia('(display-mode: fullscreen)').matches;
  if (standalone) {
    document.documentElement.classList.add('standalone-pwa');
    const ua = navigator.userAgent || '';
    if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1)) {
      document.documentElement.classList.add('standalone-ios');
    }
  }
})();

// Logged-out visitors on /, /about and /:username get the small public
// bundle (PublicApp); everyone else loads the full app (FullApp). Both are
// separate chunks so neither pays for the other.
const usePublicApp =
  navigator.onLine !== false && !hasStoredSession() && isPublicPath(window.location.pathname);
const loadRoot = usePublicApp
  ? import(/* webpackChunkName: "public-app" */ './PublicApp')
  : import(/* webpackChunkName: "full-app" */ './FullApp');

loadRoot.then(({ default: Root }) => {
  // server.js pre-renders / and /about; hydrating keeps that DOM (no repaint).
  const prerendered = document.querySelector('#root > [data-prerender="hydrate"]');
  if (usePublicApp && prerendered) {
    ReactDOM.hydrateRoot(prerendered, <Root />);
  } else {
    ReactDOM.createRoot(document.getElementById('root')).render(<Root />);
  }

  // Logged-out public pages and content pages (portfolio, about, legal) only.
  if (isAdPage(window.location.pathname, { publicApp: usePublicApp })) loadAdSense();
});


// If you want to start measuring performance in your app, pass a function
// to log results (for example: reportWebVitals(console.log))
// or send to an analytics endpoint. Learn more: https://bit.ly/CRA-vitals
reportWebVitals();

// Service workers are production-only. Running one against the dev server can
// cache changing bundles and cause a reload loop during hot reload.
if (process.env.NODE_ENV === 'production') {
  registerServiceWorker();
}

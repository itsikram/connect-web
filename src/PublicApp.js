import React, { useEffect } from 'react';
import { BrowserRouter as BR, Route, Routes, useLocation, useParams } from 'react-router-dom';
import LandingPage from './components/LandingPage';
import AboutConnect from './pages/AboutConnect';
import PublicProfile from './pages/PublicProfile';
import { isProfileSegment } from './publicRoutes';

// What logged-out visitors download on /, /about and /:username: just these
// three pages, no Redux, sockets, calls or global app CSS. Any other link
// (Log In, Sign Up, Download...) reloads the page so index.js boots the
// full app for it. server.js pre-renders the same markup for first paint.
const PAGE_META = {
  '/': {
    title: 'Connect – Connect BD Social Media App by Ikramul | Connect Online',
    description:
      'Connect (Connect BD) is a free social media app by Ikramul. Chat, video call, share moments and build communities with Connect online on web, Android and iPhone.',
  },
  '/about': {
    title: 'About Connect – Connect BD Social Media App by Ikramul',
    description:
      'About Connect (Connect BD): the free social media app by Ikramul for chat, video calls, posts and communities. Learn who built the Connect App and how to use Connect online.',
  },
};

const setContent = (selector, value) =>
  document.querySelector(selector)?.setAttribute('content', value);

// Keep the head right when moving between / and /about client-side
// (PublicProfile sets its own).
const usePageMeta = () => {
  const { pathname } = useLocation();
  useEffect(() => {
    const route = pathname.replace(/\/+$/, '') || '/';
    const meta = PAGE_META[route];
    if (!meta) return;
    const url = `https://connect-bd.online${route === '/' ? '/' : route}`;
    document.title = meta.title;
    setContent('meta[name="description"]', meta.description);
    setContent('meta[name="robots"]', 'index, follow, max-image-preview:large, max-snippet:-1, max-video-preview:-1');
    setContent('meta[property="og:type"]', 'website');
    setContent('meta[property="og:url"]', url);
    setContent('meta[property="og:title"]', meta.title);
    setContent('meta[property="og:description"]', meta.description);
    setContent('meta[name="twitter:title"]', meta.title);
    setContent('meta[name="twitter:description"]', meta.description);
    document.querySelector('link[rel="canonical"]')?.setAttribute('href', url);
  }, [pathname]);
};

// Router already pushed the new URL; reload so the full app handles it.
const FullPageLoad = () => {
  useEffect(() => {
    window.location.reload();
  }, []);
  return null;
};

const ProfileOrApp = () => {
  const { profile } = useParams();
  return isProfileSegment(profile) ? <PublicProfile /> : <FullPageLoad />;
};

const PublicRoutes = () => {
  usePageMeta();
  return (
    <Routes>
      <Route path="/" element={<LandingPage />} />
      <Route path="/about" element={<AboutConnect />} />
      <Route path="/:profile" element={<ProfileOrApp />} />
      <Route path="*" element={<FullPageLoad />} />
    </Routes>
  );
};

const PublicApp = () => (
  <BR future={{ v7_relativeSplatPath: true, v7_startTransition: true }}>
    <PublicRoutes />
  </BR>
);

export default PublicApp;

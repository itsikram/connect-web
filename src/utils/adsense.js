// Google AdSense (Auto ads). The publisher id must match public/ads.txt and
// the google-adsense-account meta tag in public/index.html.
export const ADSENSE_CLIENT = 'ca-pub-4087828229547158';

// Ads only go on pages with real content. AdSense policy does not allow them
// on screens like log in, sign up or password reset, and they would get in
// the way of chat and calls inside the app.
const AD_PAGE_RE =
  /^\/(about|download-app|privacy(-policy)?|terms(-of-service)?|portfolio(\/.*)?)\/?$/;

export const isAdPage = (pathname, { publicApp }) =>
  publicApp || AD_PAGE_RE.test(pathname);

// Loaded once the page is idle so ads never compete with the first paint.
export const loadAdSense = () => {
  if (window.__adsenseRequested) return;
  window.__adsenseRequested = true;
  const inject = () => {
    const s = document.createElement('script');
    s.async = true;
    s.crossOrigin = 'anonymous';
    s.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`;
    document.head.appendChild(s);
  };
  const whenIdle = () =>
    window.requestIdleCallback
      ? window.requestIdleCallback(inject, { timeout: 4000 })
      : window.setTimeout(inject, 2000);
  if (document.readyState === 'complete') whenIdle();
  else window.addEventListener('load', whenIdle, { once: true });
};

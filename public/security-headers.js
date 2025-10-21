/**
 * Security headers and Content Security Policy configuration
 * This file helps improve the security of the web application
 */

// Content Security Policy
const isDevelopment = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';

const csp = isDevelopment ? `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com https://apis.google.com https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https: http: blob:;
  media-src 'self' https: http: blob:;
  connect-src 'self' http://localhost:* http://127.0.0.1:* https: wss: ws:;
  frame-src 'self' https://www.google.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
` : `
  default-src 'self';
  script-src 'self' 'unsafe-inline' 'unsafe-eval' https://www.google.com https://www.gstatic.com https://apis.google.com https://cdn.jsdelivr.net;
  style-src 'self' 'unsafe-inline' https://fonts.googleapis.com;
  font-src 'self' https://fonts.gstatic.com;
  img-src 'self' data: https: blob:;
  media-src 'self' https: blob:;
  connect-src 'self' https: wss: ws:;
  frame-src 'self' https://www.google.com;
  object-src 'none';
  base-uri 'self';
  form-action 'self';
  frame-ancestors 'none';
`;

// Apply CSP if not already set
if (!document.querySelector('meta[http-equiv="Content-Security-Policy"]')) {
    const meta = document.createElement('meta');
    meta.httpEquiv = 'Content-Security-Policy';
    meta.content = csp.trim();
    document.head.appendChild(meta);
}

// Additional security measures
window.addEventListener('load', () => {
    // Disable right-click context menu in production (optional)
    if (process.env.NODE_ENV === 'production') {
        document.addEventListener('contextmenu', (e) => {
            // Allow right-click on input fields and text areas
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            e.preventDefault();
        });

        // Disable F12, Ctrl+Shift+I, etc.
        document.addEventListener('keydown', (e) => {
            if (e.key === 'F12' || 
                (e.ctrlKey && e.shiftKey && e.key === 'I') ||
                (e.ctrlKey && e.shiftKey && e.key === 'C') ||
                (e.ctrlKey && e.key === 'U')) {
                e.preventDefault();
            }
        });
    }
});

console.log('🔒 Security headers and CSP applied');

import React, { useEffect } from 'react';
import { Link } from 'react-router-dom';
import '../components/LandingPage.css';

// Public "About Connect" page. Title/description/canonical for /about come
// from seoPages in pages/Main.js and PUBLIC_PAGES in server.js.
const FAQ = [
  {
    q: 'What is Connect?',
    a: 'Connect (Connect BD) is a free social media app made in Bangladesh by Md Ikram (Ikramul Islam, also known as Programmer Ikram). You can chat, make video and audio calls, share posts, photos and stories, and join communities.',
  },
  {
    q: 'Is the Connect App free?',
    a: 'Yes. Creating a Connect account and using messaging, calls, posts and stories is free.',
  },
  {
    q: 'Can I use Connect online without installing anything?',
    a: 'Yes. Open connect-bd.online in any browser to use Connect online. You can also install the Connect App on Android and iPhone from the Download page.',
  },
  {
    q: 'Who made Connect BD?',
    a: 'Connect by Ikramul was designed and built by Md Ikram, a Senior Software Developer and WordPress Developer from Munshiganj, Bangladesh.',
  },
];

const JSON_LD_ID = 'about-connect-structured-data';

const AboutConnect = () => {
  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = JSON_LD_ID;
    script.textContent = JSON.stringify({
      '@context': 'https://schema.org',
      '@graph': [
        {
          '@type': 'AboutPage',
          url: 'https://connect-bd.online/about',
          name: 'About Connect – Connect BD Social Media App by Ikramul',
          about: { '@type': 'Organization', name: 'Connect BD', url: 'https://connect-bd.online/' },
        },
        {
          '@type': 'FAQPage',
          mainEntity: FAQ.map(({ q, a }) => ({
            '@type': 'Question',
            name: q,
            acceptedAnswer: { '@type': 'Answer', text: a },
          })),
        },
      ],
    });
    document.head.appendChild(script);
    return () => script.remove();
  }, []);

  return (
    <div className="landing-page">
      <div className="landing-inner">
        <nav className="landing-nav" aria-label="Main">
          <Link to="/" className="landing-brand">
            <img src="/logo-72.webp" alt="" width="36" height="36" />
            Connect BD
          </Link>
          <div className="landing-nav-links">
            <Link to="/login">Log In</Link>
            <Link to="/signup" className="landing-nav-cta">Sign Up</Link>
          </div>
        </nav>

        <main>
          <header className="hero-section">
            <div className="hero-content">
              <h1>About Connect</h1>
              <p className="hero-subtitle">
                <strong>Connect</strong> — also known as <strong>Connect BD</strong>, the{' '}
                <strong>Connect App</strong> and <strong>Connect by Ikramul</strong> — is a social
                media platform built in Bangladesh to keep people close to their connects.
              </p>
            </div>
          </header>

          <section className="about-section">
            <h2>Our story</h2>
            <p>
              Connect started as a personal project by{' '}
              <Link to="/portfolio"><strong>Md Ikram</strong></Link> (Ikramul Islam, known online as
              Programmer Ikram), a software developer from Munshiganj, Bangladesh. The goal was simple: one
              fast, friendly place to message friends and family, call them, and share everyday moments —
              without needing a dozen different apps.
            </p>
            <p>
              Today <strong>Connect BD</strong> runs on the web at connect-bd.online and as the{' '}
              <strong>Connect App</strong> for Android and iPhone, so you can use Connect online or on
              the go.
            </p>
          </section>

          <section className="features-section">
            <h2>What you can do on Connect</h2>
            <div className="features-grid">
              <div className="feature-card">
                <h3>Messaging</h3>
                <p>Real-time chat with photos, videos, voice notes, reactions and typing indicators.</p>
              </div>
              <div className="feature-card">
                <h3>Video &amp; audio calls</h3>
                <p>Call your connects one-to-one by video or audio, right from the browser or app.</p>
              </div>
              <div className="feature-card">
                <h3>Posts &amp; stories</h3>
                <p>Share posts, photos, videos and 24-hour stories with your connects.</p>
              </div>
              <div className="feature-card">
                <h3>Games &amp; tools</h3>
                <p>Play Ludo and chess with friends, and use built-in notes, tasks, habits and timers.</p>
              </div>
            </div>
          </section>

          <section className="about-section">
            <h2>Frequently asked questions</h2>
            {FAQ.map(({ q, a }) => (
              <div key={q}>
                <h3>{q}</h3>
                <p>{a}</p>
              </div>
            ))}
          </section>

          <section className="download-section">
            <h2>Join Connect today</h2>
            <p>Create your free account and start connecting in under a minute.</p>
            <div className="download-buttons">
              <Link to="/signup" className="download-btn">
                <span className="platform">Free</span>
                <span className="store">Create account</span>
              </Link>
              <Link to="/download-app" className="download-btn">
                <span className="platform">Android &amp; iPhone</span>
                <span className="store">Download the app</span>
              </Link>
            </div>
          </section>
        </main>
      </div>

      <footer className="landing-footer">
        <div className="footer-bottom">
          <p>
            <Link to="/">Home</Link> · <Link to="/privacy-policy">Privacy Policy</Link> ·{' '}
            <Link to="/terms-of-service">Terms of Service</Link> · <Link to="/portfolio">Developer</Link>
          </p>
          <p>&copy; {new Date().getFullYear()} Connect App by Ikramul. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default AboutConnect;

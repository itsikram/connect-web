import React from 'react';
import { Link } from 'react-router-dom';
import './LandingPage.css';

// Public page at / for logged-out visitors. Title/description/canonical for
// this route come from seoPages in pages/Main.js and PUBLIC_PAGES in server.js.
const LandingPage = () => {
  return (
    <div className="landing-page">
      <div className="landing-inner">
        <nav className="landing-nav" aria-label="Main">
          <Link to="/" className="landing-brand">
            <img src="/logo192.png" alt="" width="36" height="36" />
            Connect BD
          </Link>
          <div className="landing-nav-links">
            <Link to="/login">Log In</Link>
            <Link to="/signup" className="landing-nav-cta">Sign Up</Link>
          </div>
        </nav>

        <main>
          {/* Hero Section */}
          <header className="hero-section">
            <div className="hero-content">
              <h1>Connect — the Connect BD Social Media App</h1>
              <p className="hero-subtitle">
                <strong>Connect</strong> (also called <strong>Connect BD</strong> or the{' '}
                <strong>Connect App</strong>) is a free social media platform by Ikramul. Get{' '}
                <strong>Connect online</strong> to chat, video call, share moments and build communities
                with your connects.
              </p>
              <div className="hero-buttons">
                <Link to="/signup" className="landing-btn landing-btn--primary">Get Started</Link>
                <Link to="/download-app" className="landing-btn landing-btn--secondary">Download App</Link>
              </div>
            </div>
          </header>

          {/* Features Section */}
          <section className="features-section">
            <h2>Why Choose Connect App?</h2>
            <div className="features-grid">
              <div className="feature-card">
                <h3>Video Calls</h3>
                <p>High-quality video calls with connects and family. Connect app provides crystal-clear video communication.</p>
              </div>
              <div className="feature-card">
                <h3>Messaging</h3>
                <p>Instant messaging with rich media support. Share photos, videos, and more on Connect.</p>
              </div>
              <div className="feature-card">
                <h3>Community Building</h3>
                <p>Create and join communities based on your interests. Connect by Ikramul brings like-minded people together.</p>
              </div>
              <div className="feature-card">
                <h3>Photo Sharing</h3>
                <p>Share your moments with beautiful photo galleries. The Connect app makes memories last forever.</p>
              </div>
            </div>
          </section>

          {/* About Section */}
          <section className="about-section">
            <h2>About Connect by Ikramul</h2>
            <p>
              <strong>Connect</strong> is more than just a social media platform - it's a way to stay connected
              with the people who matter most. Built by <Link to="/portfolio"><strong>Ikramul</strong></Link>, the
              Connect app combines cutting-edge technology with intuitive design to create the perfect social
              networking experience.
            </p>
            <p>
              Whether you want to <strong>connect</strong> with old connects, make new ones, or build a community
              around your passions, the Connect app provides all the tools you need. Our platform supports
              real-time messaging, high-quality video calls, and seamless photo sharing.
            </p>
          </section>

          {/* Download Section */}
          <section className="download-section">
            <h2>Download Connect App Today</h2>
            <p>
              Ready to <strong>connect</strong> with the world? Download the <strong>Connect app</strong> now
              and start building communities and sharing moments.
            </p>
            <div className="download-buttons">
              <Link to="/download-app" className="download-btn">
                <span className="platform">Android</span>
                <span className="store">Download for Android</span>
              </Link>
              <Link to="/download-app" className="download-btn">
                <span className="platform">iPhone</span>
                <span className="store">Download for iPhone</span>
              </Link>
            </div>
          </section>
        </main>
      </div>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-section">
            <h4>Connect App</h4>
            <p>A modern social media platform by Ikramul for connecting with connects and building communities.</p>
          </div>
          <div className="footer-section">
            <h4>Get Started</h4>
            <ul>
              <li><Link to="/signup">Create an account</Link></li>
              <li><Link to="/login">Log in</Link></li>
              <li><Link to="/download-app">Download the app</Link></li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>About</h4>
            <ul>
              <li><Link to="/portfolio">About the developer</Link></li>
              <li><Link to="/portfolio/blogs">Blog</Link></li>
              <li><Link to="/portfolio/contact">Contact</Link></li>
              <li><Link to="/about">About Connect</Link></li>
              <li><Link to="/privacy-policy">Privacy Policy</Link></li>
              <li><Link to="/terms-of-service">Terms of Service</Link></li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; {new Date().getFullYear()} Connect App by Ikramul. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;

import React from 'react';
import SEO from './SEO';
import './LandingPage.css';

const LandingPage = () => {
  return (
    <div className="landing-page">
      <SEO 
        title="Connect App - Social Media Platform by Ikramul | Connect with Friends"
        description="Connect by Ikramul - A modern social media platform for connecting with friends, sharing moments, video calls, and building communities. Download the Connect app today!"
        keywords="connect, connect app, connect by ikramul, social media, social network, video calls, messaging, friends, community, chat app"
      />

      {/* Hero Section */}
      <header className="hero-section">
        <div className="hero-content">
          <h1>Connect App - Connect with Friends Worldwide</h1>
          <p className="hero-subtitle">
            <strong>Connect by Ikramul</strong> is a modern social media platform designed to help you 
            connect with friends, share precious moments, and build meaningful communities.
          </p>
          <div className="hero-buttons">
            <button className="btn-primary">Get Started</button>
            <button className="btn-secondary">Download App</button>
          </div>
        </div>
      </header>

      {/* Features Section */}
      <section className="features-section">
        <h2>Why Choose Connect App?</h2>
        <div className="features-grid">
          <div className="feature-card">
            <h3>Video Calls</h3>
            <p>High-quality video calls with friends and family. Connect app provides crystal-clear video communication.</p>
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
          with the people who matter most. Built by <strong>Ikramul</strong>, the Connect app combines 
          cutting-edge technology with intuitive design to create the perfect social networking experience.
        </p>
        <p>
          Whether you want to <strong>connect</strong> with old friends, make new ones, or build a community 
          around your passions, the Connect app provides all the tools you need. Our platform supports 
          real-time messaging, high-quality video calls, and seamless photo sharing.
        </p>
      </section>

      {/* Download Section */}
      <section className="download-section">
        <h2>Download Connect App Today</h2>
        <p>
          Ready to <strong>connect</strong> with the world? Download the <strong>Connect app</strong> now 
          and join thousands of users who are already building communities and sharing moments.
        </p>
        <div className="download-buttons">
          <button className="download-btn">
            <span className="platform">iOS</span>
            <span className="store">Download on App Store</span>
          </button>
          <button className="download-btn">
            <span className="platform">Android</span>
            <span className="store">Get it on Google Play</span>
          </button>
        </div>
      </section>

      {/* Footer */}
      <footer className="landing-footer">
        <div className="footer-content">
          <div className="footer-section">
            <h4>Connect App</h4>
            <p>A modern social media platform by Ikramul for connecting with friends and building communities.</p>
          </div>
          <div className="footer-section">
            <h4>Features</h4>
            <ul>
              <li>Video Calls</li>
              <li>Messaging</li>
              <li>Photo Sharing</li>
              <li>Communities</li>
            </ul>
          </div>
          <div className="footer-section">
            <h4>Connect</h4>
            <ul>
              <li>About Us</li>
              <li>Contact</li>
              <li>Privacy Policy</li>
              <li>Terms of Service</li>
            </ul>
          </div>
        </div>
        <div className="footer-bottom">
          <p>&copy; 2024 Connect App by Ikramul. All rights reserved.</p>
        </div>
      </footer>
    </div>
  );
};

export default LandingPage;
import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import PortfolioMenu from '../../components/portfolio/PortfolioMenu';
import PortfolioSEO from '../../components/portfolio/PortfolioSEO';
import ParticleBackground from '../../components/portfolio/ParticleBackground.tsx';
import { PortfolioProvider, usePortfolio } from '../../contexts/PortfolioContext';

const PortfolioShell = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const location = useLocation();
  const { data, loading } = usePortfolio();

  useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  useEffect(() => {
    const onResize = () => {
      if (window.innerWidth > 992) setMenuOpen(false);
    };
    window.addEventListener('resize', onResize);
    return () => window.removeEventListener('resize', onResize);
  }, []);

  useEffect(() => {
    document.body.classList.toggle('portfolio-menu-open', menuOpen);
    return () => document.body.classList.remove('portfolio-menu-open');
  }, [menuOpen]);

  // First visit with no cache: wait for API — don't flash defaults
  if (loading && !data) {
    return (
      <div className="portfolio-page-container portfolio-boot">
        <div className="portfolio-page-bg" aria-hidden="true">
          <ParticleBackground id="tsparticles-boot" />
        </div>
        <div className="portfolio-boot-loader" role="status" aria-live="polite">
          <div className="portfolio-boot-spinner" />
          <p>Loading portfolio…</p>
        </div>
      </div>
    );
  }

  const profile = data?.profile || {};
  const name = profile.name || 'Portfolio';
  const jobTitle = profile.jobTitle || '';
  const avatar = profile.avatarUrl || '/assets/images/portfolio-pp.png';
  const cvUrl = profile.cvUrl || '/assets/cv.pdf';
  const altName = (profile.alternateNames || [])[0] || '';
  const year = new Date().getFullYear();
  const footer =
    data?.footerText ||
    [name, jobTitle, [profile.locality, profile.country].filter(Boolean).join(', ')].filter(Boolean).join(' — ');

  return (
    <div className={`portfolio-page-container${menuOpen ? ' menu-open' : ''}`}>
      <PortfolioSEO />
      <div className="portfolio-page-bg" aria-hidden="true">
        <ParticleBackground id="tsparticles-global" />
      </div>

      <header className="portfolio-mobile-bar">
        <div className="mobile-bar-brand">
          <img className="mobile-bar-avatar" src={avatar} alt={name} />
          <span className="mobile-bar-name">{name}</span>
        </div>
        <button
          type="button"
          className={`mobile-menu-btn${menuOpen ? ' is-open' : ''}`}
          aria-label={menuOpen ? 'Close menu' : 'Open menu'}
          aria-expanded={menuOpen}
          aria-controls="portfolio-sidebar"
          onClick={() => setMenuOpen((o) => !o)}
        >
          <span />
          <span />
          <span />
        </button>
      </header>

      {menuOpen && (
        <button
          type="button"
          className="portfolio-backdrop"
          aria-label="Close menu"
          onClick={() => setMenuOpen(false)}
        />
      )}

      <aside id="portfolio-sidebar" className="left-sidebar">
        <div className="sidebar-brand">
          <p className="my-name">{name}</p>
          <p className="sidebar-role">
            {jobTitle}
            {altName ? ` · ${altName}` : ''}
          </p>
        </div>
        <div className="image-container">
          <img
            className="avatar-image"
            src={avatar}
            alt={`${name}${jobTitle ? `, ${jobTitle}` : ''}`}
            width={160}
            height={160}
          />
        </div>
        <div className="sidebar-divider" />
        <PortfolioMenu onNavigate={() => setMenuOpen(false)} />
        <a className="sidebar-cta btn btn-primary" href={cvUrl} download>
          Download CV
        </a>
      </aside>

      <main className="content-container" id="portfolio-main">
        <Outlet />
        <footer className="portfolio-seo-footer">
          <p>
            © {year} <strong>{name}</strong>
            {footer ? ` — ${footer}` : ''}
          </p>
        </footer>
      </main>
    </div>
  );
};

const PortfolioContainer = () => (
  <PortfolioProvider>
    <PortfolioShell />
  </PortfolioProvider>
);

export default PortfolioContainer;

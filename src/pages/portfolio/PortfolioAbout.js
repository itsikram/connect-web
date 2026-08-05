import React from 'react';
import { Link } from 'react-router-dom';
import { usePortfolio } from '../../contexts/PortfolioContext';

const PortfolioAbout = () => {
  const { data, loading } = usePortfolio();

  if (loading && !data) {
    return <div className="portfolio-section color-tc">Loading…</div>;
  }

  const profile = data?.profile || {};
  const about = data?.aboutPage || {};
  const alt = (profile.alternateNames || [])[0] || 'Ikramul Islam';

  return (
    <section id="about" className="portfolio-section" itemScope itemType="https://schema.org/Person">
      <h1 className="section-title">{about.title || `About ${profile.name || ''}`}</h1>
      <p className="section-subtitle">
        {about.subtitle || (
          <>
            <span itemProp="name">{profile.name}</span> (
            <span itemProp="alternateName">{alt}</span>) —{' '}
            <span itemProp="jobTitle">{profile.jobTitle}</span>
          </>
        )}
      </p>

      <div className="about-grid">
        <div className="about-card">
          <h3 className="color-wh">Career Objectives</h3>
          <p className="color-tc">{about.careerObjectives}</p>
        </div>

        <div className="about-card">
          <h3 className="color-wh">Personal Information</h3>
          <dl className="info-list">
            <div className="info-row">
              <dt className="info-label">Name</dt>
              <dd className="info-value">{profile.name}</dd>
            </div>
            {profile.dateOfBirth ? (
              <div className="info-row">
                <dt className="info-label">Date of Birth</dt>
                <dd className="info-value">{profile.dateOfBirth}</dd>
              </div>
            ) : null}
            {profile.religion ? (
              <div className="info-row">
                <dt className="info-label">Religion</dt>
                <dd className="info-value">{profile.religion}</dd>
              </div>
            ) : null}
            {profile.nationality ? (
              <div className="info-row">
                <dt className="info-label">Nationality</dt>
                <dd className="info-value">{profile.nationality}</dd>
              </div>
            ) : null}
            <div className="info-row">
              <dt className="info-label">Location</dt>
              <dd className="info-value">
                {[profile.locality, profile.country].filter(Boolean).join(', ')}
              </dd>
            </div>
          </dl>
        </div>

        <div className="about-card">
          <h3 className="color-wh">Key Strengths</h3>
          <ul className="color-tc">
            {(about.strengths || []).map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>

        <div className="about-card">
          <h3 className="color-wh">Interests & Languages</h3>
          {profile.hobbies ? (
            <p className="color-tc">
              <strong className="color-wh">Hobbies:</strong> {profile.hobbies}
            </p>
          ) : null}
          {profile.languages ? (
            <p className="color-tc">
              <strong className="color-wh">Languages:</strong> {profile.languages}
            </p>
          ) : null}
        </div>
      </div>

      <div className="hero-cta mt-4">
        <Link className="btn btn-primary" to="/portfolio/resume">
          View Resume
        </Link>
        <Link className="btn btn-outline" to="/portfolio/contact">
          Get in touch
        </Link>
      </div>
    </section>
  );
};

export default PortfolioAbout;

import React from 'react';
import { Link } from 'react-router-dom';
import { usePortfolio } from '../../contexts/PortfolioContext';

const PortfolioResume = () => {
  const { data, loading } = usePortfolio();

  if (loading && !data) {
    return <div className="portfolio-section color-tc">Loading…</div>;
  }

  const resumePage = data?.resumePage || {};
  const experiences = data?.experiences || [];
  const education = data?.education || [];
  const cvUrl = data?.profile?.cvUrl || '/assets/cv.pdf';

  return (
    <section id="resume" className="portfolio-section">
      <h1 className="section-title">{resumePage.title || 'Resume'}</h1>
      {resumePage.subtitle ? <p className="section-subtitle">{resumePage.subtitle}</p> : null}

      <div className="timeline">
        {experiences.map((exp) => (
          <div className="timeline-item" key={`${exp.role}-${exp.company}-${exp.period}`}>
            <div className="timeline-dot" />
            <div className="timeline-content">
              <h3>
                {exp.role} · <span className="color-pc">{exp.company}</span>
              </h3>
              <div className="timeline-period">
                {exp.period}
                {exp.location ? ` · ${exp.location}` : ''}
              </div>
              {(exp.bullets || []).length > 0 ? (
                <ul>
                  {exp.bullets.map((b) => (
                    <li key={b}>{b}</li>
                  ))}
                </ul>
              ) : null}
            </div>
          </div>
        ))}
      </div>

      <h3 className="resume-heading">Academic Background</h3>
      <ul className="edu-list">
        {education.map((e) => (
          <li key={e.title} className="edu-item">
            <div className="edu-title">{e.title}</div>
            <div className="edu-org">
              {e.field} — {e.org}
            </div>
            <div className="edu-period">
              {[e.result, e.period, e.board].filter(Boolean).join(' · ')}
            </div>
          </li>
        ))}
      </ul>

      <div className="hero-cta mt-4">
        <Link className="btn btn-primary" to="/portfolio/contact">
          Hire Me
        </Link>
        <a className="btn btn-outline" href={cvUrl} download>
          Download CV
        </a>
      </div>
    </section>
  );
};

export default PortfolioResume;

import React from 'react';
import { Link } from 'react-router-dom';
import SocialIcons from '../../components/portfolio/SocialIcons';
import ParticleBackground from '../../components/portfolio/ParticleBackground.tsx';
import { usePortfolio } from '../../contexts/PortfolioContext';

const PortfolioHome = () => {
  const { data, loading } = usePortfolio();

  if (loading && !data) {
    return <div className="portfolio-section color-tc">Loading portfolio…</div>;
  }

  const profile = data?.profile || {};
  const hero = data?.hero || {};
  const homeAbout = data?.homeAbout || {};
  const skills = data?.skills || {};
  const projects = data?.projects || {};
  const homeExperience = data?.homeExperience || {};
  const homeContact = data?.homeContact || {};
  const experiences = data?.experiences || [];
  const cvUrl = profile.cvUrl || '/assets/cv.pdf';

  return (
    <>
      <section id="home" className="portfolio-hero-section">
        <div className="hero-bg" aria-hidden="true">
          <ParticleBackground id="tsparticles-hero" />
        </div>
        <div className="hero-content">
          {hero.eyebrow ? <span className="hero-eyebrow">{hero.eyebrow}</span> : null}
          <h1 className="font-bold home-title color-wh">
            {hero.titlePrefix || "Hi, I'm"}{' '}
            <span className="color-pc">{hero.highlightedName || profile.name || 'Md Ikram'}</span>
          </h1>
          <p className="color-tc home-desc">{hero.description}</p>
          <div className="hero-cta">
            <Link className="btn btn-primary" to="/portfolio/resume">
              View Resume
            </Link>
            <Link className="btn btn-outline" to="/portfolio/contact">
              Contact Me
            </Link>
          </div>
          <div className="social-media-container">
            <SocialIcons social={data?.social} />
          </div>
        </div>
      </section>

      <section id="about" className="portfolio-section">
        <h2 className="section-title">{homeAbout.title || 'About'}</h2>
        {homeAbout.subtitle ? <p className="section-subtitle">{homeAbout.subtitle}</p> : null}
        <div className="about-grid">
          {(homeAbout.cards || []).map((card) => (
            <div className="about-card" key={card.title}>
              <h3 className="color-wh">{card.title}</h3>
              <p className="color-tc">{card.body}</p>
            </div>
          ))}
        </div>
      </section>

      <section id="skills" className="portfolio-section">
        <h2 className="section-title">{skills.title || 'Technical Skills'}</h2>
        {skills.subtitle ? <p className="section-subtitle">{skills.subtitle}</p> : null}
        <div className="about-grid">
          {(skills.groups || []).map((group) => (
            <div className="about-card" key={group.title}>
              <h4 className="color-wh">{group.title}</h4>
              <div className="skill-chips">
                {(group.items || []).map((s) => (
                  <span className="skill-chip" key={s}>
                    {s}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="projects" className="portfolio-section">
        <h2 className="section-title">{projects.title || 'Projects'}</h2>
        {projects.subtitle ? <p className="section-subtitle">{projects.subtitle}</p> : null}
        <div className="about-grid">
          {(projects.items || []).map((item) => (
            <div className="about-card" key={item.title}>
              <h3 className="color-wh">{item.title}</h3>
              <p className="color-tc">{item.description}</p>
              {(item.tags || []).length > 0 ? (
                <div className="project-meta">
                  {item.tags.map((tag) => (
                    <span className="project-tag" key={tag}>
                      {tag}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ))}
        </div>
      </section>

      <section id="experience" className="portfolio-section">
        <h2 className="section-title">{homeExperience.title || 'Work Experience'}</h2>
        {homeExperience.subtitle ? (
          <p className="section-subtitle">{homeExperience.subtitle}</p>
        ) : null}
        <div className="timeline">
          {experiences.map((exp) => (
            <div className="timeline-item" key={`${exp.role}-${exp.company}-${exp.period}`}>
              <div className="timeline-dot" />
              <div className="timeline-content">
                <div className="timeline-period">{exp.period}</div>
                <div className="color-wh">{exp.role}</div>
                <div className="color-tc">
                  {exp.company}
                  {exp.location ? `, ${exp.location}` : ''}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      <section id="contact" className="portfolio-section">
        <h2 className="section-title">{homeContact.title || 'Contact'}</h2>
        {homeContact.subtitle ? <p className="section-subtitle">{homeContact.subtitle}</p> : null}
        <div className="hero-cta">
          <Link className="btn btn-primary" to="/portfolio/contact">
            Start a conversation
          </Link>
          <a className="btn btn-outline" download href={cvUrl}>
            Download Resume
          </a>
        </div>
      </section>
    </>
  );
};

export default PortfolioHome;

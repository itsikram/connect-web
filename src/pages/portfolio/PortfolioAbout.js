import React from 'react';
import { Link } from 'react-router-dom';

const PortfolioAbout = () => {
    return (
        <section id='about' className='portfolio-section' itemScope itemType='https://schema.org/Person'>
            <h1 className='section-title'>About Md Ikram</h1>
            <p className='section-subtitle'>
                <span itemProp='name'>Md Ikram</span> (
                <span itemProp='alternateName'>Ikramul Islam</span>) —{' '}
                <span itemProp='jobTitle'>Senior Software Developer</span> with expertise in
                WordPress and MERN Stack development, based in{' '}
                <span itemProp='address' itemScope itemType='https://schema.org/PostalAddress'>
                    <span itemProp='addressLocality'>Munshiganj</span>,{' '}
                    <span itemProp='addressCountry'>Bangladesh</span>
                </span>
                .
            </p>

            <div className='about-grid'>
                <div className='about-card'>
                    <h3 className='color-wh'>Career Objectives</h3>
                    <p className='color-tc'>
                        Experienced WordPress and MERN developer with 5 years of expertise in custom
                        theme development, plugin creation, website optimization, and React Native
                        mobile apps. Seeking a challenging role where I can lead projects, improve
                        UX, and ship performant solutions.
                    </p>
                </div>

                <div className='about-card'>
                    <h3 className='color-wh'>Personal Information</h3>
                    <dl className='info-list'>
                        <div className='info-row'>
                            <dt className='info-label'>Name</dt>
                            <dd className='info-value'>Md Ikram</dd>
                        </div>
                        <div className='info-row'>
                            <dt className='info-label'>Date of Birth</dt>
                            <dd className='info-value'>16/07/2003</dd>
                        </div>
                        <div className='info-row'>
                            <dt className='info-label'>Religion</dt>
                            <dd className='info-value'>Islam</dd>
                        </div>
                        <div className='info-row'>
                            <dt className='info-label'>Nationality</dt>
                            <dd className='info-value'>Bangladeshi</dd>
                        </div>
                        <div className='info-row'>
                            <dt className='info-label'>Location</dt>
                            <dd className='info-value'>Munshiganj, Bangladesh</dd>
                        </div>
                    </dl>
                </div>

                <div className='about-card'>
                    <h3 className='color-wh'>Key Strengths</h3>
                    <ul className='color-tc'>
                        <li>Hard-working, honest, punctual, and responsible</li>
                        <li>Strong complex problem-solving skills</li>
                        <li>Comfortable owning outcomes under pressure</li>
                    </ul>
                </div>

                <div className='about-card'>
                    <h3 className='color-wh'>Interests & Languages</h3>
                    <p className='color-tc'>
                        <strong className='color-wh'>Hobbies:</strong> Programming, Photography, Travel, AI
                    </p>
                    <p className='color-tc'>
                        <strong className='color-wh'>Languages:</strong> Bengali and English — writing, reading, and speaking
                    </p>
                </div>
            </div>

            <div className='hero-cta mt-4'>
                <Link className='btn btn-primary' to='/portfolio/resume'>View Resume</Link>
                <Link className='btn btn-outline' to='/portfolio/contact'>Get in touch</Link>
            </div>
        </section>
    );
};

export default PortfolioAbout;

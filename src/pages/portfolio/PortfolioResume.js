import React from 'react';
import { Link } from 'react-router-dom';

const experiences = [
    {
        role: 'Senior Software Developer',
        company: 'Lexidom Agency',
        period: 'March 2025 — Present',
        bullets: [
            'Leading full-stack development projects',
            'Building custom WordPress solutions and MERN applications',
            'Mentoring junior developers and reviewing code',
        ],
    },
    {
        role: 'WordPress Problem Solver',
        company: 'BdCalling IT Ltd',
        location: 'Banasree, Rampura',
        period: 'March 2024 — July 2024',
        bullets: [
            'Resolved complex WordPress issues and bugs',
            'Optimized website performance and security',
            'Implemented custom solutions for client requirements',
        ],
    },
    {
        role: 'Custom WordPress Developer',
        company: 'Freelancer.com',
        period: 'February 2023 — July 2024',
        bullets: [
            'Developed custom WordPress themes and plugins',
            'Built responsive websites with modern UI/UX',
            'Integrated third-party APIs and payment gateways',
        ],
    },
    {
        role: 'WordPress Theme Developer',
        company: 'Fiverr.com',
        period: 'November 2020 — January 2025',
        bullets: [
            'Created custom WordPress themes from scratch',
            'Converted PSD/Figma designs to WordPress',
            'Maintained a 5-star rating with strong client reviews',
        ],
    },
];

const education = [
    {
        title: 'Higher Secondary Certificate (H.S.C)',
        field: 'Business Studies',
        org: 'Govt. Haraganga College, Munshiganj',
        result: 'GPA 3.50 / 5.00',
        period: '2023',
        board: 'Dhaka Board',
    },
    {
        title: 'Secondary School Certificate (S.S.C)',
        field: 'Business Studies',
        org: 'Rancha Ruhitpur High School, Munshiganj',
        result: 'GPA 3.72 / 5.00',
        period: '2020',
        board: 'Dhaka Board',
    },
];

const PortfolioResume = () => {
    return (
        <section id='resume' className='portfolio-section'>
            <h1 className='section-title'>Resume — Md Ikram</h1>
            <p className='section-subtitle'>
                Work experience and education of Md Ikram (Ikramul Islam), Senior Software Developer.
            </p>

            <div className='timeline'>
                {experiences.map((exp) => (
                    <div className='timeline-item' key={`${exp.role}-${exp.company}`}>
                        <div className='timeline-dot' />
                        <div className='timeline-content'>
                            <h3>
                                {exp.role} · <span className='color-pc'>{exp.company}</span>
                            </h3>
                            <div className='timeline-period'>
                                {exp.period}
                                {exp.location ? ` · ${exp.location}` : ''}
                            </div>
                            <ul>
                                {exp.bullets.map((b) => (
                                    <li key={b}>{b}</li>
                                ))}
                            </ul>
                        </div>
                    </div>
                ))}
            </div>

            <h3 className='resume-heading'>Academic Background</h3>
            <ul className='edu-list'>
                {education.map((e) => (
                    <li key={e.title} className='edu-item'>
                        <div className='edu-title'>{e.title}</div>
                        <div className='edu-org'>
                            {e.field} — {e.org}
                        </div>
                        <div className='edu-period'>
                            {e.result} · {e.period} · {e.board}
                        </div>
                    </li>
                ))}
            </ul>

            <div className='hero-cta mt-4'>
                <Link className='btn btn-primary' to='/portfolio/contact'>Hire Me</Link>
                <a className='btn btn-outline' href='/assets/cv.pdf' download>
                    Download CV
                </a>
            </div>
        </section>
    );
};

export default PortfolioResume;

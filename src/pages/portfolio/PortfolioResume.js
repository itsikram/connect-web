import React from 'react';

const experiences = [
    {
        role: 'Senior Software Developer',
        company: 'Lexidom Agency',
        period: 'March, 2025 — Present',
        bullets: [
            'Leading full-stack development projects',
            'Building custom WordPress solutions and MERN applications',
            'Mentoring junior developers and code review'
        ]
    },
    {
        role: 'WordPress Problem Solver',
        company: 'BdCalling IT Ltd',
        location: 'Banasree, Rampura',
        period: 'March, 2024 — July, 2024',
        bullets: [
            'Resolved complex WordPress issues and bugs',
            'Optimized website performance and security',
            'Implemented custom solutions for client requirements'
        ]
    },
    {
        role: 'Custom WordPress Developer',
        company: 'Freelancer.com',
        period: 'February, 2023 — July, 2024',
        bullets: [
            'Developed custom WordPress themes and plugins',
            'Built responsive websites with modern UI/UX',
            'Integrated third-party APIs and payment gateways'
        ]
    },
    {
        role: 'WordPress Theme Developer',
        company: 'Fiverr.com',
        period: 'November, 2020 — January, 2025',
        bullets: [
            'Created custom WordPress themes from scratch',
            'Converted PSD/Figma designs to WordPress',
            'Maintained 5-star rating with excellent client reviews'
        ]
    }
];

const education = [
    {
        title: 'Higher Secondary Certificate (H.S.C)',
        field: 'Business Studies',
        org: 'Govt. Haraganga College, Munshiganj',
        result: 'GPA- 3.50 (Out of 5.00)',
        period: '2023',
        board: 'Dhaka Board'
    },
    {
        title: 'Secondary School Certificate (S.S.C)',
        field: 'Business Studies',
        org: 'Rancha Ruhitpur High School, Munshiganj',
        result: 'GPA- 3.72 (Out of 5.00)',
        period: '2020',
        board: 'Dhaka Board'
    }
];

const PortfolioResume = () => {
    return (
        <section id='resume' className='portfolio-section'>
            <h2 className='section-title'>Resume</h2>
            <p className='section-subtitle'>Experience, education, and impact.</p>

            <div className='timeline'>
                {experiences.map((exp, idx) => (
                    <div className='timeline-item' key={idx}>
                        <div className='timeline-dot'></div>
                        <div className='timeline-content'>
                            <h3>{exp.role} · <span className='color-pc'>{exp.company}</span></h3>
                            <div className='timeline-period'>{exp.period}</div>
                            <ul>
                                {exp.bullets.map((b, i) => <li key={i}>{b}</li>)}
                            </ul>
                        </div>
                    </div>
                ))}
            </div>

            <h3 className='mt-4'>Academic Background</h3>
            <ul className='edu-list'>
                {education.map((e, i) => (
                    <li key={i} className='edu-item'>
                        <div className='edu-title'>{e.title}</div>
                        <div className='edu-org'>{e.field} - {e.org}</div>
                        <div className='edu-period'>{e.result} | {e.period} | {e.board}</div>
                    </li>
                ))}
            </ul>

            <div className='hero-cta mt-4'>
                <a className='btn btn-primary' href='/portfolio/contact'>Hire Me</a>
                <a className='btn btn-outline' href='/portfolio/about'>About Me</a>
            </div>
        </section>
    );
}

export default PortfolioResume;

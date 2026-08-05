import React from 'react';
import SocialIcons from '../../components/portfolio/SocialIcons';
import ParticleBackground from '../../components/portfolio/ParticleBackground.tsx';
import { Link } from 'react-router-dom';

const frontendSkills = ['HTML5', 'CSS3', 'Bootstrap', 'Tailwind', 'MUI', 'jQuery', 'React.js', 'React Native', 'Sass'];
const backendSkills = ['PHP', 'Node.js', 'Express.js', 'Firebase', 'Prisma', 'Mongoose'];
const dbSkills = ['MySQL', 'MongoDB', 'SQLite', 'MariaDB', 'PostgreSQL'];
const toolSkills = ['Docker', 'Postman', 'VS Code', 'Cursor', 'Photoshop', 'Android Studio'];

const PortfolioHome = () => {
    return (
        <>
            <section id='home' className='portfolio-hero-section'>
                <div className='hero-bg' aria-hidden='true'>
                    <ParticleBackground id='tsparticles-hero' />
                </div>
                <div className='hero-content'>
                    <span className='hero-eyebrow'>Available for work</span>
                    <h1 className='font-bold home-title color-wh'>
                        Hi, I&apos;m <span className='color-pc'>Md Ikram</span>
                    </h1>
                    <p className='color-tc home-desc'>
                        <strong className='color-wh'>Md Ikram</strong> (also known as{' '}
                        <strong className='color-wh'>Ikramul Islam</strong>) is a Senior Software
                        Developer from Munshiganj, Bangladesh, with 5 years of expertise in
                        WordPress, MERN Stack, and React Native. I build custom themes, plugins,
                        and products that feel fast and intentional.
                    </p>
                    <div className='hero-cta'>
                        <Link className='btn btn-primary' to='/portfolio/resume'>View Resume</Link>
                        <Link className='btn btn-outline' to='/portfolio/contact'>Contact Me</Link>
                    </div>
                    <div className='social-media-container'>
                        <SocialIcons />
                    </div>
                </div>
            </section>

            <section id='about' className='portfolio-section'>
                <h2 className='section-title'>About</h2>
                <p className='section-subtitle'>A quick snapshot of who I am and how I work.</p>
                <div className='about-grid'>
                    <div className='about-card'>
                        <h3 className='color-wh'>Career Objectives</h3>
                        <p className='color-tc'>
                            Experienced WordPress and MERN developer seeking a challenging role where
                            I can lead projects, improve UX, and ship performant products.
                        </p>
                    </div>
                    <div className='about-card'>
                        <h3 className='color-wh'>Key Strengths</h3>
                        <p className='color-tc'>
                            Hard-working, honest, and reliable under pressure — with a focus on
                            clear problem-solving and ownership.
                        </p>
                    </div>
                </div>
            </section>

            <section id='skills' className='portfolio-section'>
                <h2 className='section-title'>Technical Skills</h2>
                <p className='section-subtitle'>Languages and tools I use day to day.</p>
                <div className='about-grid'>
                    <div className='about-card'>
                        <h4 className='color-wh'>Front-end</h4>
                        <div className='skill-chips'>
                            {frontendSkills.map((s) => (
                                <span className='skill-chip' key={s}>{s}</span>
                            ))}
                        </div>
                    </div>
                    <div className='about-card'>
                        <h4 className='color-wh'>Back-end</h4>
                        <div className='skill-chips'>
                            {backendSkills.map((s) => (
                                <span className='skill-chip' key={s}>{s}</span>
                            ))}
                        </div>
                    </div>
                    <div className='about-card'>
                        <h4 className='color-wh'>Database</h4>
                        <div className='skill-chips'>
                            {dbSkills.map((s) => (
                                <span className='skill-chip' key={s}>{s}</span>
                            ))}
                        </div>
                    </div>
                    <div className='about-card'>
                        <h4 className='color-wh'>Tools & Software</h4>
                        <div className='skill-chips'>
                            {toolSkills.map((s) => (
                                <span className='skill-chip' key={s}>{s}</span>
                            ))}
                        </div>
                    </div>
                </div>
            </section>

            <section id='projects' className='portfolio-section'>
                <h2 className='section-title'>Projects</h2>
                <p className='section-subtitle'>Highlights that show how I approach product work.</p>
                <div className='about-grid'>
                    <div className='about-card'>
                        <h3 className='color-wh'>Modern Messaging UI</h3>
                        <p className='color-tc'>
                            Realtime chat with typing indicators, optimistic updates, and smooth
                            micro-interactions.
                        </p>
                        <div className='project-meta'>
                            <span className='project-tag'>React</span>
                            <span className='project-tag'>Socket.io</span>
                            <span className='project-tag'>UX</span>
                        </div>
                    </div>
                    <div className='about-card'>
                        <h3 className='color-wh'>Performance-led Feed</h3>
                        <p className='color-tc'>
                            Virtualized lists, image optimization, and skeleton states for snappy
                            interactions.
                        </p>
                        <div className='project-meta'>
                            <span className='project-tag'>MERN</span>
                            <span className='project-tag'>Performance</span>
                            <span className='project-tag'>Mobile</span>
                        </div>
                    </div>
                </div>
            </section>

            <section id='experience' className='portfolio-section'>
                <h2 className='section-title'>Work Experience</h2>
                <p className='section-subtitle'>Roles that shaped how I build and ship.</p>
                <div className='timeline'>
                    <div className='timeline-item'>
                        <div className='timeline-dot' />
                        <div className='timeline-content'>
                            <div className='timeline-period'>March 2025 — Present</div>
                            <div className='color-wh'>Senior Software Developer</div>
                            <div className='color-tc'>Lexidom Agency</div>
                        </div>
                    </div>
                    <div className='timeline-item'>
                        <div className='timeline-dot' />
                        <div className='timeline-content'>
                            <div className='timeline-period'>March 2024 — July 2024</div>
                            <div className='color-wh'>WordPress Problem Solver</div>
                            <div className='color-tc'>BdCalling IT Ltd, Banasree, Rampura</div>
                        </div>
                    </div>
                    <div className='timeline-item'>
                        <div className='timeline-dot' />
                        <div className='timeline-content'>
                            <div className='timeline-period'>February 2023 — July 2024</div>
                            <div className='color-wh'>Custom WordPress Developer</div>
                            <div className='color-tc'>Freelancer.com</div>
                        </div>
                    </div>
                    <div className='timeline-item'>
                        <div className='timeline-dot' />
                        <div className='timeline-content'>
                            <div className='timeline-period'>November 2020 — January 2025</div>
                            <div className='color-wh'>WordPress Theme Developer</div>
                            <div className='color-tc'>Fiverr.com</div>
                        </div>
                    </div>
                </div>
            </section>

            <section id='contact' className='portfolio-section'>
                <h2 className='section-title'>Contact</h2>
                <p className='section-subtitle'>Interested in working together? Let&apos;s connect.</p>
                <div className='hero-cta'>
                    <Link className='btn btn-primary' to='/portfolio/contact'>Start a conversation</Link>
                    <a className='btn btn-outline' download href='/assets/cv.pdf'>Download Resume</a>
                </div>
            </section>
        </>
    );
};

export default PortfolioHome;

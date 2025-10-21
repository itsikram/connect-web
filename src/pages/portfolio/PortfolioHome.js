import React from 'react';
import SocialIcons from '../../components/portfolio/SocialIcons';
import ParticleBackground from '../../components/portfolio/ParticleBackground.tsx';
import { Link } from 'react-router-dom';

const PortfolioHome = () => {
    return (
        <>
            <section id='home' className='portfolio-hero-section'>
                <div className='hero-bg'>
                    <ParticleBackground id='tsparticles-hero' />
                </div>
                <div className='hero-content'>
                <h1 className="font-bold home-title color-wh">Hi, I&apos;m <span className='color-pc'>Md Ikram</span></h1>
                <p className='color-tc home-desc'>
                    Senior Software Developer with 5 years of expertise in WordPress, MERN Stack, and React Native Mobile App Development. 
                    I specialize in custom theme development, plugin creation, website optimization, and building innovative solutions to enhance user experience.
                </p>
                    <div className='hero-cta'>
                        <Link className='btn btn-primary' to='/portfolio/resume'>View Resume</Link>
                        <Link className='btn btn-outline' to='/portfolio/contact'>Contact Me</Link>
                    </div>
                    <div className='social-media-container mt-3'>
                        <SocialIcons />
                    </div>
                </div>
            </section>

            <section id='about' className='portfolio-section mt-4'>
                <h2 className='section-title'>About</h2>
                <p className='section-subtitle'>A quick snapshot of who I am and how I work.</p>
                <div className='about-grid'>
                    <div className='about-card'>
                        <h3 className='color-wh'>Career Objectives</h3>
                        <p className='color-tc'>Experienced WordPress And MERN Developer seeking a challenging role where I can lead projects, enhance user experience, and implement innovative solutions to improve web performance and functionality.</p>
                    </div>
                    <div className='about-card'>
                        <h3 className='color-wh'>Key Strengths</h3>
                        <p className='color-tc'>Hard Worker, Honest, Punctual and Responsible. Complex Problem Solving and willing to accept responsibility and perform accordingly even under pressure.</p>
                    </div>
                </div>
            </section>

            <section id='skills' className='portfolio-section mt-4'>
                <h2 className='section-title'>Technical Skills</h2>
                <p className='section-subtitle'>Computer languages and technologies I work with.</p>
                <div className='about-grid'>
                    <div className='about-card'>
                        <h4 className='color-wh'>Front-end</h4>
                        <p className='color-tc'>Html5, Css3, Bootstrap, Tailwind, MUI, jQuery.js, React.js, React Native, Sass CSS</p>
                    </div>
                    <div className='about-card'>
                        <h4 className='color-wh'>Back-end</h4>
                        <p className='color-tc'>PHP, Node.js, Express.js, Firebase, Prisma, Mongoose</p>
                    </div>
                    <div className='about-card'>
                        <h4 className='color-wh'>Database</h4>
                        <p className='color-tc'>MySQL, MongoDB, SQLite, MariaDB, PostgreSQL</p>
                    </div>
                    <div className='about-card'>
                        <h4 className='color-wh'>Tools & Software</h4>
                        <p className='color-tc'>Docker, Postman, VS Code, Cursor, Notepad++, Adobe Photoshop, MS Word, Android Studio</p>
                    </div>
                </div>
            </section>

            <section id='projects' className='portfolio-section mt-4'>
                <h2 className='section-title'>Projects</h2>
                <p className='section-subtitle'>Recent highlights that showcase my work and approach.</p>
                <div className='about-grid'>
                    <div className='about-card'>
                        <h3 className='color-wh'>Modern Messaging UI</h3>
                        <p className='color-tc'>Realtime chat with typing indicators, optimistic updates, and smooth micro-interactions.</p>
                    </div>
                    <div className='about-card'>
                        <h3 className='color-wh'>Performance-led Feed</h3>
                        <p className='color-tc'>Virtualized lists, image optimization, and skeleton states for sub-100ms interactions.</p>
                    </div>
                </div>
            </section>

            <section id='experience' className='portfolio-section mt-4'>
                <h2 className='section-title'>Work Experience</h2>
                <div className='timeline mt-3'>
                    <div className='timeline-item'>
                        <div className='timeline-dot' />
                        <div className='timeline-content'>
                            <div className='timeline-period'>March, 2025 — Present</div>
                            <div className='color-wh'>Senior Software Developer</div>
                            <div className='color-tc'>Lexidom Agency</div>
                        </div>
                    </div>
                    <div className='timeline-item'>
                        <div className='timeline-dot' />
                        <div className='timeline-content'>
                            <div className='timeline-period'>March, 2024 — July, 2024</div>
                            <div className='color-wh'>WordPress Problem Solver</div>
                            <div className='color-tc'>BdCalling IT Ltd, Banasree, Rampura</div>
                        </div>
                    </div>
                    <div className='timeline-item'>
                        <div className='timeline-dot' />
                        <div className='timeline-content'>
                            <div className='timeline-period'>February, 2023 — July, 2024</div>
                            <div className='color-wh'>Custom WordPress Developer</div>
                            <div className='color-tc'>Freelancer.com</div>
                        </div>
                    </div>
                    <div className='timeline-item'>
                        <div className='timeline-dot' />
                        <div className='timeline-content'>
                            <div className='timeline-period'>November, 2020 — January, 2025</div>
                            <div className='color-wh'>WordPress Theme Developer</div>
                            <div className='color-tc'>Fiverr.com</div>
                        </div>
                    </div>
                </div>
            </section>

            <section id='contact' className='portfolio-section mt-4'>
                <h2 className='section-title'>Contact</h2>
                <p className='section-subtitle'>Interested in working together? Let’s connect.</p>
                <div className='hero-cta'>
                    <Link className='btn btn-primary' to='/portfolio/contact'>Start a conversation</Link>
                    <a className='btn btn-outline' download={true} href='/assets/cv.pdf'>Download Resume</a>
                </div>
            </section>
        </>
    );
}

export default PortfolioHome;

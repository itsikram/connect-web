import React, { useEffect, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import PortfolioMenu from '../../components/portfolio/PortfolioMenu';
import PortfolioSEO from '../../components/portfolio/PortfolioSEO';
import ParticleBackground from '../../components/portfolio/ParticleBackground.tsx';
import config from '../../config/config.json';

const PortfolioContainer = () => {
    const [menuOpen, setMenuOpen] = useState(false);
    const location = useLocation();

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

    return (
        <div className={`portfolio-page-container${menuOpen ? ' menu-open' : ''}`}>
            <PortfolioSEO />
            <div className='portfolio-page-bg' aria-hidden='true'>
                <ParticleBackground id='tsparticles-global' />
            </div>

            <header className='portfolio-mobile-bar'>
                <div className='mobile-bar-brand'>
                    <img
                        className='mobile-bar-avatar'
                        src={config?.portfolioPP}
                        alt='Md Ikram'
                    />
                    <span className='mobile-bar-name'>Md Ikram</span>
                </div>
                <button
                    type='button'
                    className={`mobile-menu-btn${menuOpen ? ' is-open' : ''}`}
                    aria-label={menuOpen ? 'Close menu' : 'Open menu'}
                    aria-expanded={menuOpen}
                    aria-controls='portfolio-sidebar'
                    onClick={() => setMenuOpen((o) => !o)}
                >
                    <span />
                    <span />
                    <span />
                </button>
            </header>

            {menuOpen && (
                <button
                    type='button'
                    className='portfolio-backdrop'
                    aria-label='Close menu'
                    onClick={() => setMenuOpen(false)}
                />
            )}

            <aside id='portfolio-sidebar' className='left-sidebar'>
                <div className='sidebar-brand'>
                    <p className='my-name'>Md Ikram</p>
                    <p className='sidebar-role'>Senior Software Developer · Ikramul Islam</p>
                </div>
                <div className='image-container'>
                    <img
                        className='avatar-image'
                        src={config?.portfolioPP}
                        alt='Md Ikram (Ikramul Islam), Senior Software Developer'
                        width={160}
                        height={160}
                    />
                </div>
                <div className='sidebar-divider' />
                <PortfolioMenu onNavigate={() => setMenuOpen(false)} />
                <a className='sidebar-cta btn btn-primary' href='/assets/cv.pdf' download>
                    Download CV
                </a>
            </aside>

            <main className='content-container' id='portfolio-main'>
                <Outlet />
                <footer className='portfolio-seo-footer'>
                    <p>
                        © {new Date().getFullYear()}{' '}
                        <strong>Md Ikram</strong> (also known as{' '}
                        <strong>Ikramul Islam</strong> / Programmer Ikram) — Senior Software
                        Developer specializing in WordPress, MERN Stack, and React Native.
                        Based in Munshiganj, Bangladesh.
                    </p>
                </footer>
            </main>
        </div>
    );
};

export default PortfolioContainer;

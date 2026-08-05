import React from 'react';
import { NavLink } from 'react-router-dom';

const links = [
    { to: '/portfolio', end: true, label: 'Home' },
    { to: 'about', label: 'About' },
    { to: 'resume', label: 'Resume' },
    { to: 'blogs', label: 'Blogs' },
    { to: 'contact', label: 'Contact' },
];

const PortfolioMenu = ({ onNavigate }) => {
    return (
        <nav className='portfolio-menu-container' aria-label='Portfolio'>
            <ul className='portfolio-menu'>
                {links.map(({ to, end, label }) => (
                    <li className='portfolio-menu-item' key={label}>
                        <NavLink
                            to={to}
                            end={end}
                            className={({ isActive }) => (isActive ? 'active' : undefined)}
                            onClick={onNavigate}
                        >
                            {label}
                        </NavLink>
                    </li>
                ))}
            </ul>
        </nav>
    );
};

export default PortfolioMenu;

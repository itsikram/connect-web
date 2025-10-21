import React from 'react';
import { NavLink } from 'react-router-dom';

const PortfolioMenu = () => {

    return (
        <div className='portfolio-menu-container'>

            <ul className='portfolio-menu'>
                <li className='portfolio-menu-item'>
                    <NavLink to='/portfolio' end className={({ isActive }) => isActive ? 'active' : undefined}>Home</NavLink>
                </li>
                <li className='portfolio-menu-item'>
                    <NavLink to='about' className={({ isActive }) => isActive ? 'active' : undefined}>About</NavLink>
                </li>
                <li className='portfolio-menu-item'>
                    <NavLink to='resume' className={({ isActive }) => isActive ? 'active' : undefined}>Resume</NavLink>
                </li>
                <li className='portfolio-menu-item'>
                    <NavLink to='blogs' className={({ isActive }) => isActive ? 'active' : undefined}>Blogs</NavLink>
                </li>
                <li className='portfolio-menu-item'>
                    <NavLink to='contact' className={({ isActive }) => isActive ? 'active' : undefined}>Contact</NavLink>
                </li>
            </ul>
        </div>
    );
}

export default PortfolioMenu;

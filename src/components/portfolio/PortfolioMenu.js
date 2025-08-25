import React from 'react';
import { Link } from 'react-router-dom';

const PortfolioMenu = () => {

    return (
        <div className='portfolio-menu-container'>

            <ul className='portfolio-menu'>
                <li className='portfolio-menu-item'>
                    <Link to='/portfolio'>Home</Link>
                </li>
                <li className='portfolio-menu-item'>
                <Link to='about'>About</Link>
                </li>
                <li className='portfolio-menu-item'>
                <Link to='resume'>Resume</Link>
                </li>
                <li className='portfolio-menu-item'>
                <Link to='blogs'>Blogs</Link>
                </li>
                <li className='portfolio-menu-item'>
                <Link to='contact'>Contact </Link>
                </li>
            </ul>
        </div>
    );
}

export default PortfolioMenu;

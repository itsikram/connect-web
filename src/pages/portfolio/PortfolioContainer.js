import React from 'react';
import { Outlet } from 'react-router-dom';
import PortfolioMenu from '../../components/portfolio/PortfolioMenu';

const PortfolioContainer = () => {
    return (
        <div className='portfolio-page-container'>
            <div className='left-sidebar'>
                <h1 className='my-name mb-2'>Md Ikram</h1>
                <div className='image-container my-2'>
                    <img className='avatar-image' src='https://programmerikram.com/wp-content/uploads/2024/10/Ikramul-islam-transparent.png' alt='Programmer Ikram' />
                </div>
                <hr className='my-3' style={{ color: 'gray' }} />
                <PortfolioMenu />
            </div>
            <div className='column-9 content-container'>
                <Outlet />

            </div>
            {/* {children} */}
        </div>
    );
}

export default PortfolioContainer;

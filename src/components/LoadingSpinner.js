import React from 'react';
import './LoadingSpinner.css';

const LoadingSpinner = ({ size = 'medium', color = 'primary', text = 'Loading...' }) => {
    const sizeClass = `spinner-${size}`;
    const colorClass = `spinner-${color}`;

    return (
        <div className={`loading-spinner-container ${sizeClass}`}>
            <div className={`spinner ${colorClass}`}></div>
            {text && <p className="loading-text">{text}</p>}
        </div>
    );
};

export default LoadingSpinner;

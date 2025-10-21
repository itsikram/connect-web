import React from 'react';
import './ModernLoader.css';

const ModernLoader = ({ size = 'medium', text = 'Loading...', showText = true }) => {
  const sizeClasses = {
    small: 'loader-small',
    medium: 'loader-medium',
    large: 'loader-large'
  };


  return (
    <div className={`modern-loader ${sizeClasses[size]}`}>
      <div className="loader-container">
        <div className="loader-spinner">
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
          <div className="spinner-ring"></div>
        </div>
        {showText && <div className="loader-text">{text}</div>}
      </div>
    </div>
  );
};

export default ModernLoader;

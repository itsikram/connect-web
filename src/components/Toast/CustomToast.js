import React, { useEffect, useRef } from 'react';
import { Link } from 'react-router-dom';
import './CustomToast.css';

const CustomToast = ({ 
  type = 'info', 
  title, 
  message, 
  avatar, 
  link, 
  icon,
  showAvatar = true,
  showIcon = true,
  closeToast,
  toastProps 
}) => {
  const progressBarRef = useRef(null);

  const getIcon = () => {
    if (icon) return icon;
    
    switch (type) {
      case 'success':
        return <i className="fas fa-check-circle"></i>;
      case 'error':
        return <i className="fas fa-exclamation-circle"></i>;
      case 'warning':
        return <i className="fas fa-exclamation-triangle"></i>;
      case 'info':
      default:
        return <i className="fas fa-info-circle"></i>;
    }
  };

  useEffect(() => {
    if (progressBarRef.current && toastProps?.autoClose) {
      const duration = toastProps.autoClose;
      progressBarRef.current.style.setProperty('--progress-duration', `${duration}ms`);
    }
  }, [toastProps]);

  const ToastContent = () => (
    <div className={`custom-toast custom-toast--${type}`}>
      <button 
        className="custom-toast__close-btn" 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (closeToast) closeToast();
        }}
        aria-label="Close"
      >
        ×
      </button>
      <div className="custom-toast__content">
        {showIcon && !showAvatar && (
          <div className="custom-toast__icon">
            {getIcon()}
          </div>
        )}
        
        <div className="custom-toast__body">
          {showAvatar && avatar && (
            <div className="custom-toast__avatar">
              <img src={avatar} alt="Avatar" />
            </div>
          )}
          
          <div className="custom-toast__text">
            {title && <div className="custom-toast__title">{title}</div>}
            <div className="custom-toast__message">{message}</div>
          </div>
        </div>
      </div>
      <div 
        ref={progressBarRef}
        className={`custom-toast__progress-bar custom-toast__progress-bar--${type}`}
      ></div>
    </div>
  );

  return link ? (
    <Link to={link} className="custom-toast__link">
      <ToastContent />
    </Link>
  ) : (
    <ToastContent />
  );
};

export default CustomToast;

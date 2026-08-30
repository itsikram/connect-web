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

  const inner = (
    <>
      {showIcon && !showAvatar && (
        <div className="custom-toast__icon" aria-hidden="true">
          {getIcon()}
        </div>
      )}

      <div className="custom-toast__body">
        {showAvatar && avatar && (
          <div className="custom-toast__avatar">
            <img src={avatar} alt="" />
          </div>
        )}

        <div className="custom-toast__text">
          {title && <div className="custom-toast__title">{title}</div>}
          <div className="custom-toast__message">{message}</div>
        </div>
      </div>
    </>
  );

  return (
    <div className={`custom-toast custom-toast--${type}`} role="status">
      <button
        type="button"
        className="custom-toast__close-btn"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (closeToast) closeToast();
        }}
        aria-label="Close notification"
      >
        ×
      </button>
      <div className="custom-toast__content">
        {link ? (
          <Link to={link} className="custom-toast__link">
            {inner}
          </Link>
        ) : (
          inner
        )}
      </div>
      <div
        ref={progressBarRef}
        className={`custom-toast__progress-bar custom-toast__progress-bar--${type}`}
      />
    </div>
  );
};

export default CustomToast;

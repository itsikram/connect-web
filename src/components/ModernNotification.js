import React, { useState, useEffect } from 'react';
import './ModernNotification.css';

const ModernNotification = ({ 
  type = 'info', 
  title, 
  message, 
  duration = 5000, 
  onClose,
  position = 'top-right',
  showIcon = true 
}) => {
  const [isVisible, setIsVisible] = useState(false);
  const [isLeaving, setIsLeaving] = useState(false);

  useEffect(() => {
    // Trigger entrance animation
    const timer = setTimeout(() => setIsVisible(true), 100);
    
    // Auto close after duration
    const closeTimer = setTimeout(() => {
      handleClose();
    }, duration);

    return () => {
      clearTimeout(timer);
      clearTimeout(closeTimer);
    };
  }, [duration]);

  const handleClose = () => {
    setIsLeaving(true);
    setTimeout(() => {
      setIsVisible(false);
      if (onClose) onClose();
    }, 300);
  };

  const getIcon = () => {
    switch (type) {
      case 'success':
        return '✓';
      case 'error':
        return '✕';
      case 'warning':
        return '⚠';
      case 'info':
      default:
        return 'ℹ';
    }
  };

  if (!isVisible) return null;

  return (
    <div className={`modern-notification ${type} ${position} ${isVisible ? 'show' : ''} ${isLeaving ? 'leaving' : ''}`}>
      <div className="notification-content">
        {showIcon && (
          <div className="notification-icon">
            {getIcon()}
          </div>
        )}
        <div className="notification-body">
          {title && <div className="notification-title">{title}</div>}
          <div className="notification-message">{message}</div>
        </div>
        <button className="notification-close" onClick={handleClose}>
          ×
        </button>
      </div>
      <div className="notification-progress">
        <div className="progress-bar"></div>
      </div>
    </div>
  );
};

export default ModernNotification;

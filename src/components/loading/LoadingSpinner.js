import React from 'react';
import './LoadingComponents.css';

/**
 * Professional loading spinner component with various sizes and styles
 */
const LoadingSpinner = ({ 
  size = 'medium', 
  variant = 'primary', 
  text = '', 
  inline = false, 
  className = '' 
}) => {
  const sizeClass = `spinner-${size}`;
  const variantClass = `spinner-${variant}`;
  const wrapperClass = inline ? 'spinner-inline' : 'spinner-block';

  return (
    <div className={`loading-spinner-wrapper ${wrapperClass} ${className}`}>
      <div className={`loading-spinner ${sizeClass} ${variantClass}`}>
        <div className="spinner-ring">
          <div></div>
          <div></div>
          <div></div>
          <div></div>
        </div>
      </div>
      {text && <span className="spinner-text">{text}</span>}
    </div>
  );
};

/**
 * Minimal dots loading indicator
 */
export const DotsLoader = ({ className = '' }) => {
  return (
    <div className={`dots-loader ${className}`}>
      <div className="dot"></div>
      <div className="dot"></div>
      <div className="dot"></div>
    </div>
  );
};

/**
 * Pulse animation loader for buttons
 */
export const PulseLoader = ({ text = 'Loading...', className = '' }) => {
  return (
    <div className={`pulse-loader ${className}`}>
      <div className="pulse-circle"></div>
      <span className="pulse-text">{text}</span>
    </div>
  );
};

/**
 * Typing indicator for comment/reply inputs
 */
export const TypingIndicator = ({ text = 'Posting...', className = '' }) => {
  return (
    <div className={`typing-indicator ${className}`}>
      <div className="typing-dots">
        <span></span>
        <span></span>
        <span></span>
      </div>
      <span className="typing-text">{text}</span>
    </div>
  );
};

export default LoadingSpinner;

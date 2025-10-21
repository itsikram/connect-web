import React from 'react';
import './ModernButton.css';

const ModernButton = ({ 
  children, 
  variant = 'primary', 
  size = 'medium', 
  disabled = false, 
  loading = false,
  icon,
  iconPosition = 'left',
  fullWidth = false,
  onClick,
  className = '',
  type = 'button',
  ...props 
}) => {
  const sizeClasses = {
    small: 'btn-small',
    medium: 'btn-medium',
    large: 'btn-large'
  };

  const variantClasses = {
    primary: 'btn-primary',
    secondary: 'btn-secondary',
    outline: 'btn-outline',
    ghost: 'btn-ghost',
    danger: 'btn-danger',
    success: 'btn-success'
  };

  const buttonClasses = [
    'modern-button',
    sizeClasses[size],
    variantClasses[variant],
    fullWidth ? 'btn-full-width' : '',
    disabled ? 'btn-disabled' : '',
    loading ? 'btn-loading' : '',
    className
  ].filter(Boolean).join(' ');

  const renderIcon = () => {
    if (loading) {
      return (
        <div className="btn-spinner">
          <div className="spinner"></div>
        </div>
      );
    }
    
    if (icon) {
      return <span className="btn-icon">{icon}</span>;
    }
    
    return null;
  };

  const renderContent = () => {
    if (iconPosition === 'right') {
      return (
        <>
          {children}
          {renderIcon()}
        </>
      );
    }
    
    return (
      <>
        {renderIcon()}
        {children}
      </>
    );
  };

  return (
    <button
      type={type}
      className={buttonClasses}
      disabled={disabled || loading}
      onClick={onClick}
      {...props}
    >
      {renderContent()}
    </button>
  );
};

export default ModernButton;

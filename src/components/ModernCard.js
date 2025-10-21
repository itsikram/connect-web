import React from 'react';
import './ModernCard.css';

const ModernCard = ({ 
  children, 
  className = '', 
  hover = true, 
  padding = 'medium',
  variant = 'default',
  onClick 
}) => {
  const paddingClasses = {
    none: 'card-padding-none',
    small: 'card-padding-small',
    medium: 'card-padding-medium',
    large: 'card-padding-large'
  };

  const variantClasses = {
    default: 'card-variant-default',
    elevated: 'card-variant-elevated',
    outlined: 'card-variant-outlined',
    glass: 'card-variant-glass'
  };

  const cardClasses = [
    'modern-card',
    paddingClasses[padding],
    variantClasses[variant],
    hover ? 'card-hover' : '',
    onClick ? 'card-clickable' : '',
    className
  ].filter(Boolean).join(' ');

  return (
    <div 
      className={cardClasses}
      onClick={onClick}
      role={onClick ? 'button' : undefined}
      tabIndex={onClick ? 0 : undefined}
    >
      {children}
    </div>
  );
};

export default ModernCard;

import React, { useState } from 'react';
import { ModernButton, ModernCard, ModernLoader, ModernNotification } from './modern';
import './ModernComponentsDemo.css';

const ModernComponentsDemo = () => {
  const [showNotification, setShowNotification] = useState(false);
  const [notificationType, setNotificationType] = useState('info');
  const [showLoader, setShowLoader] = useState(false);

  const handleShowNotification = (type) => {
    setNotificationType(type);
    setShowNotification(true);
  };

  const handleCloseNotification = () => {
    setShowNotification(false);
  };

  const handleShowLoader = () => {
    setShowLoader(true);
    setTimeout(() => setShowLoader(false), 3000);
  };

  return (
    <div className="modern-demo-container">
      <div className="demo-header">
        <h1>Modern UI Components Demo</h1>
        <p>Showcase of the enhanced UI/UX components</p>
      </div>

      <div className="demo-grid">
        {/* Modern Buttons Demo */}
        <ModernCard className="demo-section">
          <h3>Modern Buttons</h3>
          <div className="button-grid">
            <ModernButton variant="primary" onClick={() => handleShowNotification('success')}>
              Primary Button
            </ModernButton>
            <ModernButton variant="secondary" onClick={() => handleShowNotification('info')}>
              Secondary Button
            </ModernButton>
            <ModernButton variant="outline" onClick={() => handleShowNotification('warning')}>
              Outline Button
            </ModernButton>
            <ModernButton variant="ghost" onClick={() => handleShowNotification('error')}>
              Ghost Button
            </ModernButton>
            <ModernButton variant="danger" icon="⚠" onClick={handleShowLoader}>
              Danger Button
            </ModernButton>
            <ModernButton variant="success" icon="✓" loading={showLoader}>
              Loading Button
            </ModernButton>
          </div>
        </ModernCard>

        {/* Modern Cards Demo */}
        <ModernCard className="demo-section" variant="elevated">
          <h3>Modern Cards</h3>
          <div className="card-grid">
            <ModernCard variant="default" padding="small">
              <h4>Default Card</h4>
              <p>This is a default modern card with small padding.</p>
            </ModernCard>
            <ModernCard variant="elevated" padding="medium">
              <h4>Elevated Card</h4>
              <p>This card has enhanced elevation and medium padding.</p>
            </ModernCard>
            <ModernCard variant="outlined" padding="large">
              <h4>Outlined Card</h4>
              <p>This card uses an outlined style with large padding.</p>
            </ModernCard>
            <ModernCard variant="glass" padding="medium">
              <h4>Glass Card</h4>
              <p>This card has a glass morphism effect.</p>
            </ModernCard>
          </div>
        </ModernCard>

        {/* Modern Loader Demo */}
        <ModernCard className="demo-section">
          <h3>Modern Loaders</h3>
          <div className="loader-grid">
            <div className="loader-demo">
              <h4>Small Loader</h4>
              <ModernLoader size="small" text="Loading..." />
            </div>
            <div className="loader-demo">
              <h4>Medium Loader</h4>
              <ModernLoader size="medium" text="Processing..." />
            </div>
            <div className="loader-demo">
              <h4>Large Loader</h4>
              <ModernLoader size="large" text="Please wait..." />
            </div>
          </div>
        </ModernCard>

        {/* Interactive Demo */}
        <ModernCard className="demo-section" variant="glass">
          <h3>Interactive Features</h3>
          <div className="interactive-demo">
            <ModernButton 
              variant="primary" 
              fullWidth 
              onClick={handleShowLoader}
              icon="🚀"
            >
              Show Loading Demo
            </ModernButton>
            <div className="demo-buttons">
              <ModernButton 
                variant="success" 
                onClick={() => handleShowNotification('success')}
                icon="✓"
              >
                Success Notification
              </ModernButton>
              <ModernButton 
                variant="danger" 
                onClick={() => handleShowNotification('error')}
                icon="✕"
              >
                Error Notification
              </ModernButton>
              <ModernButton 
                variant="outline" 
                onClick={() => handleShowNotification('warning')}
                icon="⚠"
              >
                Warning Notification
              </ModernButton>
            </div>
          </div>
        </ModernCard>
      </div>

      {/* Modern Notifications */}
      {showNotification && (
        <ModernNotification
          type={notificationType}
          title={`${notificationType.charAt(0).toUpperCase() + notificationType.slice(1)} Notification`}
          message={`This is a ${notificationType} notification with modern styling and animations.`}
          duration={4000}
          onClose={handleCloseNotification}
          position="top-right"
        />
      )}
    </div>
  );
};

export default ModernComponentsDemo;

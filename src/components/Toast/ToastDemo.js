import React from 'react';
import toastUtils from '../../utils/toastUtils';

const ToastDemo = () => {
  const demoAvatar = "https://programmerikram.com/wp-content/uploads/2025/03/ics_logo.png";
  const demoUserAvatar = "https://programmerikram.com/wp-content/uploads/2025/03/default-profilePic.png";

  const handleSuccessToast = () => {
    toastUtils.success("Operation completed successfully!", {
      title: "Success",
      autoClose: 4000
    });
  };

  const handleErrorToast = () => {
    toastUtils.error("Something went wrong. Please try again.", {
      title: "Error",
      autoClose: 6000
    });
  };

  const handleWarningToast = () => {
    toastUtils.warning("Please check your internet connection.", {
      title: "Warning",
      autoClose: 5000
    });
  };

  const handleInfoToast = () => {
    toastUtils.info("New features are available in the latest update.", {
      title: "Information",
      autoClose: 5000
    });
  };

  const handleMessageToast = () => {
    toastUtils.message(
      "Hey! How are you doing today?",
      "John Doe",
      demoUserAvatar,
      "/message/123"
    );
  };

  const handleProfileUpdateToast = () => {
    toastUtils.profileUpdate(
      "Your profile has been updated successfully",
      "Your Name",
      demoUserAvatar,
      "/profile"
    );
  };

  const handleVideoSavedToast = () => {
    toastUtils.videoSaved(
      "Amazing sunset video",
      demoUserAvatar,
      "/downloads/video123"
    );
  };

  const handleCustomToast = () => {
    toastUtils.custom("success", "Custom toast with avatar and icon", {
      title: "Custom Success",
      avatar: demoAvatar,
      showAvatar: true,
      showIcon: true,
      link: "/custom-link",
      autoClose: 5000
    });
  };

  return (
    <div className="toast-demo" style={{ padding: '20px', maxWidth: '600px', margin: '0 auto' }}>
      <h2 style={{ textAlign: 'center', marginBottom: '30px', color: '#1f2937' }}>
        Professional Toast Notifications Demo
      </h2>
      
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: '15px' }}>
        <button 
          onClick={handleSuccessToast}
          style={{
            background: 'linear-gradient(135deg, #10b981, #059669)',
            color: 'white',
            border: 'none',
            padding: '12px 20px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'transform 0.2s ease'
          }}
          onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
        >
          Success Toast
        </button>

        <button 
          onClick={handleErrorToast}
          style={{
            background: 'linear-gradient(135deg, #ef4444, #dc2626)',
            color: 'white',
            border: 'none',
            padding: '12px 20px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'transform 0.2s ease'
          }}
          onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
        >
          Error Toast
        </button>

        <button 
          onClick={handleWarningToast}
          style={{
            background: 'linear-gradient(135deg, #f59e0b, #d97706)',
            color: 'white',
            border: 'none',
            padding: '12px 20px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'transform 0.2s ease'
          }}
          onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
        >
          Warning Toast
        </button>

        <button 
          onClick={handleInfoToast}
          style={{
            background: 'linear-gradient(135deg, #3b82f6, #2563eb)',
            color: 'white',
            border: 'none',
            padding: '12px 20px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'transform 0.2s ease'
          }}
          onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
        >
          Info Toast
        </button>

        <button 
          onClick={handleMessageToast}
          style={{
            background: 'linear-gradient(135deg, #8b5cf6, #7c3aed)',
            color: 'white',
            border: 'none',
            padding: '12px 20px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'transform 0.2s ease'
          }}
          onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
        >
          Message Toast
        </button>

        <button 
          onClick={handleProfileUpdateToast}
          style={{
            background: 'linear-gradient(135deg, #06b6d4, #0891b2)',
            color: 'white',
            border: 'none',
            padding: '12px 20px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'transform 0.2s ease'
          }}
          onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
        >
          Profile Update
        </button>

        <button 
          onClick={handleVideoSavedToast}
          style={{
            background: 'linear-gradient(135deg, #ec4899, #db2777)',
            color: 'white',
            border: 'none',
            padding: '12px 20px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'transform 0.2s ease'
          }}
          onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
        >
          Video Saved
        </button>

        <button 
          onClick={handleCustomToast}
          style={{
            background: 'linear-gradient(135deg, #6366f1, #4f46e5)',
            color: 'white',
            border: 'none',
            padding: '12px 20px',
            borderRadius: '8px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500',
            transition: 'transform 0.2s ease'
          }}
          onMouseOver={(e) => e.target.style.transform = 'translateY(-2px)'}
          onMouseOut={(e) => e.target.style.transform = 'translateY(0)'}
        >
          Custom Toast
        </button>
      </div>

      <div style={{ marginTop: '30px', textAlign: 'center' }}>
        <button 
          onClick={toastUtils.dismissAll}
          style={{
            background: '#6b7280',
            color: 'white',
            border: 'none',
            padding: '10px 20px',
            borderRadius: '6px',
            cursor: 'pointer',
            fontSize: '14px',
            fontWeight: '500'
          }}
        >
          Dismiss All Toasts
        </button>
      </div>

      <div style={{ marginTop: '30px', padding: '20px', background: '#f9fafb', borderRadius: '8px' }}>
        <h3 style={{ color: '#374151', marginBottom: '15px' }}>Features:</h3>
        <ul style={{ color: '#6b7280', lineHeight: '1.6' }}>
          <li>✨ Modern glassmorphism design with blur effects</li>
          <li>🎨 Color-coded toast types (success, error, warning, info)</li>
          <li>👤 Support for user avatars and profile pictures</li>
          <li>🔗 Clickable toasts with navigation links</li>
          <li>📱 Responsive design for mobile and desktop</li>
          <li>🌙 Dark mode support</li>
          <li>⚡ Smooth animations and transitions</li>
          <li>🎯 Customizable auto-close timers</li>
          <li>🔧 Utility functions for easy implementation</li>
        </ul>
      </div>
    </div>
  );
};

export default ToastDemo;

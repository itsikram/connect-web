import React, { useRef } from 'react';
import './LudoInviteToast.css';

const LudoInviteToast = ({ 
  inviterName, 
  inviterAvatar, 
  onAccept, 
  onDecline, 
  closeToast 
}) => {
  const isClosingRef = useRef(false);

  // Safe wrapper for closeToast to prevent errors and multiple calls
  const safeCloseToast = () => {
    if (isClosingRef.current) {
      return; // Already closing, prevent multiple calls
    }
    
    isClosingRef.current = true;
    
    // The closeToast function from toastUtils is already wrapped safely
    // Just call it directly, but prevent multiple calls
    try {
      if (closeToast && typeof closeToast === 'function') {
        closeToast();
      }
    } catch (error) {
      // Silently ignore errors - the wrapper in toastUtils should handle this
      if (process.env.NODE_ENV === 'development') {
        console.warn('Error closing toast (ignored):', error);
      }
    }
    
    // Reset after a short delay
    setTimeout(() => {
      isClosingRef.current = false;
    }, 200);
  };

  return (
    <div className="ludo-invite-toast">
      <button 
        className="ludo-invite-toast__close-btn" 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          safeCloseToast();
        }}
        aria-label="Close"
      >
        ×
      </button>
      
      <div className="ludo-invite-toast__content">
        <div className="ludo-invite-toast__avatar">
          {inviterAvatar ? (
            <img src={inviterAvatar} alt={inviterName} />
          ) : (
            <div className="ludo-invite-toast__avatar-placeholder">🎲</div>
          )}
        </div>
        
        <div className="ludo-invite-toast__text">
          <div className="ludo-invite-toast__title">Game Invitation</div>
          <div className="ludo-invite-toast__message">
            {inviterName} invited you to play Ludo!
          </div>
        </div>
      </div>
      
      <div className="ludo-invite-toast__actions">
        <button 
          className="ludo-invite-toast__btn ludo-invite-toast__btn--accept"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              if (onAccept && typeof onAccept === 'function') {
                onAccept();
              }
            } catch (error) {
              console.error('Error in onAccept:', error);
            }
            safeCloseToast();
          }}
        >
          Accept
        </button>
        <button 
          className="ludo-invite-toast__btn ludo-invite-toast__btn--decline"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            try {
              if (onDecline && typeof onDecline === 'function') {
                onDecline();
              }
            } catch (error) {
              console.error('Error in onDecline:', error);
            }
            safeCloseToast();
          }}
        >
          Decline
        </button>
      </div>
    </div>
  );
};

export default LudoInviteToast;

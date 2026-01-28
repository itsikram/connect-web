import React from 'react';
import './LudoInviteToast.css';

const LudoInviteToast = ({ 
  inviterName, 
  inviterAvatar, 
  onAccept, 
  onDecline, 
  closeToast 
}) => {
  return (
    <div className="ludo-invite-toast">
      <button 
        className="ludo-invite-toast__close-btn" 
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          if (closeToast) closeToast();
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
            onAccept();
            closeToast();
          }}
        >
          Accept
        </button>
        <button 
          className="ludo-invite-toast__btn ludo-invite-toast__btn--decline"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onDecline();
            closeToast();
          }}
        >
          Decline
        </button>
      </div>
    </div>
  );
};

export default LudoInviteToast;

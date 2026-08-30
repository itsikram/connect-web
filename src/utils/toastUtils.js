import { toast } from 'react-toastify';
import CustomToast from '../components/Toast/CustomToast';
import LudoInviteToast from '../components/Toast/LudoInviteToast';

// Toast configuration
const toastConfig = {
  position: "top-center",
  autoClose: 5000,
  hideProgressBar: false,
  closeOnClick: true,
  pauseOnHover: false,
  draggable: true,
  progress: undefined,
  className: 'custom-toast-notification',
  bodyClassName: 'custom-toast-body',
  progressClassName: 'custom-toast-progress',
  icon: false,
  pauseOnFocusLoss: false
};

// Safety: ensure dismissal even if pause behavior interferes
const scheduleAutoDismiss = (toastId, delayMs) => {
  if (typeof delayMs === 'number' && delayMs > 0) {
    setTimeout(() => {
      try { toast.dismiss(toastId); } catch (_) {}
    }, delayMs + 50);
  }
};

// Success toast
export const showSuccessToast = (message, options = {}) => {
  const { title, avatar, link, autoClose = 5000 } = options;

  const id = toast.success(
    ({ closeToast, ...toastProps }) => (
      <CustomToast 
        type="success"
        title={title}
        message={message}
        avatar={avatar}
        link={link}
        showAvatar={!!avatar}
        closeToast={closeToast}
        toastProps={{ ...toastProps, autoClose }}
      />
    ), 
    { 
      ...toastConfig, 
      autoClose,
      className: 'custom-toast-success'
    }
  );
  scheduleAutoDismiss(id, autoClose);
};

// Error toast
export const showErrorToast = (message, options = {}) => {
  const { title, avatar, link, autoClose = 5000 } = options;

  const id = toast.error(
    <CustomToast 
      type="error"
      title={title}
      message={message}
      avatar={avatar}
      link={link}
      showAvatar={!!avatar}
    />, 
    { 
      ...toastConfig, 
      autoClose,
      className: 'custom-toast-error'
    }
  );
  scheduleAutoDismiss(id, autoClose);
};

// Warning toast
export const showWarningToast = (message, options = {}) => {
  const { title, avatar, link, autoClose = 5000 } = options;

  const id = toast.warning(
    <CustomToast 
      type="warning"
      title={title}
      message={message}
      avatar={avatar}
      link={link}
      showAvatar={!!avatar}
    />, 
    { 
      ...toastConfig, 
      autoClose,
      className: 'custom-toast-warning'
    }
  );
  scheduleAutoDismiss(id, autoClose);
};

// Info toast
export const showInfoToast = (message, options = {}) => {
  const { title, avatar, link, autoClose = 5000 } = options;

  const id = toast.info(
    <CustomToast 
      type="info"
      title={title}
      message={message}
      avatar={avatar}
      link={link}
      showAvatar={!!avatar}
    />, 
    { 
      ...toastConfig, 
      autoClose,
      className: 'custom-toast-info'
    }
  );
  scheduleAutoDismiss(id, autoClose);
};

// Message toast (for notifications with user avatar)
export const showMessageToast = (message, senderName, senderAvatar, link, options = {}) => {
  const { autoClose = 5000, toastId } = options;

  const id = toast.info(
    ({ closeToast, ...toastProps }) => (
      <CustomToast 
        type="info"
        title={senderName}
        message={message}
        avatar={senderAvatar}
        link={link}
        showAvatar={true}
        showIcon={false}
        closeToast={closeToast}
        toastProps={{ ...toastProps, autoClose }}
      />
    ), 
    { 
      ...toastConfig, 
      autoClose,
      toastId,
      className: 'custom-toast-message'
    }
  );
  scheduleAutoDismiss(id, autoClose);
};

// Profile update toast
export const showProfileUpdateToast = (message, profileName, profileAvatar, link = '', options = {}) => {
  const { autoClose = 5000 } = options;

  const id = toast.success(
    ({ closeToast, ...toastProps }) => (
      <CustomToast 
        type="success"
        title={profileName}
        message={message}
        avatar={profileAvatar}
        link={link}
        showAvatar={true}
        showIcon={true}
        closeToast={closeToast}
        toastProps={{ ...toastProps, autoClose }}
      />
    ), 
    { 
      ...toastConfig, 
      autoClose,
      className: 'custom-toast-profile-update'
    }
  );
  scheduleAutoDismiss(id, autoClose);
};

// Video saved toast
export const showVideoSavedToast = (caption, authorAvatar, link, options = {}) => {
  const { autoClose = 5000 } = options;

  const id = toast.success(
    <CustomToast 
      type="success"
      title="Video Saved"
      message={`${caption} saved to videos`}
      avatar={authorAvatar}
      link={link}
      showAvatar={true}
      showIcon={true}
    />, 
    { 
      ...toastConfig, 
      autoClose,
      className: 'custom-toast-video-saved'
    }
  );
  scheduleAutoDismiss(id, autoClose);
};

// Custom toast with full control
export const showCustomToast = (type, message, options = {}) => {
  const { 
    title, 
    avatar, 
    link, 
    icon, 
    showAvatar = false, 
    showIcon = true, 
    autoClose = 5000 
  } = options;
  
  const toastFunction = toast[type] || toast;
  
  const id = toastFunction(
    <CustomToast 
      type={type}
      title={title}
      message={message}
      avatar={avatar}
      link={link}
      icon={icon}
      showAvatar={showAvatar}
      showIcon={showIcon}
    />, 
    { 
      ...toastConfig, 
      autoClose,
      className: `custom-toast-${type}`
    }
  );
  scheduleAutoDismiss(id, autoClose);
};

// Ludo game invitation toast with accept/decline buttons
export const showLudoInviteToast = (inviterName, inviterAvatar, onAccept, onDecline, options = {}) => {
  // Don't auto-dismiss invitation toasts - let user decide
  const { autoClose = false } = options;

  const id = toast.info(
    ({ closeToast }) => {
      // Create a safe close function that defers the call to prevent race conditions
      const safeClose = () => {
        try {
          if (closeToast && typeof closeToast === 'function') {
            // Use requestAnimationFrame to defer the close call
            // This helps prevent race conditions with react-toastify's internal state
            // where it might try to access properties on an already-removed toast
            requestAnimationFrame(() => {
              try {
                closeToast();
              } catch (error) {
                // If closeToast fails, try dismissing by ID as fallback
                try {
                  toast.dismiss(id);
                } catch (dismissError) {
                  // Silently ignore - toast might already be closed
                  if (process.env.NODE_ENV === 'development') {
                    console.warn('Error dismissing toast (ignored):', dismissError);
                  }
                }
              }
            });
          } else {
            // Fallback to dismissing by ID if closeToast is not available
            toast.dismiss(id);
          }
        } catch (error) {
          // Silently ignore errors
          if (process.env.NODE_ENV === 'development') {
            console.warn('Error closing toast (ignored):', error);
          }
        }
      };

      return (
        <LudoInviteToast 
          inviterName={inviterName}
          inviterAvatar={inviterAvatar}
          onAccept={onAccept}
          onDecline={onDecline}
          closeToast={safeClose}
        />
      );
    }, 
    { 
      ...toastConfig, 
      autoClose, // false means don't auto-dismiss
      className: 'custom-toast-ludo-invite',
      closeOnClick: false, // Prevent accidental dismissal
      pauseOnHover: true, // Allow user to pause while reading
      draggable: false, // Prevent accidental dismissal
    }
  );
  
  return id;
};

export const showChessInviteToast = (inviterName, inviterAvatar, onAccept, onDecline, options = {}) => {
  const { autoClose = false } = options;

  const id = toast.info(
    ({ closeToast }) => {
      const safeClose = () => {
        try {
          if (closeToast && typeof closeToast === 'function') {
            requestAnimationFrame(() => {
              try {
                closeToast();
              } catch (error) {
                try {
                  toast.dismiss(id);
                } catch (dismissError) {
                  if (process.env.NODE_ENV === 'development') {
                    console.warn('Error dismissing toast (ignored):', dismissError);
                  }
                }
              }
            });
          } else {
            toast.dismiss(id);
          }
        } catch (error) {
          if (process.env.NODE_ENV === 'development') {
            console.warn('Error closing toast (ignored):', error);
          }
        }
      };

      return (
        <LudoInviteToast 
          inviterName={inviterName}
          inviterAvatar={inviterAvatar}
          onAccept={onAccept}
          onDecline={onDecline}
          closeToast={safeClose}
          gameName="Chess"
          placeholderEmoji="♟️"
          variant="chess"
        />
      );
    }, 
    { 
      ...toastConfig, 
      autoClose,
      className: 'custom-toast-chess-invite',
      closeOnClick: false,
      pauseOnHover: true,
      draggable: false,
    }
  );
  
  return id;
};

// Dismiss all toasts
export const dismissAllToasts = () => {
  toast.dismiss();
};

// Dismiss specific toast by ID
export const dismissToast = (toastId) => {
  toast.dismiss(toastId);
};

export default {
  success: showSuccessToast,
  error: showErrorToast,
  warning: showWarningToast,
  info: showInfoToast,
  message: showMessageToast,
  profileUpdate: showProfileUpdateToast,
  videoSaved: showVideoSavedToast,
  ludoInvite: showLudoInviteToast,
  chessInvite: showChessInviteToast,
  custom: showCustomToast,
  dismissAll: dismissAllToasts,
  dismiss: dismissToast
};

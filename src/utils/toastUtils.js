import { toast } from 'react-toastify';
import CustomToast from '../components/Toast/CustomToast';

// Toast configuration
const toastConfig = {
  position: "top-right",
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
  const { autoClose = 5000 } = options;

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
  custom: showCustomToast,
  dismissAll: dismissAllToasts,
  dismiss: dismissToast
};

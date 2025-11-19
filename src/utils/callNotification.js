/**
 * Call Notification Utility
 * Shows browser notifications for incoming calls
 */

import webNotificationService from '../services/webNotificationService';
import config from '../config/config.json';

let activeCallNotification = null;

/**
 * Show browser notification for incoming call
 * @param {Object} options - Notification options
 * @param {string} options.callerName - Name of the caller
 * @param {string} options.callerProfilePic - Profile picture URL of the caller
 * @param {string} options.callType - Type of call ('video' or 'audio')
 * @param {Function} options.onClick - Callback when notification is clicked
 */
export const showCallNotification = async ({ callerName, callerProfilePic, callType = 'video', onClick }) => {
    // Check if notifications are supported
    if (!('Notification' in window)) {
        console.warn('Browser notifications are not supported');
        return null;
    }

    // Check permission
    let permission = Notification.permission;
    
    // Request permission if not already granted or denied
    if (permission === 'default') {
        try {
            permission = await Notification.requestPermission();
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            return null;
        }
    }

    // Don't show notification if permission is denied
    if (permission !== 'granted') {
        console.warn('Notification permission not granted');
        return null;
    }

    // Close any existing call notification
    if (activeCallNotification) {
        activeCallNotification.close();
        activeCallNotification = null;
    }

    const callTypeText = callType === 'video' ? 'Video Call' : 'Audio Call';
    const icon = callerProfilePic || config?.logo || '/logo192.png';

    try {
        // Create notification
        const notification = new Notification(`${callerName || 'Someone'} is calling you`, {
            body: `Incoming ${callTypeText}`,
            icon: icon,
            badge: config?.logo || '/logo192.png',
            tag: `incoming-call-${callType}-${Date.now()}`,
            requireInteraction: true, // Keep notification visible until user interacts
            silent: false, // Play notification sound
            vibrate: [200, 100, 200], // Vibrate pattern (if supported)
            data: {
                type: 'incoming-call',
                callType: callType,
                callerName: callerName
            }
        });

        // Handle click event
        notification.onclick = (event) => {
            event.preventDefault();
            
            // Focus the window/tab
            window.focus();
            
            // Call the onClick callback if provided
            if (onClick && typeof onClick === 'function') {
                onClick();
            }
            
            // Close the notification
            notification.close();
            activeCallNotification = null;
        };

        // Handle close event
        notification.onclose = () => {
            activeCallNotification = null;
        };

        // Store reference to active notification
        activeCallNotification = notification;

        // Auto close after 30 seconds (if call is still ringing)
        setTimeout(() => {
            if (activeCallNotification === notification) {
                notification.close();
                activeCallNotification = null;
            }
        }, 30000);

        return notification;
    } catch (error) {
        console.error('Error showing call notification:', error);
        return null;
    }
};

/**
 * Close active call notification
 */
export const closeCallNotification = () => {
    if (activeCallNotification) {
        activeCallNotification.close();
        activeCallNotification = null;
    }
};

/**
 * Check if notification permission is granted
 */
export const hasNotificationPermission = () => {
    return 'Notification' in window && Notification.permission === 'granted';
};

/**
 * Request notification permission
 */
export const requestNotificationPermission = async () => {
    if (!('Notification' in window)) {
        return false;
    }

    if (Notification.permission === 'granted') {
        return true;
    }

    if (Notification.permission === 'denied') {
        return false;
    }

    try {
        const permission = await Notification.requestPermission();
        return permission === 'granted';
    } catch (error) {
        console.error('Error requesting notification permission:', error);
        return false;
    }
};


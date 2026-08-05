/**
 * Call Notification Utility
 * Shows browser / service-worker notifications for incoming calls
 * with Accept / Reject actions where the platform supports them.
 */

import webNotificationService from '../services/webNotificationService';
import config from '../config/config.json';

let activeCallNotification = null;
const CALL_NOTIFICATION_TAG = 'incoming-call-active';

const CALL_ACTIONS = [
    { action: 'accept_call', title: 'Accept' },
    { action: 'reject_call', title: 'Reject' },
];

/**
 * Show browser notification for incoming call
 * @param {Object} options - Notification options
 * @param {string} options.callerName - Name of the caller
 * @param {string} options.callerProfilePic - Profile picture URL of the caller
 * @param {string} options.callType - Type of call ('video' or 'audio')
 * @param {Object} [options.callData] - Call payload for accept/reject (from, channelName, …)
 * @param {Function} options.onClick - Callback when notification is clicked
 */
export const showCallNotification = async ({
    callerName,
    callerProfilePic,
    callType = 'video',
    callData = {},
    onClick,
}) => {
    if (!('Notification' in window)) {
        console.warn('Browser notifications are not supported');
        return null;
    }

    // Web Push already shows the system alert for installed iOS/PWA — avoid duplicates
    if (webNotificationService.hasActivePushSubscription?.()) {
        return null;
    }

    let permission = Notification.permission;

    if (permission === 'default') {
        try {
            permission = await Notification.requestPermission();
        } catch (error) {
            console.error('Error requesting notification permission:', error);
            return null;
        }
    }

    if (permission !== 'granted') {
        console.warn('Notification permission not granted');
        return null;
    }

    await closeCallNotification();

    const callTypeText = callType === 'video' ? 'Video Call' : 'Audio Call';
    const icon = callerProfilePic || config?.logo || '/logo192.png';
    const ringtone = config?.defaultRingtone || '/assets/audio/default-ringtone.mp3';
    const isAudio = callType === 'audio';
    const payloadData = {
        type: 'incoming_call',
        callType,
        isAudio: isAudio ? 'true' : 'false',
        callerId: String(callData.from || callData.callerId || ''),
        from: String(callData.from || callData.callerId || ''),
        channelName: callData.channelName || '',
        callerName: callerName || 'Someone',
        callerProfilePic: callerProfilePic || '',
        url: callData.from ? `/message/${callData.from}` : '/',
        link: callData.from ? `/message/${callData.from}` : '/',
    };

    const title = `${callerName || 'Someone'} is calling you`;
    const options = {
        body: `Incoming ${callTypeText}`,
        icon,
        badge: config?.logo || '/logo192.png',
        tag: CALL_NOTIFICATION_TAG,
        requireInteraction: true,
        silent: false,
        sound: ringtone,
        vibrate: [200, 100, 200, 100, 200],
        renotify: true,
        actions: CALL_ACTIONS,
        data: payloadData,
    };

    try {
        // Action buttons only work via Service Worker notifications
        const registration =
            (await navigator.serviceWorker?.ready?.catch?.(() => null)) ||
            (await navigator.serviceWorker?.getRegistration?.('/'));

        if (registration?.showNotification) {
            await registration.showNotification(title, options);
            activeCallNotification = { tag: CALL_NOTIFICATION_TAG, viaSw: true };

            if (typeof onClick === 'function') {
                // Body click is handled in sw.js; keep optional focus callback via message
                const onMsg = (event) => {
                    const msg = event.data || {};
                    if (msg.type === 'INCOMING_CALL_PUSH' || msg.type === 'INCOMING_CALL_ACTION') {
                        onClick();
                    }
                };
                navigator.serviceWorker?.addEventListener?.('message', onMsg, { once: true });
            }

            setTimeout(() => {
                closeCallNotification();
            }, 30000);

            return activeCallNotification;
        }

        // Fallback: page Notification API (no action buttons)
        const notification = new Notification(title, {
            body: options.body,
            icon: options.icon,
            badge: options.badge,
            tag: options.tag,
            requireInteraction: true,
            silent: false,
            vibrate: options.vibrate,
            data: payloadData,
        });

        notification.onclick = (event) => {
            event.preventDefault();
            window.focus();
            if (onClick && typeof onClick === 'function') onClick();
            notification.close();
            activeCallNotification = null;
        };

        notification.onclose = () => {
            activeCallNotification = null;
        };

        activeCallNotification = notification;

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
export const closeCallNotification = async () => {
    try {
        if (activeCallNotification && !activeCallNotification.viaSw && activeCallNotification.close) {
            activeCallNotification.close();
        }
        activeCallNotification = null;

        const registration =
            (await navigator.serviceWorker?.ready?.catch?.(() => null)) ||
            (await navigator.serviceWorker?.getRegistration?.('/'));
        if (registration?.getNotifications) {
            const notes = await registration.getNotifications({ tag: CALL_NOTIFICATION_TAG });
            notes.forEach((n) => n.close());
            // Also close tagged push call notifications
            const all = await registration.getNotifications();
            all.forEach((n) => {
                const t = n.data?.type || n.tag || '';
                if (t === 'incoming_call' || String(n.tag || '').startsWith('incoming-call')) {
                    n.close();
                }
            });
        }
    } catch (_) {
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

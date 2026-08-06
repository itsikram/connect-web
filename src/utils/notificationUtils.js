import api from '../api/api';

// Send notification to specific browser IDs
export const sendNotificationToBrowsers = async (profileId, browserIds, notificationData) => {
    try {
        const response = await api.post('/web-notification/send-to-browsers', {
            profileId,
            browserIds,
            notificationData
        });
        
        return response.data;
    } catch (error) {
        console.error('Error sending notification to browsers:', error);
        throw error;
    }
};

// Send notification to all browsers of a profile
export const sendNotificationToAllBrowsers = async (profileId, notificationData) => {
    try {
        const response = await api.post('/web-notification/send-to-all-browsers', {
            profileId,
            notificationData
        });
        
        return response.data;
    } catch (error) {
        console.error('Error sending notification to all browsers:', error);
        throw error;
    }
};

// Get browser IDs for a profile
export const getBrowserIds = async (profileId) => {
    try {
        const response = await api.get(`/web-notification/browser-ids/${profileId}`);
        return response.data;
    } catch (error) {
        console.error('Error getting browser IDs:', error);
        throw error;
    }
};

// Update browser activity
export const updateBrowserActivity = async (profileId, browserId) => {
    try {
        const response = await api.post('/web-notification/update-activity', {
            profileId,
            browserId
        });
        return response.data;
    } catch (error) {
        console.error('Error updating browser activity:', error);
        throw error;
    }
};

// Helper function to create notification data
export const createNotificationData = (options = {}) => {
    return {
        title: options.title || 'Connect App',
        text: options.text || 'New notification',
        icon: options.icon || '/logo192.png',
        link: options.link || '/',
        type: options.type || 'general',
        data: options.data || {},
        image: options.image,
        requireInteraction: options.requireInteraction || false,
        silent: options.silent || false,
        vibrate: options.vibrate || [200, 100, 200]
    };
};

const VALID_POST_LINK = /^\/post\/([a-f0-9]{24})$/i;
const OBJECT_ID_IN_TEXT = /([a-f0-9]{24})/i;

function extractPostId(value) {
    if (value == null || value === '') return '';
    if (typeof value === 'object' && value._id != null) {
        return String(value._id);
    }
    const str = String(value);
    if (/^[a-f0-9]{24}$/i.test(str)) return str;
    const match = str.match(OBJECT_ID_IN_TEXT);
    return match ? match[1] : '';
}

/** Resolve a safe in-app path for notification clicks */
export function getNotificationLink(notification) {
    const link = String(notification?.link || '').trim();
    const data = notification?.data && typeof notification.data === 'object' ? notification.data : {};
    const postId = extractPostId(data.postId);

    if (VALID_POST_LINK.test(link)) return link;

    if (link.startsWith('/post/')) {
        if (postId) return `/post/${postId}`;
        const match = link.match(OBJECT_ID_IN_TEXT);
        if (match) return `/post/${match[1]}`;
    }

    if (postId) return `/post/${postId}`;

    return link || '/';
}

/** Title + description lines for the header notification dropdown */
export function getNotificationDisplayParts(notification) {
    if (!notification) {
        return { title: 'Notification', description: '' };
    }

    const text = String(notification.text || '').trim();
    const storedTitle = String(notification.title || '').trim();
    const data = notification.data && typeof notification.data === 'object' ? notification.data : {};
    const type = notification.type || '';

    const dataDescription =
        data.commentBody ||
        data.replyBody ||
        data.replyMsg ||
        data.message ||
        data.body ||
        '';

    if (dataDescription) {
        return {
            title: text || storedTitle || 'Notification',
            description: String(dataDescription).trim(),
        };
    }

    if (type === 'message' && text.includes(': ')) {
        const idx = text.indexOf(': ');
        const sender = text.slice(0, idx).trim();
        const message = text.slice(idx + 2).trim();
        if (message) {
            return {
                title: sender || storedTitle || 'Message',
                description: message,
            };
        }
    }

    if (storedTitle && text && storedTitle !== text) {
        return { title: storedTitle, description: text };
    }

    return {
        title: text || storedTitle || 'Notification',
        description: '',
    };
}

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

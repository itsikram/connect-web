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
    const storyId = extractPostId(data.storyId);
    const senderId = data.senderId ? String(data.senderId) : '';

    if (VALID_POST_LINK.test(link)) return link;

    if (link.startsWith('/post/')) {
        if (postId) return `/post/${postId}`;
        const match = link.match(OBJECT_ID_IN_TEXT);
        if (match) return `/post/${match[1]}`;
    }

    if (link.startsWith('/story/') || notification?.type === 'storyComment' || notification?.type === 'storyReact') {
        if (storyId) return `/story/${storyId}`;
        const match = link.match(OBJECT_ID_IN_TEXT);
        if (match) return `/story/${match[1]}`;
        if (link.startsWith('/story/')) return link;
    }

    if (postId) return `/post/${postId}`;

    if ((notification?.type === 'friendReq' || notification?.type === 'friendReqAccept') && senderId) {
        return `/${senderId}`;
    }

    if (notification?.type === 'chess_invite') {
        const gameId = data.gameId || notification?.gameId;
        return gameId
            ? `/chess-game?gameId=${encodeURIComponent(String(gameId))}`
            : '/chess-game';
    }

    if (notification?.type === 'ludo_invite') {
        return '/ludo-game';
    }

    return link || '/';
}

const TYPE_META = {
    postComment: { label: 'Comment', icon: 'fas fa-comment', color: '#45BD62' },
    storyComment: { label: 'Story comment', icon: 'fas fa-comment', color: '#45BD62' },
    commentReact: { label: 'Reaction', icon: 'fas fa-thumbs-up', color: '#2078F4' },
    postCommentReply: { label: 'Reply', icon: 'fas fa-reply', color: '#45BD62' },
    commentReply: { label: 'Reply', icon: 'fas fa-reply', color: '#45BD62' },
    postReact: { label: 'Reaction', icon: 'fas fa-thumbs-up', color: '#2078F4' },
    storyReact: { label: 'Story reaction', icon: 'fas fa-heart', color: '#F33E58' },
    friendReq: { label: 'Friend request', icon: 'fas fa-user-plus', color: '#2078F4' },
    friendReqAccept: { label: 'Friend', icon: 'fas fa-user-check', color: '#2078F4' },
    message: { label: 'Message', icon: 'fas fa-comment-alt', color: '#2078F4' },
    general: { label: 'Update', icon: 'fas fa-bell', color: '#F7B928' },
    test: { label: 'Update', icon: 'fas fa-bell', color: '#F7B928' },
    ludo_invite: { label: 'Ludo Invite', icon: 'fas fa-dice', color: '#8B5CF6' },
    chess_invite: { label: 'Chess Invite', icon: 'fas fa-chess', color: '#2E7D32' },
};

const REACT_ICONS = {
    like: { icon: 'fas fa-thumbs-up', color: '#2078F4' },
    love: { icon: 'fas fa-heart', color: '#F33E58' },
    haha: { icon: 'fas fa-laugh', color: '#F7B928' },
    wow: { icon: 'fas fa-surprise', color: '#F7B928' },
    sad: { icon: 'fas fa-sad-tear', color: '#F7B928' },
    angry: { icon: 'fas fa-angry', color: '#E9710F' },
};

function inferType(notification, data) {
    const type = notification?.type || '';
    if (type && type !== 'postCommentReply') return type;

    // Legacy: post/story reacts were saved as postCommentReply
    if (data.reactType && data.postId) return 'postReact';
    if (data.reactType && data.storyId) return 'storyReact';
    if (data.reactType && String(notification?.text || '').toLowerCase().includes('story')) return 'storyReact';
    if (data.reactType) return 'postReact';
    if (data.replyBody || data.replyMsg) return 'commentReply';
    if (data.commentBody) return 'postComment';
    return type || 'general';
}

/**
 * Rich display fields for Facebook-style notification rows.
 * Returns: actorName, headline, description, typeMeta, avatar, reactMeta
 */
export function getNotificationDisplayParts(notification) {
    if (!notification) {
        return {
            title: 'Notification',
            headline: 'Notification',
            description: '',
            actorName: '',
            typeMeta: TYPE_META.general,
            avatar: '',
            reactMeta: null,
        };
    }

    const text = String(notification.text || '').trim();
    const storedTitle = String(notification.title || '').trim();
    const data = notification.data && typeof notification.data === 'object' ? notification.data : {};
    const type = inferType(notification, data);
    const actorName = String(data.senderName || '').trim();
    const avatar = data.senderProfilePic || notification.icon || '';

    const dataDescription =
        data.commentBody ||
        data.replyBody ||
        data.replyMsg ||
        data.message ||
        data.body ||
        '';

    let typeMeta = { ...(TYPE_META[type] || TYPE_META.general) };
    let reactMeta = null;
    if (data.reactType) {
        reactMeta = REACT_ICONS[String(data.reactType).toLowerCase()] || REACT_ICONS.like;
        typeMeta = { ...typeMeta, icon: reactMeta.icon, color: reactMeta.color, label: String(data.reactType) };
    }

    let headline = text || storedTitle || 'Notification';

    // Prefer structured headlines when we know the actor + type
    if (actorName) {
        switch (type) {
            case 'postComment':
                headline = `${actorName} commented on your post`;
                break;
            case 'storyComment':
                headline = `${actorName} commented on your story`;
                break;
            case 'commentReact':
                headline = `${actorName} reacted to your comment`;
                break;
            case 'postCommentReply':
            case 'commentReply':
                headline = `${actorName} replied to your comment`;
                break;
            case 'postReact':
                headline = `${actorName} reacted to your post`;
                break;
            case 'storyReact':
                headline = `${actorName} reacted to your story`;
                break;
            case 'friendReq':
                headline = `${actorName} sent you a friend request`;
                break;
            case 'friendReqAccept':
                headline = `${actorName} accepted your friend request`;
                break;
            case 'message':
                headline = actorName;
                break;
            default:
                if (!text.includes(actorName)) {
                    headline = text || `${actorName} sent you a notification`;
                }
        }
    } else if (type === 'message' && text.includes(': ')) {
        const idx = text.indexOf(': ');
        return {
            title: text.slice(0, idx).trim() || storedTitle || 'Message',
            headline: text.slice(0, idx).trim() || storedTitle || 'Message',
            description: text.slice(idx + 2).trim(),
            actorName: text.slice(0, idx).trim(),
            typeMeta,
            avatar,
            reactMeta,
        };
    }

    const description = dataDescription
        ? String(dataDescription).trim()
        : (storedTitle && text && storedTitle !== text && storedTitle !== 'Connect' ? text : '');

    return {
        title: headline,
        headline,
        description,
        actorName,
        typeMeta,
        avatar,
        reactMeta,
        type,
    };
}

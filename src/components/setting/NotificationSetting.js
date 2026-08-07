import React, { useCallback, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import api from '../../api/api';
import { loadSettings } from '../../services/actions/settingsActions';
import { showSuccessToast, showErrorToast } from '../../utils/toastUtils';

const NOTIFICATION_DEFAULTS = {
    friendRequestReceived: true,
    friendRequestAccepted: true,
    newMessageReceived: true,
    newFriendPost: true,
    newFriendStory: true,
    newFriendWatch: true,
    friendRequestReceivedEmail: false,
    friendRequestAcceptedEmail: false,
    newMessageReceivedEmail: false,
    newFriendPostEmail: false,
    newFriendStoryEmail: false,
    newFriendWatchEmail: false,
};

const PUSH_TOGGLES = [
    { key: 'friendRequestReceived', label: 'Friend Request Received', help: 'Get notified when someone sends you a friend request' },
    { key: 'friendRequestAccepted', label: 'Friend Request Accepted', help: 'Get notified when someone accepts your friend request' },
    { key: 'newMessageReceived', label: 'New Message Received', help: 'Get notified when you receive a new message' },
    { key: 'newFriendPost', label: "New Friend's Post", help: 'Get notified when your friends create new posts' },
    { key: 'newFriendStory', label: "New Friend's Story", help: 'Get notified when your friends share new stories' },
    { key: 'newFriendWatch', label: "New Friend's Watch", help: 'Get notified when your friends share new watch content' },
];

const EMAIL_TOGGLES = [
    { key: 'friendRequestReceivedEmail', label: 'Friend Request Received', help: 'Get email notifications for new friend requests' },
    { key: 'friendRequestAcceptedEmail', label: 'Friend Request Accepted', help: 'Get email notifications when friend requests are accepted' },
    { key: 'newMessageReceivedEmail', label: 'New Message Received', help: 'Get email notifications for new messages' },
    { key: 'newFriendPostEmail', label: "New Friend's Post", help: 'Get email notifications for new friend posts' },
    { key: 'newFriendStoryEmail', label: "New Friend's Story", help: 'Get email notifications for new friend stories' },
    { key: 'newFriendWatchEmail', label: "New Friend's Watch", help: 'Get email notifications for new friend watch content' },
];

const NotificationSetting = () => {
    const dispatch = useDispatch();
    const reduxSettings = useSelector((state) => state.setting);
    const [notificationSettings, setNotificationSettings] = useState(NOTIFICATION_DEFAULTS);
    const [isSaving, setIsSaving] = useState(false);
    const [isUnregistering, setIsUnregistering] = useState(false);

    useEffect(() => {
        setNotificationSettings({
            friendRequestReceived: reduxSettings.friendRequestReceived ?? true,
            friendRequestAccepted: reduxSettings.friendRequestAccepted ?? true,
            newMessageReceived: reduxSettings.newMessageReceived ?? true,
            newFriendPost: reduxSettings.newFriendPost ?? true,
            newFriendStory: reduxSettings.newFriendStory ?? true,
            newFriendWatch: reduxSettings.newFriendWatch ?? true,
            friendRequestReceivedEmail: reduxSettings.friendRequestReceivedEmail ?? false,
            friendRequestAcceptedEmail: reduxSettings.friendRequestAcceptedEmail ?? false,
            newMessageReceivedEmail: reduxSettings.newMessageReceivedEmail ?? false,
            newFriendPostEmail: reduxSettings.newFriendPostEmail ?? false,
            newFriendStoryEmail: reduxSettings.newFriendStoryEmail ?? false,
            newFriendWatchEmail: reduxSettings.newFriendWatchEmail ?? false,
        });
    }, [reduxSettings]);

    const handleToggle = (key) => {
        setNotificationSettings((prev) => ({
            ...prev,
            [key]: !prev[key],
        }));
    };

    const handleSave = async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const res = await api.post('/setting/update', notificationSettings);
            if (res.status === 200) {
                dispatch(loadSettings(res.data));
                showSuccessToast('Notification settings saved');
            }
        } catch (error) {
            console.error('Error saving notification settings:', error);
            showErrorToast('Failed to save notification settings');
        } finally {
            setIsSaving(false);
        }
    };

    const handleUnregisterAllDevices = useCallback(async () => {
        const confirmed = window.confirm(
            'Unregister all browsers and devices for notifications? This will unregister all other devices except the current one.'
        );
        if (!confirmed) return;

        setIsUnregistering(true);
        try {
            await api.post('/web-notification/unregister-all-browsers');
            await api.post('/notification/token/unregister-all-others', { currentToken: '' });
            showSuccessToast('All other devices have been unregistered for notifications.');
        } catch (error) {
            console.error('Failed to unregister devices', error);
            showErrorToast('Failed to unregister devices. Please try again.');
        } finally {
            setIsUnregistering(false);
        }
    }, []);

    const renderToggle = ({ key, label, help }) => (
        <div className="form-check form-switch my-3" key={key}>
            <input
                type="checkbox"
                className="form-check-input"
                id={key}
                checked={Boolean(notificationSettings[key])}
                onChange={() => handleToggle(key)}
            />
            <label className="form-check-label" htmlFor={key}>{label}</label>
            <br />
            <small className="form-text text-muted">{help}</small>
        </div>
    );

    return (
        <div className="message-setting">
            <div className="setting-field-container">
                <h3>Notification Settings</h3>
                <p className="setting-section-desc">Choose which alerts you get on Connect and by email.</p>
                <form onSubmit={handleSave}>
                    <h4 className="mb-2">Push Notifications</h4>
                    {PUSH_TOGGLES.map(renderToggle)}

                    <button
                        type="button"
                        className="btn btn-danger mb-3"
                        onClick={handleUnregisterAllDevices}
                        disabled={isUnregistering}
                    >
                        {isUnregistering ? 'Unregistering…' : 'Unregister all browsers & devices'}
                    </button>

                    <hr />

                    <h4 className="text-center">Email Notifications</h4>
                    {EMAIL_TOGGLES.map(renderToggle)}

                    <button type="submit" className="btn btn-primary" disabled={isSaving}>
                        {isSaving ? 'Saving…' : 'Save Settings'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default NotificationSetting;

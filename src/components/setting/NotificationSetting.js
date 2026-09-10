import React, { useCallback, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import api from '../../api/api';
import { loadSettings } from '../../services/actions/settingsActions';
import { showSuccessToast, showErrorToast } from '../../utils/toastUtils';

const NOTIFICATION_DEFAULTS = {
    connectRequestReceived: true,
    connectRequestAccepted: true,
    newMessageReceived: true,
    newConnectPost: true,
    newConnectStory: true,
    newConnectWatch: true,
    connectRequestReceivedEmail: false,
    connectRequestAcceptedEmail: false,
    newMessageReceivedEmail: false,
    newConnectPostEmail: false,
    newConnectStoryEmail: false,
    newConnectWatchEmail: false,
};

const PUSH_TOGGLES = [
    { key: 'connectRequestReceived', label: 'Connect Request Received', help: 'Get notified when someone sends you a connect request' },
    { key: 'connectRequestAccepted', label: 'Connect Request Accepted', help: 'Get notified when someone accepts your connect request' },
    { key: 'newMessageReceived', label: 'New Message Received', help: 'Get notified when you receive a new message' },
    { key: 'newConnectPost', label: "New Connect's Post", help: 'Get notified when your connects create new posts' },
    { key: 'newConnectStory', label: "New Connect's Story", help: 'Get notified when your connects share new stories' },
    { key: 'newConnectWatch', label: "New Connect's Watch", help: 'Get notified when your connects share new watch content' },
];

const EMAIL_TOGGLES = [
    { key: 'connectRequestReceivedEmail', label: 'Connect Request Received', help: 'Get email notifications for new connect requests' },
    { key: 'connectRequestAcceptedEmail', label: 'Connect Request Accepted', help: 'Get email notifications when connect requests are accepted' },
    { key: 'newMessageReceivedEmail', label: 'New Message Received', help: 'Get email notifications for new messages' },
    { key: 'newConnectPostEmail', label: "New Connect's Post", help: 'Get email notifications for new connect posts' },
    { key: 'newConnectStoryEmail', label: "New Connect's Story", help: 'Get email notifications for new connect stories' },
    { key: 'newConnectWatchEmail', label: "New Connect's Watch", help: 'Get email notifications for new connect watch content' },
];

const NotificationSetting = () => {
    const dispatch = useDispatch();
    const reduxSettings = useSelector((state) => state.setting);
    const [notificationSettings, setNotificationSettings] = useState(NOTIFICATION_DEFAULTS);
    const [isSaving, setIsSaving] = useState(false);
    const [isUnregistering, setIsUnregistering] = useState(false);

    useEffect(() => {
        setNotificationSettings({
            connectRequestReceived: reduxSettings.connectRequestReceived ?? true,
            connectRequestAccepted: reduxSettings.connectRequestAccepted ?? true,
            newMessageReceived: reduxSettings.newMessageReceived ?? true,
            newConnectPost: reduxSettings.newConnectPost ?? true,
            newConnectStory: reduxSettings.newConnectStory ?? true,
            newConnectWatch: reduxSettings.newConnectWatch ?? true,
            connectRequestReceivedEmail: reduxSettings.connectRequestReceivedEmail ?? false,
            connectRequestAcceptedEmail: reduxSettings.connectRequestAcceptedEmail ?? false,
            newMessageReceivedEmail: reduxSettings.newMessageReceivedEmail ?? false,
            newConnectPostEmail: reduxSettings.newConnectPostEmail ?? false,
            newConnectStoryEmail: reduxSettings.newConnectStoryEmail ?? false,
            newConnectWatchEmail: reduxSettings.newConnectWatchEmail ?? false,
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
            <div className="form-check-label-group">
                <label className="form-check-label" htmlFor={key}>{label}</label>
                <small className="form-text text-muted">{help}</small>
            </div>
        </div>
    );

    return (
        <div className="message-setting">
            <div className="setting-field-container">
                <h3>Notification Settings</h3>
                <p className="setting-section-desc">Choose which alerts you get on Connect and by email.</p>
                <form onSubmit={handleSave}>
                    <div className="notification-section">
                        <h4 className="mb-2">Push Notifications</h4>
                        {PUSH_TOGGLES.map(renderToggle)}
                    </div>

                    <button
                        type="button"
                        className="btn btn-danger mb-3"
                        onClick={handleUnregisterAllDevices}
                        disabled={isUnregistering}
                    >
                        {isUnregistering ? 'Unregistering…' : 'Unregister all browsers & devices'}
                    </button>

                    <hr />

                    <div className="notification-section">
                        <h4 className="text-center">Email Notifications</h4>
                        {EMAIL_TOGGLES.map(renderToggle)}
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={isSaving}>
                        {isSaving ? 'Saving…' : 'Save Settings'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default NotificationSetting;

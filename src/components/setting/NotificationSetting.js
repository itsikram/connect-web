import React, { useCallback, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import api from '../../api/api';
import { loadSettings } from '../../services/actions/settingsActions';
import { showSuccessToast, showErrorToast } from '../../utils/toastUtils';
import webNotificationService from '../../services/webNotificationService';

const NOTIFICATION_DEFAULTS = {
    connectRequestReceived: true,
    connectRequestAccepted: true,
    newMessageReceived: true,
    connectRequestReceivedEmail: false,
    connectRequestAcceptedEmail: false,
    newMessageReceivedEmail: false,
};

const PUSH_TOGGLES = [
    { key: 'connectRequestReceived', label: 'Connect Request Received', help: 'Get notified when someone sends you a connect request' },
    { key: 'connectRequestAccepted', label: 'Connect Request Accepted', help: 'Get notified when someone accepts your connect request' },
    { key: 'newMessageReceived', label: 'New Message Received', help: 'Get notified when you receive a new message' },
];

const EMAIL_TOGGLES = [
    { key: 'connectRequestReceivedEmail', label: 'Connect Request Received', help: 'Get email notifications for new connect requests' },
    { key: 'connectRequestAcceptedEmail', label: 'Connect Request Accepted', help: 'Get email notifications when connect requests are accepted' },
    { key: 'newMessageReceivedEmail', label: 'Unread Messages', help: "Get an email when messages stay unread for a while" },
];

const NotificationSetting = () => {
    const dispatch = useDispatch();
    const reduxSettings = useSelector((state) => state.setting);
    const profileId = useSelector((state) => state.profile?._id);
    const [notificationSettings, setNotificationSettings] = useState(NOTIFICATION_DEFAULTS);
    const [isSaving, setIsSaving] = useState(false);
    const [isUnregistering, setIsUnregistering] = useState(false);

    useEffect(() => {
        setNotificationSettings(
            Object.fromEntries(
                Object.entries(NOTIFICATION_DEFAULTS).map(([key, fallback]) => [
                    key,
                    reduxSettings[key] ?? fallback,
                ]),
            ),
        );
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
            'Stop notifications on all your other browsers and devices? This browser keeps getting them.'
        );
        if (!confirmed) return;

        setIsUnregistering(true);
        try {
            await api.post('/web-notification/unregister-all-browsers');
            await api.post('/notification/token/unregister-all-others', { currentToken: '' });
            // The calls above clear every browser, including this one; add this one back.
            if (profileId) {
                await webNotificationService.registerBrowserId(profileId, api).catch(() => {});
            }
            showSuccessToast('All other devices have been unregistered for notifications.');
        } catch (error) {
            console.error('Failed to unregister devices', error);
            showErrorToast('Failed to unregister devices. Please try again.');
        } finally {
            setIsUnregistering(false);
        }
    }, [profileId]);

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

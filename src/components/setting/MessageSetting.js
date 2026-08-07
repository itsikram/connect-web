import React, { useCallback, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { loadSettings } from '../../services/actions/settingsActions';
import api from '../../api/api';
import { showSuccessToast, showErrorToast } from '../../utils/toastUtils';

const MessageSetting = () => {
    const dispatch = useDispatch();
    const settings = useSelector((state) => state.setting);
    const [isUpdating, setIsUpdating] = useState(false);

    const handleShareFaceModeChange = useCallback(async (e) => {
        const isChecked = e.currentTarget.checked;
        setIsUpdating(true);
        try {
            const updateSetting = await api.post('setting/update', { isShareEmotion: isChecked });
            if (updateSetting.status === 200) {
                dispatch(loadSettings(updateSetting.data));
                showSuccessToast('Message settings updated');
            }
        } catch (error) {
            console.error('Error updating settings:', error);
            showErrorToast('Failed to update message settings');
        } finally {
            setIsUpdating(false);
        }
    }, [dispatch]);

    const handleShowTypingChange = useCallback(async (e) => {
        const isChecked = e.currentTarget.checked;
        setIsUpdating(true);
        try {
            const updateSetting = await api.post('setting/update', { showIsTyping: isChecked });
            if (updateSetting.status === 200) {
                dispatch(loadSettings(updateSetting.data));
                showSuccessToast('Message settings updated');
            }
        } catch (error) {
            console.error('Error updating settings:', error);
            showErrorToast('Failed to update message settings');
        } finally {
            setIsUpdating(false);
        }
    }, [dispatch]);

    return (
        <div className="message-setting">
            <div className="setting-field-container">
                <h3>Message Settings</h3>
                <p className="setting-section-desc">Control messaging delivery and chat preferences.</p>
                <div>
                    <div className="form-check form-switch my-3">
                        <input
                            checked={settings.showIsTyping === true}
                            type="checkbox"
                            onChange={handleShowTypingChange}
                            className="form-check-input"
                            id="showTyping"
                            disabled={isUpdating}
                        />
                        <label className="form-check-label" htmlFor="showTyping">Show Typing</label>
                        <br />
                        <small className="form-text text-muted">
                            Show your typing indicator to friends before you send a message
                        </small>
                    </div>

                    <div className="form-check form-switch my-3">
                        <input
                            checked={settings.isShareEmotion === true}
                            type="checkbox"
                            onChange={handleShareFaceModeChange}
                            className="form-check-input"
                            id="shareEmotionCheck"
                            disabled={isUpdating}
                        />
                        <label className="form-check-label" htmlFor="shareEmotionCheck">Share Face Mode</label>
                        <br />
                        <small className="form-text text-muted">
                            Allow Connect to use your camera to recognize your mood during calls
                        </small>
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MessageSetting;

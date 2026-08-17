import React, { useCallback, useState, useRef } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { loadSettings } from '../../services/actions/settingsActions';
import api from '../../api/api';
import { showSuccessToast, showErrorToast } from '../../utils/toastUtils';
import defaultChatBackground from '../../assets/images/default-chat-bg.svg';

const MessageSetting = () => {
    const dispatch = useDispatch();
    const settings = useSelector((state) => state.setting);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isUploadingBackground, setIsUploadingBackground] = useState(false);
    const backgroundInputRef = useRef(null);

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

    const handleBackgroundChange = useCallback(async (e) => {
        const file = e.currentTarget.files?.[0];
        if (!file) return;

        // Validate file type
        if (!file.type.startsWith('image/')) {
            showErrorToast('Please select a valid image file');
            return;
        }

        // Validate file size (max 5MB)
        if (file.size > 5 * 1024 * 1024) {
            showErrorToast('Image must be less than 5MB');
            return;
        }

        setIsUploadingBackground(true);
        try {
            const formData = new FormData();
            formData.append('chatBackground', file);

            console.log('📸 Uploading background image:', {
                name: file.name,
                size: file.size,
                type: file.type
            });
            
            const updateSetting = await api.post('setting/update', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });
            
            console.log('✅ Response received:', {
                status: updateSetting.status,
                statusText: updateSetting.statusText,
                data: updateSetting.data
            });
            
            if (updateSetting.status === 200) {
                console.log('🎉 Settings updated successfully');
                console.log('Chat background URL:', updateSetting.data?.chatBackground);
                console.log('Full settings data:', updateSetting.data);
                
                dispatch(loadSettings(updateSetting.data));
                showSuccessToast('Chat background updated successfully');
            } else {
                console.warn('⚠️ Unexpected response status:', updateSetting.status);
                showErrorToast('Unexpected response from server');
            }
        } catch (error) {
            console.error('❌ Error uploading background:', error);
            console.error('Error response status:', error.response?.status);
            console.error('Error response data:', error.response?.data);
            console.error('Error message:', error.message);
            showErrorToast('Failed to upload chat background');
        } finally {
            setIsUploadingBackground(false);
            // Reset input
            if (backgroundInputRef.current) {
                backgroundInputRef.current.value = '';
            }
        }
    }, [dispatch]);

    const handleRemoveBackground = useCallback(async () => {
        setIsUploadingBackground(true);
        try {
            const updateSetting = await api.post('setting/update', { chatBackground: null });
            if (updateSetting.status === 200) {
                dispatch(loadSettings(updateSetting.data));
                showSuccessToast('Chat background removed');
            }
        } catch (error) {
            console.error('Error removing background:', error);
            showErrorToast('Failed to remove chat background');
        } finally {
            setIsUploadingBackground(false);
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
                        <div className="form-check-label-group">
                            <label className="form-check-label" htmlFor="showTyping">Show Typing</label>
                            <small className="form-text text-muted">
                                Show your typing indicator to friends before you send a message
                            </small>
                        </div>
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
                        <div className="form-check-label-group">
                            <label className="form-check-label" htmlFor="shareEmotionCheck">Share Face Mode</label>
                            <small className="form-text text-muted">
                                Allow Connect to use your camera to recognize your mood during calls
                            </small>
                        </div>
                    </div>

                    <div className="my-3">
                        <label htmlFor="chatBackground" className="form-label d-block mb-2">
                            <strong>Chat Background</strong>
                        </label>
                        <small className="form-text text-muted d-block mb-2">
                            Upload an image to display as your chat background (Max 5MB, PNG, JPG, GIF, WebP). If you don't upload one, a default background will be used.
                        </small>

                        <div className="d-flex gap-2 align-items-center">
                            <input
                                ref={backgroundInputRef}
                                type="file"
                                accept="image/*"
                                onChange={handleBackgroundChange}
                                className="form-control"
                                id="chatBackground"
                                disabled={isUploadingBackground}
                                style={{ maxWidth: '300px' }}
                            />
                            {settings.chatBackground && (
                                <button
                                    type="button"
                                    className="btn btn-sm btn-outline-danger"
                                    onClick={handleRemoveBackground}
                                    disabled={isUploadingBackground}
                                >
                                    Remove & Use Default
                                </button>
                            )}
                        </div>

                        <div className="mt-3">
                            <div className="chat-background-preview" style={{ maxWidth: '200px' }}>
                                <img
                                    src={settings.chatBackground || defaultChatBackground}
                                    alt="Chat Background Preview"
                                    style={{
                                        maxWidth: '100%',
                                        maxHeight: '150px',
                                        borderRadius: '4px',
                                        objectFit: 'cover',
                                        border: settings.chatBackground ? '2px solid #2196F3' : '2px solid #ccc'
                                    }}
                                />
                                <small className="d-block mt-2 text-muted">
                                    {settings.chatBackground ? '✓ Custom background' : '📌 Default background'}
                                </small>
                            </div>
                        </div>

                        {isUploadingBackground && (
                            <small className="d-block mt-2 text-info">
                                <span className="spinner-border spinner-border-sm me-2" role="status" aria-hidden="true"></span>
                                Uploading...
                            </small>
                        )}
                    </div>
                </div>
            </div>
        </div>
    );
};

export default MessageSetting;

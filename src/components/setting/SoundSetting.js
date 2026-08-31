import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import api from '../../api/api';
import { loadSettings } from '../../services/actions/settingsActions';
import ringtones from '../../config/ringtones.json';
import { normalizeRingtoneId } from '../../utils/normalizeRingtoneId';
import audioPreloader from '../../utils/audioPreloader';
import { showSuccessToast, showErrorToast } from '../../utils/toastUtils';

const PREVIEW_MS = 4000;

const SoundSetting = () => {
    const oldSettings = useSelector((state) => state.setting);
    const dispatch = useDispatch();
    const [settings, setSettings] = useState({ ringtone: normalizeRingtoneId(oldSettings.ringtone) });
    const [isSaving, setIsSaving] = useState(false);
    const [isPreviewing, setIsPreviewing] = useState(false);
    const previewAudioRef = useRef(null);
    const previewTimerRef = useRef(null);

    const stopPreview = useCallback(() => {
        if (previewTimerRef.current) {
            clearTimeout(previewTimerRef.current);
            previewTimerRef.current = null;
        }
        const audio = previewAudioRef.current;
        previewAudioRef.current = null;
        if (audio) {
            try {
                audio.pause();
                audio.currentTime = 0;
            } catch (_) {}
        }
        setIsPreviewing(false);
    }, []);

    const playRingtonePreview = useCallback((ringtoneId) => {
        stopPreview();
        const audio = audioPreloader.getRingtone(ringtoneId);
        if (!audio) return;

        audio.loop = false;
        audio.muted = false;
        audio.volume = 1;
        try {
            audio.currentTime = 0;
        } catch (_) {}

        previewAudioRef.current = audio;
        setIsPreviewing(true);

        const handleEnded = () => {
            if (previewAudioRef.current === audio) stopPreview();
        };
        audio.addEventListener('ended', handleEnded, { once: true });

        const playPromise = audio.play();
        if (playPromise?.catch) {
            playPromise.catch((error) => {
                console.warn('Ringtone preview failed:', error);
                stopPreview();
            });
        }

        previewTimerRef.current = setTimeout(() => {
            if (previewAudioRef.current === audio) stopPreview();
        }, PREVIEW_MS);
    }, [stopPreview]);

    useEffect(() => {
        setSettings({ ringtone: normalizeRingtoneId(oldSettings.ringtone) });
    }, [oldSettings.ringtone]);

    useEffect(() => () => stopPreview(), [stopPreview]);

    const handleInputChange = useCallback((e) => {
        const { name, value } = e.target;
        const nextValue = name === 'ringtone' ? normalizeRingtoneId(value) : value;
        setSettings((prev) => ({
            ...prev,
            [name]: nextValue,
        }));
        if (name === 'ringtone') {
            playRingtonePreview(nextValue);
        }
    }, [playRingtonePreview]);

    const handleSettingSubmitBtnClick = useCallback(async (e) => {
        e.preventDefault();
        stopPreview();
        setIsSaving(true);
        try {
            const payload = {
                ringtone: normalizeRingtoneId(settings.ringtone),
            };
            const updateSetting = await api.post('setting/update', payload);
            if (updateSetting.status === 200) {
                dispatch(loadSettings(updateSetting.data));
                showSuccessToast('Sound settings saved');
            }
        } catch (error) {
            console.error('Error updating settings:', error);
            showErrorToast('Failed to save sound settings');
        } finally {
            setIsSaving(false);
        }
    }, [settings.ringtone, dispatch, stopPreview]);

    return (
        <div className="profile-setting">
            <div className="setting-field-container">
                <h3>Sound Settings</h3>
                <p className="setting-section-desc">Choose which sounds play for calls, messages, and alerts.</p>
                <form onSubmit={handleSettingSubmitBtnClick}>
                    <div className="form-group mb-2">
                        <label htmlFor="ringTone">Calling Ringtones</label>
                        <div className="input-group email-input-group">
                            <select
                                value={String(settings.ringtone)}
                                onChange={handleInputChange}
                                className="form-control"
                                name="ringtone"
                                id="ringTone"
                            >
                                {ringtones.map((ringtone, index) => (
                                    <option key={`${ringtone.id}-${index}`} value={String(ringtone.id)}>
                                        {ringtone.name}
                                    </option>
                                ))}
                            </select>
                            <button
                                type="button"
                                className="btn btn-primary email-edit-btn"
                                onClick={() => {
                                    if (isPreviewing) stopPreview();
                                    else playRingtonePreview(settings.ringtone);
                                }}
                                aria-label={isPreviewing ? 'Stop ringtone preview' : 'Play ringtone preview'}
                                title={isPreviewing ? 'Stop preview' : 'Play preview'}
                            >
                                <i
                                    className={`fas ${isPreviewing ? 'fa-stop' : 'fa-play'}`}
                                    aria-hidden="true"
                                />
                            </button>
                        </div>
                        <small className="form-text">
                            {isPreviewing
                                ? 'Playing preview…'
                                : 'Changing a ringtone plays a short preview.'}
                        </small>
                    </div>

                    <button type="submit" className="btn btn-primary" disabled={isSaving}>
                        {isSaving ? 'Saving…' : 'Save Settings'}
                    </button>
                </form>
            </div>
        </div>
    );
};

export default SoundSetting;

import React, { useCallback, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import api from '../../api/api';
import { loadSettings } from '../../services/actions/settingsActions';
import ringtones from '../../config/ringtones.json';
import { normalizeRingtoneId } from '../../utils/normalizeRingtoneId';
import { showSuccessToast, showErrorToast } from '../../utils/toastUtils';

const SoundSetting = () => {
    const oldSettings = useSelector((state) => state.setting);
    const dispatch = useDispatch();
    const [settings, setSettings] = useState({ ringtone: normalizeRingtoneId(oldSettings.ringtone) });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        setSettings({ ringtone: normalizeRingtoneId(oldSettings.ringtone) });
    }, [oldSettings.ringtone]);

    const handleInputChange = useCallback((e) => {
        const { name, value } = e.target;
        setSettings((prev) => ({
            ...prev,
            [name]: name === 'ringtone' ? normalizeRingtoneId(value) : value,
        }));
    }, []);

    const handleSettingSubmitBtnClick = useCallback(async (e) => {
        e.preventDefault();
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
    }, [settings.ringtone, dispatch]);

    return (
        <div className="profile-setting">
            <div className="setting-field-container">
                <h3>Sound Settings</h3>
                <p className="setting-section-desc">Choose which sounds play for calls, messages, and alerts.</p>
                <form onSubmit={handleSettingSubmitBtnClick}>
                    <div className="form-group mb-2">
                        <label htmlFor="ringTone">Calling Ringtones</label>
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

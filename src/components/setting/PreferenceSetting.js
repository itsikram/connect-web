import React, { useCallback, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import api from '../../api/api';
import { loadSettings } from '../../services/actions/settingsActions';
import { applyThemeMode } from '../../utils/applyThemeMode';
import { showSuccessToast, showErrorToast } from '../../utils/toastUtils';

const PreferenceSetting = () => {
    const oldSettings = useSelector((state) => state.setting);
    const dispatch = useDispatch();
    const [settings, setSettings] = useState({ themeMode: oldSettings.themeMode || 'dark' });
    const [isSaving, setIsSaving] = useState(false);

    useEffect(() => {
        if (oldSettings?.themeMode) {
            setSettings({ themeMode: oldSettings.themeMode });
        }
    }, [oldSettings?.themeMode]);

    const handleInputChange = useCallback((e) => {
        const { name, value } = e.target;
        setSettings((prev) => ({ ...prev, [name]: value }));
    }, []);

    const handleSettingSubmitBtnClick = useCallback(async (e) => {
        e.preventDefault();
        setIsSaving(true);
        try {
            const updateSetting = await api.post('setting/update', { ...settings });
            if (updateSetting.status === 200) {
                dispatch(loadSettings(updateSetting.data));
                applyThemeMode(settings.themeMode);
                showSuccessToast('Preference settings saved');
            }
        } catch (error) {
            console.error('Error updating settings:', error);
            showErrorToast('Failed to save preference settings');
        } finally {
            setIsSaving(false);
        }
    }, [settings, dispatch]);

    return (
        <div className="profile-setting">
            <div className="setting-field-container">
                <h3>Preference Settings</h3>
                <p className="setting-section-desc">Customize how Connect looks and feels for you.</p>
                <form onSubmit={handleSettingSubmitBtnClick}>
                    <div className="form-group mb-2">
                        <label htmlFor="themeMode">Theme Mode</label>
                        <select
                            value={settings.themeMode || 'dark'}
                            onChange={handleInputChange}
                            className="form-control"
                            name="themeMode"
                            id="themeMode"
                        >
                            <option value="default">Default</option>
                            <option value="dark">Dark</option>
                            <option value="light">Light</option>
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

export default PreferenceSetting;

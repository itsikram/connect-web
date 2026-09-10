import React, { useState, useEffect } from 'react';
import { useSelector } from 'react-redux';
import api from '../../api/api';
import { showSuccessToast, showErrorToast } from '../../utils/toastUtils';

const PrivacySetting = () => {
    const profile = useSelector(state => state.profile);
    const [settings, setSettings] = useState({
        postVisibility: 'public',
        connectRequestVisibility: 'public',
        timelinePostVisibility: 'public',
        isShareLocation: true,
    });
    const [loading, setLoading] = useState(false);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        const fetchSettings = async () => {
            if (!profile?._id) return;
            try {
                setLoading(true);
                const res = await api.get('/setting', { params: { profileId: profile._id } });
                if (res.status === 200 && res.data) {
                    setSettings(prev => ({
                        ...prev,
                        postVisibility: res.data.postVisibility || 'public',
                        connectRequestVisibility: res.data.connectRequestVisibility || 'public',
                        timelinePostVisibility: res.data.timelinePostVisibility || 'public',
                        isShareLocation: res.data.isShareLocation !== false,
                    }));
                }
            } catch (error) {
                console.error('Error fetching settings:', error);
            } finally {
                setLoading(false);
            }
        };
        fetchSettings();

        const onAgentSettings = (event) => {
            const patch = event?.detail || {};
            setSettings((prev) => ({
                ...prev,
                ...(patch.postVisibility != null ? { postVisibility: patch.postVisibility } : {}),
                ...(patch.connectRequestVisibility != null
                    ? { connectRequestVisibility: patch.connectRequestVisibility }
                    : {}),
                ...(patch.timelinePostVisibility != null
                    ? { timelinePostVisibility: patch.timelinePostVisibility }
                    : {}),
                ...(patch.isShareLocation != null
                    ? { isShareLocation: patch.isShareLocation }
                    : {}),
            }));
        };
        window.addEventListener('connect:settings-updated', onAgentSettings);
        return () => window.removeEventListener('connect:settings-updated', onAgentSettings);
    }, [profile?._id]);

    const handleSave = async (e) => {
        e.preventDefault();
        if (!profile?._id) return;
        try {
            setSaving(true);
            const res = await api.post('/setting/update', settings);
            if (res.status === 200) {
                showSuccessToast('Privacy settings saved successfully!');
            }
        } catch (error) {
            console.error('Error saving settings:', error);
            showErrorToast('Failed to save privacy settings');
        } finally {
            setSaving(false);
        }
    };

    const handleLocationSharingToggle = async (e) => {
        const newValue = e.target.checked;
        setSettings(prev => ({ ...prev, isShareLocation: newValue }));
        // Auto-save location sharing setting
        if (profile?._id) {
            try {
                await api.post('/setting/update', { isShareLocation: newValue });
            } catch (error) {
                console.error('Error updating location sharing setting:', error);
            }
        }
    };

    if (loading) {
        return (
            <div className='profile-setting'>
                <div className='setting-field-container'>
                    <p>Loading settings...</p>
                </div>
            </div>
        );
    }

    return (
        <>
            <div className='profile-setting'>
                <div className='setting-field-container'>
                    <h3>Privacy Settings</h3>
                    <p className="setting-section-desc">Control who can see your posts, timeline, and location.</p>
                    <form onSubmit={handleSave}>

                        <div className="form-group mb-2">
                            <label htmlFor="postVisibility">Who Can See your Posts?</label>
                            <select 
                                className='form-control'
                                id="postVisibility"
                                value={settings.postVisibility}
                                onChange={(e) => setSettings(prev => ({ ...prev, postVisibility: e.target.value }))}
                            >
                                <option value='om'>Only Me</option>
                                <option value='fof'>Connect of Connects</option>
                                <option value='public'>Public</option>
                            </select>
                        </div>
                        <div className="form-group mb-2">
                            <label htmlFor="connectRequestVisibility">Who Can Send you Connect Request?</label>
                            <select 
                                className='form-control'
                                id="connectRequestVisibility"
                                value={settings.connectRequestVisibility}
                                onChange={(e) => setSettings(prev => ({ ...prev, connectRequestVisibility: e.target.value }))}
                            >
                                <option value='om'>Only Me</option>
                                <option value='fof'>Connect of Connects</option>
                                <option value='public'>Public</option>
                            </select>
                        </div>
                        <div className="form-group mb-2">
                            <label htmlFor="timelinePostVisibility">Who Can Post on your Timeline?</label>
                            <select 
                                className='form-control'
                                id="timelinePostVisibility"
                                value={settings.timelinePostVisibility}
                                onChange={(e) => setSettings(prev => ({ ...prev, timelinePostVisibility: e.target.value }))}
                            >
                                <option value='om'>Only Me</option>
                                <option value='fof'>Connect of Connects</option>
                                <option value='public'>Public</option>
                            </select>
                        </div>

                        <div className="form-group mb-2">
                            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '12px', backgroundColor: '#222324', borderRadius: '8px' }}>
                                <div>
                                    <label htmlFor="isShareLocation" style={{ margin: 0, fontWeight: '500' }}>
                                        Share Location with Connects
                                    </label>
                                    <p style={{ margin: '4px 0 0 0', fontSize: '14px', color: '#666' }}>
                                        Allow connects to see your real-time location in the info modal
                                    </p>
                                </div>
                                <div className="form-check form-switch">
                                    <input
                                        className="form-check-input"
                                        type="checkbox"
                                        id="isShareLocation"
                                        checked={settings.isShareLocation}
                                        onChange={handleLocationSharingToggle}
                                        style={{ width: '50px', height: '25px', cursor: 'pointer' }}
                                    />
                                </div>
                            </div>
                        </div>

                        <button type="submit" className="btn btn-primary" disabled={saving}>
                            {saving ? 'Saving...' : 'Save Settings'}
                        </button>
                    </form>
                </div>
            </div>
        </>
    );
}

export default PrivacySetting;

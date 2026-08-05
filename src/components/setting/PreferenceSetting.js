import React, { useCallback, useEffect, useState } from 'react';
import { useSelector,useDispatch } from 'react-redux';
import api from '../../api/api';
import { loadSettings } from '../../services/actions/settingsActions';


const PreferenceSetting = () => {

    let oldSettings = useSelector(state => state.setting)
    let dispatch = useDispatch()
    let [settings, setSettings] = useState({themeMode: oldSettings.themeMode || 'dark'})
    let [isSaving, setIsSaving] = useState(false)


    let handleInputChange = useCallback(async (e) => {
        let name = e.target.name
        let value = e.target.value
        setSettings(settings => {
            return {
                ...settings,
                [name] : value
            }
        })

    },[settings])

    // useEffect(() => {
    //     if(oldSettings.themeMode) {
    //         return alert(oldSettings.themeMode)
    //     setSettings()

    //     }
    // }, [oldSettings])

    let handleSettingSubmitBtnClick = useCallback(async (e) => {
        e.preventDefault();
        setIsSaving(true)
        try {
            let updateSetting = await api.post('setting/update', { ...settings })
            if (updateSetting.status == 200) {
                dispatch(loadSettings(updateSetting.data))
            }
        } catch (error) {
            console.log('Error updating settings:', error)
        } finally {
            setIsSaving(false)
        }
    },[])
    return (
        <>
            <div className='profile-setting'>
                <div className='setting-field-container'>
                    <h3>Preference Settings</h3>
                    <p className="setting-section-desc">Customize how Connect looks and feels for you.</p>
                    <form>
                        <div className="form-group mb-2">
                            <label for="themeMode">Theme Mode</label>
                            <select value={settings.themeMode || 'dark'} onChange={handleInputChange.bind(this)} className='form-control' name='themeMode' id='themeMode'>
                                <option value='default'>Default</option>
                                <option value='dark'>Dark</option>
                                <option value='light'>Light</option>
                            </select>
                        </div>

                        <button onClick={handleSettingSubmitBtnClick.bind(this)} type="submit" className="btn btn-primary">Save Settings</button>
                    </form>
                </div>
            </div>
        </>
    );
}

export default PreferenceSetting;

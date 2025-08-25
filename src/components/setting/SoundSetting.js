import React, { useCallback, useEffect, useState } from 'react';
import { useSelector, useDispatch } from 'react-redux';
import api from '../../api/api';
import { loadSettings } from '../../services/actions/settingsActions';
import ringtones from '../../config/ringtones.json'

const SoundSetting = () => {

    let oldSettings = useSelector(state => state.setting)
    let dispatch = useDispatch()
    let [settings, setSettings] = useState({ ringtone: oldSettings.ringtone})


    useEffect(() => {
        if (oldSettings.ringtone > 0) {
            setSettings({ringtone :oldSettings.ringtone || 1})
            // alert(settings.ringtone)
        }
    }, [oldSettings])


    let handleInputChange = useCallback(async (e) => {
        let name = e.target.name
        let value = e.target.value
        setSettings(settings => {
            return {
                ...settings,
                [name]: value
            }
        })

    },[settings])


    let handleSettingSubmitBtnClick = useCallback(async (e) => {
        e.preventDefault();
        let updateSetting = await api.post('setting/update', { ...settings })
        if (updateSetting.status == 200) {
            dispatch(loadSettings(updateSetting.data))
        }
    },[settings, oldSettings])
    return (
        <>
            <div className='profile-setting'>
                <div className='setting-field-container'>
                    <h3 className='text-center'>Sound Settings</h3>
                    <form>
                        <div className="form-group mb-2">
                            <label for="ringTone">Calling Ringtones</label>
                            <select value={settings.ringtone} onChange={handleInputChange.bind(this)} className='form-control' name='ringtone' id='ringTone'>
                                {ringtones.map((ringtone, index) => {
                                    return <option key={index} value={`${ringtone.id}`}>{ringtone.name}</option>

                                })}

                            </select>
                        </div>

                        <button onClick={handleSettingSubmitBtnClick.bind(this)} type="submit" className="btn btn-primary">Save Settings</button>
                    </form>
                </div>
            </div>
        </>
    );
}

export default SoundSetting;

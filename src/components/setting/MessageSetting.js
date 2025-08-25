import React, {useState, useEffect, useCallback} from 'react';
import { useSelector, useDispatch } from 'react-redux';
import { setModeShare, loadSettings } from '../../services/actions/settingsActions';
import api from '../../api/api';
import EmojiPicker from 'emoji-picker-react';


const MessageSetting = () => {

    let dispatch = useDispatch();
    let settings = useSelector(state => state.setting)

    let handleShareFaceModeChange = useCallback(async (e) => {
        let isChecked = e.currentTarget.checked
        // alert(isChecked)
        let updateSetting = await api.post('setting/update', { isShareEmotion: isChecked })
        if (updateSetting.status == 200) {
            dispatch(loadSettings(updateSetting.data))
        }
    },[settings])

    let handleShowTypingChange = useCallback(async(e) => {
        let isChecked = e.currentTarget.checked
        let updateSetting = await api.post('setting/update', { showIsTyping: isChecked })
        if (updateSetting.status == 200) {
            dispatch(loadSettings(updateSetting.data))
        }
    },[settings])

    return (
        <>
            <div className='message-setting'>
                <div className='setting-field-container'>
                    <h3 className='text-center'>Message Settings</h3>
                    <form>
                        {/* <div className="form-group mb-2">
                            <label for="username">First Name</label>
                            <input type="text" className="form-control" id="firstName" name='firstName' placeholder="Enter Frist Name" />
                        </div> */}
                        {/* <EmojiPicker /> */}
                        <div className="form-check form-switch my-3">
                            <input checked={settings.showIsTyping === true ? true : false} type="checkbox" onChange={handleShowTypingChange.bind(this)} className="form-check-input" id="showTyping" />
                            <label className="form-check-label" for="showTyping">Show Typing</label>
                            <br />
                            <small id="showTypingChangeText" className="form-text text-muted">It will show your typing message to your friends inbox before sending</small>

                        </div>


                        <div className="form-check form-switch my-3">
                            <input checked={settings.isShareEmotion === true ? true : false} type="checkbox" onChange={handleShareFaceModeChange.bind(this)} className="form-check-input" id="shareEmotionCheck" />
                            <label className="form-check-label" for="shareEmotionCheck">Share Face Mode</label>
                            <br />
                            <small id="emailHelp" className="form-text text-muted">We'll access your camera to recognize your mode by scanning your face</small>
                        </div>

                        <button type="submit" className="btn btn-primary">Save Settings</button>
                    </form>
                </div>
            </div>
        </>
    );
}

export default MessageSetting;

import { SET_MODE_SHARE,SET_NOTIFICATION,UPDATE_OPTION,LOAD_SETTINGS } from "../constants/settingConsts";

export const setModeShare = (payload) => {

    return {
        type: SET_MODE_SHARE,
        payload: payload
    }

}

export const setNotification = (payload) => {

}

export const setMessage = (payload) => {

}

export const updateOption = (payload) => {

}

export const loadSettings = (payload) => {

    return {
        type: LOAD_SETTINGS,
        payload
    }

}

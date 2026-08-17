import {GET_PROFILE_REQ,GET_PROFILE_FAILED,GET_PROFILE_SUCCESS} from '../constants/profileConsts'

const PROFILE_STORAGE_KEY = 'cachedProfileData'

const persistProfileToStorage = (profile) => {
    try {
        localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify(profile))
    } catch (error) {
        console.error('Error saving profile to localStorage:', error)
    }
}

export const getCachedProfile = () => {
    try {
        const cachedProfile = localStorage.getItem(PROFILE_STORAGE_KEY)
        return cachedProfile ? JSON.parse(cachedProfile) : null
    } catch (error) {
        console.error('Error reading profile from localStorage:', error)
        return null
    }
}

export const getPorfileReq = () => {
    return {
        type: GET_PROFILE_REQ
    }
}
export const getProfileSuccess = (profileData) => {
    let profilePicUrl = profileData.profilePic
    let coverPicUrl = profileData.coverPic

    let profile = {...profileData, coverPic: coverPicUrl,profilePic: profilePicUrl}
    persistProfileToStorage(profile)
    return {
        type: GET_PROFILE_SUCCESS,
        payload: profile

    }
}
export const getProfileFailed = (error) => {
    return {
        type: GET_PROFILE_FAILED,
        payload: error
    }
}


import {GET_PROFILE_REQ,GET_PROFILE_FAILED,GET_PROFILE_SUCCESS} from '../constants/profileConsts'
import ProfileCacheManager from '../../utils/profileCacheManager'

export const getCachedProfile = () => {
    return ProfileCacheManager.getCachedProfile()
}

export const clearCachedProfile = () => {
    ProfileCacheManager.clearCache()
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
    ProfileCacheManager.setCachedProfile(profile)
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


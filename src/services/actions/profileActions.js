import {GET_PROFILE_REQ,GET_PROFILE_FAILED,GET_PROFILE_SUCCESS} from '../constants/profileConsts'
import ProfileCacheManager from '../../utils/profileCacheManager'

// Only ever the signed-in account's own profile (see profileCacheManager).
export const getCachedProfile = (profileId) => {
    return ProfileCacheManager.getCachedProfile(profileId || undefined)
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
    // Cached by bootCacheMiddleware once merged into the store.
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


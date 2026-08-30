import {GET_PROFILE_REQ,GET_PROFILE_FAILED,GET_PROFILE_SUCCESS} from '../constants/profileConsts'
import {CLEAR_ALL_STATE} from '../constants/authConsts'
import ProfileCacheManager from '../../utils/profileCacheManager'

const getInitialCachedProfile = () => {
    return ProfileCacheManager.getCachedProfile() || {}
}

const cachedProfile = getInitialCachedProfile()

// initial state
const initialProfileState = {
    isLoggedIn: {},
    ...cachedProfile,
    error: null
}


const profileReducer = (state = initialProfileState,action) => {
    switch (action.type) {
        case GET_PROFILE_REQ:
            return {
                ...state,
                isLoading: true
            };
        case GET_PROFILE_SUCCESS:
            return {
                ...state,
                isLoading: false,
                ...action.payload
            }
        case GET_PROFILE_FAILED:
            return {
                ...state,
                isLoading: false,
                error: action.payload
            }
        case CLEAR_ALL_STATE:
            ProfileCacheManager.clearCache()
            return {
                isLoggedIn: {},
                error: null
            }
        default:
            return state
    }
}

export default profileReducer
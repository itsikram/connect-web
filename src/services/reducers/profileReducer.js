import {GET_PROFILE_REQ,GET_PROFILE_FAILED,GET_PROFILE_SUCCESS} from '../constants/profileConsts'
import {CLEAR_ALL_STATE} from '../constants/authConsts'

const PROFILE_STORAGE_KEY = 'cachedProfileData'

const getInitialCachedProfile = () => {
    try {
        const cachedProfile = localStorage.getItem(PROFILE_STORAGE_KEY)
        return cachedProfile ? JSON.parse(cachedProfile) : {}
    } catch (error) {
        console.error('Error reading cached profile from localStorage:', error)
        return {}
    }
}

// initial state
const initialProfileState = {
    isLoggedIn: {},
    profile: getInitialCachedProfile(),
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
            try {
                localStorage.removeItem(PROFILE_STORAGE_KEY)
            } catch (error) {
                console.error('Error clearing cached profile from localStorage:', error)
            }
            return {
                ...initialProfileState,
                profile: {}
            }
        default:
            return state
    }
}

export default profileReducer
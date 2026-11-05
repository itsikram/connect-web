import {GET_PROFILE_REQ,GET_PROFILE_FAILED,GET_PROFILE_SUCCESS} from '../constants/profileConsts'
import {CLEAR_ALL_STATE} from '../constants/authConsts'
import ProfileCacheManager from '../../utils/profileCacheManager'

const emptyProfileState = {
    isLoggedIn: {},
    error: null
}

// Start with the signed-in account's cached profile so the header, menu and
// composer paint at once; Main.js fetches the fresh one right after.
const initialProfileState = {
    ...emptyProfileState,
    ...(ProfileCacheManager.getCachedProfile() || {}),
}

const idOf = (profile) => String(profile?._id || profile?.id || '')

const profileReducer = (state = initialProfileState,action) => {
    switch (action.type) {
        case GET_PROFILE_REQ:
            return {
                ...state,
                isLoading: true
            };
        case GET_PROFILE_SUCCESS: {
            const nextId = idOf(action.payload)
            const currentId = idOf(state)
            // A different account's profile replaces the old one outright, so
            // no field of the previous account survives the merge.
            const base = nextId && currentId && nextId !== currentId ? emptyProfileState : state
            return {
                ...base,
                isLoading: false,
                ...action.payload
            }
        }
        case GET_PROFILE_FAILED:
            return {
                ...state,
                isLoading: false,
                error: action.payload
            }
        case CLEAR_ALL_STATE:
            // bootCacheMiddleware clears the stored copy.
            return { ...emptyProfileState }
        default:
            return state
    }
}

export default profileReducer

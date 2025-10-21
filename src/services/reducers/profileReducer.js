import {GET_PROFILE_REQ,GET_PROFILE_FAILED,GET_PROFILE_SUCCESS} from '../constants/profileConsts'


// initial state
const initialProfileState = {
    isLoggedIn: {},
    profile: {},
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
        default:
            return state
    }
}

export default profileReducer
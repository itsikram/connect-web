import {SET_LOGIN,GET_USER, LOGOUT, CLEAR_ALL_STATE} from '../constants/authConsts'

const initialSate = {
    user: {},
    token: null
}

const authReducer = (state = initialSate,action) => {
    switch (action.type) {

        case SET_LOGIN: {
            return {
                ...state,
                token: action.payload
            }
        }

        case LOGOUT: {

            return {
                token: undefined
            }
        }

        case CLEAR_ALL_STATE: {
            return initialSate
        }

        case GET_USER: 
            return {
                ...state,
                user: action.payload.token
            }
    
        default:
            return state;
    }
}

export default authReducer


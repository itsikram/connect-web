import {SET_LOGIN,LOGOUT,GET_USER, CLEAR_ALL_STATE} from '../constants/authConsts'

export const setLogin = (token) => {

    return {
        type: SET_LOGIN,
        payload: token
    }
} 
export const logOut = () => {

    return {
        type: LOGOUT,
    }
}

export const clearAllState = () => {
    return {
        type: CLEAR_ALL_STATE
    }
}
 
export const getUser = (userData) => {

    return {
        type: GET_USER,
        payload: userData
    }
}
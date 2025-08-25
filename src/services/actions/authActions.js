import {SET_LOGIN,LOGOUT,GET_PROFILE,GET_USER} from '../constants/authConsts'

export const setLogin = (token) => {

    return {
        type: SET_LOGIN,
        payload: token
    }
} 
export const logOut = (token) => {

    return {
        type: LOGOUT,
    }
} 
export const getUser = (userData) => {

    return {
        type: GET_USER,
        payload: userData
    }
}
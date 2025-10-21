import {GET_NOTIFICATION,ADD_NOTIFICATION,ADD_NOTIFICATIONS,VIEW_NOTIFICATION, VIEW_NOTIFICATIONS,DELETE_NOTIFICATIONS} from '../constants/notificationConsts'

export const addNotification = (notification) => {
    return {
        type: ADD_NOTIFICATION,
        payload: notification
    }
} 
export const addNotifications = (notifications,reset=false) => {
    return {
        type: ADD_NOTIFICATIONS,
        payload: notifications,
        reset
    }
} 
export const viewNotification = (notifications) => {
    return {
        type: VIEW_NOTIFICATION,
        payload: notifications
    }
} 
export const viewNotifications = () => {
    return {
        type: VIEW_NOTIFICATIONS,
    }
} 
export const deleteNotifications = () => {
    return {
        type: DELETE_NOTIFICATIONS,
    }
} 
// export const getUser = (userData) => {

//     return {
//         type: GET_USER,
//         payload: userData
//     }
// }
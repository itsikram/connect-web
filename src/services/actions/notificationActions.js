import {
    ADD_NOTIFICATION,
    ADD_NOTIFICATIONS,
    VIEW_NOTIFICATION,
    VIEW_NOTIFICATIONS,
    DELETE_NOTIFICATIONS,
    DELETE_NOTIFICATION,
} from '../constants/notificationConsts'

export const addNotification = (notification) => {
    return {
        type: ADD_NOTIFICATION,
        payload: notification
    }
}

export const addNotifications = (notifications, reset = false) => {
    return {
        type: ADD_NOTIFICATIONS,
        payload: notifications,
        reset
    }
}

export const viewNotification = (notificationId) => {
    return {
        type: VIEW_NOTIFICATION,
        payload: notificationId
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

export const deleteNotification = (notificationId) => {
    return {
        type: DELETE_NOTIFICATION,
        payload: notificationId
    }
}

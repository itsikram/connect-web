import {
    GET_NOTIFICATIONS,
    ADD_NOTIFICATION,
    ADD_NOTIFICATIONS,
    VIEW_NOTIFICATION,
    VIEW_NOTIFICATIONS,
    DELETE_NOTIFICATIONS,
    DELETE_NOTIFICATION,
} from "../constants/notificationConsts";
import { CLEAR_ALL_STATE } from '../constants/authConsts';

let initialState = []

const notificaitonReducer = (state = initialState, action) => {
    switch (action.type) {
        case GET_NOTIFICATIONS:
            return [...state];

        case ADD_NOTIFICATION: {
            const newNotification = action.payload
            if (!newNotification?._id) return state
            const exists = state.some(noti => String(noti._id) === String(newNotification._id))
            if (exists) return state
            return [newNotification, ...state]
        }

        case ADD_NOTIFICATIONS: {
            const newNotifications = Array.isArray(action.payload) ? action.payload : []
            const isReset = action.reset || false

            if (isReset) {
                return [...newNotifications]
            }

            const existingIds = new Set(state.map(n => String(n._id)))
            const toAdd = newNotifications.filter(n => n?._id && !existingIds.has(String(n._id)))
            if (toAdd.length === 0) return state
            return [...toAdd, ...state]
        }

        case VIEW_NOTIFICATION: {
            const notiId = String(action.payload)
            return state.map(noti =>
                String(noti._id) === notiId ? { ...noti, isSeen: true } : noti
            )
        }

        case VIEW_NOTIFICATIONS:
            return state.map(noti => ({ ...noti, isSeen: true }))

        case DELETE_NOTIFICATION: {
            const deleteId = String(action.payload)
            return state.filter(noti => String(noti._id) !== deleteId)
        }

        case DELETE_NOTIFICATIONS:
            return []

        case CLEAR_ALL_STATE:
            return initialState

        default:
            return state
    }
}

export default notificaitonReducer;

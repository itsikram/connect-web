import {ADD_MESSAGE,ADD_MESSAGES,NEW_MESSAGE,SEEN_MESSAGE} from '../constants/messageConsts'

export const addMessage = (message) => {
    return {
        type: ADD_MESSAGE,
        payload: message
    }
} 
export const addMessages = (messages,reset=false) => {
    return {
        type: ADD_MESSAGES,
        payload: messages,
        reset
    }
}

export const newMessage = (message => {
    return {
        type: NEW_MESSAGE,
        payload: message,
    }
})

export const seenMessage = (contactId => {
    return {
        type: SEEN_MESSAGE,
        payload: {contactId},
    }
})

// sendMessage action removed since it's no longer used and was causing errors


// export const viewNotification = (notifications) => {
//     return {
//         type: VIEW_NOTIFICATION,
//         payload: notifications
//     }
// } 
// export const getUser = (userData) => {

//     return {
//         type: GET_USER,
//         payload: userData
//     }
// }
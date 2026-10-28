import {ADD_MESSAGE,ADD_MESSAGES,NEW_MESSAGE,SEEN_MESSAGE,EDIT_MESSAGE} from '../constants/messageConsts'

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

export const newMessage = (message, myProfileId = null) => {
    return {
        type: NEW_MESSAGE,
        payload: message,
        myProfileId: myProfileId,
    }
}

export const seenMessage = (contactId => {
    return {
        type: SEEN_MESSAGE,
        payload: {contactId},
    }
})

// A `messageEdited` socket payload: updates that message's text wherever the
// chat list holds it.
export const messageEdited = (edit) => {
    return {
        type: EDIT_MESSAGE,
        payload: edit,
    }
}

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
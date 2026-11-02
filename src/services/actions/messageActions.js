import {ADD_MESSAGE,ADD_MESSAGES,NEW_MESSAGE,SEEN_MESSAGE,EDIT_MESSAGE,MESSAGE_STATUS,MARK_ALL_READ} from '../constants/messageConsts'

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

// `messagesDelivered` (kind "delivered") or `messageSeen` (kind "seen")
// socket payload, applied to the conversation it belongs to.
export const messageStatusChanged = (kind, data, myProfileId) => {
    return {
        type: MESSAGE_STATUS,
        payload: { kind, data },
        myProfileId,
    }
}

// "Mark all as read": every message I received (or only from senderIds) is seen.
export const allMessagesRead = (myProfileId, senderIds = null) => {
    return {
        type: MARK_ALL_READ,
        payload: { senderIds },
        myProfileId,
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
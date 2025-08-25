import { ADD_MESSAGE, ADD_MESSAGES, NEW_MESSAGE, SEND_MESSAGE, SEEN_MESSAGE } from "../constants/messageConsts";
let initialState = []
const messageReducer = (state = initialState, action) => {
    switch (action.type) {
        // case GET_NOTIFICATIONS:
        //     return [
        //         ...state,
        //     ];
        //     break;

        case ADD_MESSAGE:
            let newMessage = action.payload
            let isMsgExits = state.filter(noti => noti._id === action.payload._id)
            if (isMsgExits.length > 0) return state;
            return [
                newMessage,
                ...state,
            ];
            break;

        case ADD_MESSAGES:
            let newMessages = action.payload
            let isReset = action.reset || false


            if (isReset) {
                return [
                    ...newMessages
                ];
            } else {
                return [

                    ...state,
                    ...newMessages
                ];
            }

            break;

        case NEW_MESSAGE:
            let newMsg = action.payload
            let contactId = newMsg.senderId
            let otherContacts = state.filter(state => state.person._id !== contactId)

            let updatedContact = state.filter(state => state.person._id === contactId)

            updatedContact[0].messages = [newMsg]
            return [
                ...updatedContact,
                ...otherContacts,
            ];

            break;

        case SEEN_MESSAGE:

            let seenContactId = action.payload.contactId
            // alert('s m'+seenContactId)

            let usOtherContacts = state.filter(state => state?.person?._id !== seenContactId)

            let seenContact = state.filter(state => state.person._id === seenContactId)

            if (seenContact.length > 0 && seenContact[0]?.messages.length > 0) {
                console.log('s c', seenContact[0].messages[0])

                seenContact[0].messages[0].isSeen = true

            }

            return [
                ...seenContact,
                ...usOtherContacts,
            ];
            break;

        case SEND_MESSAGE:
            let newMsgSent = action.payload
            let newContactId = newMsgSent.receiverId

            let newOtherContacts = state.filter(state => state.person._id !== newContactId)

            let newUpdatedContact = state.filter(state => state.person._id === newContactId)

            newUpdatedContact[0].messages = [newMsgSent]

            return [
                ...newUpdatedContact,
                ...newOtherContacts,
            ];
            break;

        default:
            return state;
    }
}

export default messageReducer;
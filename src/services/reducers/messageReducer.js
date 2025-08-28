import { ADD_MESSAGE, ADD_MESSAGES, NEW_MESSAGE, SEEN_MESSAGE } from "../constants/messageConsts";
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
            let otherContacts = state.filter(state => state?.person?._id !== contactId)

            let updatedContact = state.filter(state => state?.person?._id === contactId)

            // Check if the contact exists before trying to access its messages
            if (updatedContact.length > 0 && updatedContact[0]) {
                updatedContact[0].messages = [newMsg]
                return [
                    ...updatedContact,
                    ...otherContacts,
                ];
            } else {
                // If contact doesn't exist, create a new contact entry
                // This handles the case where someone messages you for the first time
                console.warn('Contact not found in state for NEW_MESSAGE, creating new contact:', contactId);
                
                // Create a minimal contact structure - the person data will be populated later
                // when fetchMessages is called or when the contact is properly loaded
                const newContact = {
                    person: { _id: contactId }, // Minimal person data
                    messages: [newMsg]
                };
                
                return [
                    newContact,
                    ...otherContacts,
                ];
            }
            break;

        case SEEN_MESSAGE:

            let seenContactId = action.payload.contactId
            // alert('s m'+seenContactId)

            let usOtherContacts = state.filter(state => state?.person?._id !== seenContactId)

            let seenContact = state.filter(state => state?.person?._id === seenContactId)

            // Check if the contact exists and has messages before trying to access them
            if (seenContact.length > 0 && seenContact[0]?.messages && seenContact[0].messages.length > 0) {
                console.log('s c', seenContact[0].messages[0])

                seenContact[0].messages[0].isSeen = true

                return [
                    ...seenContact,
                    ...usOtherContacts,
                ];
            } else {
                // If contact doesn't exist or has no messages, return unchanged state
                console.warn('Contact or messages not found in state for SEEN_MESSAGE:', seenContactId);
                return state;
            }
            break;

        // SEND_MESSAGE case removed since it's no longer used and was causing errors

        default:
            return state;
    }
}

export default messageReducer;
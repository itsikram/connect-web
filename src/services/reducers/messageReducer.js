import { ADD_MESSAGE, ADD_MESSAGES, NEW_MESSAGE, SEEN_MESSAGE } from "../constants/messageConsts";
const initialState = []
const messageReducer = (state = initialState, action) => {
    switch (action.type) {
        // case GET_NOTIFICATIONS:
        //     return [
        //         ...state,
        //     ];
        //     break;

        case ADD_MESSAGE: {
            const newMessage = action.payload
            const isMsgExits = state.filter(noti => noti._id === action.payload._id)
            if (isMsgExits.length > 0) return state;
            return [
                newMessage,
                ...state,
            ];
        }

        case ADD_MESSAGES: {
            const newMessages = action.payload
            const isReset = action.reset || false


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
        }

        case NEW_MESSAGE: {
            const newMsg = action.payload
            
            // Validate the message payload
            if (!newMsg || !newMsg.senderId) {
                console.warn('NEW_MESSAGE: Invalid message payload', newMsg);
                return state;
            }

            const contactId = newMsg.senderId
            const otherContacts = state.filter(state => state?.person?._id !== contactId)
            const updatedContact = state.filter(state => state?.person?._id === contactId)

            // Check if the contact exists before trying to access its messages
            if (updatedContact.length > 0 && updatedContact[0]) {
                // Create a deep copy to avoid mutation
                const updatedContactData = {
                    ...updatedContact[0],
                    messages: [newMsg, ...(updatedContact[0].messages || [])]
                };
                
                return [
                    updatedContactData,
                    ...otherContacts,
                ];
            } else {
                // If contact doesn't exist, create a new contact entry
                // This handles the case where someone messages you for the first time
                if (process.env.NODE_ENV === 'development') {
                    console.debug('Contact not found in state for NEW_MESSAGE, creating new contact:', contactId);
                }
                
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
        }

        case SEEN_MESSAGE: {
            const seenContactId = action.payload.contactId
            
            // Early return if contactId is invalid
            if (!seenContactId) {
                console.warn('SEEN_MESSAGE: Invalid contactId provided');
                return state;
            }

            const usOtherContacts = state.filter(state => state?.person?._id !== seenContactId)
            const seenContact = state.filter(state => state?.person?._id === seenContactId)

            // Check if the contact exists and has messages before trying to access them
            if (seenContact.length > 0 && seenContact[0]?.messages && seenContact[0].messages.length > 0) {
                // Create a deep copy to avoid mutation
                const updatedSeenContact = {
                    ...seenContact[0],
                    messages: seenContact[0].messages.map((msg, index) => 
                        index === 0 ? { ...msg, isSeen: true } : msg
                    )
                };

                return [
                    updatedSeenContact,
                    ...usOtherContacts,
                ];
            } else {
                // If contact doesn't exist or has no messages, silently return unchanged state
                // This can happen when the seen message is processed before the contact is loaded
                // or when switching between conversations quickly
                if (process.env.NODE_ENV === 'development') {
                    console.debug('SEEN_MESSAGE: Contact or messages not found in state for contactId:', seenContactId, 'Current state contacts:', state.map(s => s?.person?._id));
                }
                return state;
            }
        }

        // SEND_MESSAGE case removed since it's no longer used and was causing errors

        default:
            return state;
    }
}

export default messageReducer;
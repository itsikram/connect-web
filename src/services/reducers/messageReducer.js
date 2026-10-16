import { ADD_MESSAGE, ADD_MESSAGES, NEW_MESSAGE, SEEN_MESSAGE } from "../constants/messageConsts";
import {CLEAR_ALL_STATE} from '../constants/authConsts';
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
            const myProfileId = action.myProfileId
            
            if (!newMsg || (!newMsg.senderId && !newMsg.receiverId)) {
                console.warn('NEW_MESSAGE: Invalid message payload', newMsg);
                return state;
            }

            const me = String(myProfileId || "");
            const sender = String(newMsg.senderId || "");
            const receiver = String(newMsg.receiverId || "");

            let contactId;
            if (me && sender === me) {
                contactId = receiver;
            } else if (sender) {
                contactId = sender;
            } else if (receiver && receiver !== me) {
                contactId = receiver;
            } else {
                console.warn('NEW_MESSAGE: Could not determine contactId, message', newMsg);
                return state;
            }

            const otherContacts = state.filter(c => String(c?.person?._id) !== String(contactId))
            const updatedContact = state.filter(c => String(c?.person?._id) === String(contactId))

            // Check if the contact exists before trying to access its messages
            if (updatedContact.length > 0 && updatedContact[0]) {
                // Check if this message already exists to prevent duplicates
                const messageExists = updatedContact[0].messages?.some(
                    msg => msg._id?.toString() === newMsg._id?.toString()
                );
                
                if (messageExists) {
                    // Message already exists, just return current state
                    return state;
                }
                
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

            // Ids may arrive as strings (route params) or ObjectId-like values,
            // so compare as strings. Keep the list order and return the same
            // state when nothing changed so unread badges don't re-render.
            const seenId = String(seenContactId)
            const index = state.findIndex(c => String(c?.person?._id) === seenId)
            const seenContact = index >= 0 ? state[index] : null

            if (seenContact?.messages?.length > 0) {
                if (!seenContact.messages.some(msg => msg && msg.isSeen !== true)) return state

                const nextState = state.slice()
                nextState[index] = {
                    ...seenContact,
                    messages: seenContact.messages.map((msg) =>
                        msg && msg.isSeen !== true ? { ...msg, isSeen: true } : msg
                    )
                }
                return nextState
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

        case CLEAR_ALL_STATE:
            return initialState

        // SEND_MESSAGE case removed since it's no longer used and was causing errors

        default:
            return state;
    }
}

export default messageReducer;
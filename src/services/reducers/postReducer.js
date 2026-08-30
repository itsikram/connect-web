import { LOAD_POSTS, ADD_POST, REMOVE_POST } from "../constants/postConsts";
import {CLEAR_ALL_STATE} from '../constants/authConsts';

// initial state
const initialPostState = []


const postReducer = (state = initialPostState, action) => {
    switch (action.type) {
        case LOAD_POSTS: {
            const incomingPosts = Array.isArray(action.payload) ? action.payload : []

            if (action.meta?.append) {
                const existingPostIds = new Set(state.map(post => post?._id))
                const uniqueIncomingPosts = incomingPosts.filter(post => !existingPostIds.has(post?._id))
                return [
                    ...state,
                    ...uniqueIncomingPosts,
                ]
            }

            return incomingPosts
        }
        case ADD_POST:
            console.log(action.payload)
            return [
                action.payload,
                ...state.filter(post => post?._id !== action.payload?._id),
            ]
        case REMOVE_POST: {
            const postId = action.payload?.postId
            return state.filter(post => post?._id !== postId)
        }
        case CLEAR_ALL_STATE:
            return initialPostState
        default:
            return state
    }
}

export default postReducer
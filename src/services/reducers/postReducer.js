import { LOAD_POSTS, ADD_POST, REMOVE_POST } from "../constants/postConsts";
import {CLEAR_ALL_STATE} from '../constants/authConsts';

// initial state
const initialPostState = []


const postReducer = (state = initialPostState, action) => {
    switch (action.type) {
        case LOAD_POSTS:
            return [
                ...state,
                ...action.payload,


            ];
        case ADD_POST:
            console.log(action.payload)
            return [
                action.payload,
                ...state,
            ]
        case REMOVE_POST:
            let postId = action.payload.postId
            let updatedPosts = state.filter(post => !post._id == postId)
            return updatedPosts
        case CLEAR_ALL_STATE:
            return initialPostState
        default:
            return state
    }
}

export default postReducer
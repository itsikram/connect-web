import { LOAD_POSTS,REMOVE_POST,ADD_POST } from "../constants/postConsts";

export const loadPosts = (posts, options = {}) => {

    return {
        type: LOAD_POSTS,
        payload: Array.isArray(posts) ? posts : [],
        meta: {
            append: Boolean(options.append)
        }
    }

}
export const removePost = (postId) => {
    return {
        type: REMOVE_POST,
        payload: {
            postId
        }
    }
}
export const addPost = (post) => {
    return {
        type: ADD_POST,
        payload: post
    }
}

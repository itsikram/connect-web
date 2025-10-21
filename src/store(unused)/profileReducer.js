import { createSlice } from "@reduxjs/toolkit";

let initialState = {}

let profileReducer = createSlice({
    name: 'profile',
    initialState,
    reducers: {
        profileInfo: (state,actions) => {
            state.profile = actions.payload;
        }
    }
})
export const {profileInfo} = profileReducer.actions;

export default profileReducer.reducer
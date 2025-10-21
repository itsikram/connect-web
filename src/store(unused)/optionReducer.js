import { createSlice } from "@reduxjs/toolkit";

let initialState = {
    headerHeight: null,
}

let optionReducer = createSlice({
    name: 'option',
    initialState,
    reducers: {
        setHeaderHeight: (state,action) => {
            state.headerHeight = action;
        }
    }
})
export const {setHeaderHeight} = optionReducer.actions;

export default optionReducer.reducer
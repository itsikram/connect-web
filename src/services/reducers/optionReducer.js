import { SET_HEADER_HEIGHT,SET_BODY_HEIGHT,SET_LOADING } from "../constants/optionConsts";
let initialState = {headerHeight: null,bodyHeight: null,isLoading: true}
const optionReducer = (state=initialState,action) => {
    switch (action.type) {
        case SET_HEADER_HEIGHT:
            return {
                ...state,
                headerHeight: action.payload,
            };
            break;

            case SET_LOADING:
            return {
                ...state,
                isLoading: action.payload,
            };
            break;

            case SET_BODY_HEIGHT:
                return {
                    ...state,
                    bodyHeight: action.payload,
                };
                break;


        default:
            return state;
    }
}

export default optionReducer;
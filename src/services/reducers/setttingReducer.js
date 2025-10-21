import { SET_MODE_SHARE,SET_NOTIFICATION,UPDATE_OPTION,LOAD_SETTINGS } from "../constants/settingConsts";
let initialState = {
    isShareEmotion: false,
    notification: true,
    showTyping: true,

}
const settingReducer = (state = initialState, action) => {
    switch (action.type) {
        case SET_MODE_SHARE:
            return {
                isShareEmotion: action.payload
            };
            break;

        case SET_NOTIFICATION:
            // let newNotification = action.payload
            // let isNotiExits = state.filter(noti => noti._id === action.payload._id )
            // if(isNotiExits.length > 0) return state;
            // return [newNotification,
            //     ...state,
                
            // ];
            break;

        case UPDATE_OPTION:
            // let newNotifications = action.payload
            // let isReset = action.reset || false


            // if(isReset) {
            //     return [
            //         ...newNotifications
            //     ];
            // }else {
            //     return [

            //         ...state,
            //         ...newNotifications
            //     ];
            // }

            break;

            case LOAD_SETTINGS:

                return action.payload
            break


        default:
            return state;
    }
}

export default settingReducer;
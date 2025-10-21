import { GET_NOTIFICATIONS, ADD_NOTIFICATION, ADD_NOTIFICATIONS, VIEW_NOTIFICATION ,VIEW_NOTIFICATIONS,DELETE_NOTIFICATIONS} from "../constants/notificationConsts";
let initialState = []
const notificaitonReducer = (state = initialState, action) => {
    switch (action.type) {
        case GET_NOTIFICATIONS:
            return [
                ...state,
            ];
            break;

        case ADD_NOTIFICATION:
            let newNotification = action.payload
            let isNotiExits = state.filter(noti => noti._id === action.payload._id )
            if(isNotiExits.length > 0) return state;
            return [newNotification,
                ...state,
                
            ];
            break;

        case ADD_NOTIFICATIONS:
            let newNotifications = action.payload
            let isReset = action.reset || false


            if(isReset) {
                return [
                    ...newNotifications
                ];
            }else {
                return [

                    ...state,
                    ...newNotifications
                ];
            }

            break;

        case VIEW_NOTIFICATION:
            let notiId = action.payload
            let oldNotifications = state.filter(noti => noti._id !== notiId)
            let viewdNoti = state.filter(noti => noti._id === notiId)
            if(viewdNoti.length >0 ) viewdNoti[0].isSeen = true
            // console.log('VIEW_NOTIFICATION', oldNotifications, viewdNoti)
            return [
                ...oldNotifications,
                viewdNoti[0]
            ];
            break;

        case VIEW_NOTIFICATIONS:
            let seenNotis = []
            state.map((noti,key) => {
                seenNotis.push({...noti, isSeen: true})
            })
            return seenNotis;
            break;
        case DELETE_NOTIFICATIONS:
            return []
            
            break;


        default:
            return state;
    }
}

export default notificaitonReducer;
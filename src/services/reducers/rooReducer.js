import { combineReducers } from "redux";
import profileReducer from "./profileReducer"
import authReducer from "./authReducer";
import notificationReducer from './notificationReducer'
import optionReducer from "./optionReducer";
import messageReducer from "./messageReducer";
import settingReducer from "./setttingReducer";
import postReducer from "./postReducer"; 
// redux windows extention
// const ReactReduxDevTools = window.__REDUX_DEVTOOLS_EXTENSION__ ? window.__REDUX_DEVTOOLS_EXTENSION__(): false

const rootReducer = combineReducers({
    profile: profileReducer,
    auth: authReducer,
    option: optionReducer,
    notification: notificationReducer,
    message: messageReducer,
    setting: settingReducer,
    post: postReducer
})


export default rootReducer;
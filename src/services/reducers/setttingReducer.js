import { SET_MODE_SHARE, SET_NOTIFICATION, UPDATE_OPTION, LOAD_SETTINGS } from "../constants/settingConsts";
import { CLEAR_ALL_STATE } from '../constants/authConsts';

const initialState = {
    isShareEmotion: false,
    isShareLocation: true,
    showIsTyping: true,
    ringtone: 1,
    themeMode: 'dark',
    postVisibility: 'public',
    connectRequestVisibility: 'public',
    timelinePostVisibility: 'public',
    connectRequestReceived: true,
    connectRequestAccepted: true,
    newMessageReceived: true,
    newConnectPost: true,
    newConnectStory: true,
    newConnectWatch: true,
    connectRequestReceivedEmail: false,
    connectRequestAcceptedEmail: false,
    newMessageReceivedEmail: false,
    newConnectPostEmail: false,
    newConnectStoryEmail: false,
    newConnectWatchEmail: false,
    chatBackground: null,
    connectChatSettings: {},
};

const settingReducer = (state = initialState, action) => {
    switch (action.type) {
        case SET_MODE_SHARE:
            return {
                ...state,
                isShareEmotion: action.payload,
            };

        case SET_NOTIFICATION:
        case UPDATE_OPTION:
            return state;

        case LOAD_SETTINGS:
            return {
                ...initialState,
                ...action.payload,
            };

        case CLEAR_ALL_STATE:
            return initialState;

        default:
            return state;
    }
};

export default settingReducer;

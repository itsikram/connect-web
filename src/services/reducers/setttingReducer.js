import { SET_MODE_SHARE, SET_NOTIFICATION, UPDATE_OPTION, LOAD_SETTINGS } from "../constants/settingConsts";
import { CLEAR_ALL_STATE } from '../constants/authConsts';
import { BOOT_SLICES, readBootCache } from "../../utils/bootCache";

export const defaultSettings = {
    isShareEmotion: false,
    isShareLocation: true,
    showIsTyping: true,
    ringtone: 1,
    themeMode: 'dark',
    language: 'eng',
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

// The signed-in account's last known settings (theme, ringtone, chat
// background...) until Main.js loads the current ones from the server.
const cachedSettings = readBootCache(BOOT_SLICES.SETTINGS);
const initialState =
    cachedSettings && typeof cachedSettings === 'object' && !Array.isArray(cachedSettings)
        ? { ...defaultSettings, ...cachedSettings }
        : defaultSettings;

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
                ...defaultSettings,
                ...action.payload,
            };

        case CLEAR_ALL_STATE:
            return defaultSettings;

        default:
            return state;
    }
};

export default settingReducer;

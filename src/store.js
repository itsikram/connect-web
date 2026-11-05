import { createStore,compose,applyMiddleware } from "redux"
import thunk from 'redux-thunk'

import rootReducer from "./services/reducers/rooReducer"
import bootCacheMiddleware from "./services/bootCacheMiddleware"
import { BOOT_SLICES, readBootCache } from "./utils/bootCache"
import { applyThemeMode } from "./utils/applyThemeMode"


const store = createStore(
    rootReducer,
    compose(
        applyMiddleware(thunk, bootCacheMiddleware),
    )
)

// Paint the signed-in account's last known theme before the first render, so
// a light-theme user does not see the dark default first. Main.js applies the
// server's value as soon as it arrives.
const cachedThemeMode = readBootCache(BOOT_SLICES.SETTINGS)?.themeMode
if (cachedThemeMode) applyThemeMode(cachedThemeMode)

export default store

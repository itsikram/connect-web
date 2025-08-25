import { createStore,compose,applyMiddleware } from "redux"
import thunk from 'redux-thunk'

import rootReducer from "./services/reducers/rooReducer"


const store = createStore(
    rootReducer,
    compose(
        applyMiddleware(thunk),
    )
)

store.subscribe(() => {
    console.log(store.getState())
})
export default store
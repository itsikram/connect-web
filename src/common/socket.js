
import { io } from 'socket.io-client';

let user = localStorage.getItem("user") || '{}'
let userJson = JSON.parse(user)

const socket = io.connect(process.env.REACT_APP_SERVER_ADDR, {
    query: {
        profile: userJson.profile
    }
})
export default socket;
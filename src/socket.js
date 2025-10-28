import io from 'socket.io-client'

const URL = '172.20.10.2:3000'
const socket = io.connect(URL)

export default socket
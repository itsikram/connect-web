import io from 'socket.io-client'

const URL = '192.168.43.85:3000'
const socket = io.connect(URL)

export default socket
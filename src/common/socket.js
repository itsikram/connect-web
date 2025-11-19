
import { io } from 'socket.io-client';

let socket = null;

const initializeSocket = () => {
    if (!socket) {
        try {
            const user = localStorage.getItem("user") || '{}';
            const userJson = JSON.parse(user);
            
            socket = io.connect(process.env.REACT_APP_SERVER_ADDR, {
                query: {
                    profile: userJson.profile
                }
            });
        } catch (error) {
            console.error('Error initializing socket:', error);
            // Create socket without profile query if localStorage fails
            socket = io.connect(process.env.REACT_APP_SERVER_ADDR);
        }
    }
    return socket;
};

// Use a Proxy to lazily initialize socket on first property access
const socketProxy = new Proxy({}, {
    get(target, prop) {
        const socketInstance = initializeSocket();
        const value = socketInstance[prop];
        // If it's a function, bind it to the socket instance
        if (typeof value === 'function') {
            return value.bind(socketInstance);
        }
        return value;
    },
    set(target, prop, value) {
        const socketInstance = initializeSocket();
        socketInstance[prop] = value;
        return true;
    }
});

export default socketProxy;
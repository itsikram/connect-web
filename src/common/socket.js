
import { io } from 'socket.io-client';

let socketInstance = null;
let socketProxy = null;

const getSocket = () => {
    if (!socketInstance) {
        try {
            const user = localStorage.getItem("user") || '{}';
            const userJson = JSON.parse(user);
            
            socketInstance = io.connect(process.env.REACT_APP_SERVER_ADDR, {
                query: {
                    profile: userJson.profile
                }
            });
        } catch (error) {
            console.error('Error initializing socket:', error);
            // Create socket without profile query if localStorage fails
            socketInstance = io.connect(process.env.REACT_APP_SERVER_ADDR);
        }
    }
    return socketInstance;
};

// Create Proxy lazily to avoid any initialization at module load time
const getSocketProxy = () => {
    if (!socketProxy) {
        socketProxy = new Proxy({}, {
            get(target, prop) {
                const instance = getSocket();
                const value = instance[prop];
                // Bind functions to maintain correct 'this' context
                if (typeof value === 'function') {
                    return value.bind(instance);
                }
                return value;
            },
            set(target, prop, value) {
                const instance = getSocket();
                instance[prop] = value;
                return true;
            },
            has(target, prop) {
                const instance = getSocket();
                return prop in instance;
            },
            ownKeys(target) {
                const instance = getSocket();
                return Reflect.ownKeys(instance);
            },
            getOwnPropertyDescriptor(target, prop) {
                const instance = getSocket();
                return Reflect.getOwnPropertyDescriptor(instance, prop);
            }
        });
    }
    return socketProxy;
};

// Use Object.defineProperty to create a getter that initializes on first access
// This ensures zero code execution at module load time
const socket = {};
Object.defineProperty(socket, '__getProxy', {
    get: getSocketProxy,
    enumerable: false,
    configurable: false
});

// Create a Proxy that intercepts all property access
// This Proxy itself is created at module load, but it doesn't execute any code
// until a property is actually accessed
const socketExport = new Proxy(socket, {
    get(target, prop) {
        // Skip internal properties
        if (prop === '__getProxy') {
            return target[prop];
        }
        return getSocketProxy()[prop];
    },
    set(target, prop, value) {
        getSocketProxy()[prop] = value;
        return true;
    },
    has(target, prop) {
        if (prop === '__getProxy') {
            return true;
        }
        const proxy = getSocketProxy();
        return prop in proxy;
    }
});

export default socketExport;
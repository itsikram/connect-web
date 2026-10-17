import { io } from 'socket.io-client';
import {
    getSocketUrl,
    getServerList,
    getServerAddress,
    getNextServer,
    markServerDown,
    isServerDown,
    setPreferredServer,
    SERVER_CHANGED_EVENT,
    usesRuntimeServerConfig,
    applyServerConfig,
    isFallbackOnly,
} from '../utils/offlineUtils';
import { getUserFromStorage } from '../utils/storageUtils';

let socketInstance = null;
let socketProxy = null;
// Profile the live socket is authenticated as (the server routes every
// message, call and notification by this identity).
let socketProfileId = null;
let lastIdentityCheck = 0;
const IDENTITY_CHECK_INTERVAL_MS = 1000;

const SOCKET_OPTIONS = {
    // Preserve original timeout settings (20s like the app version)
    timeout: 20000,
    reconnection: true,
    reconnectionDelay: 1000,
    reconnectionAttempts: Infinity,
    reconnectionDelayMax: 5000,
    transports: ['websocket', 'polling']
};

// Multiple servers: REACT_APP_SOCKET_URLS="https://connect-1.onrender.com,https://connect-2.onrender.com"
// Each client sticks to one server; the first failed connect moves it to the
// next one. The servers share rooms through Redis, so any server can deliver
// to anyone.
const SERVER_STORAGE_KEY = 'connect.socketServer';
const FAILOVER_AFTER_ERRORS = 1;
// With a backup server available, give up on an unresponsive one quickly.
const FAILOVER_CONNECT_TIMEOUT_MS = 8000;

const getSocketServers = () => {
    // The admin panel's server list wins over build-time socket lists.
    if (usesRuntimeServerConfig()) return getServerList();
    const list = String(process.env.REACT_APP_SOCKET_URLS || '')
        .split(',')
        .map((url) => url.trim().replace(/\/+$/, ''))
        .filter(Boolean);
    if (list.length) return list;
    // No socket list: use the API servers (unless a single socket URL is set).
    if (!process.env.REACT_APP_SOCKET_URL && getServerList().length > 1) return getServerList();
    return [getSocketUrl()];
};

let socketServers = null;
let serverIndex = 0;
let consecutiveErrors = 0;

const pickInitialServer = () => {
    socketServers = getSocketServers();
    let saved = null;
    try { saved = localStorage.getItem(SERVER_STORAGE_KEY); } catch (_e) { /* ignore */ }
    // A saved fallback server is only kept while it is the API's home too.
    if (isFallbackOnly(saved, socketServers) && saved !== getServerAddress()) saved = null;
    if (!saved || !socketServers.includes(saved)) saved = getServerAddress(); // same home as the API
    if (saved && isServerDown(saved)) saved = getNextServer(saved, socketServers);
    const savedIndex = saved ? socketServers.indexOf(saved) : -1;
    serverIndex = savedIndex >= 0
        ? savedIndex
        : Math.floor(Math.random() * socketServers.length); // spread users out
    return socketServers[serverIndex];
};

const rememberServer = (url) => {
    try { localStorage.setItem(SERVER_STORAGE_KEY, url); } catch (_e) { /* ignore */ }
};

// Point the existing socket at the next server. Keeping the same instance
// means every listener registered through the exported proxy stays attached.
const switchToServer = (nextUrl) => {
    if (!socketInstance || !socketServers) return;
    const nextIndex = socketServers.indexOf(nextUrl);
    if (nextIndex < 0 || nextIndex === serverIndex) return;
    serverIndex = nextIndex;
    consecutiveErrors = 0;
    console.warn('[socket] switching to server', nextUrl);
    const manager = socketInstance.io;
    manager.uri = nextUrl;
    manager.engine && manager.engine.close();
};

const failoverToNextServer = () => {
    if (!socketInstance || !socketServers || socketServers.length < 2) return;
    const currentUrl = socketServers[serverIndex];
    markServerDown(currentUrl);
    const nextUrl = getNextServer(currentUrl, socketServers);
    switchToServer(nextUrl);
    // Move API traffic off the failed server too.
    if (getServerList().includes(nextUrl)) setPreferredServer(nextUrl);
};

const attachFailover = (instance) => {
    instance.on('connect', () => {
        consecutiveErrors = 0;
        if (socketServers) rememberServer(socketServers[serverIndex]);
    });
    instance.on('connect_error', (err) => {
        if (isRefusedByServer(err)) {
            // A refused connection is not retried by socket.io itself.
            setTimeout(() => {
                if (!instance.connected && readStoredProfileId()) instance.connect();
            }, AUTH_RETRY_MS);
            return;
        }
        consecutiveErrors += 1;
        if (consecutiveErrors >= FAILOVER_AFTER_ERRORS) failoverToNextServer();
    });
    // An admin saved a new server list: use it (applying it fires
    // SERVER_CHANGED_EVENT below when this browser has to move).
    instance.on('server-config-changed', (config) => {
        applyServerConfig(config);
    });
    // The API moved servers (it found its server down, or the admin list
    // changed): follow it if we are not connected, or if our server is no
    // longer in the list.
    if (typeof window !== 'undefined') {
        window.addEventListener(SERVER_CHANGED_EVENT, (event) => {
            const url = event?.detail?.url;
            if (!url) return;
            const currentUrl = socketServers ? socketServers[serverIndex] : null;
            socketServers = getSocketServers();
            serverIndex = currentUrl ? socketServers.indexOf(currentUrl) : -1;
            const currentRemoved = serverIndex < 0;
            if (!instance.connected || currentRemoved) switchToServer(url);
            // Neither server is in this socket's list: start over at its first.
            if (serverIndex < 0) switchToServer(socketServers[0]);
        });
    }
};

// The access token the REST API uses; the server takes the socket's identity
// from it (a claimed profile id alone is not trusted).
const readStoredToken = () => {
    const token = getUserFromStorage()?.accessToken;
    return token ? String(token) : null;
};

// Read on every (re)connect, so a refreshed token is used.
const socketAuth = (cb) => cb({ profile: socketProfileId, token: readStoredToken() });

// The server refused this socket (auth middleware): the server is up, so
// this is not a failover case. Retry later; API calls refresh the token.
const AUTH_RETRY_MS = 5000;
const isRefusedByServer = (err) => Boolean(err && err.data && err.type !== 'TransportError');

const readStoredProfileId = () => {
    try {
        const userJson = JSON.parse(localStorage.getItem("user") || '{}');
        const profileId =
            typeof userJson.profile === "string"
                ? userJson.profile
                : userJson.profile?._id || userJson.user_id;
        return profileId ? String(profileId) : null;
    } catch (_error) {
        return null;
    }
};

// Keep the socket's identity in sync with the logged-in user. Previously the
// socket kept the profile it was first created with: after logout (which
// disconnects it) and a new login without a page reload, it stayed
// disconnected / authenticated as the old user, so no messages, calls or
// notifications arrived until a manual refresh.
const syncSocketIdentity = () => {
    if (!socketInstance) return;
    const now = Date.now();
    if (now - lastIdentityCheck < IDENTITY_CHECK_INTERVAL_MS) return;
    lastIdentityCheck = now;

    const currentProfileId = readStoredProfileId();
    if (!currentProfileId) return; // logged out: leave the socket as logout left it

    if (currentProfileId !== socketProfileId) {
        socketProfileId = currentProfileId;
        socketInstance.io.opts.query = { ...(socketInstance.io.opts.query || {}), profile: currentProfileId };
        socketInstance.auth = socketAuth;
        socketInstance.disconnect();
        socketInstance.connect();
        return;
    }
    // Manually disconnected (logout) but a user is signed in again.
    if (!socketInstance.connected && !socketInstance.active) {
        socketInstance.connect();
    }
};

const getSocket = () => {
    if (!socketInstance) {
        try {
            const socketUrl = pickInitialServer();
            const profileId = readStoredProfileId();
            socketProfileId = profileId;
            socketInstance = io.connect(socketUrl, {
                ...SOCKET_OPTIONS,
                ...(socketServers.length > 1 ? { timeout: FAILOVER_CONNECT_TIMEOUT_MS } : {}),
                query: {
                    profile: profileId
                },
                auth: socketAuth,
            });
            attachFailover(socketInstance);
        } catch (error) {
            console.error('Error initializing socket:', error);
            // Create socket without profile query if localStorage fails
            const socketUrl = getSocketUrl();
            socketInstance = io.connect(socketUrl, SOCKET_OPTIONS);
        }
    } else {
        syncSocketIdentity();
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

/**
 * Persists videos imported from this device in IndexedDB so they survive a reload.
 * Blob URLs die with the page, so the playlist keeps only ids and we rebuild URLs here.
 */
const DB_NAME = 'connectLocalVideos';
const DB_VERSION = 1;
const STORE = 'videos';

const VIDEO_EXTENSIONS = /\.(mp4|m4v|mov|webm|mkv|ogv|ogg|avi|3gp|3g2|mpe?g|ts|m2ts|wmv|flv)$/i;

export const isVideoFile = (file) =>
    !!file && (String(file.type || '').startsWith('video/') || VIDEO_EXTENSIONS.test(file.name || ''));

export const stripExtension = (name) => String(name || '').replace(/\.[^./\\]+$/, '') || 'Untitled video';

let dbPromise = null;

const openDb = () => {
    if (typeof indexedDB === 'undefined') return Promise.reject(new Error('IndexedDB unavailable'));
    if (dbPromise) return dbPromise;
    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
            const db = request.result;
            if (!db.objectStoreNames.contains(STORE)) {
                db.createObjectStore(STORE, { keyPath: 'id' });
            }
        };
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => {
            dbPromise = null;
            reject(request.error);
        };
    });
    return dbPromise;
};

const run = async (mode, fn) => {
    const db = await openDb();
    return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE, mode);
        const store = tx.objectStore(STORE);
        let result;
        const request = fn(store);
        if (request) request.onsuccess = () => { result = request.result; };
        tx.oncomplete = () => resolve(result);
        tx.onerror = () => reject(tx.error);
        tx.onabort = () => reject(tx.error || new Error('Transaction aborted'));
    });
};

/** Stores one file; rejects (e.g. QuotaExceededError) if the browser refuses it. */
export const saveLocalVideo = ({ id, title, file }) =>
    run('readwrite', (store) =>
        store.put({
            id,
            title,
            name: file.name,
            mime: file.type,
            size: file.size,
            addedAt: Date.now(),
            blob: file,
        })
    );

export const loadLocalVideos = async () => {
    try {
        const rows = (await run('readonly', (store) => store.getAll())) || [];
        return rows.sort((a, b) => (a.addedAt || 0) - (b.addedAt || 0));
    } catch (_) {
        return [];
    }
};

export const deleteLocalVideo = async (id) => {
    try {
        await run('readwrite', (store) => store.delete(id));
    } catch (_) {}
};

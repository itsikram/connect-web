/**
 * In-memory store for Watch → Saved Videos download progress.
 * Survives navigation between Watch and /downloads so progress stays visible.
 */

const listeners = new Set();
/** @type {Record<string, object>} */
let downloadsById = {};

function snapshot() {
    return Object.values(downloadsById).sort((a, b) => (b.startedAt || 0) - (a.startedAt || 0));
}

function notify() {
    const list = snapshot();
    listeners.forEach((fn) => {
        try {
            fn(list);
        } catch (err) {
            console.error('watchDownloadProgress listener error:', err);
        }
    });
    try {
        window.dispatchEvent(new CustomEvent('watchDownloadProgress', { detail: list }));
    } catch (_) {}
}

export function getWatchDownloads() {
    return snapshot();
}

export function getWatchDownload(id) {
    return downloadsById[String(id)] || null;
}

export function subscribeWatchDownloads(listener) {
    if (typeof listener !== 'function') return () => {};
    listeners.add(listener);
    listener(snapshot());
    return () => listeners.delete(listener);
}

export function startWatchDownload(id, metadata = {}) {
    const key = String(id);
    downloadsById = {
        ...downloadsById,
        [key]: {
            id: key,
            metadata,
            status: 'downloading',
            percent: 0,
            loaded: 0,
            total: 0,
            error: '',
            startedAt: Date.now(),
        },
    };
    notify();
    return downloadsById[key];
}

export function updateWatchDownload(id, patch = {}) {
    const key = String(id);
    const prev = downloadsById[key];
    if (!prev) return null;
    downloadsById = {
        ...downloadsById,
        [key]: { ...prev, ...patch },
    };
    notify();
    return downloadsById[key];
}

export function completeWatchDownload(id) {
    const key = String(id);
    if (!downloadsById[key]) return;
    downloadsById = {
        ...downloadsById,
        [key]: {
            ...downloadsById[key],
            status: 'completed',
            percent: 100,
        },
    };
    notify();
    // Keep completed card briefly so the UI can refresh, then remove
    setTimeout(() => {
        removeWatchDownload(key);
    }, 2500);
}

export function failWatchDownload(id, error = 'Download failed') {
    const key = String(id);
    if (!downloadsById[key]) return;
    downloadsById = {
        ...downloadsById,
        [key]: {
            ...downloadsById[key],
            status: 'failed',
            error: String(error || 'Download failed'),
        },
    };
    notify();
}

export function removeWatchDownload(id) {
    const key = String(id);
    if (!downloadsById[key]) return;
    const next = { ...downloadsById };
    delete next[key];
    downloadsById = next;
    notify();
}

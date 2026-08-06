/**
 * Download a remote file with progress callbacks.
 * Uses XMLHttpRequest so progress events work cross-origin when CORS allows it.
 *
 * @param {string} url
 * @param {string} [fileName]
 * @param {object} [options]
 * @param {function} [options.onProgress]
 * @param {function} [options.onStart]
 * @param {AbortSignal} [options.signal]
 * @param {boolean} [options.saveToDisk=true] - If true, triggers a browser file save
 */
export function downloadFileWithProgress(url, fileName, {
    onProgress,
    onStart,
    signal,
    saveToDisk = true,
} = {}) {
    return new Promise((resolve, reject) => {
        if (!url) {
            reject(new Error('Missing download URL'));
            return;
        }

        const xhr = new XMLHttpRequest();
        xhr.open('GET', url, true);
        xhr.responseType = 'blob';

        const abort = () => {
            try {
                xhr.abort();
            } catch (_) {}
        };

        if (signal) {
            if (signal.aborted) {
                reject(new DOMException('Aborted', 'AbortError'));
                return;
            }
            signal.addEventListener('abort', abort, { once: true });
        }

        xhr.onloadstart = () => {
            onStart?.();
            onProgress?.({ loaded: 0, total: 0, percent: 0 });
        };

        xhr.onprogress = (event) => {
            const loaded = event.loaded || 0;
            const total = event.lengthComputable ? event.total : 0;
            const percent = total > 0 ? Math.min(99, Math.round((loaded / total) * 100)) : 0;
            onProgress?.({ loaded, total, percent });
        };

        xhr.onload = () => {
            if (signal) {
                signal.removeEventListener('abort', abort);
            }

            if (xhr.status < 200 || xhr.status >= 300) {
                reject(new Error(`Download failed (${xhr.status})`));
                return;
            }

            const blob = xhr.response;
            if (!(blob instanceof Blob) || blob.size === 0) {
                reject(new Error('Empty download response'));
                return;
            }

            onProgress?.({ loaded: blob.size, total: blob.size, percent: 100 });

            if (saveToDisk) {
                const objectUrl = URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = objectUrl;
                a.download = fileName || 'video.mp4';
                a.style.display = 'none';
                document.body.appendChild(a);
                a.click();
                a.remove();
                setTimeout(() => URL.revokeObjectURL(objectUrl), 1500);
            }

            resolve({ blob, size: blob.size });
        };

        xhr.onerror = () => {
            if (signal) {
                signal.removeEventListener('abort', abort);
            }
            reject(new Error('Network error while downloading'));
        };

        xhr.onabort = () => {
            if (signal) {
                signal.removeEventListener('abort', abort);
            }
            reject(new DOMException('Aborted', 'AbortError'));
        };

        xhr.send();
    });
}

export function formatBytes(bytes) {
    if (!bytes || bytes <= 0) return '0 B';
    const units = ['B', 'KB', 'MB', 'GB'];
    const i = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
    const value = bytes / Math.pow(1024, i);
    return `${value.toFixed(value >= 10 || i === 0 ? 0 : 1)} ${units[i]}`;
}

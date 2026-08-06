import { showVideoSavedToast, showInfoToast, showErrorToast, showSuccessToast } from "./toastUtils";
import { downloadFileWithProgress } from "./downloadFileWithProgress";
import {
  startWatchDownload,
  updateWatchDownload,
  completeWatchDownload,
  failWatchDownload,
  getWatchDownload,
} from "./watchDownloadProgress";

// ✅ Central DB open function
const openVideoDB = (callback) => {
  const dbRequest = indexedDB.open('savedVideoDb', 2);

  dbRequest.onupgradeneeded = () => {
    const db = dbRequest.result;
    if (!db.objectStoreNames.contains('videos')) {
      db.createObjectStore('videos', { keyPath: 'id' });
    }
  };

  dbRequest.onsuccess = () => {
    callback(dbRequest.result);
  };

  dbRequest.onerror = () => {
    console.error("Failed to open IndexedDB");
    callback(null);
  };
};

const putVideoInDb = (id, blob, metadata) =>
  new Promise((resolve, reject) => {
    openVideoDB((db) => {
      if (!db) {
        reject(new Error('Could not open video database'));
        return;
      }

      const tx = db.transaction('videos', 'readwrite');
      const store = tx.objectStore('videos');
      store.put({ id, blob, metadata });

      tx.oncomplete = () => resolve(true);
      tx.onerror = () => reject(tx.error || new Error('Failed to save video'));
    });
  });

// ✅ LOAD video
export const loadVideoById = (id, callback) => {
  openVideoDB((db) => {
    if (!db) return;

    const tx = db.transaction('videos', 'readonly');
    const store = tx.objectStore('videos');
    const getRequest = store.get(id);

    getRequest.onsuccess = () => {
      const record = getRequest.result;
      if (record) {
        const videoURL = URL.createObjectURL(record.blob);
        callback(videoURL, record.metadata);
      } else {
        console.warn('No video found with ID:', id);
        callback(null, null);
      }
    };
  });
};

/**
 * Save a Watch video to IndexedDB with live progress (shown on Saved Videos page).
 * Immediately shows a "Downloading…" alert/toast.
 */
export const saveVideoFromUrl = async (id, url, metadata) => {
  if (!id || !url) {
    showErrorToast('Missing video URL', { title: 'Download Error' });
    return false;
  }

  const existing = getWatchDownload(id);
  if (existing && existing.status === 'downloading') {
    showInfoToast('This video is already downloading…', {
      title: 'Download in progress',
      autoClose: 2500,
    });
    return false;
  }

  const title = metadata?.caption || 'Watch video';

  // Instant feedback
  showInfoToast(`Downloading “${title}”…`, {
    title: 'Downloading',
    autoClose: 3500,
  });
  startWatchDownload(id, metadata);

  try {
    const { blob } = await downloadFileWithProgress(url, `${String(id)}.mp4`, {
      saveToDisk: false,
      onProgress: ({ loaded, total, percent }) => {
        updateWatchDownload(id, {
          status: 'downloading',
          loaded,
          total,
          percent,
        });
      },
    });

    await putVideoInDb(id, blob, metadata);

    completeWatchDownload(id);
    showSuccessToast('Video saved to Saved Videos', {
      title: 'Download Complete',
      autoClose: 2500,
    });
    showVideoSavedToast(
      title,
      metadata?.author?.profilePic,
      `/downloads/${metadata?._id || id}`
    );
    return true;
  } catch (err) {
    console.error('saveVideoFromUrl failed:', err);
    const message = err?.message || 'Failed to download video';
    failWatchDownload(id, message);
    showErrorToast(message, { title: 'Download Error' });
    return false;
  }
};

// ✅ GET all videos
export const getAllSavedVideos = (callback) => {
  openVideoDB((db) => {
    if (!db) return callback([]);

    const tx = db.transaction('videos', 'readonly');
    const store = tx.objectStore('videos');
    const getAllRequest = store.getAll();

    getAllRequest.onsuccess = () => {
      const videos = getAllRequest.result.map((video) => ({
        id: video.id,
        metadata: video.metadata,
        videoURL: URL.createObjectURL(video.blob),
      }));
      callback(videos);
    };

    getAllRequest.onerror = () => {
      console.error('Failed to fetch videos from IndexedDB');
      callback([]);
    };
  });
};

// ✅ DELETE video
export const deleteVideoById = (id, callback) => {
  openVideoDB((db) => {
    if (!db) return callback(false);

    const tx = db.transaction('videos', 'readwrite');
    const store = tx.objectStore('videos');
    const deleteRequest = store.delete(id);

    deleteRequest.onsuccess = () => {
      console.log(`Video with id "${id}" deleted`);
      if (callback) callback(true);
    };

    deleteRequest.onerror = () => {
      console.error(`Failed to delete video with id "${id}"`);
      if (callback) callback(false);
    };
  });
};

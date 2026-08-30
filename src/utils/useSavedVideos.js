import { showVideoSavedToast, showInfoToast, showErrorToast, showSuccessToast } from "./toastUtils";
import { downloadFileWithProgress } from "./downloadFileWithProgress";
import {
  startWatchDownload,
  updateWatchDownload,
  completeWatchDownload,
  failWatchDownload,
  getWatchDownload,
} from "./watchDownloadProgress";
import { apiCall } from "./apiCall";

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

// Save video metadata to backend database
const saveVideoToBackend = async (id, metadata, sourceUrl) => {
  try {
    console.log('[saveVideoToBackend] Starting save...', {
      videoId: id,
      hasMetadata: !!metadata,
    });
    
    const response = await apiCall('POST', '/api/saved-videos/save', {
      videoId: String(id),
      metadata,
      sourceUrl: typeof sourceUrl === 'string' ? sourceUrl : '',
    });
    
    console.log('[saveVideoToBackend] ✓ Success!', response);
    return response;
  } catch (error) {
    console.error('[saveVideoToBackend] ❌ Failed:', {
      videoId: id,
      errorMessage: error?.message,
      error,
    });
    // Don't fail the save if backend fails - local storage is more important
    return null;
  }
};

/**
 * Save a Watch video to IndexedDB with live progress (shown on Saved Videos page).
 * Also saves metadata to backend for persistent history.
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
  showInfoToast(`Downloading "${title}"…`, {
    title: 'Downloading',
    autoClose: 3500,
  });
  startWatchDownload(id, metadata);

  try {
    console.log('[saveVideoFromUrl] Starting download...', { id, hasURL: !!url });
    
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

    console.log('[saveVideoFromUrl] Download complete, saving to IndexedDB...');
    await putVideoInDb(id, blob, metadata);
    
    // Save metadata to backend for persistent history
    console.log('[saveVideoFromUrl] Saving to backend...');
    await saveVideoToBackend(id, metadata, url);

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
    console.log('[saveVideoFromUrl] ✓ Complete!');
    return true;
  } catch (err) {
    console.error('[saveVideoFromUrl] ❌ Failed:', err);
    const message = err?.message || 'Failed to download video';
    failWatchDownload(id, message);
    showErrorToast(message, { title: 'Download Error' });
    return false;
  }
};

// ✅ GET all videos from local IndexedDB
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

// ✅ GET saved videos history from backend
export const getSavedVideosHistory = async () => {
  try {
    console.log('[getSavedVideosHistory] Fetching from backend...');
    const response = await apiCall('GET', '/api/saved-videos/history');
    console.log('[getSavedVideosHistory] Response:', response);
    
    if (response?.success && Array.isArray(response.data)) {
      console.log(`[getSavedVideosHistory] ✓ Got ${response.data.length} videos`);
      return response.data;
    }
    
    if (Array.isArray(response)) {
      console.log(`[getSavedVideosHistory] ✓ Got ${response.length} videos (array response)`);
      return response;
    }
    
    console.warn('[getSavedVideosHistory] Unexpected response format:', response);
    return response?.data || [];
  } catch (error) {
    console.error('[getSavedVideosHistory] ❌ Error:', error?.message);
    return [];
  }
};

// ✅ DELETE video from both local and backend
export const deleteVideoById = (id, callback) => {
  openVideoDB((db) => {
    if (!db) return callback(false);

    const tx = db.transaction('videos', 'readwrite');
    const store = tx.objectStore('videos');
    const deleteRequest = store.delete(id);

    deleteRequest.onsuccess = () => {
      console.log(`[deleteVideoById] ✓ Deleted from IndexedDB: "${id}"`);
      // Also delete from backend
      deleteVideoFromBackend(id).catch(err => 
        console.warn('[deleteVideoById] Backend delete failed:', err)
      );
      if (callback) callback(true);
    };

    deleteRequest.onerror = () => {
      console.error(`[deleteVideoById] ❌ Failed to delete: "${id}"`);
      if (callback) callback(false);
    };
  });
};

// Delete video from backend
export const deleteSavedVideoHistoryById = async (id) => {
  try {
    console.log('[deleteSavedVideoHistoryById] Deleting:', id);
    await apiCall('DELETE', `/api/saved-videos/${id}`);
    console.log('[deleteSavedVideoHistoryById] ✓ Success');
    return true;
  } catch (error) {
    console.warn('[deleteSavedVideoHistoryById] ❌ Failed:', error?.message);
    return false;
  }
};

const deleteVideoFromBackend = async (id) => {
  try {
    console.log('[deleteVideoFromBackend] Deleting:', id);
    const ok = await deleteSavedVideoHistoryById(id);
    if (ok) {
      console.log('[deleteVideoFromBackend] ✓ Success');
    }
  } catch (error) {
    console.warn('[deleteVideoFromBackend] ❌ Failed:', error?.message);
  }
};

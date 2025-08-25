import { toast } from "react-toastify";
import { Link } from "react-router-dom";

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
      }
    };
  });
};

// ✅ SAVE video
export const saveVideoFromUrl = async (id, url, metadata) => {
  const response = await fetch(url);
  const blob = await response.blob();

  openVideoDB((db) => {
    if (!db) return;

    const tx = db.transaction('videos', 'readwrite');
    const store = tx.objectStore('videos');
    store.put({ id, blob, metadata });

    tx.oncomplete = () => {
      console.log(`Video "${id}" saved with metadata`);
      toast(
        <Link className="text-decoration-none text-secondary" to={`/downloads/${metadata._id}`}>
          <div style={{ color: "blue", fontWeight: "bold" }}>
            <div className="row d-flex align-items-center">
              <div className="col-3">
                <img className="rounded-circle w-100" src={metadata.author.profilePic} alt="connect" />
              </div>
              <div className="col-9">
                {metadata?.caption && (<h3 className="text-success mb-0">{metadata.caption}</h3>)}
                <p className="text-small text-secondary text-muted mb-0">{`${metadata.caption} Saved to videos`}</p>
              </div>
            </div>
          </div>
        </Link>
      );
    };
  });
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

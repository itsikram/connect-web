import api from '../api/api';
import { getAllSavedVideos } from './useSavedVideos';

const PLAYLIST_STORAGE_KEY = 'videoPlayerCustomPlaylist';

export const normalizePlaylistItem = (item) => {
    if (!item?.url) return null;
    return {
        id: String(item.id),
        url: item.url,
        title: item.title || 'Untitled video',
        type: item.type || 'url',
        thumbnail: item.thumbnail || '',
        sourceId: item.sourceId || item.savedVideoId || item.watchId || '',
        online: item.online !== false,
    };
};

export const loadCustomPlaylist = () => {
    try {
        const raw = localStorage.getItem(PLAYLIST_STORAGE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(normalizePlaylistItem).filter(Boolean);
    } catch (_) {
        return [];
    }
};

export const saveCustomPlaylist = (items) => {
    const customOnly = (items || []).filter((v) => v.type === 'url' || v.type === 'file');
    if (customOnly.length === 0) {
        localStorage.removeItem(PLAYLIST_STORAGE_KEY);
        return;
    }
    localStorage.setItem(
        PLAYLIST_STORAGE_KEY,
        JSON.stringify(customOnly.map(({ id, url, title, type, sourceId, thumbnail, online }) => ({
            id,
            url,
            title,
            type,
            sourceId,
            thumbnail,
            online,
        })))
    );
};

export const loadWatchPlaylistItems = async (profileId) => {
    if (!profileId) return [];
    try {
        const res = await api.get('watch/related', { params: { profile_id: profileId } });
        if (res.status !== 200 || !Array.isArray(res.data)) return [];

        return res.data
            .filter((w) => w?.videoUrl)
            .map((w) =>
                normalizePlaylistItem({
                    id: `watch-${w._id}`,
                    url: w.videoUrl,
                    title: w.caption || `${w.author?.user?.firstName || 'Watch'} video`,
                    type: 'watch',
                    thumbnail: w.thumbnail || '',
                    sourceId: w._id,
                    online: true,
                })
            )
            .filter(Boolean);
    } catch (err) {
        console.error('Failed to load watches for video player:', err);
        return [];
    }
};

export const loadSavedPlaylistItems = () =>
    new Promise((resolve) => {
        getAllSavedVideos((data) => {
            const items = (data || [])
                .map((v) =>
                    normalizePlaylistItem({
                        id: `saved-${v.id}`,
                        url: v.videoURL,
                        title: v.metadata?.caption || 'Saved video',
                        type: 'saved',
                        thumbnail: v.metadata?.thumbnail || '',
                        sourceId: v.id,
                        online: false,
                    })
                )
                .filter(Boolean);
            resolve(items);
        });
    });

export const mergePlaylist = (...groups) => {
    const seen = new Set();
    const merged = [];

    groups.flat().forEach((item) => {
        if (!item?.url) return;
        const key = `${item.type}:${item.sourceId || item.id}:${item.url}`;
        if (seen.has(key)) return;
        seen.add(key);
        merged.push(item);
    });

    return merged;
};

export const filterPlaylist = (items, filter) => {
    if (!filter || filter === 'all') return items;
    if (filter === 'online') return items.filter((v) => v.type === 'watch' || v.type === 'url');
    if (filter === 'offline') return items.filter((v) => v.type === 'saved' || v.type === 'file');
    return items.filter((v) => v.type === filter);
};

export const getTypeLabel = (type) => {
    switch (type) {
        case 'watch':
            return 'Watch';
        case 'saved':
            return 'Saved';
        case 'file':
            return 'File';
        default:
            return 'URL';
    }
};

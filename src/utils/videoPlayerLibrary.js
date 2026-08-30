import api from '../api/api';
import { getAllSavedVideos } from './useSavedVideos';

const PLAYLIST_STORAGE_KEY = 'videoPlayerCustomPlaylist';
const PLAYLIST_ORDER_KEY = 'videoPlayerPlaylistOrder';
const PLAY_QUEUE_KEY = 'videoPlayerPlayQueue';

export const MIN_PLAY_COUNT = 1;
export const MAX_PLAY_COUNT = 99;

export const SORT_OPTIONS = [
    { id: 'custom', label: 'Custom order' },
    { id: 'title-asc', label: 'Title A–Z' },
    { id: 'title-desc', label: 'Title Z–A' },
    { id: 'type', label: 'By source' },
];

export const FILTER_OPTIONS = [
    { id: 'all', label: 'All' },
    { id: 'server', label: 'Server' },
    { id: 'local', label: 'Local' },
    { id: 'watch', label: 'Watches' },
    { id: 'saved', label: 'Saved' },
    { id: 'url', label: 'Custom' },
];

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

export const loadPlaylistOrder = () => {
    try {
        const raw = localStorage.getItem(PLAYLIST_ORDER_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed.map(String) : [];
    } catch (_) {
        return [];
    }
};

export const savePlaylistOrder = (orderIds) => {
    if (!Array.isArray(orderIds) || orderIds.length === 0) {
        localStorage.removeItem(PLAYLIST_ORDER_KEY);
        return;
    }
    localStorage.setItem(PLAYLIST_ORDER_KEY, JSON.stringify(orderIds));
};

export const sortPlaylist = (items, sortMode, customOrder = []) => {
    if (!items?.length) return [];

    if (sortMode === 'title-asc') {
        return [...items].sort((a, b) => a.title.localeCompare(b.title));
    }
    if (sortMode === 'title-desc') {
        return [...items].sort((a, b) => b.title.localeCompare(a.title));
    }
    if (sortMode === 'type') {
        const typeOrder = { watch: 0, saved: 1, url: 2, file: 3 };
        return [...items].sort(
            (a, b) =>
                (typeOrder[a.type] ?? 9) - (typeOrder[b.type] ?? 9) ||
                a.title.localeCompare(b.title)
        );
    }

    if (sortMode === 'custom' && customOrder.length > 0) {
        const orderMap = new Map(customOrder.map((id, index) => [id, index]));
        return [...items].sort((a, b) => {
            const ai = orderMap.has(a.id) ? orderMap.get(a.id) : Number.MAX_SAFE_INTEGER;
            const bi = orderMap.has(b.id) ? orderMap.get(b.id) : Number.MAX_SAFE_INTEGER;
            if (ai !== bi) return ai - bi;
            return a.title.localeCompare(b.title);
        });
    }

    return items;
};

export const reorderPlaylistIds = (orderIds, fromIndex, toIndex) => {
    const next = [...orderIds];
    const [moved] = next.splice(fromIndex, 1);
    next.splice(toIndex, 0, moved);
    return next;
};

export const syncPlaylistOrder = (orderIds, items) => {
    const itemIds = items.map((item) => item.id);
    const kept = orderIds.filter((id) => itemIds.includes(id));
    const missing = itemIds.filter((id) => !kept.includes(id));
    return [...kept, ...missing];
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
    if (filter === 'server') {
        return items.filter((v) => v.type === 'watch' || (v.type === 'url' && v.online !== false));
    }
    if (filter === 'local') {
        return items.filter((v) => v.type === 'saved' || v.type === 'file' || v.online === false);
    }
    if (filter === 'online') return items.filter((v) => v.type === 'watch' || v.type === 'url');
    if (filter === 'offline') return items.filter((v) => v.type === 'saved' || v.type === 'file');
    return items.filter((v) => v.type === filter);
};

export const getSourceLabel = (video) => {
    if (!video) return '';
    if (video.type === 'watch') return 'Server · Watch';
    if (video.type === 'saved') return 'Local · Saved';
    if (video.type === 'file') return 'Local · File';
    return video.online === false ? 'Local · URL' : 'Server · URL';
};

export const clampPlayCount = (value) => {
    const parsed = Number.parseInt(value, 10);
    if (!Number.isFinite(parsed)) return MIN_PLAY_COUNT;
    return Math.min(MAX_PLAY_COUNT, Math.max(MIN_PLAY_COUNT, parsed));
};

export const normalizeQueueItem = (item) => {
    if (!item?.url) return null;
    const videoId = String(item.videoId || item.id || '');
    if (!videoId) return null;
    return {
        queueId: String(
            item.queueId ||
                `${videoId}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
        ),
        videoId,
        url: item.url,
        title: item.title || 'Untitled video',
        thumbnail: item.thumbnail || '',
        type: item.type || 'url',
        playCount: clampPlayCount(item.playCount),
    };
};

export const loadPlayQueue = () => {
    try {
        const raw = localStorage.getItem(PLAY_QUEUE_KEY);
        if (!raw) return [];
        const parsed = JSON.parse(raw);
        if (!Array.isArray(parsed)) return [];
        return parsed.map(normalizeQueueItem).filter(Boolean);
    } catch (_) {
        return [];
    }
};

export const savePlayQueue = (items) => {
    if (!Array.isArray(items) || items.length === 0) {
        localStorage.removeItem(PLAY_QUEUE_KEY);
        return;
    }
    localStorage.setItem(
        PLAY_QUEUE_KEY,
        JSON.stringify(
            items.map(({ queueId, videoId, url, title, thumbnail, type, playCount }) => ({
                queueId,
                videoId,
                url,
                title,
                thumbnail,
                type,
                playCount: clampPlayCount(playCount),
            })),
        ),
    );
};

export const videoToQueueItem = (video, playCount = MIN_PLAY_COUNT) =>
    normalizeQueueItem({
        videoId: video?.id,
        url: video?.url,
        title: video?.title,
        thumbnail: video?.thumbnail,
        type: video?.type,
        playCount,
    });

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

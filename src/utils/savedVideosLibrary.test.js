import React from 'react';
import { fireEvent, render, waitFor } from '@testing-library/react';
import { loadSavedPlaylistItems, filterPlaylist } from './videoPlayerLibrary';
import CacheSetting from '../components/setting/CacheSetting';

jest.mock('./useSavedVideos', () => ({
  SAVED_VIDEO_DB_NAME: 'savedVideoDb',
  getAllSavedVideos: jest.fn(),
  getSavedVideosHistory: jest.fn(),
  getSavedVideoSourceUrl: (v) => v?.sourceUrl || '',
}));
jest.mock('./toastUtils', () => ({
  showSuccessToast: jest.fn(),
  showErrorToast: jest.fn(),
}));
jest.mock('./watchCacheManager', () => ({}));
jest.mock('../api/api', () => ({}));

const { getAllSavedVideos, getSavedVideosHistory } = require('./useSavedVideos');

describe('saved videos in the video player', () => {
  it('lists device videos plus account-only saved videos without duplicates', async () => {
    getAllSavedVideos.mockImplementation((cb) =>
      cb([{ id: 'a', videoURL: 'blob:a', metadata: { caption: 'Local A' } }]),
    );
    getSavedVideosHistory.mockResolvedValue([
      { videoId: 'a', sourceUrl: 'https://x/a.mp4', metadata: { caption: 'Dup' } },
      { videoId: 'b', sourceUrl: 'https://x/b.mp4', metadata: { caption: 'Account B' } },
      { videoId: 'c', metadata: { caption: 'No URL' } },
    ]);

    const items = await loadSavedPlaylistItems();
    expect(items.map((i) => [i.id, i.online])).toEqual([
      ['saved-a', false],
      ['saved-b', true],
    ]);
    expect(filterPlaylist(items, 'saved')).toHaveLength(2);
    expect(filterPlaylist(items, 'offline').map((i) => i.id)).toEqual(['saved-a']);
  });

  it('still lists device videos when the account request fails', async () => {
    getAllSavedVideos.mockImplementation((cb) =>
      cb([{ id: 'a', videoURL: 'blob:a', metadata: {} }]),
    );
    getSavedVideosHistory.mockRejectedValue(new Error('offline'));
    const items = await loadSavedPlaylistItems();
    expect(items.map((i) => i.id)).toEqual(['saved-a']);
  });
});

describe('Clear Browser Cache', () => {
  it('keeps the saved videos database', async () => {
    const deleted = [];
    const originalIndexedDB = window.indexedDB;
    window.indexedDB = {
      databases: jest.fn().mockResolvedValue([
        { name: 'savedVideoDb' },
        { name: 'someCacheDb' },
      ]),
      deleteDatabase: jest.fn((name) => {
        deleted.push(name);
        const req = {};
        setTimeout(() => req.onsuccess && req.onsuccess());
        return req;
      }),
    };
    jest.useFakeTimers();
    const { getByText } = render(<CacheSetting />);
    fireEvent.click(getByText('Clear Browser Cache'));
    await waitFor(() => expect(deleted).toEqual(['someCacheDb']));
    jest.useRealTimers();
    window.indexedDB = originalIndexedDB;
  });
});

import React from 'react';
import { render } from '@testing-library/react';
import useMediaSession from './useMediaSession';

const Harness = (props) => {
  useMediaSession(props);
  return null;
};

const createMediaSessionMock = () => {
  const actionHandlers = {};

  return {
    mediaSession: {
      metadata: null,
      playbackState: 'none',
      setActionHandler: jest.fn((action, handler) => {
        actionHandlers[action] = handler;
      }),
      setPositionState: jest.fn(),
    },
    actionHandlers,
  };
};

describe('useMediaSession', () => {
  let originalMediaSession;
  let originalMediaMetadata;

  beforeEach(() => {
    originalMediaSession = navigator.mediaSession;
    originalMediaMetadata = global.MediaMetadata;
    global.MediaMetadata = class {
      constructor(payload) {
        Object.assign(this, payload);
      }
    };
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'mediaSession', {
      configurable: true,
      writable: true,
      value: originalMediaSession,
    });

    global.MediaMetadata = originalMediaMetadata;
    jest.clearAllMocks();
  });

  it('calls existing play handler from media session action', () => {
    const { mediaSession, actionHandlers } = createMediaSessionMock();
    Object.defineProperty(navigator, 'mediaSession', {
      configurable: true,
      writable: true,
      value: mediaSession,
    });

    const onPlay = jest.fn();

    render(
      <Harness
        enabled
        metadata={{ title: 'Track' }}
        playbackState="paused"
        handlers={{ play: onPlay }}
      />,
    );

    actionHandlers.play();

    expect(onPlay).toHaveBeenCalledTimes(1);
  });

  it('calls existing pause handler from media session action', () => {
    const { mediaSession, actionHandlers } = createMediaSessionMock();
    Object.defineProperty(navigator, 'mediaSession', {
      configurable: true,
      writable: true,
      value: mediaSession,
    });

    const onPause = jest.fn();

    render(
      <Harness
        enabled
        metadata={{ title: 'Track' }}
        playbackState="playing"
        handlers={{ pause: onPause }}
      />,
    );

    actionHandlers.pause();

    expect(onPause).toHaveBeenCalledTimes(1);
  });

  it('calls existing next and previous handlers', () => {
    const { mediaSession, actionHandlers } = createMediaSessionMock();
    Object.defineProperty(navigator, 'mediaSession', {
      configurable: true,
      writable: true,
      value: mediaSession,
    });

    const onNext = jest.fn();
    const onPrev = jest.fn();

    render(
      <Harness
        enabled
        metadata={{ title: 'Track' }}
        playbackState="playing"
        handlers={{
          nexttrack: onNext,
          previoustrack: onPrev,
        }}
      />,
    );

    actionHandlers.nexttrack();
    actionHandlers.previoustrack();

    expect(onNext).toHaveBeenCalledTimes(1);
    expect(onPrev).toHaveBeenCalledTimes(1);
  });

  it('updates metadata when current track changes', () => {
    const { mediaSession } = createMediaSessionMock();
    Object.defineProperty(navigator, 'mediaSession', {
      configurable: true,
      writable: true,
      value: mediaSession,
    });

    const { rerender } = render(
      <Harness
        enabled
        bindKey="track-a"
        metadata={{ title: 'Track A', artist: 'Artist A', album: 'Album A' }}
        playbackState="paused"
      />,
    );

    expect(navigator.mediaSession.metadata.title).toBe('Track A');

    rerender(
      <Harness
        enabled
        bindKey="track-b"
        metadata={{ title: 'Track B', artist: 'Artist B', album: 'Album B' }}
        playbackState="playing"
      />,
    );

    expect(navigator.mediaSession.metadata.title).toBe('Track B');
    expect(navigator.mediaSession.metadata.artist).toBe('Artist B');
    expect(navigator.mediaSession.playbackState).toBe('playing');
  });

  it('updates position state with valid values', () => {
    const { mediaSession } = createMediaSessionMock();
    Object.defineProperty(navigator, 'mediaSession', {
      configurable: true,
      writable: true,
      value: mediaSession,
    });

    render(
      <Harness
        enabled
        metadata={{ title: 'Track' }}
        playbackState="playing"
        positionState={{ duration: 200, position: 25, playbackRate: 1 }}
      />,
    );

    expect(navigator.mediaSession.setPositionState).toHaveBeenCalledWith({
      duration: 200,
      position: 25,
      playbackRate: 1,
    });
  });

  it('does not crash or set invalid position state', () => {
    const { mediaSession } = createMediaSessionMock();
    Object.defineProperty(navigator, 'mediaSession', {
      configurable: true,
      writable: true,
      value: mediaSession,
    });

    expect(() => {
      render(
        <Harness
          enabled
          metadata={{ title: 'Track' }}
          playbackState="playing"
          positionState={{ duration: Number.NaN, position: Infinity, playbackRate: 1 }}
        />,
      );
    }).not.toThrow();

    expect(navigator.mediaSession.setPositionState).not.toHaveBeenCalled();
  });

  it('does not crash when Media Session API is unavailable', () => {
    Object.defineProperty(navigator, 'mediaSession', {
      configurable: true,
      writable: true,
      value: undefined,
    });

    expect(() => {
      render(
        <Harness
          enabled
          metadata={{ title: 'Track' }}
          playbackState="playing"
          handlers={{ play: jest.fn() }}
        />,
      );
    }).not.toThrow();
  });

  it('clears the session when playback is disabled', () => {
    const { mediaSession } = createMediaSessionMock();
    Object.defineProperty(navigator, 'mediaSession', {
      configurable: true,
      writable: true,
      value: mediaSession,
    });

    const { rerender } = render(
      <Harness
        enabled
        bindKey="watch-1"
        metadata={{ title: 'Watch A' }}
        playbackState="playing"
      />,
    );

    expect(navigator.mediaSession.metadata.title).toBe('Watch A');

    rerender(
      <Harness
        enabled={false}
        bindKey="watch-1"
        metadata={{ title: 'Watch A' }}
        playbackState="paused"
      />,
    );

    expect(navigator.mediaSession.playbackState).toBe('none');
    expect(navigator.mediaSession.metadata).toBe(null);
  });

  it('uses live playback state when opening or hiding the page', () => {
    const { mediaSession } = createMediaSessionMock();
    Object.defineProperty(navigator, 'mediaSession', {
      configurable: true,
      writable: true,
      value: mediaSession,
    });

    const getPlaybackState = jest.fn(() => 'playing');
    const getPositionState = jest.fn(() => ({
      duration: 40,
      position: 12,
      playbackRate: 1,
    }));

    render(
      <Harness
        enabled
        bindKey="watch-1"
        metadata={{ title: 'Watch A' }}
        playbackState="paused"
        getPlaybackState={getPlaybackState}
        getPositionState={getPositionState}
      />,
    );

    expect(navigator.mediaSession.playbackState).toBe('playing');

    getPlaybackState.mockReturnValue('paused');
    document.dispatchEvent(new Event('visibilitychange'));

    expect(getPlaybackState).toHaveBeenCalled();
    expect(navigator.mediaSession.playbackState).toBe('paused');
    expect(navigator.mediaSession.setPositionState).toHaveBeenCalledWith({
      duration: 40,
      position: 12,
      playbackRate: 1,
    });
  });
});

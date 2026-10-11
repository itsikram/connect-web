import React, { useRef } from 'react';
import { act, cleanup, render } from '@testing-library/react';
import useBackgroundAudioHandoff from './useBackgroundAudioHandoff';

// jsdom has no media playback: model paused/muted state on the prototype.
const installMediaMocks = () => {
  const proto = window.HTMLMediaElement.prototype;
  const saved = {
    play: proto.play,
    pause: proto.pause,
    load: proto.load,
    paused: Object.getOwnPropertyDescriptor(proto, 'paused'),
    readyState: Object.getOwnPropertyDescriptor(proto, 'readyState'),
  };
  Object.defineProperty(proto, 'paused', {
    configurable: true,
    get() {
      return this._paused !== false;
    },
  });
  Object.defineProperty(proto, 'readyState', {
    configurable: true,
    get() {
      return 4;
    },
  });
  proto.play = function play() {
    if (this._paused !== false) {
      this._paused = false;
      this.dispatchEvent(new Event('play'));
    }
    return Promise.resolve();
  };
  proto.pause = function pause() {
    if (this._paused === false) {
      this._paused = true;
      this.dispatchEvent(new Event('pause'));
    }
  };
  proto.load = function load() {};
  return () => {
    proto.play = saved.play;
    proto.pause = saved.pause;
    proto.load = saved.load;
    if (saved.paused) Object.defineProperty(proto, 'paused', saved.paused);
    if (saved.readyState) Object.defineProperty(proto, 'readyState', saved.readyState);
  };
};

let hidden = false;
const setHidden = (value) => {
  hidden = value;
  document.dispatchEvent(new Event('visibilitychange'));
};

const SRC = 'http://localhost/video.mp4';
let api;
let videoEl;

const Player = ({ enabled = true }) => {
  const videoRef = useRef(null);
  api = useBackgroundAudioHandoff(videoRef, { src: SRC, enabled });
  return <video ref={(node) => { videoRef.current = node; videoEl = node; }} src={SRC} />;
};

const flush = () => act(() => Promise.resolve().then(() => Promise.resolve()));

describe('useBackgroundAudioHandoff', () => {
  let restore;

  beforeAll(() => {
    Object.defineProperty(document, 'visibilityState', {
      configurable: true,
      get: () => (hidden ? 'hidden' : 'visible'),
    });
    Object.defineProperty(document, 'hidden', {
      configurable: true,
      get: () => hidden,
    });
  });

  beforeEach(() => {
    jest.useFakeTimers();
    hidden = false;
    restore = installMediaMocks();
  });

  afterEach(() => {
    cleanup();
    restore();
    jest.useRealTimers();
  });

  it('keeps playing when iOS pauses the video just before the page hides', async () => {
    const { unmount } = render(<Player />);
    const audio = api.audioRef.current;

    await act(async () => {
      await videoEl.play();
    });
    await flush();
    expect(audio.paused).toBe(false);
    expect(audio.muted).toBe(true);

    // System pause while still "visible", then the lock hides the page.
    act(() => videoEl.pause());
    act(() => setHidden(true));
    await flush();
    act(() => jest.advanceTimersByTime(1000));

    expect(audio.paused).toBe(false);
    expect(audio.muted).toBe(false);
    expect(videoEl.muted).toBe(true);
    expect(videoEl.paused).toBe(true);

    // Unlock: video takes over, the audio goes back to a muted companion.
    act(() => setHidden(false));
    await flush();
    expect(videoEl.paused).toBe(false);
    expect(videoEl.muted).toBe(false);
    expect(audio.muted).toBe(true);

    unmount();
    expect(audio.paused).toBe(true);
  });

  it('treats a pause that is not followed by hiding as a user pause', async () => {
    render(<Player />);
    const audio = api.audioRef.current;
    await act(async () => {
      await videoEl.play();
    });
    await flush();

    act(() => videoEl.pause());
    act(() => jest.advanceTimersByTime(1000));
    expect(audio.paused).toBe(true);

    act(() => setHidden(true));
    await flush();
    expect(audio.paused).toBe(true);
  });
});

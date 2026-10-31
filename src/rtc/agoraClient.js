import AgoraRTC from 'agora-rtc-sdk-ng';

export function createRtcClient() {
  const client = AgoraRTC.createClient({ mode: 'rtc', codec: 'vp8' });
  return client;
}

export async function createLocalTracks({ audio = true, video = true, cameraId } = {}) {
  const micConfig = audio ? {} : false;
  const camConfig = video ? (cameraId ? { cameraId } : {}) : false;
  const tracks = await AgoraRTC.createMicrophoneAndCameraTracks(micConfig, camConfig);
  const [microphoneTrack, cameraTrack] = tracks;
  return { microphoneTrack, cameraTrack };
}

export async function switchCamera(cameraTrack, nextDeviceId) {
  if (!cameraTrack) return;
  await cameraTrack.setDevice(nextDeviceId);
}

export async function toggleTrackEnabled(track, enabled) {
  if (!track) return;
  await track.setEnabled(enabled);
}

export async function leaveRtc(client, tracks = []) {
  try {
    tracks.forEach(t => {
      try { t.stop && t.stop(); } catch {}
      try { t.close && t.close(); } catch {}
    });
    if (client) {
      await client.leave();
      client.removeAllListeners();
    }
  } catch {}
}

// Join failures that clear up by themselves: a network blip, or my previous
// session in the channel (a reload, a dropped connection) that Agora has not
// timed out yet. Bad tokens / app ids fail the same way every time.
const RETRYABLE_JOIN_ERRORS = new Set([
  'UID_CONFLICT',
  'CAN_NOT_GET_GATEWAY_SERVER',
  'NETWORK_ERROR',
  'NETWORK_TIMEOUT',
  'WS_ABORT',
  'WS_DISCONNECT',
  'WS_ERR',
]);

export function isRetryableJoinError(error) {
  const message = String(error?.message || error || '');
  if (/token|vendor key|dynamic key|app ?id/i.test(message)) return false;
  return RETRYABLE_JOIN_ERRORS.has(String(error?.code || '')) ||
    /UID_CONFLICT|NETWORK_ERROR|NETWORK_TIMEOUT/.test(message);
}

/** client.join with a few spaced retries for the failures above. */
export async function joinWithRetry(client, { appId, channel, token, uid }, { attempts = 4, isCancelled = () => false } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await client.join(appId, channel, token, uid);
    } catch (error) {
      if (attempt >= attempts || isCancelled() || !isRetryableJoinError(error)) throw error;
      console.warn(`Agora join failed (attempt ${attempt}), retrying:`, error?.code || error?.message || error);
      await new Promise((resolve) => setTimeout(resolve, 1000 * attempt));
      if (isCancelled()) throw error;
    }
  }
}

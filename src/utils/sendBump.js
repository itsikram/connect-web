import socket from "../common/socket";
import api from "../api/api";
import { playBumpSound, unlockAudio } from "./audioUnlock";

const BUMP_COOLDOWN_MS = 3000;
const inFlightKeys = new Set();
const lastSentAt = new Map();

/**
 * Send a bump to a friend. Uses socket when connected (server also pushes if
 * they are offline). HTTP is only a fallback so one click cannot fire twice.
 */
export const sendBumpToFriend = async (friendProfileId, myProfileId) => {
  const friendProfile = String(friendProfileId || "");
  const myProfile = String(myProfileId || "");
  if (!friendProfile || !myProfile) {
    throw new Error("Missing bump profile ids");
  }
  if (friendProfile === myProfile) {
    throw new Error("Cannot bump yourself");
  }

  const key = `${myProfile}->${friendProfile}`;
  const now = Date.now();
  if (inFlightKeys.has(key)) return { ok: true, skipped: true };
  if (now - (lastSentAt.get(key) || 0) < BUMP_COOLDOWN_MS) {
    return { ok: true, skipped: true };
  }

  inFlightKeys.add(key);
  lastSentAt.set(key, now);

  try {
    try {
      await unlockAudio();
    } catch (_e) {}
    playBumpSound();

    const connected =
      typeof socket.connected === "boolean" ? socket.connected : true;

    if (connected) {
      socket.emit("bump", { friendProfile, myProfile });
      return { ok: true };
    }

    await api.post("/bump", { friendProfile, myProfile });
    return { ok: true };
  } catch (error) {
    lastSentAt.delete(key);
    throw error;
  } finally {
    inFlightKeys.delete(key);
  }
};

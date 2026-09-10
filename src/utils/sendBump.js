import socket from "../common/socket";
import api from "../api/api";
import { unlockAudio } from "./audioUnlock";

const BUMP_COOLDOWN_MS = 3000;
const inFlightKeys = new Set();
const lastSentAt = new Map();

/**
 * Send a bump to a connect. Uses socket when connected (server also pushes if
 * they are offline). HTTP is only a fallback so one click cannot fire twice.
 * The knock sound must play only on the recipient (via `bumpUser`), never here.
 */
export const sendBumpToConnect = async (connectProfileId, myProfileId) => {
  const connectProfile = String(connectProfileId || "");
  const myProfile = String(myProfileId || "");
  if (!connectProfile || !myProfile) {
    throw new Error("Missing bump profile ids");
  }
  if (connectProfile === myProfile) {
    throw new Error("Cannot bump yourself");
  }

  const key = `${myProfile}->${connectProfile}`;
  const now = Date.now();
  if (inFlightKeys.has(key)) return { ok: true, skipped: true };
  if (now - (lastSentAt.get(key) || 0) < BUMP_COOLDOWN_MS) {
    return { ok: true, skipped: true };
  }

  inFlightKeys.add(key);
  lastSentAt.set(key, now);

  try {
    // Keep audio unlocked from this click so a later incoming bump can play.
    try {
      await unlockAudio();
    } catch (_e) {}

    const connected =
      typeof socket.connected === "boolean" ? socket.connected : true;

    if (connected) {
      socket.emit("bump", { connectProfile, myProfile });
      return { ok: true };
    }

    await api.post("/bump", { connectProfile, myProfile });
    return { ok: true };
  } catch (error) {
    lastSentAt.delete(key);
    throw error;
  } finally {
    inFlightKeys.delete(key);
  }
};

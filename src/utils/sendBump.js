import socket from "../common/socket";
import api from "../api/api";
import { playBumpSound, unlockAudio } from "./audioUnlock";

/**
 * Send a bump to a friend. Socket delivers instantly while they are online
 * (including an unfocused tab). HTTP is a fallback that also triggers push.
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

  try {
    await unlockAudio();
  } catch (_e) {}
  playBumpSound();

  socket.emit("bump", { friendProfile, myProfile });

  try {
    await api.post("/bump", { friendProfile, myProfile });
  } catch (error) {
    // Socket already went out; HTTP failure should not hide a successful bump.
    console.warn("Bump HTTP fallback failed:", error);
  }
};

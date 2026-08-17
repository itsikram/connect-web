/**
 * AI Agent Action Executor
 */

import api from "../../../api/api";
import socket from "../../../common/socket";
import { getFriendDisplayName } from "./agentIntentParser";

/**
 * Execute an agent action.
 *
 * @param {object} opts
 * @param {string}   opts.action       – action type constant
 * @param {object}   [opts.friend]     – resolved friend profile
 * @param {string}   [opts.targetRoute]– pre-resolved static route (for NAVIGATE)
 * @param {string}   [opts.subPath]    – profile sub-path (for NAVIGATE_PROFILE)
 * @param {string}   [opts.label]      – human-readable destination label
 * @param {object}   opts.myProfile    – logged-in user's Redux profile
 * @param {function} opts.navigate     – react-router navigate()
 * @param {function} [opts.onClose]    – close the AI Agent modal
 * @returns {Promise<{ success: boolean, message: string, location?: object }>}
 */
export const executeAction = async ({
  action,
  friend,
  targetRoute,
  subPath,
  label,
  myProfile,
  navigate,
  onClose,
}) => {
  const friendName = friend ? getFriendDisplayName(friend) : null;

  const go = (path) => {
    navigate(path);
    if (onClose) onClose();
  };

  try {
    switch (action) {
      // ── Navigation: static / my-profile routes ──────────────────────────────
      case "NAVIGATE": {
        const dest = label || targetRoute || "page";

        // Special tokens resolved at execution time (need myProfile._id)
        if (targetRoute === "MY_PROFILE") {
          go(`/${myProfile._id}`);
          return { success: true, message: `👤 Opening your profile…` };
        }
        if (targetRoute === "MY_PROFILE_FRIENDS") {
          go(`/${myProfile._id}/friends`);
          return { success: true, message: `👥 Opening your friends list…` };
        }
        if (targetRoute === "MY_PROFILE_IMAGES") {
          go(`/${myProfile._id}/images`);
          return { success: true, message: `🖼️ Opening your photos…` };
        }
        if (targetRoute === "MY_PROFILE_VIDEOS") {
          go(`/${myProfile._id}/videos`);
          return { success: true, message: `🎬 Opening your videos…` };
        }
        if (targetRoute === "MY_PROFILE_ABOUT") {
          go(`/${myProfile._id}/about`);
          return { success: true, message: `📋 Opening your about page…` };
        }

        if (targetRoute) {
          go(targetRoute);
          return { success: true, message: `🧭 Navigating to ${dest}…` };
        }
        return { success: false, message: `I couldn't find that page.` };
      }

      // ── Navigation: friend profile / sub-page ───────────────────────────────
      case "NAVIGATE_PROFILE": {
        const path = `/${friend._id}${subPath || ""}`;
        const sub = subPath ? subPath.replace("/", "") : "profile";
        go(path);
        return {
          success: true,
          message: `🧭 Opening ${friendName}'s ${sub || "profile"}…`,
        };
      }

      // ── Video Call ─────────────────────────────────────────────────────────
      case "VIDEO_CALL": {
        const channelName = `${myProfile._id}-${friend._id}`;
        window.dispatchEvent(
          new CustomEvent("startVideoCall", {
            detail: {
              to: friend._id,
              channelName,
              callerName: friendName,
              callerProfilePic: friend.profilePic,
            },
          }),
        );
        socket.emit("video-call", {
          to: friend._id,
          channelName,
          isAudio: false,
        });
        if (onClose) onClose();
        return {
          success: true,
          message: `📹 Starting video call with ${friendName}…`,
        };
      }

      // ── Audio Call ─────────────────────────────────────────────────────────
      case "AUDIO_CALL": {
        const channelName = `${myProfile._id}-${friend._id}`;
        window.dispatchEvent(
          new CustomEvent("startAudioCall", {
            detail: {
              to: friend._id,
              channelName,
              callerName: friendName,
              callerProfilePic: friend.profilePic,
            },
          }),
        );
        socket.emit("audio-call", {
          to: friend._id,
          channelName,
          isAudio: true,
        });
        if (onClose) onClose();
        return {
          success: true,
          message: `📞 Starting audio call with ${friendName}…`,
        };
      }

      // ── Open Chat ──────────────────────────────────────────────────────────
      case "SEND_MESSAGE": {
        go(`/message/${friend._id}`);
        return {
          success: true,
          message: `💬 Opening chat with ${friendName}…`,
        };
      }

      // ── Bump ───────────────────────────────────────────────────────────────
      case "BUMP": {
        await api.post("/bump", {
          friendProfile: friend._id,
          myProfile: myProfile._id,
        });
        return { success: true, message: `👊 Bump sent to ${friendName}!` };
      }

      // ── Create Ludo ────────────────────────────────────────────────────────
      case "CREATE_LUDO": {
        go("/ludo-game");
        return { success: true, message: "🎮 Opening Ludo game…" };
      }

      // ── Invite to Ludo ─────────────────────────────────────────────────────
      case "INVITE_LUDO": {
        try {
          localStorage.setItem(
            "ludo_invite_target",
            JSON.stringify({ friendId: friend._id, friendName }),
          );
        } catch (_) {}
        go("/ludo-game");
        return {
          success: true,
          message: `🎮 Navigating to Ludo to invite ${friendName}…`,
        };
      }

      // ── Block ──────────────────────────────────────────────────────────────
      case "BLOCK": {
        const res = await api.post("friend/block", { friendId: friend._id });
        return res.status === 200
          ? { success: true, message: `🚫 ${friendName} has been blocked.` }
          : { success: false, message: `Failed to block ${friendName}.` };
      }

      // ── Unblock ────────────────────────────────────────────────────────────
      case "UNBLOCK": {
        const res = await api.post("friend/unblock", { friendId: friend._id });
        return res.status === 200
          ? { success: true, message: `✅ ${friendName} has been unblocked.` }
          : { success: false, message: `Failed to unblock ${friendName}.` };
      }

      // ── View Profile ───────────────────────────────────────────────────────
      case "VIEW_PROFILE": {
        go(`/${friend._id}`);
        return {
          success: true,
          message: `👤 Opening ${friendName}'s profile…`,
        };
      }

      // ── Get Location ───────────────────────────────────────────────────────
      case "GET_LOCATION": {
        const loc = friend.lastLocation || null;
        if (loc?.latitude && loc?.longitude) {
          return {
            success: true,
            message: `📍 ${friendName}'s last location: ${loc.latitude.toFixed(5)}, ${loc.longitude.toFixed(5)}`,
            location: loc,
          };
        }
        if (friend.presentAddress)
          return {
            success: true,
            message: `📍 ${friendName}'s address: ${friend.presentAddress}`,
            location: null,
          };
        if (friend.permanentAddress)
          return {
            success: true,
            message: `📍 ${friendName}'s address: ${friend.permanentAddress}`,
            location: null,
          };
        return {
          success: false,
          message: `📍 ${friendName}'s location is not available.`,
          location: null,
        };
      }

      // ── Add Friend ─────────────────────────────────────────────────────────
      case "ADD_FRIEND": {
        await api.post("/friend/sendRequest", { profile: friend._id });
        return {
          success: true,
          message: `✉️ Friend request sent to ${friendName}!`,
        };
      }

      // ── Unfriend ───────────────────────────────────────────────────────────
      case "UNFRIEND": {
        await api.post("/friend/removeFriend", { profile: friend._id });
        return {
          success: true,
          message: `❌ ${friendName} removed from your friends.`,
        };
      }

      // ── List Friends / Open Friends ────────────────────────────────────────
      case "LIST_FRIENDS":
      case "OPEN_FRIENDS": {
        go("/friends");
        return { success: true, message: "👥 Opening friends page…" };
      }

      // ── Open Messages ──────────────────────────────────────────────────────
      case "OPEN_MESSAGES": {
        go("/message");
        return { success: true, message: "💬 Opening messages…" };
      }

      default:
        return { success: false, message: "Unknown action." };
    }
  } catch (error) {
    console.error("[AgentActions]", action, error);
    return {
      success: false,
      message: `Something went wrong: ${error?.response?.data?.message || error?.message || "Unknown error"}`,
    };
  }
};

/**
 * Returns display metadata for an action type.
 */
export const getActionMeta = (action) => {
  const map = {
    VIDEO_CALL: { label: "Video Call", icon: "fa-video", color: "#6366f1" },
    AUDIO_CALL: { label: "Audio Call", icon: "fa-phone-alt", color: "#10b981" },
    SEND_MESSAGE: {
      label: "Message",
      icon: "fa-comment-dots",
      color: "#3b82f6",
    },
    BUMP: { label: "Bump", icon: "fa-hand-rock", color: "#f59e0b" },
    INVITE_LUDO: { label: "Invite to Ludo", icon: "fa-dice", color: "#8b5cf6" },
    CREATE_LUDO: { label: "Play Ludo", icon: "fa-gamepad", color: "#8b5cf6" },
    BLOCK: { label: "Block", icon: "fa-ban", color: "#ef4444" },
    UNBLOCK: { label: "Unblock", icon: "fa-check-circle", color: "#10b981" },
    VIEW_PROFILE: { label: "View Profile", icon: "fa-user", color: "#6366f1" },
    NAVIGATE_PROFILE: {
      label: "Go to Profile",
      icon: "fa-external-link-alt",
      color: "#6366f1",
    },
    GET_LOCATION: {
      label: "Get Location",
      icon: "fa-map-marker-alt",
      color: "#f97316",
    },
    ADD_FRIEND: { label: "Add Friend", icon: "fa-user-plus", color: "#3b82f6" },
    UNFRIEND: { label: "Unfriend", icon: "fa-user-times", color: "#ef4444" },
    NAVIGATE: { label: "Go", icon: "fa-arrow-right", color: "#6366f1" },
    LIST_FRIENDS: { label: "Friends Page", icon: "fa-users", color: "#6366f1" },
    OPEN_MESSAGES: { label: "Messages", icon: "fa-envelope", color: "#3b82f6" },
    OPEN_FRIENDS: { label: "Friends Page", icon: "fa-users", color: "#6366f1" },
  };
  return map[action] || { label: action, icon: "fa-bolt", color: "#6366f1" };
};

export default { executeAction, getActionMeta };

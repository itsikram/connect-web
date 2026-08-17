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
  searchQuery,
  messageText,
  myProfile,
  navigate,
  onClose,
}) => {
  const friendName = friend ? getFriendDisplayName(friend) : null;

  const go = (path) => {
    navigate(path);
    if (onClose) onClose();
  };

  const openStickyChat = (profileId) => {
    window.dispatchEvent(
      new CustomEvent("openStickyChat", {
        detail: { profileId },
      }),
    );
    if (onClose) onClose();
  };

  const buildProfilePath = (profile, nestedPath = "") => {
    const profileIdentifier = profile?._id;
    if (!profileIdentifier) return null;
    if (!nestedPath) return `/${profileIdentifier}/`;
    const normalizedNestedPath = nestedPath.startsWith("/")
      ? nestedPath
      : `/${nestedPath}`;
    return `/${profileIdentifier}${normalizedNestedPath}`;
  };

  try {
    switch (action) {
      // ── Search / Play Video ────────────────────────────────────────────────────
      case "SEARCH_VIDEO": {
        const query = (searchQuery || "").trim();
        if (!query) {
          return {
            success: false,
            message: "What video would you like to search for?",
          };
        }
        try {
          const res = await api.get("/search", { params: { input: query } });
          const videos = Array.isArray(res.data?.videos) ? res.data.videos : [];
          return {
            success: true,
            type: "video-results",
            videos,
            query,
            message:
              videos.length > 0
                ? `Found ${videos.length} video${videos.length === 1 ? "" : "s"} for "${query}":`
                : `No videos found for "${query}".`,
          };
        } catch (err) {
          return {
            success: false,
            message: `Search failed: ${err?.message || "Unknown error"}`,
          };
        }
      }

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
        const path = buildProfilePath(friend, subPath || "");
        const sub = subPath ? subPath.replace("/", "") : "profile";
        if (!path) {
          return {
            success: false,
            message: `I couldn't determine ${friendName || "that user's"} profile link.`,
          };
        }
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
        openStickyChat(friend._id);
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
        const path = buildProfilePath(friend);
        if (!path) {
          return {
            success: false,
            message: `I couldn't determine ${friendName || "that user's"} profile link.`,
          };
        }
        go(path);
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

      // ── Get Bio / VIO ──────────────────────────────────────────────────────
      case "GET_BIO": {
        if (friend.bio && friend.bio.trim()) {
          return {
            success: true,
            message: `📝 ${friendName}'s bio: "${friend.bio}"`,
          };
        }
        return {
          success: false,
          message: `📝 ${friendName} hasn't added a bio yet.`,
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

      // ── Open Messages ──────────────────────────────────────────────────
      case "OPEN_MESSAGES": {
        go("/message");
        return { success: true, message: "💬 Opening messages…" };
      }

      // ── Create Note ────────────────────────────────────────────────────
      case "CREATE_NOTE": {
        const noteContent = label || searchQuery || "";
        if (!noteContent.trim()) {
          return {
            success: false,
            message: "What would you like to note?",
          };
        }
        try {
          await api.post("/notes", {
            title: noteContent.substring(0, 100),
            content: noteContent,
            createdBy: myProfile._id,
          });
          return {
            success: true,
            message: `📝 Note created: "${noteContent.substring(0, 50)}${noteContent.length > 50 ? "..." : ""}"`,
          };
        } catch (err) {
          return {
            success: false,
            message: `Failed to create note: ${err?.message || "Unknown error"}`,
          };
        }
      }

      // ── Edit Note ──────────────────────────────────────────────────────
      case "EDIT_NOTE": {
        const newContent = label || searchQuery || "";
        if (!newContent.trim()) {
          return {
            success: false,
            message: "What should the note say?",
          };
        }
        try {
          // This would need a note ID, typically from context
          // For now, we'll update the most recent note
          await api.put("/notes/latest", {
            content: newContent,
            updatedAt: new Date(),
          });
          return {
            success: true,
            message: `📝 Note updated: "${newContent.substring(0, 50)}${newContent.length > 50 ? "..." : ""}"`,
          };
        } catch (err) {
          return {
            success: false,
            message: `Failed to edit note: ${err?.message || "Unknown error"}`,
          };
        }
      }

      // ── Delete Note ────────────────────────────────────────────────────
      case "DELETE_NOTE": {
        try {
          await api.delete("/notes/latest");
          return {
            success: true,
            message: "🗑️ Note deleted.",
          };
        } catch (err) {
          return {
            success: false,
            message: `Failed to delete note: ${err?.message || "Unknown error"}`,
          };
        }
      }

      // ── Create Task ────────────────────────────────────────────────────
      case "CREATE_TASK": {
        const taskContent = label || searchQuery || "";
        if (!taskContent.trim()) {
          return {
            success: false,
            message: "What task would you like to create?",
          };
        }
        try {
          await api.post("/tasks", {
            title: taskContent.substring(0, 100),
            description: taskContent,
            status: "pending",
            createdBy: myProfile._id,
          });
          return {
            success: true,
            message: `✓ Task created: "${taskContent.substring(0, 50)}${taskContent.length > 50 ? "..." : ""}"`,
          };
        } catch (err) {
          return {
            success: false,
            message: `Failed to create task: ${err?.message || "Unknown error"}`,
          };
        }
      }

      // ── Edit Task ──────────────────────────────────────────────────────
      case "EDIT_TASK": {
        const newTaskContent = label || searchQuery || "";
        if (!newTaskContent.trim()) {
          return {
            success: false,
            message: "What should the task be?",
          };
        }
        try {
          await api.put("/tasks/latest", {
            description: newTaskContent,
            updatedAt: new Date(),
          });
          return {
            success: true,
            message: `✓ Task updated: "${newTaskContent.substring(0, 50)}${newTaskContent.length > 50 ? "..." : ""}"`,
          };
        } catch (err) {
          return {
            success: false,
            message: `Failed to edit task: ${err?.message || "Unknown error"}`,
          };
        }
      }

      // ── Delete Task ────────────────────────────────────────────────────
      case "DELETE_TASK": {
        try {
          await api.delete("/tasks/latest");
          return {
            success: true,
            message: "🗑️ Task deleted.",
          };
        } catch (err) {
          return {
            success: false,
            message: `Failed to delete task: ${err?.message || "Unknown error"}`,
          };
        }
      }

      // ── Add Recovery Data ──────────────────────────────────────────────
      case "ADD_RECOVERY_DATA": {
        const recoveryData = label || searchQuery || "";
        if (!recoveryData.trim()) {
          return {
            success: false,
            message: "Please provide recovery data or code.",
          };
        }
        try {
          await api.post("/profile/recovery-data", {
            recoveryCode: recoveryData,
            userId: myProfile._id,
            addedAt: new Date(),
          });
          return {
            success: true,
            message: `🔐 Recovery data saved securely.`,
          };
        } catch (err) {
          return {
            success: false,
            message: `Failed to save recovery data: ${err?.message || "Unknown error"}`,
          };
        }
      }

      // ── Update Language Settings ────────────────────────────────────────
      case "UPDATE_LANGUAGE_SETTINGS": {
        const language = (label || searchQuery || "").trim().toLowerCase();
        const supportedLanguages = [
          "english",
          "bengali",
          "spanish",
          "french",
          "hindi",
        ];

        if (
          !language ||
          !supportedLanguages.some((lang) => language.includes(lang))
        ) {
          return {
            success: false,
            message: `Supported languages: ${supportedLanguages.join(", ")}. Which would you prefer?`,
          };
        }

        try {
          const selectedLang = supportedLanguages.find((lang) =>
            language.includes(lang),
          );
          await api.put("/profile/language-settings", {
            preferredLanguage: selectedLang,
            userId: myProfile._id,
          });
          return {
            success: true,
            message: `🌐 Language preference updated to ${selectedLang}.`,
          };
        } catch (err) {
          return {
            success: false,
            message: `Failed to update language settings: ${err?.message || "Unknown error"}`,
          };
        }
      }

      // ── Send Message to User ──────────────────────────────────────────
      case "SEND_MESSAGE_TO_USER": {
        const messageContent = (
          messageText ||
          label ||
          searchQuery ||
          ""
        ).trim();
        if (!messageContent) {
          return {
            success: false,
            message: "What message would you like to send?",
          };
        }
        if (!friend) {
          return {
            success: false,
            message: "Please specify which user to send the message to.",
          };
        }
        try {
          const room = [myProfile._id, friend._id].sort().join("_");
          await api.post("/message/send", {
            room,
            senderId: myProfile._id,
            receiverId: friend._id,
            message: messageContent,
            attachment: "",
            parent: false,
            messageType: "text",
          });

          // Add a small delay to ensure the message is processed on the backend
          // before opening the chat, so the message appears immediately when chat opens
          await new Promise((resolve) => setTimeout(resolve, 300));

          openStickyChat(friend._id);
          return {
            success: true,
            message: `✅ Message sent to ${friendName}. Opening chat…`,
          };
        } catch (err) {
          return {
            success: false,
            message: `Failed to send message: ${err?.response?.data?.reason || err?.response?.data?.message || err?.message || "Unknown error"}`,
          };
        }
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
    GET_BIO: {
      label: "Get Bio",
      icon: "fa-file-alt",
      color: "#8b5cf6",
    },
    ADD_FRIEND: { label: "Add Friend", icon: "fa-user-plus", color: "#3b82f6" },
    UNFRIEND: { label: "Unfriend", icon: "fa-user-times", color: "#ef4444" },
    NAVIGATE: { label: "Go", icon: "fa-arrow-right", color: "#6366f1" },
    LIST_FRIENDS: { label: "Friends Page", icon: "fa-users", color: "#6366f1" },
    OPEN_MESSAGES: { label: "Messages", icon: "fa-envelope", color: "#3b82f6" },
    OPEN_FRIENDS: { label: "Friends Page", icon: "fa-users", color: "#6366f1" },
    CREATE_NOTE: {
      label: "Create Note",
      icon: "fa-sticky-note",
      color: "#f59e0b",
    },
    EDIT_NOTE: { label: "Edit Note", icon: "fa-edit", color: "#f59e0b" },
    DELETE_NOTE: { label: "Delete Note", icon: "fa-trash", color: "#ef4444" },
    CREATE_TASK: { label: "Create Task", icon: "fa-tasks", color: "#3b82f6" },
    EDIT_TASK: { label: "Edit Task", icon: "fa-edit", color: "#3b82f6" },
    DELETE_TASK: { label: "Delete Task", icon: "fa-trash", color: "#ef4444" },
    ADD_RECOVERY_DATA: {
      label: "Add Recovery Data",
      icon: "fa-shield-alt",
      color: "#10b981",
    },
    UPDATE_LANGUAGE_SETTINGS: {
      label: "Change Language",
      icon: "fa-globe",
      color: "#6366f1",
    },
    SEND_MESSAGE_TO_USER: {
      label: "Send Message",
      icon: "fa-paper-plane",
      color: "#3b82f6",
    },
  };
  return map[action] || { label: action, icon: "fa-bolt", color: "#6366f1" };
};

const agentActions = { executeAction, getActionMeta };

export default agentActions;

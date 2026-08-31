/**
 * AI Agent Action Executor
 */

import api from "../../../api/api";
import socket from "../../../common/socket";
import { getFriendDisplayName } from "./agentIntentParser";
import { sendBumpToFriend } from "../../../utils/sendBump";
import { generatePostCaption } from "../../../services/geminiService";
import {
  extractCaptionFromText,
  isPlaceholderCaption,
} from "./agentCatalog";
import store from "../../../store";
import { addPost, removePost } from "../../../services/actions/postActions";
import { newMessage } from "../../../services/actions/messageActions";
import { loadSettings } from "../../../services/actions/settingsActions";
import { applyThemeMode } from "../../../utils/applyThemeMode";
import CacheManager from "../../../utils/cacheManager";
import { getUserFromStorage } from "../../../utils/storageUtils";
import {
  getYtDownloadApiUrl,
  isOffline,
  normalizeServerUrl,
} from "../../../utils/offlineUtils";
import { generateGameId, emitSocket } from "../../../pages/ludo/utils/socketHelpers";
import { getRecoverySupportMessage } from "../../../utils/rehabApi";
import {
  extractYouTubeUrl,
  extractMediaUrl,
  looksLikeAudioDownload,
  shouldSkipWatchPost,
  parseQualityFromText,
  parseCalendarWhen,
  stripDatePhrases,
  matchByText,
  parseSettingsPatch,
  parseHealthLog,
  parseRecoveryLog,
  readJsonStorage,
  writeJsonStorage,
  emitConnectEvent,
  todayKey,
} from "./agentActionHelpers";

const CALENDAR_STORAGE_KEY = "calendarApp";
const HABITS_STORAGE_KEY = "habitsApp";
const HEALTH_WEIGHT_LOG_KEY = "connectWeightLog";
const HEALTH_MEAL_LOG_KEY = "connectMealLog";
const HEALTH_WELLNESS_KEY = "connectHealthWellness";
const REHAB_PROFILE_KEY = "connectRehabProfile";
const CRAVING_LOG_KEY = "connectCravingLog";
const SUPPORT_CHAT_KEY = "connectSupportChat";

const loadLocalList = (key) => {
  const value = readJsonStorage(key, []);
  return Array.isArray(value) ? value : [];
};

const saveLocalList = (key, items, eventName) => {
  writeJsonStorage(key, items);
  emitConnectEvent(eventName, { items });
};

const clipText = (value, max = 180) => {
  const text = String(value || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!text) return "";
  return text.length <= max ? text : `${text.slice(0, max - 1)}…`;
};

const unwrapList = (payload, keys = []) => {
  if (Array.isArray(payload)) return payload;
  for (let i = 0; i < keys.length; i += 1) {
    const value = payload?.[keys[i]];
    if (Array.isArray(value)) return value;
  }
  return [];
};

const formatNamedPerson = (profile) =>
  getFriendDisplayName(profile) || profile?.username || "Unknown";

const matchProfileByName = (profiles, name) => {
  const query = String(name || "")
    .trim()
    .toLowerCase();
  if (!query || !Array.isArray(profiles)) return [];
  return profiles.filter((profile) => {
    const haystack = [
      getFriendDisplayName(profile),
      profile?.fullName,
      profile?.username,
      profile?.banglaName,
      profile?.nickname,
      profile?.user?.firstName,
      profile?.user?.surname,
      profile?.user?.username,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();
    return haystack.includes(query);
  });
};

const getAccessToken = () => getUserFromStorage()?.accessToken || "";

const startYoutubeDownloadJob = async ({
  url,
  audioOnly = false,
  postAsWatch = true,
  quality = 2160,
}) => {
  if (isOffline()) {
    throw new Error("YouTube download needs an internet connection.");
  }
  const apiUrl = normalizeServerUrl(getYtDownloadApiUrl());
  const encoded = encodeURIComponent(
    String(url || "").replace("m.youtube.com", "www.youtube.com"),
  );
  const heightParam = !audioOnly && quality ? `&height=${quality}` : "";
  const watchParam = `&post_as_watch=${postAsWatch && !audioOnly ? "true" : "false"}`;
  const audioParam = audioOnly ? "&audio_only=true" : "";
  const ext = audioOnly ? "mp3" : "mp4";
  const requestUrl = `${apiUrl}/download?url=${encoded}&ext=${ext}${heightParam}&disposition=inline&link_only=true&async_job=true${watchParam}${audioParam}`;
  const token = getAccessToken();
  const response = await fetch(`${requestUrl}&_ts=${Date.now()}`, {
    method: "GET",
    headers: {
      Accept: "application/json",
      ...(token ? { Authorization: token } : {}),
    },
    cache: "no-store",
  });
  const json = await response.json().catch(() => null);
  if (!response.ok) {
    throw new Error(json?.error || json?.message || `Download failed (${response.status})`);
  }
  return json;
};

const sendGameInviteNotification = async ({
  friend,
  myProfile,
  game,
  gameId,
}) => {
  const isLudo = game === "ludo";
  await api.post("/web-notification/send-to-all-browsers", {
    profileId: friend._id,
    notificationData: {
      title: isLudo ? "Ludo Invitation" : "Chess Invitation",
      text: `${myProfile?.fullName || "A friend"} invited you to play ${isLudo ? "Ludo" : "Chess"}`,
      icon: myProfile?.profilePic,
      link: `/${isLudo ? "ludo-game" : "chess-game"}?gameId=${encodeURIComponent(gameId)}`,
      type: isLudo ? "ludo_invite" : "chess_invite",
      data: {
        gameId,
        inviterId: myProfile?._id,
        inviterName: myProfile?.fullName,
        inviterAvatar: myProfile?.profilePic,
      },
    },
  });
};

const loadQueryData = async ({
  queryType,
  searchQuery,
  targetName,
  friend,
  myProfile,
}) => {
  const type = String(queryType || "search").toLowerCase();
  const query = String(searchQuery || targetName || "").trim();

  if (type === "notes") {
    const res = await api.get("/notes");
    const notes = unwrapList(res.data, ["notes"]);
    return {
      queryType: type,
      payload: {
        notes: notes.slice(0, 20).map((note) => ({
          title: note.title,
          content: clipText(note.content, 220),
          updatedAt: note.updatedAt,
        })),
      },
      summary:
        notes.length > 0
          ? `You have ${notes.length} notes. Latest: "${clipText(notes[0].title || notes[0].content, 80)}"`
          : "You don't have any notes yet.",
    };
  }

  if (type === "tasks") {
    const res = await api.get("/tasks");
    const tasks = unwrapList(res.data, ["tasks"]);
    const open = tasks.filter((task) => !task.completed);
    return {
      queryType: type,
      payload: {
        tasks: tasks.slice(0, 25).map((task) => ({
          text: task.text,
          completed: Boolean(task.completed),
        })),
      },
      summary:
        tasks.length > 0
          ? `You have ${tasks.length} tasks (${open.length} open).`
          : "You don't have any tasks yet.",
    };
  }

  if (type === "notifications") {
    const res = await api.get("/notification", {
      params: { receverId: myProfile?._id, limit: 20 },
    });
    const notifications = unwrapList(res.data, ["notifications"]);
    return {
      queryType: type,
      payload: {
        notifications: notifications.slice(0, 15).map((item) => ({
          text: item.text || item.message || item.title,
          isSeen: item.isSeen,
          timestamp: item.timestamp || item.createdAt,
        })),
      },
      summary:
        notifications.length > 0
          ? `You have ${notifications.length} recent notifications.`
          : "You have no notifications.",
    };
  }

  if (type === "habits") {
    const habits = loadLocalList(HABITS_STORAGE_KEY);
    if (habits.length) {
      return {
        queryType: type,
        payload: {
          habits: habits.slice(0, 20).map((habit) => ({
            name: habit.name,
            streak: habit.streak,
          })),
        },
        summary: `You are tracking ${habits.length} habits.`,
      };
    }
    const res = await api.get("/habits");
    const apiHabits = unwrapList(res.data, ["habits"]);
    return {
      queryType: type,
      payload: {
        habits: apiHabits.slice(0, 20).map((habit) => ({
          name: habit.name,
          streak: habit.streak,
        })),
      },
      summary:
        apiHabits.length > 0
          ? `You are tracking ${apiHabits.length} habits.`
          : "You have no habits yet.",
    };
  }

  if (type === "calendar") {
    const events = loadLocalList(CALENDAR_STORAGE_KEY);
    if (events.length) {
      return {
        queryType: type,
        payload: {
          events: events.slice(0, 20).map((event) => ({
            title: event.title,
            date: event.date,
            time: event.time,
          })),
        },
        summary: `You have ${events.length} calendar events.`,
      };
    }
    const res = await api.get("/calendar");
    const apiEvents = unwrapList(res.data, ["events"]);
    return {
      queryType: type,
      payload: {
        events: apiEvents.slice(0, 20).map((event) => ({
          title: event.title,
          date: event.date,
          time: event.time,
        })),
      },
      summary:
        apiEvents.length > 0
          ? `You have ${apiEvents.length} calendar events.`
          : "You have no calendar events.",
    };
  }

  if (type === "friends" || type === "list_friends") {
    let friends = Array.isArray(myProfile?.friends) ? myProfile.friends : [];
    if ((!friends.length || typeof friends[0] !== "object") && myProfile?._id) {
      const res = await api.get("/friend/getFriends", {
        params: { profile: myProfile._id },
      });
      friends = unwrapList(res.data, ["friends"]);
    }
    const names = friends
      .map((friendProfile) => formatNamedPerson(friendProfile))
      .filter(Boolean);
    return {
      queryType: "friends",
      payload: { friends: names.slice(0, 60), count: names.length },
      summary:
        names.length > 0
          ? `You have ${names.length} friends: ${names.slice(0, 12).join(", ")}${names.length > 12 ? "…" : ""}`
          : "Your friends list is empty.",
    };
  }

  if (type === "profile") {
    return {
      queryType: type,
      payload: {
        name: formatNamedPerson(myProfile),
        username: myProfile?.username || myProfile?.user?.username,
        bio: myProfile?.bio,
        banglaName: myProfile?.banglaName,
        presentAddress: myProfile?.presentAddress,
        friendCount: Array.isArray(myProfile?.friends)
          ? myProfile.friends.length
          : 0,
      },
      summary: `${formatNamedPerson(myProfile)}${myProfile?.bio ? ` — ${clipText(myProfile.bio, 140)}` : ""}`,
    };
  }

  if (type === "user" && friend) {
    return {
      queryType: type,
      payload: {
        name: formatNamedPerson(friend),
        username: friend.username || friend.user?.username,
        bio: friend.bio,
        banglaName: friend.banglaName,
        presentAddress: friend.presentAddress,
        lastLocation: friend.lastLocation,
      },
      summary: `${formatNamedPerson(friend)}${friend.bio ? ` — ${clipText(friend.bio, 140)}` : " has no bio on file."}`,
    };
  }

  if (type === "feed" || type === "posts") {
    if (type === "posts" && query) {
      const res = await api.get("/search", { params: { input: query } });
      const posts = Array.isArray(res.data?.posts) ? res.data.posts : [];
      return {
        queryType: type,
        payload: {
          posts: posts.slice(0, 10).map((post) => ({
            caption: clipText(post.caption, 180),
            author: formatNamedPerson(post.author),
            id: post._id,
          })),
        },
        summary:
          posts.length > 0
            ? `Found ${posts.length} posts for "${query}".`
            : `No posts found for "${query}".`,
      };
    }
    const res = await api.get("/post/newsFeed", { params: { pageNumber: 1 } });
    const posts = unwrapList(res.data, ["posts", "newsFeed"]);
    return {
      queryType: "feed",
      payload: {
        posts: posts.slice(0, 8).map((post) => ({
          caption: clipText(post.caption, 180),
          author: formatNamedPerson(post.author),
          id: post._id,
        })),
      },
      summary:
        posts.length > 0
          ? `Here are the latest posts in your feed.`
          : "Your feed is empty right now.",
    };
  }

  if (type === "videos" || type === "watch") {
    const res = query
      ? await api.get("/search", { params: { input: query } })
      : await api.get("/watch/myWatchs", { params: { profile: myProfile?._id } });
    const videos = Array.isArray(res.data?.videos)
      ? res.data.videos
      : unwrapList(res.data, ["watches", "watchs", "videos"]);
    return {
      queryType: type,
      payload: {
        videos: videos.slice(0, 10).map((video) => ({
          caption: clipText(video.caption, 160),
          id: video._id,
          author: formatNamedPerson(video.author),
        })),
      },
      summary:
        videos.length > 0
          ? `Found ${videos.length} videos${query ? ` for "${query}"` : ""}.`
          : "No videos found.",
    };
  }

  if (type === "requests") {
    const res = await api.get("/friend/getRequest/");
    const requests = unwrapList(res.data, ["requests", "data"]);
    return {
      queryType: type,
      payload: {
        requests: requests.slice(0, 20).map((profile) => formatNamedPerson(profile)),
      },
      summary:
        requests.length > 0
          ? `You have ${requests.length} friend requests.`
          : "You have no pending friend requests.",
    };
  }

  if (type === "suggestions") {
    const res = await api.get("/friend/getSuggetions/");
    const suggestions = unwrapList(res.data, ["suggestions", "data"]);
    return {
      queryType: type,
      payload: {
        suggestions: suggestions
          .slice(0, 15)
          .map((profile) => formatNamedPerson(profile)),
      },
      summary:
        suggestions.length > 0
          ? `Here are ${suggestions.length} people you may know.`
          : "No friend suggestions right now.",
    };
  }

  const res = await api.get("/search", {
    params: { input: query || formatNamedPerson(myProfile) || "connect" },
  });
  return {
    queryType: "search",
    payload: {
      users: unwrapList(res.data?.users).slice(0, 8).map(formatNamedPerson),
      posts: unwrapList(res.data?.posts)
        .slice(0, 6)
        .map((post) => clipText(post.caption, 140)),
      videos: unwrapList(res.data?.videos)
        .slice(0, 6)
        .map((video) => clipText(video.caption, 140)),
    },
    summary: `Search results${query ? ` for "${query}"` : ""}.`,
  };
};

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
  queryType,
  hintText,
  sourceText,
  myProfile,
  navigate,
  onClose,
}) => {
  const friendName = friend ? getFriendDisplayName(friend) : null;

  const go = (path, options) => {
    navigate(path, options);
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
        await sendBumpToFriend(friend._id, myProfile._id);
        return { success: true, message: `👊 Bump sent to ${friendName}!` };
      }

      // ── Create Ludo ────────────────────────────────────────────────────────
      case "CREATE_LUDO": {
        go("/ludo-game");
        return { success: true, message: "🎮 Starting Ludo…" };
      }

      case "INVITE_LUDO": {
        const gid = generateGameId();
        try {
          localStorage.setItem(
            "ludo_invite_target",
            JSON.stringify({
              friendId: friend._id,
              friendName,
              friendAvatar: friend.profilePic,
              gameId: gid,
            }),
          );
        } catch (_) {}
        emitSocket(socket, "ludo:join", { gameId: gid });
        emitSocket(socket, "ludo:invite", {
          to: friend._id,
          by: myProfile?._id,
          name: myProfile?.fullName || "Player",
          avatar: myProfile?.profilePic,
          cover: myProfile?.coverPic,
          gameId: gid,
          slotIndex: 1,
          playerCount: 4,
          ts: Date.now(),
        });
        try {
          await sendGameInviteNotification({
            friend,
            myProfile,
            game: "ludo",
            gameId: gid,
          });
        } catch (_) {}
        go(`/ludo-game?gameId=${encodeURIComponent(gid)}`);
        return {
          success: true,
          message: `🎮 Ludo started and invitation sent to ${friendName}.`,
          memory: { lastFriendName: friendName },
        };
      }

      case "INVITE_CHESS": {
        const gid = generateGameId();
        try {
          localStorage.setItem(
            "chess_invite_target",
            JSON.stringify({
              friendId: friend._id,
              friendName,
              friendAvatar: friend.profilePic,
              gameId: gid,
            }),
          );
        } catch (_) {}
        emitSocket(socket, "chess:join", {
          gameId: gid,
          name: myProfile?.fullName || "Player",
          avatar: myProfile?.profilePic,
        });
        emitSocket(socket, "chess:invite", {
          to: friend._id,
          by: myProfile?._id,
          name: myProfile?.fullName || "Player",
          avatar: myProfile?.profilePic,
          cover: myProfile?.coverPic,
          gameId: gid,
          ts: Date.now(),
        });
        try {
          await sendGameInviteNotification({
            friend,
            myProfile,
            game: "chess",
            gameId: gid,
          });
        } catch (_) {}
        go(`/chess-game?gameId=${encodeURIComponent(gid)}`);
        return {
          success: true,
          message: `♟️ Chess started and invitation sent to ${friendName}.`,
          memory: { lastFriendName: friendName },
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
      case "CREATE_CHESS": {
        go("/chess-game");
        return { success: true, message: "♟️ Opening Chess…" };
      }

      case "OPEN_SEARCH": {
        go("/friends/suggestions");
        return { success: true, message: "🔍 Opening people suggestions…" };
      }

      case "OPEN_NOTIFICATIONS": {
        window.dispatchEvent(new CustomEvent("openNotificationMenu"));
        return {
          success: true,
          type: "query-data",
          queryType: "notifications",
          data: { opened: true },
          message: "🔔 Opening notifications…",
        };
      }

      case "CREATE_STORY": {
        go("/story/");
        return { success: true, message: "📸 Opening Stories to create one…" };
      }

      case "CREATE_POST": {
        const wantDraft = /\b(draft|composer|don't post|dont post|preview)\b/i.test(
          String(sourceText || ""),
        );
        let caption = [searchQuery, label, messageText]
          .map((value) => String(value || "").trim())
          .find((value) => value && !isPlaceholderCaption(value));

        if (!caption) {
          caption = extractCaptionFromText(hintText) || "";
        }
        if (!caption) {
          try {
            caption = await generatePostCaption(
              sourceText || hintText || searchQuery || "Write a short funny caption.",
            );
          } catch (captionError) {
            console.warn("[AgentActions] Caption generation failed:", captionError);
          }
        }
        caption = String(caption || "")
          .trim()
          .slice(0, 500);

        const openDraft = (draftCaption) => {
          navigate("/");
          window.setTimeout(() => {
            window.dispatchEvent(
              new CustomEvent("openCreatePost", {
                detail: { caption: draftCaption, audience: 3 },
              }),
            );
            if (onClose) onClose();
          }, 350);
        };

        if (!caption || wantDraft) {
          openDraft(caption);
          return {
            success: true,
            type: "draft-post",
            message: caption
              ? `📝 Draft ready — review it and tap Post: "${clipText(caption, 120)}"`
              : "Opening the post composer so you can write the caption, then tap Post.",
            memory: caption ? { lastCaption: caption } : {},
          };
        }

        try {
          const postFormData = new FormData();
          postFormData.append("caption", caption);
          postFormData.append("photos", "");
          postFormData.append("feelings", "");
          postFormData.append("location", "");
          postFormData.append("audience", "3");
          const res = await api.post("/post/create/", postFormData, {
            headers: { "content-type": "multipart/form-data" },
          });
          const post = res.data?.post;
          if (post) {
            store.dispatch(addPost(post));
            CacheManager.prependCachedPost(post);
          }
          go("/");
          return {
            success: true,
            type: "created-post",
            message: `📝 Posted: "${clipText(caption, 120)}"`,
            memory: {
              lastCaption: caption,
              lastPost: { id: post?._id, caption },
            },
          };
        } catch (postError) {
          openDraft(caption);
          return {
            success: true,
            type: "draft-post",
            message: `I couldn't publish automatically, so I opened a draft: "${clipText(caption, 120)}"`,
            memory: { lastCaption: caption },
          };
        }
      }

      case "DELETE_POST": {
        const query = (searchQuery || label || messageText || "").trim();
        const res = await api.get("/post/myPosts", {
          params: { profile: myProfile?._id },
        });
        const posts = unwrapList(res.data, ["posts"]);
        if (!posts.length) {
          return { success: false, message: "You don't have any posts to delete." };
        }
        const target =
          matchByText(posts, query, (post) => post.caption || "") || posts[0];
        await api.post("/post/delete", {
          postId: target._id,
          authorId: target.author?._id || myProfile._id,
        });
        store.dispatch(removePost(target._id));
        return {
          success: true,
          message: `🗑️ Deleted post: "${clipText(target.caption || "your post", 80)}"`,
        };
      }

      case "CREATE_NOTE": {
        const noteContent = (label || searchQuery || messageText || "").trim();
        if (!noteContent) {
          go("/notes");
          return { success: true, message: "📝 Opening Notes…" };
        }
        const title = noteContent.substring(0, 80);
        const created = await api.post("/notes", { title, content: noteContent });
        emitConnectEvent("connect:notes-changed");
        const note = created.data?.note || created.data;
        return {
          success: true,
          message: `📝 Note saved: "${clipText(title, 60)}"`,
          memory: { lastNote: { id: note?._id, title } },
        };
      }

      case "EDIT_NOTE": {
        const matchQuery = (searchQuery || label || "").trim();
        const newContent = (messageText || (!searchQuery ? label : "") || matchQuery).trim();
        if (!newContent) {
          return { success: false, message: "What should the note say?" };
        }
        const notesRes = await api.get("/notes");
        const notes = unwrapList(notesRes.data, ["notes"]);
        if (!notes.length) {
          return { success: false, message: "You don't have any notes yet." };
        }
        const target =
          matchByText(
            notes,
            messageText ? matchQuery : matchQuery,
            (note) => `${note.title || ""} ${note.content || ""}`,
          ) || notes[0];
        const nextTitle = (messageText || newContent).substring(0, 80);
        const nextBody = messageText || newContent;
        await api.put(`/notes/${target._id}`, {
          title: nextTitle,
          content: nextBody,
        });
        emitConnectEvent("connect:notes-changed");
        return {
          success: true,
          message: `📝 Updated note: "${clipText(nextTitle, 60)}"`,
          memory: { lastNote: { id: target._id, title: nextTitle } },
        };
      }

      case "DELETE_NOTE": {
        const notesRes = await api.get("/notes");
        const notes = unwrapList(notesRes.data, ["notes"]);
        if (!notes.length) {
          return { success: false, message: "You don't have any notes to delete." };
        }
        const query = (searchQuery || label || messageText || "").trim();
        const target =
          matchByText(notes, query, (note) => `${note.title || ""} ${note.content || ""}`) ||
          notes[0];
        await api.delete(`/notes/${target._id}`);
        emitConnectEvent("connect:notes-changed");
        return {
          success: true,
          message: `🗑️ Deleted note: "${clipText(target.title || target.content, 60)}"`,
        };
      }

      case "CREATE_TASK": {
        const taskContent = (label || searchQuery || messageText || "").trim();
        if (!taskContent) {
          go("/tasks");
          return { success: true, message: "✓ Opening Tasks…" };
        }
        const created = await api.post("/tasks", { text: taskContent });
        emitConnectEvent("connect:tasks-changed");
        const task = created.data?.task || created.data;
        return {
          success: true,
          message: `✓ Task added: "${clipText(taskContent, 60)}"`,
          memory: { lastTask: { id: task?._id, text: taskContent } },
        };
      }

      case "EDIT_TASK": {
        const matchQuery = (searchQuery || label || "").trim();
        const newTaskContent = (messageText || matchQuery).trim();
        if (!newTaskContent) {
          return { success: false, message: "What should the task be?" };
        }
        const tasksRes = await api.get("/tasks");
        const tasks = unwrapList(tasksRes.data, ["tasks"]);
        if (!tasks.length) {
          return { success: false, message: "You don't have any tasks yet." };
        }
        const target =
          matchByText(tasks, matchQuery, (task) => task.text || "") || tasks[0];
        await api.put(`/tasks/${target._id}`, { text: newTaskContent });
        emitConnectEvent("connect:tasks-changed");
        return {
          success: true,
          message: `✓ Updated task: "${clipText(newTaskContent, 60)}"`,
          memory: { lastTask: { id: target._id, text: newTaskContent } },
        };
      }

      case "DELETE_TASK": {
        const tasksRes = await api.get("/tasks");
        const tasks = unwrapList(tasksRes.data, ["tasks"]);
        if (!tasks.length) {
          return { success: false, message: "You don't have any tasks to delete." };
        }
        const query = (searchQuery || label || messageText || "").trim();
        const target = matchByText(tasks, query, (task) => task.text || "") || tasks[0];
        await api.delete(`/tasks/${target._id}`);
        emitConnectEvent("connect:tasks-changed");
        return {
          success: true,
          message: `🗑️ Deleted task: "${clipText(target.text, 60)}"`,
        };
      }

      case "CREATE_EVENT":
      case "EDIT_EVENT": {
        const rawText = [label, searchQuery, messageText, sourceText]
          .filter(Boolean)
          .join(" ");
        const when = parseCalendarWhen(rawText);
        const title = stripDatePhrases(searchQuery || label || messageText || "").trim();
        if (!title) {
          go("/calendar");
          return { success: true, message: "📅 Opening Calendar…" };
        }
        const events = loadLocalList(CALENDAR_STORAGE_KEY);
        if (action === "EDIT_EVENT" && events.length) {
          const target =
            matchByText(events, title, (event) => event.title || "") || events[0];
          const nextTitle = (messageText || title).trim();
          const next = events.map((event) =>
            event.id === target.id
              ? {
                  ...event,
                  title: nextTitle,
                  time: when.time || event.time,
                  date: when.foundDate ? when.iso : event.date,
                }
              : event,
          );
          saveLocalList(CALENDAR_STORAGE_KEY, next, "connect:calendar-changed");
          try {
            if (target._id) {
              await api.put(`/calendar/${target._id}`, {
                title: nextTitle,
                date: when.dateKey,
                time: when.time || undefined,
              });
            }
          } catch (_) {}
          return {
            success: true,
            message: `📅 Updated event: "${clipText(nextTitle, 60)}"`,
            memory: { lastEvent: { id: target.id, title: nextTitle, date: when.dateKey } },
          };
        }
        const event = {
          id: Date.now(),
          title,
          time: when.time || "",
          date: when.iso,
          createdAt: new Date().toISOString(),
        };
        saveLocalList(
          CALENDAR_STORAGE_KEY,
          [event, ...events],
          "connect:calendar-changed",
        );
        try {
          await api.post("/calendar", {
            title,
            date: when.dateKey,
            time: when.time || undefined,
          });
        } catch (_) {}
        return {
          success: true,
          message: `📅 Event added for ${when.dateKey}${when.time ? ` at ${when.time}` : ""}: "${clipText(title, 60)}"`,
          memory: { lastEvent: { id: event.id, title, date: when.dateKey } },
        };
      }

      case "DELETE_EVENT": {
        const query = (searchQuery || label || messageText || "").trim();
        const events = loadLocalList(CALENDAR_STORAGE_KEY);
        if (!events.length) {
          return { success: false, message: "You don't have any calendar events to delete." };
        }
        const target = matchByText(events, query, (event) => event.title || "") || events[0];
        saveLocalList(
          CALENDAR_STORAGE_KEY,
          events.filter((event) => event.id !== target.id),
          "connect:calendar-changed",
        );
        try {
          if (target._id) await api.delete(`/calendar/${target._id}`);
        } catch (_) {}
        return {
          success: true,
          message: `🗑️ Deleted event: "${clipText(target.title, 60)}"`,
        };
      }

      case "CREATE_HABIT": {
        const name = (label || searchQuery || messageText || "").trim();
        if (!name) {
          go("/habits");
          return { success: true, message: "🔥 Opening Habits…" };
        }
        const habits = loadLocalList(HABITS_STORAGE_KEY);
        const habit = {
          id: Date.now(),
          name,
          color: "#22C55E",
          streak: 0,
          longestStreak: 0,
          records: {},
          createdAt: new Date().toISOString(),
        };
        saveLocalList(HABITS_STORAGE_KEY, [...habits, habit], "connect:habits-changed");
        try {
          await api.post("/habits", { name });
        } catch (_) {}
        return {
          success: true,
          message: `🔥 Habit created: "${clipText(name, 60)}"`,
          memory: { lastHabit: { id: habit.id, name } },
        };
      }

      case "EDIT_HABIT": {
        const matchQuery = (searchQuery || label || "").trim();
        const newName = (messageText || matchQuery).trim();
        if (!newName) {
          return { success: false, message: "What should the habit be called?" };
        }
        const habits = loadLocalList(HABITS_STORAGE_KEY);
        if (!habits.length) {
          return { success: false, message: "You don't have any habits yet." };
        }
        const target = matchByText(habits, matchQuery, (habit) => habit.name || "") || habits[0];
        saveLocalList(
          HABITS_STORAGE_KEY,
          habits.map((habit) =>
            habit.id === target.id ? { ...habit, name: newName } : habit,
          ),
          "connect:habits-changed",
        );
        return {
          success: true,
          message: `🔥 Updated habit: "${clipText(newName, 60)}"`,
          memory: { lastHabit: { id: target.id, name: newName } },
        };
      }

      case "DELETE_HABIT": {
        const habits = loadLocalList(HABITS_STORAGE_KEY);
        if (!habits.length) {
          return { success: false, message: "You don't have any habits to delete." };
        }
        const query = (searchQuery || label || messageText || "").trim();
        const target = matchByText(habits, query, (habit) => habit.name || "") || habits[0];
        saveLocalList(
          HABITS_STORAGE_KEY,
          habits.filter((habit) => habit.id !== target.id),
          "connect:habits-changed",
        );
        return {
          success: true,
          message: `🗑️ Deleted habit: "${clipText(target.name, 60)}"`,
        };
      }

      case "DOWNLOAD_YOUTUBE": {
        const combined = [searchQuery, label, messageText, sourceText, hintText]
          .filter(Boolean)
          .join(" ");
        const url = extractYouTubeUrl(combined);
        if (!url) {
          return {
            success: false,
            message: "Paste the YouTube link you want me to download.",
          };
        }
        const audioOnly =
          looksLikeAudioDownload(combined) || String(label || "").toLowerCase() === "audio";
        const postAsWatch = !audioOnly && !shouldSkipWatchPost(combined);
        const quality = parseQualityFromText(combined);
        try {
          const job = await startYoutubeDownloadJob({
            url,
            audioOnly,
            postAsWatch,
            quality,
          });
          const agentJob = {
            url,
            audioOnly,
            postAsWatch,
            quality,
            progressId: job?.progress_id,
            progressUrl: job?.progress_url,
            title: job?.title || job?.download_title,
          };
          emitConnectEvent("connect:yt-download-job", agentJob);
          go("/yt-download", { state: { agentJob } });
          return {
            success: true,
            message: audioOnly
              ? "🎵 Download started — saving audio, I'll keep it in Downloads when it's ready."
              : postAsWatch
                ? "⬇️ Download started — I'll save it and post it to Watch when it's ready."
                : "⬇️ Download started. Open YouTube Download to watch progress.",
            memory: { lastYoutubeUrl: url },
          };
        } catch (downloadError) {
          return {
            success: false,
            message: downloadError?.message || "Couldn't start the YouTube download.",
          };
        }
      }

      case "OPEN_VIDEO_PLAYER": {
        const url = extractMediaUrl(searchQuery, label, messageText, sourceText);
        if (url && /youtu(\.be|be\.com)/i.test(url)) {
          go("/yt-download", { state: { agentJob: { url, waitForUser: true } } });
          return {
            success: true,
            message:
              "YouTube links play after download. I opened the downloader — say download if you want me to save it.",
            memory: { lastYoutubeUrl: url },
          };
        }
        go("/video-player", {
          state: url ? { playUrl: url, playTitle: label || "Video", autoplay: true } : undefined,
        });
        return {
          success: true,
          message: url
            ? "🎬 Opening the video player with that file."
            : "🎬 Opening the video player.",
          memory: url ? { lastVideoUrl: url } : {},
        };
      }

      case "UPDATE_SETTINGS": {
        const combined = [searchQuery, label, messageText, sourceText]
          .filter(Boolean)
          .join(" ");
        const { patch, notes } = parseSettingsPatch(combined);
        if (!Object.keys(patch).length) {
          go("/settings");
          return {
            success: false,
            message:
              "What should I change? Try dark mode, light mode, hide location, mute notifications, or friends-only posts.",
          };
        }
        const language = patch.preferredLanguage;
        delete patch.preferredLanguage;
        if (Object.keys(patch).length) {
          const res = await api.post("/setting/update", patch);
          if (res.data) store.dispatch(loadSettings(res.data));
          if (patch.themeMode) applyThemeMode(patch.themeMode);
        }
        if (language) {
          try {
            await api.put("/profile/language-settings", {
              preferredLanguage: language,
              userId: myProfile._id,
            });
          } catch (_) {}
        }
        return {
          success: true,
          message: `⚙️ Updated settings: ${notes.join(", ")}.`,
        };
      }

      case "LOG_HEALTH": {
        const combined = [searchQuery, label, messageText, sourceText]
          .filter(Boolean)
          .join(" ");
        const parsed = parseHealthLog(combined);
        const day = todayKey();
        if (parsed.kind === "weight") {
          const log = loadLocalList(HEALTH_WEIGHT_LOG_KEY);
          const entry = {
            weight: parsed.weight,
            date: day,
            timestamp: new Date().toISOString(),
          };
          const next = [entry, ...log.filter((item) => item.date !== day)];
          writeJsonStorage(HEALTH_WEIGHT_LOG_KEY, next);
          emitConnectEvent("connect:health-updated");
          go("/health");
          return {
            success: true,
            message: `💪 Logged weight ${parsed.weight} kg for today.`,
          };
        }
        if (parsed.kind === "meal") {
          const allMeals = readJsonStorage(HEALTH_MEAL_LOG_KEY, {}) || {};
          const todayMeals = Array.isArray(allMeals[day]) ? allMeals[day] : [];
          todayMeals.push({
            name: parsed.name,
            calories: parsed.calories,
            protein: 0,
            carbs: 0,
            fat: 0,
            type: "snack",
            timestamp: new Date().toISOString(),
          });
          allMeals[day] = todayMeals;
          writeJsonStorage(HEALTH_MEAL_LOG_KEY, allMeals);
          emitConnectEvent("connect:health-updated");
          go("/health");
          return {
            success: true,
            message: parsed.calories
              ? `🥗 Logged ${parsed.name} (${parsed.calories} cal).`
              : `🥗 Logged meal: ${parsed.name}.`,
          };
        }
        if (parsed.kind === "workout") {
          const all = readJsonStorage(HEALTH_WELLNESS_KEY, {}) || {};
          all[day] = { ...(all[day] || {}), workout: true, note: parsed.name };
          writeJsonStorage(HEALTH_WELLNESS_KEY, all);
          emitConnectEvent("connect:health-updated");
          go("/health");
          return {
            success: true,
            message: `🏃 Logged workout: ${clipText(parsed.name, 80)}`,
          };
        }
        go("/health");
        return {
          success: true,
          message: "Opening Health & Fitness. Tell me a weight, meal, or workout to log.",
        };
      }

      case "ADD_RECOVERY_DATA":
      case "LOG_RECOVERY":
      case "RECOVERY_SUPPORT": {
        const combined = [searchQuery, label, messageText, sourceText]
          .filter(Boolean)
          .join(" ");
        const parsed = parseRecoveryLog(combined || "support");
        const day = todayKey();
        if (parsed.kind === "craving") {
          const all = readJsonStorage(CRAVING_LOG_KEY, {}) || {};
          const todayLog = Array.isArray(all[day]) ? all[day] : [];
          todayLog.push({
            intensity: parsed.intensity,
            trigger: parsed.trigger,
            mood: parsed.mood,
            notes: combined,
            timestamp: new Date().toISOString(),
          });
          all[day] = todayLog;
          writeJsonStorage(CRAVING_LOG_KEY, all);
          emitConnectEvent("connect:rehab-updated");
        }
        if (parsed.kind === "days" && parsed.days != null) {
          const start = new Date();
          start.setDate(start.getDate() - parsed.days);
          const profile = {
            ...(readJsonStorage(REHAB_PROFILE_KEY, {}) || {}),
            startDate: start.toISOString(),
            createdAt: new Date().toISOString(),
          };
          writeJsonStorage(REHAB_PROFILE_KEY, profile);
          emitConnectEvent("connect:rehab-updated");
        }
        let support = "";
        try {
          const rehabProfile = readJsonStorage(REHAB_PROFILE_KEY, {}) || {};
          const reply = await getRecoverySupportMessage({
            substanceType: rehabProfile.substanceType || "recovery",
            daysClean: parsed.days || 0,
            currentMood: parsed.mood || "mixed",
            craving: parsed.intensity || 0,
            message: combined || "I could use some support.",
            triggers: [],
          });
          support = reply?.message || "";
          if (support) {
            const chat = loadLocalList(SUPPORT_CHAT_KEY);
            writeJsonStorage(SUPPORT_CHAT_KEY, [
              ...chat,
              { role: "user", text: combined, timestamp: new Date().toISOString() },
              { role: "assistant", text: support, timestamp: new Date().toISOString() },
            ]);
          }
        } catch (_) {}
        go("/rehab");
        if (parsed.kind === "craving") {
          return {
            success: true,
            message:
              support ||
              `Logged a craving at ${parsed.intensity}/10. I opened Recovery Support.`,
          };
        }
        if (parsed.kind === "days") {
          return {
            success: true,
            message:
              support ||
              `Updated your recovery streak${parsed.days != null ? ` to ${parsed.days} days` : ""}.`,
          };
        }
        return {
          success: true,
          message: support || "Opening Recovery Support. I'm here with you.",
        };
      }

      case "ACCEPT_FRIEND":
      case "DECLINE_FRIEND": {
        const requestName = (searchQuery || label || "").trim();
        const reqRes = await api.get("/friend/getRequest/");
        const requests = unwrapList(reqRes.data, ["requests", "data"]);
        const matched = requestName
          ? matchProfileByName(requests, requestName)
          : requests;
        if (!matched.length) {
          return {
            success: false,
            message: requestName
              ? `No friend request from "${requestName}".`
              : "You have no pending friend requests.",
          };
        }
        const target = matched[0];
        const endpoint =
          action === "ACCEPT_FRIEND" ? "/friend/reqAccept" : "/friend/reqDelete";
        await api.post(endpoint, { profile: target._id });
        return {
          success: true,
          message:
            action === "ACCEPT_FRIEND"
              ? `✅ Accepted ${formatNamedPerson(target)}'s friend request.`
              : `Ignored ${formatNamedPerson(target)}'s friend request.`,
        };
      }

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
          const room = [String(myProfile._id), String(friend._id)]
            .sort()
            .join("_");
          try {
            socket.emit("joinRoom", room);
          } catch (_) {}
          const response = await api.post("/message/send", {
            room,
            senderId: myProfile._id,
            receiverId: friend._id,
            message: messageContent,
            attachment: "",
            parent: false,
            messageType: "text",
          });
          const sent = response.data?.data;
          if (sent?._id) {
            try {
              store.dispatch(newMessage(sent, myProfile._id));
            } catch (_) {}
          }

          await new Promise((resolve) => setTimeout(resolve, 200));

          openStickyChat(friend._id);
          return {
            success: true,
            message: `✅ Message sent to ${friendName}: “${clipText(messageContent, 80)}”. Opening chat…`,
          };
        } catch (err) {
          return {
            success: false,
            message: `Failed to send message: ${err?.response?.data?.reason || err?.response?.data?.message || err?.message || "Unknown error"}`,
          };
        }
      }

      case "SEARCH_USERS":
      case "SEARCH_POSTS":
      case "SEARCH_APP": {
        const query = (searchQuery || label || "").trim();
        if (!query) {
          return { success: false, message: "What should I search for?" };
        }
        const res = await api.get("/search", { params: { input: query } });
        const users = Array.isArray(res.data?.users) ? res.data.users : [];
        const posts = Array.isArray(res.data?.posts) ? res.data.posts : [];
        const videos = Array.isArray(res.data?.videos) ? res.data.videos : [];
        if (action === "SEARCH_USERS") {
          return {
            success: users.length > 0,
            type: "search-results",
            users,
            posts: [],
            videos: [],
            query,
            message:
              users.length > 0
                ? `Found ${users.length} people for "${query}":`
                : `No people found for "${query}".`,
          };
        }
        if (action === "SEARCH_POSTS") {
          return {
            success: posts.length > 0,
            type: "search-results",
            users: [],
            posts,
            videos: [],
            query,
            message:
              posts.length > 0
                ? `Found ${posts.length} posts for "${query}":`
                : `No posts found for "${query}".`,
          };
        }
        return {
          success: users.length + posts.length + videos.length > 0,
          type: "search-results",
          users,
          posts,
          videos,
          query,
          message: `Search results for "${query}": ${users.length} people, ${posts.length} posts, ${videos.length} videos.`,
        };
      }

      case "LIST_NOTES":
      case "LIST_TASKS":
      case "LIST_NOTIFICATIONS":
      case "LIST_HABITS":
      case "LIST_EVENTS":
      case "LIST_FRIENDS_INFO":
      case "GET_MY_DETAILS":
      case "QUERY_CONTENT": {
        const data = await loadQueryData({
          queryType:
            queryType ||
            (action === "LIST_NOTES"
              ? "notes"
              : action === "LIST_TASKS"
                ? "tasks"
                : action === "LIST_NOTIFICATIONS"
                  ? "notifications"
                  : action === "LIST_HABITS"
                    ? "habits"
                    : action === "LIST_EVENTS"
                      ? "calendar"
                      : action === "LIST_FRIENDS_INFO"
                        ? "friends"
                        : action === "GET_MY_DETAILS"
                          ? "profile"
                          : queryType || "search"),
          searchQuery: searchQuery || label || "",
          targetName: friend ? formatNamedPerson(friend) : searchQuery || "",
          friend,
          myProfile,
        });
        return {
          success: true,
          type: "query-data",
          queryType: data.queryType,
          data: data.payload,
          message: data.summary,
        };
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
    VIDEO_CALL: { label: "Video Call", icon: "fa-video", color: "#00d4ff" },
    AUDIO_CALL: { label: "Audio Call", icon: "fa-phone-alt", color: "#00c851" },
    SEND_MESSAGE: {
      label: "Message",
      icon: "fa-comment-dots",
      color: "#00d4ff",
    },
    BUMP: { label: "Bump", icon: "fa-hand-rock", color: "#f59e0b" },
    INVITE_LUDO: { label: "Invite to Ludo", icon: "fa-dice", color: "#29b1a9" },
    INVITE_CHESS: { label: "Invite to Chess", icon: "fa-chess", color: "#2E7D32" },
    CREATE_LUDO: { label: "Play Ludo", icon: "fa-gamepad", color: "#29b1a9" },
    CREATE_CHESS: { label: "Play Chess", icon: "fa-chess", color: "#29b1a9" },
    CREATE_POST: { label: "Create Post", icon: "fa-pen", color: "#00d4ff" },
    DELETE_POST: { label: "Delete Post", icon: "fa-trash", color: "#ef4444" },
    DOWNLOAD_YOUTUBE: {
      label: "YouTube Download",
      icon: "fa-download",
      color: "#ef4444",
    },
    OPEN_VIDEO_PLAYER: {
      label: "Video Player",
      icon: "fa-play-circle",
      color: "#29b1a9",
    },
    UPDATE_SETTINGS: { label: "Update Settings", icon: "fa-cog", color: "#00d4ff" },
    LOG_HEALTH: { label: "Health Log", icon: "fa-heartbeat", color: "#00c851" },
    LOG_RECOVERY: { label: "Recovery Log", icon: "fa-shield-alt", color: "#00c851" },
    RECOVERY_SUPPORT: {
      label: "Recovery Support",
      icon: "fa-hands-helping",
      color: "#00c851",
    },
    CREATE_STORY: { label: "Create Story", icon: "fa-camera", color: "#f59e0b" },
    SEARCH_APP: { label: "Search", icon: "fa-search", color: "#00d4ff" },
    SEARCH_USERS: { label: "Find People", icon: "fa-user", color: "#00d4ff" },
    SEARCH_POSTS: { label: "Search Posts", icon: "fa-file-alt", color: "#00d4ff" },
    QUERY_CONTENT: { label: "Look Up", icon: "fa-info-circle", color: "#0ea5e9" },
    LIST_NOTES: { label: "Notes", icon: "fa-sticky-note", color: "#f59e0b" },
    LIST_TASKS: { label: "Tasks", icon: "fa-tasks", color: "#00d4ff" },
    LIST_NOTIFICATIONS: {
      label: "Notifications",
      icon: "fa-bell",
      color: "#f59e0b",
    },
    LIST_HABITS: { label: "Habits", icon: "fa-check-double", color: "#00c851" },
    LIST_EVENTS: { label: "Calendar", icon: "fa-calendar-alt", color: "#00d4ff" },
    LIST_FRIENDS_INFO: { label: "Friends", icon: "fa-users", color: "#00d4ff" },
    GET_MY_DETAILS: { label: "My Details", icon: "fa-id-card", color: "#00d4ff" },
    ACCEPT_FRIEND: {
      label: "Accept Request",
      icon: "fa-user-check",
      color: "#00c851",
    },
    DECLINE_FRIEND: {
      label: "Decline Request",
      icon: "fa-user-times",
      color: "#ef4444",
    },
    OPEN_NOTIFICATIONS: {
      label: "Notifications",
      icon: "fa-bell",
      color: "#f59e0b",
    },
    CREATE_EVENT: { label: "Add Event", icon: "fa-calendar-plus", color: "#00d4ff" },
    EDIT_EVENT: { label: "Edit Event", icon: "fa-calendar-alt", color: "#00d4ff" },
    DELETE_EVENT: { label: "Delete Event", icon: "fa-trash", color: "#ef4444" },
    CREATE_HABIT: { label: "Add Habit", icon: "fa-plus", color: "#00c851" },
    EDIT_HABIT: { label: "Edit Habit", icon: "fa-edit", color: "#00c851" },
    DELETE_HABIT: { label: "Delete Habit", icon: "fa-trash", color: "#ef4444" },
    SEARCH_VIDEO: { label: "Find Video", icon: "fa-play", color: "#29b1a9" },
    BLOCK: { label: "Block", icon: "fa-ban", color: "#ef4444" },
    UNBLOCK: { label: "Unblock", icon: "fa-check-circle", color: "#00c851" },
    VIEW_PROFILE: { label: "View Profile", icon: "fa-user", color: "#00d4ff" },
    NAVIGATE_PROFILE: {
      label: "Go to Profile",
      icon: "fa-external-link-alt",
      color: "#00d4ff",
    },
    GET_LOCATION: {
      label: "Get Location",
      icon: "fa-map-marker-alt",
      color: "#f97316",
    },
    GET_BIO: {
      label: "Get Bio",
      icon: "fa-file-alt",
      color: "#29b1a9",
    },
    ADD_FRIEND: { label: "Add Friend", icon: "fa-user-plus", color: "#00d4ff" },
    UNFRIEND: { label: "Unfriend", icon: "fa-user-times", color: "#ef4444" },
    NAVIGATE: { label: "Go", icon: "fa-arrow-right", color: "#00d4ff" },
    LIST_FRIENDS: { label: "Friends Page", icon: "fa-users", color: "#00d4ff" },
    OPEN_MESSAGES: { label: "Messages", icon: "fa-envelope", color: "#00d4ff" },
    OPEN_FRIENDS: { label: "Friends Page", icon: "fa-users", color: "#00d4ff" },
    CREATE_NOTE: {
      label: "Create Note",
      icon: "fa-sticky-note",
      color: "#f59e0b",
    },
    EDIT_NOTE: { label: "Edit Note", icon: "fa-edit", color: "#f59e0b" },
    DELETE_NOTE: { label: "Delete Note", icon: "fa-trash", color: "#ef4444" },
    CREATE_TASK: { label: "Create Task", icon: "fa-tasks", color: "#00d4ff" },
    EDIT_TASK: { label: "Edit Task", icon: "fa-edit", color: "#00d4ff" },
    DELETE_TASK: { label: "Delete Task", icon: "fa-trash", color: "#ef4444" },
    ADD_RECOVERY_DATA: {
      label: "Add Recovery Data",
      icon: "fa-shield-alt",
      color: "#00c851",
    },
    UPDATE_LANGUAGE_SETTINGS: {
      label: "Change Language",
      icon: "fa-globe",
      color: "#00d4ff",
    },
    SEND_MESSAGE_TO_USER: {
      label: "Send Message",
      icon: "fa-paper-plane",
      color: "#00d4ff",
    },
  };
  return map[action] || { label: action, icon: "fa-bolt", color: "#00d4ff" };
};

const agentActions = { executeAction, getActionMeta };

export default agentActions;

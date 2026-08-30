/**
 * AI Agent Action Executor
 */

import api, { invalidateGetCache } from "../../../api/api";
import socket from "../../../common/socket";
import { getFriendDisplayName } from "./agentIntentParser";
import { sendBumpToFriend } from "../../../utils/sendBump";
import { generatePostCaption } from "../../../services/geminiService";
import store from "../../../store";
import { addPost } from "../../../services/actions/postActions";
import CacheManager from "../../../utils/cacheManager";
import { prependProfilePostCache } from "../../../utils/requestCache";
import {
  extractCaptionFromText,
  isPlaceholderCaption,
} from "./agentCatalog";

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
    const res = await api.get("/habits");
    const habits = unwrapList(res.data, ["habits"]);
    return {
      queryType: type,
      payload: {
        habits: habits.slice(0, 20).map((habit) => ({
          name: habit.name,
          streak: habit.streak,
        })),
      },
      summary:
        habits.length > 0
          ? `You are tracking ${habits.length} habits.`
          : "You have no habits yet.",
    };
  }

  if (type === "calendar") {
    const res = await api.get("/calendar");
    const events = unwrapList(res.data, ["events"]);
    return {
      queryType: type,
      payload: {
        events: events.slice(0, 20).map((event) => ({
          title: event.title,
          date: event.date,
          time: event.time,
        })),
      },
      summary:
        events.length > 0
          ? `You have ${events.length} calendar events.`
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
        await sendBumpToFriend(friend._id, myProfile._id);
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

        if (!caption) {
          navigate("/");
          window.setTimeout(() => {
            window.dispatchEvent(new CustomEvent("openCreatePost"));
            if (onClose) onClose();
          }, 350);
          return {
            success: false,
            message:
              "I couldn't write a caption automatically. Opening the post composer so you can finish it.",
          };
        }

        const form = new FormData();
        form.append("caption", caption);
        form.append("photos", "");
        form.append("feelings", "");
        form.append("location", "");
        form.append("audience", "1");
        const res = await api.post("/post/create/", form);
        const createdPost = res.data?.post;
        if (createdPost) {
          store.dispatch(addPost(createdPost));
          CacheManager.prependCachedPost(createdPost);
          if (myProfile?._id) {
            prependProfilePostCache(myProfile._id, createdPost);
          }
        }
        invalidateGetCache("/post/newsFeed");
        go("/");
        return {
          success: true,
          type: "created-post",
          post: createdPost || null,
          message: `📝 Posted: "${clipText(caption, 120)}"`,
        };
      }

      case "CREATE_NOTE": {
        const noteContent = (label || searchQuery || messageText || "").trim();
        if (!noteContent) {
          go("/notes");
          return { success: true, message: "📝 Opening Notes…" };
        }
        const title = noteContent.substring(0, 80);
        await api.post("/notes", { title, content: noteContent });
        return {
          success: true,
          message: `📝 Note saved: "${clipText(title, 60)}"`,
        };
      }

      case "EDIT_NOTE": {
        const newContent = (label || searchQuery || messageText || "").trim();
        if (!newContent.trim()) {
          return { success: false, message: "What should the note say?" };
        }
        const notesRes = await api.get("/notes");
        const notes = unwrapList(notesRes.data, ["notes"]);
        if (!notes.length) {
          return { success: false, message: "You don't have any notes yet." };
        }
        const latest = notes[0];
        await api.put(`/notes/${latest._id}`, {
          title: newContent.substring(0, 80),
          content: newContent,
        });
        return {
          success: true,
          message: `📝 Updated your latest note: "${clipText(newContent, 60)}"`,
        };
      }

      case "DELETE_NOTE": {
        const notesRes = await api.get("/notes");
        const notes = unwrapList(notesRes.data, ["notes"]);
        if (!notes.length) {
          return { success: false, message: "You don't have any notes to delete." };
        }
        await api.delete(`/notes/${notes[0]._id}`);
        return { success: true, message: "🗑️ Deleted your latest note." };
      }

      case "CREATE_TASK": {
        const taskContent = (label || searchQuery || messageText || "").trim();
        if (!taskContent) {
          go("/tasks");
          return { success: true, message: "✓ Opening Tasks…" };
        }
        await api.post("/tasks", { text: taskContent });
        return {
          success: true,
          message: `✓ Task added: "${clipText(taskContent, 60)}"`,
        };
      }

      case "EDIT_TASK": {
        const newTaskContent = (label || searchQuery || messageText || "").trim();
        if (!newTaskContent) {
          return { success: false, message: "What should the task be?" };
        }
        const tasksRes = await api.get("/tasks");
        const tasks = unwrapList(tasksRes.data, ["tasks"]);
        if (!tasks.length) {
          return { success: false, message: "You don't have any tasks yet." };
        }
        await api.put(`/tasks/${tasks[0]._id}`, { text: newTaskContent });
        return {
          success: true,
          message: `✓ Updated your latest task: "${clipText(newTaskContent, 60)}"`,
        };
      }

      case "DELETE_TASK": {
        const tasksRes = await api.get("/tasks");
        const tasks = unwrapList(tasksRes.data, ["tasks"]);
        if (!tasks.length) {
          return { success: false, message: "You don't have any tasks to delete." };
        }
        await api.delete(`/tasks/${tasks[0]._id}`);
        return { success: true, message: "🗑️ Deleted your latest task." };
      }

      case "CREATE_EVENT": {
        const title = (label || searchQuery || messageText || "").trim();
        if (!title) {
          go("/calendar");
          return { success: true, message: "📅 Opening Calendar…" };
        }
        const today = new Date().toISOString().slice(0, 10);
        await api.post("/calendar", { title, date: today });
        return {
          success: true,
          message: `📅 Event added for today: "${clipText(title, 60)}"`,
        };
      }

      case "CREATE_HABIT": {
        const name = (label || searchQuery || messageText || "").trim();
        if (!name) {
          go("/habits");
          return { success: true, message: "🔥 Opening Habits…" };
        }
        await api.post("/habits", { name });
        return {
          success: true,
          message: `🔥 Habit created: "${clipText(name, 60)}"`,
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
    CREATE_CHESS: { label: "Play Chess", icon: "fa-chess", color: "#8b5cf6" },
    CREATE_POST: { label: "Create Post", icon: "fa-pen", color: "#6366f1" },
    CREATE_STORY: { label: "Create Story", icon: "fa-camera", color: "#f59e0b" },
    SEARCH_APP: { label: "Search", icon: "fa-search", color: "#6366f1" },
    SEARCH_USERS: { label: "Find People", icon: "fa-user", color: "#3b82f6" },
    SEARCH_POSTS: { label: "Search Posts", icon: "fa-file-alt", color: "#3b82f6" },
    QUERY_CONTENT: { label: "Look Up", icon: "fa-info-circle", color: "#0ea5e9" },
    LIST_NOTES: { label: "Notes", icon: "fa-sticky-note", color: "#f59e0b" },
    LIST_TASKS: { label: "Tasks", icon: "fa-tasks", color: "#3b82f6" },
    LIST_NOTIFICATIONS: {
      label: "Notifications",
      icon: "fa-bell",
      color: "#f59e0b",
    },
    LIST_HABITS: { label: "Habits", icon: "fa-check-double", color: "#10b981" },
    LIST_EVENTS: { label: "Calendar", icon: "fa-calendar-alt", color: "#6366f1" },
    LIST_FRIENDS_INFO: { label: "Friends", icon: "fa-users", color: "#6366f1" },
    GET_MY_DETAILS: { label: "My Details", icon: "fa-id-card", color: "#6366f1" },
    ACCEPT_FRIEND: {
      label: "Accept Request",
      icon: "fa-user-check",
      color: "#10b981",
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
    CREATE_EVENT: { label: "Add Event", icon: "fa-calendar-plus", color: "#6366f1" },
    CREATE_HABIT: { label: "Add Habit", icon: "fa-plus", color: "#10b981" },
    SEARCH_VIDEO: { label: "Find Video", icon: "fa-play", color: "#8b5cf6" },
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

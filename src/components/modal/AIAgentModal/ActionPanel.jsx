import React, { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";

const ACTIONS = [
  // ── Social ──────────────────────────────────────────────────────────────────
  {
    category: "social",
    icon: "fa-users",
    label: "Social Actions",
    color: "#00d4ff",
    items: [
      {
        id: "ac_video_call",
        label: "Video Call Friend",
        icon: "fa-video",
        prompt: "Video call ",
      },
      {
        id: "ac_audio_call",
        label: "Audio Call Friend",
        icon: "fa-phone-alt",
        prompt: "Call ",
      },
      {
        id: "ac_message",
        label: "Message Friend",
        icon: "fa-comment-dots",
        prompt: "Message ",
      },
      {
        id: "ac_bump",
        label: "Bump Friend",
        icon: "fa-hand-rock",
        prompt: "Bump ",
      },
      {
        id: "ac_view_profile",
        label: "Friend's Profile",
        icon: "fa-user",
        prompt: "View profile of ",
      },
      {
        id: "ac_get_location",
        label: "Friend's Location",
        icon: "fa-map-marker-alt",
        prompt: "Where is ",
      },
    ],
  },

  // ── Navigate ─────────────────────────────────────────────────────────────────
  {
    category: "navigate",
    icon: "fa-compass",
    label: "Navigate",
    color: "#00c851",
    items: [
      { id: "nav_home", label: "Home", icon: "fa-home", prompt: "go to home" },
      {
        id: "nav_my_profile",
        label: "My Profile",
        icon: "fa-user-circle",
        prompt: "go to my profile",
      },
      {
        id: "nav_my_friends",
        label: "My Friends List",
        icon: "fa-users",
        prompt: "go to my friends",
      },
      {
        id: "nav_messages",
        label: "Messages",
        icon: "fa-envelope",
        prompt: "go to messages",
      },
      {
        id: "nav_watch",
        label: "Watch Videos",
        icon: "fa-play-circle",
        prompt: "go to watch",
      },
      {
        id: "nav_friends",
        label: "Friends Page",
        icon: "fa-user-friends",
        prompt: "go to friends page",
      },
      {
        id: "nav_friend_req",
        label: "Friend Requests",
        icon: "fa-user-plus",
        prompt: "go to friend requests",
      },
      {
        id: "nav_suggestions",
        label: "Friend Suggestions",
        icon: "fa-lightbulb",
        prompt: "go to suggestions",
      },
      {
        id: "nav_marketplace",
        label: "Marketplace",
        icon: "fa-store",
        prompt: "go to marketplace",
      },
      {
        id: "nav_groups",
        label: "Groups",
        icon: "fa-layer-group",
        prompt: "go to groups",
      },
      {
        id: "nav_notes",
        label: "Notes",
        icon: "fa-sticky-note",
        prompt: "go to notes",
      },
      {
        id: "nav_tasks",
        label: "Tasks",
        icon: "fa-tasks",
        prompt: "go to tasks",
      },
      {
        id: "nav_calendar",
        label: "Calendar",
        icon: "fa-calendar-alt",
        prompt: "go to calendar",
      },
      {
        id: "nav_habits",
        label: "Habits",
        icon: "fa-check-double",
        prompt: "go to habits",
      },
      {
        id: "nav_health",
        label: "Health",
        icon: "fa-heartbeat",
        prompt: "go to health",
      },
      {
        id: "nav_timer",
        label: "Focus Timer",
        icon: "fa-clock",
        prompt: "go to focus timer",
      },
      {
        id: "nav_flashcards",
        label: "Flashcards",
        icon: "fa-clone",
        prompt: "go to flashcards",
      },
      {
        id: "nav_rehab",
        label: "Rehab",
        icon: "fa-dumbbell",
        prompt: "go to rehab",
      },
      {
        id: "nav_yt_download",
        label: "YT Downloader",
        icon: "fa-download",
        prompt: "go to yt download",
      },
      {
        id: "nav_downloads",
        label: "Saved Videos",
        icon: "fa-film",
        prompt: "go to downloads",
      },
    ],
  },

  // ── Settings ─────────────────────────────────────────────────────────────────
  {
    category: "settings",
    icon: "fa-cog",
    label: "Settings",
    color: "#b0b3b8",
    items: [
      {
        id: "st_main",
        label: "Profile Settings",
        icon: "fa-user-cog",
        prompt: "go to settings",
      },
      {
        id: "st_account",
        label: "Account Settings",
        icon: "fa-id-card",
        prompt: "go to account settings",
      },
      {
        id: "st_privacy",
        label: "Privacy Settings",
        icon: "fa-shield-alt",
        prompt: "go to privacy settings",
      },
      {
        id: "st_notification",
        label: "Notification Settings",
        icon: "fa-bell",
        prompt: "go to notification settings",
      },
      {
        id: "st_message",
        label: "Message Settings",
        icon: "fa-comment-alt",
        prompt: "go to message settings",
      },
      {
        id: "st_sound",
        label: "Sound & Ringtones",
        icon: "fa-volume-up",
        prompt: "go to sound settings",
      },
      {
        id: "st_preference",
        label: "Preferences",
        icon: "fa-sliders-h",
        prompt: "go to preference settings",
      },
      {
        id: "st_cache",
        label: "Cache & Storage",
        icon: "fa-database",
        prompt: "go to cache settings",
      },
    ],
  },

  // ── Friend Management ─────────────────────────────────────────────────────────
  {
    category: "friends",
    icon: "fa-user-friends",
    label: "Friend Management",
    color: "#33e0ff",
    items: [
      {
        id: "ac_add_friend",
        label: "Add Friend",
        icon: "fa-user-plus",
        prompt: "Add friend ",
      },
      {
        id: "ac_unfriend",
        label: "Unfriend",
        icon: "fa-user-times",
        prompt: "Unfriend ",
      },
      {
        id: "ac_block",
        label: "Block Someone",
        icon: "fa-ban",
        prompt: "Block ",
      },
      {
        id: "ac_unblock",
        label: "Unblock Someone",
        icon: "fa-check-circle",
        prompt: "Unblock ",
      },
      {
        id: "ac_friend_nav",
        label: "Go to Friend's Page",
        icon: "fa-external-link-alt",
        prompt: "Go to ",
      },
    ],
  },

  // ── Games ─────────────────────────────────────────────────────────────────────
  {
    category: "games",
    icon: "fa-gamepad",
    label: "Games",
    color: "#29b1a9",
    items: [
      {
        id: "ac_create_ludo",
        label: "Play Ludo",
        icon: "fa-dice",
        prompt: "go to ludo game",
      },
      {
        id: "ac_invite_ludo",
        label: "Invite to Ludo",
        icon: "fa-dice-d6",
        prompt: "Invite to ludo ",
      },
      {
        id: "ac_chess",
        label: "Play Chess",
        icon: "fa-chess",
        prompt: "go to chess game",
      },
    ],
  },

  // ── Videos ────────────────────────────────────────────────────────────────────────────────
  {
    category: "videos",
    icon: "fa-play-circle",
    label: "Videos",
    color: "#ef4444",
    items: [
      {
        id: "vid_search",
        label: "Search Videos",
        icon: "fa-search",
        prompt: "play ",
      },
      {
        id: "vid_action",
        label: "Action Videos",
        icon: "fa-film",
        prompt: "play action",
      },
      {
        id: "vid_comedy",
        label: "Comedy Videos",
        icon: "fa-laugh",
        prompt: "play comedy",
      },
      {
        id: "vid_music",
        label: "Music Videos",
        icon: "fa-music",
        prompt: "play music",
      },
      {
        id: "vid_watch",
        label: "Go to Watch Page",
        icon: "fa-tv",
        prompt: "go to watch",
      },
    ],
  },

  // ── Create & Assist ────────────────────────────────────────────────────────────────
  {
    category: "create",
    icon: "fa-plus-circle",
    label: "Create & Assist",
    color: "#ec4899",
    items: [
      {
        id: "cr_post",
        label: "Write Post Caption",
        icon: "fa-pen",
        prompt: "Write a caption for my post",
      },
      {
        id: "cr_translate",
        label: "Translate Text",
        icon: "fa-language",
        prompt: "Translate this text: ",
      },
      {
        id: "cr_help",
        label: "Get Help",
        icon: "fa-question-circle",
        prompt: "What can you help me with?",
      },
    ],
  },
];

const containerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.04 } },
};
const itemVariants = {
  hidden: { opacity: 0, x: -8 },
  visible: { opacity: 1, x: 0 },
};

const ActionPanel = ({ onActionClick }) => {
  const [expandedCategory, setExpandedCategory] = useState("navigate");

  const toggle = (cat) =>
    setExpandedCategory((prev) => (prev === cat ? null : cat));

  return (
    <div className="ai-agent-action-panel">
      <div className="action-panel-header">
        <h3>Quick Actions</h3>
        <p style={{ fontSize: 11, color: "#b0b3b8", margin: "2px 0 0" }}>
          Click to fill the chat or start a task
        </p>
      </div>

      <motion.div
        className="action-categories"
        variants={containerVariants}
        initial="hidden"
        animate="visible"
      >
        {ACTIONS.map((category) => {
          const isOpen = expandedCategory === category.category;
          return (
            <motion.div
              key={category.category}
              className="action-category"
              variants={itemVariants}
            >
              {/* Header */}
              <motion.button
                className={`category-header ${isOpen ? "expanded" : ""}`}
                onClick={() => toggle(category.category)}
                whileHover={{ backgroundColor: "rgba(255,255,255,0.06)" }}
                whileTap={{ scale: 0.98 }}
                style={{
                  borderLeft: isOpen
                    ? `3px solid ${category.color}`
                    : "3px solid transparent",
                }}
              >
                <div
                  className="category-icon"
                  style={{ color: category.color }}
                >
                  <i className={`fas ${category.icon}`} />
                </div>
                <span className="category-label">{category.label}</span>
                <i
                  className={`fas fa-chevron-right category-chevron ${isOpen ? "rotate" : ""}`}
                />
              </motion.button>

              {/* Items */}
              <AnimatePresence initial={false}>
                {isOpen && (
                  <motion.div
                    className="category-items"
                    key="items"
                    initial={{ height: 0, opacity: 0 }}
                    animate={{ height: "auto", opacity: 1 }}
                    exit={{ height: 0, opacity: 0 }}
                    transition={{ duration: 0.22 }}
                    style={{ overflow: "hidden" }}
                  >
                    {category.items.map((item, idx) => (
                      <motion.button
                        key={item.id}
                        className="action-item"
                        onClick={() =>
                          onActionClick({ ...item, color: category.color })
                        }
                        whileHover={{
                          x: 4,
                          backgroundColor: `${category.color}12`,
                        }}
                        whileTap={{ scale: 0.97 }}
                        initial={{ opacity: 0, x: -6 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                      >
                        <i
                          className={`fas ${item.icon}`}
                          style={{
                            color: category.color,
                            width: 16,
                            textAlign: "center",
                          }}
                        />
                        <span>{item.label}</span>
                      </motion.button>
                    ))}
                  </motion.div>
                )}
              </AnimatePresence>
            </motion.div>
          );
        })}
      </motion.div>

      <div className="action-panel-footer">
        <p className="footer-hint">
          <i
            className="fas fa-keyboard"
            style={{ marginRight: 4, color: "#00d4ff" }}
          />
          Or just type naturally — I understand plain language!
        </p>
      </div>
    </div>
  );
};

export default ActionPanel;

import React, { useCallback, useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { shallowEqual, useSelector } from "react-redux";
import { MENU_APPS } from "../constants/menuApps";
import useFeatureFlags, { filterByFeatureFlags } from "../hooks/useFeatureFlags";
import { useAuth } from "../hooks/useAuth";
import ConfirmLogoutDialog from "../components/ConfirmLogout/ConfirmLogoutDialog";
import config from "../config/config.json";
import {
  PROFILE_IMG_REFERRER_POLICY,
  sanitizeProfileImageUrl,
} from "../utils/profileImage";
import { getProfilePath } from "../utils/profilePath";
import { getUserFromStorage } from "../utils/storageUtils";
import {
  formatBadgeCount,
  selectUnreadMessageCount,
} from "../partials/header/HeaderRight";
import {
  getVoiceHelpLang,
  hasBanglaVoice,
  isVoiceHelpSupported,
  setVoiceHelpLang,
  speakHelp,
  subscribeVoiceHelp,
  whenVoicesReady,
} from "../utils/voiceHelp";
import "./Menu.css";

// The menu is built for everyone, including people who cannot read: big
// picture tiles with one or two words, a distinct colour per tile, "hold to
// hear" on every button (see components/VoiceHelp) and a voice assistant.

const VOICE_TIP_KEY = "menu_voice_tip_hidden";

const APP_BY_KEY = MENU_APPS.reduce((acc, app) => {
  acc[app.key] = app;
  return acc;
}, {});

const app = (key, extra) => ({ ...APP_BY_KEY[key], ...extra });

const SECTIONS = [
  {
    id: "people",
    title: "Chat & friends",
    items: [
      {
        key: "messages",
        short: "Messages",
        href: "/message",
        icon: "fas fa-comment-dots",
        colors: ["#22C55E", "#15803D"],
        say: "Messages. Chat with people.",
        sayBn: "মেসেজ। মানুষের সাথে কথা বলুন।",
        badge: "messages",
      },
      {
        key: "connects",
        short: "Connects",
        href: "/connects",
        icon: "fas fa-user-friends",
        colors: ["#3B82F6", "#1D4ED8"],
        say: "Connects. Your friends and people you know.",
        sayBn: "কানেক্টস। আপনার বন্ধু আর পরিচিত মানুষ।",
      },
      {
        key: "find-friends",
        short: "Find friends",
        href: "/connects/suggestions",
        icon: "fas fa-user-plus",
        colors: ["#14B8A6", "#0F766E"],
        say: "Find friends. Add new people.",
        sayBn: "বন্ধু খুঁজুন। নতুন মানুষ যোগ করুন।",
      },
    ],
  },
  {
    id: "watch",
    title: "Watch & play",
    items: [
      {
        key: "videos",
        short: "Videos",
        href: "/watch",
        icon: "fas fa-play",
        colors: ["#F97316", "#C2410C"],
        say: "Videos. Watch videos.",
        sayBn: "ভিডিও। ভিডিও দেখুন।",
      },
      app("video-player", { icon: "fas fa-music", colors: ["#EC4899", "#BE185D"] }),
      {
        key: "saved-videos",
        short: "Saved videos",
        href: "/downloads",
        icon: "fas fa-film",
        colors: ["#8B5CF6", "#6D28D9"],
        say: "Saved videos. Watch them without internet.",
        sayBn: "সেভ করা ভিডিও। ইন্টারনেট ছাড়াই দেখুন।",
      },
      app("camera", { icon: "fas fa-camera", colors: ["#0EA5E9", "#0369A1"] }),
      app("ludo", { icon: "fas fa-dice", colors: ["#F43F5E", "#F59E0B"] }),
      app("chess", { icon: "fas fa-chess-knight", colors: ["#6366F1", "#4338CA"] }),
      app("yt-download", { icon: "fab fa-youtube", colors: ["#EF4444", "#B91C1C"] }),
    ],
  },
  {
    id: "tools",
    title: "Daily tools",
    items: [
      app("notes", { icon: "fas fa-sticky-note", colors: ["#EAB308", "#A16207"] }),
      app("tasks", { icon: "fas fa-clipboard-check", colors: ["#10B981", "#047857"] }),
      app("timer", { icon: "fas fa-stopwatch", colors: ["#A855F7", "#7E22CE"] }),
      app("calendar", { icon: "fas fa-calendar-alt", colors: ["#F43F5E", "#BE123C"] }),
      app("habits", { icon: "fas fa-chart-line", colors: ["#84CC16", "#4D7C0F"] }),
      app("flashcards", { icon: "fas fa-clone", colors: ["#06B6D4", "#0E7490"] }),
    ],
  },
  {
    id: "more",
    title: "More",
    items: [
      app("health", { icon: "fas fa-heartbeat", colors: ["#22C55E", "#15803D"] }),
      app("rehab", { icon: "fas fa-hand-holding-heart", colors: ["#EC4899", "#BE185D"] }),
      {
        key: "marketplace",
        short: "Marketplace",
        href: "/marketplace",
        icon: "fas fa-store",
        colors: ["#14B8A6", "#0F766E"],
        say: "Marketplace. Buy and sell things.",
        sayBn: "মার্কেটপ্লেস। জিনিস কেনাবেচা করুন।",
      },
      {
        key: "wallet",
        short: "Wallet",
        href: "/wallet",
        icon: "fas fa-wallet",
        colors: ["#F59E0B", "#B45309"],
        say: "Wallet. Your coins.",
        sayBn: "ওয়ালেট। আপনার কয়েন।",
      },
      {
        key: "download-app",
        short: "Get the app",
        href: "/download-app",
        icon: "fas fa-mobile-alt",
        colors: ["#0EA5E9", "#0369A1"],
        say: "Get the app. Install Connect on your phone.",
        sayBn: "অ্যাপ নিন। ফোনে কানেক্ট ইনস্টল করুন।",
      },
      app("settings", { icon: "fas fa-cog", colors: ["#64748B", "#334155"] }),
    ],
  },
];

const selectMenuProfile = (state) => {
  const profile = state.profile;
  if (!profile) return null;
  return {
    _id: profile._id,
    username: profile.username,
    profilePic: profile.profilePic,
    fullName: profile.fullName,
    firstName: profile.user?.firstName,
    surname: profile.user?.surname,
  };
};

const readHiddenTip = () => {
  try {
    return localStorage.getItem(VOICE_TIP_KEY) === "true";
  } catch (_) {
    return false;
  }
};

const useVoiceLang = () => {
  const [lang, setLang] = useState(getVoiceHelpLang);
  useEffect(() => subscribeVoiceHelp(() => setLang(getVoiceHelpLang())), []);
  return lang;
};

const MenuTile = ({ item, badgeCount }) => (
  <Link
    to={item.href}
    className="menu-tile"
    style={{ "--tile-a": item.colors[0], "--tile-b": item.colors[1] }}
    data-speak={item.say || item.short}
    data-speak-bn={item.sayBn || item.bn || ""}
  >
    <span className="menu-tile-icon" aria-hidden="true">
      <i className={item.icon} />
      {badgeCount > 0 && (
        <span className="menu-tile-badge">{formatBadgeCount(badgeCount)}</span>
      )}
    </span>
    <span className="menu-tile-label">{item.short || item.name}</span>
    {badgeCount > 0 && (
      <span className="visually-hidden">, {badgeCount} new</span>
    )}
  </Link>
);

const Menu = () => {
  const flags = useFeatureFlags();
  const navigate = useNavigate();
  const { logout } = useAuth();
  const profile = useSelector(selectMenuProfile, shallowEqual);
  const unreadMessages = useSelector(selectUnreadMessageCount);
  const lang = useVoiceLang();
  const [tipHidden, setTipHidden] = useState(readHiddenTip);
  const [banglaReady, setBanglaReady] = useState(hasBanglaVoice);
  const [confirmLogout, setConfirmLogout] = useState(false);
  const voiceSupported = isVoiceHelpSupported();

  useEffect(() => {
    let alive = true;
    whenVoicesReady().then(() => {
      if (alive) setBanglaReady(hasBanglaVoice());
    });
    return () => {
      alive = false;
    };
  }, []);

  const storedUser = getUserFromStorage() || {};
  const profilePath = getProfilePath(profile?._id ? profile : storedUser.profile);
  const displayName =
    profile?.fullName ||
    [profile?.firstName, profile?.surname].filter(Boolean).join(" ") ||
    [storedUser.firstName, storedUser.surname].filter(Boolean).join(" ") ||
    "Your profile";
  const avatar =
    sanitizeProfileImageUrl(profile?.profilePic, 160) ||
    profile?.profilePic ||
    config?.defaultProfile;

  const openVoiceAgent = useCallback(() => {
    // The header listens for this and opens the assistant already listening;
    // if nothing handled it, open the assistant the plain way.
    const event = new Event("openAIAgentVoice", { cancelable: true });
    const unhandled = window.dispatchEvent(event);
    if (unhandled) window.dispatchEvent(new Event("openAIAgent"));
  }, []);

  const chooseLang = useCallback((next) => {
    setVoiceHelpLang(next);
    speakHelp(
      next === "bn"
        ? {
            en: "This phone has no Bangla voice, so names are read in English.",
            bn: "এখন থেকে বাটনের নাম বাংলায় শুনবেন।",
          }
        : { en: "Button names will be read in English." },
    );
  }, []);

  const hideTip = useCallback(() => {
    setTipHidden(true);
    try {
      localStorage.setItem(VOICE_TIP_KEY, "true");
    } catch (_) {
      // private mode: hide for this visit only
    }
  }, []);

  const showTip = useCallback(() => {
    setTipHidden(false);
    try {
      localStorage.removeItem(VOICE_TIP_KEY);
    } catch (_) {
      // ignore
    }
    window.scrollTo({ top: 0, behavior: "smooth" });
  }, []);

  const doLogout = useCallback(() => {
    setConfirmLogout(false);
    logout();
    navigate("/login");
  }, [logout, navigate]);

  const cancelLogout = useCallback(() => setConfirmLogout(false), []);

  const sections = SECTIONS.map((section) => ({
    ...section,
    items: filterByFeatureFlags(section.items, flags),
  })).filter((section) => section.items.length > 0);

  return (
    <div className="menu-page">
      <div className="menu-page-inner">
        <h1 className="menu-page-title">Menu</h1>

        <div className="menu-hero">
          <Link
            to={profilePath}
            className="menu-profile"
            data-speak="Your profile. See your photos and posts."
            data-speak-bn="আপনার প্রোফাইল। আপনার ছবি আর পোস্ট দেখুন।"
          >
            <span className="menu-profile-avatar">
              <img
                src={avatar}
                alt=""
                referrerPolicy={PROFILE_IMG_REFERRER_POLICY}
                onError={(event) => {
                  if (config?.defaultProfile && event.currentTarget.src !== config.defaultProfile) {
                    event.currentTarget.src = config.defaultProfile;
                  }
                }}
              />
            </span>
            <span className="menu-profile-text">
              <span className="menu-profile-name">{displayName}</span>
              <span className="menu-profile-hint">See your profile</span>
            </span>
            <i className="fas fa-chevron-right menu-profile-go" aria-hidden="true" />
          </Link>

          <button
            type="button"
            className="menu-voice-hero"
            onClick={openVoiceAgent}
            data-speak="Ask by voice. Tap here and say what you want to do."
            data-speak-bn="কথা বলে চালান। এখানে চাপ দিয়ে বলুন আপনি কী করতে চান।"
          >
            <span className="menu-voice-mic" aria-hidden="true">
              <i className="fas fa-microphone" />
            </span>
            <span className="menu-voice-text">
              <span className="menu-voice-title">Ask by voice</span>
              <span className="menu-voice-sub">
                Tap and say what you want, like “open messages”
              </span>
            </span>
          </button>
        </div>

        {voiceSupported && !tipHidden && (
          <section className="menu-voice-help" aria-label="Voice help">
            <span className="menu-voice-help-icon" aria-hidden="true">
              <i className="fas fa-volume-up" />
            </span>
            <div className="menu-voice-help-body">
              <p className="menu-voice-help-title">
                Press and hold any button to hear its name
              </p>
              <div className="menu-voice-help-langs" role="group" aria-label="Voice language">
                <button
                  type="button"
                  className="menu-lang-chip"
                  aria-pressed={lang === "en"}
                  onClick={() => chooseLang("en")}
                  data-speak="English voice"
                >
                  English
                </button>
                <button
                  type="button"
                  className="menu-lang-chip"
                  lang="bn"
                  aria-pressed={lang === "bn"}
                  onClick={() => chooseLang("bn")}
                  data-speak="Bangla voice"
                  data-speak-bn="বাংলা ভয়েস"
                >
                  বাংলা
                </button>
              </div>
              {lang === "bn" && !banglaReady && (
                <p className="menu-voice-help-note">
                  This phone has no Bangla voice, so names are read in English.
                </p>
              )}
            </div>
            <button
              type="button"
              className="menu-voice-help-close"
              onClick={hideTip}
              aria-label="Hide this tip"
              data-speak="Hide this tip"
              data-speak-bn="এই পরামর্শ লুকান"
            >
              <i className="fas fa-times" aria-hidden="true" />
            </button>
          </section>
        )}

        {sections.map((section) => (
          <section
            key={section.id}
            className="menu-section"
            aria-labelledby={`menu-section-${section.id}`}
          >
            <h2 className="menu-section-title" id={`menu-section-${section.id}`}>
              {section.title}
            </h2>
            <div className="menu-grid">
              {section.items.map((item) => (
                <MenuTile
                  key={item.key}
                  item={item}
                  badgeCount={item.badge === "messages" ? unreadMessages : 0}
                />
              ))}
            </div>
          </section>
        ))}

        <div className="menu-rows">
          {voiceSupported && tipHidden && (
            <button
              type="button"
              className="menu-row"
              onClick={showTip}
              data-speak="Voice help. Hear button names."
              data-speak-bn="ভয়েস সাহায্য। বাটনের নাম শুনুন।"
            >
              <span className="menu-row-icon is-voice" aria-hidden="true">
                <i className="fas fa-volume-up" />
              </span>
              <span className="menu-row-label">Voice help</span>
              <i className="fas fa-chevron-right menu-row-go" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            className="menu-row is-danger"
            onClick={() => setConfirmLogout(true)}
            data-speak="Log out"
            data-speak-bn="লগ আউট"
          >
            <span className="menu-row-icon" aria-hidden="true">
              <i className="fas fa-sign-out-alt" />
            </span>
            <span className="menu-row-label">Log out</span>
          </button>
        </div>
      </div>

      <ConfirmLogoutDialog
        open={confirmLogout}
        onConfirm={doLogout}
        onCancel={cancelLogout}
      />
    </div>
  );
};

export default Menu;

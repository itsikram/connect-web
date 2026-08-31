import React, { useCallback, useEffect, useRef, useState } from "react";
import EmojiPicker from "emoji-picker-react";
import ModalContainer from "../modal/ModalContainer";
import UserPP from "../UserPP";
import api from "../../api/api";
import { showErrorToast, showSuccessToast } from "../../utils/toastUtils";
import {
  CHAT_THEMES,
  QUICK_REACTION_PRESETS,
} from "../../utils/chatThemes";
import useFriendChatSettings from "../../hooks/useFriendChatSettings";
import "./ChatSettingsModal.css";

const ChatSettingsModal = ({
  isOpen,
  onRequestClose,
  friendId,
  friendProfile,
}) => {
  const {
    settings,
    theme,
    wallpaper,
    updateSettings,
    resetSettings,
  } = useFriendChatSettings(friendId);
  const [showEmojiPicker, setShowEmojiPicker] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef(null);
  const pickerRef = useRef(null);

  const friendName =
    friendProfile?.fullName ||
    `${friendProfile?.user?.firstName || ""} ${friendProfile?.user?.surname || ""}`.trim() ||
    "this chat";

  useEffect(() => {
    if (!isOpen) setShowEmojiPicker(false);
  }, [isOpen]);

  useEffect(() => {
    if (!showEmojiPicker) return undefined;
    const handleClick = (event) => {
      if (pickerRef.current && !pickerRef.current.contains(event.target)) {
        setShowEmojiPicker(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showEmojiPicker]);

  const handleThemeSelect = useCallback(
    (themeId) => {
      const next = { themeId };
      if (settings.wallpaperSource !== "custom") {
        next.wallpaperSource = "theme";
      }
      if (themeId === "love" && (!settings.actionEmoji || settings.actionEmoji === "👍")) {
        next.actionEmoji = "❤️";
      }
      updateSettings(next);
    },
    [updateSettings, settings.wallpaperSource, settings.actionEmoji],
  );

  const handleWallpaperSource = useCallback(
    (wallpaperSource) => {
      updateSettings({ wallpaperSource });
    },
    [updateSettings],
  );

  const handleUploadBackground = useCallback(
    async (event) => {
      const file = event.currentTarget.files?.[0];
      if (!file) return;
      if (!file.type.startsWith("image/")) {
        showErrorToast("Please choose an image file");
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        showErrorToast("Image must be less than 5MB");
        return;
      }

      setIsUploading(true);
      try {
        const formData = new FormData();
        formData.append("file", file);
        const res = await api.post("/upload/file", formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        const url = res.data?.secure_url;
        if (res.status === 200 && url) {
          updateSettings({
            wallpaperSource: "custom",
            customBackground: url,
          });
          showSuccessToast("Chat wallpaper updated");
        } else {
          showErrorToast("Could not upload wallpaper");
        }
      } catch (error) {
        console.error("Chat wallpaper upload failed:", error);
        showErrorToast("Failed to upload wallpaper");
      } finally {
        setIsUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    },
    [updateSettings],
  );

  const handleRemoveCustom = useCallback(() => {
    updateSettings({
      wallpaperSource: "theme",
      customBackground: null,
    });
  }, [updateSettings]);

  const handleEmojiSelect = useCallback(
    (emoji) => {
      updateSettings({ actionEmoji: emoji });
      setShowEmojiPicker(false);
    },
    [updateSettings],
  );

  const handleReset = useCallback(() => {
    resetSettings();
    showSuccessToast("Chat appearance reset");
  }, [resetSettings]);

  const wallpaperPreviewStyle =
    wallpaper.type === "image"
      ? { backgroundImage: `url('${wallpaper.value}')` }
      : { backgroundImage: wallpaper.value };

  if (!isOpen) return null;

  return (
    <ModalContainer
      title="Chat appearance"
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      id="chatSettingsModal"
      className="chat-settings-modal-shell"
    >
      <div className="chat-settings-modal" data-chat-theme={theme.id}>
        <div className="modal-header">
          <div className="chat-settings-heading">
            <h3 className="modal-title">Chat appearance</h3>
            <p className="chat-settings-subtitle">
              Customize this conversation with {friendName}
            </p>
          </div>
          <button
            type="button"
            onClick={onRequestClose}
            className="modal-close-btn"
            aria-label="Close chat settings"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="app-modal-body chat-settings-body">
          <div className="chat-settings-friend">
            <UserPP
              profilePic={friendProfile?.profilePic}
              profile={friendId || friendProfile?._id}
              active={friendProfile?.isActive}
              size={42}
            />
            <div>
              <strong>{friendName}</strong>
              <span>Settings apply only to this chat</span>
            </div>
          </div>

          <section className="chat-settings-section">
            <div className="chat-settings-section-head">
              <h4>Theme</h4>
              <span>{theme.name}</span>
            </div>
            <div className="chat-theme-grid" role="list">
              {CHAT_THEMES.map((item) => {
                const selected = item.id === settings.themeId;
                return (
                  <button
                    key={item.id}
                    type="button"
                    role="listitem"
                    className={`chat-theme-card ${selected ? "is-selected" : ""} ${item.couple ? "is-couple" : ""}`}
                    onClick={() => handleThemeSelect(item.id)}
                    aria-pressed={selected}
                    title={item.description}
                  >
                    <div
                      className="chat-theme-preview"
                      style={{ backgroundImage: item.wallpaperCss }}
                    >
                      {item.couple && (
                        <span className="chat-theme-badge">Couples</span>
                      )}
                      <span
                        className="chat-theme-bubble recv"
                        style={{ background: item.preview.recv }}
                      />
                      <span
                        className="chat-theme-bubble sent"
                        style={{ background: item.preview.sent }}
                      />
                    </div>
                    <div className="chat-theme-meta">
                      <strong>{item.name}</strong>
                      <small>{item.description}</small>
                    </div>
                    {selected && (
                      <span className="chat-theme-check" aria-hidden="true">
                        <i className="fas fa-check"></i>
                      </span>
                    )}
                  </button>
                );
              })}
            </div>
            {theme.loveRain && (
              <p className="chat-love-hint">
                Send ❤️ 🥰 😘 or words like “love you”, “miss you”, “jaan”, or
                “ভালোবাসি” and a shower of ❤️ 🥰 😘 💋 💕 😍 🫶 🌹 falls for
                both of you.
              </p>
            )}
          </section>

          <section className="chat-settings-section">
            <div className="chat-settings-section-head">
              <h4>Wallpaper</h4>
            </div>
            <div
              className="chat-wallpaper-preview"
              data-bg-overlay={
                settings.showBackgroundOverlay === false ? "off" : "on"
              }
              style={wallpaperPreviewStyle}
            >
              <div className="chat-wallpaper-preview-bubbles">
                <span className="recv" />
                <span className="sent" />
              </div>
            </div>
            <div className="chat-wallpaper-options" role="radiogroup">
              <label className={settings.wallpaperSource === "theme" ? "is-active" : ""}>
                <input
                  type="radio"
                  name="chat-wallpaper-source"
                  checked={settings.wallpaperSource === "theme"}
                  onChange={() => handleWallpaperSource("theme")}
                />
                <span>Theme default</span>
              </label>
              <label className={settings.wallpaperSource === "global" ? "is-active" : ""}>
                <input
                  type="radio"
                  name="chat-wallpaper-source"
                  checked={settings.wallpaperSource === "global"}
                  onChange={() => handleWallpaperSource("global")}
                />
                <span>Account wallpaper</span>
              </label>
              <label className={settings.wallpaperSource === "custom" ? "is-active" : ""}>
                <input
                  type="radio"
                  name="chat-wallpaper-source"
                  checked={settings.wallpaperSource === "custom"}
                  onChange={() => handleWallpaperSource("custom")}
                />
                <span>Custom photo</span>
              </label>
            </div>
            <div className="chat-wallpaper-actions">
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                hidden
                onChange={handleUploadBackground}
              />
              <button
                type="button"
                className="chat-settings-btn"
                onClick={() => fileInputRef.current?.click()}
                disabled={isUploading}
              >
                {isUploading ? "Uploading…" : "Upload photo"}
              </button>
              {settings.customBackground && (
                <button
                  type="button"
                  className="chat-settings-btn ghost"
                  onClick={handleRemoveCustom}
                >
                  Remove photo
                </button>
              )}
            </div>
            <label
              className={`chat-overlay-toggle ${
                settings.showBackgroundOverlay ? "is-on" : ""
              }`}
            >
              <input
                type="checkbox"
                checked={settings.showBackgroundOverlay !== false}
                onChange={(event) =>
                  updateSettings({
                    showBackgroundOverlay: event.target.checked,
                  })
                }
              />
              <span className="chat-overlay-switch" aria-hidden="true" />
              <span className="chat-overlay-copy">
                <strong>Background overlay</strong>
                <small>Dim the wallpaper so messages stay readable</small>
              </span>
            </label>
          </section>

          <section className="chat-settings-section">
            <div className="chat-settings-section-head">
              <h4>Quick reaction</h4>
              <span>Tap the composer button to send this instantly</span>
            </div>
            <div className="chat-emoji-current">
              <span className="chat-emoji-current-glyph" aria-hidden="true">
                {settings.actionEmoji}
              </span>
              <div>
                <strong>Quick action emoji</strong>
                <small>Used in this conversation only</small>
              </div>
            </div>
            <div className="chat-emoji-presets">
              {QUICK_REACTION_PRESETS.map((emoji) => (
                <button
                  key={emoji}
                  type="button"
                  className={`chat-emoji-preset ${
                    settings.actionEmoji === emoji ? "is-selected" : ""
                  }`}
                  onClick={() => handleEmojiSelect(emoji)}
                  aria-label={`Set quick reaction to ${emoji}`}
                >
                  {emoji}
                </button>
              ))}
              <div className="chat-emoji-more" ref={pickerRef}>
                <button
                  type="button"
                  className="chat-emoji-preset more"
                  onClick={() => setShowEmojiPicker((prev) => !prev)}
                  aria-expanded={showEmojiPicker}
                  aria-label="Choose another emoji"
                >
                  <i className="fas fa-plus"></i>
                </button>
                {showEmojiPicker && (
                  <div className="chat-emoji-picker">
                    <EmojiPicker
                      theme="dark"
                      width={280}
                      height={340}
                      onEmojiClick={(emojiObj) =>
                        handleEmojiSelect(emojiObj.emoji)
                      }
                    />
                  </div>
                )}
              </div>
            </div>
          </section>
        </div>

        <div className="chat-settings-footer">
          <button type="button" className="chat-settings-btn ghost" onClick={handleReset}>
            Reset to default
          </button>
          <button type="button" className="chat-settings-btn primary" onClick={onRequestClose}>
            Done
          </button>
        </div>
      </div>
    </ModalContainer>
  );
};

export default ChatSettingsModal;

import React from "react";

const ComposerMicMenu = ({
  view = "main",
  onOpenTranscribe,
  onBack,
  onSelectLang,
  onVoiceMessage,
}) => {
  if (view === "transcribe") {
    return (
      <div className="composer-mic-menu" role="menu">
        <button
          type="button"
          className="composer-mic-menu-item is-back"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onBack();
          }}
        >
          <span className="composer-mic-menu-icon back">
            <i className="fas fa-chevron-left"></i>
          </span>
          <span className="composer-mic-menu-copy">
            <span className="composer-mic-menu-title">Live transcribe</span>
            <span className="composer-mic-menu-desc">
              Choose a recognition language
            </span>
          </span>
        </button>
        <button
          type="button"
          className="composer-mic-menu-item"
          role="menuitem"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSelectLang("bn-BD");
          }}
        >
          <span className="composer-mic-menu-icon lang-bn">বাং</span>
          <span className="composer-mic-menu-copy">
            <span className="composer-mic-menu-title">Bangla</span>
            <span className="composer-mic-menu-desc">
              Recognize speech in Bangla via Deepgram
            </span>
          </span>
        </button>
        <button
          type="button"
          className="composer-mic-menu-item"
          role="menuitem"
          onClick={(e) => {
            e.preventDefault();
            e.stopPropagation();
            onSelectLang("en-US");
          }}
        >
          <span className="composer-mic-menu-icon lang-en">EN</span>
          <span className="composer-mic-menu-copy">
            <span className="composer-mic-menu-title">English</span>
            <span className="composer-mic-menu-desc">
              Browser speech recognition, or Deepgram if needed
            </span>
          </span>
        </button>
      </div>
    );
  }

  return (
    <div className="composer-mic-menu" role="menu">
      <button
        type="button"
        className="composer-mic-menu-item"
        role="menuitem"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onOpenTranscribe();
        }}
      >
        <span className="composer-mic-menu-icon transcribe">
          <i className="fas fa-closed-captioning"></i>
        </span>
        <span className="composer-mic-menu-copy">
          <span className="composer-mic-menu-title">Live transcribe</span>
          <span className="composer-mic-menu-desc">
            Bangla or English speech to text
          </span>
        </span>
      </button>
      <button
        type="button"
        className="composer-mic-menu-item"
        role="menuitem"
        onClick={(e) => {
          e.preventDefault();
          e.stopPropagation();
          onVoiceMessage();
        }}
      >
        <span className="composer-mic-menu-icon voice">
          <i className="fas fa-microphone"></i>
        </span>
        <span className="composer-mic-menu-copy">
          <span className="composer-mic-menu-title">Voice message</span>
          <span className="composer-mic-menu-desc">
            Record audio and send it
          </span>
        </span>
      </button>
    </div>
  );
};

export default ComposerMicMenu;

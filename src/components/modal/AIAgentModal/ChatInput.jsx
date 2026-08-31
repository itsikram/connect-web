import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import useComposerLiveTranscribe from "../../../hooks/useComposerLiveTranscribe";

const SUGGESTIONS = [
  "Go to settings",
  "Open my profile",
  "Go to messages",
  "Go to friends page",
  "Open watch page",
  "Go to notes",
  "Go to tasks",
  "Open calendar",
  "Call [friend name]",
  "Video call [friend name]",
  "Message [friend name]",
  "Bump [friend name]",
  "Go to [friend]'s profile",
  "View [friend]'s friends",
  "See [friend]'s photos",
  "Where is [friend name]?",
  "Open account settings",
  "Go to privacy settings",
  "Open notification settings",
  "Play Ludo",
  "Invite [friend name] to Ludo",
  "Play Chess",
  "Play [video name]",
  "Play action",
  "Find videos about music",
  "Search for comedy video",
  "Block [name]",
  "Unblock [name]",
  "What can you help with?",
  "Create a post with a funny caption",
  "What are my notes?",
  "Who are my friends?",
  "Search posts about music",
  "Call [friend name]",
];

const AUTO_SEND_DELAY_MS = 3000;

const ChatInput = ({
  value,
  onChange,
  onSend,
  isLoading,
  autoRunActions = false,
  modalInteractionVersion = 0,
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [voiceMode, setVoiceMode] = useState("bn");

  const inputRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const onSendRef = useRef(onSend);
  const valueRef = useRef(value);
  const transcribeBaseRef = useRef("");
  const autoSendTimeoutRef = useRef(null);
  const autoRunActionsRef = useRef(autoRunActions);
  const modalInteractionVersionRef = useRef(modalInteractionVersion);

  useEffect(() => {
    onChangeRef.current = onChange;
    onSendRef.current = onSend;
  }, [onChange, onSend]);

  useEffect(() => {
    valueRef.current = value;
  }, [value]);

  useEffect(() => {
    autoRunActionsRef.current = autoRunActions;
  }, [autoRunActions]);

  useEffect(() => {
    modalInteractionVersionRef.current = modalInteractionVersion;
  }, [modalInteractionVersion]);

  const clearAutoSendTimeout = useCallback(() => {
    if (autoSendTimeoutRef.current) {
      clearTimeout(autoSendTimeoutRef.current);
      autoSendTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => clearAutoSendTimeout(), [clearAutoSendTimeout]);

  useEffect(() => {
    if (!autoRunActions) clearAutoSendTimeout();
  }, [autoRunActions, clearAutoSendTimeout]);

  useEffect(() => {
    if (isLoading) clearAutoSendTimeout();
  }, [isLoading, clearAutoSendTimeout]);

  useEffect(() => {
    clearAutoSendTimeout();
  }, [modalInteractionVersion, clearAutoSendTimeout]);

  const scheduleAutoSend = useCallback(
    (finalText) => {
      const nextText = typeof finalText === "string" ? finalText.trim() : "";
      if (!autoRunActionsRef.current || !nextText) return;

      clearAutoSendTimeout();
      const scheduledInteractionVersion = modalInteractionVersionRef.current;
      autoSendTimeoutRef.current = setTimeout(() => {
        autoSendTimeoutRef.current = null;
        if (modalInteractionVersionRef.current !== scheduledInteractionVersion) {
          return;
        }
        if (!autoRunActionsRef.current) return;
        onSendRef.current(nextText);
      }, AUTO_SEND_DELAY_MS);
    },
    [clearAutoSendTimeout],
  );

  const handleTranscriptInterim = useCallback((text) => {
    if (!text) return;
    const next = [transcribeBaseRef.current, text].filter(Boolean).join(" ");
    onChangeRef.current(next);
  }, []);

  const handleTranscriptFinal = useCallback(
    (text) => {
      if (!text) return;
      const next = [transcribeBaseRef.current, text].filter(Boolean).join(" ");
      transcribeBaseRef.current = next;
      onChangeRef.current(next);
      if (autoRunActionsRef.current) scheduleAutoSend(next);
    },
    [scheduleAutoSend],
  );

  const {
    listening: isListening,
    supported: isSpeechSupported,
    start: startTranscription,
    stop: stopTranscription,
  } = useComposerLiveTranscribe({
    onFinal: handleTranscriptFinal,
    onInterim: handleTranscriptInterim,
  });

  useEffect(() => {
    if (isLoading && isListening) {
      stopTranscription();
    }
  }, [isLoading, isListening, stopTranscription]);

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        clearAutoSendTimeout();
        stopTranscription();
        onSend();
      }
    }
  };

  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.style.height = "auto";
      inputRef.current.style.height =
        Math.min(inputRef.current.scrollHeight, 120) + "px";
    }
  }, [value]);

  const handleSuggestionClick = (s) => {
    clearAutoSendTimeout();
    onChange(s.replace(/\[.*?\]/g, ""));
    setShowSuggestions(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const toggleVoiceInput = async () => {
    if (isListening) {
      stopTranscription();
      return;
    }

    if (!isSpeechSupported || isLoading) return;

    clearAutoSendTimeout();
    transcribeBaseRef.current = String(valueRef.current || "").trim();
    setShowSuggestions(false);
    const langCode = voiceMode === "bn" ? "bn-BD" : "en-US";
    const started = await startTranscription(langCode);
    if (started) {
      requestAnimationFrame(() => {
        inputRef.current?.focus?.({ preventScroll: true });
      });
    }
  };

  const toggleVoiceMode = () => {
    if (isListening || isLoading) return;
    setVoiceMode((mode) => (mode === "bn" ? "en" : "bn"));
  };

  const handleTextChange = (nextValue) => {
    clearAutoSendTimeout();
    if (isListening) {
      stopTranscription();
    }
    transcribeBaseRef.current = String(nextValue || "").trim();
    onChange(nextValue);
  };

  return (
    <motion.div
      className="ai-agent-chat-input-container"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
    >
      {showSuggestions && !value && (
        <motion.div
          className="ai-agent-suggestions"
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: 8 }}
        >
          <p className="suggestions-label">
            <i
              className="fas fa-bolt"
              style={{ marginRight: 5, color: "#f59e0b" }}
            />
            Quick examples:
          </p>
          <div className="suggestions-grid">
            {SUGGESTIONS.map((s, i) => (
              <motion.button
                key={i}
                className="suggestion-chip"
                onClick={() => handleSuggestionClick(s)}
                whileHover={{ scale: 1.04 }}
                whileTap={{ scale: 0.97 }}
              >
                {s}
              </motion.button>
            ))}
          </div>
        </motion.div>
      )}

      {isListening && (
        <div className="ai-agent-transcribe-bar" aria-live="polite">
          <span className="ai-agent-transcribe-dot" aria-hidden="true" />
          <span className="ai-agent-transcribe-label">
            Live {voiceMode === "bn" ? "Bangla" : "English"}
          </span>
        </div>
      )}

      <div className={`ai-agent-input-wrapper ${isFocused ? "focused" : ""}`}>
        <motion.button
          className="ai-agent-voice-lang-toggle"
          onClick={toggleVoiceMode}
          disabled={isListening || isLoading}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="button"
          title={
            voiceMode === "bn"
              ? "Voice input language: Bangla (tap to switch to English)"
              : "Voice input language: English (tap to switch to Bangla)"
          }
          aria-label="Toggle voice input language"
        >
          {voiceMode === "bn" ? "বাং" : "EN"}
        </motion.button>

        <motion.button
          className={`ai-agent-voice-btn ${isListening ? "listening" : ""}`}
          onClick={toggleVoiceInput}
          disabled={!isSpeechSupported || isLoading}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="button"
          title={
            isSpeechSupported
              ? isListening
                ? "Stop live transcription"
                : voiceMode === "bn"
                  ? "Start Bangla live transcription"
                  : "Start English live transcription"
              : "Voice input is not supported in this browser"
          }
          aria-label={
            isListening
              ? "Stop live transcription"
              : voiceMode === "bn"
                ? "Start Bangla live transcription"
                : "Start English live transcription"
          }
        >
          <i className={`fas ${isListening ? "fa-stop" : "fa-microphone"}`} />
        </motion.button>

        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyPress={handleKeyPress}
          onFocus={() => {
            setIsFocused(true);
            setShowSuggestions(true);
          }}
          onBlur={() => {
            setIsFocused(false);
            setTimeout(() => setShowSuggestions(false), 200);
          }}
          placeholder={
            isListening
              ? voiceMode === "bn"
                ? "Listening in Bangla… speak naturally"
                : "Listening in English… speak naturally"
              : "Try: 'go to settings', 'call John', 'open my profile'…"
          }
          className="ai-agent-input"
          rows="1"
          disabled={isLoading}
        />

        <div className="ai-agent-input-actions">
          <motion.button
            className="ai-agent-send-btn"
            onClick={() => {
              if (!value.trim()) return;
              clearAutoSendTimeout();
              stopTranscription();
              onSend();
            }}
            disabled={!value.trim() || isLoading}
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
            type="button"
          >
            {isLoading ? (
              <i className="fas fa-circle-notch fa-spin" />
            ) : (
              <i className="fas fa-paper-plane" />
            )}
          </motion.button>
        </div>
      </div>
    </motion.div>
  );
};

export default ChatInput;

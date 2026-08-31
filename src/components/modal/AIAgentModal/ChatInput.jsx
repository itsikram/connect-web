import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import useComposerLiveTranscribe from "../../../hooks/useComposerLiveTranscribe";
import { isVoiceFiller } from "./agentFastPath";

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

const AUTO_SEND_DELAY_MS = 1200;
const LIVE_TALK_SEND_DELAY_MS = 700;

const ChatInput = ({
  value,
  onChange,
  onSend,
  isLoading,
  isStreaming = false,
  autoRunActions = false,
  modalInteractionVersion = 0,
  liveTalkOn = false,
  onToggleLiveTalk,
  isSpeaking = false,
  speechSupported = true,
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
  const liveTalkOnRef = useRef(liveTalkOn);
  const resumeTalkRef = useRef(false);
  const [holdListen, setHoldListen] = useState(false);

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

  useEffect(() => {
    liveTalkOnRef.current = liveTalkOn;
  }, [liveTalkOn]);

  const clearAutoSendTimeout = useCallback(() => {
    if (autoSendTimeoutRef.current) {
      clearTimeout(autoSendTimeoutRef.current);
      autoSendTimeoutRef.current = null;
    }
  }, []);

  useEffect(() => () => clearAutoSendTimeout(), [clearAutoSendTimeout]);

  useEffect(() => {
    if (!autoRunActions && !liveTalkOn) clearAutoSendTimeout();
  }, [autoRunActions, liveTalkOn, clearAutoSendTimeout]);

  useEffect(() => {
    if (isLoading || isSpeaking) clearAutoSendTimeout();
  }, [isLoading, isSpeaking, clearAutoSendTimeout]);

  useEffect(() => {
    if (!liveTalkOn) clearAutoSendTimeout();
  }, [modalInteractionVersion, liveTalkOn, clearAutoSendTimeout]);

  const scheduleAutoSend = useCallback(
    (finalText, delayMs = AUTO_SEND_DELAY_MS) => {
      const nextText = typeof finalText === "string" ? finalText.trim() : "";
      if (!nextText || isVoiceFiller(nextText)) return;
      if (!liveTalkOnRef.current && !autoRunActionsRef.current) return;

      clearAutoSendTimeout();
      const scheduledInteractionVersion = modalInteractionVersionRef.current;
      autoSendTimeoutRef.current = setTimeout(() => {
        autoSendTimeoutRef.current = null;
        if (
          !liveTalkOnRef.current &&
          modalInteractionVersionRef.current !== scheduledInteractionVersion
        ) {
          return;
        }
        if (!liveTalkOnRef.current && !autoRunActionsRef.current) return;
        transcribeBaseRef.current = "";
        setHoldListen(true);
        onSendRef.current(nextText);
      }, delayMs);
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
      if (liveTalkOnRef.current) {
        scheduleAutoSend(next, LIVE_TALK_SEND_DELAY_MS);
        return;
      }
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

  const langCode = voiceMode === "bn" ? "bn-BD" : "en-US";
  const isBusy = isLoading || isStreaming || isSpeaking || holdListen;

  useEffect(() => {
    if (isLoading || isStreaming || isSpeaking) {
      setHoldListen(true);
      return undefined;
    }
    if (!holdListen) return undefined;
    const timer = setTimeout(() => setHoldListen(false), 320);
    return () => clearTimeout(timer);
  }, [isLoading, isStreaming, isSpeaking, holdListen]);

  useEffect(() => {
    if (isLoading && isListening && !liveTalkOn) {
      stopTranscription();
    }
  }, [isLoading, isListening, liveTalkOn, stopTranscription]);

  useEffect(() => {
    if (!liveTalkOn) {
      resumeTalkRef.current = false;
      if (isListening) stopTranscription();
      return undefined;
    }

    if (isBusy) {
      resumeTalkRef.current = true;
      if (isListening) stopTranscription();
      return undefined;
    }

    if (isListening) return undefined;
    let cancelled = false;
    const timer = setTimeout(() => {
      if (cancelled || !liveTalkOnRef.current || isListening) return;
      transcribeBaseRef.current = String(valueRef.current || "").trim();
      startTranscription(langCode);
    }, resumeTalkRef.current ? 280 : 80);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [
    liveTalkOn,
    isBusy,
    isListening,
    langCode,
    startTranscription,
    stopTranscription,
  ]);

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) {
        clearAutoSendTimeout();
        if (!liveTalkOn) stopTranscription();
        if (liveTalkOn) setHoldListen(true);
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
    if (liveTalkOn) {
      onToggleLiveTalk?.();
      return;
    }
    if (isListening) {
      stopTranscription();
      return;
    }

    if (!isSpeechSupported || isBusy) return;

    clearAutoSendTimeout();
    transcribeBaseRef.current = String(valueRef.current || "").trim();
    setShowSuggestions(false);
    const started = await startTranscription(langCode);
    if (started) {
      requestAnimationFrame(() => {
        inputRef.current?.focus?.({ preventScroll: true });
      });
    }
  };

  const toggleVoiceMode = () => {
    if (isListening || isBusy) return;
    setVoiceMode((mode) => (mode === "bn" ? "en" : "bn"));
  };

  const handleTextChange = (nextValue) => {
    clearAutoSendTimeout();
    if (isListening && !liveTalkOn) {
      stopTranscription();
    }
    transcribeBaseRef.current = String(nextValue || "").trim();
    onChange(nextValue);
  };

  const talkPhase = liveTalkOn
    ? isSpeaking
      ? "speaking"
      : isLoading || isStreaming || holdListen
        ? "thinking"
        : isListening
          ? "listening"
          : "connecting"
    : isListening
      ? "dictating"
      : null;

  const talkLabel =
    talkPhase === "speaking"
      ? "Speaking…"
      : talkPhase === "thinking"
        ? "Thinking…"
        : talkPhase === "connecting"
          ? "Starting mic…"
          : talkPhase === "listening"
            ? `Listening · ${voiceMode === "bn" ? "Bangla" : "English"} — speak, I'll answer out loud`
            : talkPhase === "dictating"
              ? `Live ${voiceMode === "bn" ? "Bangla" : "English"}`
              : "";

  return (
    <motion.div
      className="ai-agent-chat-input-container"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
    >
      {showSuggestions && !value && !liveTalkOn && (
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

      {talkPhase && (
        <div
          className={`ai-agent-transcribe-bar ${liveTalkOn ? `phase-${talkPhase}` : ""}`}
          aria-live="polite"
        >
          <span className="ai-agent-transcribe-dot" aria-hidden="true" />
          <span className="ai-agent-transcribe-label">{talkLabel}</span>
        </div>
      )}

      <div className={`ai-agent-input-wrapper ${isFocused ? "focused" : ""} ${liveTalkOn ? "live-talk" : ""}`}>
        <motion.button
          className="ai-agent-voice-lang-toggle"
          onClick={toggleVoiceMode}
          disabled={isListening || isBusy}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="button"
          title={
            voiceMode === "bn"
              ? "Voice language: Bangla (tap for English)"
              : "Voice language: English (tap for Bangla)"
          }
          aria-label="Toggle voice input language"
        >
          {voiceMode === "bn" ? "বাং" : "EN"}
        </motion.button>

        <motion.button
          className={`ai-agent-voice-btn ${isListening && !liveTalkOn ? "listening" : ""}`}
          onClick={toggleVoiceInput}
          disabled={!isSpeechSupported || liveTalkOn || (isBusy && !liveTalkOn)}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="button"
          title={
            isSpeechSupported
              ? isListening && !liveTalkOn
                ? "Stop live transcription"
                : voiceMode === "bn"
                  ? "Dictate in Bangla"
                  : "Dictate in English"
              : "Voice input is not supported in this browser"
          }
          aria-label={
            isListening && !liveTalkOn
              ? "Stop live transcription"
              : "Start dictation"
          }
        >
          <i className={`fas ${isListening && !liveTalkOn ? "fa-stop" : "fa-microphone"}`} />
        </motion.button>

        <motion.button
          className={`ai-agent-talk-btn ${liveTalkOn ? "live" : ""}`}
          onClick={() => onToggleLiveTalk?.()}
          disabled={!isSpeechSupported}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="button"
          title={
            liveTalkOn
              ? "Stop live talk"
              : "Talk with the AI — you speak, it speaks back and can run actions"
          }
          aria-label={liveTalkOn ? "Stop live talk" : "Start live talk"}
        >
          <i className={`fas ${liveTalkOn ? "fa-phone-slash" : "fa-headset"}`} />
        </motion.button>

        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyPress={handleKeyPress}
          onFocus={() => {
            setIsFocused(true);
            if (!liveTalkOn) setShowSuggestions(true);
          }}
          onBlur={() => {
            setIsFocused(false);
            setTimeout(() => setShowSuggestions(false), 200);
          }}
          placeholder={
            liveTalkOn
              ? isSpeaking
                ? "AI is speaking…"
                : isLoading
                  ? "Thinking…"
                  : "Listening… ask anything or give a command"
              : isListening
                ? voiceMode === "bn"
                  ? "Listening in Bangla… speak naturally"
                  : "Listening in English… speak naturally"
                : "Talk live, or type: 'go to settings', 'how do I handle stress?'…"
          }
          className="ai-agent-input"
          rows="1"
          disabled={isLoading && !liveTalkOn}
        />

        <div className="ai-agent-input-actions">
          <motion.button
            className="ai-agent-send-btn"
            onClick={() => {
              if (!value.trim()) return;
              clearAutoSendTimeout();
              if (!liveTalkOn) stopTranscription();
              if (liveTalkOn) setHoldListen(true);
              onSend();
            }}
            disabled={!value.trim() || (isLoading && !liveTalkOn)}
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

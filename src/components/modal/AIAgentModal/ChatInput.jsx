import React, { useState, useRef, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import useComposerLiveTranscribe from "../../../hooks/useComposerLiveTranscribe";
import { mergeTranscriptChunk } from "../../../hooks/transcriptText";
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
  "Upload a post with caption Hello from Connect",
  "Set dark mode",
  "Make my posts only me",
  "Set my nickname to [name]",
  "What are my notes?",
  "Who are my friends?",
  "Search posts about music",
  "Call [friend name]",
];

const AUTO_SEND_DELAY_MS = 800;
const LIVE_TALK_SILENCE_MS = 2000;

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
  onInterruptSpeech,
  isSpeaking = false,
  speechSupported = true,
}) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [voiceMode, setVoiceMode] = useState("bn");
  const [transcribeLang, setTranscribeLang] = useState("bn-BD");

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
  const isSpeakingRef = useRef(isSpeaking);
  const onInterruptSpeechRef = useRef(onInterruptSpeech);
  const lastSentRef = useRef({ text: "", at: 0 });
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

  useEffect(() => {
    isSpeakingRef.current = isSpeaking;
  }, [isSpeaking]);

  useEffect(() => {
    onInterruptSpeechRef.current = onInterruptSpeech;
  }, [onInterruptSpeech]);

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
    if (isLoading) clearAutoSendTimeout();
  }, [isLoading, clearAutoSendTimeout]);

  useEffect(() => {
    if (!liveTalkOn) clearAutoSendTimeout();
  }, [modalInteractionVersion, liveTalkOn, clearAutoSendTimeout]);

  const looksLikeSpokenSentence = (text) => {
    const value = String(text || "").trim();
    if (!value || isVoiceFiller(value)) return false;
    const words = value.split(/\s+/).filter(Boolean);
    if (/[\u0980-\u09FF]/.test(value)) return value.length >= 4;
    if (isSpeakingRef.current) return words.length >= 2;
    return words.length >= 1;
  };

  const interruptIfUserSpoke = (text) => {
    if (!liveTalkOnRef.current || !isSpeakingRef.current) return;
    if (!looksLikeSpokenSentence(text)) return;
    onInterruptSpeechRef.current?.();
  };

  const scheduleAutoSend = useCallback(
    (finalText, delayMs = AUTO_SEND_DELAY_MS) => {
      const nextText = typeof finalText === "string" ? finalText.trim() : "";
      if (!nextText || isVoiceFiller(nextText)) return;
      if (!liveTalkOnRef.current && !autoRunActionsRef.current) return;

      clearAutoSendTimeout();
      const scheduledInteractionVersion = modalInteractionVersionRef.current;
      const normalized = nextText.toLowerCase();
      autoSendTimeoutRef.current = setTimeout(() => {
        autoSendTimeoutRef.current = null;
        if (
          !liveTalkOnRef.current &&
          modalInteractionVersionRef.current !== scheduledInteractionVersion
        ) {
          return;
        }
        if (!liveTalkOnRef.current && !autoRunActionsRef.current) return;
        if (isSpeakingRef.current) return;
        if (
          lastSentRef.current.text === normalized &&
          Date.now() - lastSentRef.current.at < 5000
        ) {
          transcribeBaseRef.current = "";
          onChangeRef.current("");
          return;
        }
        lastSentRef.current = { text: normalized, at: Date.now() };
        transcribeBaseRef.current = "";
        setHoldListen(true);
        onSendRef.current(nextText);
      }, delayMs);
    },
    [clearAutoSendTimeout],
  );

  const handleTranscriptInterim = useCallback(
    (text) => {
      if (!text) return;
      interruptIfUserSpoke(text);
      const next = mergeTranscriptChunk(transcribeBaseRef.current, text);
      onChangeRef.current(next);
      if (!liveTalkOnRef.current) return;
      if (isSpeakingRef.current) return;
      if (looksLikeSpokenSentence(next)) {
        scheduleAutoSend(next, LIVE_TALK_SILENCE_MS);
      }
    },
    [scheduleAutoSend],
  );

  const handleTranscriptFinal = useCallback(
    (text) => {
      if (!text) return;
      interruptIfUserSpoke(text);
      const next = mergeTranscriptChunk(transcribeBaseRef.current, text);
      if (
        liveTalkOnRef.current &&
        lastSentRef.current.text &&
        next.toLowerCase() === lastSentRef.current.text &&
        Date.now() - lastSentRef.current.at < 5000
      ) {
        transcribeBaseRef.current = "";
        onChangeRef.current("");
        return;
      }
      transcribeBaseRef.current = next;
      onChangeRef.current(next);
      if (!liveTalkOnRef.current) return;
      if (isSpeakingRef.current) return;
      scheduleAutoSend(next, LIVE_TALK_SILENCE_MS);
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
  const isBanglaVoice = String(transcribeLang || langCode).startsWith("bn");
  const isBusy =
    isLoading || isStreaming || holdListen || (liveTalkOn && isSpeaking);

  const startLiveTranscribe = useCallback(
    async (nextLangCode = langCode) => {
      if (liveTalkOnRef.current || isBusy) return false;
      if (!isSpeechSupported) {
        window.alert(
          "Live transcription is not available. Use Chrome or Edge for English, or check your connection for Deepgram.",
        );
        return false;
      }
      setTranscribeLang(nextLangCode);
      transcribeBaseRef.current = String(valueRef.current || "").trim();
      setShowSuggestions(false);
      let started = false;
      try {
        started = await startTranscription(nextLangCode);
      } catch (error) {
        console.error("Live transcription failed:", error);
      }
      if (started) {
        requestAnimationFrame(() => {
          inputRef.current?.focus?.({ preventScroll: true });
        });
        return true;
      }
      const insecure =
        typeof window !== "undefined" && window.isSecureContext === false;
      window.alert(
        insecure
          ? "Microphone is blocked on this page. Open http://localhost:3000 or use HTTPS, then allow the microphone."
          : "Could not start live transcription. Please allow microphone access and try again.",
      );
      return false;
    },
    [isBusy, isSpeechSupported, langCode, startTranscription],
  );

  useEffect(() => {
    if (isLoading || isStreaming) {
      setHoldListen(true);
      return undefined;
    }
    if (!holdListen) return undefined;
    const timer = setTimeout(() => setHoldListen(false), 280);
    return () => clearTimeout(timer);
  }, [isLoading, isStreaming, holdListen]);

  useEffect(() => {
    if (!holdListen) return undefined;
    const timer = setTimeout(() => setHoldListen(false), 16000);
    return () => clearTimeout(timer);
  }, [holdListen]);

  useEffect(() => {
    if (isLoading && isListening && !liveTalkOn) {
      stopTranscription();
    }
  }, [isLoading, isListening, liveTalkOn, stopTranscription]);

  useEffect(() => {
    if (isSpeaking) clearAutoSendTimeout();
  }, [isSpeaking, clearAutoSendTimeout]);

  const wasLiveTalkOnRef = useRef(liveTalkOn);
  useEffect(() => {
    const wasOn = wasLiveTalkOnRef.current;
    wasLiveTalkOnRef.current = liveTalkOn;
    if (wasOn && !liveTalkOn) {
      resumeTalkRef.current = false;
      setHoldListen(false);
      clearAutoSendTimeout();
      stopTranscription();
    }
  }, [liveTalkOn, clearAutoSendTimeout, stopTranscription]);

  useEffect(() => {
    if (!liveTalkOn) return undefined;

    if (isBusy) {
      resumeTalkRef.current = true;
      if (isListening) stopTranscription();
      return undefined;
    }

    if (isListening) return undefined;
    let cancelled = false;
    let retryTimer = 0;
    const tryStart = (delay) => {
      retryTimer = window.setTimeout(() => {
        if (cancelled || !liveTalkOnRef.current || isSpeakingRef.current) return;
        transcribeBaseRef.current = String(valueRef.current || "").trim();
        startTranscription(langCode)
          .then((ok) => {
            if (cancelled || ok || !liveTalkOnRef.current) return;
            tryStart(Math.min(4000, Math.max(700, delay * 1.6)));
          })
          .catch(() => {
            if (cancelled || !liveTalkOnRef.current) return;
            tryStart(Math.min(4000, Math.max(700, delay * 1.6)));
          });
      }, delay);
    };
    tryStart(resumeTalkRef.current ? 320 : 90);
    return () => {
      cancelled = true;
      clearTimeout(retryTimer);
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
    clearAutoSendTimeout();
    await startLiveTranscribe(langCode);
  };

  const toggleVoiceMode = () => {
    if (isListening || isBusy) return;
    setVoiceMode((mode) => {
      const next = mode === "bn" ? "en" : "bn";
      setTranscribeLang(next === "bn" ? "bn-BD" : "en-US");
      return next;
    });
  };

  const handleTextChange = (nextValue) => {
    clearAutoSendTimeout();
    transcribeBaseRef.current = String(nextValue || "").trim();
    onChange(nextValue);
  };

  const talkPhase = liveTalkOn
    ? isLoading || isStreaming || holdListen
      ? "thinking"
      : isSpeaking
        ? "speaking"
        : isListening
          ? "listening"
          : "connecting"
    : isListening
      ? "dictating"
      : null;

  const talkLabel =
    talkPhase === "speaking"
      ? "Speaking… pause 2 seconds after a sentence to send"
      : talkPhase === "thinking"
        ? "Thinking…"
        : talkPhase === "connecting"
          ? "Starting mic…"
          : talkPhase === "listening"
            ? `Listening · ${voiceMode === "bn" ? "Bangla" : "English"} — pause 2 seconds to send`
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

      {isListening && !liveTalkOn ? (
        <div className="ai-agent-transcribe-bar" aria-live="polite">
          <span className="ai-agent-transcribe-dot" aria-hidden="true" />
          <div className="ai-agent-transcribe-copy">
            <span className="ai-agent-transcribe-label">
              Listening · {isBanglaVoice ? "Bangla" : "English"}
            </span>
            <span className="ai-agent-transcribe-interim">
              Speak now — text appears in the message box
            </span>
          </div>
          <button
            type="button"
            className="ai-agent-transcribe-stop"
            onClick={stopTranscription}
            aria-label="Stop live transcription"
          >
            Done
          </button>
        </div>
      ) : talkPhase && liveTalkOn ? (
        <div
          className={`ai-agent-transcribe-bar phase-${talkPhase}`}
          aria-live="polite"
        >
          <span className="ai-agent-transcribe-dot" aria-hidden="true" />
          <span className="ai-agent-transcribe-label">{talkLabel}</span>
        </div>
      ) : null}

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
          onClick={async () => {
            if (!liveTalkOn && navigator?.mediaDevices?.getUserMedia) {
              try {
                const stream = await navigator.mediaDevices.getUserMedia({
                  audio: true,
                });
                stream.getTracks().forEach((track) => track.stop());
              } catch (error) {
                const insecure =
                  typeof window !== "undefined" &&
                  window.isSecureContext === false;
                window.alert(
                  insecure
                    ? "Microphone is blocked on this page. Open http://localhost:3000 or use HTTPS, then allow the microphone."
                    : "Could not access the microphone. Allow it in the browser prompt, then try again.",
                );
                return;
              }
            }
            onToggleLiveTalk?.();
          }}
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
                : isLoading || isStreaming || holdListen
                  ? "Thinking…"
                  : "Listening… ask anything or give a command"
              : isListening
                ? isBanglaVoice
                  ? "Listening in Bangla…"
                  : "Listening in English…"
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

import React, { useState, useRef, useEffect, useCallback } from "react";
import useComposerLiveTranscribe from "../../../hooks/useComposerLiveTranscribe";
import { mergeTranscriptChunk } from "../../../hooks/transcriptText";
import { isVoiceFiller } from "./agentFastPath";
import {
  AGENT_ECHO_TAIL_MS,
  agentQuietForMs,
  isAgentSpeaking,
  isLikelyAgentEcho,
} from "./agentEcho";

const AUTO_SEND_DELAY_MS = 800;
const LIVE_TALK_SILENCE_MS = 2000;
// The server's corrected (Gemini) final already marks the end of a sentence.
const REFINED_FINAL_SEND_MS = 300;
const VOICE_MODES = ["bn", "en", "auto"];
const VOICE_MODE_LANG = { bn: "bn-BD", en: "en-US", auto: "auto" };
const VOICE_MODE_LABEL = { bn: "Bangla", en: "English", auto: "Auto (Bangla + English)" };
const VOICE_MODE_BADGE = { bn: "বাং", en: "EN", auto: "A" };
const VOICE_MODE_STORAGE_KEY = "connect.aiAgent.voiceMode";

// Auto (Bangla + English together) by default, so nobody has to pick a
// language before speaking; the last choice is remembered.
const readVoiceMode = () => {
  try {
    const saved = window.localStorage.getItem(VOICE_MODE_STORAGE_KEY);
    if (VOICE_MODES.includes(saved)) return saved;
  } catch {
    /* storage unavailable */
  }
  return "auto";
};

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
  onStartTalk,
  onStop,
  runningLabel = "",
  bn = false,
}) => {
  const [isFocused, setIsFocused] = useState(false);
  const [voiceMode, setVoiceMode] = useState(readVoiceMode);
  const [transcribeLang, setTranscribeLang] = useState(
    () => VOICE_MODE_LANG[readVoiceMode()],
  );

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
  // True while the server double-checks the last sentence with Gemini.
  const [refining, setRefining] = useState(false);

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
    (text, meta = {}) => {
      if (!text) return;
      // Never treat the agent's own voice as the user speaking.
      if (isLikelyAgentEcho(text)) return;
      interruptIfUserSpoke(text);
      const next = mergeTranscriptChunk(transcribeBaseRef.current, text);
      onChangeRef.current(next);
      if (!liveTalkOnRef.current) return;
      if (isSpeakingRef.current) return;
      // A corrected final is coming; never send the rough draft.
      if (meta.awaitingFinal) return;
      if (looksLikeSpokenSentence(next)) {
        scheduleAutoSend(next, LIVE_TALK_SILENCE_MS);
      }
    },
    [scheduleAutoSend],
  );

  const handleTranscriptFinal = useCallback(
    (text, meta = {}) => {
      setRefining(false);
      if (!text) return;
      if (isLikelyAgentEcho(text)) return;
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
      scheduleAutoSend(
        next,
        meta.refined ? REFINED_FINAL_SEND_MS : LIVE_TALK_SILENCE_MS,
      );
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
    onRefining: (active) => setRefining(Boolean(active)),
  });

  const langCode = VOICE_MODE_LANG[voiceMode] || "bn-BD";
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
    const tryStart = (requestedDelay) => {
      // Reopen the mic only after the speaker has been quiet for a moment,
      // so the tail of the agent's own reply is not transcribed.
      const delay = Math.max(
        requestedDelay,
        AGENT_ECHO_TAIL_MS - agentQuietForMs(),
      );
      retryTimer = window.setTimeout(() => {
        if (cancelled || !liveTalkOnRef.current || isSpeakingRef.current) return;
        if (isAgentSpeaking() || agentQuietForMs() < AGENT_ECHO_TAIL_MS) {
          tryStart(AGENT_ECHO_TAIL_MS);
          return;
        }
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
    tryStart(resumeTalkRef.current ? 320 : 0);
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

  const startLiveTalk = async () => {
    if (!liveTalkOn && navigator?.mediaDevices?.getUserMedia) {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          audio: true,
        });
        stream.getTracks().forEach((track) => track.stop());
      } catch (error) {
        const insecure =
          typeof window !== "undefined" && window.isSecureContext === false;
        window.alert(
          insecure
            ? "Microphone is blocked on this page. Open http://localhost:3000 or use HTTPS, then allow the microphone."
            : "Could not access the microphone. Allow it in the browser prompt, then try again.",
        );
        return;
      }
    }
    onToggleLiveTalk?.();
  };

  const handleTextChange = (nextValue) => {
    clearAutoSendTimeout();
    transcribeBaseRef.current = String(nextValue || "").trim();
    onChange(nextValue);
  };

  const [languageMenuOpen, setLanguageMenuOpen] = useState(false);
  const longPressTimerRef = useRef(null);

  const chooseVoiceMode = (next) => {
    setLanguageMenuOpen(false);
    if (!VOICE_MODES.includes(next)) return;
    setVoiceMode(next);
    setTranscribeLang(VOICE_MODE_LANG[next]);
    try {
      window.localStorage.setItem(VOICE_MODE_STORAGE_KEY, next);
    } catch {
      /* storage unavailable */
    }
  };

  // Tap: start / stop hands-free talk (like the app's mic). Long-press or
  // right-click: pick the voice language.
  const handleMicClick = () => {
    if (languageMenuOpen) {
      setLanguageMenuOpen(false);
      return;
    }
    clearAutoSendTimeout();
    if (liveTalkOn) {
      onToggleLiveTalk?.();
      return;
    }
    if (isListening) stopTranscription();
    if (onStartTalk) onStartTalk();
    else void startLiveTalk();
  };
  const startLongPress = () => {
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      setLanguageMenuOpen(true);
    }, 550);
  };
  const cancelLongPress = () => {
    clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = null;
  };
  useEffect(() => () => clearTimeout(longPressTimerRef.current), []);

  const agentBusy = Boolean(
    isLoading || isStreaming || isSpeaking || runningLabel,
  );
  const voiceName = VOICE_MODE_LABEL[voiceMode] || "Bangla";
  const voicePhase = runningLabel
    ? {
        key: "doing",
        label: bn ? "কাজ করছি…" : "Doing it…",
        hint: runningLabel,
        icon: "fa-bolt",
      }
    : refining
    ? {
        key: "understanding",
        label: bn ? "বুঝছি…" : "Understanding…",
        hint: bn ? "আপনার কথা ঠিকভাবে লিখছি" : "Getting your words right",
        icon: "fa-wave-square",
      }
    : isLoading || isStreaming || holdListen
    ? {
        key: "thinking",
        label: bn ? "ভাবছি…" : "Thinking…",
        hint: bn ? "এক মুহূর্ত" : "One moment",
        icon: "fa-magic",
      }
    : isSpeaking
    ? {
        key: "speaking",
        label: bn ? "বলছি…" : "Speaking…",
        hint: bn ? "থামাতে Stop চাপুন" : "Tap Stop to interrupt",
        icon: "fa-volume-up",
      }
    : isListening
    ? {
        key: "listening",
        label: bn ? "শুনছি… বলুন" : "Listening… go ahead",
        hint: bn ? 'যেমন: "রহিমকে ভিডিও কল দাও"' : 'For example: "Video call Rahim"',
        icon: "fa-microphone",
      }
    : {
        key: "paused",
        label: bn ? "মাইক বন্ধ" : "Mic paused",
        hint: bn ? "আবার বলতে মাইক চাপুন" : "Tap the mic to talk again",
        icon: "fa-microphone-slash",
      };
  const showVoicePanel = liveTalkOn || isListening || refining;
  const transcript = String(value || "").trim();

  return (
    <div className="xa-composer-area">
      {showVoicePanel ? (
        <div className={`xa-voice-panel phase-${voicePhase.key}`} aria-live="polite">
          <button
            type="button"
            className="xa-pulse"
            onClick={handleMicClick}
            aria-label={voicePhase.label}
          >
            <span className="xa-pulse-ring" />
            <span className="xa-pulse-core">
              <i className={`fas ${voicePhase.icon}`} />
            </span>
          </button>
          <div className="xa-voice-text">
            <span className="xa-voice-phase">{voicePhase.label}</span>
            <span className={`xa-voice-transcript${transcript ? "" : " is-hint"}`}>
              {transcript || voicePhase.hint}
            </span>
          </div>
          {agentBusy ? (
            <button
              type="button"
              className="xa-voice-stop"
              onClick={onStop}
              aria-label={bn ? "থামান" : "Stop"}
            >
              <i className="fas fa-stop" />
              <span>{bn ? "থামান" : "Stop"}</span>
            </button>
          ) : null}
        </div>
      ) : null}

      {languageMenuOpen ? (
        <div className="xa-language-bar" role="menu">
          <span className="xa-language-label">Voice</span>
          {VOICE_MODES.map((mode) => (
            <button
              key={mode}
              type="button"
              role="menuitemradio"
              aria-checked={voiceMode === mode}
              className={`xa-language-option${voiceMode === mode ? " is-on" : ""}`}
              onClick={() => chooseVoiceMode(mode)}
            >
              {mode === "bn" ? "বাংলা" : mode === "en" ? "English" : "Auto"}
            </button>
          ))}
        </div>
      ) : null}

      <div className={`xa-composer${isFocused ? " is-focused" : ""}`}>
        <button
          type="button"
          className={`xa-mic${isListening || liveTalkOn ? " is-live" : ""}`}
          onClick={handleMicClick}
          onPointerDown={startLongPress}
          onPointerUp={cancelLongPress}
          onPointerLeave={cancelLongPress}
          onContextMenu={(event) => {
            event.preventDefault();
            cancelLongPress();
            setLanguageMenuOpen((open) => !open);
          }}
          disabled={!isSpeechSupported}
          aria-label={
            liveTalkOn
              ? "Stop hands-free voice commands"
              : "Start hands-free voice commands"
          }
          title={`Talk hands-free (${voiceName}). Long-press for language.`}
        >
          <i className={`fas ${isListening || liveTalkOn ? "fa-microphone" : "fa-microphone-alt"}`} />
        </button>

        <textarea
          ref={inputRef}
          value={value}
          onChange={(e) => handleTextChange(e.target.value)}
          onKeyPress={handleKeyPress}
          onFocus={() => setIsFocused(true)}
          onBlur={() => setIsFocused(false)}
          placeholder={
            bn
              ? "কিছু জিজ্ঞেস করুন বা একটি কাজ বলুন…"
              : "Ask anything or tell me what to do…"
          }
          className="xa-input"
          rows="1"
          disabled={isLoading && !liveTalkOn}
        />

        {agentBusy ? (
          <button
            type="button"
            className="xa-send is-stop"
            onClick={onStop}
            aria-label="Stop"
            title="Stop"
          >
            <i className="fas fa-stop" />
          </button>
        ) : (
          <button
            type="button"
            className="xa-send"
            onClick={() => {
              if (!value.trim()) return;
              clearAutoSendTimeout();
              if (!liveTalkOn) stopTranscription();
              if (liveTalkOn) setHoldListen(true);
              onSend();
            }}
            disabled={!value.trim()}
            aria-label="Send"
          >
            <i className="fas fa-arrow-up" />
          </button>
        )}
      </div>
    </div>
  );
};

export default ChatInput;

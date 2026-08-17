import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { getSocketUrl } from "../../../utils/offlineUtils";

const SUGGESTIONS = [
  // Navigation
  "Go to settings",
  "Open my profile",
  "Go to messages",
  "Go to friends page",
  "Open watch page",
  "Go to notes",
  "Go to tasks",
  "Open calendar",
  // Social
  "Call [friend name]",
  "Video call [friend name]",
  "Message [friend name]",
  "Bump [friend name]",
  // Profile navigation
  "Go to [friend]'s profile",
  "View [friend]'s friends",
  "See [friend]'s photos",
  "Where is [friend name]?",
  // Settings shortcuts
  "Open account settings",
  "Go to privacy settings",
  "Open notification settings",
  // Games
  "Play Ludo",
  "Invite [friend name] to Ludo",
  "Play Chess",
  // Videos
  "Play [video name]",
  "Play action",
  "Find videos about music",
  "Search for comedy video",
  // Other
  "Block [name]",
  "Unblock [name]",
  "What can you help with?",
];

const AUDIO_TIMESLICE_MS = 800;

const appendTranscript = (baseText, transcript) => {
  const nextTranscript = transcript.trim();

  if (!nextTranscript) return baseText;
  if (!baseText) return nextTranscript;

  return /\s$/.test(baseText)
    ? `${baseText}${nextTranscript}`
    : `${baseText} ${nextTranscript}`;
};

const pickSupportedMimeType = () => {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];

  for (let i = 0; i < candidates.length; i += 1) {
    const mimeType = candidates[i];
    if (
      typeof window !== "undefined" &&
      window.MediaRecorder &&
      window.MediaRecorder.isTypeSupported &&
      window.MediaRecorder.isTypeSupported(mimeType)
    ) {
      return mimeType;
    }
  }

  return "";
};

const speechLog = (...args) => {
  // eslint-disable-next-line no-console
  console.log("[speech-client]", ...args);
};

const getSpeechWebSocketUrl = () => {
  const base = getSocketUrl();
  const url = new URL(base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws/speech";

  try {
    const rawUser = localStorage.getItem("user") || "{}";
    const user = JSON.parse(rawUser);
    const token = user?.accessToken;
    if (token) {
      url.searchParams.set("token", token);
    }
  } catch {
    // noop
  }

  return url.toString();
};

const ChatInput = ({ value, onChange, onSend, isLoading }) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  // "bn" -> Node.js + local Whisper pipeline (streamed over WebSocket)
  // "en" -> browser's native SpeechRecognition (fast, free, no server round-trip)
  const [voiceMode, setVoiceMode] = useState("bn");
  const [isBanglaSupported, setIsBanglaSupported] = useState(false);
  const [isEnglishSupported, setIsEnglishSupported] = useState(false);

  const inputRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const isListeningRef = useRef(false);
  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const listeningBaseTextRef = useRef("");
  const finalTranscriptRef = useRef("");
  const stopTimeoutRef = useRef(null);
  const recognitionRef = useRef(null);
  const activeStopRef = useRef(() => {});

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  // ── Bangla support check (WebSocket + MediaRecorder + mic pipeline) ──────
  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      !!window.WebSocket &&
      !!window.MediaRecorder &&
      !!navigator?.mediaDevices?.getUserMedia;

    setIsBanglaSupported(supported);
  }, []);

  // ── English support + setup: browser's native SpeechRecognition ─────────
  useEffect(() => {
    const SpeechRecognition =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      setIsEnglishSupported(false);
      return;
    }

    setIsEnglishSupported(true);

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interimTranscript = "";

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const transcript = event.results[i][0]?.transcript || "";

        if (event.results[i].isFinal) {
          finalTranscriptRef.current = appendTranscript(
            finalTranscriptRef.current,
            transcript,
          );
        } else {
          interimTranscript += transcript;
        }
      }

      const withFinal = appendTranscript(
        listeningBaseTextRef.current,
        finalTranscriptRef.current,
      );

      onChangeRef.current(appendTranscript(withFinal, interimTranscript));
    };

    recognition.onerror = (err) => {
      speechLog("Browser SpeechRecognition error", err?.error || err);
      setIsListening(false);
    };

    recognition.onend = () => {
      speechLog("Browser SpeechRecognition ended");
      const withFinal = appendTranscript(
        listeningBaseTextRef.current,
        finalTranscriptRef.current,
      );
      onChangeRef.current(withFinal);
      setIsListening(false);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onerror = null;
      recognition.onend = null;
      try {
        recognition.stop();
      } catch {
        // noop
      }
      recognitionRef.current = null;
    };
  }, []);

  const clearStopTimeout = () => {
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
  };

  const closeWebSocket = () => {
    if (!wsRef.current) return;
    try {
      wsRef.current.close();
    } catch {
      // noop
    }
    wsRef.current = null;
  };

  const stopMediaRecorder = () => {
    if (!mediaRecorderRef.current) return;

    try {
      if (mediaRecorderRef.current.state !== "inactive") {
        mediaRecorderRef.current.stop();
      }
    } catch {
      // noop
    }

    mediaRecorderRef.current = null;
  };

  const stopMediaStream = () => {
    if (!mediaStreamRef.current) return;

    mediaStreamRef.current.getTracks().forEach((track) => {
      try {
        track.stop();
      } catch {
        // noop
      }
    });

    mediaStreamRef.current = null;
  };

  const stopListeningLocal = () => {
    stopMediaRecorder();
    stopMediaStream();
    setIsListening(false);
  };

  const finalizeWithText = (text = "") => {
    const withFinal = appendTranscript(listeningBaseTextRef.current, text);
    onChangeRef.current(withFinal);
  };

  const handleSocketMessage = (event) => {
    let payload;

    try {
      payload = JSON.parse(event.data);
    } catch (err) {
      speechLog("Failed to parse WS message", event.data, err);
      return;
    }

    speechLog("WS message received", payload);

    if (payload.type === "ready") {
      speechLog("Server confirmed stream ready");
      return;
    }

    if (payload.type === "partial") {
      const partial = (payload.text || "").trim();
      speechLog("Partial transcript:", partial);
      const withPartial = appendTranscript(
        listeningBaseTextRef.current,
        partial,
      );
      onChangeRef.current(withPartial);
      return;
    }

    if (payload.type === "final") {
      const finalText = (payload.text || "").trim();
      speechLog("Final transcript:", finalText);
      finalTranscriptRef.current = finalText;
      finalizeWithText(finalText);
      clearStopTimeout();
      closeWebSocket();
      setIsListening(false);
      return;
    }

    if (payload.type === "error") {
      const message = String(payload.message || "");
      speechLog("Server error message:", message);
      const fatal =
        /Unauthorized|Missing auth token|Invalid or expired token|Whisper worker is not running|Failed to import/i.test(
          message,
        );

      if (fatal) {
        speechLog("Fatal error, stopping voice session");
        clearStopTimeout();
        closeWebSocket();
        stopListeningLocal();
        const fallbackFinal = finalTranscriptRef.current || value;
        finalizeWithText(fallbackFinal);
      } else {
        speechLog("Non-fatal error, continuing session");
      }

      return;
    }
  };

  // ── Bangla voice input: mic -> WebSocket -> Node.js -> local Whisper ────
  const startBanglaVoiceInput = async () => {
    if (!isBanglaSupported || isLoading || isListeningRef.current) {
      speechLog("startBanglaVoiceInput blocked", {
        isBanglaSupported,
        isLoading,
        isListening: isListeningRef.current,
      });
      return;
    }

    listeningBaseTextRef.current = value;
    finalTranscriptRef.current = "";
    setShowSuggestions(false);

    try {
      speechLog("Requesting microphone permission...");
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: true,
      });
      mediaStreamRef.current = stream;
      speechLog("Microphone permission granted");

      const socketUrl = getSpeechWebSocketUrl();
      speechLog("Connecting to speech WebSocket:", socketUrl);
      const ws = new WebSocket(socketUrl);
      wsRef.current = ws;

      await new Promise((resolve, reject) => {
        const timer = setTimeout(
          () => reject(new Error("Speech socket timeout")),
          8000,
        );

        const handleOpen = () => {
          clearTimeout(timer);
          ws.removeEventListener("open", handleOpen);
          ws.removeEventListener("error", handleBootError);
          speechLog("WebSocket connected");
          resolve();
        };

        const handleBootError = (err) => {
          clearTimeout(timer);
          ws.removeEventListener("open", handleOpen);
          ws.removeEventListener("error", handleBootError);
          speechLog("WebSocket connect error", err);
          reject(new Error("Unable to connect to speech server"));
        };

        ws.addEventListener("open", handleOpen);
        ws.addEventListener("error", handleBootError);
      });

      ws.onmessage = handleSocketMessage;
      ws.onerror = (err) => {
        speechLog("WebSocket error during session", err);
        closeWebSocket();
        stopListeningLocal();
      };
      ws.onclose = (event) => {
        speechLog("WebSocket closed", event.code, event.reason);
        wsRef.current = null;
        if (isListeningRef.current) {
          stopListeningLocal();
        }
      };

      const mimeType = pickSupportedMimeType();
      speechLog(
        "Using MediaRecorder mimeType:",
        mimeType || "(browser default)",
      );
      const recorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream);

      let chunkIndex = 0;

      recorder.addEventListener("dataavailable", async (ev) => {
        if (!ev.data || ev.data.size === 0 || !wsRef.current) {
          speechLog("dataavailable skipped", {
            size: ev.data?.size,
            hasSocket: !!wsRef.current,
          });
          return;
        }

        chunkIndex += 1;

        try {
          const audioBuffer = await ev.data.arrayBuffer();
          if (wsRef.current.readyState === WebSocket.OPEN) {
            wsRef.current.send(audioBuffer);
            speechLog(
              `Sent audio chunk #${chunkIndex} bytes=${audioBuffer.byteLength}`,
            );
          } else {
            speechLog(
              `Skipped sending chunk #${chunkIndex}, socket not open (state=${wsRef.current.readyState})`,
            );
          }
        } catch (err) {
          speechLog("Failed to send audio chunk", err);
        }
      });

      recorder.addEventListener("error", (err) => {
        speechLog("MediaRecorder error", err);
        stopListeningLocal();
        closeWebSocket();
      });

      mediaRecorderRef.current = recorder;

      const startPayload = {
        type: "start",
        language: "bn",
        mimeType: mimeType || "audio/webm",
        chunkDurationMs: AUDIO_TIMESLICE_MS,
      };
      speechLog("Sending start payload", startPayload);
      ws.send(JSON.stringify(startPayload));

      recorder.start(AUDIO_TIMESLICE_MS);
      speechLog(
        "MediaRecorder started with timeslice(ms)=",
        AUDIO_TIMESLICE_MS,
      );
      setIsListening(true);
      inputRef.current?.focus();
    } catch (err) {
      speechLog("startBanglaVoiceInput failed", err);
      stopListeningLocal();
      closeWebSocket();
    }
  };

  const stopBanglaVoiceInput = async () => {
    if (!isListeningRef.current) return;

    speechLog("stopBanglaVoiceInput called");

    stopMediaRecorder();
    stopMediaStream();

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        speechLog("Sending stop payload");
        wsRef.current.send(JSON.stringify({ type: "stop" }));
      } catch (err) {
        speechLog("Failed to send stop payload", err);
      }

      clearStopTimeout();
      stopTimeoutRef.current = setTimeout(() => {
        speechLog("Stop timeout reached, finalizing locally");
        finalizeWithText(finalTranscriptRef.current || value);
        closeWebSocket();
        setIsListening(false);
      }, 2500);
    } else {
      speechLog("No open socket on stop; finalizing immediately");
      setIsListening(false);
    }
  };

  // ── English voice input: browser's native SpeechRecognition ─────────────
  const startEnglishRecognition = () => {
    if (
      !isEnglishSupported ||
      isLoading ||
      isListeningRef.current ||
      !recognitionRef.current
    ) {
      speechLog("startEnglishRecognition blocked", {
        isEnglishSupported,
        isLoading,
        isListening: isListeningRef.current,
      });
      return;
    }

    listeningBaseTextRef.current = value;
    finalTranscriptRef.current = "";
    setShowSuggestions(false);

    try {
      recognitionRef.current.start();
      speechLog("Browser SpeechRecognition started (en-US)");
      setIsListening(true);
      inputRef.current?.focus();
    } catch (err) {
      speechLog("startEnglishRecognition failed", err);
      setIsListening(false);
    }
  };

  const stopEnglishRecognition = () => {
    if (!isListeningRef.current) return;

    speechLog("stopEnglishRecognition called");

    try {
      recognitionRef.current?.stop();
    } catch (err) {
      speechLog("Failed to stop browser SpeechRecognition", err);
      setIsListening(false);
    }
  };

  activeStopRef.current =
    voiceMode === "en" ? stopEnglishRecognition : stopBanglaVoiceInput;

  useEffect(() => {
    if (isLoading && isListening) {
      activeStopRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isListening]);

  useEffect(() => {
    return () => {
      clearStopTimeout();
      stopMediaRecorder();
      stopMediaStream();
      closeWebSocket();
      try {
        recognitionRef.current?.stop();
      } catch {
        // noop
      }
    };
  }, []);

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (value.trim()) onSend();
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
    onChange(s.replace(/\[.*?\]/g, ""));
    setShowSuggestions(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const toggleVoiceInput = () => {
    if (isListening) {
      activeStopRef.current();
    } else if (voiceMode === "en") {
      startEnglishRecognition();
    } else {
      startBanglaVoiceInput();
    }
  };

  const toggleVoiceMode = () => {
    if (isListening || isLoading) return;
    setVoiceMode((mode) => (mode === "bn" ? "en" : "bn"));
  };

  const handleTextChange = (nextValue) => {
    if (isListening) {
      activeStopRef.current();
    }
    onChange(nextValue);
  };

  const isSpeechSupported =
    voiceMode === "en" ? isEnglishSupported : isBanglaSupported;

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
                ? "Stop voice input"
                : voiceMode === "bn"
                  ? "Start Bangla voice input"
                  : "Start English voice input"
              : "Voice input is not supported in this browser"
          }
          aria-label={
            isListening
              ? "Stop voice recognition"
              : voiceMode === "bn"
                ? "Start Bangla voice recognition"
                : "Start English voice recognition"
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
                ? "Listening in Bangla... speak naturally"
                : "Listening in English... speak naturally"
              : "Try: 'go to settings', 'call John', 'open my profile'…"
          }
          className="ai-agent-input"
          rows="1"
          disabled={isLoading}
        />

        <div className="ai-agent-input-actions">
          <motion.button
            className="ai-agent-send-btn"
            onClick={() => value.trim() && onSend()}
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

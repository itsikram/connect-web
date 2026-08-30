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
  "Create a post with a funny caption",
  "What are my notes?",
  "Who are my friends?",
  "Search posts about music",
  "Call [friend name]",
];

const AUDIO_TIMESLICE_MS = 80;
const AUTO_SEND_DELAY_MS = 3000;
const TARGET_SAMPLE_RATE = 16000;
const PCM_PROCESSOR_BUFFER_SIZE = 2048;
const BANGLA_RECOGNITION_LANGS = ["bn-BD", "bn-IN", "bn"];

const countBanglaChars = (text = "") =>
  (String(text).match(/[\u0980-\u09FF]/g) || []).length;

const scoreBanglaTranscript = (text = "", confidence = 0.5) => {
  const normalized = String(text || "")
    .replace(/\s+/g, " ")
    .trim();
  if (!normalized) return -1;

  const compact = normalized.replace(/\s+/g, "");
  const bangla = countBanglaChars(normalized);
  const ratio = bangla / Math.max(1, compact.length);
  const conf = Number(confidence) || 0;

  if (bangla === 0 && compact.length >= 6) return conf * 0.12;

  return (
    bangla * 4 +
    ratio * 16 +
    conf * 8 +
    Math.min(compact.length, 48) * 0.08
  );
};

const pickBestSpeechAlternative = (result, preferBangla = false) => {
  if (!result || !result.length) {
    return { transcript: "", confidence: 0 };
  }

  let best = result[0]?.transcript || "";
  let bestConfidence = Number(result[0]?.confidence || 0);
  if (!preferBangla) {
    return { transcript: best, confidence: bestConfidence };
  }

  let bestScore = scoreBanglaTranscript(best, bestConfidence);
  for (let i = 1; i < result.length; i += 1) {
    const transcript = result[i]?.transcript || "";
    const confidence = Number(result[i]?.confidence || 0);
    const score = scoreBanglaTranscript(transcript, confidence);
    if (score > bestScore) {
      best = transcript;
      bestConfidence = confidence;
      bestScore = score;
    }
  }

  return { transcript: best, confidence: bestConfidence };
};

const downsampleTo16k = (float32, inputSampleRate) => {
  if (!float32?.length) return float32;
  if (Math.abs(Number(inputSampleRate) - TARGET_SAMPLE_RATE) < 1) {
    return float32;
  }

  const ratio = Number(inputSampleRate) / TARGET_SAMPLE_RATE;
  if (!Number.isFinite(ratio) || ratio <= 0) return float32;

  const newLength = Math.max(1, Math.floor(float32.length / ratio));
  const result = new Float32Array(newLength);
  for (let i = 0; i < newLength; i += 1) {
    const start = Math.floor(i * ratio);
    const end = Math.min(float32.length, Math.floor((i + 1) * ratio));
    let sum = 0;
    const count = Math.max(1, end - start);
    for (let j = start; j < end; j += 1) {
      sum += float32[j];
    }
    result[i] = sum / count;
  }
  return result;
};

const floatTo16BitPcm = (float32) => {
  const pcm = new Int16Array(float32.length);
  for (let i = 0; i < float32.length; i += 1) {
    const sample = Math.max(-1, Math.min(1, float32[i] || 0));
    pcm[i] = sample < 0 ? sample * 0x8000 : sample * 0x7fff;
  }
  return pcm.buffer;
};

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

const getSpeechWebSocketUrls = () => {
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

  const urls = [url.toString()];
  if (url.hostname === "localhost") {
    const ipv4Url = new URL(url.toString());
    ipv4Url.hostname = "127.0.0.1";
    urls.push(ipv4Url.toString());
  }

  return urls;
};

const openSpeechWebSocket = (socketUrl, onMessage) =>
  new Promise((resolve, reject) => {
    const ws = new WebSocket(socketUrl);
    ws.onmessage = onMessage;

    let settled = false;
    const timer = setTimeout(() => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        ws.close();
      } catch {
        // noop
      }
      reject(new Error("Speech socket connection timed out"));
    }, 5000);

    const cleanup = () => {
      clearTimeout(timer);
      ws.removeEventListener("open", handleOpen);
      ws.removeEventListener("error", handleError);
      ws.removeEventListener("close", handleClose);
    };

    const handleOpen = () => {
      if (settled) return;
      settled = true;
      cleanup();
      resolve(ws);
    };

    const handleError = () => {
      if (settled) return;
      settled = true;
      cleanup();
      try {
        ws.close();
      } catch {
        // noop
      }
      reject(new Error("Unable to connect to speech server"));
    };

    const handleClose = (event) => {
      if (settled) return;
      settled = true;
      cleanup();
      reject(
        new Error(
          `Speech socket closed during connection (${event.code || "unknown"})`,
        ),
      );
    };

    ws.addEventListener("open", handleOpen);
    ws.addEventListener("error", handleError);
    ws.addEventListener("close", handleClose);
  });

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
  const [isListening, setIsListening] = useState(false);
  // "bn" -> Node.js + Deepgram live transcription (streamed over WebSocket)
  // "en" -> browser SpeechRecognition when available, otherwise Deepgram fallback
  const [voiceMode, setVoiceMode] = useState("bn");
  const [isBanglaSupported, setIsBanglaSupported] = useState(false);
  const [isEnglishSupported, setIsEnglishSupported] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [voiceStatusMessage, setVoiceStatusMessage] = useState("");

  const inputRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const onSendRef = useRef(onSend);
  const isListeningRef = useRef(false);
  const wsRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const listeningBaseTextRef = useRef("");
  const finalTranscriptRef = useRef("");
  const stopTimeoutRef = useRef(null);
  const recognitionRef = useRef(null);
  const activeStopRef = useRef(() => {});
  const modelLoadingRef = useRef(false);
  const autoSendTimeoutRef = useRef(null);
  const autoRunActionsRef = useRef(autoRunActions);
  const modalInteractionVersionRef = useRef(modalInteractionVersion);
  const maybeScheduleAutoSendRef = useRef(() => {});
  const hybridBanglaRef = useRef(false);
  const googleFinalRef = useRef("");
  const googlePartialRef = useRef("");
  const googleConfidenceRef = useRef(0);
  const deepgramTextRef = useRef("");
  const deepgramConfidenceRef = useRef(0);
  const isFinalizingRef = useRef(false);
  const audioContextRef = useRef(null);
  const audioProcessorRef = useRef(null);
  const audioSourceRef = useRef(null);
  const audioGainRef = useRef(null);
  const publishHybridTranscriptRef = useRef(() => "");
  const banglaRecognitionLangIndexRef = useRef(0);
  const deepgramSessionRef = useRef(false);

  useEffect(() => {
    onChangeRef.current = onChange;
    onSendRef.current = onSend;
  }, [onChange, onSend]);

  useEffect(() => {
    autoRunActionsRef.current = autoRunActions;
  }, [autoRunActions]);

  useEffect(() => {
    modalInteractionVersionRef.current = modalInteractionVersion;
  }, [modalInteractionVersion]);

  useEffect(() => {
    isListeningRef.current = isListening;
  }, [isListening]);

  const clearAutoSendTimeout = () => {
    if (autoSendTimeoutRef.current) {
      clearTimeout(autoSendTimeoutRef.current);
      autoSendTimeoutRef.current = null;
    }
  };

  // Clear auto-send timeout on unmount
  useEffect(() => {
    return () => {
      clearAutoSendTimeout();
    };
  }, []);

  useEffect(() => {
    if (!autoRunActions) {
      clearAutoSendTimeout();
    }
  }, [autoRunActions]);

  useEffect(() => {
    if (isLoading) {
      clearAutoSendTimeout();
    }
  }, [isLoading]);

  useEffect(() => {
    clearAutoSendTimeout();
  }, [modalInteractionVersion]);

  // Helper to trigger auto-send if enabled
  const scheduleAutoSend = (finalText) => {
    const nextText = typeof finalText === "string" ? finalText.trim() : "";
    if (!autoRunActionsRef.current || !nextText) return;

    clearAutoSendTimeout();

    const scheduledInteractionVersion = modalInteractionVersionRef.current;

    speechLog(
      `[auto-run] Scheduled auto-send in ${AUTO_SEND_DELAY_MS}ms, text: "${nextText}"`,
    );
    autoSendTimeoutRef.current = setTimeout(() => {
      autoSendTimeoutRef.current = null;

      if (modalInteractionVersionRef.current !== scheduledInteractionVersion) {
        speechLog("[auto-run] Cancelled because the modal was touched/clicked");
        return;
      }

      if (!autoRunActionsRef.current) {
        speechLog("[auto-run] Cancelled because auto-run was disabled");
        return;
      }

      speechLog(
        `[auto-run] Sending after ${AUTO_SEND_DELAY_MS}ms delay: "${nextText}"`,
      );
      onSendRef.current(nextText);
    }, AUTO_SEND_DELAY_MS);
  };

  // ── Bangla support check (WebSocket + MediaRecorder + mic pipeline) ──────
  useEffect(() => {
    const supported =
      typeof window !== "undefined" &&
      !!window.WebSocket &&
      !!navigator?.mediaDevices?.getUserMedia &&
      (!!window.AudioContext ||
        !!window.webkitAudioContext ||
        !!window.MediaRecorder);

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
    recognition.maxAlternatives = 5;
    recognition.lang = "en-US";

    recognition.onresult = (event) => {
      let interimTranscript = "";
      const preferBangla = String(recognition.lang || "")
        .toLowerCase()
        .startsWith("bn");
      let latestConfidence = 0;

      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const picked = pickBestSpeechAlternative(
          event.results[i],
          preferBangla,
        );
        const transcript = picked.transcript;
        latestConfidence = Math.max(latestConfidence, picked.confidence || 0);

        if (event.results[i].isFinal) {
          if (hybridBanglaRef.current) {
            googleFinalRef.current = appendTranscript(
              googleFinalRef.current,
              transcript,
            );
            googlePartialRef.current = "";
            googleConfidenceRef.current = picked.confidence || latestConfidence;
          } else {
            finalTranscriptRef.current = appendTranscript(
              finalTranscriptRef.current,
              transcript,
            );
          }
        } else if (hybridBanglaRef.current) {
          interimTranscript += transcript;
        } else {
          interimTranscript += transcript;
        }
      }

      if (hybridBanglaRef.current) {
        googlePartialRef.current = interimTranscript.trim();
        if (latestConfidence) {
          googleConfidenceRef.current = latestConfidence;
        }
        publishHybridTranscriptRef.current();
        return;
      }

      const withFinal = appendTranscript(
        listeningBaseTextRef.current,
        finalTranscriptRef.current,
      );

      onChangeRef.current(appendTranscript(withFinal, interimTranscript));
    };

    recognition.onspeechend = () => {
      if (!autoRunActionsRef.current) return;

      speechLog("Browser SpeechRecognition detected end of speech");
      try {
        if (hybridBanglaRef.current) {
          activeStopRef.current();
        } else {
          recognition.stop();
        }
      } catch (err) {
        speechLog("Failed to stop recognition after speech ended", err);
      }
    };

    recognition.onerror = (err) => {
      const errorCode = String(err?.error || err || "");
      speechLog("Browser SpeechRecognition error", errorCode);

      if (hybridBanglaRef.current) {
        const canRetryLang =
          errorCode === "language-not-supported" &&
          banglaRecognitionLangIndexRef.current <
            BANGLA_RECOGNITION_LANGS.length - 1;

        if (canRetryLang) {
          banglaRecognitionLangIndexRef.current += 1;
          recognition.lang =
            BANGLA_RECOGNITION_LANGS[banglaRecognitionLangIndexRef.current];
          speechLog("Retrying Bangla SpeechRecognition with", recognition.lang);
          return;
        }

        speechLog(
          "Browser Bangla STT unavailable; continuing with Deepgram PCM",
        );
        hybridBanglaRef.current = false;
        return;
      }

      setIsListening(false);
    };

    recognition.onend = () => {
      speechLog("Browser SpeechRecognition ended");

      if (
        hybridBanglaRef.current &&
        isListeningRef.current &&
        !isFinalizingRef.current
      ) {
        try {
          recognition.start();
          speechLog("Restarted Bangla SpeechRecognition for continuous listen");
        } catch (err) {
          speechLog("Could not restart Bangla SpeechRecognition", err);
        }
        return;
      }

      if (hybridBanglaRef.current || deepgramSessionRef.current) return;

      const withFinal = appendTranscript(
        listeningBaseTextRef.current,
        finalTranscriptRef.current,
      );
      onChangeRef.current(withFinal);
      setIsListening(false);
      maybeScheduleAutoSendRef.current(withFinal);
    };

    recognitionRef.current = recognition;

    return () => {
      recognition.onresult = null;
      recognition.onspeechend = null;
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

  const stopPcmCapture = () => {
    try {
      audioProcessorRef.current?.disconnect();
    } catch {
      // noop
    }
    try {
      audioSourceRef.current?.disconnect();
    } catch {
      // noop
    }
    try {
      audioGainRef.current?.disconnect();
    } catch {
      // noop
    }

    audioProcessorRef.current = null;
    audioSourceRef.current = null;
    audioGainRef.current = null;

    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") {
      audioContext.close().catch(() => {});
    }
  };

  const stopBrowserRecognition = () => {
    try {
      recognitionRef.current?.stop();
    } catch {
      // noop
    }
  };

  const stopListeningLocal = () => {
    stopPcmCapture();
    stopMediaRecorder();
    stopMediaStream();
    if (hybridBanglaRef.current) {
      stopBrowserRecognition();
    }
    hybridBanglaRef.current = false;
    deepgramSessionRef.current = false;
    setIsListening(false);
  };

  const publishHybridTranscript = () => {
    const googleText = appendTranscript(
      googleFinalRef.current,
      googlePartialRef.current,
    );
    const deepgramText = deepgramTextRef.current || "";
    const googleScore =
      scoreBanglaTranscript(googleText, googleConfidenceRef.current) +
      (countBanglaChars(googleText) >= 2 ? 6 : 0);
    const deepgramScore = scoreBanglaTranscript(
      deepgramText,
      deepgramConfidenceRef.current,
    );

    const bestText =
      googleScore >= deepgramScore
        ? googleText || deepgramText
        : deepgramText || googleText;

    finalTranscriptRef.current = bestText;
    const withFinal = appendTranscript(
      listeningBaseTextRef.current,
      bestText,
    );
    onChangeRef.current(withFinal);
    return withFinal;
  };

  publishHybridTranscriptRef.current = publishHybridTranscript;

  const finalizeWithText = (text = "") => {
    const withFinal = appendTranscript(listeningBaseTextRef.current, text);
    onChangeRef.current(withFinal);
    return withFinal;
  };

  const maybeScheduleAutoSend = (finalText) => {
    const nextText = typeof finalText === "string" ? finalText.trim() : "";
    const baseText = listeningBaseTextRef.current.trim();

    if (!nextText || nextText === baseText) return;

    scheduleAutoSend(nextText);
  };

  maybeScheduleAutoSendRef.current = maybeScheduleAutoSend;

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

    if (payload.type === "status") {
      const statusMessage = String(payload.message || "");
      speechLog("Server status:", statusMessage);
      modelLoadingRef.current = /still loading/i.test(statusMessage);
      setVoiceStatusMessage(statusMessage);
      return;
    }

    if (payload.type === "partial") {
      const partial = (payload.text || "").trim();
      speechLog("Partial transcript:", partial);
      deepgramTextRef.current = partial;
      deepgramConfidenceRef.current = Number(payload.confidence || 0.55);

      if (hybridBanglaRef.current) {
        publishHybridTranscript();
        return;
      }

      const withPartial = appendTranscript(
        listeningBaseTextRef.current,
        partial,
      );
      onChangeRef.current(withPartial);
      return;
    }

    if (payload.type === "utterance-end") {
      if (autoRunActionsRef.current && isListeningRef.current) {
        speechLog("Silence detected; finalizing voice input for auto-run");
        stopDeepgramVoiceInput();
      }
      return;
    }

    if (payload.type === "final") {
      const finalText = (payload.text || "").trim();
      speechLog("Final transcript:", finalText);
      deepgramTextRef.current = finalText || deepgramTextRef.current;
      if (payload.confidence) {
        deepgramConfidenceRef.current = Number(payload.confidence);
      }

      const withFinal = hybridBanglaRef.current
        ? publishHybridTranscript()
        : finalizeWithText(finalText);

      if (!hybridBanglaRef.current) {
        finalTranscriptRef.current = finalText;
      }

      clearStopTimeout();
      stopPcmCapture();
      stopMediaRecorder();
      stopMediaStream();
      stopBrowserRecognition();
      closeWebSocket();
      hybridBanglaRef.current = false;
      deepgramSessionRef.current = false;
      isFinalizingRef.current = false;
      setIsListening(false);
      setIsFinalizing(false);
      setVoiceStatusMessage("");
      maybeScheduleAutoSend(withFinal);
      return;
    }

    if (payload.type === "error") {
      const message = String(payload.message || "");
      speechLog("Server error message:", message);
      const fatal =
        /Unauthorized|Missing auth token|Invalid or expired token|Deepgram client is not initialized|DEEPGRAM_API_KEY|Failed to initialize Deepgram/i.test(
          message,
        );

      if (fatal) {
        speechLog("Fatal error, stopping voice session");
        clearStopTimeout();
        closeWebSocket();
        stopListeningLocal();
        setIsFinalizing(false);
        setVoiceStatusMessage("");
        const fallbackFinal = finalTranscriptRef.current || value;
        finalizeWithText(fallbackFinal);
      } else {
        speechLog("Non-fatal error, continuing session");
      }

      return;
    }
  };

  // ── Deepgram voice input: mic -> WebSocket -> Node.js -> Deepgram live STT ───
  const startDeepgramVoiceInput = async (language = "bn") => {
    if (!isBanglaSupported || isLoading || isListeningRef.current) {
      speechLog("startDeepgramVoiceInput blocked", {
        isBanglaSupported,
        isLoading,
        isListening: isListeningRef.current,
        language,
      });
      return;
    }

    clearAutoSendTimeout();
    listeningBaseTextRef.current = value;
    finalTranscriptRef.current = "";
    googleFinalRef.current = "";
    googlePartialRef.current = "";
    googleConfidenceRef.current = 0;
    deepgramTextRef.current = "";
    deepgramConfidenceRef.current = 0;
    hybridBanglaRef.current = false;
    isFinalizingRef.current = false;
    banglaRecognitionLangIndexRef.current = 0;
    modelLoadingRef.current = false;
    setVoiceStatusMessage("");
    setIsFinalizing(false);
    setShowSuggestions(false);

    try {
      speechLog("Requesting microphone permission...");
      const socketUrls = getSpeechWebSocketUrls();
      const [stream, ws] = await Promise.all([
        (async () => {
          try {
            return await navigator.mediaDevices.getUserMedia({
              audio: {
                channelCount: 1,
                echoCancellation: true,
                noiseSuppression: true,
                autoGainControl: true,
              },
            });
          } catch (error) {
            speechLog(
              "Constrained mic request failed, retrying with defaults",
              error,
            );
            return navigator.mediaDevices.getUserMedia({ audio: true });
          }
        })(),
        (async () => {
          let connected = null;
          let connectionError = null;

          for (let index = 0; index < socketUrls.length; index += 1) {
            const socketUrl = socketUrls[index];
            speechLog(
              "Connecting to speech WebSocket:",
              socketUrl.replace(/\?.*$/, ""),
            );
            try {
              connected = await openSpeechWebSocket(
                socketUrl,
                handleSocketMessage,
              );
              break;
            } catch (error) {
              connectionError = error;
              speechLog("WebSocket connection attempt failed", error);
            }
          }

          if (!connected) {
            throw (
              connectionError || new Error("Unable to connect to speech server")
            );
          }

          return connected;
        })(),
      ]);
      mediaStreamRef.current = stream;
      mediaRecorderRef.current = null;
      speechLog("Microphone permission granted");

      wsRef.current = ws;
      speechLog("WebSocket connected");

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

      const startPcmStreaming = async () => {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) return false;

        let audioContext;
        try {
          audioContext = new AudioCtx({ sampleRate: TARGET_SAMPLE_RATE });
        } catch (err) {
          speechLog("16kHz AudioContext failed, using default rate", err);
          audioContext = new AudioCtx();
        }
        if (audioContext.state === "suspended") {
          await audioContext.resume();
        }

        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(
          PCM_PROCESSOR_BUFFER_SIZE,
          1,
          1,
        );
        const silence = audioContext.createGain();
        silence.gain.value = 0;

        processor.onaudioprocess = (event) => {
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            return;
          }

          const input = event.inputBuffer.getChannelData(0);
          const downsampled = downsampleTo16k(input, audioContext.sampleRate);
          wsRef.current.send(floatTo16BitPcm(downsampled));
        };

        source.connect(processor);
        processor.connect(silence);
        silence.connect(audioContext.destination);

        audioContextRef.current = audioContext;
        audioSourceRef.current = source;
        audioProcessorRef.current = processor;
        audioGainRef.current = silence;
        speechLog(
          "PCM capture started sampleRate=",
          audioContext.sampleRate,
          "buffer=",
          PCM_PROCESSOR_BUFFER_SIZE,
        );
        return true;
      };

      let pcmReady = false;
      try {
        pcmReady = await startPcmStreaming();
      } catch (err) {
        speechLog("PCM capture failed", err);
        pcmReady = false;
      }
      let mimeType = "audio/l16";
      let encoding = "linear16";

      if (!pcmReady) {
        mimeType = pickSupportedMimeType() || "audio/webm";
        encoding = "";
        speechLog(
          "PCM capture unavailable, falling back to MediaRecorder mimeType:",
          mimeType,
        );
        const recorder = new MediaRecorder(
          stream,
          mimeType ? { mimeType } : undefined,
        );

        recorder.addEventListener("dataavailable", async (ev) => {
          if (!ev.data || ev.data.size === 0 || !wsRef.current) return;
          try {
            const audioBuffer = await ev.data.arrayBuffer();
            if (wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(audioBuffer);
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
      }

      const startPayload = {
        type: "start",
        language,
        mimeType,
        encoding,
        sampleRate: TARGET_SAMPLE_RATE,
        chunkDurationMs: AUDIO_TIMESLICE_MS,
      };
      speechLog("Sending start payload", startPayload);
      ws.send(JSON.stringify(startPayload));

      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.start(AUDIO_TIMESLICE_MS);
      }

      if (language === "bn" && recognitionRef.current) {
        hybridBanglaRef.current = true;
        recognitionRef.current.lang = BANGLA_RECOGNITION_LANGS[0];
        recognitionRef.current.maxAlternatives = 5;
        try {
          recognitionRef.current.start();
          speechLog(
            "Browser Bangla SpeechRecognition started",
            recognitionRef.current.lang,
          );
        } catch (err) {
          speechLog("Browser Bangla STT failed; Deepgram PCM only", err);
          hybridBanglaRef.current = false;
        }
      }

      speechLog("Voice input started language=", language, "pcm=", pcmReady);
      deepgramSessionRef.current = true;
      setIsListening(true);
      inputRef.current?.focus();
    } catch (err) {
      speechLog("startDeepgramVoiceInput failed", err);
      stopListeningLocal();
      closeWebSocket();
    }
  };

  // How long to wait for the server's "final" message before giving up and
  // using whatever text we have locally. The Bangla path now uses a live
  // Deepgram stream, so finalization should normally be much faster than the
  // older batch/Whisper pipeline.
  const STOP_TIMEOUT_NORMAL_MS = 1600;
  const STOP_TIMEOUT_MODEL_LOADING_MS = 6000;

  const stopDeepgramVoiceInput = async () => {
    if (!isListeningRef.current) return;

    if (isFinalizingRef.current) {
      speechLog("Force-finalizing voice session (user requested early stop)");
      clearStopTimeout();
      isFinalizingRef.current = false;
      const withFinal = hybridBanglaRef.current
        ? publishHybridTranscript()
        : finalizeWithText(finalTranscriptRef.current || value);
      stopPcmCapture();
      stopMediaRecorder();
      stopMediaStream();
      stopBrowserRecognition();
      closeWebSocket();
      hybridBanglaRef.current = false;
      deepgramSessionRef.current = false;
      setIsListening(false);
      setIsFinalizing(false);
      setVoiceStatusMessage("");
      maybeScheduleAutoSend(withFinal);
      return;
    }

    speechLog("stopDeepgramVoiceInput called");
    isFinalizingRef.current = true;
    stopPcmCapture();
    stopMediaRecorder();
    stopMediaStream();
    stopBrowserRecognition();

    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      try {
        speechLog("Sending stop payload");
        wsRef.current.send(JSON.stringify({ type: "stop" }));
      } catch (err) {
        speechLog("Failed to send stop payload", err);
      }

      setIsFinalizing(true);

      const timeoutMs = modelLoadingRef.current
        ? STOP_TIMEOUT_MODEL_LOADING_MS
        : STOP_TIMEOUT_NORMAL_MS;

      speechLog(`Waiting up to ${timeoutMs}ms for final transcript...`);

      clearStopTimeout();
      stopTimeoutRef.current = setTimeout(() => {
        speechLog("Stop timeout reached, finalizing locally");
        const withFinal = hybridBanglaRef.current
          ? publishHybridTranscript()
          : finalizeWithText(finalTranscriptRef.current || value);
        closeWebSocket();
        hybridBanglaRef.current = false;
        deepgramSessionRef.current = false;
        isFinalizingRef.current = false;
        setIsListening(false);
        setIsFinalizing(false);
        setVoiceStatusMessage("");
        maybeScheduleAutoSend(withFinal);
      }, timeoutMs);
    } else {
      speechLog("No open socket on stop; finalizing immediately");
      const withFinal = hybridBanglaRef.current
        ? publishHybridTranscript()
        : finalizeWithText(finalTranscriptRef.current || value);
      hybridBanglaRef.current = false;
      deepgramSessionRef.current = false;
      isFinalizingRef.current = false;
      setIsListening(false);
      setIsFinalizing(false);
      maybeScheduleAutoSend(withFinal);
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

    clearAutoSendTimeout();
    listeningBaseTextRef.current = value;
    finalTranscriptRef.current = "";
    setShowSuggestions(false);

    try {
      recognitionRef.current.lang = "en-US";
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

  const shouldUseBrowserEnglishRecognition =
    voiceMode === "en" && isEnglishSupported;

  activeStopRef.current = shouldUseBrowserEnglishRecognition
    ? stopEnglishRecognition
    : stopDeepgramVoiceInput;

  useEffect(() => {
    if (isLoading && isListening) {
      activeStopRef.current();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isLoading, isListening]);

  useEffect(() => {
    return () => {
      clearStopTimeout();
      stopPcmCapture();
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
      if (value.trim()) {
        clearAutoSendTimeout();
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

  const toggleVoiceInput = () => {
    if (isListening) {
      activeStopRef.current();
      return;
    }

    if (shouldUseBrowserEnglishRecognition) {
      startEnglishRecognition();
      return;
    }

    startDeepgramVoiceInput(voiceMode === "en" ? "en" : "bn");
  };

  const toggleVoiceMode = () => {
    if (isListening || isLoading) return;
    setVoiceMode((mode) => (mode === "bn" ? "en" : "bn"));
  };

  const handleTextChange = (nextValue) => {
    clearAutoSendTimeout();
    if (isListening) {
      activeStopRef.current();
    }
    onChange(nextValue);
  };

  const isSpeechSupported =
    voiceMode === "en"
      ? isEnglishSupported || isBanglaSupported
      : isBanglaSupported;

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
          className={`ai-agent-voice-btn ${isListening ? "listening" : ""} ${isFinalizing ? "finalizing" : ""}`}
          onClick={toggleVoiceInput}
          disabled={!isSpeechSupported || isLoading}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
          type="button"
          title={
            isFinalizing
              ? "Finishing transcription… tap again to stop waiting and use the current text"
              : isSpeechSupported
                ? isListening
                  ? "Stop voice input"
                  : voiceMode === "bn"
                    ? "Start Bangla voice input"
                    : isEnglishSupported
                      ? "Start English voice input"
                      : "Start English voice input (Deepgram fallback)"
                : "Voice input is not supported in this browser"
          }
          aria-label={
            isFinalizing
              ? "Finishing transcription, tap to stop waiting"
              : isListening
                ? "Stop voice recognition"
                : voiceMode === "bn"
                  ? "Start Bangla voice recognition"
                  : isEnglishSupported
                    ? "Start English voice recognition"
                    : "Start English voice recognition with Deepgram fallback"
          }
        >
          <i
            className={`fas ${
              isFinalizing
                ? "fa-circle-notch fa-spin"
                : isListening
                  ? "fa-stop"
                  : "fa-microphone"
            }`}
          />
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
            isFinalizing
              ? voiceStatusMessage ||
                "Finishing transcription… tap the mic again to stop waiting"
              : isListening
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
            onClick={() => {
              if (!value.trim()) return;
              clearAutoSendTimeout();
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

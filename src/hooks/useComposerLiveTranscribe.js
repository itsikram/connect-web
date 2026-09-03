import { useCallback, useEffect, useRef, useState } from "react";
import { mergeTranscriptChunk } from "./transcriptText";

const TARGET_SAMPLE_RATE = 16000;
// Smaller buffers reduce the delay before Deepgram receives each audio frame.
const PCM_PROCESSOR_BUFFER_SIZE = 1024;
const AUDIO_TIMESLICE_MS = 80;

const SpeechRecognitionCtor = () =>
  typeof window !== "undefined"
    ? window.SpeechRecognition || window.webkitSpeechRecognition
    : null;

const canUseDeepgram = () =>
  typeof window !== "undefined" &&
  !!window.WebSocket &&
  !!navigator?.mediaDevices?.getUserMedia &&
  !!(window.AudioContext || window.webkitAudioContext);

const START_ERRORS = new Set([
  "not-allowed",
  "audio-capture",
  "language-not-supported",
  "service-not-allowed",
  "network",
]);

const stopTracks = (stream) => {
  stream?.getTracks?.().forEach((track) => {
    try {
      track.stop();
    } catch {
      /* ignore */
    }
  });
};

const requestMicStream = async () => {
  if (!navigator?.mediaDevices?.getUserMedia) {
    throw new Error("microphone-unavailable");
  }
  try {
    return await navigator.mediaDevices.getUserMedia({
      audio: {
        channelCount: 1,
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  } catch {
    return navigator.mediaDevices.getUserMedia({ audio: true });
  }
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
    for (let j = start; j < end; j += 1) sum += float32[j];
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

const pickRecorderMime = () => {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/mp4",
    "audio/ogg;codecs=opus",
  ];
  for (const mimeType of candidates) {
    if (window.MediaRecorder?.isTypeSupported?.(mimeType)) return mimeType;
  }
  return "";
};

const resolveSpeechServerBase = () => {
  const fromEnv = String(
    process.env.REACT_APP_SOCKET_URL || process.env.REACT_APP_SERVER_ADDR || "",
  )
    .trim()
    .replace(/\/+$/, "");
  if (fromEnv) return fromEnv;
  if (typeof window === "undefined") return "http://localhost:4000";
  const { hostname, protocol } = window.location;
  if (
    hostname === "localhost" ||
    hostname === "127.0.0.1" ||
    hostname === "[::1]"
  ) {
    return `${protocol}//${hostname}:4000`;
  }
  return window.location.origin;
};

const speechSocketUrls = () => {
  const url = new URL(resolveSpeechServerBase());
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws/speech";
  if (typeof window !== "undefined") {
    const pageHost = window.location.hostname;
    const socketIsLoopback =
      url.hostname === "localhost" || url.hostname === "127.0.0.1";
    const pageIsLoopback =
      pageHost === "localhost" ||
      pageHost === "127.0.0.1" ||
      pageHost === "[::1]";
    if (socketIsLoopback && !pageIsLoopback) {
      url.hostname = pageHost;
    }
  }
  try {
    const user = JSON.parse(localStorage.getItem("user") || "{}");
    if (user?.accessToken) url.searchParams.set("token", user.accessToken);
  } catch {
    /* ignore */
  }
  const urls = [url.toString()];
  if (url.hostname === "localhost") {
    const ipv4Url = new URL(url.toString());
    ipv4Url.hostname = "127.0.0.1";
    urls.push(ipv4Url.toString());
  }
  return urls;
};

const openSpeechSocket = (socketUrl, onMessage) =>
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
        /* ignore */
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
        /* ignore */
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

const toDeepgramLang = (langCode) =>
  String(langCode || "")
    .toLowerCase()
    .startsWith("bn")
    ? "bn"
    : "en";

export default function useComposerLiveTranscribe({
  onFinal,
  onInterim,
} = {}) {
  const [listening, setListening] = useState(false);
  const [browserEnglishSupported, setBrowserEnglishSupported] = useState(false);
  const [deepgramSupported, setDeepgramSupported] = useState(false);
  const onFinalRef = useRef(onFinal);
  const onInterimRef = useRef(onInterim);
  const recRef = useRef(null);
  const wantListenRef = useRef(false);
  const wsRef = useRef(null);
  const mediaStreamRef = useRef(null);
  const mediaRecorderRef = useRef(null);
  const audioContextRef = useRef(null);
  const audioSourceRef = useRef(null);
  const audioProcessorRef = useRef(null);
  const audioGainRef = useRef(null);
  const langRef = useRef("en-US");
  const lastPartialRef = useRef("");
  const lastFinalRef = useRef({ text: "", at: 0 });
  const engineRef = useRef(null);

  onFinalRef.current = onFinal;
  onInterimRef.current = onInterim;

  useEffect(() => {
    setBrowserEnglishSupported(Boolean(SpeechRecognitionCtor()));
    setDeepgramSupported(canUseDeepgram());
  }, []);

  const emitFinal = useCallback((text) => {
    const next = mergeTranscriptChunk("", text);
    if (!next) return;
    const now = Date.now();
    const prev = lastFinalRef.current;
    if (prev.text && now - prev.at < 3500) {
      if (next.toLowerCase() === prev.text.toLowerCase()) return;
      const merged = mergeTranscriptChunk(prev.text, next);
      if (merged.toLowerCase() === prev.text.toLowerCase()) return;
    }
    lastFinalRef.current = { text: next, at: now };
    lastPartialRef.current = "";
    onFinalRef.current?.(next);
  }, []);
  const startBrowserRef = useRef(null);
  const startDeepgramRef = useRef(null);

  const haltBrowserRec = useCallback(() => {
    const rec = recRef.current;
    recRef.current = null;
    if (!rec) return;
    try {
      rec.onstart = null;
      rec.onresult = null;
      rec.onerror = null;
      rec.onend = null;
    } catch {
      /* ignore */
    }
    try {
      rec.abort?.();
    } catch {
      try {
        rec.stop?.();
      } catch {
        /* ignore */
      }
    }
  }, []);

  const stopBrowser = useCallback(() => {
    wantListenRef.current = false;
    haltBrowserRec();
  }, [haltBrowserRec]);

  const stopDeepgramHardware = useCallback(() => {
    try {
      audioProcessorRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      audioSourceRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    try {
      audioGainRef.current?.disconnect();
    } catch {
      /* ignore */
    }
    audioProcessorRef.current = null;
    audioSourceRef.current = null;
    audioGainRef.current = null;
    const audioContext = audioContextRef.current;
    audioContextRef.current = null;
    if (audioContext && audioContext.state !== "closed") {
      audioContext.close().catch(() => {});
    }
    try {
      if (mediaRecorderRef.current?.state !== "inactive") {
        mediaRecorderRef.current?.stop?.();
      }
    } catch {
      /* ignore */
    }
    mediaRecorderRef.current = null;
    mediaStreamRef.current?.getTracks?.().forEach((track) => {
      try {
        track.stop();
      } catch {
        /* ignore */
      }
    });
    mediaStreamRef.current = null;
  }, []);

  const closeSocket = useCallback(() => {
    if (!wsRef.current) return;
    try {
      wsRef.current.close();
    } catch {
      /* ignore */
    }
    wsRef.current = null;
  }, []);

  const stop = useCallback(() => {
    wantListenRef.current = false;
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      try {
        wsRef.current.send(JSON.stringify({ type: "stop" }));
      } catch {
        /* ignore */
      }
    }
    stopBrowser();
    stopDeepgramHardware();
    closeSocket();
    engineRef.current = null;
    lastPartialRef.current = "";
    setListening(false);
  }, [closeSocket, stopBrowser, stopDeepgramHardware]);

  const startBrowser = useCallback(
    (langCode = "en-US") =>
      new Promise((resolve, reject) => {
        const Ctor = SpeechRecognitionCtor();
        if (!Ctor) {
          reject(new Error("no-speech-recognition"));
          return;
        }
        haltBrowserRec();
        wantListenRef.current = true;
        langRef.current = langCode;
        const rec = new Ctor();
        rec.lang = langCode;
        rec.interimResults = true;
        rec.continuous = true;
        rec.maxAlternatives = 1;
        let settled = false;
        let timer = 0;
        const finish = (error) => {
          if (settled) return;
          settled = true;
          clearTimeout(timer);
          if (error) {
            haltBrowserRec();
            reject(error);
            return;
          }
          engineRef.current = "browser";
          setListening(true);
          resolve(true);
        };
        timer = setTimeout(() => {
          finish(new Error("speech-start-timeout"));
        }, 4000);
        rec.onstart = () => finish(null);
        rec.onresult = (event) => {
          if (!wantListenRef.current) return;
          let interimText = "";
          let finalText = "";
          for (let i = event.resultIndex; i < event.results.length; i += 1) {
            const piece = event.results[i][0]?.transcript || "";
            if (event.results[i].isFinal) finalText += piece;
            else interimText += piece;
          }
          if (interimText) onInterimRef.current?.(interimText);
          if (finalText) emitFinal(finalText.trim());
        };
        rec.onerror = (event) => {
          const err = String(event?.error || "").trim();
          if (!err || err === "no-speech" || err === "aborted") {
            return;
          }
          if (!settled && START_ERRORS.has(err)) {
            finish(new Error(err));
            return;
          }
          if (
            (err === "language-not-supported" || err === "service-not-allowed") &&
            canUseDeepgram() &&
            startDeepgramRef.current
          ) {
            haltBrowserRec();
            startDeepgramRef.current(toDeepgramLang(langCode)).catch(() => {
              wantListenRef.current = false;
              setListening(false);
            });
            return;
          }
          if (err === "not-allowed" || err === "audio-capture") {
            wantListenRef.current = false;
            setListening(false);
          }
        };
        rec.onend = () => {
          if (recRef.current !== rec) return;
          if (wantListenRef.current) {
            window.setTimeout(() => {
              if (!wantListenRef.current || recRef.current !== rec) return;
              try {
                rec.start();
                setListening(true);
              } catch {
                wantListenRef.current = false;
                setListening(false);
                recRef.current = null;
              }
            }, 60);
            return;
          }
          wantListenRef.current = false;
          setListening(false);
          recRef.current = null;
        };
        recRef.current = rec;
        try {
          rec.start();
        } catch (error) {
          finish(
            error instanceof Error
              ? error
              : new Error(String(error || "speech-start-failed")),
          );
        }
      }),
    [emitFinal, haltBrowserRec],
  );

  startBrowserRef.current = startBrowser;

  const handleSocketMessage = useCallback((event) => {
    if (!wantListenRef.current) return;
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }
    if (payload.type === "error") {
      console.warn("[speech]", payload.message || "Speech recognition failed");
      const lang = langRef.current;
      if (
        String(lang).toLowerCase().startsWith("bn") &&
        SpeechRecognitionCtor() &&
        engineRef.current === "deepgram"
      ) {
        stopDeepgramHardware();
        closeSocket();
        startBrowserRef.current?.(lang)?.catch(() => {});
      }
      return;
    }
    if (payload.type === "partial") {
      const partial = String(payload.text || "").trim();
      if (partial) {
        lastPartialRef.current = partial;
        if (payload.isFinal) {
          emitFinal(partial);
        } else {
          onInterimRef.current?.(partial);
        }
      }
      return;
    }
    if (payload.type === "final" || payload.type === "utterance-end") {
      const finalText = String(
        payload.text || lastPartialRef.current || "",
      ).trim();
      lastPartialRef.current = "";
      if (finalText) emitFinal(finalText);
    }
  }, [closeSocket, emitFinal, stopDeepgramHardware]);

  const startDeepgram = useCallback(
    async (language, existingStream = null) => {
      const socketUrls = speechSocketUrls();
      let stream = existingStream;
      let ws = null;
      try {
        const wsPromise = (async () => {
          let lastError = null;
          for (const socketUrl of socketUrls) {
            try {
              return await openSpeechSocket(socketUrl, handleSocketMessage);
            } catch (error) {
              lastError = error;
            }
          }
          throw lastError || new Error("Unable to connect to speech server");
        })();
        if (!stream) {
          stream = await requestMicStream();
        }
        ws = await wsPromise;
      } catch (error) {
        if (!existingStream) stopTracks(stream);
        try {
          ws?.close();
        } catch {
          /* ignore */
        }
        throw error;
      }

      mediaStreamRef.current = stream;
      wsRef.current = ws;
      wantListenRef.current = true;

      ws.onerror = () => {
        if (
          wantListenRef.current &&
          String(langRef.current).toLowerCase().startsWith("bn") &&
          SpeechRecognitionCtor()
        ) {
          stopDeepgramHardware();
          closeSocket();
          startBrowserRef.current?.(langRef.current)?.catch(() => {});
          return;
        }
        stop();
      };
      ws.onclose = () => {
        wsRef.current = null;
        if (!wantListenRef.current || engineRef.current !== "deepgram") return;
        if (
          String(langRef.current).toLowerCase().startsWith("bn") &&
          SpeechRecognitionCtor()
        ) {
          stopDeepgramHardware();
          startBrowserRef.current?.(langRef.current)?.catch(() => {});
          return;
        }
        stop();
      };

      let pcmReady = false;
      try {
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        let audioContext;
        try {
          audioContext = new AudioCtx({ sampleRate: TARGET_SAMPLE_RATE });
        } catch {
          audioContext = new AudioCtx();
        }
        if (audioContext.state === "suspended") await audioContext.resume();
        const source = audioContext.createMediaStreamSource(stream);
        const processor = audioContext.createScriptProcessor(
          PCM_PROCESSOR_BUFFER_SIZE,
          1,
          1,
        );
        const silence = audioContext.createGain();
        silence.gain.value = 0;
        processor.onaudioprocess = (audioEvent) => {
          if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
            return;
          }
          const input = audioEvent.inputBuffer.getChannelData(0);
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
        pcmReady = true;
      } catch {
        pcmReady = false;
      }

      let mimeType = "audio/l16";
      let encoding = "linear16";
      if (!pcmReady) {
        mimeType = pickRecorderMime() || "audio/webm";
        encoding = "";
        const recorder = new MediaRecorder(
          stream,
          mimeType ? { mimeType } : undefined,
        );
        recorder.addEventListener("dataavailable", async (ev) => {
          if (!ev.data?.size || !wsRef.current) return;
          try {
            const audioBuffer = await ev.data.arrayBuffer();
            if (wsRef.current.readyState === WebSocket.OPEN) {
              wsRef.current.send(audioBuffer);
            }
          } catch {
            /* ignore */
          }
        });
        mediaRecorderRef.current = recorder;
      }

      ws.send(
        JSON.stringify({
          type: "start",
          language,
          mimeType,
          encoding,
          sampleRate: TARGET_SAMPLE_RATE,
          chunkDurationMs: AUDIO_TIMESLICE_MS,
        }),
      );
      if (mediaRecorderRef.current) {
        mediaRecorderRef.current.start(AUDIO_TIMESLICE_MS);
      }
      engineRef.current = "deepgram";
      setListening(true);
      return true;
    },
    [closeSocket, handleSocketMessage, stop, stopDeepgramHardware],
  );

  startDeepgramRef.current = startDeepgram;

  const start = useCallback(
    async (langCode) => {
      try {
        stop();
        lastPartialRef.current = "";
        const requested = String(langCode || "en-US");
        langRef.current = requested;
        const isBangla = requested.toLowerCase().startsWith("bn");
        const browserLangs = isBangla
          ? requested.toLowerCase().startsWith("bn-in")
            ? ["bn-IN", "bn-BD"]
            : ["bn-BD", "bn-IN"]
          : ["en-US"];

        let primedStream = null;
        // Browser recognition is the lowest-latency path for English. Bangla
        // uses the server recognizer first when available for better coverage.
        if (isBangla && canUseDeepgram()) {
          try {
            primedStream = await requestMicStream();
          } catch (error) {
            console.warn("Microphone permission failed:", error);
          }
        }

        const tryBrowser = async () => {
          if (!SpeechRecognitionCtor()) return false;
          stopTracks(primedStream);
          primedStream = null;
          for (const lang of browserLangs) {
            try {
              await startBrowser(lang);
              return true;
            } catch (error) {
              console.warn(
                `Browser speech recognition failed (${lang}):`,
                error,
              );
            }
          }
          return false;
        };

        if (isBangla && canUseDeepgram() && primedStream) {
          try {
            await startDeepgram("bn", primedStream);
            primedStream = null;
            return true;
          } catch (error) {
            console.warn("Deepgram speech recognition failed:", error);
            stopTracks(primedStream);
            primedStream = null;
          }
        }

        if (await tryBrowser()) return true;

        if (canUseDeepgram()) {
          try {
            await startDeepgram(toDeepgramLang(requested));
            return true;
          } catch (error) {
            console.warn("Deepgram speech recognition failed:", error);
          }
        }

        return false;
      } catch (error) {
        console.error("Live transcription failed:", error);
        try {
          stop();
        } catch {
          /* ignore */
        }
        return false;
      }
    },
    [startBrowser, startDeepgram, stop],
  );

  useEffect(() => () => stop(), [stop]);

  return {
    listening,
    start,
    stop,
    browserEnglishSupported,
    deepgramSupported,
    supported: browserEnglishSupported || deepgramSupported,
  };
}

import { useCallback, useEffect, useRef, useState } from "react";
import { getSocketUrl } from "../utils/offlineUtils";

const TARGET_SAMPLE_RATE = 16000;
const PCM_PROCESSOR_BUFFER_SIZE = 2048;
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

const speechSocketUrls = () => {
  const base = getSocketUrl();
  const url = new URL(base);
  url.protocol = url.protocol === "https:" ? "wss:" : "ws:";
  url.pathname = "/ws/speech";
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
  const engineRef = useRef(null);

  onFinalRef.current = onFinal;
  onInterimRef.current = onInterim;

  useEffect(() => {
    setBrowserEnglishSupported(Boolean(SpeechRecognitionCtor()));
    setDeepgramSupported(canUseDeepgram());
  }, []);

  const stopBrowser = useCallback(() => {
    wantListenRef.current = false;
    const rec = recRef.current;
    recRef.current = null;
    try {
      rec?.stop?.();
    } catch {
      /* ignore */
    }
  }, []);

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
    setListening(false);
  }, [closeSocket, stopBrowser, stopDeepgramHardware]);

  const startBrowserEnglish = useCallback(() => {
    const Ctor = SpeechRecognitionCtor();
    if (!Ctor) return false;
    stopBrowser();
    wantListenRef.current = true;
    const rec = new Ctor();
    rec.lang = "en-US";
    rec.interimResults = true;
    rec.continuous = true;
    rec.maxAlternatives = 3;
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
      if (finalText) {
        onFinalRef.current?.(finalText.trim());
      }
    };
    rec.onerror = () => {
      wantListenRef.current = false;
      setListening(false);
    };
    rec.onend = () => {
      if (recRef.current !== rec) return;
      if (wantListenRef.current) {
        try {
          rec.start();
          setListening(true);
          return;
        } catch {
          /* fall through */
        }
      }
      wantListenRef.current = false;
      setListening(false);
      recRef.current = null;
    };
    recRef.current = rec;
    rec.start();
    engineRef.current = "browser";
    setListening(true);
    return true;
  }, [stopBrowser]);

  const handleSocketMessage = useCallback((event) => {
    if (!wantListenRef.current) return;
    let payload;
    try {
      payload = JSON.parse(event.data);
    } catch {
      return;
    }
    if (payload.type === "partial") {
      const partial = String(payload.text || "").trim();
      if (partial) onInterimRef.current?.(partial);
      return;
    }
    if (payload.type === "final") {
      const finalText = String(payload.text || "").trim();
      if (finalText) onFinalRef.current?.(finalText);
    }
  }, []);

  const startDeepgram = useCallback(
    async (language) => {
      const socketUrls = speechSocketUrls();
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
          } catch {
            return navigator.mediaDevices.getUserMedia({ audio: true });
          }
        })(),
        (async () => {
          let lastError = null;
          for (const socketUrl of socketUrls) {
            try {
              return await openSpeechSocket(socketUrl, handleSocketMessage);
            } catch (error) {
              lastError = error;
            }
          }
          throw lastError || new Error("Unable to connect to speech server");
        })(),
      ]);

      mediaStreamRef.current = stream;
      wsRef.current = ws;
      wantListenRef.current = true;

      ws.onerror = () => {
        stop();
      };
      ws.onclose = () => {
        wsRef.current = null;
        if (wantListenRef.current) stop();
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
    [handleSocketMessage, stop],
  );

  const start = useCallback(
    async (langCode) => {
      stop();
      const isBangla = String(langCode || "")
        .toLowerCase()
        .startsWith("bn");
      const useBrowserEnglish = !isBangla && Boolean(SpeechRecognitionCtor());

      try {
        if (useBrowserEnglish) {
          return startBrowserEnglish();
        }
        if (!canUseDeepgram()) return false;
        return await startDeepgram(toDeepgramLang(langCode));
      } catch (error) {
        console.error("Live transcription failed:", error);
        stop();
        return false;
      }
    },
    [startBrowserEnglish, startDeepgram, stop],
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

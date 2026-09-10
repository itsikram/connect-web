import React, { useEffect, useRef, useState } from "react";
import useComposerLiveTranscribe from "../../hooks/useComposerLiveTranscribe";
import socket from "../../common/socket";

const MAX_LINES = 8;

export default function CallTranscript({ enabled, channelName, peerId, myId }) {
  const [lines, setLines] = useState([]);
  const [interim, setInterim] = useState("");
  const sequenceRef = useRef(0);

  const addLine = (senderId, text, final) => {
    const value = String(text || "").trim();
    if (!value) return;
    setLines((previous) => {
      const next = [...previous];
      const last = next[next.length - 1];
      if (!final && senderId === myId && last?.senderId === myId && !last.final) {
        next[next.length - 1] = { ...last, text: value };
      } else {
        next.push({ id: `${Date.now()}-${sequenceRef.current++}`, senderId, text: value, final });
      }
      return next.slice(-MAX_LINES);
    });
  };

  const transcribe = useComposerLiveTranscribe({
    onFinal: (text) => {
      addLine(myId, text, true);
      socket.emit("call-transcript", { to: peerId, channelName, text, isFinal: true });
      setInterim("");
    },
    onInterim: (text) => {
      setInterim(text);
      socket.emit("call-transcript", { to: peerId, channelName, text, isFinal: false });
    },
  });

  useEffect(() => {
    if (!enabled || !channelName) return undefined;
    const onTranscript = (payload) => {
      if (String(payload?.channelName || "") !== String(channelName) || String(payload?.senderId || "") === String(myId)) return;
      addLine(String(payload.senderId), payload.text, Boolean(payload.isFinal));
    };
    socket.on("call-transcript", onTranscript);
    return () => socket.off("call-transcript", onTranscript);
  }, [channelName, enabled, myId]);

  useEffect(() => {
    setLines([]);
    setInterim("");
    transcribe.stop({ discard: true });
  }, [channelName]);

  if (!enabled || !channelName) return null;

  const toggle = async () => {
    if (transcribe.listening) {
      await transcribe.stop();
      setInterim("");
    } else {
      await transcribe.start("auto");
    }
  };

  return (
    <div className="call-transcript">
      {lines.length > 0 || interim ? (
        <div className="call-transcript-panel" role="log" aria-live="polite">
          {lines.map((line) => (
            <div className="call-transcript-line" key={line.id}>
              <strong>{line.senderId === myId ? "You: " : "Friend: "}</strong>
              {line.text}
            </div>
          ))}
          {interim ? <div className="call-transcript-line is-interim">You: {interim}</div> : null}
        </div>
      ) : null}
      <button
        type="button"
        className={`call-transcript-toggle${transcribe.listening ? " is-active" : ""}`}
        onClick={toggle}
        aria-pressed={transcribe.listening}
        title={transcribe.listening ? "Turn live captions off" : "Turn on live captions"}
      >
        <i className="fas fa-closed-captioning" aria-hidden="true" />
        <span>{transcribe.listening ? "Captions on" : "Captions"}</span>
      </button>
    </div>
  );
}

import React, { useState, useRef, useEffect } from "react";
import { motion } from "framer-motion";

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

const appendTranscript = (baseText, transcript) => {
  const nextTranscript = transcript.trim();

  if (!nextTranscript) return baseText;
  if (!baseText) return nextTranscript;

  return /\s$/.test(baseText)
    ? `${baseText}${nextTranscript}`
    : `${baseText} ${nextTranscript}`;
};

const BENGALI_CHAR_REGEX = /[\u0980-\u09FF]/;

const resolveSpeechLanguage = (inputText = "") => {
  if (BENGALI_CHAR_REGEX.test(inputText || "")) {
    return "bn-BD";
  }

  if (typeof navigator !== "undefined") {
    const browserLanguages = [
      navigator.language,
      ...(navigator.languages || []).filter(Boolean),
    ].filter(Boolean);

    const hasBanglaLocale = browserLanguages.some((lang) =>
      /^bn(-|$)/i.test(lang),
    );

    if (hasBanglaLocale) {
      return "bn-BD";
    }

    return browserLanguages[0] || "en-US";
  }

  return "en-US";
};

const ChatInput = ({ value, onChange, onSend, isLoading }) => {
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [isFocused, setIsFocused] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isSpeechSupported, setIsSpeechSupported] = useState(false);

  const inputRef = useRef(null);
  const onChangeRef = useRef(onChange);
  const recognitionRef = useRef(null);
  const listeningBaseTextRef = useRef("");
  const finalTranscriptRef = useRef("");

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    const SpeechRecognition =
      typeof window !== "undefined"
        ? window.SpeechRecognition || window.webkitSpeechRecognition
        : null;

    if (!SpeechRecognition) {
      setIsSpeechSupported(false);
      return;
    }

    setIsSpeechSupported(true);

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = resolveSpeechLanguage();

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

    recognition.onerror = () => {
      setIsListening(false);
    };

    recognition.onend = () => {
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

  useEffect(() => {
    if (isLoading && isListening) {
      recognitionRef.current?.stop();
    }
  }, [isLoading, isListening]);

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
    // Strip placeholder brackets, position cursor at end
    onChange(s.replace(/\[.*?\]/g, ""));
    setShowSuggestions(false);
    setTimeout(() => inputRef.current?.focus(), 50);
  };

  const toggleVoiceInput = () => {
    if (!isSpeechSupported || isLoading || !recognitionRef.current) return;

    if (isListening) {
      recognitionRef.current.stop();
      return;
    }

    listeningBaseTextRef.current = value;
    finalTranscriptRef.current = "";
    setShowSuggestions(false);
    setIsListening(true);

    recognitionRef.current.lang = resolveSpeechLanguage(value);

    try {
      recognitionRef.current.start();
      inputRef.current?.focus();
    } catch {
      setIsListening(false);
    }
  };

  const handleTextChange = (nextValue) => {
    if (isListening) {
      recognitionRef.current?.stop();
    }
    onChange(nextValue);
  };

  return (
    <motion.div
      className="ai-agent-chat-input-container"
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.15 }}
    >
      {/* Suggestions */}
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

      {/* Input wrapper */}
      <div className={`ai-agent-input-wrapper ${isFocused ? "focused" : ""}`}>
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
                : "Start voice input"
              : "Voice input is not supported in this browser"
          }
          aria-label={
            isListening ? "Stop voice recognition" : "Start voice recognition"
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
              ? "Listening... speak naturally"
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

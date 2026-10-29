import React, { useState, useCallback, useEffect, useLayoutEffect, useRef } from "react";
import { createPortal } from "react-dom";
import api from "../../api/api";
import { useSelector } from "react-redux";
import EmojiPicker from "emoji-picker-react";
import socket from "../../common/socket";
import "./StickyChatFooter.css";
import "./SecureMessage.css";
import ComposerContextPreview from "./ComposerContextPreview";
import useComposerImageUploads, {
  MAX_COMPOSER_IMAGES,
} from "../../hooks/useComposerImageUploads";
import { showErrorToast, showInfoToast } from "../../utils/toastUtils";
import ComposerMicMenu from "./ComposerMicMenu";
import useComposerLiveTranscribe from "../../hooks/useComposerLiveTranscribe";
import { mergeTranscriptChunk } from "../../hooks/transcriptText";
import useConnectChatSettings from "../../hooks/useConnectChatSettings";

const StickyChatFooter = ({
  room,
  connectId,
  setIsTyping,
  userId,
  replyData,
  setReplyData,
  setIsReplying,
  messages,
  connectProfile,
  msgListRef,
  isAi = false,
  sendMessage,
}) => {
  const settings = useSelector((state) => state.setting);
  const { settings: chatAppearance } = useConnectChatSettings(connectId);

  const [inputValue, setInputValue] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState(false);
  const [isEmojiContainer, setIsEmojiContainer] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const isSendingRef = useRef(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);

  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [showMicMenu, setShowMicMenu] = useState(false);
  const [micMenuView, setMicMenuView] = useState("main");
  const [transcribeLang, setTranscribeLang] = useState("en-US");
  const [recordingMs, setRecordingMs] = useState(0);
  const [actionEmoji, setActionEmoji] = useState("👍");
  // Secure mode: the next messages vanish after the receiver opens them.
  // Off by default and reset per conversation so it is never left on by
  // accident.
  const [secureMode, setSecureMode] = useState(false);
  const secureModeRef = useRef(false);

  const recorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const lastTypingEmitRef = useRef(0);
  const imageInput = useRef(null);
  const imageUploads = useComposerImageUploads();
  const uploadFileInput = useRef(null);
  const emojiContainerRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const micMenuRef = useRef(null);
  const micButtonRef = useRef(null);
  const micMenuPanelRef = useRef(null);
  const transcribeBaseRef = useRef("");
  const inputValueRef = useRef("");
  const messageInput = useRef(null);
  const [emojiPosition, setEmojiPosition] = useState({ top: 0, right: 0 });
  const [micMenuPosition, setMicMenuPosition] = useState({ left: 0, bottom: 0 });

  useEffect(() => {
    setActionEmoji(chatAppearance?.actionEmoji || "👍");
  }, [chatAppearance?.actionEmoji]);

  useEffect(() => {
    inputValueRef.current = inputValue;
  }, [inputValue]);

  useEffect(() => {
    secureModeRef.current = secureMode;
  }, [secureMode]);

  useEffect(() => {
    secureModeRef.current = false;
    setSecureMode(false);
  }, [connectId]);

  const scrollToLastMessage = () => {
    if (msgListRef?.current) {
      setTimeout(() => {
        const lastMsg = msgListRef.current.querySelector(
          ".chat-message-container:last-child",
        );
        if (lastMsg) {
          lastMsg.scrollIntoView({ behavior: "smooth", block: "end" });
        } else {
          msgListRef.current.scrollTop = msgListRef.current.scrollHeight;
        }
      }, 100);
    }
  };

  const emitTyping = useCallback(
    (typing, value = "") => {
      const roomId = room || [userId, connectId].sort().join("_");
      if (!roomId || !connectId || !userId) return;
      if (!settings?.showIsTyping) return;

      socket.emit("typing", {
        room: roomId,
        isTyping: typing,
        // Never stream the draft of a secure message as a live preview.
        type: typing && !secureModeRef.current ? value : "",
        receiverId: connectId,
        senderId: userId,
      });
    },
    [room, userId, connectId, settings?.showIsTyping],
  );

  const removeTyping = useCallback(() => {
    if (typingTimeoutRef.current) {
      clearTimeout(typingTimeoutRef.current);
      typingTimeoutRef.current = null;
    }
    if (isTypingRef.current) {
      emitTyping(false);
      isTypingRef.current = false;
    }
  }, [emitTyping]);

  const addTyping = useCallback(
    (value = "") => {
      if (!settings?.showIsTyping) return;

      const now = Date.now();
      const shouldEmit =
        !isTypingRef.current || now - lastTypingEmitRef.current > 400;

      if (shouldEmit) {
        emitTyping(true, value);
        lastTypingEmitRef.current = now;
        isTypingRef.current = true;
      }

      if (typingTimeoutRef.current) {
        clearTimeout(typingTimeoutRef.current);
      }
      typingTimeoutRef.current = setTimeout(() => {
        removeTyping();
      }, 1200);
    },
    [settings?.showIsTyping, emitTyping, removeTyping],
  );

  useEffect(() => {
    if (!settings?.showIsTyping) {
      removeTyping();
    }
  }, [settings?.showIsTyping, removeTyping]);

  const handleTranscriptInterim = useCallback(
    (text) => {
      if (!text) return;
      const next = mergeTranscriptChunk(transcribeBaseRef.current, text);
      setInputValue(next);
      if (next) addTyping(next);
    },
    [addTyping],
  );

  const handleTranscriptFinal = useCallback(
    (text) => {
      if (!text) return;
      const next = mergeTranscriptChunk(transcribeBaseRef.current, text);
      transcribeBaseRef.current = next;
      setInputValue(next);
      addTyping(next);
    },
    [addTyping],
  );

  const {
    listening: isTranscribing,
    supported: isTranscribeSupported,
    start: startTranscription,
    stop: stopTranscription,
  } = useComposerLiveTranscribe({
    onFinal: handleTranscriptFinal,
    onInterim: handleTranscriptInterim,
  });

  useEffect(() => {
    const onDown = (event) => {
      const inWrap = micMenuRef.current?.contains(event.target);
      const inPanel = micMenuPanelRef.current?.contains(event.target);
      if (!inWrap && !inPanel) {
        setShowMicMenu(false);
        setMicMenuView("main");
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, []);

  useLayoutEffect(() => {
    if (!showMicMenu) return undefined;

    const updatePosition = () => {
      const button = micButtonRef.current;
      if (!button) return;
      const rect = button.getBoundingClientRect();
      const menuWidth = Math.min(268, window.innerWidth - 24);
      const left = Math.min(
        Math.max(8, rect.left),
        Math.max(8, window.innerWidth - menuWidth - 8),
      );
      setMicMenuPosition({
        left,
        bottom: Math.max(8, window.innerHeight - rect.top + 10),
      });
    };

    updatePosition();
    window.addEventListener("resize", updatePosition);
    window.addEventListener("scroll", updatePosition, true);
    return () => {
      window.removeEventListener("resize", updatePosition);
      window.removeEventListener("scroll", updatePosition, true);
    };
  }, [showMicMenu, micMenuView]);

  const handleSendMessage = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (imageUploads.isUploading) {
        showInfoToast("Photos are still uploading…");
        return;
      }
      const photoUrls = imageUploads.readyUrls;
      if (
        isSendingRef.current ||
        (!inputValue.trim() && !attachmentUrl && photoUrls.length === 0)
      ) {
        return;
      }

      isSendingRef.current = true;
      setIsSendingMessage(true);
      stopTranscription();

      const roomId = room || [userId, connectId].sort().join("_");
      const messageContent = inputValue.trim();
      const secure = secureModeRef.current && !isAi;

      // One message per photo; the text and reply ride on the first one.
      const attachments = [
        ...(attachmentUrl ? [attachmentUrl] : []),
        ...photoUrls,
      ];
      const outgoing = (attachments.length ? attachments : [false]).map(
        (attachment, index) => ({
          room: roomId,
          senderId: userId,
          receiverId: connectId,
          message: index === 0 ? messageContent : "",
          attachment,
          parent: index === 0 ? replyData.messageId || false : false,
          isAi,
          ...(secure ? { secure: true } : {}),
        }),
      );

      Promise.all(outgoing.map((data) => sendMessage(data)))
        .then(() => {
          removeTyping();
          scrollToLastMessage();
        })
        .catch((error) => {
          console.error("Failed to send message:", error);
          // Give the draft back unless something new was typed meanwhile.
          if (messageContent) {
            setInputValue((current) => current || messageContent);
          }
        })
        .finally(() => {
          setTimeout(() => {
            isSendingRef.current = false;
            setIsSendingMessage(false);
          }, 500);
        });
      setInputValue("");
      setAttachmentUrl("");
      imageUploads.clearImages();
      setIsReplying?.(false);
      setReplyData({
        messageId: null,
        body: null,
        attachment: null,
        senderId: null,
        messageType: null,
      });
    },
    [
      inputValue,
      attachmentUrl,
      imageUploads,
      room,
      userId,
      connectId,
      replyData,
      isAi,
      setIsTyping,
      setReplyData,
      setIsReplying,
      msgListRef,
      sendMessage,
      removeTyping,
    ],
  );

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim() || attachmentUrl || imageUploads.hasImages) {
        handleSendMessage(e);
      }
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);
    transcribeBaseRef.current = value.trim();

    if (value.trim().length > 0) {
      addTyping(value);
    } else {
      removeTyping();
    }
  };

  const likeButtonClick = () => {
    const roomId = room || [userId, connectId].sort().join("_");
    const data = {
      room: roomId,
      senderId: userId,
      receiverId: connectId,
      message: actionEmoji,
      attachment: false,
      parent: false,
      isAi,
    };

    // Send message via HTTP
    sendMessage(data)
      .then(() => {
        scrollToLastMessage();
      })
      .catch((error) => {
        console.error("Failed to send like message:", error);
      });
  };

  const handleAttachmentButtonClick = () => {
    uploadFileInput.current?.click();
  };

  const handleFileChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingFile(true);
    try {
      const formData = new FormData();
      formData.append("file", file);

      const res = await api.post("/upload/file", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      if (res.status === 200 && res.data?.secure_url) {
        setAttachmentUrl(res.data.secure_url);
      }
    } catch (error) {
      console.error("Error uploading file:", error);
      showErrorToast(error?.response?.data?.error || "Could not upload that file.");
    } finally {
      setIsUploadingFile(false);
      e.target.value = "";
    }
  };

  const handleImageButtonClick = () => {
    if (!imageUploads.canAddMore) {
      showInfoToast(`You can send up to ${MAX_COMPOSER_IMAGES} photos at once.`);
      return;
    }
    imageInput.current?.click();
  };

  const addComposerImages = (files) => {
    const list = Array.from(files || []);
    if (!list.length) return;
    const skipped = imageUploads.addFiles(list);
    const added = list.length - skipped;
    if (!added) {
      showErrorToast(
        imageUploads.canAddMore
          ? "Only image files can be sent as photos."
          : `You can send up to ${MAX_COMPOSER_IMAGES} photos at once.`,
      );
    } else if (skipped) {
      showInfoToast(
        `Added ${added} photo${added === 1 ? "" : "s"} · max ${MAX_COMPOSER_IMAGES} per message, non-images skipped.`,
      );
    }
  };

  const handleImageChange = (e) => {
    const files = Array.from(e.target.files || []);
    e.target.value = "";
    addComposerImages(files);
  };

  const handleComposerPaste = (e) => {
    const files = Array.from(e.clipboardData?.files || []).filter((file) =>
      String(file.type).startsWith("image/"),
    );
    if (!files.length) return;
    e.preventDefault();
    addComposerImages(files);
  };

  const pickSupportedMimeType = () => {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
      "audio/mp4",
    ];
    for (const type of candidates) {
      if (window.MediaRecorder?.isTypeSupported?.(type)) {
        return type;
      }
    }
    return undefined;
  };

  const startRecording = useCallback(async () => {
    if (isRecording || isUploadingAudio) return;
    stopTranscription();
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaStreamRef.current = stream;
      const mimeType = pickSupportedMimeType();
      const recorder = new MediaRecorder(
        stream,
        mimeType ? { mimeType } : undefined,
      );
      recorderRef.current = recorder;
      recordingChunksRef.current = [];

      recorder.addEventListener("dataavailable", (ev) => {
        if (ev.data && ev.data.size > 0) {
          recordingChunksRef.current.push(ev.data);
        }
      });

      recorder.start(100);
      setIsRecording(true);
      setRecordingMs(0);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      const startTs = Date.now();
      recordingTimerRef.current = setInterval(() => {
        setRecordingMs(Date.now() - startTs);
      }, 200);
    } catch (err) {
      console.error("Recording error:", err);
      setIsRecording(false);
    }
  }, [isRecording, isUploadingAudio, stopTranscription]);

  const startLiveTranscribe = useCallback(
    async (langCode) => {
      setShowMicMenu(false);
      setMicMenuView("main");
      if (!isTranscribeSupported) {
        window.alert(
          "Live transcription is not available. Use Chrome or Edge for English, or check your connection for Deepgram.",
        );
        return;
      }
      setTranscribeLang(langCode);
      transcribeBaseRef.current = String(inputValueRef.current || "").trim();
      let started = false;
      try {
        started = await startTranscription(langCode);
      } catch (error) {
        console.error("Live transcription failed:", error);
      }
      if (started) {
        messageInput?.current?.focus?.({ preventScroll: true });
      } else {
        window.alert(
          "Could not start live transcription. Please allow microphone access and try again.",
        );
      }
    },
    [isTranscribeSupported, startTranscription],
  );

  const startVoiceMessage = useCallback(() => {
    setShowMicMenu(false);
    setMicMenuView("main");
    startRecording();
  }, [startRecording]);

  const stopRecording = useCallback(async (shouldSend) => {
    if (!recorderRef.current) return;
    try {
      recorderRef.current.stop();
    } catch (e) {}

    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }

    setIsRecording(false);

    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }

    if (shouldSend) {
      const mimeType = pickSupportedMimeType() || "audio/webm";
      const blob = new Blob(recordingChunksRef.current, { type: mimeType });
      recordingChunksRef.current = [];
      await uploadAndSendAudio(blob, mimeType);
    }

    recorderRef.current = null;
  }, []);

  const handleMicButtonClick = () => {
    if (isUploadingAudio) return;
    if (isRecording) {
      stopRecording(true);
      return;
    }
    if (isTranscribing) {
      stopTranscription();
      return;
    }
    setMicMenuView("main");
    setShowMicMenu((prev) => !prev);
  };

  const uploadAndSendAudio = useCallback(
    async (blob, mimeType) => {
      setIsUploadingAudio(true);
      try {
        const fileName = `voice-${Date.now()}.${mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "m4a" : "webm"}`;
        const form = new FormData();
        form.append("file", new File([blob], fileName, { type: mimeType }));
        const res = await api.post("/upload/file", form, {
          headers: { "Content-Type": "multipart/form-data" },
        });

        if (res.status === 200 && res.data?.secure_url) {
          const roomId = room || [userId, connectId].sort().join("_");
          const data = {
            room: roomId,
            senderId: userId,
            receiverId: connectId,
            message: "",
            attachment: res.data.secure_url,
            parent: false,
            isAi,
            messageType: "audio",
          };
          // Send voice message via HTTP
          sendMessage(data)
            .then(() => {
              scrollToLastMessage();
            })
            .catch((error) => {
              console.error("Failed to send voice message:", error);
            });
        }
      } catch (e) {
        console.error("Audio upload error:", e);
      } finally {
        setIsUploadingAudio(false);
      }
    },
    [room, userId, connectId, isAi, msgListRef, sendMessage],
  );

  const msToClock = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (totalSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const handleEmojiClick = useCallback(
    (emojiObj) => {
      setInputValue(inputValue + emojiObj.emoji);
      setIsEmojiContainer(false);
    },
    [inputValue],
  );

  // Calculate emoji picker position and handle click outside
  useEffect(() => {
    if (isEmojiContainer && emojiButtonRef.current) {
      const buttonRect = emojiButtonRef.current.getBoundingClientRect();
      setEmojiPosition({
        top: buttonRect.top - 350 - 8, // Height of picker + gap
        right: window.innerWidth - buttonRect.right,
      });
    }

    const handleClickOutside = (event) => {
      if (
        emojiContainerRef.current &&
        !emojiContainerRef.current.contains(event.target) &&
        emojiButtonRef.current &&
        !emojiButtonRef.current.contains(event.target)
      ) {
        setIsEmojiContainer(false);
      }
    };

    if (isEmojiContainer) {
      document.addEventListener("mousedown", handleClickOutside);
    }

    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [isEmojiContainer]);

  useEffect(() => {
    return () => {
      removeTyping();
      try {
        recorderRef.current?.stop();
      } catch (e) {}
      if (mediaStreamRef.current) {
        mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      }
      if (recordingTimerRef.current) {
        clearInterval(recordingTimerRef.current);
      }
    };
  }, [removeTyping]);

  const hasComposableContent = Boolean(
    inputValue.trim() || attachmentUrl || imageUploads.hasImages,
  );
  const canUseSecure = !isAi;
  const isSecureComposer = secureMode && canUseSecure;
  // A voice note is never secure, so the toggle waits while one is in flight.
  const secureToggleDisabled = isRecording || isUploadingAudio;
  const toggleSecureMode = () => {
    if (secureToggleDisabled || !canUseSecure) return;
    const next = !secureModeRef.current;
    secureModeRef.current = next;
    setSecureMode(next);
    if (next) {
      // Drop any live-typing preview the other side already has.
      removeTyping();
      setShowMicMenu(false);
    }
    requestAnimationFrame(() =>
      messageInput?.current?.focus?.({ preventScroll: true }),
    );
  };

  return (
    <div className="sticky-chat-footer-container">
      <ComposerContextPreview
        replyData={replyData}
        userId={userId}
        connectProfile={connectProfile}
        attachmentUrl={attachmentUrl}
        images={imageUploads.images}
        onRemoveImage={imageUploads.removeImage}
        onRetryImage={imageUploads.retryImage}
        onAddImages={handleImageButtonClick}
        canAddMoreImages={imageUploads.canAddMore}
        onCancelReply={() => {
          setIsReplying?.(false);
          setReplyData({
            messageId: null,
            body: null,
            attachment: null,
            senderId: null,
            messageType: null,
          });
        }}
        onRemoveAttachment={() => setAttachmentUrl("")}
      />

      {isTranscribing ? (
        <div className="composer-transcribe-bar" aria-live="polite">
          <span className="composer-transcribe-dot" aria-hidden="true" />
          <div className="composer-transcribe-copy">
            <span className="composer-transcribe-label">
              Listening ·{" "}
              {String(transcribeLang).startsWith("bn") ? "Bangla" : "English"}
            </span>
            <span className="composer-transcribe-interim">
              Speak now — text appears in the message box
            </span>
          </div>
          <button
            type="button"
            className="composer-transcribe-stop"
            onClick={stopTranscription}
            aria-label="Stop live transcription"
          >
            Done
          </button>
        </div>
      ) : null}

      {isRecording ? (
        <div className="sticky-chat-recording-bar">
          <span className="sticky-chat-recording-dot"></span>
          <span className="sticky-chat-recording-time">
            {msToClock(recordingMs)}
          </span>
          <div className="sticky-chat-recording-actions">
            <button
              className="sticky-chat-recording-btn send"
              onClick={() => stopRecording(true)}
              aria-label="Send recording"
            >
              <i className="fas fa-paper-plane"></i>
            </button>
            <button
              className="sticky-chat-recording-btn cancel"
              onClick={() => stopRecording(false)}
              aria-label="Cancel recording"
            >
              <i className="fas fa-times"></i>
            </button>
          </div>
        </div>
      ) : null}

      {isSecureComposer ? (
        <div className="composer-secure-banner" role="status">
          <i className="fas fa-lock" aria-hidden="true"></i>
          <span>
            Secure mode: encrypted, hidden from notifications and gone after
            it's opened (or in 24h).
          </span>
          <button type="button" onClick={toggleSecureMode}>
            Turn off
          </button>
        </div>
      ) : null}

      <div
        className={`sticky-chat-input-wrapper${showMicMenu ? " mic-menu-open" : ""}`}
      >
        {(!isInputFocused || showMicMenu || isTranscribing) && (
          <div className="sticky-chat-attachment-buttons">
            <button
              className={`sticky-chat-attachment-btn ${isUploadingFile ? "loading" : ""}`}
              onClick={handleAttachmentButtonClick}
              disabled={isUploadingFile}
              aria-label="Attach file"
            >
              <i
                className={
                  isUploadingFile ? "fas fa-spinner fa-spin" : "fas fa-plus"
                }
              ></i>
            </button>
            <input
              type="file"
              ref={uploadFileInput}
              onChange={handleFileChange}
              style={{ display: "none" }}
              disabled={isUploadingFile}
            />

            <button
              className={`sticky-chat-attachment-btn ${imageUploads.isUploading ? "loading" : ""}`}
              onClick={handleImageButtonClick}
              aria-label="Attach photos"
            >
              <i
                className={
                  imageUploads.isUploading ? "fas fa-spinner fa-spin" : "fas fa-image"
                }
              ></i>
            </button>
            <input
              type="file"
              accept="image/*"
              multiple
              ref={imageInput}
              onChange={handleImageChange}
              style={{ display: "none" }}
            />

            {/* Voice notes are never secure, so secure mode hides the mic. */}
            {!isSecureComposer ? (
              <div className="composer-mic-wrap" ref={micMenuRef}>
                <button
                  ref={micButtonRef}
                  className={`sticky-chat-attachment-btn ${isRecording ? "recording" : ""} ${isUploadingAudio ? "loading" : ""} ${isTranscribing || showMicMenu ? "recording" : ""}`}
                  onClick={handleMicButtonClick}
                  disabled={isUploadingAudio}
                  aria-haspopup="menu"
                  aria-expanded={showMicMenu}
                  aria-label={
                    isRecording
                      ? "Stop recording"
                      : isTranscribing
                        ? "Stop live transcription"
                        : "Voice options"
                  }
                >
                  <i
                    className={
                      isUploadingAudio
                        ? "fas fa-spinner fa-spin"
                        : isRecording || isTranscribing
                          ? "fas fa-stop"
                          : "fas fa-microphone"
                    }
                  ></i>
                </button>
                {showMicMenu
                  ? createPortal(
                      <div
                        ref={micMenuPanelRef}
                        className="sticky-chat-mic-menu-portal"
                        style={{
                          left: `${micMenuPosition.left}px`,
                          bottom: `${micMenuPosition.bottom}px`,
                        }}
                      >
                        <ComposerMicMenu
                          view={micMenuView}
                          onOpenTranscribe={() => setMicMenuView("transcribe")}
                          onBack={() => setMicMenuView("main")}
                          onSelectLang={startLiveTranscribe}
                          onVoiceMessage={startVoiceMessage}
                        />
                      </div>,
                      document.body,
                    )
                  : null}
              </div>
            ) : null}
          </div>
        )}

        <div className="sticky-chat-input-container">
          {canUseSecure ? (
            <button
              type="button"
              className={`composer-secure-toggle${isSecureComposer ? " is-on" : ""}`}
              // Keep focus in the input so the composer layout doesn't jump.
              onMouseDown={(e) => e.preventDefault()}
              onClick={toggleSecureMode}
              disabled={secureToggleDisabled}
              aria-pressed={isSecureComposer}
              aria-label={
                isSecureComposer
                  ? "Turn off secure mode"
                  : "Send a secure, vanishing message"
              }
              title={
                isSecureComposer
                  ? "Secure mode is on"
                  : "Secure message (vanishes after it's read)"
              }
            >
              <i
                className={`fas ${isSecureComposer ? "fa-lock" : "fa-lock-open"}`}
                aria-hidden="true"
              ></i>
            </button>
          ) : null}
          <input
            ref={messageInput}
            data-voice-input="false"
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
            onPaste={handleComposerPaste}
            onFocus={(e) => {
              setIsInputFocused(true);
              if (inputValue.trim().length > 0) {
                addTyping(inputValue);
              }
            }}
            onBlur={(e) => {
              setIsInputFocused(false);
              removeTyping();
            }}
            placeholder={
              isTranscribing
                ? String(transcribeLang).startsWith("bn")
                  ? "Listening in Bangla…"
                  : "Listening in English…"
                : isSecureComposer
                  ? "Secure message"
                  : "Type a message..."
            }
            className={`sticky-chat-input ${isInputFocused ? "focused" : ""}${canUseSecure ? " has-secure-toggle" : ""}${isSecureComposer ? " is-secure" : ""}`}
            disabled={isRecording || isUploadingAudio}
          />
        </div>

        <div className="sticky-chat-action-buttons">
          {isInputFocused || hasComposableContent || isSecureComposer ? (
            <button
              className={`sticky-chat-action-btn send ${isSendingMessage || imageUploads.isUploading ? "loading" : ""}${isSecureComposer ? " is-secure" : ""}`}
              onClick={handleSendMessage}
              disabled={isSendingMessage || imageUploads.isUploading}
              aria-label={
                imageUploads.isUploading
                  ? "Waiting for uploads"
                  : isSecureComposer
                    ? "Send secure message"
                    : "Send message"
              }
            >
              <i
                className={
                  isSendingMessage || imageUploads.isUploading
                    ? "fas fa-spinner fa-spin"
                    : "fas fa-paper-plane"
                }
              ></i>
            </button>
          ) : (
            <>
              <button
                ref={emojiButtonRef}
                className="sticky-chat-action-btn emoji"
                onClick={() => setIsEmojiContainer((prev) => !prev)}
                aria-expanded={isEmojiContainer}
                aria-haspopup="true"
                aria-label="Add emoji"
              >
                <i className="fas fa-smile"></i>
              </button>
              {isEmojiContainer &&
                createPortal(
                  <div
                    ref={emojiContainerRef}
                    className="sticky-chat-emoji-picker"
                    style={{
                      top: `${emojiPosition.top}px`,
                      right: `${emojiPosition.right}px`,
                    }}
                  >
                    <EmojiPicker
                      theme="dark"
                      onEmojiClick={handleEmojiClick}
                      width={280}
                      height={350}
                    />
                  </div>,
                  document.body,
                )}
              <button
                className="sticky-chat-action-btn like"
                onClick={likeButtonClick}
                aria-label="Send like"
              >
                <span>{actionEmoji}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

export default StickyChatFooter;

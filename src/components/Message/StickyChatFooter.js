import React, { useState, useCallback, useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import api from "../../api/api";
import { useDispatch, useSelector } from "react-redux";
import { loadSettings } from "../../services/actions/settingsActions";
import EmojiPicker from "emoji-picker-react";
import socket from "../../common/socket";
import "./StickyChatFooter.css";

const StickyChatFooter = ({
  room,
  friendId,
  setIsTyping,
  userId,
  replyData,
  setReplyData,
  messages,
  friendProfile,
  msgListRef,
  isAi = false,
  sendMessage,
}) => {
  const dispatch = useDispatch();
  const settings = useSelector((state) => state.setting);

  const [inputValue, setInputValue] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState(false);
  const [isEmojiContainer, setIsEmojiContainer] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [isInputFocused, setIsInputFocused] = useState(false);
  const isSendingRef = useRef(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [isRecording, setIsRecording] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const [actionEmoji, setActionEmoji] = useState("👍");

  const recorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const imageInput = useRef(null);
  const uploadFileInput = useRef(null);
  const emojiContainerRef = useRef(null);
  const emojiButtonRef = useRef(null);
  const messageInput = useRef(null);
  const [emojiPosition, setEmojiPosition] = useState({ top: 0, right: 0 });

  useEffect(() => {
    setActionEmoji(settings.actionEmoji || "👍");
  }, [settings]);

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
      const roomId = room || [userId, friendId].sort().join("_");
      if (!roomId || !friendId || !userId) return;
      if (!settings?.showIsTyping) return;

      socket.emit("typing", {
        room: roomId,
        isTyping: typing,
        type: typing ? value : "",
        receiverId: friendId,
        senderId: userId,
      });
    },
    [room, userId, friendId, settings?.showIsTyping],
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

      if (!isTypingRef.current) {
        emitTyping(true, value);
        isTypingRef.current = true;
      } else {
        emitTyping(true, value);
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

  const handleSendMessage = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation();

      if (isSendingRef.current || (!inputValue.trim() && !attachmentUrl)) {
        return;
      }

      isSendingRef.current = true;
      setIsSendingMessage(true);

      const roomId = room || [userId, friendId].sort().join("_");
      const messageContent = inputValue.trim();

      const data = {
        room: roomId,
        senderId: userId,
        receiverId: friendId,
        message: messageContent,
        attachment: attachmentUrl,
        parent: replyData.messageId || false,
        isAi,
      };

      // Send message via HTTP
      sendMessage(data)
        .then(() => {
          removeTyping();
          scrollToLastMessage();
        })
        .catch((error) => {
          console.error("Failed to send message:", error);
        })
        .finally(() => {
          setTimeout(() => {
            isSendingRef.current = false;
            setIsSendingMessage(false);
          }, 500);
        });
      setInputValue("");
      setAttachmentUrl("");
      setReplyData({ messageId: null, body: null });
    },
    [
      inputValue,
      attachmentUrl,
      room,
      userId,
      friendId,
      replyData,
      isAi,
      setIsTyping,
      setReplyData,
      msgListRef,
      sendMessage,
      removeTyping,
    ],
  );

  const handleKeyPress = (e) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      if (inputValue.trim() || attachmentUrl) {
        handleSendMessage(e);
      }
    }
  };

  const handleInputChange = (e) => {
    const value = e.target.value;
    setInputValue(value);

    if (value.trim().length > 0) {
      addTyping(value);
    } else {
      removeTyping();
    }
  };

  const likeButtonClick = () => {
    const roomId = room || [userId, friendId].sort().join("_");
    const data = {
      room: roomId,
      senderId: userId,
      receiverId: friendId,
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
    } finally {
      setIsUploadingFile(false);
    }
  };

  const handleImageButtonClick = () => {
    imageInput.current?.click();
  };

  const handleImageChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    setIsUploadingImage(true);
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
      console.error("Error uploading image:", error);
    } finally {
      setIsUploadingImage(false);
    }
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
  }, [isRecording, isUploadingAudio]);

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
          const roomId = room || [userId, friendId].sort().join("_");
          const data = {
            room: roomId,
            senderId: userId,
            receiverId: friendId,
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
    [room, userId, friendId, isAi, msgListRef, sendMessage],
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

  return (
    <div className="sticky-chat-footer-container">
      {attachmentUrl && (
        <div className="sticky-chat-preview">
          <img
            src={attachmentUrl}
            alt="Preview"
            className="sticky-chat-preview-img"
          />
          <button
            className="sticky-chat-preview-close"
            onClick={() => setAttachmentUrl("")}
            aria-label="Remove attachment"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}

      {isRecording && (
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
      )}

      <div className="sticky-chat-input-wrapper">
        {!isInputFocused && (
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
              className={`sticky-chat-attachment-btn ${isUploadingImage ? "loading" : ""}`}
              onClick={handleImageButtonClick}
              disabled={isUploadingImage}
              aria-label="Attach image"
            >
              <i
                className={
                  isUploadingImage ? "fas fa-spinner fa-spin" : "fas fa-image"
                }
              ></i>
            </button>
            <input
              type="file"
              accept="image/*"
              ref={imageInput}
              onChange={handleImageChange}
              style={{ display: "none" }}
              disabled={isUploadingImage}
            />

            <button
              className={`sticky-chat-attachment-btn ${isRecording ? "recording" : ""} ${isUploadingAudio ? "loading" : ""}`}
              onClick={isRecording ? () => stopRecording(true) : startRecording}
              disabled={isUploadingAudio}
              aria-label={isRecording ? "Stop recording" : "Record voice"}
            >
              <i
                className={
                  isUploadingAudio
                    ? "fas fa-spinner fa-spin"
                    : isRecording
                      ? "fas fa-stop"
                      : "fas fa-microphone"
                }
              ></i>
            </button>
          </div>
        )}

        <div className="sticky-chat-input-container">
          <input
            ref={messageInput}
            type="text"
            value={inputValue}
            onChange={handleInputChange}
            onKeyDown={handleKeyPress}
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
            placeholder="Type a message..."
            className={`sticky-chat-input ${isInputFocused ? "focused" : ""}`}
            disabled={isRecording || isUploadingAudio}
          />
        </div>

        <div className="sticky-chat-action-buttons">
          {isInputFocused || inputValue.trim() || attachmentUrl ? (
            <button
              className={`sticky-chat-action-btn send ${isSendingMessage ? "loading" : ""}`}
              onClick={handleSendMessage}
              disabled={isSendingMessage}
              aria-label="Send message"
            >
              <i
                className={
                  isSendingMessage
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

import React, { useState, useCallback, useEffect, useRef } from "react";
import api from "../../api/api";
import $ from "jquery";
import { useSelector } from "react-redux";
import EmojiPicker from "emoji-picker-react";
import { useParams } from "react-router-dom";
import socket from "../../common/socket";
import ComposerContextPreview from "./ComposerContextPreview";
import ComposerMicMenu from "./ComposerMicMenu";
import useComposerLiveTranscribe from "../../hooks/useComposerLiveTranscribe";
import useFriendChatSettings from "../../hooks/useFriendChatSettings";

const UPLOAD_PLACEHOLDER =
  "https://res.cloudinary.com/dz88yjerw/image/upload/v1743092084/i5lcu63atrbkpcy6oqam.gif";

const ChatFooter = ({
  chatFooter,
  room,
  isReplying,
  friendId,
  setIsTyping,
  chatNewAttachment,
  messageActionButtonContainer,
  setIsReplying,
  userId,
  messageInput,
  replyData,
  messages,
  setReplyData,
  isPreview,
  setIsPreview,
  msgListRef,
  friendProfile,
  sendMessage,
  scrollToLastMessage: scrollToLastMessageProp,
  isChatLoading = false,
}) => {
  // Removed unused width state
  const [inputValue, setInputValue] = useState("");
  const [attachmentUrl, setAttachmentUrl] = useState(false);
  const [isImojiContainer, setIsEmojiContainer] = useState(false);
  const [isImojiChangeContainer, setIsEmojiChangeContainer] = useState(false);
  const [actionEmoji, setActionEmoji] = useState("👍");
  const [isAi, setIsAi] = useState(false);
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const isSendingRef = useRef(false); // Ref to track sending state synchronously
  const isChatLoadingRef = useRef(false);
  const [isUploadingFile, setIsUploadingFile] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);
  const [showAttachTray, setShowAttachTray] = useState(false);
  const [showMicMenu, setShowMicMenu] = useState(false);
  const [micMenuView, setMicMenuView] = useState("main");
  const [transcribeLang, setTranscribeLang] = useState("en-US");
  const [isLiveVoiceConnecting, setIsLiveVoiceConnecting] = useState(false);
  const [isLiveVoiceActive, setIsLiveVoiceActive] = useState(false);
  // Voice message recording
  const [isRecording, setIsRecording] = useState(false);
  const [isUploadingAudio, setIsUploadingAudio] = useState(false);
  const [recordingMs, setRecordingMs] = useState(0);
  const recorderRef = useRef(null);
  const recordingChunksRef = useRef([]);
  const mediaStreamRef = useRef(null);
  const recordingTimerRef = useRef(null);
  const typingTimeoutRef = useRef(null);
  const isTypingRef = useRef(false);
  const waveformCanvasRef = useRef(null);
  const rafIdRef = useRef(null);
  const audioContextRef = useRef(null);
  const analyserRef = useRef(null);
  const audioSourceRef = useRef(null);
  const imageInput = useRef(null);
  const uploadFileInput = useRef(null);
  const micMenuRef = useRef(null);
  const transcribeBaseRef = useRef("");
  const inputValueRef = useRef("");
  const settings = useSelector((state) => state.setting);
  const { profile } = useParams();
  const {
    settings: chatAppearance,
    updateSettings: updateChatAppearance,
  } = useFriendChatSettings(friendId);

  useEffect(() => {
    if (profile === "ai-chat") setIsAi(true);
  }, [profile]);

  useEffect(() => {
    inputValueRef.current = inputValue;
  }, [inputValue]);

  useEffect(() => {
    isChatLoadingRef.current = Boolean(isChatLoading);
  }, [isChatLoading]);

  useEffect(() => {
    if (!isChatLoading) return;
    setShowAttachTray(false);
    setShowMicMenu(false);
    setIsEmojiContainer(false);
    setIsEmojiChangeContainer(false);
  }, [isChatLoading]);

  useEffect(() => {
    setActionEmoji(chatAppearance?.actionEmoji || "👍");
  }, [chatAppearance?.actionEmoji]);

  const scrollToLastMessage = () => {
    if (typeof scrollToLastMessageProp === "function") {
      scrollToLastMessageProp("smooth");
      return;
    }
    const el =
      msgListRef?.current || document.getElementById("chatMessageList");
    if (!el) return;
    requestAnimationFrame(() => {
      el.scrollTo({ top: el.scrollHeight, behavior: "smooth" });
    });
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

  const lastTypingEmitRef = useRef(0);
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
      const next = [transcribeBaseRef.current, text].filter(Boolean).join(" ");
      setInputValue(next);
      if (next) addTyping(next);
    },
    [addTyping],
  );

  const handleTranscriptFinal = useCallback(
    (text) => {
      if (!text) return;
      const next = [transcribeBaseRef.current, text].filter(Boolean).join(" ");
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
    const handleClickOutside = (event) => {
      if (
        micMenuRef.current &&
        !micMenuRef.current.contains(event.target)
      ) {
        setShowMicMenu(false);
        setMicMenuView("main");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleSendMessage = useCallback(
    (e) => {
      e.preventDefault();
      e.stopPropagation(); // Prevent event bubbling

      const isDisabled = $(e.target).hasClass("button-disabled") || false;

      // Use ref for synchronous check to prevent race conditions
      if (isDisabled || isSendingRef.current || isChatLoadingRef.current) {
        console.log("Message send blocked:", {
          isDisabled,
          isSending: isSendingRef.current,
        });
        return;
      }

      const typedMessage = String(
        (inputValueRef.current != null ? inputValueRef.current : inputValue) ||
          "",
      ).trim();

      // Check if message is empty
      if (!typedMessage && !attachmentUrl) {
        return;
      }

      // Set both state and ref immediately
      isSendingRef.current = true;
      setIsSendingMessage(true);
      stopTranscription();

      const roomId = room || [userId, friendId].sort().join("_");

      if (roomId) {
        const messageContent = typedMessage;

        const messageData = {
          room: roomId,
          senderId: userId,
          receiverId: friendId,
          message: messageContent,
          attachment: attachmentUrl,
          parent: isReplying ? replyData.messageId : false,
          isAi,
        };

        // Send message via HTTP
        sendMessage(messageData)
          .then(() => {
            removeTyping();
            scrollToLastMessage();
            setInputValue("");
            setIsReplying(false);
            setIsPreview(false);
            setAttachmentUrl("");
            setReplyData({
              messageId: null,
              body: null,
              attachment: null,
              senderId: null,
              messageType: null,
            });
          })
          .catch((error) => {
            console.error("Failed to send message:", error);
            if (typedMessage) setInputValue(typedMessage);
          })
          .finally(() => {
            // Reset sending flag after a short delay
            setTimeout(() => {
              isSendingRef.current = false;
              setIsSendingMessage(false);
            }, 500);
          });
      } else {
        isSendingRef.current = false;
        setIsSendingMessage(false);
      }
    },
    [
      messages,
      inputValue,
      attachmentUrl,
      room,
      userId,
      friendId,
      isReplying,
      replyData,
      isAi,
      removeTyping,
      sendMessage,
    ],
  );

  // let updateTyping = (e) => {
  //     let value = e.target.value;
  //     if(settings.showIsTyping) {
  //         socket.emit('update_type', { room, type: value })
  //     }
  // }
  const handleKeyPress = (event) => {
    if (isChatLoadingRef.current) {
      event.preventDefault();
      return;
    }
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault(); // Prevent form submission
      event.stopPropagation(); // Prevent event bubbling
      // Use ref for synchronous check
      if (!isSendingRef.current) {
        handleSendMessage(event);
      }
    }
  };

  const likeButtonClick = () => {
    if (isSendingRef.current || isChatLoadingRef.current) return;
    const emoji = actionEmoji || "❤️";
    const roomId = room || [userId, friendId].sort().join("_");
    if (!roomId || !friendId || !userId) return;

    isSendingRef.current = true;
    setIsSendingMessage(true);
    setInputValue("");

    sendMessage({
      room: roomId,
      senderId: userId,
      receiverId: friendId,
      message: emoji,
      attachment: false,
      parent: false,
      isAi,
    })
      .then(() => {
        removeTyping();
        scrollToLastMessage();
      })
      .catch((error) => {
        console.error("Failed to send quick reaction:", error);
      })
      .finally(() => {
        setTimeout(() => {
          isSendingRef.current = false;
          setIsSendingMessage(false);
        }, 400);
      });
  };

  const handleInputChange = (e) => {
    if (isChatLoadingRef.current) return;
    const value = e.target.value;
    setInputValue(value);
    transcribeBaseRef.current = value.trim();

    if (value.trim().length > 0) {
      addTyping(value);
    } else {
      removeTyping();
    }
  };

  const handleReplyPreviewClose = () => {
    setIsReplying(false);
    setReplyData({
      messageId: null,
      body: null,
      attachment: null,
      senderId: null,
      messageType: null,
    });
    if (!attachmentUrl) setIsPreview(false);
  };

  const handleAttachmentPreviewClose = () => {
    setAttachmentUrl("");
    if (!(isReplying && replyData.messageId)) setIsPreview(false);
  };

  const handleMessageImageButtonClick = useCallback(async () => {
    if (isChatLoadingRef.current) return;
    const clickEvent = new MouseEvent("click", {
      bubbles: true,
      cancelable: false,
    });
    const attachmentInput = document.createElement("input");
    attachmentInput.type = "file";

    attachmentInput.addEventListener("change", async (e) => {
      const attachmentFile = e.target.files[0];
      if (attachmentFile) {
        setIsUploadingImage(true);
        try {
          const attachmentFormData = new FormData();
          attachmentFormData.append("image", attachmentFile);
          setAttachmentUrl(
            "https://res.cloudinary.com/dz88yjerw/image/upload/v1743092084/i5lcu63atrbkpcy6oqam.gif",
          );
          setIsPreview(true);

          const uploadAttachmentRes = await api.post(
            "/upload",
            attachmentFormData,
            {
              headers: {
                "Content-Type": "multipart/form-data",
              },
            },
          );

          if (uploadAttachmentRes.status === 200) {
            const attachmentUrl = uploadAttachmentRes.data.secure_url;
            if (attachmentUrl) {
              setAttachmentUrl(attachmentUrl);
            }
          }
        } catch (error) {
          console.log("Error uploading image:", error);
        } finally {
          setIsUploadingImage(false);
        }
      }
    });

    if (attachmentInput) {
      attachmentInput.dispatchEvent(clickEvent);
    }
  }, [attachmentUrl, isPreview]);

  const handleMessageImageChange = async () => {
    // Handle image change
  };

  const isLiveVoiceActiveRef = useRef(false);

  useEffect(() => {
    const onLiveVoiceStatus = (event) => {
      const { active, connecting, peerId } = event.detail || {};
      const isThisChat =
        !peerId || !friendId || String(peerId) === String(friendId);
      if (!isThisChat) {
        if (isLiveVoiceActiveRef.current) {
          isLiveVoiceActiveRef.current = false;
          setIsLiveVoiceActive(false);
          setIsLiveVoiceConnecting(false);
        }
        return;
      }
      isLiveVoiceActiveRef.current = !!active;
      setIsLiveVoiceActive(!!active);
      setIsLiveVoiceConnecting(!!connecting);
    };

    window.addEventListener("liveVoiceStatus", onLiveVoiceStatus);
    return () => {
      window.removeEventListener("liveVoiceStatus", onLiveVoiceStatus);
    };
  }, [friendId]);

  const handleLiveVoiceButtonClick = () => {
    if (isChatLoadingRef.current) return;
    if (isLiveVoiceActiveRef.current) {
      window.dispatchEvent(new CustomEvent("stopLiveVoice"));
      return;
    }

    const channelName = room || [userId, friendId].sort().join("_");
    if (!channelName || !friendId || !userId) return;

    setIsLiveVoiceConnecting(true);

    const friendName =
      friendProfile?.fullName ||
      friendProfile?.user?.firstName ||
      "Friend";

    window.dispatchEvent(
      new CustomEvent("startLiveVoice", {
        detail: {
          to: String(friendId),
          channelName,
          friendName,
        },
      }),
    );
  };

  // ---------------- Voice Message (MediaRecorder) -----------------
  const pickSupportedMimeType = () => {
    const candidates = [
      "audio/webm;codecs=opus",
      "audio/webm",
      "audio/ogg;codecs=opus",
      "audio/ogg",
      "audio/mp4",
    ];
    for (let i = 0; i < candidates.length; i++) {
      const type = candidates[i];
      if (
        window.MediaRecorder &&
        window.MediaRecorder.isTypeSupported &&
        window.MediaRecorder.isTypeSupported(type)
      ) {
        return type;
      }
    }
    return undefined;
  };

  const stopWaveform = () => {
    if (rafIdRef.current) {
      cancelAnimationFrame(rafIdRef.current);
      rafIdRef.current = null;
    }
    try {
      audioSourceRef.current?.disconnect();
    } catch (e) {}
    try {
      analyserRef.current?.disconnect();
    } catch (e) {}
    try {
      audioContextRef.current?.close();
    } catch (e) {}
    audioSourceRef.current = null;
    analyserRef.current = null;
    audioContextRef.current = null;
  };

  const drawWaveform = () => {
    if (!analyserRef.current || !waveformCanvasRef.current) return;
    const analyser = analyserRef.current;
    const canvas = waveformCanvasRef.current;
    const canvasCtx = canvas.getContext("2d");
    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const render = () => {
      analyser.getByteTimeDomainData(dataArray);
      canvasCtx.clearRect(0, 0, canvas.width, canvas.height);
      canvasCtx.fillStyle = "#111";
      canvasCtx.fillRect(0, 0, canvas.width, canvas.height);
      canvasCtx.lineWidth = 2;
      canvasCtx.strokeStyle = "#1DB954";
      canvasCtx.beginPath();
      const sliceWidth = (canvas.width * 1.0) / bufferLength;
      let x = 0;
      for (let i = 0; i < bufferLength; i++) {
        const v = dataArray[i] / 128.0;
        const y = (v * canvas.height) / 2;
        if (i === 0) {
          canvasCtx.moveTo(x, y);
        } else {
          canvasCtx.lineTo(x, y);
        }
        x += sliceWidth;
      }
      canvasCtx.lineTo(canvas.width, canvas.height / 2);
      canvasCtx.stroke();
      rafIdRef.current = requestAnimationFrame(render);
    };
    rafIdRef.current = requestAnimationFrame(render);
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
        if (ev.data && ev.data.size > 0)
          recordingChunksRef.current.push(ev.data);
      });

      recorder.addEventListener("stop", async () => {
        // handled in stopRecording
      });

      // Waveform setup
      try {
        const ctx = new (window.AudioContext || window.webkitAudioContext)();
        audioContextRef.current = ctx;
        const source = ctx.createMediaStreamSource(stream);
        audioSourceRef.current = source;
        const analyser = ctx.createAnalyser();
        analyser.fftSize = 2048;
        analyserRef.current = analyser;
        source.connect(analyser);
        drawWaveform();
      } catch (e) {
        // Ignore waveform errors; recording still works
      }

      recorder.start(100);
      setIsRecording(true);
      setRecordingMs(0);
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
      const startTs = Date.now();
      recordingTimerRef.current = setInterval(() => {
        setRecordingMs(Date.now() - startTs);
      }, 200);
    } catch (err) {
      console.error("Microphone permission or recording error:", err);
      setIsRecording(false);
    }
  }, [isRecording, isUploadingAudio, stopTranscription]);

  const startLiveTranscribe = useCallback(
    async (langCode) => {
      if (isChatLoadingRef.current) return;
      setShowMicMenu(false);
      setMicMenuView("main");
      setShowAttachTray(false);
      if (!isTranscribeSupported) {
        window.alert(
          "Live transcription is not available. Use Chrome or Edge for English, or check your connection for Deepgram.",
        );
        return;
      }
      setTranscribeLang(langCode);
      transcribeBaseRef.current = String(inputValueRef.current || "").trim();
      const started = await startTranscription(langCode);
      if (started) {
        requestAnimationFrame(() => {
          messageInput?.current?.focus?.({ preventScroll: true });
        });
      } else {
        window.alert(
          "Could not start live transcription. Please allow microphone access and try again.",
        );
      }
    },
    [isTranscribeSupported, startTranscription, messageInput],
  );

  const startVoiceMessage = useCallback(() => {
    if (isChatLoadingRef.current) return;
    setShowMicMenu(false);
    setMicMenuView("main");
    setShowAttachTray(false);
    startRecording();
  }, [startRecording]);

  const cleanupStream = () => {
    try {
      mediaStreamRef.current?.getTracks()?.forEach((t) => t.stop());
    } catch (e) {}
    mediaStreamRef.current = null;
  };

  const stopRecording = useCallback(async (shouldSend) => {
    if (!recorderRef.current) return;
    try {
      recorderRef.current.stop();
    } catch (e) {}
    stopWaveform();
    cleanupStream();
    if (recordingTimerRef.current) {
      clearInterval(recordingTimerRef.current);
      recordingTimerRef.current = null;
    }
    setIsRecording(false);
    const mimeType = pickSupportedMimeType() || "audio/webm";
    const blob = new Blob(recordingChunksRef.current, { type: mimeType });
    recordingChunksRef.current = [];
    recorderRef.current = null;
    if (shouldSend) {
      await uploadAndSendAudio(blob, mimeType);
    }
  }, []);

  const cancelRecording = useCallback(async () => {
    await stopRecording(false);
  }, [stopRecording]);

  const handleMicButtonClick = (e) => {
    e?.preventDefault?.();
    e?.stopPropagation?.();
    if (isChatLoadingRef.current) return;
    if (isUploadingAudio) return;
    if (isRecording) {
      stopRecording(true);
      return;
    }
    if (isTranscribing) {
      stopTranscription();
      return;
    }
    setShowAttachTray(false);
    setMicMenuView("main");
    setShowMicMenu((prev) => !prev);
  };

  const msToClock = (ms) => {
    const totalSeconds = Math.floor(ms / 1000);
    const m = Math.floor(totalSeconds / 60)
      .toString()
      .padStart(2, "0");
    const s = (totalSeconds % 60).toString().padStart(2, "0");
    return `${m}:${s}`;
  };

  const uploadAndSendAudio = useCallback(
    async (blob, mimeType) => {
      setIsUploadingAudio(true);
      try {
        const fileName = `voice-${Date.now()}.${mimeType.includes("ogg") ? "ogg" : mimeType.includes("mp4") ? "m4a" : "webm"}`;
        const form = new FormData();
        form.append("file", new File([blob], fileName, { type: mimeType }));
        // Show uploading placeholder spinner on send button via isUploadingAudio
        const res = await api.post("/upload/file", form, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        if (res.status === 200 && res.data?.secure_url) {
          const voiceUrl = res.data.secure_url;
          const roomId = room || [userId, friendId].sort().join("_");
          const data = {
            room: roomId,
            senderId: userId,
            receiverId: friendId,
            message: "",
            attachment: voiceUrl,
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
    [room, userId, friendId, isAi, sendMessage],
  );

  useEffect(() => {
    return () => {
      removeTyping();
      try {
        recorderRef.current?.stop();
      } catch (e) {}
      cleanupStream();
      stopWaveform();
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current);
    };
  }, [removeTyping]);

  const handleEmojiBtnClick = useCallback((event) => {
    if (isChatLoadingRef.current) return;
    if (event?.target?.closest?.(".emoji-container")) return;
    setIsEmojiChangeContainer(false);
    setIsEmojiContainer((prev) => !prev);
  }, []);

  const emojiChangeClick = useCallback((event) => {
    if (isChatLoadingRef.current) return;
    if (event?.target?.closest?.(".emoji-container")) return;
    setIsEmojiContainer(false);
    setIsEmojiChangeContainer((prev) => !prev);
  }, []);

  const handleEmojiClick = useCallback(
    (emojiObj) => {
      setInputValue(inputValue + emojiObj.emoji);
    },
    [inputValue],
  );

  const updateActionEmojiChange = useCallback(
    (emoji) => {
      setActionEmoji(emoji);
      updateChatAppearance({ actionEmoji: emoji });
    },
    [updateChatAppearance],
  );

  const handleEmojiChangeClick = useCallback((emojiObj) => {
    setActionEmoji(emojiObj.emoji);
    setIsEmojiChangeContainer(false);
    setIsEmojiContainer(false);
    updateActionEmojiChange(emojiObj.emoji);
  }, [updateActionEmojiChange]);

  const handleAttachmentButtonClick = useCallback(() => {
    if (isChatLoadingRef.current) return;
    uploadFileInput.current.dispatchEvent(
      new MouseEvent("click", {
        bubbles: true,
      }),
    );
  }, [attachmentUrl]);

  const handleFileChange = useCallback(
    async (e) => {
      const rawFile = e.target.files[0];
      if (rawFile) {
        setIsUploadingFile(true);
        try {
          const rawFile = new FormData();
          rawFile.append("file", rawFile);
          setAttachmentUrl(
            "https://res.cloudinary.com/dz88yjerw/image/upload/v1743092084/i5lcu63atrbkpcy6oqam.gif",
          );
          // setIsPreview(true)

          const uploadAttachmentRes = await api.post("/upload/file", rawFile, {
            headers: {
              "Content-Type": "multipart/form-data",
            },
          });

          if (uploadAttachmentRes.status === 200) {
            const attachmentUrl = uploadAttachmentRes.data.secure_url;
            if (attachmentUrl) {
              setAttachmentUrl(attachmentUrl);
            }
          }
        } catch (error) {
          console.log("Error uploading file:", error);
        } finally {
          setIsUploadingFile(false);
        }
      }
    },
    [sendMessage],
  );

  const emogiListContainer = useRef(null);
  const emogiChangeContainer = useRef(null);
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        emogiListContainer.current &&
        !emogiListContainer.current.contains(event.target)
      ) {
        setIsEmojiContainer(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        emogiChangeContainer.current &&
        !emogiChangeContainer.current.contains(event.target)
      ) {
        setIsEmojiChangeContainer(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, []);

  const hasComposableContent = Boolean(inputValue.trim() || attachmentUrl);
  const composerLocked = Boolean(isChatLoading);
  const toggleAttachTray = () => {
    if (isChatLoadingRef.current) return;
    setShowAttachTray((prev) => !prev);
    setShowMicMenu(false);
    setMicMenuView("main");
    setIsEmojiContainer(false);
    setIsEmojiChangeContainer(false);
  };

  return (
    <>
      <div
        ref={chatFooter}
        className={`chat-footer modern-composer ${showAttachTray ? "tray-open" : ""}${composerLocked ? " is-chat-loading" : ""}`}
        data-chat-footer="true"
        aria-busy={composerLocked || undefined}
        inert={composerLocked ? "" : undefined}
      >
        <ComposerContextPreview
          replyData={isReplying ? replyData : null}
          userId={userId}
          friendProfile={friendProfile}
          attachmentUrl={attachmentUrl}
          uploadPlaceholder={UPLOAD_PLACEHOLDER}
          onCancelReply={handleReplyPreviewClose}
          onRemoveAttachment={handleAttachmentPreviewClose}
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
          <div className="composer-recording-bar" aria-live="polite">
            <span className="composer-recording-dot">
              <i className="fas fa-circle"></i>
            </span>
            <span className="composer-recording-time">
              {msToClock(recordingMs)}
            </span>
            <canvas
              ref={waveformCanvasRef}
              width={140}
              height={22}
              className="composer-recording-wave"
            />
            <div className="composer-recording-actions">
              <div
                className="composer-icon-btn send"
                onClick={() => stopRecording(true)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    stopRecording(true);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Stop and send voice message"
              >
                <i className="fas fa-paper-plane"></i>
              </div>
              <div
                className="composer-icon-btn danger"
                onClick={cancelRecording}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    cancelRecording();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Cancel recording"
              >
                <i className="fas fa-trash"></i>
              </div>
            </div>
          </div>
        ) : null}

        <div className="new-message-container composer-main">
          <div
            className={`composer-icon-btn attach-toggle ${showAttachTray ? "active" : ""} ${composerLocked || isUploadingFile || isUploadingImage ? "disabled" : ""}`}
            onClick={
              composerLocked || isUploadingFile || isUploadingImage
                ? null
                : toggleAttachTray
            }
            onKeyDown={
              composerLocked || isUploadingFile || isUploadingImage
                ? null
                : (e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.preventDefault();
                      toggleAttachTray();
                    }
                  }
            }
            role="button"
            tabIndex={
              composerLocked || isUploadingFile || isUploadingImage ? -1 : 0
            }
            aria-label={
              showAttachTray ? "Close attachments" : "Open attachments"
            }
            aria-expanded={showAttachTray}
            aria-disabled={composerLocked || isUploadingFile || isUploadingImage}
          >
            <i className={showAttachTray ? "fas fa-times" : "fas fa-plus"}></i>
          </div>

          <div className="new-message-form composer-field-wrap">
            <div className="new-message-input-container composer-field">
              <input
                ref={messageInput}
                onChange={handleInputChange}
                value={inputValue}
                onKeyDown={handleKeyPress}
                placeholder={
                  isTranscribing
                    ? String(transcribeLang).startsWith("bn")
                      ? "Listening in Bangla…"
                      : "Listening in English…"
                    : "Message"
                }
                id="newMessageInput"
                className="new-message-input"
                onTouchStart={(e) => {
                  // Focus with preventScroll before iOS does its default focus pan
                  if (document.body.classList.contains("message-page-mobile")) {
                    const el = e.currentTarget;
                    if (document.activeElement !== el) {
                      e.preventDefault();
                      el.focus({ preventScroll: true });
                    }
                    window.scrollTo(0, 0);
                  }
                }}
                onFocus={() => {
                  if (inputValue.trim().length > 0) {
                    addTyping(inputValue);
                  }
                  setShowAttachTray(false);
                  if (document.body.classList.contains("message-page-mobile")) {
                    window.scrollTo(0, 0);
                    document.documentElement.scrollTop = 0;
                    document.body.scrollTop = 0;
                  }
                }}
                onBlur={removeTyping}
                disabled={composerLocked || isRecording || isUploadingAudio}
                style={{ fontSize: "16px" }}
                enterKeyHint="send"
                autoComplete="off"
                autoCorrect="on"
              />
              <div
                ref={emogiListContainer}
                onClick={composerLocked ? null : handleEmojiBtnClick}
                onKeyDown={
                  composerLocked
                    ? null
                    : (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleEmojiBtnClick(e);
                        }
                      }
                }
                role="button"
                tabIndex={composerLocked ? -1 : 0}
                className={`composer-emoji-btn message-action-emoji-container${composerLocked ? " disabled" : ""}`}
                aria-label="Emoji"
                aria-expanded={isImojiContainer}
                aria-haspopup="true"
                aria-disabled={composerLocked}
              >
                <i className="far fa-smile"></i>
                {isImojiContainer && (
                  <div className="emoji-container">
                    <EmojiPicker theme="dark" onEmojiClick={handleEmojiClick} />
                  </div>
                )}
              </div>
            </div>
          </div>

          <div
            ref={messageActionButtonContainer}
            className="message-action-button-container composer-end-actions"
          >
            {hasComposableContent ? (
              <div
                onClick={
                  composerLocked || isSendingMessage
                    ? null
                    : (e) => {
                        setShowAttachTray(false);
                        handleSendMessage(e);
                      }
                }
                onKeyDown={
                  composerLocked || isSendingMessage
                    ? null
                    : (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setShowAttachTray(false);
                          handleSendMessage(e);
                        }
                      }
                }
                role="button"
                tabIndex={composerLocked || isSendingMessage ? -1 : 0}
                className={`composer-icon-btn send message-action-button send-message ${attachmentUrl == "https://res.cloudinary.com/dz88yjerw/image/upload/v1743092084/i5lcu63atrbkpcy6oqam.gif" && "button-disabled"} ${composerLocked || isSendingMessage ? "disabled" : ""}`}
                aria-label="Send message"
                aria-disabled={composerLocked || isSendingMessage}
                style={{
                  opacity: composerLocked || isSendingMessage ? 0.6 : 1,
                  cursor:
                    composerLocked || isSendingMessage
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                <i
                  className={
                    isSendingMessage
                      ? "fas fa-spinner fa-spin"
                      : "fas fa-paper-plane"
                  }
                ></i>
              </div>
            ) : (
              <>
                <div className="composer-mic-wrap" ref={micMenuRef}>
                  <div
                    className={`composer-icon-btn mic ${composerLocked || isUploadingAudio ? "disabled" : ""} ${isTranscribing || isRecording || showMicMenu ? "active" : ""}`}
                    onClick={
                      composerLocked || isUploadingAudio
                        ? null
                        : handleMicButtonClick
                    }
                    onKeyDown={
                      composerLocked || isUploadingAudio
                        ? null
                        : (e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleMicButtonClick();
                            }
                          }
                    }
                    role="button"
                    tabIndex={composerLocked || isUploadingAudio ? -1 : 0}
                    aria-haspopup="menu"
                    aria-expanded={showMicMenu}
                    aria-disabled={composerLocked || isUploadingAudio}
                    aria-label={
                      isUploadingAudio
                        ? "Uploading voice message"
                        : isTranscribing
                          ? "Stop live transcription"
                          : isRecording
                            ? "Stop voice message"
                            : "Voice options"
                    }
                  >
                    <i
                      className={
                        isUploadingAudio
                          ? "fas fa-spinner fa-spin"
                          : isRecording
                            ? "fas fa-stop-circle"
                            : isTranscribing
                              ? "fas fa-stop"
                              : "fas fa-microphone"
                      }
                    ></i>
                  </div>
                  {showMicMenu ? (
                    <ComposerMicMenu
                      view={micMenuView}
                      onOpenTranscribe={() => setMicMenuView("transcribe")}
                      onBack={() => setMicMenuView("main")}
                      onSelectLang={startLiveTranscribe}
                      onVoiceMessage={startVoiceMessage}
                    />
                  ) : null}
                </div>
                <div
                  onClick={composerLocked ? null : likeButtonClick}
                  onKeyDown={
                    composerLocked
                      ? null
                      : (e) => {
                          if (e.key === "Enter" || e.key === " ") {
                            e.preventDefault();
                            likeButtonClick();
                          }
                        }
                  }
                  role="button"
                  tabIndex={composerLocked ? -1 : 0}
                  className={`composer-icon-btn send-like message-action-button composer-like-desktop${composerLocked ? " disabled" : ""}`}
                  aria-label="Send reaction"
                  title={`Send ${actionEmoji}`}
                  aria-disabled={composerLocked}
                >
                  <span>{actionEmoji}</span>
                </div>
              </>
            )}
          </div>
        </div>

        {showAttachTray && (
          <div
            className="composer-attach-tray"
            role="toolbar"
            aria-label="Attachments"
          >
            <div className="composer-attach-grid">
              <div
                className={`composer-attach-item ${isUploadingImage ? "disabled" : ""}`}
                onClick={
                  isUploadingImage
                    ? null
                    : () => {
                        handleMessageImageButtonClick();
                      }
                }
                onKeyDown={
                  isUploadingImage
                    ? null
                    : (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleMessageImageButtonClick();
                        }
                      }
                }
                role="button"
                tabIndex={isUploadingImage ? -1 : 0}
                aria-label="Upload photo"
              >
                <span className="composer-attach-icon photo">
                  <i
                    className={
                      isUploadingImage
                        ? "fas fa-spinner fa-spin"
                        : "fas fa-image"
                    }
                  ></i>
                </span>
                <span className="composer-attach-label">Photo</span>
              </div>

              <div
                className={`composer-attach-item ${isUploadingFile ? "disabled" : ""}`}
                onClick={
                  isUploadingFile
                    ? null
                    : () => {
                        handleAttachmentButtonClick();
                      }
                }
                onKeyDown={
                  isUploadingFile
                    ? null
                    : (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          handleAttachmentButtonClick();
                        }
                      }
                }
                role="button"
                tabIndex={isUploadingFile ? -1 : 0}
                aria-label="Upload file"
              >
                <span className="composer-attach-icon file">
                  <i
                    className={
                      isUploadingFile
                        ? "fas fa-spinner fa-spin"
                        : "fas fa-paperclip"
                    }
                  ></i>
                </span>
                <span className="composer-attach-label">File</span>
              </div>

              <div
                className={`composer-attach-item ${isLiveVoiceConnecting || isRecording || isUploadingAudio ? "disabled" : ""}`}
                onClick={
                  isLiveVoiceConnecting || isRecording || isUploadingAudio
                    ? null
                    : () => {
                        setShowAttachTray(false);
                        handleLiveVoiceButtonClick();
                      }
                }
                onKeyDown={
                  isLiveVoiceConnecting || isRecording || isUploadingAudio
                    ? null
                    : (e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setShowAttachTray(false);
                          handleLiveVoiceButtonClick();
                        }
                      }
                }
                role="button"
                tabIndex={
                  isLiveVoiceConnecting || isRecording || isUploadingAudio
                    ? -1
                    : 0
                }
                aria-label={
                  isLiveVoiceActive ? "Stop live voice" : "Live voice"
                }
              >
                <span
                  className={`composer-attach-icon live ${isLiveVoiceActive ? "active" : ""}`}
                >
                  <i
                    className={
                      isLiveVoiceConnecting
                        ? "fas fa-spinner fa-spin"
                        : isLiveVoiceActive
                          ? "fas fa-phone-slash"
                          : "fas fa-headset"
                    }
                  ></i>
                </span>
                <span className="composer-attach-label">
                  {isLiveVoiceActive ? "Stop" : "Live"}
                </span>
              </div>

              <div
                className="composer-attach-item"
                onClick={likeButtonClick}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    likeButtonClick();
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Send quick reaction"
              >
                <span className="composer-attach-icon react">
                  <span className="composer-attach-emoji">{actionEmoji}</span>
                </span>
                <span className="composer-attach-label">React</span>
              </div>

              <div
                ref={emogiChangeContainer}
                className="composer-attach-item message-action-emoji-container"
                onClick={emojiChangeClick}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    e.preventDefault();
                    emojiChangeClick(e);
                  }
                }}
                role="button"
                tabIndex={0}
                aria-label="Change quick reaction"
                aria-expanded={isImojiChangeContainer}
                aria-haspopup="true"
              >
                <span className="composer-attach-icon react-edit">
                  <i className="fas fa-pen"></i>
                </span>
                <span className="composer-attach-label">Edit</span>
                {isImojiChangeContainer && (
                  <div className="emoji-container">
                    <EmojiPicker
                      theme="dark"
                      onEmojiClick={handleEmojiChangeClick}
                    />
                  </div>
                )}
              </div>
            </div>
          </div>
        )}

        <div
          ref={chatNewAttachment}
          className="chat-new-attachment composer-attach-hidden"
          aria-hidden="true"
        >
          <input
            type="file"
            name="uploaded_file"
            onChange={handleFileChange.bind(this)}
            ref={uploadFileInput}
            style={{ display: "none" }}
            disabled={composerLocked || isUploadingFile}
          />
          <input
            type="file"
            accept="image/*"
            style={{ display: "none" }}
            ref={imageInput}
            onChange={handleMessageImageChange.bind(this)}
            disabled={composerLocked || isUploadingImage}
          />
        </div>
      </div>
    </>
  );
};

export default ChatFooter;

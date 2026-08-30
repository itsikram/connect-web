import isValidUrl from "./isValiUrl";

const AUDIO_EXTENSIONS = [
  ".mp3",
  ".m4a",
  ".aac",
  ".ogg",
  ".oga",
  ".opus",
  ".wav",
  ".webm",
];

export const isAudioUrl = (url) => {
  if (!url || typeof url !== "string") return false;
  const lower = url.split("?")[0].toLowerCase();
  return AUDIO_EXTENSIONS.some((ext) => lower.endsWith(ext));
};

export const isAudioMessage = (msg) =>
  msg?.messageType === "audio" || isAudioUrl(msg?.attachment);

export const hasImageAttachment = (msg) =>
  isValidUrl(msg?.attachment) && !isAudioMessage(msg);

export const getMessageSnippet = (msg) => {
  const text = String(msg?.message || msg?.body || "").trim();
  if (text) return text;
  if (msg?.messageType === "call") return msg?.message || "Call";
  if (isAudioMessage(msg)) return "Voice message";
  if (isValidUrl(msg?.attachment)) return "Photo";
  return "Message";
};

export const getProfileDisplayName = (profile, fallback = "them") => {
  if (!profile) return fallback;
  const full = String(profile.fullName || "").trim();
  if (full) return full;
  const first = String(profile?.user?.firstName || "").trim();
  const last = String(profile?.user?.surname || "").trim();
  const combined = `${first} ${last}`.trim();
  return combined || fallback;
};

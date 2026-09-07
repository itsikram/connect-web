const STORAGE_KEY = "connect_ai_agent_settings_v1";

export const CUSTOM_MODEL_ID = "__custom__";

export const AI_PROVIDERS = {
  ollama: {
    id: "ollama",
    label: "Ollama (Local)",
    shortLabel: "Ollama",
    description: "Local models running on this computer",
    brandColor: "#111827",
    keyLabel: "Ollama API key",
    keyHelp: "Not required for the local Ollama server.",
    keyPlaceholder: "Not required",
    defaultModel: "mistral:latest",
    models: [
      { id: "mistral:latest", label: "Mistral (local)" },
      { id: "llama3.1:8b", label: "Llama 3.1 8B (local)" },
      { id: "llama3.2:latest", label: "Llama 3.2 (local)" },
    ],
  },
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    shortLabel: "Gemini",
    description: "Google's Gemini models",
    brandColor: "#4285f4",
    keyLabel: "Gemini API key",
    keyHelp: "From Google AI Studio.",
    keyPlaceholder: "AIza... or AQ...",
    defaultModel: "gemini-2.0-flash",
    models: [
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash (fast)" },
      { id: "gemini-2.5-flash-lite", label: "Gemini 2.5 Flash-Lite" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
      { id: "gemini-1.5-flash", label: "Gemini 1.5 Flash" },
      { id: "gemini-1.5-pro", label: "Gemini 1.5 Pro" },
    ],
  },
  openai: {
    id: "openai",
    label: "OpenAI ChatGPT",
    shortLabel: "ChatGPT",
    description: "GPT models via OpenAI",
    brandColor: "#10a37f",
    keyLabel: "OpenAI API key",
    keyHelp: "From platform.openai.com.",
    keyPlaceholder: "sk-...",
    defaultModel: "gpt-4o-mini",
    models: [
      { id: "gpt-4o-mini", label: "GPT-4o mini" },
      { id: "gpt-4o", label: "GPT-4o" },
      { id: "gpt-4.1-mini", label: "GPT-4.1 mini" },
      { id: "gpt-4.1", label: "GPT-4.1" },
      { id: "gpt-5-mini", label: "GPT-5 mini" },
      { id: "gpt-5", label: "GPT-5" },
      { id: "o4-mini", label: "o4-mini" },
    ],
  },
  cursor: {
    id: "cursor",
    label: "Cursor API",
    shortLabel: "Cursor",
    description: "Cloud Agents via the Connect server",
    brandColor: "#f54e00",
    serverKey: true,
    keyLabel: "Cursor API key",
    keyHelp: "Stored only on the Node server.",
    keyPlaceholder: "",
    defaultModel: "composer-2.5",
    models: [
      { id: "composer-2.5", label: "Composer 2.5 Fast" },
      { id: "default", label: "Auto (Composer 2.5 Fast)" },
      { id: "grok-4.6", label: "Cursor Grok 4.6" },
      { id: "grok-4.5", label: "Cursor Grok 4.5" },
      { id: "claude-opus-5", label: "Claude Opus 5" },
      { id: "claude-sonnet-5", label: "Claude Sonnet 5" },
      { id: "claude-sonnet-4-5", label: "Claude Sonnet 4.5" },
      { id: "gpt-5.6-sol", label: "GPT-5.6 Sol" },
      { id: "gpt-5.5", label: "GPT-5.5" },
      { id: "gpt-5.4", label: "GPT-5.4" },
      { id: "gemini-3.1-pro", label: "Gemini 3.1 Pro" },
      { id: "claude-haiku-4-5", label: "Claude Haiku 4.5" },
    ],
  },
};

export const parseApiKeys = (value = "") => [
  ...new Set(String(value).split(",").map((key) => key.trim()).filter(Boolean)),
];

const envKeysFor = (provider) => {
  if (provider === "openai") return String(process.env.REACT_APP_OPENAI_API_KEY || "").trim();
  if (provider === "cursor" || provider === "ollama") return "";
  return String(process.env.REACT_APP_GEMINI_API_KEY || "").trim();
};

let platformDefaults = {
  defaultProvider: "ollama",
  models: {
    ollama: AI_PROVIDERS.ollama.defaultModel,
    gemini: AI_PROVIDERS.gemini.defaultModel,
    openai: AI_PROVIDERS.openai.defaultModel,
    cursor: AI_PROVIDERS.cursor.defaultModel,
  },
  configured: { ollama: true, gemini: false, openai: false, cursor: null },
  enabled: { ollama: true, gemini: true, openai: true, cursor: true },
};

const emptyState = () => ({
  provider: platformDefaults.defaultProvider || "ollama",
  models: { ...platformDefaults.models },
  customModels: { ollama: "", gemini: "", openai: "", cursor: "" },
  keys: { ollama: "", gemini: "", openai: "", cursor: "" },
});

const normalizeProvider = (value) => AI_PROVIDERS[value] ? value : "ollama";

const readStored = () => {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    const base = emptyState();
    return {
      ...base,
      ...parsed,
      provider: normalizeProvider(parsed?.provider),
      models: { ...base.models, ...(parsed?.models || {}) },
      customModels: { ...base.customModels, ...(parsed?.customModels || {}) },
      keys: { ...base.keys, ...(parsed?.keys || {}) },
    };
  } catch {
    return emptyState();
  }
};

const listeners = new Set();
let cursorServerConfigured = null;
let cursorLiveModels = null;
const notify = (settings) => listeners.forEach((listener) => { try { listener(settings); } catch (_) {} });

export const setCursorServerConfigured = (value) => {
  const next = value === null ? null : Boolean(value);
  if (next === cursorServerConfigured) return;
  cursorServerConfigured = next;
  notify(readStored());
};
export const getCursorServerConfigured = () => cursorServerConfigured;
export const setCursorLiveModels = (models = []) => {
  cursorLiveModels = Array.isArray(models) && models.length ? models : null;
  notify(readStored());
};
export const getCursorModelOptions = () => cursorLiveModels?.length ? cursorLiveModels : AI_PROVIDERS.cursor.models;

export const applyPlatformAiDefaults = (payload = {}) => {
  platformDefaults = {
    defaultProvider: payload.defaultProvider || platformDefaults.defaultProvider,
    models: { ...platformDefaults.models, ...(payload.models || {}) },
    configured: { ...platformDefaults.configured, ...(payload.configured || {}) },
    enabled: { ...platformDefaults.enabled, ...(payload.enabled || {}) },
  };
  if (payload.cursor && typeof payload.cursor.configured === "boolean") cursorServerConfigured = payload.cursor.configured;
  notify(readStored());
};

export const getAgentSettings = () => readStored();
export const subscribeAgentSettings = (listener) => { listeners.add(listener); return () => listeners.delete(listener); };

export const saveAgentSettings = (patch = {}) => {
  const current = readStored();
  const next = {
    ...current,
    ...patch,
    models: { ...current.models, ...(patch.models || {}) },
    customModels: { ...current.customModels, ...(patch.customModels || {}) },
    keys: { ...current.keys, ...(patch.keys || {}) },
  };
  next.provider = normalizeProvider(next.provider);
  if (typeof window !== "undefined") window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  notify(next);
  return next;
};

export const resetAgentSettings = () => {
  if (typeof window !== "undefined") window.localStorage.removeItem(STORAGE_KEY);
  const next = emptyState();
  notify(next);
  return next;
};

export const getProviderMeta = (providerId) => AI_PROVIDERS[normalizeProvider(providerId)];

export const resolveModelId = (settings = getAgentSettings()) => {
  const provider = normalizeProvider(settings.provider);
  const meta = getProviderMeta(provider);
  const selected = String(settings.models?.[provider] || "").trim();
  const catalog = provider === "cursor" ? getCursorModelOptions() : meta.models;
  if (provider === "cursor") {
    const legacy = { auto: "default", "composer-2": "composer-2.5", "claude-4-sonnet-thinking": "claude-sonnet-4-5", "gpt-5": "gpt-5.4" };
    const mapped = legacy[selected] || selected;
    const match = catalog.find((item) => item.id === mapped || item.id === selected);
    if (match) return match.id;
  }
  if (selected === CUSTOM_MODEL_ID || (selected && !catalog.some((item) => item.id === selected))) {
    return String(settings.customModels?.[provider] || selected || "").trim() || meta.defaultModel;
  }
  return selected || meta.defaultModel;
};

export const getResolvedAgentSettings = () => {
  const stored = getAgentSettings();
  const provider = normalizeProvider(stored.provider);
  const meta = getProviderMeta(provider);
  const model = resolveModelId(stored);
  const providerEnabled = platformDefaults.enabled?.[provider] !== false;
  if (provider === "cursor") {
    return { provider, meta, model, apiKey: "", apiKeys: [], usingUserKey: false, hasKey: cursorServerConfigured !== false && providerEnabled, keySource: "admin", cursorServerConfigured, providerEnabled, baseUrl: "", stored };
  }
  if (provider === "ollama") {
    return { provider, meta, model, apiKey: "", apiKeys: [], usingUserKey: false, hasKey: providerEnabled, keySource: "local", providerEnabled, baseUrl: "", stored };
  }
  const userKey = String(stored.keys?.[provider] || "").trim();
  const envKey = envKeysFor(provider);
  const apiKey = userKey || envKey;
  const platformConfigured = Boolean(platformDefaults.configured?.[provider]);
  return { provider, meta, model, apiKey, apiKeys: parseApiKeys(apiKey), usingUserKey: Boolean(userKey), hasKey: (Boolean(apiKey) || platformConfigured) && providerEnabled, keySource: userKey ? "user" : envKey ? "env" : platformConfigured ? "admin" : "none", providerEnabled, baseUrl: "", stored };
};

export const hasConfiguredApiKey = () => getResolvedAgentSettings().hasKey;
export const maskSecret = (value = "") => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= 8) return "••••";
  return `${text.slice(0, 4)}…${text.slice(-4)}`;
};

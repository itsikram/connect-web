const STORAGE_KEY = "connect_ai_agent_settings_v1";

export const CUSTOM_MODEL_ID = "__custom__";

export const AI_PROVIDERS = {
  gemini: {
    id: "gemini",
    label: "Google Gemini",
    shortLabel: "Gemini",
    description: "Google’s Gemini models",
    brandColor: "#4285f4",
    keyLabel: "Gemini API key",
    keyHelp:
      "From Google AI Studio. You can paste several keys separated by commas for quota failover.",
    keyPlaceholder: "AIza… or AQ.…",
    defaultModel: "gemini-3.5-flash",
    models: [
      { id: "gemini-3.5-flash", label: "Gemini 3.5 Flash" },
      { id: "gemini-2.5-flash", label: "Gemini 2.5 Flash" },
      { id: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
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
    keyHelp: "From platform.openai.com → API keys. Starts with sk-.",
    keyPlaceholder: "sk-…",
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
    keyHelp:
      "Stored only on the Node server as CURSOR_API_KEY (Cursor Dashboard → API Keys, starts with crsr_). The browser never sends this key.",
    keyPlaceholder: "",
    defaultModel: "default",
    models: [
      { id: "default", label: "Auto" },
      { id: "composer-2.5", label: "Composer 2.5" },
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
  ...new Set(
    String(value)
      .split(",")
      .map((key) => key.trim())
      .filter(Boolean),
  ),
];

const envKeysFor = (provider) => {
  if (provider === "openai") {
    return String(process.env.REACT_APP_OPENAI_API_KEY || "").trim();
  }
  if (provider === "cursor") {
    return "";
  }
  return String(process.env.REACT_APP_GEMINI_API_KEY || "").trim();
};

const emptyState = () => ({
  provider: "gemini",
  models: {
    gemini: AI_PROVIDERS.gemini.defaultModel,
    openai: AI_PROVIDERS.openai.defaultModel,
    cursor: AI_PROVIDERS.cursor.defaultModel,
  },
  customModels: {
    gemini: "",
    openai: "",
    cursor: "",
  },
  keys: {
    gemini: "",
    openai: "",
    cursor: "",
  },
});

const normalizeProvider = (value) =>
  AI_PROVIDERS[value] ? value : "gemini";

const readStored = () => {
  if (typeof window === "undefined") return emptyState();
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return emptyState();
    const parsed = JSON.parse(raw);
    const base = emptyState();
    const provider = normalizeProvider(parsed?.provider);
    return {
      ...base,
      ...parsed,
      provider,
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

const CURSOR_LEGACY_MODELS = {
  auto: "default",
  "composer-2": "composer-2.5",
  "claude-4-sonnet-thinking": "claude-sonnet-4-5",
  "gpt-5": "gpt-5.4",
};

const notify = (settings) => {
  listeners.forEach((listener) => {
    try {
      listener(settings);
    } catch (_) {}
  });
};

export const setCursorServerConfigured = (value) => {
  const next = value === null ? null : Boolean(value);
  if (next === cursorServerConfigured) return;
  cursorServerConfigured = next;
  notify(readStored());
};

export const getCursorServerConfigured = () => cursorServerConfigured;

export const setCursorLiveModels = (models = []) => {
  const next = Array.isArray(models)
    ? models
        .map((item) => ({
          id: String(item?.id || "").trim(),
          label: String(item?.label || item?.displayName || item?.id || "").trim(),
          aliases: Array.isArray(item?.aliases) ? item.aliases : [],
        }))
        .filter((item) => item.id)
    : [];
  cursorLiveModels = next.length ? next : null;
  notify(readStored());
};

export const getCursorModelOptions = () =>
  cursorLiveModels?.length ? cursorLiveModels : AI_PROVIDERS.cursor.models;

export const getAgentSettings = () => readStored();

export const subscribeAgentSettings = (listener) => {
  listeners.add(listener);
  return () => listeners.delete(listener);
};

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
  if (typeof window !== "undefined") {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
  }
  notify(next);
  return next;
};

export const resetAgentSettings = () => {
  if (typeof window !== "undefined") {
    window.localStorage.removeItem(STORAGE_KEY);
  }
  const next = emptyState();
  notify(next);
  return next;
};

export const getProviderMeta = (providerId) =>
  AI_PROVIDERS[normalizeProvider(providerId)];

export const resolveModelId = (settings = getAgentSettings()) => {
  const provider = normalizeProvider(settings.provider);
  const meta = getProviderMeta(provider);
  const selected = String(settings.models?.[provider] || "").trim();
  const catalog =
    provider === "cursor" ? getCursorModelOptions() : meta.models;

  if (provider === "cursor") {
    const mapped = CURSOR_LEGACY_MODELS[selected] || selected;
    const match = catalog.find(
      (item) =>
        item.id === mapped ||
        item.id === selected ||
        (item.aliases || []).includes(selected) ||
        (item.aliases || []).includes(mapped),
    );
    if (match) return match.id;
    if (selected === CUSTOM_MODEL_ID) {
      return (
        String(settings.customModels?.[provider] || "").trim() ||
        meta.defaultModel
      );
    }
    if (selected && !catalog.some((item) => item.id === selected)) {
      return (
        String(settings.customModels?.[provider] || selected || "").trim() ||
        meta.defaultModel
      );
    }
    return match?.id || mapped || meta.defaultModel;
  }

  if (selected === CUSTOM_MODEL_ID || (selected && !catalog.some((item) => item.id === selected))) {
    return (
      String(settings.customModels?.[provider] || selected || "").trim() ||
      meta.defaultModel
    );
  }
  return selected || meta.defaultModel;
};

export const getResolvedAgentSettings = () => {
  const stored = getAgentSettings();
  const provider = normalizeProvider(stored.provider);
  const meta = getProviderMeta(provider);
  const model = resolveModelId(stored);

  if (provider === "cursor") {
    return {
      provider,
      meta,
      model,
      apiKey: "",
      apiKeys: [],
      usingUserKey: false,
      hasKey: cursorServerConfigured !== false,
      keySource: "server",
      cursorServerConfigured,
      baseUrl: "",
      stored,
    };
  }

  const userKey = String(stored.keys?.[provider] || "").trim();
  const envKey = envKeysFor(provider);
  const apiKey = userKey || envKey;

  return {
    provider,
    meta,
    model,
    apiKey,
    apiKeys: parseApiKeys(apiKey),
    usingUserKey: Boolean(userKey),
    hasKey: Boolean(apiKey),
    keySource: userKey ? "user" : envKey ? "env" : "none",
    baseUrl: "",
    stored,
  };
};

export const hasConfiguredApiKey = () => getResolvedAgentSettings().hasKey;

export const maskSecret = (value = "") => {
  const text = String(value || "").trim();
  if (!text) return "";
  if (text.length <= 8) return "••••";
  return `${text.slice(0, 4)}…${text.slice(-4)}`;
};

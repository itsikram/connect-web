import {
  getResolvedAgentSettings,
  getCursorServerConfigured,
  setCursorServerConfigured,
  setCursorLiveModels,
  applyPlatformAiDefaults,
} from "./aiAgentSettings";

const extractGeminiText = (data) =>
  data?.candidates?.[0]?.content?.parts
    ?.map((part) => part?.text || "")
    .join("")
    .trim() || "";

export const isGeminiQuotaError = (status, data) => {
  const apiStatus = String(data?.error?.status || "").toUpperCase();
  const message = String(data?.error?.message || "").toLowerCase();
  return (
    status === 429 ||
    apiStatus === "RESOURCE_EXHAUSTED" ||
    message.includes("quota") ||
    message.includes("rate limit") ||
    message.includes("resource exhausted")
  );
};

let activeGeminiKeyIndex = 0;
const GEMINI_FETCH_MS = 20000;

const fetchGemini = async (url, requestBody) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), GEMINI_FETCH_MS);
  try {
    return await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(requestBody),
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error("Gemini request timed out");
    }
    throw error;
  } finally {
    clearTimeout(timer);
  }
};

const geminiUrl = (model, apiKey) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:generateContent?key=${encodeURIComponent(apiKey)}`;

const toGeminiContents = (messages = []) => {
  const contents = [];
  let foundFirstUser = false;
  for (const msg of messages) {
    const role = msg.role === "assistant" ? "model" : "user";
    if (!foundFirstUser && role !== "user") continue;
    foundFirstUser = true;
    const text = typeof msg.content === "string" ? msg.content : "";
    if (!text.trim()) continue;
    contents.push({ role, parts: [{ text }] });
  }
  return contents;
};

const supportsGeminiThinkingOff = (model = "") =>
  /gemini-(2\.5|3)/i.test(String(model));

const withGeminiSpeedConfig = (model, generationConfig) => {
  if (!supportsGeminiThinkingOff(model)) return generationConfig;
  return {
    ...generationConfig,
    thinkingConfig: { thinkingBudget: 0 },
  };
};

const requestGemini = async ({
  model,
  apiKeys,
  requestBody,
  operationLabel,
}) => {
  if (!apiKeys.length) {
    throw new Error("Gemini API key is not configured");
  }

  let lastError = null;
  const startingKeyIndex = activeGeminiKeyIndex;

  for (let attempt = 0; attempt < apiKeys.length; attempt += 1) {
    const keyIndex = (startingKeyIndex + attempt) % apiKeys.length;
    const apiKey = apiKeys[keyIndex];
    const response = await fetchGemini(geminiUrl(model, apiKey), requestBody);

    const data = await response.json().catch(() => null);
    if (response.ok) {
      activeGeminiKeyIndex = keyIndex;
      return data;
    }

    if (
      response.status === 400 &&
      requestBody?.generationConfig?.thinkingConfig
    ) {
      delete requestBody.generationConfig.thinkingConfig;
      const retry = await fetchGemini(geminiUrl(model, apiKey), requestBody);
      const retryData = await retry.json().catch(() => null);
      if (retry.ok) {
        activeGeminiKeyIndex = keyIndex;
        return retryData;
      }
    }

    const errorMessage =
      data?.error?.message ||
      `${operationLabel} failed with HTTP ${response.status}`;
    lastError = new Error(errorMessage);

    if (!isGeminiQuotaError(response.status, data)) {
      throw lastError;
    }

    activeGeminiKeyIndex = (keyIndex + 1) % apiKeys.length;
    if (attempt < apiKeys.length - 1) {
      console.warn(
        `[Gemini] ${operationLabel} quota exceeded; trying API key ${attempt + 2} of ${apiKeys.length}.`,
      );
    }
  }

  const quotaSummary = `All ${apiKeys.length} configured Gemini API ${
    apiKeys.length === 1 ? "key has" : "keys have"
  } exceeded quota.`;
  throw new Error(
    lastError?.message
      ? `${quotaSummary} Last error: ${lastError.message}`
      : quotaSummary,
  );
};

const completeGemini = async ({
  settings,
  system,
  messages,
  json,
  temperature,
  maxTokens,
  operationLabel,
}) => {
  const requestBody = {
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    contents: toGeminiContents(messages),
    generationConfig: withGeminiSpeedConfig(settings.model, {
      temperature,
      topK: json ? 8 : 16,
      topP: json ? 0.7 : 0.85,
      maxOutputTokens: json ? Math.min(maxTokens, 256) : Math.min(maxTokens, 320),
      candidateCount: 1,
      ...(json ? { responseMimeType: "application/json" } : {}),
    }),
  };

  let data;
  try {
    data = await requestGemini({
      model: settings.model,
      apiKeys: settings.apiKeys,
      requestBody,
      operationLabel,
    });
  } catch (error) {
    if (!json) throw error;
    const fallbackBody = {
      ...requestBody,
      generationConfig: withGeminiSpeedConfig(settings.model, {
        temperature,
        topK: json ? 8 : 16,
        topP: json ? 0.7 : 0.85,
        maxOutputTokens: json ? Math.min(maxTokens, 256) : Math.min(maxTokens, 320),
        candidateCount: 1,
      }),
    };
    data = await requestGemini({
      model: settings.model,
      apiKeys: settings.apiKeys,
      requestBody: fallbackBody,
      operationLabel,
    });
  }

  const text = extractGeminiText(data);
  if (!text) {
    throw new Error(`${operationLabel} returned an empty response`);
  }
  return text;
};

let apiClientPromise = null;
const getApiClient = () => {
  if (!apiClientPromise) {
    apiClientPromise = import("../api/api").then((mod) => mod.default);
  }
  return apiClientPromise;
};

const completeViaServer = async ({
  settings,
  system,
  messages,
  json,
  temperature,
  maxTokens,
}) => {
  try {
    const api = await getApiClient();
    const payload = {
      provider: settings.provider,
      model: settings.model,
      system,
      messages,
      json,
      temperature,
      maxTokens,
    };
    if (settings.provider === "openai" && settings.usingUserKey && settings.apiKey) {
      payload.apiKey = settings.apiKey;
    }
    if (settings.provider === "gemini" && settings.usingUserKey && settings.apiKey) {
      payload.apiKey = settings.apiKey;
    }
    const timeout = settings.provider === "cursor" ? 120000 : 20000;
    const response = await api.post("/ai-chat/complete", payload, {
      timeout,
    });
    const text = String(response.data?.text || "").trim();
    if (!text) {
      throw new Error(
        response.data?.message || "The provider returned an empty reply",
      );
    }
    return text;
  } catch (error) {
    throw new Error(
      error.response?.data?.message ||
        error.message ||
        `${settings.meta.shortLabel} request failed`,
    );
  }
};

export const fetchAiProviderStatus = async () => {
  try {
    const { default: api } = await import("../api/api");
    const response = await api.get("/ai-chat/providers");
    applyPlatformAiDefaults(response.data || {});
    if (typeof response.data?.cursor?.configured === "boolean") {
      setCursorServerConfigured(response.data.cursor.configured);
    }
    if (Array.isArray(response.data?.cursor?.models)) {
      setCursorLiveModels(response.data.cursor.models);
    }
    return response.data;
  } catch (_) {
    return {
      cursor: { configured: getCursorServerConfigured() === true },
    };
  }
};

export const completeChat = async ({
  system = "",
  messages = [],
  json = false,
  temperature = 0.7,
  maxTokens = 1024,
  operationLabel = "AI request",
} = {}) => {
  const settings = getResolvedAgentSettings();
  if (!settings.hasKey) {
    throw new Error(
      `No API key configured for ${settings.meta.shortLabel}. Add it in Connect Admin → Settings → AI, or paste a personal key here.`,
    );
  }
  if (settings.providerEnabled === false) {
    throw new Error(
      `${settings.meta.shortLabel} is disabled in Connect Admin AI settings.`,
    );
  }

  if (settings.provider === "gemini" && settings.apiKey) {
    return completeGemini({
      settings,
      system,
      messages,
      json,
      temperature,
      maxTokens,
      operationLabel,
    });
  }

  return completeViaServer({
    settings,
    system,
    messages,
    json,
    temperature,
    maxTokens,
  });
};

export const pingCurrentProvider = async () => {
  const settings = getResolvedAgentSettings();
  const text = await completeChat({
    system: "Reply with the single word OK.",
    messages: [{ role: "user", content: "ping" }],
    temperature: 0,
    maxTokens: 16,
    operationLabel: "Connection test",
  });
  return {
    ok: true,
    provider: settings.meta.shortLabel,
    model: settings.model,
    reply: text.slice(0, 120),
  };
};

export { extractGeminiText };

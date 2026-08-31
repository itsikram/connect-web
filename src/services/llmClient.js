import {
  getResolvedAgentSettings,
  getCursorServerConfigured,
  setCursorServerConfigured,
  setCursorLiveModels,
  applyPlatformAiDefaults,
} from "./aiAgentSettings";

const extractGeminiText = (data, { trim = true } = {}) => {
  const text =
    data?.candidates?.[0]?.content?.parts
      ?.map((part) => part?.text || "")
      .join("") || "";
  return trim ? text.trim() : text;
};

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
const GEMINI_FETCH_MS = 16000;
const GEMINI_JSON_MS = 8000;

const geminiOutputCap = (json, maxTokens) =>
  json ? Math.min(maxTokens, 128) : Math.min(maxTokens, 160);

const isGeminiNotFound = (status, data) => {
  if (status === 404) return true;
  const message = String(data?.error?.message || "").toLowerCase();
  return (
    message.includes("not found") ||
    message.includes("unknown model") ||
    message.includes("is not supported")
  );
};

const fetchGemini = async (url, requestBody, timeoutMs = GEMINI_FETCH_MS) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
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
  /gemini-(2\.5|3)/i.test(String(model)) && !/lite/i.test(String(model));

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
  timeoutMs = GEMINI_FETCH_MS,
}) => {
  if (!apiKeys.length) {
    throw new Error("Gemini API key is not configured");
  }

  let lastError = null;
  const startingKeyIndex = activeGeminiKeyIndex;

  for (let attempt = 0; attempt < apiKeys.length; attempt += 1) {
    const keyIndex = (startingKeyIndex + attempt) % apiKeys.length;
    const apiKey = apiKeys[keyIndex];
    const response = await fetchGemini(
      geminiUrl(model, apiKey),
      requestBody,
      timeoutMs,
    );

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
      const retry = await fetchGemini(
        geminiUrl(model, apiKey),
        requestBody,
        timeoutMs,
      );
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
  timeoutMs,
}) => {
  const requestBody = {
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    contents: toGeminiContents(messages),
    generationConfig: withGeminiSpeedConfig(settings.model, {
      temperature,
      topK: json ? 4 : 12,
      topP: json ? 0.6 : 0.8,
      maxOutputTokens: geminiOutputCap(json, maxTokens),
      candidateCount: 1,
      ...(json ? { responseMimeType: "application/json" } : {}),
    }),
  };

  const requestTimeout = timeoutMs || (json ? GEMINI_JSON_MS : GEMINI_FETCH_MS);

  let data;
  try {
    data = await requestGemini({
      model: settings.model,
      apiKeys: settings.apiKeys,
      requestBody,
      operationLabel,
      timeoutMs: requestTimeout,
    });
  } catch (error) {
    if (!json) throw error;
    const fallbackBody = {
      ...requestBody,
      generationConfig: withGeminiSpeedConfig(settings.model, {
        temperature,
        topK: json ? 4 : 12,
        topP: json ? 0.6 : 0.8,
        maxOutputTokens: geminiOutputCap(json, maxTokens),
        candidateCount: 1,
      }),
    };
    data = await requestGemini({
      model: settings.model,
      apiKeys: settings.apiKeys,
      requestBody: fallbackBody,
      operationLabel,
      timeoutMs: requestTimeout,
    });
  }

  const text = extractGeminiText(data);
  if (!text) {
    throw new Error(`${operationLabel} returned an empty response`);
  }
  return text;
};

const geminiStreamUrl = (model, apiKey) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
    model,
  )}:streamGenerateContent?alt=sse&key=${encodeURIComponent(apiKey)}`;

const parseSseBlock = (block = "") => {
  const dataLines = [];
  for (const line of String(block).split(/\r?\n/)) {
    if (line.startsWith("data:")) dataLines.push(line.slice(5).trimStart());
  }
  return dataLines.join("\n");
};

const emitSsePayload = (raw, onData) => {
  if (!raw || raw === "[DONE]") return;
  try {
    onData(JSON.parse(raw));
  } catch {
    onData({ text: raw });
  }
};

const readSseStream = async (response, onData) => {
  if (!response?.body || typeof response.body.getReader !== "function") {
    const text = await response.text();
    if (text) emitSsePayload(text, onData);
    return;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { value, done } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    let boundary = buffer.search(/\r?\n\r?\n/);
    while (boundary !== -1) {
      const block = buffer.slice(0, boundary);
      buffer = buffer.slice(boundary).replace(/^\r?\n\r?\n/, "");
      emitSsePayload(parseSseBlock(block), onData);
      boundary = buffer.search(/\r?\n\r?\n/);
    }

    const lastNl = buffer.lastIndexOf("\n");
    if (lastNl < 0) continue;
    const head = buffer.slice(0, lastNl + 1);
    const tail = buffer.slice(lastNl + 1);
    const remain = [];
    const lines = head.split(/\r?\n/);
    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line) continue;
      if (!line.startsWith("data:")) {
        remain.push(line);
        continue;
      }
      const raw = line.slice(5).trimStart();
      if (!raw || raw === "[DONE]") continue;
      try {
        onData(JSON.parse(raw));
      } catch {
        remain.push(line);
      }
    }
    buffer = remain.length ? `${remain.join("\n")}\n${tail}` : tail;
  }

  emitSsePayload(parseSseBlock(buffer), onData);
};

const withAbortTimeout = (userSignal, timeoutMs) => {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  const abort = () => controller.abort();
  if (userSignal) {
    if (userSignal.aborted) abort();
    else userSignal.addEventListener("abort", abort, { once: true });
  }
  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timer);
      if (userSignal) userSignal.removeEventListener("abort", abort);
    },
  };
};

const streamGemini = async ({
  settings,
  system,
  messages,
  json,
  temperature,
  maxTokens,
  operationLabel,
  onDelta,
  signal,
  timeoutMs,
}) => {
  if (!settings.apiKeys.length) {
    throw new Error("Gemini API key is not configured");
  }

  const buildBody = (includeThinking) => ({
    systemInstruction: system ? { parts: [{ text: system }] } : undefined,
    contents: toGeminiContents(messages),
    generationConfig: {
      temperature,
      topK: json ? 4 : 12,
      topP: json ? 0.6 : 0.8,
      maxOutputTokens: geminiOutputCap(json, maxTokens),
      candidateCount: 1,
      ...(json ? { responseMimeType: "application/json" } : {}),
      ...(includeThinking && supportsGeminiThinkingOff(settings.model)
        ? { thinkingConfig: { thinkingBudget: 0 } }
        : {}),
    },
  });

  const { signal: fetchSignal, cleanup } = withAbortTimeout(
    signal,
    timeoutMs || (json ? GEMINI_JSON_MS : GEMINI_FETCH_MS),
  );
  let lastError = null;
  const startingKeyIndex = activeGeminiKeyIndex;

  try {
    for (let attempt = 0; attempt < settings.apiKeys.length; attempt += 1) {
      const keyIndex = (startingKeyIndex + attempt) % settings.apiKeys.length;
      const apiKey = settings.apiKeys[keyIndex];
      let modelId = settings.model;
      let requestBody = buildBody(true);

      let response = await fetch(geminiStreamUrl(modelId, apiKey), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
        signal: fetchSignal,
      });

      if (
        response.status === 400 &&
        requestBody.generationConfig?.thinkingConfig
      ) {
        requestBody = buildBody(false);
        response = await fetch(geminiStreamUrl(modelId, apiKey), {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(requestBody),
          signal: fetchSignal,
        });
      }

      if (!response.ok) {
        const data = await response.json().catch(() => null);
        lastError = new Error(
          data?.error?.message ||
            `${operationLabel} failed with HTTP ${response.status}`,
        );
        if (
          isGeminiNotFound(response.status, data) &&
          modelId !== "gemini-2.0-flash"
        ) {
          response = await fetch(geminiStreamUrl("gemini-2.0-flash", apiKey), {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(requestBody),
            signal: fetchSignal,
          });
          if (!response.ok) {
            const retryData = await response.json().catch(() => null);
            lastError = new Error(
              retryData?.error?.message || lastError.message,
            );
            if (!isGeminiQuotaError(response.status, retryData)) throw lastError;
            activeGeminiKeyIndex = (keyIndex + 1) % settings.apiKeys.length;
            continue;
          }
        } else if (!isGeminiQuotaError(response.status, data)) {
          throw lastError;
        } else {
          activeGeminiKeyIndex = (keyIndex + 1) % settings.apiKeys.length;
          continue;
        }
      }

      activeGeminiKeyIndex = keyIndex;
      const canStream =
        response.body && typeof response.body.getReader === "function";
      if (!canStream) {
        const data = await response.json().catch(() => null);
        const text = extractGeminiText(data);
        if (!text) {
          throw new Error(`${operationLabel} returned an empty response`);
        }
        onDelta?.(text);
        return text;
      }

      let text = "";
      let streamError = null;
      await readSseStream(response, (payload) => {
        if (payload?.error?.message) {
          streamError = new Error(payload.error.message);
          return;
        }
        const chunk =
          extractGeminiText(payload, { trim: false }) ||
          (typeof payload?.text === "string" ? payload.text : "");
        if (!chunk) return;
        text += chunk;
        onDelta?.(text);
      });
      if (streamError) throw streamError;
      if (!text.trim()) {
        throw new Error(`${operationLabel} returned an empty response`);
      }
      return text;
    }
  } finally {
    cleanup();
  }

  const quotaSummary = `All ${settings.apiKeys.length} configured Gemini API ${
    settings.apiKeys.length === 1 ? "key has" : "keys have"
  } exceeded quota.`;
  throw new Error(
    lastError?.message
      ? `${quotaSummary} Last error: ${lastError.message}`
      : quotaSummary,
  );
};

let apiClientPromise = null;
const getApiClient = () => {
  if (!apiClientPromise) {
    apiClientPromise = import("../api/api").then((mod) => mod.default);
  }
  return apiClientPromise;
};

let streamHelpersPromise = null;
const getStreamHelpers = () => {
  if (!streamHelpersPromise) {
    streamHelpersPromise = Promise.all([
      import("../utils/storageUtils"),
      import("../utils/offlineUtils"),
    ]);
  }
  return streamHelpersPromise;
};

let geminiPreconnected = false;
const preconnectGemini = () => {
  if (geminiPreconnected || typeof document === "undefined") return;
  geminiPreconnected = true;
  const dns = document.createElement("link");
  dns.rel = "dns-prefetch";
  dns.href = "https://generativelanguage.googleapis.com";
  document.head.appendChild(dns);
  const link = document.createElement("link");
  link.rel = "preconnect";
  link.href = "https://generativelanguage.googleapis.com";
  link.crossOrigin = "anonymous";
  document.head.appendChild(link);
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
    const timeout = settings.provider === "cursor" ? 90000 : json ? 10000 : 16000;
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

const streamViaServer = async ({
  settings,
  system,
  messages,
  json,
  temperature,
  maxTokens,
  onDelta,
  signal,
}) => {
  const [{ getUserFromStorage }, { getServerAddress }] = await getStreamHelpers();
  const token = getUserFromStorage()?.accessToken || "";
  const timeoutMs = settings.provider === "cursor" ? 90000 : json ? 10000 : 18000;
  const { signal: fetchSignal, cleanup } = withAbortTimeout(signal, timeoutMs);

  try {
    const payload = {
      provider: settings.provider,
      model: settings.model,
      system,
      messages,
      json,
      temperature,
      maxTokens,
    };
    if (
      (settings.provider === "openai" || settings.provider === "gemini") &&
      settings.usingUserKey &&
      settings.apiKey
    ) {
      payload.apiKey = settings.apiKey;
    }

    const response = await fetch(
      `${getServerAddress()}/api/ai-chat/complete-stream`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Accept: "text/event-stream",
          Authorization: token,
        },
        body: JSON.stringify(payload),
        signal: fetchSignal,
      },
    );

    if (!response.ok) {
      const data = await response.json().catch(() => null);
      throw new Error(
        data?.message ||
          `${settings.meta.shortLabel} stream failed with HTTP ${response.status}`,
      );
    }

    let text = "";
    let streamError = null;
    await readSseStream(response, (payloadEvent) => {
      if (payloadEvent?.error) {
        streamError = new Error(String(payloadEvent.error));
        return;
      }
      if (typeof payloadEvent?.text === "string") {
        text = payloadEvent.text;
        onDelta?.(text);
      }
    });
    if (streamError && !text.trim()) throw streamError;
    if (!text.trim()) {
      throw new Error("The provider returned an empty reply");
    }
    return text;
  } catch (error) {
    if (error?.name === "AbortError" || signal?.aborted || fetchSignal.aborted) {
      throw error;
    }
    if (settings.provider === "cursor") throw error;
    if (/quota|resource exhausted|rate limit|timed out/i.test(String(error?.message || ""))) {
      throw error;
    }
    const fallback = await completeViaServer({
      settings,
      system,
      messages,
      json,
      temperature,
      maxTokens,
    });
    onDelta?.(fallback);
    return fallback;
  } finally {
    cleanup();
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

export const warmupCursorProvider = async () => {
  try {
    const settings = getResolvedAgentSettings();
    if (settings.provider === "gemini") {
      preconnectGemini();
      getStreamHelpers().catch(() => {});
      const key = String(settings.apiKeys?.[0] || settings.apiKey)
        .split(",")[0]
        .trim();
      if (!key) return;
      fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(
          settings.model,
        )}?key=${encodeURIComponent(key)}`,
        { method: "GET" },
      ).catch(() => {});
      return;
    }
    getStreamHelpers().catch(() => {});
    if (settings.provider !== "cursor") return;
    const api = await getApiClient();
    await api.post(
      "/ai-chat/warmup",
      { model: settings.model },
      { timeout: 8000 },
    );
  } catch (_) {}
};

const assertProviderReady = () => {
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
  return settings;
};

export const completeChat = async ({
  system = "",
  messages = [],
  json = false,
  temperature = 0.7,
  maxTokens = 1024,
  operationLabel = "AI request",
  timeoutMs,
} = {}) => {
  const settings = assertProviderReady();

  if (settings.provider === "gemini" && settings.apiKey) {
    return completeGemini({
      settings,
      system,
      messages,
      json,
      temperature,
      maxTokens,
      operationLabel,
      timeoutMs,
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

export const streamChat = async ({
  system = "",
  messages = [],
  json = false,
  temperature = 0.7,
  maxTokens = 1024,
  operationLabel = "AI request",
  onDelta,
  signal,
  timeoutMs,
} = {}) => {
  const settings = assertProviderReady();

  if (settings.provider === "gemini" && settings.apiKey) {
    try {
      return await streamGemini({
        settings,
        system,
        messages,
        json,
        temperature,
        maxTokens,
        operationLabel,
        onDelta,
        signal,
        timeoutMs,
      });
    } catch (error) {
      if (error?.name === "AbortError" || signal?.aborted) throw error;
      if (
        json ||
        /quota|resource exhausted|rate limit|timed out/i.test(
          String(error?.message || ""),
        )
      ) {
        throw error;
      }
      const text = await completeGemini({
        settings,
        system,
        messages,
        json,
        temperature,
        maxTokens,
        operationLabel,
        timeoutMs,
      });
      onDelta?.(text);
      return text;
    }
  }

  return streamViaServer({
    settings,
    system,
    messages,
    json,
    temperature,
    maxTokens,
    onDelta,
    signal,
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

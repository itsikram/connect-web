import React, { useEffect, useMemo, useState } from "react";
import {
  AI_PROVIDERS,
  CUSTOM_MODEL_ID,
  getAgentSettings,
  getCursorModelOptions,
  getResolvedAgentSettings,
  resetAgentSettings,
  saveAgentSettings,
  subscribeAgentSettings,
} from "../../../services/aiAgentSettings";
import {
  fetchAiProviderStatus,
  pingCurrentProvider,
} from "../../../services/llmClient";

const PROVIDER_ORDER = ["gemini", "openai", "cursor"];

const AgentSettingsPanel = ({ onClose }) => {
  const [draft, setDraft] = useState(() => getAgentSettings());
  const [resolved, setResolved] = useState(() => getResolvedAgentSettings());
  const [showKey, setShowKey] = useState(false);
  const [testState, setTestState] = useState({ status: "idle", message: "" });
  const [savedFlash, setSavedFlash] = useState(false);

  useEffect(() => {
    fetchAiProviderStatus();
    return subscribeAgentSettings(() => {
      setResolved(getResolvedAgentSettings());
    });
  }, []);

  const provider = draft.provider;
  const meta = AI_PROVIDERS[provider];
  const modelOptions =
    provider === "cursor" ? getCursorModelOptions() : meta.models;
  const selectedModel = draft.models?.[provider] || meta.defaultModel;
  const isCustomModel =
    selectedModel === CUSTOM_MODEL_ID ||
    !modelOptions.some(
      (item) =>
        item.id === selectedModel ||
        (item.aliases || []).includes(selectedModel),
    );
  const usesServerKey = Boolean(meta.serverKey);

  const apply = (patch) => {
    const next = saveAgentSettings(patch);
    setDraft(next);
    setResolved(getResolvedAgentSettings());
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), 1200);
  };

  const handleProvider = (nextProvider) => {
    apply({ provider: nextProvider });
    setShowKey(false);
    setTestState({ status: "idle", message: "" });
  };

  const handleModel = (value) => {
    apply({
      models: {
        ...draft.models,
        [provider]: value,
      },
    });
  };

  const handleCustomModel = (value) => {
    apply({
      models: {
        ...draft.models,
        [provider]: CUSTOM_MODEL_ID,
      },
      customModels: {
        ...draft.customModels,
        [provider]: value,
      },
    });
  };

  const handleKey = (value) => {
    apply({
      keys: {
        ...draft.keys,
        [provider]: value,
      },
    });
  };

  const handleTest = async () => {
    setTestState({
      status: "loading",
      message:
        provider === "cursor"
          ? "Starting a Cursor cloud agent — this can take up to 2 minutes…"
          : "Testing connection…",
    });
    try {
      const result = await pingCurrentProvider();
      setTestState({
        status: "ok",
        message: `${result.provider} · ${result.model} replied.`,
      });
    } catch (error) {
      setTestState({
        status: "error",
        message: error.message || "Connection failed",
      });
    }
  };

  const handleReset = () => {
    const next = resetAgentSettings();
    setDraft(next);
    setResolved(getResolvedAgentSettings());
    setTestState({ status: "idle", message: "" });
  };

  const keyHint = useMemo(() => {
    if (resolved.keySource === "admin" || resolved.keySource === "server") {
      if (resolved.hasKey) {
        return "Using the key saved in Connect Admin → Settings → AI";
      }
      return "No key yet — add it in Connect Admin → Settings → AI";
    }
    if (resolved.usingUserKey) return "Using your key from these settings";
    if (resolved.keySource === "env") return "Using the app default key";
    return "No key yet — paste one here or set it in Connect Admin";
  }, [resolved.hasKey, resolved.keySource, resolved.usingUserKey]);

  const testDisabled =
    testState.status === "loading" || !resolved.hasKey;

  return (
    <div className="ai-agent-settings" role="dialog" aria-label="AI Agent settings">
      <div className="ai-agent-settings-header">
        <div>
          <h3>AI settings</h3>
          <p>Provider, model, and keys apply to every agent request immediately.</p>
        </div>
        <button
          type="button"
          className="ai-agent-settings-close"
          onClick={onClose}
          aria-label="Close settings"
        >
          <i className="fas fa-times" />
        </button>
      </div>

      <div className="ai-agent-settings-body">
        <div className="ai-agent-settings-live">
          <span
            className={`ai-agent-settings-live-dot ${resolved.hasKey ? "ok" : "warn"}`}
          />
          <span>
            Active: <strong>{resolved.meta.shortLabel}</strong>
            <span className="ai-agent-settings-live-model"> · {resolved.model}</span>
          </span>
          {savedFlash && <em className="ai-agent-settings-saved">Saved</em>}
        </div>

        <label className="ai-agent-settings-label">Provider</label>
        <div className="ai-agent-provider-grid">
          {PROVIDER_ORDER.map((id) => {
            const item = AI_PROVIDERS[id];
            const active = provider === id;
            return (
              <button
                key={id}
                type="button"
                className={`ai-agent-provider-card ${active ? "active" : ""}`}
                style={{ "--provider-color": item.brandColor }}
                onClick={() => handleProvider(id)}
              >
                <span className="ai-agent-provider-mark">
                  {item.shortLabel.slice(0, 1)}
                </span>
                <span className="ai-agent-provider-copy">
                  <strong>{item.label}</strong>
                  <small>{item.description}</small>
                </span>
              </button>
            );
          })}
        </div>

        <label className="ai-agent-settings-label" htmlFor="ai-agent-model">
          Model
        </label>
        <select
          id="ai-agent-model"
          className="ai-agent-settings-select"
          value={
            isCustomModel
              ? CUSTOM_MODEL_ID
              : modelOptions.find(
                  (item) =>
                    item.id === selectedModel ||
                    (item.aliases || []).includes(selectedModel),
                )?.id || selectedModel
          }
          onChange={(event) => handleModel(event.target.value)}
        >
          {modelOptions.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
          <option value={CUSTOM_MODEL_ID}>Custom model ID…</option>
        </select>
        {isCustomModel && (
          <input
            className="ai-agent-settings-input"
            value={draft.customModels?.[provider] || ""}
            onChange={(event) => handleCustomModel(event.target.value)}
            placeholder="Exact model id from GET /v1/models"
            autoComplete="off"
          />
        )}

        {usesServerKey ? (
          <div
            className={`ai-agent-settings-server-key ${
              resolved.cursorServerConfigured === false ? "missing" : ""
            }`}
          >
            <strong>Admin-managed Cursor key</strong>
            <p>
              React never talks to Cursor. The Express backend uses the Cursor
              key saved in Connect Admin → Settings → AI.
            </p>
            <p>{keyHint}.</p>
            <p>
              Connect chat uses a no-repo Composer 2.5 Fast agent and reuses it
              for later messages in the same session.
            </p>
          </div>
        ) : (
          <>
            <label className="ai-agent-settings-label" htmlFor="ai-agent-key">
              {meta.keyLabel}
            </label>
            <div className="ai-agent-settings-key-row">
              <input
                id="ai-agent-key"
                className="ai-agent-settings-input"
                type={showKey ? "text" : "password"}
                value={draft.keys?.[provider] || ""}
                onChange={(event) => handleKey(event.target.value)}
            placeholder={
              (resolved.keySource === "env" || resolved.keySource === "admin") &&
              !draft.keys?.[provider]
                ? "Leave blank to use the Admin / default key"
                : meta.keyPlaceholder
            }
                autoComplete="off"
                spellCheck={false}
              />
              <button
                type="button"
                className="ai-agent-settings-icon-btn"
                onClick={() => setShowKey((value) => !value)}
                aria-label={showKey ? "Hide API key" : "Show API key"}
              >
                <i className={`fas ${showKey ? "fa-eye-slash" : "fa-eye"}`} />
              </button>
            </div>
            <p className="ai-agent-settings-help">
              {keyHint}. {meta.keyHelp}
            </p>
          </>
        )}

        {testState.message && (
          <div className={`ai-agent-settings-test ${testState.status}`}>
            {testState.message}
          </div>
        )}
      </div>

      <div className="ai-agent-settings-footer">
        <button
          type="button"
          className="ai-agent-settings-btn ghost"
          onClick={handleReset}
        >
          Use defaults
        </button>
        <button
          type="button"
          className="ai-agent-settings-btn"
          onClick={handleTest}
          disabled={testDisabled}
        >
          {testState.status === "loading" ? "Testing…" : "Test connection"}
        </button>
      </div>
    </div>
  );
};

export default AgentSettingsPanel;

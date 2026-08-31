/**
 * @jest-environment jsdom
 */

const { saveAgentSettings, resetAgentSettings, getResolvedAgentSettings } = require("./aiAgentSettings");

afterEach(() => {
  resetAgentSettings();
});

test("user Gemini key overrides the env key", () => {
  saveAgentSettings({
    provider: "gemini",
    keys: { gemini: "user-gemini-key", openai: "", cursor: "" },
    models: { gemini: "gemini-2.0-flash" },
  });
  const resolved = getResolvedAgentSettings();
  expect(resolved.provider).toBe("gemini");
  expect(resolved.model).toBe("gemini-2.0-flash");
  expect(resolved.apiKey).toBe("user-gemini-key");
  expect(resolved.usingUserKey).toBe(true);
});

test("selecting ChatGPT uses the OpenAI key from settings", () => {
  saveAgentSettings({
    provider: "openai",
    keys: { openai: "sk-test-openai" },
    models: { openai: "gpt-4o" },
  });
  const resolved = getResolvedAgentSettings();
  expect(resolved.provider).toBe("openai");
  expect(resolved.model).toBe("gpt-4o");
  expect(resolved.apiKey).toBe("sk-test-openai");
  expect(resolved.meta.shortLabel).toBe("ChatGPT");
});

test("Cursor never stores an API key in the browser", () => {
  saveAgentSettings({
    provider: "cursor",
    keys: { cursor: "crsr_should_be_ignored" },
    models: { cursor: "composer-2" },
  });
  const resolved = getResolvedAgentSettings();
  expect(resolved.provider).toBe("cursor");
  expect(resolved.apiKey).toBe("");
  expect(resolved.keySource).toBe("admin");
  expect(resolved.model).toBe("composer-2.5");
});

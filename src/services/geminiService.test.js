const originalApiKeys = process.env.REACT_APP_GEMINI_API_KEY;

const quotaResponse = () => ({
  ok: false,
  status: 429,
  json: jest.fn().mockResolvedValue({
    error: {
      status: "RESOURCE_EXHAUSTED",
      message: "Quota exceeded",
    },
  }),
});

const successResponse = () => ({
  ok: true,
  status: 200,
  json: jest.fn().mockResolvedValue({
    candidates: [
      {
        content: {
          parts: [{ text: "Hello from Gemini" }],
        },
      },
    ],
  }),
});

const loadService = (keys) => {
  jest.resetModules();
  process.env.REACT_APP_GEMINI_API_KEY = keys;
  return require("./geminiService");
};

afterEach(() => {
  process.env.REACT_APP_GEMINI_API_KEY = originalApiKeys;
  jest.restoreAllMocks();
  delete global.fetch;
});

test("uses the next configured key when the active key exceeds quota", async () => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce(quotaResponse())
    .mockResolvedValueOnce(successResponse());
  const { sendToGemini } = loadService("first-key, second-key, third-key");

  const result = await sendToGemini("Hello");

  expect(result).toMatchObject({ success: true, response: "Hello from Gemini" });
  expect(global.fetch).toHaveBeenCalledTimes(2);
  expect(global.fetch.mock.calls[0][0]).toContain("key=first-key");
  expect(global.fetch.mock.calls[1][0]).toContain("key=second-key");
});

test("reports how many keys were attempted when every key exceeds quota", async () => {
  jest.spyOn(console, "warn").mockImplementation(() => {});
  global.fetch = jest
    .fn()
    .mockResolvedValueOnce(quotaResponse())
    .mockResolvedValueOnce(quotaResponse())
    .mockResolvedValueOnce(quotaResponse());
  const { sendToGemini } = loadService("first-key,second-key,third-key");

  const result = await sendToGemini("Hello");

  expect(global.fetch).toHaveBeenCalledTimes(3);
  expect(result.success).toBe(false);
  expect(result.response).toContain(
    "All 3 configured Gemini API keys have exceeded quota",
  );
});

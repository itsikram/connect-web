import React from "react";
import { render, screen, fireEvent, act, waitFor, within } from "@testing-library/react";
import { Provider } from "react-redux";
import { configureStore } from "@reduxjs/toolkit";
import { MemoryRouter } from "react-router-dom";

jest.mock("./ConnectResultCard", () => () => null);
jest.mock("./VideoResultCard", () => () => null);
jest.mock("./AgentSettingsPanel", () => () => null);
jest.mock("../../../contexts/AuthContext", () => {
  const ReactLib = require("react");
  return { AuthContext: ReactLib.createContext(null) };
});
jest.mock("../../../api/api", () => ({
  __esModule: true,
  default: { get: () => Promise.resolve({ data: [] }), post: () => Promise.resolve({}), put: () => Promise.resolve({}) },
}));
jest.mock("./agentActions", () => ({
  executeAction: jest.fn(),
  getActionMeta: (action) => ({ label: action }),
  searchConnectUsers: async () => [],
}));
jest.mock("../../../services/aiChatService", () => ({
  fetchLatestAIChat: async () => null,
  saveAIChat: async () => null,
  deleteAIChat: async () => null,
}));
jest.mock("../../../services/llmClient", () => ({
  completeChat: async () => "",
  streamChat: jest.fn(),
  fetchAiProviderStatus: async () => null,
  warmupCursorProvider: () => {},
  extractGeminiText: () => "",
  isGeminiQuotaError: () => false,
}));
jest.mock("../../../hooks/useComposerLiveTranscribe", () => () => ({
  listening: false,
  supported: true,
  start: async () => true,
  stop: () => {},
}));
jest.mock("../../../services/aiAgentSettings", () => {
  const actual = jest.requireActual("../../../services/aiAgentSettings");
  return { ...actual, hasConfiguredApiKey: () => true, getAvailableProviders: () => ["gemini", "openai"] };
});

const { streamChat } = require("../../../services/llmClient");
const { executeAction } = require("./agentActions");
const AIAgentModal = require("./AIAgentModal").default;

const renderAgent = () => {
  const store = configureStore({
    reducer: {
      profile: () => ({ _id: "me", connects: [] }),
      setting: () => ({ language: "eng" }),
    },
  });
  return render(
    <Provider store={store}>
      <MemoryRouter>
        <AIAgentModal isOpen onClose={jest.fn()} />
      </MemoryRouter>
    </Provider>,
  );
};

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

beforeEach(() => {
  window.localStorage.clear();
  executeAction.mockReset();
  executeAction.mockImplementation(async ({ action }) => ({
    success: true,
    message: `${action} done`,
  }));
  streamChat.mockReset();
});

describe("web AI Agent matches the Connect app", () => {
  it("opens in Auto mode with the app's header, provider chip and start screen", async () => {
    renderAgent();
    expect(await screen.findByText("Connect AI")).toBeInTheDocument();
    expect(screen.getByText("Auto-runs actions")).toBeInTheDocument();
    expect(screen.getByRole("switch", { name: "Auto-run actions on" })).toBeInTheDocument();
    expect(screen.getByText("What can I do for you?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Select AI provider" }));
    expect(screen.getByRole("menuitemradio", { name: /Gemini/ })).toBeInTheDocument();
    expect(screen.getByRole("menuitemradio", { name: /OpenAI/ })).toBeInTheDocument();
  });

  it("shows the compact pill when minimized", async () => {
    const { container } = renderAgent();
    fireEvent.click(await screen.findByRole("button", { name: "Minimize AI Agent" }));
    const pill = within(container.querySelector(".xa-mini"));
    expect(pill.getByText("AI Agent")).toBeInTheDocument();
    expect(pill.getByText("Tap to open")).toBeInTheDocument();
    expect(pill.getByRole("button", { name: "Voice input" })).toBeInTheDocument();
    expect(pill.getByRole("button", { name: "Turn speaking on" })).toBeInTheDocument();
    // The app's pill has no close button: open the agent to close it.
    expect(pill.queryByRole("button", { name: "Close AI Agent" })).toBeNull();
  });

  it("puts planned actions in the Run tray in Ask mode", async () => {
    streamChat.mockImplementation(async ({ onDelta }) => {
      const text =
        '{"type":"action","message":"Adding it.","actions":[{"id":"a1","action":"CREATE_TASK","status":"pending","parameters":{"text":"buy milk"}}]}';
      onDelta?.(text);
      return text;
    });
    renderAgent();
    fireEvent.click(await screen.findByRole("switch", { name: "Auto-run actions on" }));
    expect(screen.getByText("Asks before acting")).toBeInTheDocument();
    const input = screen.getByPlaceholderText("Ask anything or tell me what to do…");
    fireEvent.change(input, { target: { value: "remind me that I need milk soon" } });
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Send" }));
    });
    expect(await screen.findByText("Ready to run")).toBeInTheDocument();
    expect(screen.getByText("Create task")).toBeInTheDocument();
    expect(executeAction).not.toHaveBeenCalled();
    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Run Create task" }));
    });
    await waitFor(() =>
      expect(executeAction).toHaveBeenCalledWith(
        expect.objectContaining({ action: "CREATE_TASK", searchQuery: "buy milk" }),
      ),
    );
    expect(screen.queryByText("Ready to run")).toBeNull();
  });
});

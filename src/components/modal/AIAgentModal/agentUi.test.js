import React from "react";
import { render, screen, fireEvent } from "@testing-library/react";
import ChatArea from "./ChatArea";
import MessageBubble from "./MessageBubble";
import ModalHeader from "./ModalHeader";
import { matchRelationConnects, matchSpokenChoice, stripHonorifics } from "./agentRelations";

// Result cards pull in the API client (axios ESM); not under test here.
jest.mock("./ConnectResultCard", () => () => null);
jest.mock("./VideoResultCard", () => () => null);
jest.mock("../../../hooks/useComposerLiveTranscribe", () => () => ({
  listening: false,
  supported: true,
  start: jest.fn(async () => true),
  stop: jest.fn(),
}));

const baseChat = {
  isLoading: false,
  onSendMessage: jest.fn(),
  inputValue: "",
  onInputChange: jest.fn(),
  messagesEndRef: { current: null },
  onToggleLiveTalk: jest.fn(),
  onStop: jest.fn(),
};

beforeAll(() => {
  window.HTMLElement.prototype.scrollIntoView = jest.fn();
});

describe("Expo-style AI Agent UI", () => {
  it("shows the start screen with tap-to-talk and the eight starters", () => {
    const onStartTalk = jest.fn();
    const onSendMessage = jest.fn();
    render(
      <ChatArea
        {...baseChat}
        messages={[{ id: 1, type: "agent", meta: "welcome", content: "Hi", timestamp: new Date() }]}
        isFreshChat
        onStartTalk={onStartTalk}
        onSendMessage={onSendMessage}
      />,
    );
    expect(screen.getByText("What can I do for you?")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: "Tap to talk" }));
    expect(onStartTalk).toHaveBeenCalled();
    ["Messages", "Calls", "Post", "Tasks", "YouTube", "Games", "Plan", "Updates"].forEach(
      (title) => expect(screen.getByText(title)).toBeInTheDocument(),
    );
    fireEvent.click(screen.getByText("Open my messages"));
    expect(onSendMessage).toHaveBeenCalledWith("Open my messages");
  });

  it("uses Bangla on the start screen for Bangla users", () => {
    render(
      <ChatArea {...baseChat} messages={[]} isFreshChat bn onStartTalk={jest.fn()} />,
    );
    expect(screen.getByText("কথা বলতে চাপুন")).toBeInTheDocument();
  });

  it("turns Send into Stop while the agent is thinking or running an action", () => {
    const onStop = jest.fn();
    const { rerender } = render(
      <ChatArea {...baseChat} messages={[]} onStop={onStop} isLoading />,
    );
    fireEvent.click(screen.getByRole("button", { name: "Stop" }));
    expect(onStop).toHaveBeenCalledTimes(1);
    rerender(
      <ChatArea {...baseChat} messages={[]} onStop={onStop} runningLabel="Create note" />,
    );
    expect(screen.getByText("Create note…")).toBeInTheDocument();
  });

  it("renders action results as ✓/✗ cards", () => {
    render(
      <MessageBubble
        message={{ id: 2, type: "action-result", success: true, content: "Note saved", timestamp: new Date() }}
      />,
    );
    expect(screen.getByText("Done")).toBeInTheDocument();
    expect(screen.getByText("Note saved")).toBeInTheDocument();
  });

  it("header shows status, Auto/Ask and the provider chip", () => {
    const onToggleAutoRun = jest.fn();
    render(
      <ModalHeader
        autoRunActions
        onToggleAutoRun={onToggleAutoRun}
        providerLabel="Gemini"
        statusLabel="Thinking…"
        statusTone="busy"
      />,
    );
    expect(screen.getByText("Connect AI")).toBeInTheDocument();
    expect(screen.getByText("Thinking…")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("switch"));
    expect(onToggleAutoRun).toHaveBeenCalled();
    expect(screen.getByText("Gemini")).toBeInTheDocument();
  });
});

describe("people words on web", () => {
  const connects = [
    { id: "m1", name: "Rahima Begum", relationshipTypes: ["Parent"], gender: "Female" },
    { id: "d1", name: "Abdul Karim", relationshipTypes: ["Parent"], gender: "Male" },
  ];

  it("resolves mom and dad from relationship tags and gender", () => {
    expect(matchRelationConnects("আম্মু", connects).matches.map((c) => c.id)).toEqual(["m1"]);
    expect(matchRelationConnects("my dad", connects).matches.map((c) => c.id)).toEqual(["d1"]);
    expect(matchRelationConnects("Momin", connects)).toBeNull();
  });

  it("strips honorifics and understands spoken choices", () => {
    expect(stripHonorifics("রহিম ভাই")).toBe("রহিম");
    const choices = [{ name: "Rahim Uddin" }, { name: "Rahim Khan" }];
    expect(matchSpokenChoice("দ্বিতীয়জন", choices)).toBe(choices[1]);
    expect(matchSpokenChoice("Rahim", choices)).toBeNull();
  });
});

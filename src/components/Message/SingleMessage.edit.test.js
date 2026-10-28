import React, { useState } from "react";
import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { Provider } from "react-redux";
import { createStore } from "redux";
import api from "../../api/api";
import { showErrorToast } from "../../utils/toastUtils";
import SingleMessage from "./SingleMessage";

jest.mock("../../api/api", () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock("../../utils/toastUtils", () => ({ showErrorToast: jest.fn() }));
jest.mock("../../common/socket", () => ({
  __esModule: true,
  default: { emit: jest.fn(), on: jest.fn(), off: jest.fn() },
}));
jest.mock("../UserPP", () => () => null);

const ME = "aaaaaaaaaaaaaaaaaaaaaaaa";
const THEM = "bbbbbbbbbbbbbbbbbbbbbbbb";
const store = createStore(() => ({ profile: { _id: ME, profilePic: "" } }));

const message = (extra = {}) => ({
  _id: "cccccccccccccccccccccccc",
  senderId: ME,
  receiverId: THEM,
  message: "helo",
  messageType: "text",
  timestamp: "2026-10-29T09:00:00.000Z",
  ...extra,
});

let latest = [];
const Thread = ({ initial }) => {
  const [messages, setMessages] = useState(initial);
  latest = messages;
  return messages.map((msg) => (
    <SingleMessage
      key={msg._id}
      msg={msg}
      connectProfile={{ _id: THEM, profilePic: "" }}
      messages={messages}
      setMessages={setMessages}
      setIsReplying={() => {}}
      setReplyData={() => {}}
      setIsPreview={() => {}}
      msgListRef={{ current: null }}
    />
  ));
};

const renderThread = (initial) =>
  render(
    <Provider store={store}>
      <Thread initial={initial} />
    </Provider>,
  );

const openEditor = () => fireEvent.click(screen.getByRole("button", { name: "Edit message" }));
const editor = () => screen.getByRole("textbox", { name: "Edit message" });

afterEach(() => {
  jest.clearAllMocks();
  latest = [];
});

it("offers Edit only on my own text messages", () => {
  renderThread([
    message(),
    message({ _id: "dddddddddddddddddddddddd", senderId: THEM, receiverId: ME, message: "theirs" }),
    message({ _id: "eeeeeeeeeeeeeeeeeeeeeeee", messageType: "audio", message: "", attachment: "https://x/voice-1.webm" }),
    message({ _id: "temp-1", isOptimistic: true, message: "sending" }),
  ]);
  expect(screen.getAllByRole("button", { name: "Edit message" })).toHaveLength(1);
});

it("edits a message: optimistic text, saved through the API, marked edited", async () => {
  api.post.mockResolvedValue({
    data: { data: message({ message: "hello", isEdited: true, editedAt: "2026-10-29T09:05:00.000Z" }) },
  });
  renderThread([message()]);

  openEditor();
  expect(editor()).toHaveValue("helo");
  fireEvent.change(editor(), { target: { value: "  hello " } });
  fireEvent.keyDown(editor(), { key: "Enter" });

  expect(screen.queryByRole("textbox", { name: "Edit message" })).toBeNull();
  expect(screen.getByText("hello")).toBeInTheDocument();
  expect(api.post).toHaveBeenCalledWith("/message/edit", {
    messageId: "cccccccccccccccccccccccc",
    message: "hello",
  });
  await waitFor(() => expect(latest[0].editedAt).toBe("2026-10-29T09:05:00.000Z"));
  expect(latest[0]).toMatchObject({ message: "hello", isEdited: true });
  expect(screen.getByText(/edited/)).toBeInTheDocument();
});

it("Escape cancels and unchanged text does not call the API", () => {
  renderThread([message()]);
  openEditor();
  fireEvent.change(editor(), { target: { value: "something else" } });
  fireEvent.keyDown(editor(), { key: "Escape" });
  expect(screen.queryByRole("textbox", { name: "Edit message" })).toBeNull();
  expect(screen.getByText("helo")).toBeInTheDocument();

  openEditor();
  expect(editor()).toHaveValue("helo");
  fireEvent.keyDown(editor(), { key: "Enter" });
  expect(api.post).not.toHaveBeenCalled();
  expect(screen.queryByRole("textbox", { name: "Edit message" })).toBeNull();
});

it("Shift+Enter and IME composition do not save", () => {
  renderThread([message()]);
  openEditor();
  fireEvent.change(editor(), { target: { value: "line one" } });
  fireEvent.keyDown(editor(), { key: "Enter", shiftKey: true });
  fireEvent.keyDown(editor(), { key: "Enter", keyCode: 229 });
  expect(api.post).not.toHaveBeenCalled();
  expect(editor()).toBeInTheDocument();
});

it("empty text cannot be saved", () => {
  renderThread([message()]);
  openEditor();
  fireEvent.change(editor(), { target: { value: "   " } });
  expect(screen.getByRole("button", { name: "Save" })).toBeDisabled();
  fireEvent.keyDown(editor(), { key: "Enter" });
  expect(api.post).not.toHaveBeenCalled();
});

it("rolls back on a rejected edit and shows the server's reason", async () => {
  api.post.mockRejectedValue({ response: { status: 403, data: { message: "You can only edit your own messages" } } });
  renderThread([message()]);
  openEditor();
  fireEvent.change(editor(), { target: { value: "nope" } });
  fireEvent.click(screen.getByRole("button", { name: "Save" }));

  await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
  expect(screen.getByText("helo")).toBeInTheDocument();
  expect(latest[0]).toMatchObject({ message: "helo", isEdited: false });
  expect(showErrorToast).toHaveBeenCalledWith("You can only edit your own messages");
  expect(screen.queryByRole("textbox", { name: "Edit message" })).toBeNull();
});

it("gives the text back to the editor when the network fails", async () => {
  api.post.mockRejectedValue(new Error("Network Error"));
  renderThread([message()]);
  openEditor();
  fireEvent.change(editor(), { target: { value: "draft I typed" } });
  fireEvent.keyDown(editor(), { key: "Enter" });

  await waitFor(() => expect(showErrorToast).toHaveBeenCalled());
  expect(latest[0].message).toBe("helo");
  expect(editor()).toHaveValue("draft I typed");
});

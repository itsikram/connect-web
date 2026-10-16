import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import api from "../../api/api";
import { showErrorToast } from "../../utils/toastUtils";
import { SecureMessageBubble, secureStateOf } from "./SecureMessage";

jest.mock("../../api/api", () => ({ __esModule: true, default: { post: jest.fn() } }));
jest.mock("../../utils/toastUtils", () => ({ showErrorToast: jest.fn() }));

const inOneHour = () => new Date(Date.now() + 3600 * 1000).toISOString();
const sealed = (extra = {}) => ({
  _id: "m1",
  messageType: "secure",
  message: "🔒 Secure message",
  secure: { state: "sealed", expiresAt: inOneHour() },
  ...extra,
});

afterEach(() => {
  jest.clearAllMocks();
  jest.useRealTimers();
});

describe("secureStateOf", () => {
  it("treats a sealed message past its expiry as expired", () => {
    const past = new Date(Date.now() - 1000).toISOString();
    expect(secureStateOf(sealed({ secure: { state: "sealed", expiresAt: past } }))).toBe("expired");
    expect(secureStateOf(sealed())).toBe("sealed");
    expect(secureStateOf(sealed({ secure: { openedAt: past } }))).toBe("opened");
  });
});

describe("SecureMessageBubble", () => {
  it("lets the receiver open it once and reports it as opened on close", async () => {
    api.post.mockResolvedValue({ data: { content: { text: "meet at 7", attachment: "" } } });
    const onStateChange = jest.fn();
    render(<SecureMessageBubble msg={sealed()} isMine={false} senderName="Rafi" onStateChange={onStateChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Open secure message" }));
    expect(await screen.findByText("meet at 7")).toBeInTheDocument();
    expect(api.post).toHaveBeenCalledWith("/message/secure/open", { messageId: "m1" });
    // The content is only in the viewer; nothing was written back yet.
    expect(onStateChange).not.toHaveBeenCalled();

    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(screen.queryByText("meet at 7")).not.toBeInTheDocument();
    expect(onStateChange).toHaveBeenCalledWith("m1", "opened", expect.any(String));
  });

  it("closes the viewer by itself when the timer runs out", async () => {
    jest.useFakeTimers();
    api.post.mockResolvedValue({ data: { content: { text: "short", attachment: "" } } });
    const onStateChange = jest.fn();
    render(<SecureMessageBubble msg={sealed()} isMine={false} onStateChange={onStateChange} />);

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "Open secure message" }));
    });
    expect(screen.getByText("short")).toBeInTheDocument();
    act(() => {
      jest.advanceTimersByTime(61 * 1000);
    });
    expect(screen.queryByText("short")).not.toBeInTheDocument();
    expect(onStateChange).toHaveBeenCalledWith("m1", "opened", expect.any(String));
  });

  it("never offers the sender a way to open it", () => {
    render(<SecureMessageBubble msg={sealed()} isMine />);
    expect(screen.queryByRole("button", { name: "Open secure message" })).not.toBeInTheDocument();
    expect(screen.getByText(/Not opened yet/)).toBeInTheDocument();
  });

  it("shows opened and expired states without a View action", () => {
    const { rerender } = render(
      <SecureMessageBubble msg={sealed({ secure: { state: "opened" } })} isMine={false} />,
    );
    expect(screen.getByText(/this message has vanished/)).toBeInTheDocument();
    expect(screen.queryByText("View")).not.toBeInTheDocument();

    rerender(<SecureMessageBubble msg={sealed({ secure: { state: "expired" } })} isMine />);
    expect(screen.getByText("Expired before it was opened")).toBeInTheDocument();
  });

  it("syncs the state when the server says it was already opened", async () => {
    api.post.mockRejectedValue({ response: { status: 410, data: { message: "Already opened", state: "opened" } } });
    const onStateChange = jest.fn();
    render(<SecureMessageBubble msg={sealed()} isMine={false} onStateChange={onStateChange} />);

    fireEvent.click(screen.getByRole("button", { name: "Open secure message" }));
    await waitFor(() => expect(onStateChange).toHaveBeenCalledWith("m1", "opened", null));
    expect(showErrorToast).toHaveBeenCalledWith("Already opened");
  });
});

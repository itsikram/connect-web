/**
 * Online pause & save from the web host's side, with the real LudoGame
 * component and the production socket server in-process. The guest is a bare
 * socket that accepts the invite. The host pauses, saves & exits, finds the
 * match under "Your Live Games" as paused, reopens the same board and resumes.
 */
import React from "react";
import { render, act, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const path = require("path");

const SERVER_DIR = path.resolve(__dirname, "../../../../../server");
const PORT = 4860 + Number(process.env.JEST_WORKER_ID || 0);
const HOST_ID = "1".repeat(24);
const GUEST_ID = "2".repeat(24);

const mockProfile = { _id: HOST_ID, fullName: "Web Host", profilePic: "", coverPic: "" };
const mockPeer = { _id: GUEST_ID, fullName: "Socket Guest" };

jest.mock("react-redux", () => ({
  useSelector: (selector) => selector({ profile: mockProfile }),
}));

jest.mock("../../../api/api", () => {
  const ok = () => Promise.resolve({ data: {} });
  return { __esModule: true, default: { get: ok, post: ok, put: ok, delete: ok } };
});

jest.mock("../../../utils/audioUnlock", () => ({
  unlockAudio: () => Promise.resolve(),
  playTone: () => Promise.resolve(),
  resumeAudioFromGesture: () => null,
  getAudioContext: () => null,
}));

jest.mock("../hooks/useLudoVoice", () => ({
  useLudoVoice: () => ({
    micOn: false,
    voiceConnecting: false,
    voiceError: null,
    toggleMic: () => {},
    isSpeakingUid: () => false,
  }),
}));

jest.mock("../../../utils/toastUtils", () =>
  new Proxy({ __esModule: true }, { get: (target, key) => (key in target ? target[key] : () => {}) }),
);

jest.mock("../components/AnimatedBackground", () => ({ AnimatedBackground: () => null }));
jest.mock("../components/WinnerConfetti", () => ({ WinnerConfetti: () => null }));
jest.mock("../components/PlayerSelectionModal", () => ({
  PlayerSelectionModal: (props) =>
    props.show ? (
      <div>
        <button data-testid="lobby-count" onClick={() => props.onPlayerCountChange(2)} />
        <button data-testid="lobby-online" onClick={() => props.onOnlineModeToggle()} />
        <button data-testid="lobby-invite" onClick={() => props.onInviteConnect(mockPeer)} />
        <button data-testid="lobby-confirm" onClick={() => props.onConfirmPlayerCount()} />
      </div>
    ) : null,
}));

// eslint-disable-next-line import/first
import LudoGame from "../LudoGame";

jest.setTimeout(3 * 60 * 1000);

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
const pause = async (ms) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await sleep(Math.min(100, until - Date.now()));
    });
  }
};
const click = async (el) => {
  await act(async () => {
    fireEvent.click(el);
  });
};
const waitFor = async (predicate, { timeout = 10000, label = "condition" } = {}) => {
  const started = Date.now();
  for (;;) {
    const result = predicate();
    if (result) return result;
    if (Date.now() - started > timeout) throw new Error(`Timed out waiting for ${label}`);
    // eslint-disable-next-line no-await-in-loop
    await pause(50);
  }
};
const q = (selector) => document.querySelector(selector);
const byTestId = (id) => q(`[data-testid="${id}"]`);
const buttonByText = (re) =>
  Array.from(document.querySelectorAll("button")).find((b) => re.test(b.textContent.trim()));
const tokens = () =>
  Array.from(document.querySelectorAll('button[aria-label^="Piece "]'))
    .map((b) => `${b.getAttribute("aria-label")}@${b.parentElement.style.left},${b.parentElement.style.top}`)
    .sort()
    .join("|");
const hint = () => q(".ludo-turn__hint")?.textContent || "";

let server;
let guest;
const guestLog = [];

beforeAll(() => {
  const { Server } = require(path.join(SERVER_DIR, "node_modules/socket.io"));
  const { debugLogger } = require(path.join(SERVER_DIR, "utils/debugLogger"));
  Object.keys(debugLogger || {}).forEach((key) => {
    debugLogger[key] = () => {};
  });
  const ludoSocket = require(path.join(SERVER_DIR, "sockets/ludoSocket"));
  server = new Server(PORT, { cors: { origin: "*" } });
  server.on("connection", (socket) => {
    const profileId = socket.handshake.query?.profile;
    ludoSocket(server, socket, profileId);
  });
});

afterAll(() => {
  guest?.close();
  return new Promise((resolve) => server.close(() => resolve()));
});

it("web host pauses, saves & exits, finds the paused match and resumes it", async () => {
  process.env.REACT_APP_SOCKET_URL = `http://localhost:${PORT}`;
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "debug").mockImplementation(() => {});
  window.confirm = () => true;
  localStorage.clear();
  sessionStorage.clear();

  // The guest is a bare socket that accepts the invite like a client would.
  const { io } = jest.requireActual("socket.io-client");
  guest = io(`http://localhost:${PORT}`, {
    query: { profile: GUEST_ID },
    transports: ["websocket"],
  });
  guest.onAny((event, payload) => guestLog.push({ event, payload }));
  guest.on("ludo:invite", (invite) => {
    guest.emit("ludo:join", { gameId: invite.gameId });
    setTimeout(() => {
      guest.emit("ludo:accept", {
        gameId: invite.gameId,
        slotIndex: invite.slotIndex,
        by: GUEST_ID,
        connect: { _id: GUEST_ID, fullName: mockPeer.fullName },
        from: invite.by,
      });
    }, 150);
  });
  await waitFor(() => guest.connected, { label: "guest socket" });

  await act(async () => {
    render(
      <MemoryRouter initialEntries={["/ludo-game"]}>
        <LudoGame />
      </MemoryRouter>,
    );
  });
  await pause(500);
  await click(buttonByText(/^Start( Game)?$/));
  await waitFor(() => byTestId("lobby-confirm"), { label: "lobby" });
  await click(byTestId("lobby-count"));
  await click(byTestId("lobby-online"));
  await pause(100);
  await click(byTestId("lobby-invite"));
  await pause(100);
  await click(byTestId("lobby-confirm"));

  const readyDice = () => q(".ludo-dice-btn.ludo-dice-btn--ready:not([disabled])");
  await waitFor(() => q(".ludo-tokens") && readyDice(), { timeout: 20000, label: "match started, host to roll" });

  // Pause: the guest is told, nothing is playable.
  const pauseBtn = await waitFor(
    () => {
      const b = byTestId("ludo-pause");
      return b && !b.disabled ? b : null;
    },
    { label: "pause enabled" },
  );
  await click(pauseBtn);
  await waitFor(() => byTestId("ludo-paused") && guestLog.some((e) => e.event === "ludo:paused"), {
    label: "paused on both sides",
  });
  await waitFor(() => !/Pausing/.test(byTestId("ludo-paused").textContent), { label: "pause confirmed" });
  expect(byTestId("ludo-paused").textContent).toMatch(/You paused the game/);
  expect(readyDice()).toBeNull();
  const boardBefore = tokens();
  const hintBefore = hint();

  // Save & exit: back on the landing page, the match is listed as paused.
  await click(buttonByText(/^Save & exit$/));
  await waitFor(() => !q(".ludo-tokens"), { label: "board closed" });
  await waitFor(() => guestLog.some((e) => e.event === "ludo:player:offline" && e.payload?.profileId === HOST_ID), {
    label: "guest sees host away",
  });
  const liveGame = await waitFor(
    () => Array.from(document.querySelectorAll(".ludo-live-game")).find((n) => /Paused/.test(n.textContent)),
    { label: "paused game in Your Live Games" },
  );

  // Reopen it: same board, still paused, host can resume.
  await click(liveGame);
  await waitFor(() => q(".ludo-tokens") && byTestId("ludo-paused"), { timeout: 10000, label: "board reopened paused" });
  await pause(500);
  expect(tokens()).toBe(boardBefore);
  expect(hint()).toBe(hintBefore);
  await waitFor(
    () => guestLog.some((e) => e.event === "ludo:player:online" && e.payload?.profileId === HOST_ID),
    { label: "guest sees host back" },
  );

  await click(buttonByText(/Resume$/));
  await waitFor(() => !byTestId("ludo-paused"), { label: "resumed" });
  expect(guestLog.some((e) => e.event === "ludo:resumed")).toBe(true);
  await waitFor(() => readyDice(), { timeout: 10000, label: "host can roll again" });
});

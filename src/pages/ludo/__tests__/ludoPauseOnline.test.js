/**
 * Online match from the web host's side, with the real LudoGame page and the
 * production game server in-process. The guest is a bare socket.
 *
 * Covers: the /ludo-game/:gameId route, invite + accept, remote players'
 * photos in their starting yards, pause, save & exit, the paused match in
 * "Your Games", reopening it, a full page reload, resume, and re-invite.
 */
import React from "react";
import { render, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import {
  startLudoServer,
  connectBareClient,
  pause,
  click,
  waitFor,
  q,
  byTestId,
  buttonByText,
  readyDice,
  tokens,
  hint,
  silenceConsole,
} from "../testUtils/ludoWebHarness";

const PORT = 4860 + Number(process.env.JEST_WORKER_ID || 0);
const URL = `http://localhost:${PORT}`;
const HOST_ID = "1".repeat(24);
const GUEST_ID = "2".repeat(24);

const mockProfile = {
  _id: HOST_ID,
  fullName: "Web Host",
  profilePic: "https://pics.example/host.png",
  coverPic: "https://pics.example/host-cover.png",
};
const mockPeer = { _id: GUEST_ID, fullName: "Socket Guest", profilePic: "https://pics.example/guest.png" };

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

let server;
let guest;
let currentPath = "";

const PathSpy = () => {
  currentPath = useLocation().pathname;
  return null;
};

const mountAt = (entry) =>
  render(
    <MemoryRouter initialEntries={[entry]}>
      <PathSpy />
      <Routes>
        <Route path="/ludo-game/*" element={<LudoGame />} />
        <Route path="/" element={<div data-testid="home">HOME</div>} />
      </Routes>
    </MemoryRouter>,
  );

beforeAll(() => {
  server = startLudoServer(PORT);
});

afterAll(() => {
  guest?.close();
  return new Promise((resolve) => server.close(() => resolve()));
});

it("route per game, remote photos in the yards, pause → save & exit → reopen → reload → resume", async () => {
  process.env.REACT_APP_SOCKET_URL = URL;
  silenceConsole();
  localStorage.clear();
  sessionStorage.clear();

  guest = connectBareClient(URL, GUEST_ID);
  guest.on("ludo:invite", (invite) => {
    guest.emit("ludo:accept", {
      gameId: invite.gameId,
      slotIndex: invite.slotIndex,
      connect: { fullName: mockPeer.fullName, profilePic: mockPeer.profilePic },
    });
  });
  await waitFor(() => guest.connected, { label: "guest socket" });

  let view;
  await act(async () => {
    view = mountAt("/ludo-game");
  });
  await pause(400);
  await click(buttonByText(/^Start( Game)?$/));
  await waitFor(() => byTestId("lobby-confirm"), { label: "lobby" });
  await click(byTestId("lobby-count"));
  await click(byTestId("lobby-online"));
  await click(byTestId("lobby-invite"));
  await click(byTestId("lobby-confirm"));

  // The game has its own route.
  await waitFor(() => /^\/ludo-game\/[^/]+$/.test(currentPath), { label: "game route" });
  const gamePath = currentPath;
  const gameId = decodeURIComponent(gamePath.split("/").pop());
  await waitFor(() => q(".ludo-tokens") && readyDice(), { timeout: 20000, label: "match started, host to roll" });

  // Each player's photo is shown in their own starting yard.
  expect(byTestId("ludo-yard-photo-0").getAttribute("href")).toBe(mockProfile.coverPic);
  expect(byTestId("ludo-yard-photo-1").getAttribute("href")).toBe(mockPeer.profilePic);
  expect(guest.latest.players[1].avatar).toBe(mockPeer.profilePic);

  // Pause: the guest is told, nothing is playable.
  const pauseBtn = await waitFor(() => {
    const b = byTestId("ludo-pause");
    return b && !b.disabled ? b : null;
  }, { label: "pause enabled" });
  await click(pauseBtn);
  await waitFor(() => byTestId("ludo-paused") && guest.latest?.paused, { label: "paused on both sides" });
  expect(byTestId("ludo-paused").textContent).toMatch(/You paused the game/);
  expect(readyDice()).toBeNull();
  const boardBefore = tokens();
  const hintBefore = hint();

  // Save & exit: back on the menu, the guest sees the host away, the match is
  // listed as paused.
  await click(buttonByText(/^Save & exit$/));
  await waitFor(() => currentPath === "/ludo-game", { label: "back to the menu" });
  await waitFor(() => guest.latest?.players?.[0]?.isOffline, { label: "guest sees host away" });
  const listed = await waitFor(
    () => Array.from(document.querySelectorAll(".ludo-live-game")).find((n) => /Paused/.test(n.textContent)),
    { label: "paused game in Your Games" },
  );

  // Reopen it: same board, still paused.
  await click(listed);
  await waitFor(() => currentPath === gamePath, { label: "game route again" });
  await waitFor(() => q(".ludo-tokens") && byTestId("ludo-paused"), { label: "board reopened paused" });
  await pause(300);
  expect(tokens()).toBe(boardBefore);
  expect(hint()).toBe(hintBefore);
  await waitFor(() => guest.latest?.players?.[0]?.isOffline === false, { label: "guest sees host back" });

  // A full page reload on the game's URL restores the same paused board.
  view.unmount();
  await act(async () => {
    view = mountAt(gamePath);
  });
  await waitFor(() => q(".ludo-tokens") && byTestId("ludo-paused"), { label: "board after reload" });
  await pause(300);
  expect(tokens()).toBe(boardBefore);

  // Resume (any player in the game can) and keep playing.
  await click(buttonByText(/Resume$/));
  await waitFor(() => !byTestId("ludo-paused") && guest.latest && !guest.latest.paused, { label: "resumed" });
  await waitFor(() => readyDice(), { timeout: 10000, label: "host can roll again" });

  // Re-invite reaches a player who has left the board.
  guest.emit("ludo:board:closed", { gameId });
  await waitFor(() => /away/.test(q('[data-testid="ludo-peer-offline"]')?.textContent || ""), {
    label: "host sees guest away",
  });
  const invitesBefore = guest.log.filter((e) => e.event === "ludo:invite").length;
  await click(buttonByText(/Re-invite$/));
  await waitFor(
    () => guest.log.filter((e) => e.event === "ludo:invite" && e.payload.reinvite).length > 0 &&
      guest.log.filter((e) => e.event === "ludo:invite").length > invitesBefore,
    { label: "guest re-invited" },
  );
  view.unmount();
});

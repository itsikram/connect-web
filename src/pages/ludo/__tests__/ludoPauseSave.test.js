/**
 * Games against the computer are hosted by the server too: the computer
 * plays on the server, the game is saved on every move and can be paused,
 * closed and resumed later from "Your Games". Uses the real LudoGame page and
 * the production game server in-process.
 */
import React from "react";
import { render, act } from "@testing-library/react";
import { MemoryRouter, Route, Routes, useLocation } from "react-router-dom";
import {
  startLudoServer,
  pause,
  click,
  waitFor,
  q,
  byTestId,
  buttonByText,
  readyDice,
  tokens,
  playStep,
  silenceConsole,
} from "../testUtils/ludoWebHarness";

const PORT = 4880 + Number(process.env.JEST_WORKER_ID || 0);
const URL = `http://localhost:${PORT}`;

const mockProfile = { _id: "3".repeat(24), fullName: "Solo Player", profilePic: "", coverPic: "" };

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
        <button data-testid="lobby-computer" onClick={() => props.onPlayWithComputerToggle()} />
        <button data-testid="lobby-confirm" onClick={() => props.onConfirmPlayerCount()} />
      </div>
    ) : null,
}));

// eslint-disable-next-line import/first
import LudoGame from "../LudoGame";

jest.setTimeout(3 * 60 * 1000);

let server;
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

const startGame = async (computer) => {
  await click(buttonByText(/^Start( Game)?$/));
  await waitFor(() => byTestId("lobby-confirm"), { label: "lobby" });
  await click(byTestId("lobby-count"));
  if (computer) await click(byTestId("lobby-computer"));
  await click(byTestId("lobby-confirm"));
  await waitFor(() => /^\/ludo-game\/[^/]+$/.test(currentPath), { label: "game route" });
  await waitFor(() => q(".ludo-tokens"), { label: "board" });
};

beforeAll(() => {
  server = startLudoServer(PORT, {
    timings: { stepMs: 40, moveSettleMs: 80, passMs: 300, autoMoveMs: 300, botRollMs: 150, botMoveMs: 250 },
  });
});

afterAll(() => new Promise((resolve) => server.close(() => resolve())));

beforeEach(() => {
  process.env.REACT_APP_SOCKET_URL = URL;
  silenceConsole();
  localStorage.clear();
  sessionStorage.clear();
});

it("vs computer: the computer plays, pause → save & exit → resume from Your Games, restart, delete", async () => {
  let view;
  await act(async () => {
    view = mountAt("/ludo-game");
  });
  await pause(300);
  await startGame(true);
  expect(q(".ludo-header__subtitle").textContent).toBe("Vs computer");
  const firstPath = currentPath;

  // Play until the computer has taken a turn.
  let sawComputer = false;
  for (let i = 0; i < 400 && !sawComputer; i += 1) {
    // eslint-disable-next-line no-await-in-loop
    await playStep();
    if (/Computer turn/.test(q(".ludo-turn__hint")?.textContent || "")) sawComputer = true;
    // eslint-disable-next-line no-await-in-loop
    await pause(60);
  }
  expect(sawComputer).toBe(true);

  // Pause on our turn and leave the board.
  await waitFor(() => readyDice(), { timeout: 20000, label: "our turn" });
  await click(byTestId("ludo-pause"));
  await waitFor(() => byTestId("ludo-paused"), { label: "paused" });
  expect(byTestId("ludo-paused").textContent).toMatch(/You paused the game/);
  const board = tokens();
  await click(buttonByText(/^Save & exit$/));
  await waitFor(() => currentPath === "/ludo-game", { label: "menu" });

  // Later (even after leaving the page): it's in "Your Games", paused.
  view.unmount();
  await act(async () => {
    view = mountAt("/ludo-game");
  });
  const listed = await waitFor(
    () => Array.from(document.querySelectorAll(".ludo-live-game")).find((n) => /Paused/.test(n.textContent)),
    { label: "paused game listed" },
  );
  expect(listed.textContent).toMatch(/Vs computer/);
  await click(listed);
  await waitFor(() => currentPath === firstPath && byTestId("ludo-paused"), { label: "reopened paused" });
  await pause(200);
  expect(tokens()).toBe(board);
  await click(buttonByText(/Resume$/));
  await waitFor(() => !byTestId("ludo-paused") && readyDice(), { label: "resumed, our turn" });

  // Restart: a new game (new route), every token back in its yard.
  await click(buttonByText(/^Restart$/));
  await click(
    Array.from(document.querySelectorAll(".ludo-leave-confirm button")).find((b) => /^Restart$/.test(b.textContent.trim())),
  );
  await waitFor(() => /^\/ludo-game\/[^/]+$/.test(currentPath) && currentPath !== firstPath, { label: "new game" });
  await waitFor(() => q(".ludo-tokens") && readyDice(), { label: "new board ready" });
  const fresh = Array.from(document.querySelectorAll('button[aria-label^="Piece "]'));
  expect(fresh).toHaveLength(8);

  // Back to the menu and delete it; the restarted one replaced the old game.
  await click(byTestId("ludo-pause"));
  await waitFor(() => byTestId("ludo-paused"), { label: "paused again" });
  await click(buttonByText(/^Save & exit$/));
  await waitFor(() => currentPath === "/ludo-game", { label: "menu again" });
  await waitFor(() => document.querySelectorAll(".ludo-live-game").length === 1, { label: "one saved game" });
  await click(q(".ludo-saved-game__delete"));
  await click(buttonByText(/^Delete$/));
  await waitFor(() => document.querySelectorAll(".ludo-live-game").length === 0, { label: "deleted" });
  view.unmount();
});

it("Leave asks in-app, then exits the Ludo page instead of restarting", async () => {
  window.confirm = jest.fn(() => true);
  let view;
  await act(async () => {
    view = mountAt("/ludo-game");
  });
  await pause(300);
  await startGame(false);
  expect(q(".ludo-header__subtitle").textContent).toBe("Pass & play");
  const leave = await waitFor(
    () => Array.from(document.querySelectorAll("button")).find((b) => b.textContent.trim() === "Leave"),
    { label: "Leave button" },
  );
  await click(leave);
  expect(window.confirm).not.toHaveBeenCalled();
  expect(byTestId("leave-confirm")).toBeTruthy();
  await click(byTestId("leave-confirm-yes"));
  await waitFor(() => byTestId("home"), { timeout: 3000, label: "left the Ludo page" });
  expect(q(".ludo-root")).toBeNull();
  view.unmount();
});

it("a game link that no longer exists shows a way back", async () => {
  let view;
  await act(async () => {
    view = mountAt("/ludo-game/does-not-exist");
  });
  await waitFor(() => byTestId("ludo-game-gone"), { label: "game unavailable" });
  await click(buttonByText(/^Back to Ludo$/));
  await waitFor(() => currentPath === "/ludo-game", { label: "menu" });
  view.unmount();
});

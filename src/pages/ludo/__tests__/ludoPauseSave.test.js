/**
 * Pause & save for an offline game against the computer, with the real
 * LudoGame component: pausing freezes the board (the computer included),
 * "Save & exit" lists the game under Saved Games, and after a reload the
 * game resumes on the same board and keeps playing.
 */
import React from "react";
import { render, act, fireEvent, cleanup } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const mockProfile = { _id: "pause-tester", fullName: "Pause Tester", profilePic: "", coverPic: "" };

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
        <button
          data-testid="lobby-computer"
          onClick={() => !props.playWithComputer && props.onPlayWithComputerToggle()}
        />
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
const readyDice = () => q(".ludo-dice-btn.ludo-dice-btn--ready:not([disabled])");
const savedGames = () => JSON.parse(localStorage.getItem("ludo_saved_local_games") || "[]");

const renderGame = async () => {
  await act(async () => {
    render(
      <MemoryRouter initialEntries={["/ludo-game"]}>
        <LudoGame />
      </MemoryRouter>,
    );
  });
  await pause(300);
};

// Human plays: roll when possible, else move the first playable token.
const playFor = async (ms) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    const dice = readyDice();
    const token = q('button[aria-label^="Piece "]:not([disabled])');
    // eslint-disable-next-line no-await-in-loop
    if (dice) await click(dice);
    // eslint-disable-next-line no-await-in-loop
    else if (token) await click(token);
    // eslint-disable-next-line no-await-in-loop
    await pause(200);
  }
};

beforeEach(() => {
  // Offline play needs no server; the socket just never connects.
  process.env.REACT_APP_SOCKET_URL = "http://localhost:1";
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "debug").mockImplementation(() => {});
  window.confirm = () => true;
  localStorage.clear();
  sessionStorage.clear();
});

afterEach(() => {
  cleanup();
});

it("pauses, saves and resumes an offline game against the computer", async () => {
  await renderGame();
  await click(buttonByText(/^Start( Game)?$/));
  await waitFor(() => byTestId("lobby-confirm"), { label: "lobby" });
  await click(byTestId("lobby-count"));
  await click(byTestId("lobby-computer"));
  await click(byTestId("lobby-confirm"));
  await waitFor(() => q(".ludo-tokens") && readyDice(), { label: "game started" });

  // Play until at least one token has left home (six needed), capped.
  const initialTokens = tokens();
  const startedAt = Date.now();
  while (tokens() === initialTokens && Date.now() - startedAt < 60000) {
    // eslint-disable-next-line no-await-in-loop
    await playFor(1500);
  }
  expect(tokens()).not.toBe(initialTokens);
  expect(savedGames()).toHaveLength(1); // autosaved while playing

  // Pause once the board is idle (the button is disabled mid-roll/move).
  const pauseBtn = await waitFor(
    () => {
      const b = byTestId("ludo-pause");
      return b && !b.disabled ? b : null;
    },
    { timeout: 15000, label: "pause enabled" },
  );
  await click(pauseBtn);
  await waitFor(() => byTestId("ludo-paused"), { label: "paused overlay" });
  await pause(600); // let an in-flight step settle
  const frozen = tokens();
  const frozenHint = hint();

  // Nothing moves while paused: no dice, no tokens, and the computer waits.
  await pause(4000);
  expect(tokens()).toBe(frozen);
  expect(readyDice()).toBeNull();
  expect(q('button[aria-label^="Piece "]:not([disabled])')).toBeNull();

  // Resume in place, then pause again and save & exit.
  await click(buttonByText(/Resume$/));
  await waitFor(() => !byTestId("ludo-paused"), { label: "overlay closed" });
  await click(
    await waitFor(
      () => {
        const b = byTestId("ludo-pause");
        return b && !b.disabled ? b : null;
      },
      { timeout: 15000, label: "pause enabled again" },
    ),
  );
  await waitFor(() => byTestId("ludo-paused"), { label: "paused again" });
  await pause(600);
  const savedBoard = tokens();
  const savedHint = hint();
  await click(buttonByText(/^Save & exit$/));
  await waitFor(() => byTestId("ludo-saved-games"), { label: "saved games list" });
  expect(q(".ludo-tokens")).toBeNull();
  expect(savedGames()).toHaveLength(1);
  expect(savedGames()[0].paused).toBe(true);
  expect(frozenHint).toBeTruthy();

  // "Reload" the page and resume from the saved list.
  cleanup();
  await renderGame();
  const entry = await waitFor(() => q(".ludo-saved-game .ludo-live-game"), {
    label: "saved game after reload",
  });
  expect(entry.textContent).toMatch(/Vs computer/);
  await click(entry);
  await waitFor(() => q(".ludo-tokens"), { label: "board after resume" });
  await pause(300);
  expect(tokens()).toBe(savedBoard);
  expect(hint()).toBe(savedHint);
  expect(byTestId("ludo-paused")).toBeNull();

  // And the game carries on.
  const resumedBoard = tokens();
  const resumedAt = Date.now();
  while (tokens() === resumedBoard && Date.now() - resumedAt < 45000) {
    // eslint-disable-next-line no-await-in-loop
    await playFor(1500);
  }
  expect(tokens()).not.toBe(resumedBoard);
  expect(savedGames()).toHaveLength(1); // same save keeps updating, no duplicate
});

it("restart discards the saved offline game", async () => {
  await renderGame();
  await click(buttonByText(/^Start( Game)?$/));
  await waitFor(() => byTestId("lobby-confirm"), { label: "lobby" });
  await click(byTestId("lobby-count"));
  await click(byTestId("lobby-computer"));
  await click(byTestId("lobby-confirm"));
  await waitFor(() => readyDice(), { label: "game started" });
  await click(readyDice());
  await pause(1500);
  expect(savedGames()).toHaveLength(1);
  await click(buttonByText(/^Restart$/));
  await pause(300);
  expect(savedGames()).toHaveLength(0);
});

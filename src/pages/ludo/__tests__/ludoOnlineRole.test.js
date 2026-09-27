/**
 * One web player in an online Ludo match, rendered with the real LudoGame
 * component and a real socket connection. Started by tests/ludo-e2e/run.js at
 * the repository root, which runs the shared Ludo socket server and the other
 * player (web or Expo) in a separate process. Skipped when run on its own.
 *
 * Env: LUDO_E2E_URL, LUDO_E2E_ROLE (host|guest), LUDO_E2E_SELF, LUDO_E2E_PEER,
 *      LUDO_E2E_PLAYERS (2-4, host only).
 */
import React from "react";
import { render, act, fireEvent } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";

const url = process.env.LUDO_E2E_URL;
const role = process.env.LUDO_E2E_ROLE;
const run = url && role ? it : it.skip;

const mockProfile = {
  _id: String(process.env.LUDO_E2E_SELF || "web-self"),
  fullName: `Web ${role || "player"}`,
  profilePic: "",
  coverPic: "",
};
const mockPeer = { _id: String(process.env.LUDO_E2E_PEER || "web-peer"), fullName: "Peer" };
const mockToasts = [];
const mockEvents = [];
const mockSockets = [];

jest.mock("react-redux", () => ({
  useSelector: (selector) => selector({ profile: mockProfile }),
}));

jest.mock("socket.io-client", () => {
  const actual = jest.requireActual("socket.io-client");
  return {
    ...actual,
    io: (...args) => {
      const socket = actual.io(...args);
      socket.onAny((event, payload) => mockEvents.push({ event, payload, at: Date.now() }));
      mockSockets.push(socket);
      return socket;
    },
  };
});

jest.mock("../../../api/api", () => {
  const ok = () => Promise.resolve({ data: {} });
  return { __esModule: true, default: { get: ok, post: ok, put: ok, delete: ok } };
});

jest.mock("../../../utils/audioUnlock", () => ({
  unlockAudio: () => Promise.resolve(),
  playTone: () => Promise.resolve(),
  resumeAudioFromGesture: () => {},
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

jest.mock("../../../utils/toastUtils", () => {
  const noop = () => {};
  return new Proxy(
    {
      __esModule: true,
      showLudoInviteToast: (name, avatar, onAccept, onDecline) => {
        mockToasts.push({ name, onAccept, onDecline });
        return mockToasts.length;
      },
    },
    { get: (target, key) => (key in target ? target[key] : noop) },
  );
});

// Same shortened board as the Expo harness so mixed games agree.
jest.mock("../constants/gameConstants", () => {
  const actual = jest.requireActual("../constants/gameConstants");
  const PATHS = {};
  Object.keys(actual.PATHS).forEach((key) => {
    PATHS[Number(key)] = actual.PATHS[key].slice(-8);
  });
  return { ...actual, PATHS };
});

jest.mock("../components/AnimatedBackground", () => ({ AnimatedBackground: () => null }));
jest.mock("../components/WinnerConfetti", () => ({ WinnerConfetti: () => null }));
jest.mock("../components/GameEndedScreen", () => ({
  GameEndedScreen: () => <div data-testid="game-ended">GAME_ENDED</div>,
}));
jest.mock("../components/WinnerModal", () => ({
  WinnerModal: ({ winner, onContinueGame }) =>
    winner ? <button data-testid="winner-continue" onClick={onContinueGame} /> : null,
}));
jest.mock("../components/IncomingInviteModal", () => ({
  IncomingInviteModal: ({ inviteRequest, onAccept }) =>
    inviteRequest ? (
      <button data-testid="invite-accept" onClick={() => onAccept(inviteRequest)} />
    ) : null,
}));
jest.mock("../components/PlayerSelectionModal", () => ({
  PlayerSelectionModal: (props) =>
    props.show ? (
      <div>
        <button
          data-testid="lobby-count"
          onClick={() => props.onPlayerCountChange(Number(process.env.LUDO_E2E_PLAYERS || 2))}
        />
        <button data-testid="lobby-online" onClick={() => props.onOnlineModeToggle()} />
        <button data-testid="lobby-invite" onClick={() => props.onInviteConnect(mockPeer)} />
        <button data-testid="lobby-confirm" onClick={() => props.onConfirmPlayerCount()} />
      </div>
    ) : null,
}));

// eslint-disable-next-line import/first
import LudoGame from "../LudoGame";

jest.setTimeout(12 * 60 * 1000);

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
const hasEnded = () => Boolean(byTestId("game-ended"));
const hint = () => q(".ludo-turn__hint")?.textContent || "";

const visibleState = () =>
  JSON.stringify({
    tokens: Array.from(document.querySelectorAll('button[aria-label^="Piece "]')).map(
      (b) => `${b.getAttribute("aria-label")}@${b.parentElement.style.left},${b.parentElement.style.top}`,
    ),
    hint: hint(),
    dice: q(".ludo-dice-btn")?.className,
    overlays: Array.from(document.querySelectorAll(".ludo-card__title")).map((n) => n.textContent),
    ended: hasEnded(),
  });

const traceOf = (count = 16) =>
  mockEvents
    .slice(-count)
    .map(({ event, payload, at }) => {
      const p = payload || {};
      const bits = [
        p.lastActionType,
        typeof p.currentPlayer === "number" ? `cp=${p.currentPlayer}` : "",
        typeof p.diceValue === "number" ? `dice=${p.diceValue}` : "",
        typeof p.value === "number" ? `value=${p.value}` : "",
        typeof p.toSteps === "number" ? `piece=${p.playerIndex}.${p.pieceIndex}->${p.toSteps}` : "",
        typeof p.gameStarted === "boolean" ? `started=${p.gameStarted}` : "",
        p.playersSeq ? `seq=${p.playersSeq}` : "",
        p.by ? `by=${String(p.by).slice(-4)}` : "",
      ].filter(Boolean);
      return `    ${at % 100000} ${event} ${bits.join(" ")}`;
    })
    .join("\n");

const playStep = async () => {
  if (hasEnded()) return false;
  const winner = byTestId("winner-continue");
  if (winner) await click(winner);
  const dice = q(".ludo-dice-btn.ludo-dice-btn--ready:not([disabled])");
  if (dice) {
    await click(dice);
    return true;
  }
  const token = q('button[aria-label^="Piece "]:not([disabled])');
  if (token) {
    await click(token);
    return true;
  }
  return false;
};

// Cuts this client's connection for outageMs the way a network blip does
// (transport dies, socket.io reconnects on its own) and checks the
// reconnecting overlay is shown meanwhile.
const dropConnection = async (outageMs = 3000) => {
  const socket = mockSockets.filter((s) => s.connected).pop();
  if (!socket) throw new Error("no connected socket to drop");
  const manager = socket.io;
  const delay = manager.reconnectionDelay();
  const delayMax = manager.reconnectionDelayMax();
  manager.reconnectionDelay(outageMs);
  manager.reconnectionDelayMax(outageMs);
  manager.randomizationFactor(0);
  manager.engine.close();
  await pause(1500);
  if (!byTestId("ludo-reconnecting")) {
    throw new Error(`reconnecting overlay not shown during outage\n${visibleState()}`);
  }
  await waitFor(() => socket.connected, { timeout: outageMs + 5000, label: "socket reconnected" });
  manager.reconnectionDelay(delay);
  manager.reconnectionDelayMax(delayMax);
  await waitFor(() => !byTestId("ludo-reconnecting"), { timeout: 6000, label: "reconnecting overlay hidden" });
  process.stdout.write(`[web ${role}] recovered from a ${outageMs}ms outage\n`);
};

const playUntilEnd = async ({ stallMs = 25000, maxMs = 10 * 60 * 1000, dropAfter = 0 } = {}) => {
  const started = Date.now();
  let lastChange = Date.now();
  let lastSignature = "";
  let actions = 0;
  let dropped = false;
  for (;;) {
    if (hasEnded()) return { actions, ms: Date.now() - started };
    if (dropAfter && !dropped && actions >= dropAfter) {
      dropped = true;
      // eslint-disable-next-line no-await-in-loop
      await dropConnection();
      lastChange = Date.now();
    }
    // eslint-disable-next-line no-await-in-loop
    if (await playStep()) actions += 1;
    const signature = visibleState();
    if (signature !== lastSignature) {
      lastSignature = signature;
      lastChange = Date.now();
    }
    if (Date.now() - lastChange > stallMs) {
      throw new Error(`Web ${role} stalled for ${stallMs}ms after ${actions} actions.\n${visibleState()}\n${traceOf()}`);
    }
    if (Date.now() - started > maxMs) throw new Error(`Game did not finish within ${maxMs}ms`);
    // eslint-disable-next-line no-await-in-loop
    await pause(150);
  }
};

run(`web ${role} plays a full online match`, async () => {
  process.env.REACT_APP_SOCKET_URL = url;
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  window.confirm = () => true;
  localStorage.clear();

  await act(async () => {
    render(
      <MemoryRouter initialEntries={["/ludo-game"]}>
        <LudoGame />
      </MemoryRouter>,
    );
  });
  await pause(500);

  if (role === "host") {
    if (!byTestId("lobby-confirm")) {
      const start = Array.from(document.querySelectorAll("button")).find((b) =>
        /Start( Game)?$/.test(b.textContent.trim()),
      );
      await click(start);
    }
    await waitFor(() => byTestId("lobby-confirm"), { label: "lobby" });
    await click(byTestId("lobby-count"));
    await click(byTestId("lobby-online"));
    await pause(100);
    await click(byTestId("lobby-invite"));
    await pause(100);
    await click(byTestId("lobby-confirm"));
  } else {
    await waitFor(() => mockToasts.length > 0, { timeout: 60000, label: "invite toast" });
    const acceptedAt = Date.now();
    await act(async () => {
      mockToasts[mockToasts.length - 1].onAccept();
    });
    await waitFor(
      () =>
        !Array.from(document.querySelectorAll(".ludo-card__title")).some((n) =>
          /Waiting for/i.test(n.textContent),
        ) && Boolean(q(".ludo-tokens")),
      { timeout: 3000, label: "match started after accept" },
    );
    process.stdout.write(`[web guest] match started ${Date.now() - acceptedAt}ms after accept\n`);
  }

  const result = await playUntilEnd({
    dropAfter: process.env.LUDO_E2E_DROP === role ? 6 : 0,
  });
  process.stdout.write(`[web ${role}] game ended after ${result.actions} actions in ${result.ms}ms\n`);
});

/* eslint-env jest */
// Helpers for the web Ludo tests: an in-process game server (the production
// server/sockets/ludoSocket.js) and small DOM helpers that drive LudoGame like
// a person would. Module mocks stay in each test file.
import { act, fireEvent } from "@testing-library/react";

const path = require("path");

export const SERVER_DIR = path.resolve(__dirname, "../../../../../server");

export const startLudoServer = (port, { pathLength = 8, timings } = {}) => {
  process.env.LUDO_PATH_LENGTH = String(pathLength);
  if (timings) process.env.LUDO_TIMINGS = JSON.stringify(timings);
  else delete process.env.LUDO_TIMINGS;
  const { Server } = require(path.join(SERVER_DIR, "node_modules/socket.io"));
  const { debugLogger } = require(path.join(SERVER_DIR, "utils/debugLogger"));
  Object.keys(debugLogger || {}).forEach((key) => {
    debugLogger[key] = () => {};
  });
  const ludoSocket = require(path.join(SERVER_DIR, "sockets/ludoSocket"));
  const server = new Server(port, { cors: { origin: "*" } });
  server.on("connection", (socket) => ludoSocket(server, socket, socket.handshake.query?.profile));
  return server;
};

/** A bare socket.io client playing as another person. */
export const connectBareClient = (url, profileId) => {
  const { io } = jest.requireActual("socket.io-client");
  const socket = io(url, { query: { profile: profileId }, transports: ["websocket"], forceNew: true });
  socket.log = [];
  socket.latest = null;
  socket.onAny((event, payload) => socket.log.push({ event, payload, at: Date.now() }));
  socket.on("ludo:state", (state) => {
    if (!socket.latest || state.gameId !== socket.latest.gameId || state.version > socket.latest.version) {
      socket.latest = state;
    }
  });
  socket.ask = (event, payload = {}) => new Promise((resolve) => socket.emit(event, payload, resolve));
  return socket;
};

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

export const pause = async (ms) => {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    // eslint-disable-next-line no-await-in-loop
    await act(async () => {
      await sleep(Math.min(100, Math.max(0, until - Date.now())));
    });
  }
};

export const click = async (el) => {
  if (!el) throw new Error("click: element not found");
  await act(async () => {
    fireEvent.click(el);
  });
};

export const waitFor = async (predicate, { timeout = 10000, label = "condition" } = {}) => {
  const started = Date.now();
  for (;;) {
    const result = predicate();
    if (result) return result;
    if (Date.now() - started > timeout) throw new Error(`Timed out waiting for ${label}`);
    // eslint-disable-next-line no-await-in-loop
    await pause(50);
  }
};

export const q = (selector) => document.querySelector(selector);
export const byTestId = (id) => q(`[data-testid="${id}"]`);
export const buttonByText = (re) =>
  Array.from(document.querySelectorAll("button")).find((b) => re.test(b.textContent.trim()));
export const readyDice = () => q(".ludo-dice-btn.ludo-dice-btn--ready:not([disabled])");
export const playableToken = () => q('button[aria-label^="Piece "]:not([disabled])');
export const hint = () => q(".ludo-turn__hint")?.textContent || "";
export const tokens = () =>
  Array.from(document.querySelectorAll('button[aria-label^="Piece "]'))
    .map((b) => `${b.getAttribute("aria-label")}@${b.parentElement.style.left},${b.parentElement.style.top}`)
    .sort()
    .join("|");

/** One step of play: roll if allowed, else move a glowing piece. */
export const playStep = async () => {
  const winner = byTestId("winner-continue");
  if (winner) await click(winner);
  const dice = readyDice();
  if (dice) {
    await click(dice);
    return true;
  }
  const token = playableToken();
  if (token) {
    await click(token);
    return true;
  }
  return false;
};

export const silenceConsole = () => {
  jest.spyOn(console, "error").mockImplementation(() => {});
  jest.spyOn(console, "log").mockImplementation(() => {});
  jest.spyOn(console, "warn").mockImplementation(() => {});
  jest.spyOn(console, "debug").mockImplementation(() => {});
};

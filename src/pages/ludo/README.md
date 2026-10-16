# Ludo (web)

Every Ludo game is hosted by the server (`server/sockets/ludo/`): it rolls the
dice, checks and applies moves, plays the computer seats, skips players who
are away, keeps pauses, and saves every change to MySQL. This page only sends
intents (roll, move a piece, pause, invite, ...) and draws the state it
receives, so a game can be paused, closed, reloaded or reopened on another
device and continues where it was.

## Routes

- `/ludo-game` — menu: start a game, your games (resume / delete), invites
- `/ludo-game/:gameId` — one game. Reloading the page rejoins it; a player
  opening an invite link takes their seat (`location.state.acceptInvite`).

## Structure

```
LudoGame.js              menu + board screens
hooks/useLudoSocket.js   the page's socket and request(event) -> ack
hooks/useServerGame.js   joins a game (again after every reconnect), actions
utils/stateFeed.js       paces server states: token hops, dice tumble, sounds
utils/boardGeometry.js   board cells for the server's path length
components/GameBoard.js  the board, with each player's photo in their yard
```

`utils/stateFeed.js` has an Expo twin in
`expo-connect-app/src/lib/ludo/stateFeed.ts`; keep them in step.

## Tests

- Server rules and game flows: `cd server && npm run test:ludo`
- Full matches between real web/Expo clients: see `tests/ludo-e2e/README.md`

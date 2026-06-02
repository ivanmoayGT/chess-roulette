# Phase 2 — Live 1v1 Chess

**Goal:** Two matched players play a complete, rule-valid game in real time. Moves are
validated, relayed instantly, and **both boards always show the same state**.

**Requirements served:** #2 (live 1v1 chess).

---

## 2.1 Engine + board choices

- **Rules engine:** `chess.js` — legal move generation, validation, FEN/PGN, check/checkmate/
  stalemate/draw detection. Runs on **both** client (instant UX) and server (authority).
- **Board UI:** `vue3-chessboard` (wraps chessground) — drag/drop, legal-move dots, last-move
  highlight, board orientation. Integrates cleanly with `chess.js`.

---

## 2.2 Authority model (anti-cheat + sync)

Use **client-optimistic, server-authoritative** flow:

1. Player drags a piece. Client validates with its local `chess.js`. If illegal → reject locally.
2. If legal, client applies it locally (instant feedback) and emits `MOVE` `{ roomId, from, to, promotion, fen }`.
3. **Server re-validates** the move against its own `chess.js` for that room:
   - Confirms it's the right player's turn (socket id matches `room.turn` color).
   - Applies the move on the server's board; if illegal/out-of-turn → reject + send correction.
4. Server updates `room.fen` + `room.turn` and **relays the move to the opponent** only.
5. Opponent applies the move to its board → both boards now identical.

> Server validation is what makes the game trustworthy and keeps both clients consistent even
> if one client misbehaves or desyncs.

---

## 2.3 Server move handler

```ts
import { Chess } from 'chess.js'

socket.on(Events.MOVE, (m: MovePayload) => {
  const room = rooms.get(m.roomId)
  if (!room) return

  // turn ownership check
  const isWhite = room.white === socket.id
  const colorMoving = isWhite ? 'white' : 'black'
  if (colorMoving !== room.turn) return // not your turn → ignore

  const game = new Chess(room.fen)
  const result = game.move({ from: m.from, to: m.to, promotion: m.promotion ?? 'q' })
  if (!result) {
    // illegal → tell mover to resync to authoritative fen
    io.to(socket.id).emit('game:resync', { fen: room.fen })
    return
  }

  room.fen = game.fen()
  room.turn = game.turn() === 'w' ? 'white' : 'black'

  // relay to opponent
  socket.to(room.id).emit(Events.MOVE, { ...m, fen: room.fen })

  // game-over detection
  if (game.isGameOver()) {
    io.to(room.id).emit(Events.GAME_OVER, gameOverReason(game))
    rooms.delete(room.id)
  }
})

function gameOverReason(g: Chess) {
  if (g.isCheckmate()) return { reason: 'checkmate', winner: g.turn() === 'w' ? 'black' : 'white' }
  if (g.isStalemate()) return { reason: 'stalemate' }
  if (g.isThreefoldRepetition()) return { reason: 'repetition' }
  if (g.isInsufficientMaterial()) return { reason: 'insufficient-material' }
  if (g.isDraw()) return { reason: 'draw' }
  return { reason: 'over' }
}
```

---

## 2.4 Client game component

Create `src/components/ChessGame.vue` holding a `chess.js` instance + `vue3-chessboard`.

Responsibilities:
- Orient board to the player's color (`orientation = myColor`).
- Only allow the player to move **their own** pieces and **only on their turn**
  (chessground `movable.color` / `turnColor`).
- On a successful local move → emit `MOVE`.
- On incoming `MOVE` from opponent → apply to local `chess.js` + update board position.
- On `game:resync` → reload board from authoritative FEN.
- On `GAME_OVER` → show result overlay (Phase 4).

Sketch:

```ts
import { Chess } from 'chess.js'
const game = new Chess()

function onPieceDrop(from: string, to: string) {
  const move = game.move({ from, to, promotion: 'q' })
  if (!move) return false                  // illegal locally → snap back
  socket.emit(Events.MOVE, { roomId, from, to, promotion: 'q', fen: game.fen() })
  return true
}

socket.on(Events.MOVE, (m) => {
  game.move({ from: m.from, to: m.to, promotion: m.promotion })
  // update vue3-chessboard position to game.fen()
})

socket.on('game:resync', ({ fen }) => {
  game.load(fen)
  // reset board to fen
})
```

---

## 2.5 What "complete game" must cover

- All legal moves incl. **castling, en passant, promotion** (chess.js handles these).
- **Check** indication, **checkmate**, **stalemate**, **draws** (50-move, repetition, insufficient material).
- **Turn enforcement** — you cannot move when it's not your turn or move opponent's pieces.
- **Promotion UI** — at minimum auto-queen; ideally a piece picker (nice-to-have).
- **Resign / leave** — opponent leaving ends the game (already relayed as `OPPONENT_LEFT`).

---

## Deliverables / Definition of Done

- [ ] Two clients show a board oriented to their own color.
- [ ] A legal move on one board appears on the other **within a fraction of a second**.
- [ ] Illegal/out-of-turn moves are rejected (locally + server) and never desync the boards.
- [ ] Special moves (castle, en passant, promotion) work and sync.
- [ ] Checkmate/stalemate/draw is detected and ends the game on both sides identically.

## Risks / notes

- **Promotion default**: sending `promotion: 'q'` keeps it simple; add a picker later.
- **Desync safety net**: the `fen` in `MOVE` + `game:resync` lets a client hard-reset to truth.
- **Latency**: optimistic local apply hides round-trip; server relay corrects if needed.
- **Single source of truth** for "game over" is the server, to avoid one client declaring a
  different result than the other.

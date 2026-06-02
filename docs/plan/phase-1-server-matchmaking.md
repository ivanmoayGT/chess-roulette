# Phase 1 — Hosted Server + Random Matchmaking

**Goal:** A running server that accepts connections, holds a waiting queue, and **randomly
pairs** players into game rooms. Each paired player learns its room, color, and opponent.

**Requirements served:** #1 (hosted server), #3 (random matchmaking).

---

## 1.1 Matchmaking model

- A single in-memory **waiting queue** of socket IDs (no DB needed for the challenge).
- When a player clicks "Find a game", they emit `QUEUE_JOIN` and enter the queue.
- Pairing rule: whenever the queue has **≥ 2 players**, pop two and match them.
  - For true randomness ("10 join → 5 random pairs"), don't just take FIFO — **shuffle the
    queue** (or pick two random indices) before pairing so order of arrival doesn't decide
    opponents.
- Randomly assign colors (white/black) per pair.
- Create a `roomId` (e.g. `crypto.randomUUID()`), join both sockets to that Socket.IO room,
  and emit `MATCH_FOUND` to each with their color + opponent id.

```ts
// server/src/matchmaking.ts
import { randomUUID } from 'node:crypto'

const queue: string[] = []

function shuffle<T>(a: T[]): T[] {
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function enqueue(id: string) {
  if (!queue.includes(id)) queue.push(id)
}

export function dequeue(id: string) {
  const i = queue.indexOf(id)
  if (i !== -1) queue.splice(i, 1)
}

/** Returns a pair to match, or null if not enough players. */
export function tryMatch(): { a: string; b: string } | null {
  if (queue.length < 2) return null
  shuffle(queue)
  const a = queue.shift()!
  const b = queue.shift()!
  return { a, b }
}
```

---

## 1.2 Room/game state

Track active rooms so moves can be relayed and disconnects handled.

```ts
// server/src/room.ts
export interface Room {
  id: string
  white: string           // socket id
  black: string           // socket id
  fen: string             // authoritative position (chess.js startpos initially)
  turn: 'white' | 'black'
}

export const rooms = new Map<string, Room>()

export function findRoomBySocket(id: string): Room | undefined {
  for (const r of rooms.values()) if (r.white === id || r.black === id) return r
}
```

---

## 1.3 Wire it into the server

```ts
// inside io.on('connection', socket => { ... })
import { Events } from '../../shared/protocol'
import { enqueue, dequeue, tryMatch } from './matchmaking'
import { rooms, findRoomBySocket } from './room'
import { Chess } from 'chess.js'          // server re-validates moves
import { randomUUID } from 'node:crypto'

socket.on(Events.QUEUE_JOIN, () => {
  enqueue(socket.id)
  const pair = tryMatch()
  if (!pair) return

  const whiteFirst = Math.random() < 0.5
  const white = whiteFirst ? pair.a : pair.b
  const black = whiteFirst ? pair.b : pair.a
  const roomId = randomUUID()

  rooms.set(roomId, {
    id: roomId, white, black,
    fen: new Chess().fen(), turn: 'white',
  })

  io.sockets.sockets.get(white)?.join(roomId)
  io.sockets.sockets.get(black)?.join(roomId)

  io.to(white).emit(Events.MATCH_FOUND, { roomId, color: 'white', opponentId: black })
  io.to(black).emit(Events.MATCH_FOUND, { roomId, color: 'black', opponentId: white })
})

socket.on('disconnect', () => {
  dequeue(socket.id)
  const room = findRoomBySocket(socket.id)
  if (room) {
    socket.to(room.id).emit(Events.OPPONENT_LEFT)
    rooms.delete(room.id)
  }
})
```

> The actual `MOVE` and `rtc:*` handlers are added in Phases 2 and 3 respectively.

---

## 1.4 Client matchmaking flow

- Lobby screen: a single **"Find a game"** button → `socket.connect()` + `socket.emit(QUEUE_JOIN)`.
- Show a "Searching for an opponent…" state.
- On `MATCH_FOUND`, store `{ roomId, color, opponentId }` in app state and transition to the
  game screen (Phase 2/4).

```ts
socket.on(Events.MATCH_FOUND, (p: MatchFoundPayload) => {
  // set reactive state: phase = 'in-game', myColor = p.color, roomId = p.roomId
})
```

---

## Deliverables / Definition of Done

- [ ] Server holds a waiting queue and pairs the **2nd** joiner with a waiting player.
- [ ] Pairing is **randomized** (shuffle), and colors are assigned randomly.
- [ ] Both clients receive `MATCH_FOUND` with correct, opposite colors and the same `roomId`.
- [ ] Opening 4 browser tabs → 2 independent pairs form (verifies "no fixed pairing").
- [ ] Disconnect while queued removes you from the queue; disconnect in a game notifies opponent.

## Edge cases to handle

- **Odd player out**: the unpaired player stays in queue until another joins.
- **Double-join**: `enqueue` dedupes by socket id.
- **Self-match**: impossible because a socket is only matched once two distinct ids exist.
- **Leaving the queue**: support a `QUEUE_LEAVE` event (optional) so users can cancel searching.

## Test plan

- Two tabs → both get matched within ~instant; colors are opposite.
- Refresh one tab mid-search → it leaves and rejoins cleanly.
- Kill server → client shows a disconnected state (handled in Phase 4 polish).

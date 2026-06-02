# Phase 0 — Foundation

**Goal:** Turn the client-only scaffold into a client + server workspace with shared types,
all dependencies installed, and an empty server that boots. Nothing playable yet — this
unblocks every later phase.

**Requirements served:** Enables #1–#4.

---

## 0.1 Decide repo layout

Keep it simple: add a `server/` folder alongside the existing Vite client at the repo root.
The Vue app stays where it is (`src/`, `index.html`, `vite.config.ts`).

```
chess-roulette/
├── src/                 # existing Vue client
├── server/              # NEW — Node + Socket.IO backend
│   ├── src/
│   │   ├── index.ts     # HTTP + Socket.IO bootstrap
│   │   ├── matchmaking.ts
│   │   ├── room.ts
│   │   └── types.ts     # re-exports shared types
│   ├── package.json
│   └── tsconfig.json
├── shared/              # NEW — types shared by client + server
│   └── protocol.ts      # socket event names + payload types
├── docs/plan/           # this plan
└── package.json         # client (existing)
```

> Alternative if you prefer a single package: serve the built client from the server and run
> one `package.json`. The two-folder split above is clearer for the challenge and easier to
> reason about; Phase 5 covers serving the built client from the same Node process for hosting.

---

## 0.2 Client dependencies

Add to the existing root `package.json`:

```bash
npm i socket.io-client chess.js vue3-chessboard
```

- `socket.io-client` — talk to the server.
- `chess.js` — client-side legal-move generation + validation + game-over detection.
- `vue3-chessboard` — drag/drop board UI (chessground under the hood), Vue 3 friendly.

---

## 0.3 Server scaffold

```bash
mkdir server && cd server
npm init -y
npm i socket.io express
npm i -D typescript tsx @types/express @types/node
npx tsc --init
```

Set `server/package.json` scripts:

```json
{
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/index.ts",
    "build": "tsc",
    "start": "node dist/index.js"
  }
}
```

Minimal `server/src/index.ts` (boots, logs connections — proves the loop works):

```ts
import express from 'express'
import { createServer } from 'node:http'
import { Server } from 'socket.io'

const app = express()
const httpServer = createServer(app)
const io = new Server(httpServer, {
  cors: { origin: process.env.CLIENT_ORIGIN ?? '*' },
})

app.get('/health', (_req, res) => res.json({ ok: true }))

io.on('connection', (socket) => {
  console.log('connected', socket.id)
  socket.on('disconnect', () => console.log('disconnected', socket.id))
})

const PORT = Number(process.env.PORT ?? 3001)
httpServer.listen(PORT, () => console.log(`server on :${PORT}`))
```

---

## 0.4 Shared protocol (`shared/protocol.ts`)

Single source of truth for event names and payloads — imported by both sides so the contract
can't drift.

```ts
export interface MatchFoundPayload {
  roomId: string
  color: 'white' | 'black'
  opponentId: string
}

export interface MovePayload {
  roomId: string
  from: string      // e.g. "e2"
  to: string        // e.g. "e4"
  promotion?: string
  fen: string       // resulting position for verification
}

// WebRTC signaling
export interface SignalPayload {
  roomId: string
  data: unknown     // SDP offer/answer or ICE candidate
}

export const Events = {
  // matchmaking
  QUEUE_JOIN: 'queue:join',
  MATCH_FOUND: 'match:found',
  // game
  MOVE: 'game:move',
  GAME_OVER: 'game:over',
  OPPONENT_LEFT: 'game:opponentLeft',
  // webrtc signaling
  RTC_OFFER: 'rtc:offer',
  RTC_ANSWER: 'rtc:answer',
  RTC_ICE: 'rtc:ice',
} as const
```

> Client imports via a Vite alias (e.g. `@shared`) or a relative path; server imports
> relatively. Add a `@shared` alias to `vite.config.ts` and `tsconfig.json` if you want clean imports.

---

## 0.5 Client/server connection config

The client needs the server URL. Use a Vite env var:

- `.env.development` → `VITE_SERVER_URL=http://localhost:3001`
- In production the client and server share an origin (Phase 5), so it can default to `window.location.origin`.

Create `src/lib/socket.ts`:

```ts
import { io } from 'socket.io-client'

const url = import.meta.env.VITE_SERVER_URL || window.location.origin
export const socket = io(url, { autoConnect: false })
```

---

## Deliverables / Definition of Done

- [ ] `server/` boots with `npm run dev`; `GET /health` returns `{ ok: true }`.
- [ ] Client deps (`socket.io-client`, `chess.js`, `vue3-chessboard`) installed.
- [ ] `shared/protocol.ts` defines event names + payload types, importable by both sides.
- [ ] Client `socket.ts` connects and the server logs `connected <id>`.
- [ ] `.gitignore` already covers `node_modules`/`dist` (verify `server/dist` too).

## Risks / notes

- **TS module config**: server uses ESM (`"type": "module"`); keep `moduleResolution` consistent.
- **CORS**: dev uses different ports; the `cors.origin` above handles it. Lock it down in Phase 5.
- Keep the demo `App.vue` until Phase 4 replaces it, so the client still builds.

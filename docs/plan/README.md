# Chess Roulette — Implementation Plan

> Build an online chess game with **random matchmaking** and **live webcam video**.
> A player opens the app, gets randomly paired with another player over the internet,
> and the two play a full, rule-valid, real-time game of chess while streaming webcam
> video to each other. Think video-chat roulette, across a chessboard.

---

## The four hard requirements (from the brief)

| # | Requirement | What it means | Where it's solved |
|---|-------------|---------------|-------------------|
| 1 | **Hosted server** | Runs online; two *remote* players connect over the internet (not localhost). | Phase 1 + Phase 5 |
| 2 | **Live 1v1 chess** | Complete, rule-valid game. Moves validated + synced instantly; both boards identical. | Phase 2 |
| 3 | **Random matchmaking** | Players paired at random — e.g. 10 join → 5 pairs. No choosing/fixed pairing. | Phase 1 |
| 4 | **Webcam video** | Each matched player streams live webcam to opponent and sees them throughout the match. | Phase 3 |

---

## Current state of the repo

A fresh client-only scaffold — **no game logic, server, or video yet**.

- **Build**: Vite 8, Vue 3.5, TypeScript ~6
- **Styling**: Tailwind CSS v4 (`@tailwindcss/vite`), shadcn-vue (reka-nova style), lucide icons
- **Source**: `src/App.vue` is a demo (buttons only); `src/main.ts` mounts it
- **Missing**: backend server, matchmaking, chess engine, board UI, WebRTC video, deployment config

---

## Architecture at a glance

```
┌─────────────────┐         WebSocket (Socket.IO)        ┌─────────────────┐
│   Player A      │◄────────────────────────────────────►│                 │
│  (Vue client)   │   matchmaking · moves · signaling     │  Node server    │
│                 │                                       │  (Socket.IO)    │
│  ┌───────────┐  │◄────────────────────────────────────►│                 │
│  │ chessboard│  │   matchmaking · moves · signaling     │  - match queue  │
│  │  + chess.js│ │                                       │  - room state   │
│  └───────────┘  │                                       │  - move relay   │
│  ┌───────────┐  │                                       │  - WebRTC relay │
│  │  <video>  │  │                                       └─────────────────┘
│  └───────────┘  │
└────────┬────────┘
         │   WebRTC media (P2P, STUN/TURN)
         │◄──────────────────────────────────────────────► Player B
         ▼
   opponent webcam
```

- **Transport / signaling**: Socket.IO (matchmaking, move relay, WebRTC offer/answer/ICE).
- **Chess rules**: `chess.js` (authoritative validation, also re-validated server-side).
- **Board UI**: `vue3-chessboard` (wraps chessground) for drag/drop + highlights.
- **Video**: native WebRTC (`RTCPeerConnection`) peer-to-peer; server only relays signaling.
- **Hosting**: single Node service serves the built client + WebSocket (Render / Railway / Fly.io).

---

## Phase breakdown

| Phase | File | Goal | Requirement(s) |
|-------|------|------|----------------|
| 0 | [`phase-0-foundation.md`](./phase-0-foundation.md) | Monorepo layout, deps, shared types, server scaffold | Enables all |
| 1 | [`phase-1-server-matchmaking.md`](./phase-1-server-matchmaking.md) | Socket.IO server + random matchmaking + rooms | #1, #3 |
| 2 | [`phase-2-chess-game.md`](./phase-2-chess-game.md) | chess.js + board UI + real-time move sync + validation | #2 |
| 3 | [`phase-3-webcam-webrtc.md`](./phase-3-webcam-webrtc.md) | WebRTC signaling + webcam streams between opponents | #4 |
| 4 | [`phase-4-ui-ux.md`](./phase-4-ui-ux.md) | Lobby/match/game-over screens, turn + status UI, polish | UX for all |
| 5 | [`phase-5-deployment.md`](./phase-5-deployment.md) | Build, host online, env config, verify remote play | #1 |

---

## Recommended build order (60-min sprint version)

If time-boxed, prioritize a **vertical slice** that proves all four requirements end-to-end,
then deepen:

1. **Phase 0** — scaffold server + shared types (10 min)
2. **Phase 1** — matchmaking + room join (15 min)
3. **Phase 2** — board + move sync (15 min)
4. **Phase 3** — webcam video (10 min)
5. **Phase 5** — deploy + smoke test with two remote browsers (10 min)
6. **Phase 4** — polish only if time remains

> The Definition of Done for the whole challenge: two people on **different machines/networks**
> open the deployed URL, get auto-paired, play a legal game to checkmate/resign, and see each
> other's webcam the entire time.

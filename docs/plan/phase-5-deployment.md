# Phase 5 — Hosted Deployment

**Goal:** Put the app online so **two remote players on different machines/networks** can open
one URL, get matched, and play with video — over HTTPS, not localhost.

**Requirements served:** #1 (hosted server) — and it's what makes #3/#4 demonstrable for real.

---

## 5.1 Serve client + server from one origin (recommended)

Simplest hosting + avoids cross-origin/HTTPS headaches: the Node server serves the **built Vue
client** as static files and handles WebSocket on the **same origin**.

1. Build the client: `npm run build` → outputs `dist/`.
2. Have the server serve it:

```ts
import express from 'express'
import path from 'node:path'

const clientDist = path.resolve(process.cwd(), '../dist') // adjust to your layout
app.use(express.static(clientDist))
app.get('*', (_req, res) => res.sendFile(path.join(clientDist, 'index.html')))
```

3. Because client and server share an origin in prod, the client socket can default to
   `window.location.origin` (see Phase 0 `socket.ts`) — no separate `VITE_SERVER_URL` needed.

> Alternative: deploy client (Vercel/Netlify) and server (Render/Railway/Fly) separately.
> Then you **must** set `VITE_SERVER_URL` to the server's HTTPS URL and lock CORS to the
> client origin. The single-origin approach is less error-prone for the challenge.

---

## 5.2 Pick a host

Any platform that runs a long-lived Node process with **WebSocket support** and gives HTTPS:

- **Render** (free web service), **Railway**, **Fly.io**, or a small VPS.
- Requirements: persistent process (Socket.IO needs a live connection — *not* serverless
  functions), automatic HTTPS, configurable `PORT` env.

Build/run commands (single-origin layout):

```
build:  npm install && npm run build && cd server && npm install && npm run build
start:  cd server && npm start
```

Server must listen on `process.env.PORT` (platforms inject it) — already handled in Phase 0.

---

## 5.3 Environment + config checklist

- [ ] `PORT` read from env.
- [ ] `CLIENT_ORIGIN` / CORS set correctly (single-origin → can be same host; split → exact URL).
- [ ] HTTPS enabled (platform-provided) — **required** for `getUserMedia` webcam.
- [ ] Socket.IO works through the platform's proxy (most support WS upgrades by default).
- [ ] **TURN** server configured in `iceServers` for reliable cross-network video
      (STUN-only often fails on mobile/4G/strict NAT). Use a hosted TURN or `coturn`.

---

## 5.4 Production hardening (light, for the challenge)

- Cap queue/room growth; clean up rooms on disconnect (done in Phase 1).
- Basic rate limiting on `QUEUE_JOIN` to prevent spam.
- Don't trust client `fen` — server is authoritative (Phase 2).
- Log connections/matches for debugging during the demo.

---

## 5.5 Smoke test (the real acceptance test)

Do this from **two different devices on different networks** (e.g. laptop on Wi-Fi + phone on
4G, or two people remotely):

1. Both open the deployed HTTPS URL.
2. Both click **Find a game** → they get matched to each other.
3. Camera prompts appear; each sees the **other's** webcam.
4. Play a full legal game; moves sync instantly both ways.
5. Reach checkmate (or resign) → both see the correct game-over result.
6. With 4 testers, confirm they form **2 independent pairs** (random matchmaking).

---

## Deliverables / Definition of Done

- [ ] App reachable at a public HTTPS URL.
- [ ] Two remote players (different networks) match, play a full game, and see each other on webcam.
- [ ] No localhost/hard-wired assumptions remain in client or server config.
- [ ] Reconnect/teardown behaves sanely (refresh, leave, server restart).

## Risks / notes

- **Free tiers sleep**: cold starts can drop the first connection; warm it before a demo.
- **WebSocket support**: verify the platform doesn't strip WS upgrades.
- **TURN is the usual failure point** for "it works on my LAN but not across the internet" —
  budget time to configure it if video must be bulletproof across arbitrary networks.
- **Camera + HTTPS**: webcam silently fails on plain HTTP; confirm the deployed URL is HTTPS.

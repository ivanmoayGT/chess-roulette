# Phase 3 — Webcam Video (WebRTC)

**Goal:** Once matched, each player streams live webcam to their opponent and sees them in
real time for the whole match. Local self-view + remote opponent view.

**Requirements served:** #4 (webcam video).

---

## 3.1 Approach: peer-to-peer WebRTC, server as signaling relay

- Media flows **directly between the two browsers** (P2P) via `RTCPeerConnection` — low latency,
  no media server needed.
- The Socket.IO server only relays **signaling** (SDP offer/answer + ICE candidates) over the
  match room created in Phase 1.
- **STUN** lets peers discover their public addresses; a **TURN** server relays media when P2P
  is blocked by strict NATs/firewalls (important for "two remote players over the internet").

> Optional shortcut: a library like `simple-peer` wraps the handshake. The plan below uses
> **native `RTCPeerConnection`** to keep dependencies minimal and the flow explicit.

---

## 3.2 Signaling protocol (already declared in Phase 0)

- `RTC_OFFER` `{ roomId, data: RTCSessionDescriptionInit }`
- `RTC_ANSWER` `{ roomId, data: RTCSessionDescriptionInit }`
- `RTC_ICE` `{ roomId, data: RTCIceCandidateInit }`

Server just forwards each to the **other** socket in the room:

```ts
for (const ev of [Events.RTC_OFFER, Events.RTC_ANSWER, Events.RTC_ICE]) {
  socket.on(ev, (p: SignalPayload) => socket.to(p.roomId).emit(ev, p))
}
```

---

## 3.3 Who initiates?

Avoid "glare" (both sending offers). Rule: **the white player is the WebRTC initiator** (caller),
the black player is the callee. Both already know their color from `MATCH_FOUND`.

---

## 3.4 Client WebRTC flow

`src/lib/webrtc.ts` (or a `useWebcam` composable):

```ts
const config: RTCConfiguration = {
  iceServers: [
    { urls: 'stun:stun.l.google.com:19302' },
    // TURN (production): { urls: 'turn:...', username, credential }
  ],
}

export async function startWebcam(opts: {
  roomId: string
  isInitiator: boolean
  onRemoteStream: (s: MediaStream) => void
}) {
  const pc = new RTCPeerConnection(config)
  const local = await navigator.mediaDevices.getUserMedia({ video: true, audio: true })
  local.getTracks().forEach((t) => pc.addTrack(t, local))

  pc.ontrack = (e) => opts.onRemoteStream(e.streams[0])
  pc.onicecandidate = (e) => {
    if (e.candidate) socket.emit(Events.RTC_ICE, { roomId: opts.roomId, data: e.candidate })
  }

  socket.on(Events.RTC_OFFER, async ({ data }) => {
    await pc.setRemoteDescription(data as RTCSessionDescriptionInit)
    const answer = await pc.createAnswer()
    await pc.setLocalDescription(answer)
    socket.emit(Events.RTC_ANSWER, { roomId: opts.roomId, data: answer })
  })
  socket.on(Events.RTC_ANSWER, async ({ data }) =>
    pc.setRemoteDescription(data as RTCSessionDescriptionInit))
  socket.on(Events.RTC_ICE, async ({ data }) =>
    pc.addIceCandidate(data as RTCIceCandidateInit))

  if (opts.isInitiator) {
    const offer = await pc.createOffer()
    await pc.setLocalDescription(offer)
    socket.emit(Events.RTC_OFFER, { roomId: opts.roomId, data: offer })
  }

  return { pc, local }
}
```

> ICE candidates can arrive before `setRemoteDescription`. For robustness, **buffer ICE
> candidates** until the remote description is set, then flush them.

---

## 3.5 Video UI

- **Self-view**: small local `<video muted autoplay playsinline>` (mute to avoid echo).
- **Opponent view**: larger `<video autoplay playsinline>` fed by the remote stream.
- Place alongside the board (e.g. opponent video above the board, self-view below / corner).
- Handle **permission denied / no camera**: still allow chess to proceed; show a placeholder
  ("Camera off") instead of breaking the match.

```ts
const { local } = await startWebcam({
  roomId, isInitiator: myColor === 'white',
  onRemoteStream: (s) => { remoteVideoEl.srcObject = s },
})
localVideoEl.srcObject = local
```

---

## 3.6 Lifecycle

- Start webcam **right after `MATCH_FOUND`** (so signaling rides the same room).
- On `GAME_OVER` / `OPPONENT_LEFT` / leaving: stop all local tracks
  (`local.getTracks().forEach(t => t.stop())`) and `pc.close()` to release the camera light.

---

## Deliverables / Definition of Done

- [ ] On match, browser prompts for camera/mic and shows the local self-view.
- [ ] Each player sees the **opponent's** live video within a couple seconds of matching.
- [ ] Video persists for the whole game and tears down cleanly on game end/leave.
- [ ] Works between two **different machines/networks** (validated with STUN; TURN if needed).
- [ ] Denying camera permission degrades gracefully (chess still works).

## Risks / notes

- **HTTPS required**: `getUserMedia` only works on `https://` or `localhost`. Phase 5 deploy
  must serve over HTTPS (hosting platforms provide this).
- **NAT traversal**: STUN covers most cases; for reliable cross-network video add **TURN**
  (e.g. a hosted TURN service or `coturn`). Don't rely on STUN-only for the demo across mobile/4G.
- **Glare/race**: fixed by the white-initiates rule + ICE buffering.
- **Autoplay**: set `playsinline` + `autoplay`; remote may need a user gesture on some browsers.

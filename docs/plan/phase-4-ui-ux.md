# Phase 4 — UI/UX, Game States & Polish

**Goal:** Tie the pieces together behind clear screens and states. Replace the demo `App.vue`
with a real app flow: lobby → searching → in-game (board + video + status) → game over.

**Requirements served:** UX layer over #1–#4.

---

## 4.1 App state machine

A single reactive `phase` drives what renders:

```
'lobby'  ──Find a game──▶  'searching'  ──MATCH_FOUND──▶  'in-game'
   ▲                                                          │
   └──────────── play again / leave ◀── 'game-over' ◀── GAME_OVER / OPPONENT_LEFT
```

Hold app state in a small store (Pinia is optional; a `reactive()` object or composable is fine):

```ts
const state = reactive({
  phase: 'lobby' as 'lobby' | 'searching' | 'in-game' | 'game-over',
  roomId: '' as string,
  myColor: 'white' as 'white' | 'black',
  opponentId: '',
  result: null as null | { reason: string; winner?: 'white' | 'black' },
})
```

---

## 4.2 Screens

**Lobby** (`LobbyView.vue`)
- App title + short tagline (matches the brief's "Chess Roulette" vibe).
- Big **"Find a game"** button → connect + `QUEUE_JOIN`, go to `searching`.

**Searching** (`SearchingView.vue`)
- Spinner + "Finding you an opponent…" + a **Cancel** button (emits `QUEUE_LEAVE`).

**In-game** (`GameView.vue`) — the core screen, composed of:
- `ChessGame.vue` (Phase 2) centered.
- Opponent webcam (Phase 3) prominent; local self-view small/corner.
- **Status bar**: whose turn it is, your color, check indicator, opponent connection status.
- **Resign / Leave** button.

**Game over** (`GameOverView.vue` or overlay)
- Result text: "Checkmate — White wins", "Stalemate — Draw", "Opponent left", etc.
- **Play again** (re-queue) and **Back to lobby** buttons.

---

## 4.3 Status & feedback details

- **Turn indicator**: highlight "Your move" vs "Opponent's move".
- **Check**: visual cue when a king is in check.
- **Last move**: board highlights origin/target squares (vue3-chessboard supports this).
- **Connection health**: if socket disconnects, show a banner + attempt reconnect.
- **Opponent left**: immediate overlay (from `OPPONENT_LEFT`) with Play again.
- **Camera state**: badge when opponent's camera is off / not yet connected.

---

## 4.4 Styling

Reuse the existing stack (Tailwind v4 + shadcn-vue):
- Use existing `Button` component for actions.
- Add cards/overlays with shadcn-vue components as needed (`Card`, `Dialog`).
- Keep the dark, high-contrast aesthetic from the brief screenshot (amber accent on dark).
- Responsive: board + videos stack vertically on narrow screens.

---

## 4.5 Wire-up in `App.vue`

`App.vue` becomes a thin router on `state.phase`:

```vue
<template>
  <LobbyView v-if="state.phase === 'lobby'" />
  <SearchingView v-else-if="state.phase === 'searching'" />
  <GameView v-else-if="state.phase === 'in-game'" />
  <GameOverView v-else />
</template>
```

Central socket listeners (set once on mount): `MATCH_FOUND`, `GAME_OVER`, `OPPONENT_LEFT`,
`game:resync`, `disconnect`.

---

## Deliverables / Definition of Done

- [ ] Demo buttons removed; real lobby → searching → game → game-over flow works.
- [ ] Turn, color, check, and last-move are clearly visible during play.
- [ ] Game-over overlay shows the correct result and offers **Play again**.
- [ ] Opponent-left and disconnect states are handled with clear messaging.
- [ ] Layout is responsive and readable on a laptop screen.

## Nice-to-haves (only if time remains)

- Move list / captured pieces.
- Simple per-player clock.
- Promotion piece picker (instead of auto-queen).
- Sound on move/check.
- Mute/disable-camera toggles.

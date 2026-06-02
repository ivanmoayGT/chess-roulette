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

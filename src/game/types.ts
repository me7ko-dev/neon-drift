export type GamePhase = 'title' | 'playing' | 'paused' | 'gameover';

export type TrafficKind = 'sedan' | 'van' | 'coupe';

export interface HudSnapshot {
  phase: GamePhase;
  score: number;
  bestScore: number;
  coins: number;
  speedKmh: number;
  maxSpeedKmh: number;
  distanceMeters: number;
  isNewBest: boolean;
  muted: boolean;
}

export interface TrafficEntity {
  id: number;
  kind: TrafficKind;
  laneIndex: number;
  x: number;
  z: number;
  speed: number;
  halfWidth: number;
  halfLength: number;
  colorIndex: number;
}

export interface CoinEntity {
  id: number;
  laneIndex: number;
  x: number;
  z: number;
  collected: boolean;
  phaseOffset: number;
}

export interface SimulationState {
  phase: GamePhase;
  elapsedPlayTime: number;
  distance: number;
  score: number;
  bestScore: number;
  coins: number;
  isNewBest: boolean;
  playerX: number;
  playerVx: number;
  playerRoll: number;
  playerYaw: number;
  speed: number;
  maxSpeed: number;
  crashBeatTimer: number;
  crashing: boolean;
  nextEntityId: number;
  spawnCooldown: number;
  coinCooldown: number;
  traffic: TrafficEntity[];
  coinItems: CoinEntity[];
}

export interface StepEvents {
  pickedCoins: Array<{ x: number; z: number }>;
  crashedAt: { x: number; z: number } | null;
  enteredGameOver: boolean;
}

export interface InputIntent {
  steer: number; // -1 (left) to +1 (right)
}

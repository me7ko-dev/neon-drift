import {
  CoinEntity,
  GamePhase,
  HudSnapshot,
  InputIntent,
  SimulationState,
  StepEvents,
  TrafficEntity,
  TrafficKind,
} from './types';

export const LANE_CENTERS = [-4.8, -1.6, 1.6, 4.8] as const;
export const ROAD_WIDTH = 13.6;
export const PLAYER_MAX_X = 5.45;
export const PLAYER_HALF_WIDTH = 0.86;
export const PLAYER_HALF_LENGTH = 1.9;

export const BASE_SPEED = 32;
export const MAX_SPEED = 84;
export const SPEED_RAMP_PER_SEC = 0.72;
export const SPEED_TO_KMH = 3.6;

export const SPAWN_Z = -135;
export const DESPAWN_Z = 22;
export const COIN_VALUE = 50;
export const CRASH_BEAT_DURATION = 0.58;
export const BEST_SCORE_STORAGE_KEY = 'neon_drift_best_score_v1';

const TRAFFIC_SPECS: Record<
  TrafficKind,
  { speed: number; halfWidth: number; halfLength: number }
> = {
  sedan: { speed: 15, halfWidth: 0.9, halfLength: 1.95 },
  van: { speed: 10.5, halfWidth: 1.0, halfLength: 2.35 },
  coupe: { speed: 21, halfWidth: 0.86, halfLength: 1.85 },
};

export function loadBestScore(): number {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return 0;
    const raw = window.localStorage.getItem(BEST_SCORE_STORAGE_KEY);
    const parsed = raw ? Number.parseInt(raw, 10) : 0;
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 0;
  } catch {
    return 0;
  }
}

export function saveBestScore(score: number): void {
  try {
    if (typeof window === 'undefined' || !window.localStorage) return;
    window.localStorage.setItem(BEST_SCORE_STORAGE_KEY, String(Math.max(0, Math.round(score))));
  } catch {
    // Ignore storage quota or private-mode errors
  }
}

export function computeSpeed(elapsedPlayTime: number): number {
  return Math.min(MAX_SPEED, BASE_SPEED + Math.max(0, elapsedPlayTime) * SPEED_RAMP_PER_SEC);
}

export function computeScore(distance: number, coins: number): number {
  return Math.round(distance * 1.45 + coins * COIN_VALUE);
}

export function createInitialState(initialPhase: GamePhase = 'title', bestScore = 0): SimulationState {
  const state: SimulationState = {
    phase: initialPhase,
    elapsedPlayTime: 0,
    distance: 0,
    score: 0,
    bestScore: Math.max(0, Math.round(bestScore)),
    coins: 0,
    isNewBest: false,
    playerX: 0,
    playerVx: 0,
    playerRoll: 0,
    playerYaw: 0,
    speed: BASE_SPEED,
    maxSpeed: BASE_SPEED,
    crashBeatTimer: 0,
    crashing: false,
    nextEntityId: 1,
    spawnCooldown: 0.55,
    coinCooldown: 0.35,
    traffic: [],
    coinItems: [],
  };

  if (initialPhase === 'playing') {
    seedOpeningHighway(state);
  }
  return state;
}

function seedOpeningHighway(state: SimulationState): void {
  // Distant side-lane vehicle (safe from center x=0) and an opening line of coins ahead
  state.traffic.push({
    id: state.nextEntityId++,
    kind: 'sedan',
    laneIndex: 3,
    x: LANE_CENTERS[3],
    z: -95,
    speed: TRAFFIC_SPECS.sedan.speed,
    halfWidth: TRAFFIC_SPECS.sedan.halfWidth,
    halfLength: TRAFFIC_SPECS.sedan.halfLength,
    colorIndex: 0,
  });
  state.traffic.push({
    id: state.nextEntityId++,
    kind: 'coupe',
    laneIndex: 0,
    x: LANE_CENTERS[0],
    z: -125,
    speed: TRAFFIC_SPECS.coupe.speed,
    halfWidth: TRAFFIC_SPECS.coupe.halfWidth,
    halfLength: TRAFFIC_SPECS.coupe.halfLength,
    colorIndex: 2,
  });
  for (let i = 0; i < 3; i++) {
    state.coinItems.push({
      id: state.nextEntityId++,
      laneIndex: 1,
      x: LANE_CENTERS[1],
      z: -56 - i * 4.2,
      collected: false,
      phaseOffset: i * 0.65,
    });
  }
}

export function resetForNewRun(state: SimulationState): void {
  const preservedBest = state.bestScore;
  const fresh = createInitialState('playing', preservedBest);
  Object.assign(state, fresh);
}

export function toHudSnapshot(state: SimulationState, muted: boolean): HudSnapshot {
  return {
    phase: state.phase,
    score: state.score,
    bestScore: state.bestScore,
    coins: state.coins,
    speedKmh: Math.round(state.speed * SPEED_TO_KMH),
    maxSpeedKmh: Math.round(state.maxSpeed * SPEED_TO_KMH),
    distanceMeters: Math.round(state.distance),
    isNewBest: state.isNewBest,
    muted,
  };
}

function damp(current: number, target: number, lambda: number, dt: number): number {
  return current + (target - current) * (1 - Math.exp(-lambda * dt));
}

function pickTrafficKind(rng: () => number): TrafficKind {
  const r = rng();
  if (r < 0.45) return 'sedan';
  if (r < 0.78) return 'coupe';
  return 'van';
}

function isLaneBlockedNearSpawn(traffic: TrafficEntity[], laneIndex: number, minGapZ: number): boolean {
  for (const car of traffic) {
    if (car.laneIndex === laneIndex && car.z < SPAWN_Z + minGapZ) {
      return true;
    }
  }
  return false;
}

function countBlockedLanesNearSpawn(traffic: TrafficEntity[], windowZ: number): number {
  const blocked = new Set<number>();
  for (const car of traffic) {
    if (car.z < SPAWN_Z + windowZ) {
      blocked.add(car.laneIndex);
    }
  }
  return blocked.size;
}

function spawnTrafficWave(state: SimulationState, rng: () => number): void {
  const progress = Math.min(1, state.elapsedPlayTime / 65);
  const safeWindowZ = 22 + progress * 8;
  const blockedCount = countBlockedLanesNearSpawn(state.traffic, safeWindowZ);
  if (blockedCount >= 3) {
    // Always guarantee at least 1 open lane through every longitudinal band
    return;
  }

  const candidateLanes = [0, 1, 2, 3].filter(
    (lane) => !isLaneBlockedNearSpawn(state.traffic, lane, 18),
  );
  if (candidateLanes.length === 0) return;

  const firstIdx = Math.floor(rng() * candidateLanes.length);
  const firstLane = candidateLanes[firstIdx];
  const spawnCount =
    progress > 0.25 && rng() < 0.35 + progress * 0.25 && blockedCount <= 1 && candidateLanes.length >= 2
      ? 2
      : 1;

  const chosenLanes = [firstLane];
  if (spawnCount === 2) {
    const remaining = candidateLanes.filter((l) => l !== firstLane);
    if (remaining.length > 0) {
      chosenLanes.push(remaining[Math.floor(rng() * remaining.length)]);
    }
  }

  for (let i = 0; i < chosenLanes.length; i++) {
    const laneIndex = chosenLanes[i];
    const kind = pickTrafficKind(rng);
    const spec = TRAFFIC_SPECS[kind];
    const zJitter = i === 0 ? 0 : -(4 + rng() * 8);
    state.traffic.push({
      id: state.nextEntityId++,
      kind,
      laneIndex,
      x: LANE_CENTERS[laneIndex],
      z: SPAWN_Z + zJitter,
      speed: spec.speed + (rng() - 0.5) * 2.0,
      halfWidth: spec.halfWidth,
      halfLength: spec.halfLength,
      colorIndex: Math.floor(rng() * 4),
    });
  }
}

function spawnCoinLine(state: SimulationState, rng: () => number): void {
  const openLanes = [0, 1, 2, 3].filter(
    (lane) => !isLaneBlockedNearSpawn(state.traffic, lane, 24),
  );
  if (openLanes.length === 0) return;

  const laneIndex = openLanes[Math.floor(rng() * openLanes.length)];
  const count = rng() < 0.55 ? 3 : 2;
  for (let i = 0; i < count; i++) {
    const coin: CoinEntity = {
      id: state.nextEntityId++,
      laneIndex,
      x: LANE_CENTERS[laneIndex],
      z: SPAWN_Z - i * 4.2,
      collected: false,
      phaseOffset: i * 0.65,
    };
    state.coinItems.push(coin);
  }
}

export function checkAabbOverlap(
  ax: number,
  az: number,
  aHalfW: number,
  aHalfL: number,
  bx: number,
  bz: number,
  bHalfW: number,
  bHalfL: number,
): boolean {
  return Math.abs(ax - bx) < aHalfW + bHalfW && Math.abs(az - bz) < aHalfL + bHalfL;
}

export function stepSimulation(
  state: SimulationState,
  rawDt: number,
  input: InputIntent,
  rng: () => number = Math.random,
): StepEvents {
  const events: StepEvents = {
    pickedCoins: [],
    crashedAt: null,
    enteredGameOver: false,
  };

  const dt = Math.min(Math.max(rawDt, 0), 0.05);
  if (dt <= 0) return events;

  // Title mode: smooth autonomous cruise
  if (state.phase === 'title') {
    state.speed = BASE_SPEED * 0.9;
    state.distance += state.speed * dt;
    state.playerX = Math.sin(state.distance * 0.025) * 1.4;
    state.playerRoll = Math.cos(state.distance * 0.025) * -0.03;
    state.playerYaw = Math.cos(state.distance * 0.025) * -0.02;
    return events;
  }

  if (state.phase !== 'playing') {
    return events;
  }

  // Handle post-crash dramatic slow-motion beat before Game Over modal opens
  if (state.crashing) {
    state.crashBeatTimer -= dt;
    state.speed = Math.max(0, state.speed - 65 * dt);
    state.playerRoll = damp(state.playerRoll, 0.24, 10, dt);
    if (state.crashBeatTimer <= 0) {
      state.crashing = false;
      state.phase = 'gameover';
      events.enteredGameOver = true;
    }
    return events;
  }

  // Advance play time and speed ramp
  state.elapsedPlayTime += dt;
  state.speed = computeSpeed(state.elapsedPlayTime);
  if (state.speed > state.maxSpeed) {
    state.maxSpeed = state.speed;
  }

  // Smooth lateral steering with exponential damping & arcade responsiveness
  const steerInput = Math.max(-1, Math.min(1, input.steer));
  const steerMaxVel = 13.5 + (state.speed - BASE_SPEED) * 0.09;
  const targetVx = steerInput * steerMaxVel;
  state.playerVx = damp(state.playerVx, targetVx, 14, dt);
  state.playerX += state.playerVx * dt;

  if (state.playerX < -PLAYER_MAX_X) {
    state.playerX = -PLAYER_MAX_X;
    if (state.playerVx < 0) state.playerVx = 0;
  } else if (state.playerX > PLAYER_MAX_X) {
    state.playerX = PLAYER_MAX_X;
    if (state.playerVx > 0) state.playerVx = 0;
  }

  // Body roll & slight yaw into turns
  const normalizedVx = state.playerVx / steerMaxVel;
  state.playerRoll = damp(state.playerRoll, -normalizedVx * 0.14, 14, dt);
  state.playerYaw = damp(state.playerYaw, -normalizedVx * 0.12, 14, dt);

  // Distance and score
  state.distance += state.speed * dt;
  state.score = computeScore(state.distance, state.coins);
  if (state.score > state.bestScore) {
    state.bestScore = state.score;
    state.isNewBest = true;
  }

  // Spawning traffic & coins
  state.spawnCooldown -= dt;
  if (state.spawnCooldown <= 0) {
    spawnTrafficWave(state, rng);
    const difficulty = Math.min(1, state.elapsedPlayTime / 65);
    const minInterval = 0.95 - difficulty * 0.48;
    const maxInterval = 1.45 - difficulty * 0.62;
    state.spawnCooldown = minInterval + rng() * Math.max(0.15, maxInterval - minInterval);
  }

  state.coinCooldown -= dt;
  if (state.coinCooldown <= 0) {
    spawnCoinLine(state, rng);
    state.coinCooldown = 1.35 + rng() * 1.1;
  }

  // Update traffic & check collisions
  for (let i = state.traffic.length - 1; i >= 0; i--) {
    const car = state.traffic[i];
    const relSpeed = state.speed - car.speed;
    car.z += relSpeed * dt;

    if (
      checkAabbOverlap(
        state.playerX,
        0,
        PLAYER_HALF_WIDTH,
        PLAYER_HALF_LENGTH,
        car.x,
        car.z,
        car.halfWidth,
        car.halfLength,
      )
    ) {
      state.crashing = true;
      state.crashBeatTimer = CRASH_BEAT_DURATION;
      events.crashedAt = { x: state.playerX, z: -1.0 };
      if (state.score >= state.bestScore) {
        saveBestScore(state.bestScore);
      }
      return events;
    }

    if (car.z > DESPAWN_Z) {
      state.traffic.splice(i, 1);
    }
  }

  // Update coins & check pickups
  for (let i = state.coinItems.length - 1; i >= 0; i--) {
    const coin = state.coinItems[i];
    coin.z += state.speed * dt;

    if (
      !coin.collected &&
      checkAabbOverlap(
        state.playerX,
        0,
        PLAYER_HALF_WIDTH + 0.55,
        PLAYER_HALF_LENGTH + 0.35,
        coin.x,
        coin.z,
        0.55,
        0.55,
      )
    ) {
      coin.collected = true;
      state.coins += 1;
      state.score = computeScore(state.distance, state.coins);
      if (state.score > state.bestScore) {
        state.bestScore = state.score;
        state.isNewBest = true;
      }
      events.pickedCoins.push({ x: coin.x, z: coin.z });
      state.coinItems.splice(i, 1);
      continue;
    }

    if (coin.z > DESPAWN_Z) {
      state.coinItems.splice(i, 1);
    }
  }

  return events;
}

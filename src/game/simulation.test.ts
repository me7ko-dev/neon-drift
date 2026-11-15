import test from 'node:test';
import assert from 'node:assert/strict';
import {
  BASE_SPEED,
  COIN_VALUE,
  LANE_CENTERS,
  MAX_SPEED,
  PLAYER_MAX_X,
  computeScore,
  computeSpeed,
  createInitialState,
  resetForNewRun,
  stepSimulation,
} from './simulation';

function makeSeededRng(seed = 42): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

test('speed gradually increases over play time and caps at MAX_SPEED', () => {
  assert.equal(computeSpeed(0), BASE_SPEED);
  const midSpeed = computeSpeed(20);
  assert.ok(midSpeed > BASE_SPEED, 'speed should increase after 20s');
  assert.ok(midSpeed < MAX_SPEED, 'speed should not hit cap too early');
  assert.equal(computeSpeed(500), MAX_SPEED);
});

test('player steering moves smoothly within road bounds', () => {
  const state = createInitialState('playing', 0);
  const rng = makeSeededRng(1);

  for (let i = 0; i < 40; i++) {
    stepSimulation(state, 0.016, { steer: 1 }, rng);
  }
  assert.ok(state.playerX > 2.5, 'player should steer right');
  assert.ok(state.playerX <= PLAYER_MAX_X, 'player must stay inside right rail');

  for (let i = 0; i < 120; i++) {
    stepSimulation(state, 0.016, { steer: -1 }, rng);
  }
  assert.ok(state.playerX < -2.5, 'player should steer left');
  assert.ok(state.playerX >= -PLAYER_MAX_X, 'player must stay inside left rail');
});

test('game survives initial seconds without any input', () => {
  const state = createInitialState('playing', 0);
  const rng = makeSeededRng(99);

  for (let i = 0; i < 120; i++) {
    stepSimulation(state, 0.016, { steer: 0 }, rng);
  }
  assert.equal(state.phase, 'playing');
  assert.equal(state.crashing, false);
  assert.ok(state.score > 0);
});

test('collecting a coin awards bonus points and emits pickup event', () => {
  const state = createInitialState('playing', 0);
  state.coinItems.push({
    id: 999,
    laneIndex: 1,
    x: 0,
    z: -0.5,
    collected: false,
    phaseOffset: 0,
  });

  const events = stepSimulation(state, 0.016, { steer: 0 }, makeSeededRng(7));
  assert.equal(events.pickedCoins.length, 1);
  assert.equal(state.coins, 1);
  assert.ok(state.score >= COIN_VALUE);
});

test('colliding with traffic enters crash beat and then gameover with preserved best score', () => {
  const state = createInitialState('playing', 100);
  state.traffic.push({
    id: 888,
    kind: 'sedan',
    laneIndex: 1,
    x: 0,
    z: -0.5,
    speed: 10,
    halfWidth: 0.9,
    halfLength: 1.95,
    colorIndex: 0,
  });

  const crashEvents = stepSimulation(state, 0.016, { steer: 0 }, makeSeededRng(3));
  assert.ok(crashEvents.crashedAt !== null, 'should detect collision');
  assert.equal(state.crashing, true);

  let enteredGameOver = false;
  for (let i = 0; i < 30; i++) {
    const ev = stepSimulation(state, 0.03, { steer: 0 }, makeSeededRng(3));
    if (ev.enteredGameOver) enteredGameOver = true;
  }
  assert.equal(enteredGameOver, true);
  assert.equal(state.phase, 'gameover');

  resetForNewRun(state);
  assert.equal(state.phase, 'playing');
  assert.equal(state.score, 0);
  assert.equal(state.coins, 0);
  assert.equal(state.bestScore, 100);
  assert.equal(state.traffic.some((t) => t.id === 888), false);
  assert.ok(state.traffic.every((t) => t.z < -80));
});

test('traffic spawning never blocks all 4 lanes simultaneously', () => {
  const state = createInitialState('playing', 0);
  const rng = makeSeededRng(1234);

  for (let step = 0; step < 1800; step++) {
    stepSimulation(state, 0.03, { steer: 0 }, rng);
    if (state.crashing || state.phase === 'gameover') {
      resetForNewRun(state);
    }
    // Check longitudinal slice near z = -100..-80
    const blockedLanes = new Set<number>();
    for (const car of state.traffic) {
      if (car.z > -100 && car.z < -78) {
        blockedLanes.add(car.laneIndex);
      }
    }
    assert.ok(
      blockedLanes.size < LANE_CENTERS.length,
      `all 4 lanes blocked at step ${step}`,
    );
  }
});

test('score formula combines distance and coin bonus cleanly', () => {
  assert.equal(computeScore(100, 2), Math.round(100 * 1.45 + 2 * COIN_VALUE));
});

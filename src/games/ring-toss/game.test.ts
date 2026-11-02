import { describe, expect, it } from 'vitest';
import {
  BOTTLE_COUNT,
  FLIGHT_TIME,
  MAX_ANGLE,
  MAX_DISTANCE,
  MIN_DISTANCE,
  RANGE_PERIOD,
  RING_COUNT,
  SWING_PERIOD,
  TOSSER,
  backToFront,
  bottleUnder,
  createState,
  landingPoint,
  lockIn,
  placeBottles,
  step,
  type RingTossState,
} from './game';

/** Locks in the current aim and lets the ring land. */
function toss(state: RingTossState, angle: number, distance: number) {
  lockIn(state);
  lockIn(state);
  state.flight!.to = landingPoint(angle, distance);
  step(state, FLIGHT_TIME);
}

describe('ring toss', () => {
  it('starts with 15 bottles, 5 rings and no score', () => {
    const state = createState();
    expect(state.bottles).toHaveLength(BOTTLE_COUNT);
    expect(BOTTLE_COUNT).toBe(15);
    expect(state.ringsLeft).toBe(RING_COUNT);
    expect(RING_COUNT).toBe(5);
    expect(state.score).toBe(0);
    expect(state.phase).toBe('aiming');
  });

  it('scatters the bottles at random, apart and within reach', () => {
    const first = placeBottles();
    const second = placeBottles();
    expect(first).not.toEqual(second);
    for (const bottle of first) {
      const distance = Math.hypot(bottle.x - TOSSER.x, bottle.y - TOSSER.y);
      expect(distance).toBeGreaterThanOrEqual(MIN_DISTANCE);
      expect(distance).toBeLessThanOrEqual(MAX_DISTANCE);
      const angle = Math.atan2(bottle.x - TOSSER.x, TOSSER.y - bottle.y);
      expect(Math.abs(angle)).toBeLessThanOrEqual(MAX_ANGLE);
      for (const other of first) {
        if (other !== bottle) {
          expect(Math.hypot(other.x - bottle.x, other.y - bottle.y)).toBeGreaterThan(20);
        }
      }
    }
  });

  it('still places every bottle with a random source that always repeats', () => {
    expect(placeBottles(() => 0.5)).toHaveLength(BOTTLE_COUNT);
  });

  it('swings the direction left and right until the first click', () => {
    const state = createState();
    step(state, SWING_PERIOD / 4);
    expect(state.angle).toBeCloseTo(MAX_ANGLE);
    step(state, SWING_PERIOD / 2);
    expect(state.angle).toBeCloseTo(-MAX_ANGLE);
    expect(lockIn(state)).toBe(true);
    expect(state.phase).toBe('ranging');
    step(state, 0.3);
    expect(state.angle).toBeCloseTo(-MAX_ANGLE);
  });

  it('moves the distance from the front to the back and loops until the second click', () => {
    const state = createState();
    lockIn(state);
    expect(state.distance).toBe(MIN_DISTANCE);
    step(state, RANGE_PERIOD / 2);
    expect(state.distance).toBeCloseTo(MAX_DISTANCE);
    step(state, RANGE_PERIOD / 2);
    expect(state.distance).toBeCloseTo(MIN_DISTANCE);
    step(state, RANGE_PERIOD / 4);
    const locked = state.distance;
    lockIn(state);
    expect(state.phase).toBe('flying');
    expect(state.flight!.to).toEqual(landingPoint(state.angle, locked));
  });

  it('ignores clicks while a ring is in the air', () => {
    const state = createState();
    lockIn(state);
    lockIn(state);
    expect(lockIn(state)).toBe(false);
    expect(state.ringsLeft).toBe(RING_COUNT - 1);
  });

  it('scores a ring that lands over a bottle', () => {
    const state = createState();
    const bottle = state.bottles[0];
    lockIn(state);
    lockIn(state);
    state.flight!.to = { x: bottle.x + 5, y: bottle.y };
    step(state, FLIGHT_TIME);
    expect(state.score).toBe(1);
    expect(bottle.ringed).toBe(true);
    expect(state.rings).toEqual([{ x: bottle.x + 5, y: bottle.y, scored: true }]);
    expect(state.phase).toBe('aiming');
  });

  it('scores a ring that lands up to 22 px from the middle of a bottle', () => {
    const bottles = [{ x: 100, y: 100, ringed: false }];
    expect(bottleUnder(bottles, { x: 122, y: 100 })).toBe(bottles[0]);
    expect(bottleUnder(bottles, { x: 123, y: 100 })).toBeUndefined();
  });

  it('scores nothing for a ring that misses every bottle', () => {
    const state = createState();
    state.bottles = [{ x: 100, y: 100, ringed: false }];
    toss(state, 0, MIN_DISTANCE);
    expect(state.score).toBe(0);
    expect(state.rings[0].scored).toBe(false);
  });

  it('lets each bottle take only one ring', () => {
    const bottles = [{ x: 100, y: 100, ringed: true }];
    expect(bottleUnder(bottles, { x: 100, y: 100 })).toBeUndefined();
  });

  it('ends the round when the fifth ring lands', () => {
    const state = createState();
    for (let i = 0; i < RING_COUNT; i++) {
      expect(state.phase).toBe('aiming');
      toss(state, 0, MIN_DISTANCE);
    }
    expect(state.ringsLeft).toBe(0);
    expect(state.rings).toHaveLength(RING_COUNT);
    expect(state.phase).toBe('over');
    expect(lockIn(state)).toBe(false);
  });

  it('draws bottles from the back of the table to the front, leaving the state alone', () => {
    const state = createState();
    const order = state.bottles.map((b) => b.y);
    const drawn = backToFront(state.bottles);
    expect(drawn).toHaveLength(BOTTLE_COUNT);
    for (let i = 1; i < drawn.length; i++)
      expect(drawn[i].y).toBeGreaterThanOrEqual(drawn[i - 1].y);
    expect(state.bottles.map((b) => b.y)).toEqual(order);
  });
});

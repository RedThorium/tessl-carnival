import { canvasFont, recordScore, theme, type CarnivalGame } from '../../carnival';

const { width: WIDTH, height: HEIGHT } = theme.canvas;

export const BOTTLE_COUNT = 15;
export const RING_COUNT = 5;
export const TOSSER = { x: WIDTH / 2, y: HEIGHT - 40 } as const;
/** How far left or right of straight ahead the tosser swings, in radians. */
export const MAX_ANGLE = 1;
export const MIN_DISTANCE = 70;
export const MAX_DISTANCE = 400;
/** Seconds for one full swing, left to right and back. */
export const SWING_PERIOD = 2;
/** Seconds for the distance to go from the front to the back and back again. */
export const RANGE_PERIOD = 2;
export const FLIGHT_TIME = 0.6;
export const BOTTLE_RADIUS = 10;
export const RING_RADIUS = 18;
/** A ring scores when it lands this close to the middle of a bottle. */
export const HIT_DISTANCE = 14;
const BOTTLE_SPACING = 44;

export interface Point {
  x: number;
  y: number;
}

export interface Bottle extends Point {
  ringed: boolean;
}

export interface Ring extends Point {
  scored: boolean;
}

export interface Flight {
  from: Point;
  to: Point;
  age: number;
}

export interface RingTossState {
  bottles: Bottle[];
  /** Rings that have landed. */
  rings: Ring[];
  flight: Flight | null;
  ringsLeft: number;
  score: number;
  /** Aiming swings the direction, ranging moves the distance, flying throws the ring. */
  phase: 'aiming' | 'ranging' | 'flying' | 'over';
  /** Seconds since the current phase began. */
  clock: number;
  angle: number;
  distance: number;
}

/** Where a ring thrown at `angle` for `distance` pixels lands. Angle 0 is straight ahead. */
export function landingPoint(angle: number, distance: number): Point {
  return {
    x: TOSSER.x + Math.sin(angle) * distance,
    y: TOSSER.y - Math.cos(angle) * distance,
  };
}

/** Goes 0 → 1 → 0 once per period. */
function pingPong(time: number, period: number): number {
  const t = (((time / period) % 1) + 1) % 1;
  return t < 0.5 ? t * 2 : 2 - t * 2;
}

export function swingAngle(time: number): number {
  return MAX_ANGLE * (2 * pingPong(time + SWING_PERIOD / 4, SWING_PERIOD) - 1);
}

export function rangeDistance(time: number): number {
  return MIN_DISTANCE + (MAX_DISTANCE - MIN_DISTANCE) * pingPong(time, RANGE_PERIOD);
}

/** Scatters bottles at random, apart from each other and all within reach of the tosser. */
export function placeBottles(random: () => number = Math.random): Bottle[] {
  const bottles: Bottle[] = [];
  for (let attempt = 0; bottles.length < BOTTLE_COUNT; attempt++) {
    const angle = MAX_ANGLE * 0.9 * (2 * random() - 1);
    const distance = MIN_DISTANCE + 40 + (MAX_DISTANCE - MIN_DISTANCE - 70) * random();
    const spot = landingPoint(angle, distance);
    // Give up on spacing rather than loop forever on an unlucky random source.
    const crowded = bottles.some((b) => Math.hypot(b.x - spot.x, b.y - spot.y) < BOTTLE_SPACING);
    if (!crowded || attempt > 10_000) bottles.push({ ...spot, ringed: false });
  }
  return bottles;
}

export function createState(random: () => number = Math.random): RingTossState {
  return {
    bottles: placeBottles(random),
    rings: [],
    flight: null,
    ringsLeft: RING_COUNT,
    score: 0,
    phase: 'aiming',
    clock: 0,
    angle: swingAngle(0),
    distance: MIN_DISTANCE,
  };
}

/** The bottle a ring landing at `point` goes over, if any. A bottle takes one ring. */
export function bottleUnder(bottles: readonly Bottle[], point: Point): Bottle | undefined {
  return bottles.find((b) => !b.ringed && Math.hypot(b.x - point.x, b.y - point.y) <= HIT_DISTANCE);
}

/**
 * The player's click: the first locks the direction, the second locks the
 * distance and throws. Returns false if the click did nothing.
 */
export function lockIn(state: RingTossState): boolean {
  if (state.phase === 'aiming') {
    state.phase = 'ranging';
    state.clock = 0;
    state.distance = rangeDistance(0);
    return true;
  }
  if (state.phase === 'ranging') {
    state.phase = 'flying';
    state.clock = 0;
    state.ringsLeft -= 1;
    state.flight = {
      from: { ...TOSSER },
      to: landingPoint(state.angle, state.distance),
      age: 0,
    };
    return true;
  }
  return false;
}

/** Advances the game by `dt` seconds. */
export function step(state: RingTossState, dt: number): void {
  state.clock += dt;
  if (state.phase === 'aiming') {
    state.angle = swingAngle(state.clock);
  } else if (state.phase === 'ranging') {
    state.distance = rangeDistance(state.clock);
  } else if (state.phase === 'flying' && state.flight) {
    state.flight.age += dt;
    if (state.flight.age >= FLIGHT_TIME) {
      const { to } = state.flight;
      const bottle = bottleUnder(state.bottles, to);
      if (bottle) {
        bottle.ringed = true;
        state.score += 1;
      }
      state.rings.push({ ...to, scored: Boolean(bottle) });
      state.flight = null;
      state.clock = 0;
      state.phase = state.ringsLeft === 0 ? 'over' : 'aiming';
    }
  }
}

function drawRing(ctx: CanvasRenderingContext2D, point: Point, radius: number) {
  ctx.beginPath();
  ctx.arc(point.x, point.y, radius, 0, Math.PI * 2);
  ctx.stroke();
}

function draw(ctx: CanvasRenderingContext2D, state: RingTossState) {
  const { colors } = theme;

  ctx.fillStyle = colors.background;
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Booth awning.
  const stripe = WIDTH / 16;
  for (let i = 0; i < 16; i++) {
    ctx.fillStyle = i % 2 === 0 ? colors.stripeA : colors.stripeB;
    ctx.fillRect(i * stripe, 0, stripe, 40);
  }

  // The table the bottles stand on.
  ctx.fillStyle = colors.surface;
  ctx.beginPath();
  ctx.moveTo(TOSSER.x, TOSSER.y);
  ctx.arc(TOSSER.x, TOSSER.y, MAX_DISTANCE, -Math.PI / 2 - MAX_ANGLE, -Math.PI / 2 + MAX_ANGLE);
  ctx.closePath();
  ctx.fill();

  for (const bottle of state.bottles) {
    ctx.fillStyle = colors.water;
    ctx.beginPath();
    ctx.arc(bottle.x, bottle.y, BOTTLE_RADIUS, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = colors.wood;
    ctx.beginPath();
    ctx.arc(bottle.x, bottle.y, BOTTLE_RADIUS * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.lineWidth = 4;
  for (const ring of state.rings) {
    ctx.strokeStyle = ring.scored ? colors.accent : colors.muted;
    drawRing(ctx, ring, RING_RADIUS);
  }

  // The aim: a line along the direction, and a marker at the distance once it moves.
  if (state.phase === 'aiming' || state.phase === 'ranging') {
    const end = landingPoint(state.angle, MAX_DISTANCE);
    ctx.strokeStyle = colors.text;
    ctx.lineWidth = 2;
    ctx.setLineDash([8, 8]);
    ctx.beginPath();
    ctx.moveTo(TOSSER.x, TOSSER.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
    ctx.setLineDash([]);
    if (state.phase === 'ranging') {
      ctx.strokeStyle = colors.accent;
      ctx.lineWidth = 4;
      drawRing(ctx, landingPoint(state.angle, state.distance), RING_RADIUS);
    }
  }

  if (state.flight) {
    const { from, to, age } = state.flight;
    const t = Math.min(age / FLIGHT_TIME, 1);
    // The ring arcs up towards the player and shrinks as it comes down.
    const lift = Math.sin(t * Math.PI);
    ctx.strokeStyle = colors.accent;
    ctx.lineWidth = 4;
    drawRing(
      ctx,
      { x: from.x + (to.x - from.x) * t, y: from.y + (to.y - from.y) * t - lift * 60 },
      RING_RADIUS * (1 + lift * 0.6),
    );
  }

  // The tosser.
  ctx.fillStyle = colors.stripeA;
  ctx.beginPath();
  ctx.arc(TOSSER.x, TOSSER.y, 16, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = colors.text;
  ctx.font = canvasFont('body', 'bold');
  ctx.textAlign = 'left';
  ctx.fillText(`Bottles ringed ${state.score}`, 16, HEIGHT - 20);
  ctx.textAlign = 'right';
  ctx.fillText(`Rings ${state.ringsLeft}/${RING_COUNT}`, WIDTH - 16, HEIGHT - 20);
  ctx.textAlign = 'center';
  ctx.font = canvasFont('small');
  ctx.fillStyle = colors.muted;
  if (state.phase === 'aiming') ctx.fillText('Click to lock the direction', WIDTH / 2, 64);
  if (state.phase === 'ranging') ctx.fillText('Click to lock the distance', WIDTH / 2, 64);

  if (state.phase === 'over') {
    ctx.fillStyle = colors.background;
    ctx.globalAlpha = 0.8;
    ctx.fillRect(0, 0, WIDTH, HEIGHT);
    ctx.globalAlpha = 1;
    ctx.textAlign = 'center';
    ctx.fillStyle = colors.accent;
    ctx.font = canvasFont('title', 'bold');
    ctx.fillText(`Out of rings! You ringed ${state.score}`, WIDTH / 2, HEIGHT / 2);
    ctx.fillStyle = colors.text;
    ctx.font = canvasFont('body');
    ctx.fillText('Click to play again', WIDTH / 2, HEIGHT / 2 + 40);
  }
}

export const ringToss: CarnivalGame = {
  id: 'ring-toss',
  name: 'Ring Toss',
  description: 'Lock in a direction, then a distance, and land your five rings over the bottles.',

  start(canvas) {
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D is not available');
    canvas.width = WIDTH;
    canvas.height = HEIGHT;

    let state = createState();
    let scoreRecorded = false;

    const onDown = () => {
      if (state.phase === 'over') {
        state = createState();
        scoreRecorded = false;
      } else {
        lockIn(state);
      }
    };
    canvas.addEventListener('pointerdown', onDown);

    let frame = 0;
    let last = performance.now();
    const loop = (time: number) => {
      // Cap the step so a background tab doesn't teleport everything.
      const dt = Math.min((time - last) / 1000, 0.05);
      last = time;
      step(state, dt);
      if (state.phase === 'over' && !scoreRecorded) {
        recordScore(ringToss.id, state.score);
        scoreRecorded = true;
      }
      draw(ctx, state);
      frame = requestAnimationFrame(loop);
    };
    frame = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(frame);
      canvas.removeEventListener('pointerdown', onDown);
    };
  },
};

export default ringToss;

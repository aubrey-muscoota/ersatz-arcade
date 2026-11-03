// Pure game rules. No React, no platform code, so they can be unit tested with node.

export const GOLDEN_ANGLE = 137.50776405; // degrees, 360 * (2 - phi)
export const GALAXY_SIZE = 144; // stars in a full galaxy (a Fibonacci number)
export const MAX_MISSES = 3;
export const MILESTONES = [8, 21, 55, 89, 144];
export const EPOCH = Date.UTC(2026, 10, 1); // Daily #1 is Nov 1, 2026

export type Grade = 'perfect' | 'good' | 'close' | 'miss';
export type Mode = 'daily' | 'endless';

// Angular windows in degrees, measured either side of the target.
export const WINDOWS = { perfect: 4, good: 10, close: 18 } as const;

/** Everything that varies between runs. Daily runs derive it from the date, so everyone gets the same one. */
export type RunConfig = {
  mode: Mode;
  day: number;
  baseSpeed: number; // deg/s at the first star
  ramp: number; // deg/s added per star
  maxSpeed: number;
  reversals: number[]; // after placing these stars, the arm turns around
  golden: number[]; // supernovas: these stars are worth 5x
};

/** Small seeded PRNG (mulberry32), so a day's galaxy is identical on every device. */
export function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function dayNumber(now: Date = new Date()): number {
  const local = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((local - EPOCH) / 86400000) + 1;
}

export function makeConfig(mode: Mode, seed: number, day = 0): RunConfig {
  const r = rng(seed * 7919 + 17);
  const golden: number[] = [];
  // Roughly one supernova in 13, never on the first few stars.
  for (let n = 5; n <= GALAXY_SIZE; n++) if (r() < 1 / 13) golden.push(n);
  // Always reverse at 21 and 55; a third reversal lands somewhere late in the run.
  const reversals = [21, 55, 80 + Math.floor(r() * 30)];
  return {
    mode,
    day,
    baseSpeed: 78 + Math.round(r() * 8),
    ramp: 1.5 + Math.round(r() * 3) / 10,
    maxSpeed: 300,
    reversals,
    golden,
  };
}

export const dailyConfig = (day: number) => makeConfig('daily', day, day);
export const endlessConfig = () => makeConfig('endless', Math.floor(Math.random() * 1e9));

/** Wrap any angle into [0, 360). */
export function norm(deg: number): number {
  return ((deg % 360) + 360) % 360;
}

/** Smallest signed difference a - b, in (-180, 180]. */
export function angleDiff(a: number, b: number): number {
  const d = norm(a - b);
  return d > 180 ? d - 360 : d;
}

/** Where star n (1-based) belongs: n golden-angle turns from 12 o'clock. */
export function targetAngle(n: number): number {
  return norm(n * GOLDEN_ANGLE);
}

/** Vogel's model: radius grows with sqrt(n), so stars pack evenly. 0..1 of the field. */
export function starRadius(n: number): number {
  return 0.94 * Math.sqrt(n / GALAXY_SIZE);
}

export function grade(errorDeg: number): Grade {
  const e = Math.abs(errorDeg);
  if (e <= WINDOWS.perfect) return 'perfect';
  if (e <= WINDOWS.good) return 'good';
  if (e <= WINDOWS.close) return 'close';
  return 'miss';
}

/** Arm speed in deg/s. Ramps up as the galaxy grows, and eases off a little on your last life. */
export function armSpeed(c: RunConfig, n: number, misses = 0): number {
  const s = Math.min(c.baseSpeed + n * c.ramp, c.maxSpeed);
  return misses === MAX_MISSES - 1 ? s * 0.85 : s;
}

const BASE: Record<Grade, number> = { perfect: 3, good: 2, close: 1, miss: 0 };

/** Combo multiplier: every 5 perfects in a row adds 1x, capped at 4x. */
export function multiplier(streak: number): number {
  return Math.min(1 + Math.floor(streak / 5), 4);
}

export function points(g: Grade, streak: number, golden = false): number {
  return BASE[g] * (g === 'perfect' ? multiplier(streak) : 1) * (golden && g !== 'miss' ? 5 : 1);
}

export type Star = { n: number; angle: number; grade: Grade; golden: boolean };

export type State = {
  config: RunConfig;
  stars: Star[];
  score: number;
  streak: number; // consecutive perfects
  bestStreak: number;
  misses: number;
  dir: 1 | -1; // arm direction: 1 = clockwise
  over: boolean;
  complete: boolean;
};

export const initialState = (config: RunConfig = makeConfig('endless', 1)): State => ({
  config,
  stars: [],
  score: 0,
  streak: 0,
  bestStreak: 0,
  misses: 0,
  dir: 1,
  over: false,
  complete: false,
});

export type Placement = { state: State; grade: Grade; milestone: boolean; golden: boolean; reversed: boolean };

/** Apply one tap with the arm at `armAngle`. */
export function place(s: State, armAngle: number): Placement {
  const n = s.stars.length + 1;
  const g = grade(angleDiff(armAngle, targetAngle(n)));
  const golden = s.config.golden.includes(n);
  const streak = g === 'perfect' ? s.streak + 1 : 0;
  const misses = s.misses + (g === 'miss' ? 1 : 0);
  const milestone = g !== 'miss' && MILESTONES.includes(n);
  const reversed = s.config.reversals.includes(n);
  const complete = n >= GALAXY_SIZE;
  return {
    state: {
      ...s,
      stars: [...s.stars, { n, angle: norm(armAngle), grade: g, golden }],
      score: s.score + points(g, streak, golden) + (milestone ? n : 0),
      streak,
      bestStreak: Math.max(s.bestStreak, streak),
      misses,
      dir: reversed ? (s.dir === 1 ? -1 : 1) : s.dir,
      over: misses >= MAX_MISSES || complete,
      complete: complete && misses < MAX_MISSES,
    },
    grade: g,
    milestone,
    golden,
    reversed,
  };
}

/** Which note to play: perfect streaks climb a 10-note scale, other grades sit low. */
export function noteFor(g: Grade, streak: number): number {
  if (g === 'perfect') return (streak - 1) % 10;
  return g === 'good' ? 2 : 0;
}

/** Spoiler-free result for group chats: one square per 12 stars. */
export function shareText(s: State): string {
  const sq = { perfect: '🟨', good: '🟧', close: '🟩', miss: '⬛', empty: '⬜' };
  let strip = '';
  for (let i = 0; i < GALAXY_SIZE / 12; i++) {
    const chunk = s.stars.slice(i * 12, i * 12 + 12);
    if (!chunk.length) strip += sq.empty;
    else if (chunk.some((x) => x.grade === 'miss')) strip += sq.miss;
    else if (chunk.every((x) => x.grade === 'perfect')) strip += sq.perfect;
    else if (chunk.every((x) => x.grade !== 'close')) strip += sq.good;
    else strip += sq.close;
  }
  const head = s.config.mode === 'daily' ? `Starspin #${s.config.day}` : 'Starspin';
  return `${head} · ${s.stars.length}/${GALAXY_SIZE} stars${s.complete ? ' 🌌' : ''} · ${s.score} pts\n${strip}`;
}

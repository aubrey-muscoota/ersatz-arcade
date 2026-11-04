import { byId, PLACES, type Place } from './places.ts';

export const MAX_GUESSES = 6;
/** A guess this close to the answer counts as correct (e.g. Cairo for the Pyramids). */
export const CORRECT_KM = 40;
/** Width of the image at each zoom level, in km. Level 1 is the closest. */
export const LEVEL_KM = [2, 4, 8, 16, 32, 64];

/** Day #1 is Nov 4, 2026 (local time). */
const EPOCH = Date.UTC(2026, 10, 4);

export function dayNumber(now: Date = new Date()): number {
  const local = Date.UTC(now.getFullYear(), now.getMonth(), now.getDate());
  return Math.floor((local - EPOCH) / 86400000) + 1;
}

export type Puzzle = {
  key: string; // image folder
  answer: string; // place id
  note: string; // shown on the reveal
};

export function haversineKm(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const dLat = r(b.lat - a.lat);
  const dLon = r(b.lon - a.lon);
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(r(a.lat)) * Math.cos(r(b.lat)) * Math.sin(dLon / 2) ** 2;
  return 2 * 6371 * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Initial compass bearing from a to b, degrees clockwise from north. */
export function bearing(a: { lat: number; lon: number }, b: { lat: number; lon: number }): number {
  const r = (d: number) => (d * Math.PI) / 180;
  const y = Math.sin(r(b.lon - a.lon)) * Math.cos(r(b.lat));
  const x = Math.cos(r(a.lat)) * Math.sin(r(b.lat)) - Math.sin(r(a.lat)) * Math.cos(r(b.lat)) * Math.cos(r(b.lon - a.lon));
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

const ARROWS = ['⬆️', '↗️', '➡️', '↘️', '⬇️', '↙️', '⬅️', '↖️'];
export function arrow(deg: number): string {
  return ARROWS[Math.round(deg / 45) % 8];
}

export type Guess = { placeId: string; km: number; dir: number; correct: boolean; skipped?: boolean };

export function judge(answer: Place, placeId: string): Guess {
  const p = byId[placeId];
  const km = haversineKm(p, answer);
  return { placeId, km, dir: bearing(p, answer), correct: placeId === answer.id || km <= CORRECT_KM };
}

export const SKIP: Guess = { placeId: '', km: -1, dir: 0, correct: false, skipped: true };

/** How warm a guess is, for the colored square in the share text. */
export function heat(g: Guess): 'hit' | 'hot' | 'warm' | 'cold' | 'skip' {
  if (g.skipped) return 'skip';
  if (g.correct) return 'hit';
  if (g.km < 500) return 'hot';
  if (g.km < 2000) return 'warm';
  return 'cold';
}

const SQUARES = { hit: '🟩', hot: '🟨', warm: '🟧', cold: '🟥', skip: '⬜' };

export function isOver(guesses: Guess[]): boolean {
  return guesses.some((g) => g.correct) || guesses.length >= MAX_GUESSES;
}

export function won(guesses: Guess[]): boolean {
  return guesses.some((g) => g.correct);
}

/** Zoom level (0-based) to show: one step out per guess, until the game ends. */
export function levelFor(guesses: Guess[]): number {
  if (isOver(guesses)) return LEVEL_KM.length - 1;
  return Math.min(guesses.length, LEVEL_KM.length - 1);
}

export function shareText(day: number, guesses: Guess[]): string {
  const score = won(guesses) ? `${guesses.length}/${MAX_GUESSES}` : `X/${MAX_GUESSES}`;
  const row = guesses.map((g) => SQUARES[heat(g)]).join('');
  return `Overhead #${day} ${score}\n${row}`;
}

export function formatKm(km: number): string {
  if (km < 0) return '';
  if (km < 10) return `${km.toFixed(1)} km`;
  return `${Math.round(km).toLocaleString('en-US')} km`;
}

function norm(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9 ]/g, '')
    .trim();
}

/** Places whose name (or other name) starts with, then contains, the typed text. */
export function suggest(text: string, exclude: string[] = [], limit = 5): Place[] {
  const q = norm(text);
  if (!q) return [];
  const starts: Place[] = [];
  const contains: Place[] = [];
  for (const p of PLACES) {
    if (exclude.includes(p.id)) continue;
    const names = [p.name, ...(p.alt ?? [])].map(norm);
    if (names.some((n) => n.startsWith(q) || n.split(' ').some((w) => w.startsWith(q)))) starts.push(p);
    else if (names.some((n) => n.includes(q)) || norm(p.country).startsWith(q)) contains.push(p);
  }
  return [...starts, ...contains].slice(0, limit);
}

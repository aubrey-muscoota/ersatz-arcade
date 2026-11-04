import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Guess } from './game/logic';

// Everything stays on the device. No accounts, no network.
export type Saved = {
  days: Record<number, Guess[]>; // guesses for each day played (resumes mid-game)
  results: Record<number, { won: boolean; tries: number }>; // finished days
  streak: number; // consecutive days won
  lastWon: number;
  seenHelp: boolean;
};

const KEY = 'overhead/v1';
export const empty: Saved = { days: {}, results: {}, streak: 0, lastWon: 0, seenHelp: false };

export async function load(): Promise<Saved> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? { ...empty, ...JSON.parse(raw) } : empty;
  } catch {
    return empty;
  }
}

export async function save(s: Saved): Promise<void> {
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(s));
  } catch {}
}

/** Record a finished day. Only the first finish counts toward the streak. */
export function recordResult(s: Saved, day: number, won: boolean, tries: number): Saved {
  if (s.results[day]) return s;
  const streak = won ? (s.lastWon === day - 1 ? s.streak + 1 : 1) : 0;
  return { ...s, results: { ...s.results, [day]: { won, tries } }, streak, lastWon: won ? day : s.lastWon };
}

export function liveStreak(s: Saved, today: number): number {
  return s.lastWon >= today - 1 ? s.streak : 0;
}

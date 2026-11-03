import AsyncStorage from '@react-native-async-storage/async-storage';

// Everything stays on the device. No accounts, no network.
export type DailyResult = { day: number; score: number; stars: number; complete: boolean; share: string };
export type Saved = {
  best: number;
  daily: Record<number, DailyResult>; // first daily run of each day
  streak: number; // consecutive days played
  lastDay: number;
  muted: boolean;
};

const KEY = 'starspin/v1';
const empty: Saved = { best: 0, daily: {}, streak: 0, lastDay: 0, muted: false };

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

/** Record a finished daily run. Only the first run of a day counts. */
export function recordDaily(s: Saved, r: DailyResult): Saved {
  if (s.daily[r.day]) return s;
  const streak = s.lastDay === r.day - 1 ? s.streak + 1 : 1;
  return { ...s, daily: { ...s.daily, [r.day]: r }, streak, lastDay: r.day };
}

/** The streak shown on the title: it lapses if yesterday was missed. */
export function liveStreak(s: Saved, today: number): number {
  return s.lastDay >= today - 1 ? s.streak : 0;
}

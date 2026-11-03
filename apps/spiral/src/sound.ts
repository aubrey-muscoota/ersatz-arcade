import { createAudioPlayer, setAudioModeAsync, AudioPlayer } from 'expo-audio';

// Short synthesized sounds (see scripts/make-sounds.py). One player per sound, rewound on each play.
const SOURCES = {
  note0: require('../assets/sounds/note0.wav'),
  note1: require('../assets/sounds/note1.wav'),
  note2: require('../assets/sounds/note2.wav'),
  note3: require('../assets/sounds/note3.wav'),
  note4: require('../assets/sounds/note4.wav'),
  note5: require('../assets/sounds/note5.wav'),
  note6: require('../assets/sounds/note6.wav'),
  note7: require('../assets/sounds/note7.wav'),
  note8: require('../assets/sounds/note8.wav'),
  note9: require('../assets/sounds/note9.wav'),
  miss: require('../assets/sounds/miss.wav'),
  golden: require('../assets/sounds/golden.wav'),
  milestone: require('../assets/sounds/milestone.wav'),
  complete: require('../assets/sounds/complete.wav'),
};
export type SoundName = keyof typeof SOURCES;

let players: Partial<Record<SoundName, AudioPlayer>> = {};
let muted = false;

export function initSound() {
  if (Object.keys(players).length) return;
  // Respect the ringer switch: a quiet game shouldn't play through silent mode.
  setAudioModeAsync({ playsInSilentMode: false }).catch(() => {});
  for (const k of Object.keys(SOURCES) as SoundName[]) {
    try {
      players[k] = createAudioPlayer(SOURCES[k]);
    } catch {
      // Sound is a nice-to-have; the game works without it.
    }
  }
}

export function setMuted(m: boolean) {
  muted = m;
}

export function play(name: SoundName) {
  if (muted) return;
  const p = players[name];
  if (!p) return;
  try {
    p.seekTo(0);
    p.play();
  } catch {}
}

export function playNote(i: number) {
  play(`note${Math.max(0, Math.min(9, i))}` as SoundName);
}

"""Synthesizes the game's sounds as small WAV files. Run: python3 scripts/make-sounds.py"""
import math, random, struct, wave, os

RATE = 22050
OUT = os.path.join(os.path.dirname(__file__), '..', 'assets', 'sounds')

def bell(freq, dur=0.9, decay=4.5, harmonics=((1, 1.0), (2, 0.28), (3, 0.08), (4.2, 0.05))):
    n = int(RATE * dur)
    out = []
    for i in range(n):
        t = i / RATE
        env = min(1.0, t / 0.004) * math.exp(-decay * t)
        s = sum(a * math.sin(2 * math.pi * freq * h * t) * math.exp(-decay * (h - 1) * 0.6 * t) for h, a in harmonics)
        out.append(s * env)
    return out

def mix(*tracks, offsets=None):
    offsets = offsets or [0] * len(tracks)
    n = max(len(t) + int(o * RATE) for t, o in zip(tracks, offsets))
    out = [0.0] * n
    for t, o in zip(tracks, offsets):
        k = int(o * RATE)
        for i, s in enumerate(t):
            out[k + i] += s
    return out

def thud(dur=0.35):
    random.seed(7)
    n = int(RATE * dur)
    return [(0.8 * math.sin(2 * math.pi * (95 - 40 * i / n) * i / RATE) + 0.15 * (random.random() * 2 - 1))
            * min(1, i / 60) * math.exp(-11 * i / RATE) for i in range(n)]

def write(name, samples, gain=0.55):
    peak = max(abs(s) for s in samples) or 1
    with wave.open(os.path.join(OUT, name), 'wb') as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(RATE)
        w.writeframes(b''.join(struct.pack('<h', int(32767 * gain * s / peak)) for s in samples))

os.makedirs(OUT, exist_ok=True)
# C major pentatonic, two octaves from C5. Pitch climbs with the perfect streak.
for i, semis in enumerate([0, 2, 4, 7, 9, 12, 14, 16, 19, 21]):
    write(f'note{i}.wav', bell(523.25 * 2 ** (semis / 12)), gain=0.5)
write('miss.wav', thud(), gain=0.6)
write('golden.wav', mix(bell(1567.98, 0.8), bell(2093.0, 0.9), bell(2637.0, 1.0), offsets=[0, 0.06, 0.12]), gain=0.45)
write('milestone.wav', mix(*[bell(523.25 * 2 ** (s / 12), 1.6, 2.2) for s in (0, 4, 7, 12, 16)],
                           offsets=[0, 0.05, 0.1, 0.15, 0.2]), gain=0.55)
write('complete.wav', mix(*[bell(523.25 * 2 ** (s / 12), 2.2, 1.6) for s in (0, 4, 7, 12, 16, 19, 24)],
                       offsets=[i * 0.11 for i in range(7)]), gain=0.55)

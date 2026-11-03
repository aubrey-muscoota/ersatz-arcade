import { useCallback, useEffect, useRef, useState } from 'react';
import { AppState, Pressable, Share, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import Svg, { Circle, Line } from 'react-native-svg';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold } from '@expo-google-fonts/fredoka';

import {
  armSpeed, GALAXY_SIZE, dailyConfig, dayNumber, endlessConfig, GOLDEN_ANGLE, Grade, initialState, MAX_MISSES,
  Mode, multiplier, noteFor, norm, place, RunConfig, starRadius, shareText, State, targetAngle,
} from './src/game/logic';
import { Galaxy, dotSize, gradeColor, polar, Starfield } from './src/game/Galaxy';
import { colors, fonts } from './src/theme';
import { hapticEnd, hapticFor } from './src/feedback';
import { initSound, play, playNote, setMuted } from './src/sound';
import { liveStreak, load, recordDaily, save, Saved } from './src/storage';

type Phase = 'title' | 'playing' | 'over';
type Flash = { grade: Grade; at: number; milestone: boolean; golden: boolean; reversed: boolean; n: number };

const FLASH_MS = 750;
const RESTART_LOCK_MS = 600;

const GRADE_LABEL: Record<Grade, string> = { perfect: 'Perfect!', good: 'Great', close: 'Close', miss: 'Miss' };

// A finished galaxy drawn behind the title screen.
const DEMO = Array.from({ length: GALAXY_SIZE }, (_, i) => ({
  n: i + 1,
  angle: targetAngle(i + 1),
  grade: (['perfect', 'good', 'close'] as Grade[])[(i * 7) % 3],
  golden: [7, 31, 38, 59, 88, 102, 130].includes(i + 1),
}));

export default function App() {
  const [loaded] = useFonts({ Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold });
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      {loaded ? <Game /> : <View style={styles.root} />}
    </SafeAreaProvider>
  );
}

function Game() {
  const { width, height } = useWindowDimensions();
  const insets = useSafeAreaInsets();
  const size = Math.min(width - 24, height * 0.58, 540);
  const R = size / 2 - 16;
  const c = size / 2;

  const [phase, setPhase] = useState<Phase>('title');
  const [game, setGame] = useState<State>(() => initialState(dailyConfig(dayNumber())));
  const [saved, setSaved] = useState<Saved | null>(null);
  const [flash, setFlash] = useState<Flash | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [, setFrame] = useState(0);

  const arm = useRef(0);
  const last = useRef<number | null>(null);
  const endedAt = useRef(0);
  const live = useRef({ phase, game });
  live.current = { phase, game };

  const today = dayNumber();
  const todays = saved?.daily[today];

  useEffect(() => {
    initSound();
    load().then((s) => {
      setSaved(s);
      setMuted(s.muted);
    });
  }, []);

  // Move the arm forward to time t. Called every frame and again on each tap,
  // so the tap uses the arm's exact position, not the last drawn one.
  const advance = useCallback((t: number) => {
    const { phase: p, game: g } = live.current;
    if (last.current != null) {
      const speed = p === 'playing' ? armSpeed(g.config, g.stars.length + 1, g.misses) * g.dir : p === 'title' ? 14 : 0;
      arm.current = norm(arm.current + (speed * (t - last.current)) / 1000);
    }
    last.current = t;
  }, []);

  useEffect(() => {
    let id = 0;
    const loop = (t: number) => {
      advance(t);
      setFrame((f) => (f + 1) % 1e6);
      id = requestAnimationFrame(loop);
    };
    id = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(id);
  }, [advance]);

  // Leaving the app mid-game shouldn't cost a star: reset the clock so the arm doesn't jump.
  useEffect(() => {
    const sub = AppState.addEventListener('change', () => {
      last.current = null;
    });
    return () => sub.remove();
  }, []);

  const start = useCallback((mode: Mode) => {
    const config: RunConfig = mode === 'daily' ? dailyConfig(dayNumber()) : endlessConfig();
    setGame(initialState(config));
    setFlash(null);
    arm.current = 0;
    last.current = performance.now();
    setPhase('playing');
  }, []);

  const tap = useCallback(() => {
    if (phase !== 'playing') return;
    const now = performance.now();
    advance(now);
    const r = place(game, arm.current);
    const { state } = r;
    hapticFor(r.grade, r.milestone, r.golden);
    if (r.grade === 'miss') play('miss');
    else {
      playNote(noteFor(r.grade, state.streak));
      if (r.golden) play('golden');
      if (r.milestone && !state.over) play('milestone');
    }
    setGame(state);
    setFlash({ grade: r.grade, at: now, milestone: r.milestone, golden: r.golden, reversed: r.reversed, n: state.stars.length });

    if (state.over) {
      endedAt.current = now;
      hapticEnd(state.complete);
      if (state.complete) play('complete');
      if (saved) {
        let next: Saved = { ...saved, best: Math.max(saved.best, state.score) };
        if (state.config.mode === 'daily') {
          next = recordDaily(next, {
            day: state.config.day, score: state.score, stars: state.stars.length, complete: state.complete,
            share: shareText(state),
          });
        }
        setSaved(next);
        save(next);
      }
      setPhase('over');
    }
  }, [phase, game, saved, advance]);

  const share = useCallback(async (text: string) => {
    try {
      await Share.share({ message: text });
    } catch {
      try {
        await Clipboard.setStringAsync(text);
        setToast('Copied to clipboard');
        setTimeout(() => setToast(null), 1800);
      } catch {}
    }
  }, []);

  const toggleMute = useCallback(() => {
    if (!saved) return;
    const next = { ...saved, muted: !saved.muted };
    setMuted(next.muted);
    setSaved(next);
    save(next);
  }, [saved]);

  // ----- frame values -----
  const now = performance.now();
  const n = game.stars.length + 1;
  const age = flash ? now - flash.at : Infinity;
  const fade = Math.max(0, 1 - age / FLASH_MS);
  const isGolden = phase === 'playing' && game.config.golden.includes(n);
  const lastLife = phase === 'playing' && game.misses === MAX_MISSES - 1;

  const shake = flash?.grade === 'miss' && fade > 0 ? Math.sin(age * 0.09) * 7 * fade : 0;
  const target = polar(c, c, R * starRadius(n), targetAngle(n));
  const tip = polar(c, c, R, arm.current);
  const lastStar = game.stars[game.stars.length - 1];
  const ripple = lastStar && fade > 0 ? polar(c, c, R * starRadius(lastStar.n), lastStar.angle) : null;
  // The ring starts generous and tightens as your perfect streak grows.
  const ringR = dotSize(n, R) + 9 - Math.min(game.streak, 12) * 0.5;
  const pulse = isGolden ? 1 + Math.sin(now / 120) * 0.12 : 1;
  const spin = phase === 'over' ? ((now - endedAt.current) / 1000) * 6 : 0;

  const flashText = flash
    ? flash.milestone ? `${flash.n} stars!` : flash.golden && flash.grade !== 'miss' ? 'Supernova! ×5' : GRADE_LABEL[flash.grade]
    : '';

  const streakDays = saved ? liveStreak(saved, today) : 0;

  return (
    <View
      style={[styles.root, lastLife && styles.dim, { paddingTop: insets.top + 12, paddingBottom: insets.bottom + 16 }]}
      onStartShouldSetResponder={() => phase === 'playing'}
      onResponderGrant={tap}
    >
      {/* HUD */}
      <View style={styles.hud}>
        {phase === 'playing' ? (
          <>
            <View>
              <Text style={styles.label}>SCORE</Text>
              <Text style={styles.num}>{game.score}</Text>
            </View>
            <View style={styles.lives}>
              {Array.from({ length: MAX_MISSES }, (_, i) => (
                <View key={i} style={[styles.life, i < MAX_MISSES - game.misses ? styles.lifeOn : null]} />
              ))}
            </View>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.label}>{game.config.mode === 'daily' ? `DAILY #${game.config.day}` : 'ENDLESS'}</Text>
              <Text style={[styles.num, game.streak >= 5 && { color: colors.gold }]}>×{multiplier(game.streak)}</Text>
            </View>
          </>
        ) : (
          <>
            <View>
              <Text style={styles.label}>HIGH SCORE</Text>
              <Text style={styles.num}>{saved?.best ?? 0}</Text>
            </View>
            <Pressable onPress={toggleMute} hitSlop={12} style={styles.mute}>
              <Text style={styles.muteText}>{saved?.muted ? 'sound off' : 'sound on'}</Text>
            </Pressable>
            <View style={{ alignItems: 'flex-end' }}>
              <Text style={styles.label}>STREAK</Text>
              <Text style={styles.num}>{streakDays} {streakDays === 1 ? 'day' : 'days'}</Text>
            </View>
          </>
        )}
      </View>

      {/* Field */}
      <View style={styles.center}>
        <View style={{ transform: [{ translateX: shake }] }}>
          <Svg width={size} height={size}>
            <Starfield w={size} h={size} />
            <Circle cx={c} cy={c} r={R} fill="none" stroke={colors.line} strokeWidth={1} />

            {phase === 'title' ? (
              <Galaxy stars={DEMO} cx={c} cy={c} R={R} opacity={0.5} rotate={arm.current} />
            ) : (
              <Galaxy stars={game.stars} cx={c} cy={c} R={R} rotate={spin} />
            )}

            {/* Milestone: a burst of sparks out from the ring */}
            {flash?.milestone && fade > 0
              ? Array.from({ length: 13 }, (_, k) => {
                  const p = polar(c, c, R * starRadius(flash.n) + (1 - fade) * 46, k * GOLDEN_ANGLE * 2);
                  return <Circle key={k} cx={p.x} cy={p.y} r={3 * fade + 1} fill={colors.gold} opacity={fade} />;
                })
              : null}

            {ripple && flash && phase !== 'title' ? (
              <Circle
                cx={ripple.x} cy={ripple.y} r={dotSize(lastStar.n, R) + (1 - fade) * 18}
                fill="none" stroke={gradeColor[flash.grade]} strokeWidth={1.5} opacity={fade}
              />
            ) : null}

            {phase === 'playing' ? (
              <Circle
                cx={target.x} cy={target.y} r={ringR * pulse}
                fill={isGolden ? colors.gold : 'none'} fillOpacity={isGolden ? 0.18 : 0}
                stroke={isGolden ? colors.gold : colors.ink} strokeWidth={isGolden ? 2 : 1.2}
                strokeDasharray={isGolden ? undefined : '3 3'} opacity={0.9}
              />
            ) : null}

            {phase === 'playing' ? (
              <>
                <Line x1={c} y1={c} x2={tip.x} y2={tip.y} stroke={isGolden ? colors.gold : colors.ink} strokeWidth={1.5} opacity={0.85} />
                <Circle cx={tip.x} cy={tip.y} r={8} fill={isGolden ? colors.gold : colors.ink} opacity={0.15} />
                <Circle cx={tip.x} cy={tip.y} r={4} fill={isGolden ? colors.gold : colors.ink} />
              </>
            ) : null}
            {/* The galaxy's core */}
            <Circle cx={c} cy={c} r={9} fill={colors.gold} opacity={0.18} />
            <Circle cx={c} cy={c} r={4} fill={colors.ink} />
          </Svg>
        </View>

        {phase === 'playing' && flash && fade > 0 ? (
          <View style={styles.flashWrap} pointerEvents="none">
            <Text style={[styles.flash, { color: flash.milestone ? colors.gold : gradeColor[flash.grade], opacity: fade, transform: [{ scale: 1 + (1 - fade) * 0.15 }] }]}>
              {flashText}
            </Text>
            {flash.reversed ? <Text style={[styles.reverse, { opacity: fade }]}>Reverse! ↺</Text> : null}
          </View>
        ) : null}
      </View>

      {/* Footer */}
      <View style={styles.footer}>
        {phase === 'title' ? (
          <>
            <Text style={styles.title}>Starspin</Text>
            <Text style={styles.body}>Tap when the beam hits the ring.{'\n'}Build a galaxy, one star at a time.</Text>
            <View style={styles.buttons}>
              {todays ? (
                <Button label={`Share daily #${today}`} sub={`${todays.stars}/${GALAXY_SIZE} stars · ${todays.score} pts`} onPress={() => share(todays.share)} primary />
              ) : (
                <Button label={`Daily galaxy #${today}`} sub="same galaxy for everyone today" onPress={() => start('daily')} primary />
              )}
              <Button label="Endless" sub="practice and chase your high score" onPress={() => start('endless')} />
            </View>
          </>
        ) : phase === 'playing' ? (
          <Text style={styles.meta}>
            {game.stars.length} / {GALAXY_SIZE} stars
            {lastLife ? '   ·   last life' : ''}
          </Text>
        ) : (
          <OverPanel
            game={game}
            saved={saved}
            onShare={() => share(shareText(game))}
            onAgain={() => now - endedAt.current > RESTART_LOCK_MS && start('endless')}
            onHome={() => setPhase('title')}
          />
        )}
        {toast ? <Text style={styles.toast}>{toast}</Text> : null}
      </View>
    </View>
  );
}

function OverPanel({ game, saved, onShare, onAgain, onHome }: {
  game: State; saved: Saved | null; onShare: () => void; onAgain: () => void; onHome: () => void;
}) {
  const daily = game.config.mode === 'daily';
  const counted = daily && saved?.daily[game.config.day]?.score === game.score;
  const newBest = saved && game.score > 0 && game.score >= saved.best;
  return (
    <>
      <Text style={styles.title}>{game.complete ? 'Galaxy complete!' : 'Game over'}</Text>
      <View style={styles.stats}>
        <Stat label="SCORE" value={game.score} hi={!!newBest} />
        <Stat label="STARS" value={`${game.stars.length}/${GALAXY_SIZE}`} />
        <Stat label="BEST STREAK" value={game.bestStreak} />
      </View>
      <Text style={styles.note}>
        {newBest ? 'New high score! ' : ''}
        {daily ? (counted ? `Daily #${game.config.day} saved.` : 'Practice run. Today’s daily already counted.') : ''}
      </Text>
      <View style={styles.buttons}>
        <Button label="Share" onPress={onShare} primary />
        <View style={styles.row}>
          <Button label="Play again" onPress={onAgain} half />
          <Button label="Home" onPress={onHome} half />
        </View>
      </View>
    </>
  );
}

function Stat({ label, value, hi }: { label: string; value: string | number; hi?: boolean }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.label}>{label}</Text>
      <Text style={[styles.num, hi && { color: colors.gold }]}>{value}</Text>
    </View>
  );
}

function Button({ label, sub, onPress, primary, half }: {
  label: string; sub?: string; onPress: () => void; primary?: boolean; half?: boolean;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={({ pressed }) => [styles.btn, primary && styles.btnPrimary, half && styles.btnHalf, pressed && { opacity: 0.75 }]}
    >
      <Text style={[styles.btnText, primary && styles.btnTextPrimary]}>{label}</Text>
      {sub ? <Text style={[styles.btnSub, primary && { color: 'rgba(18,23,51,0.7)' }]}>{sub}</Text> : null}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.night, paddingHorizontal: 20 },
  dim: { backgroundColor: colors.nightDim },
  hud: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', minHeight: 52 },
  label: { fontFamily: fonts.medium, fontSize: 11, letterSpacing: 1.5, color: colors.inkSoft },
  num: { fontFamily: fonts.bold, fontSize: 26, color: colors.ink, marginTop: 1 },
  lives: { flexDirection: 'row', gap: 10 },
  life: { width: 12, height: 12, borderRadius: 6, borderWidth: 1.5, borderColor: colors.inkSoft },
  lifeOn: { backgroundColor: colors.pink, borderColor: colors.pink },
  mute: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 14, borderWidth: 1, borderColor: colors.line },
  muteText: { fontFamily: fonts.medium, fontSize: 12, color: colors.inkSoft },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  flashWrap: { position: 'absolute', bottom: -6, alignItems: 'center' },
  flash: { fontFamily: fonts.bold, fontSize: 28 },
  reverse: { fontFamily: fonts.medium, fontSize: 14, color: colors.violet, marginTop: 2 },
  footer: { alignItems: 'center', minHeight: 200, justifyContent: 'flex-end' },
  title: { fontFamily: fonts.bold, fontSize: 36, color: colors.ink },
  body: { fontFamily: fonts.regular, fontSize: 16, lineHeight: 22, color: colors.inkSoft, textAlign: 'center', marginTop: 6 },
  meta: { fontFamily: fonts.medium, fontSize: 15, color: colors.inkSoft, marginBottom: 12 },
  note: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft, marginTop: 6, minHeight: 18 },
  stats: { flexDirection: 'row', gap: 28, marginTop: 10 },
  stat: { alignItems: 'center' },
  buttons: { width: '100%', maxWidth: 380, gap: 10, marginTop: 16 },
  row: { flexDirection: 'row', gap: 10 },
  btn: { borderRadius: 18, borderWidth: 1.5, borderColor: colors.line, paddingVertical: 12, alignItems: 'center' },
  btnHalf: { flex: 1 },
  btnPrimary: { backgroundColor: colors.gold, borderColor: colors.gold },
  btnText: { fontFamily: fonts.bold, fontSize: 18, color: colors.ink },
  btnTextPrimary: { color: colors.night },
  btnSub: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft, marginTop: 1 },
  toast: { position: 'absolute', top: -30, fontFamily: fonts.medium, fontSize: 14, color: colors.cyan },
});

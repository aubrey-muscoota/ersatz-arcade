import { useEffect, useMemo, useRef, useState } from 'react';
import {
  Animated, Easing, Image, KeyboardAvoidingView, Modal, Platform, Pressable, ScrollView, Share, StyleSheet, Text,
  TextInput, useWindowDimensions, View,
} from 'react-native';
import { StatusBar } from 'expo-status-bar';
import * as Clipboard from 'expo-clipboard';
import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFonts, Fredoka_400Regular, Fredoka_500Medium, Fredoka_600SemiBold } from '@expo-google-fonts/fredoka';

import {
  arrow, dayNumber, formatKm, Guess, heat, isOver, judge, LEVEL_KM, levelFor, MAX_GUESSES, shareText, SKIP, suggest,
  won,
} from './src/game/logic';
import { byId } from './src/game/places';
import { PUZZLES } from './src/game/puzzles';
import { IMAGES } from './src/game/images';
import { colors, fonts } from './src/theme';
import { hapticGuess, hapticLose } from './src/feedback';
import { empty, liveStreak, load, recordResult, save, Saved } from './src/storage';

// Preview builds can page through every puzzle, not just today's.
const PREVIEW = process.env.EXPO_PUBLIC_PREVIEW === '1';

const HEAT_COLOR = { hit: colors.hit, hot: colors.hot, warm: colors.warm, cold: colors.cold, skip: colors.inkFaint };

function puzzleFor(day: number) {
  const n = PUZZLES.length;
  return PUZZLES[(((day - 1) % n) + n) % n];
}

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

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
  const today = dayNumber();
  const [day, setDay] = useState(today);
  const [saved, setSaved] = useState<Saved | null>(null);
  const [text, setText] = useState('');
  const [help, setHelp] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    load().then((s) => {
      setSaved(s);
      if (!s.seenHelp) setHelp(true);
    });
  }, []);

  const puzzle = puzzleFor(day);
  const images = IMAGES[puzzle.key];
  const answer = byId[puzzle.answer];
  const guesses: Guess[] = saved?.days[day] ?? [];
  const over = isOver(guesses);
  const level = levelFor(guesses);
  const size = Math.min(width - 32, height * 0.46, 520);

  // Zoom-out animation: the new, wider image starts at 2x and settles to 1x.
  const scale = useRef(new Animated.Value(1)).current;
  const shown = useRef(level);
  useEffect(() => {
    if (shown.current === level) return;
    const from = Math.pow(2, Math.max(0, level - shown.current));
    shown.current = level;
    scale.setValue(Math.min(from, 4));
    Animated.timing(scale, { toValue: 1, duration: 650, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [level, scale]);
  useEffect(() => {
    shown.current = levelFor(saved?.days[day] ?? []);
    scale.setValue(1);
  }, [day]); // eslint-disable-line react-hooks/exhaustive-deps

  const options = useMemo(
    () => suggest(text, guesses.map((g) => g.placeId)),
    [text, guesses],
  );

  function update(next: Guess[]) {
    if (!saved) return;
    let s: Saved = { ...saved, days: { ...saved.days, [day]: next } };
    if (isOver(next)) {
      s = recordResult(s, day, won(next), next.length);
      if (won(next)) hapticGuess(true);
      else hapticLose();
    } else {
      hapticGuess(false);
    }
    setSaved(s);
    save(s);
  }

  function guess(placeId: string) {
    if (over) return;
    setText('');
    update([...guesses, judge(answer, placeId)]);
  }

  function skip() {
    if (over) return;
    setText('');
    update([...guesses, SKIP]);
  }

  async function share() {
    const msg = shareText(day, guesses);
    try {
      if (Platform.OS === 'web') {
        await Clipboard.setStringAsync(msg);
        setToast('Copied to clipboard');
        setTimeout(() => setToast(null), 1600);
      } else {
        await Share.share({ message: msg });
      }
    } catch {}
  }

  function closeHelp() {
    setHelp(false);
    if (saved && !saved.seenHelp) {
      const s = { ...saved, seenHelp: true };
      setSaved(s);
      save(s);
    }
  }

  const streak = liveStreak(saved ?? empty, today);

  return (
    <View style={[styles.root, { paddingTop: insets.top + 8 }]}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView
          contentContainerStyle={[styles.scroll, { paddingBottom: insets.bottom + 24 }]}
          keyboardShouldPersistTaps="handled"
        >
          <View style={[styles.header, { width: size }]}>
            <View>
              <Text style={styles.title}>Overhead</Text>
              <View style={styles.dayRow}>
                {PREVIEW && (
                  <Pressable onPress={() => setDay(Math.max(1, day - 1))} hitSlop={10}>
                    <Text style={styles.pager}>‹</Text>
                  </Pressable>
                )}
                <Text style={styles.sub}>
                  #{day} · guess the place from space
                </Text>
                {PREVIEW && (
                  <Pressable onPress={() => setDay(Math.min(PUZZLES.length, day + 1))} hitSlop={10}>
                    <Text style={styles.pager}>›</Text>
                  </Pressable>
                )}
              </View>
            </View>
            <View style={styles.headerRight}>
              {streak > 0 && <Text style={styles.streak}>🔥 {streak}</Text>}
              <Pressable onPress={() => setHelp(true)} style={styles.helpBtn} hitSlop={8}>
                <Text style={styles.helpTxt}>?</Text>
              </Pressable>
            </View>
          </View>

          <View style={[styles.frame, { width: size, height: size }]}>
            {images && (
              <Animated.View style={{ width: size, height: size, transform: [{ scale }] }}>
                <Image source={images.levels[level]} style={{ width: size, height: size }} resizeMode="cover" />
              </Animated.View>
            )}
            <View style={styles.scaleChip}>
              <Text style={styles.scaleTxt}>{LEVEL_KM[level]} km across</Text>
            </View>
            {!over && (
              <View style={styles.levelDots}>
                {LEVEL_KM.map((_, i) => (
                  <View key={i} style={[styles.dot, i <= level && styles.dotOn]} />
                ))}
              </View>
            )}
          </View>

          {!over && (
            <View style={{ width: size }}>
              <View style={styles.inputRow}>
                <TextInput
                  value={text}
                  onChangeText={setText}
                  placeholder="Type a city or landmark"
                  placeholderTextColor={colors.inkFaint}
                  style={styles.input}
                  autoCorrect={false}
                  autoCapitalize="words"
                  returnKeyType="done"
                  onSubmitEditing={() => options[0] && guess(options[0].id)}
                />
                <Pressable onPress={skip} style={styles.skipBtn}>
                  <Text style={styles.skipTxt}>Zoom out</Text>
                </Pressable>
              </View>
              {options.length > 0 && (
                <View style={styles.options}>
                  {options.map((p) => (
                    <Pressable key={p.id} onPress={() => guess(p.id)} style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}>
                      <Text style={styles.optionName}>{p.name}</Text>
                      <Text style={styles.optionCountry}>{p.country}</Text>
                    </Pressable>
                  ))}
                </View>
              )}
            </View>
          )}

          {over && (
            <View style={[styles.reveal, { width: size }]}>
              <Text style={styles.revealKicker}>{won(guesses) ? `Got it in ${guesses.length}!` : 'Out of guesses'}</Text>
              <Text style={styles.revealName}>{answer.name}</Text>
              <Text style={styles.revealNote}>{puzzle.note}</Text>
              <Pressable onPress={share} style={styles.shareBtn}>
                <Text style={styles.shareTxt}>Share result</Text>
              </Pressable>
              {toast && <Text style={styles.toast}>{toast}</Text>}
              {day === today && <Text style={styles.next}>A new place every day at midnight.</Text>}
            </View>
          )}

          <View style={{ width: size, marginTop: 12 }}>
            {Array.from({ length: MAX_GUESSES }, (_, i) => {
              const g = guesses[i];
              if (!g) return <View key={i} style={[styles.row, styles.rowEmpty]} />;
              const h = heat(g);
              return (
                <View key={i} style={styles.row}>
                  <View style={[styles.swatch, { backgroundColor: HEAT_COLOR[h] }]} />
                  <Text style={styles.rowName} numberOfLines={1}>
                    {g.skipped ? 'Zoomed out' : byId[g.placeId]?.name}
                  </Text>
                  {!g.skipped && !g.correct && (
                    <Text style={styles.rowKm}>
                      {formatKm(g.km)} {arrow(g.dir)}
                    </Text>
                  )}
                  {g.correct && <Text style={styles.rowKm}>✓</Text>}
                </View>
              );
            })}
          </View>

          {images && (
            <Text style={[styles.credit, { width: size }]}>
              Contains modified Copernicus Sentinel data, captured {formatDate(images.captured)}.
            </Text>
          )}
        </ScrollView>
      </KeyboardAvoidingView>

      <Modal visible={help} transparent animationType="fade" onRequestClose={closeHelp}>
        <Pressable style={styles.modalBg} onPress={closeHelp}>
          <View style={[styles.modal, { width: Math.min(width - 48, 420) }]}>
            <Text style={styles.modalTitle}>How to play</Text>
            <Text style={styles.modalLine}>One satellite photo a day. Name the place in {MAX_GUESSES} guesses.</Text>
            <Text style={styles.modalLine}>Every guess zooms the photo out, from {LEVEL_KM[0]} km across to {LEVEL_KM[LEVEL_KM.length - 1]} km.</Text>
            <Text style={styles.modalLine}>Wrong guesses show how far off you are and which way to go.</Text>
            <Text style={styles.modalLine}>Anywhere within 40 km of the answer counts.</Text>
            <View style={styles.legend}>
              {(['hit', 'hot', 'warm', 'cold'] as const).map((k) => (
                <View key={k} style={styles.legendItem}>
                  <View style={[styles.swatch, { backgroundColor: HEAT_COLOR[k] }]} />
                  <Text style={styles.legendTxt}>
                    {{ hit: 'Correct', hot: 'Under 500 km', warm: 'Under 2,000 km', cold: 'Farther' }[k]}
                  </Text>
                </View>
              ))}
            </View>
            <Pressable onPress={closeHelp} style={styles.shareBtn}>
              <Text style={styles.shareTxt}>Play</Text>
            </Pressable>
          </View>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg },
  scroll: { alignItems: 'center', paddingHorizontal: 16 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  title: { fontFamily: fonts.bold, fontSize: 30, color: colors.ink, letterSpacing: 0.5 },
  dayRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sub: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft },
  pager: { fontFamily: fonts.bold, fontSize: 22, color: colors.accent, paddingHorizontal: 4 },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  streak: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  helpBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1.5, borderColor: colors.line, alignItems: 'center', justifyContent: 'center' },
  helpTxt: { fontFamily: fonts.bold, fontSize: 17, color: colors.ink },
  frame: { borderRadius: 18, overflow: 'hidden', backgroundColor: colors.panel },
  scaleChip: { position: 'absolute', left: 10, bottom: 10, backgroundColor: 'rgba(11,18,32,0.72)', borderRadius: 10, paddingHorizontal: 9, paddingVertical: 4 },
  scaleTxt: { fontFamily: fonts.medium, fontSize: 13, color: colors.ink },
  levelDots: { position: 'absolute', right: 12, bottom: 14, flexDirection: 'row', gap: 5 },
  dot: { width: 7, height: 7, borderRadius: 4, backgroundColor: 'rgba(242,240,234,0.3)' },
  dotOn: { backgroundColor: colors.ink },
  inputRow: { flexDirection: 'row', gap: 8, marginTop: 14 },
  input: {
    flex: 1, height: 50, borderRadius: 14, backgroundColor: colors.panel, color: colors.ink, paddingHorizontal: 16,
    fontFamily: fonts.medium, fontSize: 17, borderWidth: 1.5, borderColor: colors.line,
  },
  skipBtn: { height: 50, borderRadius: 14, paddingHorizontal: 14, justifyContent: 'center', backgroundColor: colors.panelHi },
  skipTxt: { fontFamily: fonts.medium, fontSize: 15, color: colors.inkSoft },
  options: { marginTop: 6, borderRadius: 14, backgroundColor: colors.panel, overflow: 'hidden' },
  option: { paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: colors.line },
  optionPressed: { backgroundColor: colors.panelHi },
  optionName: { fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  optionCountry: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft },
  row: {
    height: 44, borderRadius: 12, backgroundColor: colors.panel, marginBottom: 6, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 12, gap: 10,
  },
  rowEmpty: { backgroundColor: 'transparent', borderWidth: 1.5, borderColor: colors.line, borderStyle: 'dashed' },
  swatch: { width: 14, height: 14, borderRadius: 4 },
  rowName: { flex: 1, fontFamily: fonts.medium, fontSize: 16, color: colors.ink },
  rowKm: { fontFamily: fonts.medium, fontSize: 15, color: colors.inkSoft },
  reveal: { marginTop: 14, padding: 18, borderRadius: 18, backgroundColor: colors.panel, alignItems: 'center' },
  revealKicker: { fontFamily: fonts.medium, fontSize: 15, color: colors.accent },
  revealName: { fontFamily: fonts.bold, fontSize: 28, color: colors.ink, marginTop: 2, textAlign: 'center' },
  revealNote: { fontFamily: fonts.regular, fontSize: 15, color: colors.inkSoft, textAlign: 'center', marginTop: 6, lineHeight: 21 },
  shareBtn: { marginTop: 14, backgroundColor: colors.accent, borderRadius: 24, paddingHorizontal: 26, paddingVertical: 12, alignSelf: 'center' },
  shareTxt: { fontFamily: fonts.bold, fontSize: 16, color: colors.bg },
  toast: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkSoft, marginTop: 8 },
  next: { fontFamily: fonts.regular, fontSize: 13, color: colors.inkFaint, marginTop: 10 },
  credit: { fontFamily: fonts.regular, fontSize: 11, color: colors.inkFaint, textAlign: 'center', marginTop: 14 },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center' },
  modal: { backgroundColor: colors.panel, borderRadius: 20, padding: 22 },
  modalTitle: { fontFamily: fonts.bold, fontSize: 22, color: colors.ink, marginBottom: 10 },
  modalLine: { fontFamily: fonts.regular, fontSize: 15, color: colors.ink, lineHeight: 22, marginBottom: 6 },
  legend: { marginTop: 8, gap: 6 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  legendTxt: { fontFamily: fonts.regular, fontSize: 14, color: colors.inkSoft },
});

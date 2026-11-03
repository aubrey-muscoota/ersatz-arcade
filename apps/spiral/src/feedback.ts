import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';
import { Grade } from './game/logic';

const on = Platform.OS === 'ios' || Platform.OS === 'android';

export function hapticFor(g: Grade, milestone: boolean, golden: boolean) {
  if (!on) return;
  if (milestone || (golden && g !== 'miss')) return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  if (g === 'perfect') return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  if (g === 'good') return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
  if (g === 'close') return Haptics.selectionAsync();
  return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
}

export function hapticEnd(complete: boolean) {
  if (!on) return;
  Haptics.notificationAsync(
    complete ? Haptics.NotificationFeedbackType.Success : Haptics.NotificationFeedbackType.Error,
  );
}

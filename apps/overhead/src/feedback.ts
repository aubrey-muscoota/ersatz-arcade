import * as Haptics from 'expo-haptics';
import { Platform } from 'react-native';

const on = Platform.OS === 'ios' || Platform.OS === 'android';

export function hapticGuess(correct: boolean) {
  if (!on) return;
  if (correct) return Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  return Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
}

export function hapticLose() {
  if (!on) return;
  Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error);
}

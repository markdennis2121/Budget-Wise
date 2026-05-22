import { Platform, Vibration } from 'react-native';
import { Haptics, ImpactStyle, NotificationType } from '@capacitor/haptics';

var undoToastHandler = null;
export var UNDO_TOAST_MS = 5000;

export function registerUndoToastHandler(handler) {
  undoToastHandler = handler;
}

export function unregisterUndoToastHandler() {
  undoToastHandler = null;
}

export function showUndoToast(opts) {
  if (typeof undoToastHandler === 'function') {
    undoToastHandler(opts || {});
  }
}

export function triggerSuccessHaptic() {
  if (Platform.OS === 'web') return;
  try {
    // Use Capacitor Haptics for premium feel on native
    Haptics.notification({ type: NotificationType.Success }).catch(() => {
      // Fallback to RN Vibration
      Vibration.vibrate(50);
    });
  } catch (e) {
    Vibration.vibrate(50);
  }
}

export function triggerErrorHaptic() {
  if (Platform.OS === 'web') return;
  try {
    Haptics.notification({ type: NotificationType.Error }).catch(() => {
      Vibration.vibrate([0, 40, 60, 40]);
    });
  } catch (e) {
    Vibration.vibrate([0, 40, 60, 40]);
  }
}

export function triggerImpactHaptic(style) {
  if (Platform.OS === 'web') return;
  try {
    const impactStyle = ImpactStyle[style] || ImpactStyle.Light;
    Haptics.impact({ style: impactStyle }).catch(() => {});
  } catch (e) {}
}

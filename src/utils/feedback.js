import { Platform, Vibration } from 'react-native';

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
    Vibration.vibrate(50);
  } catch (e) {}
}

export function triggerErrorHaptic() {
  if (Platform.OS === 'web') return;
  try {
    Vibration.vibrate([0, 40, 60, 40]);
  } catch (e) {}
}

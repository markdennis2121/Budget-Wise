import { Alert, Platform } from 'react-native';
import {
  triggerSuccessHaptic,
  triggerErrorHaptic,
  showUndoToast
} from './feedback';

export var SAVE_SUCCESS_MS = 900;

/** Show check animation, refresh data, then close the modal/feature. */
export function completeSaveWithFeedback(opts) {
  opts = opts || {};
  var onSaved = opts.onSaved;
  var onClose = opts.onClose;
  var setShowSuccess = opts.setShowSuccess;
  var delay = opts.delay || SAVE_SUCCESS_MS;

  if (typeof opts.setSuccessMessage === 'function') {
    opts.setSuccessMessage(opts.message || opts.successMessage || 'Saved!');
  }
  if (typeof setShowSuccess === 'function') setShowSuccess(true);

  return new Promise(function (resolve) {
    setTimeout(function () {
      if (typeof setShowSuccess === 'function') setShowSuccess(false);
      triggerSuccessHaptic();
      if (typeof onSaved === 'function') onSaved();
      if (typeof onClose === 'function') onClose();
      if (typeof opts.undo === 'function') {
        showUndoToast({
          message: opts.undoMessage || opts.message || 'Saved!',
          onUndo: opts.undo,
          duration: opts.undoDuration
        });
      }
      resolve();
    }, delay);
  });
}

/** Run an async save; show check only on success, surface errors on failure (mobile-friendly). */
export function runSaveWithFeedback(promise, opts) {
  opts = opts || {};
  var onError = opts.onError;
  var errorMessage = opts.errorMessage || 'Could not save. Please try again.';

  return Promise.resolve(promise).then(function (result) {
    if (typeof opts.setSuccessMessage === 'function') {
      opts.setSuccessMessage(opts.message || opts.successMessage || 'Saved!');
    }
    return completeSaveWithFeedback(opts).then(function () {
      return result;
    });
  }).catch(function (err) {
    triggerErrorHaptic();
    if (typeof onError === 'function') {
      onError(err, errorMessage);
    } else {
      // Use modern Toast for errors instead of blocking Alerts
      showUndoToast({
        message: errorMessage,
        type: 'error',
        duration: 4000
      });
    }
    return Promise.reject(err);
  });
}

export { sanitizeDecimalInput } from './amountFormat';

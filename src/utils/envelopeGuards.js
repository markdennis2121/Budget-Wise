import { Alert, Platform } from 'react-native';
import { findEnvelopeForCategory } from './envelopeBudget';

/**
 * Envelopes persisted for the user (no UI defaults).
 */
export function parseUserEnvelopes(userSettings) {
  if (!userSettings || userSettings.envelopes == null) return [];
  var raw = userSettings.envelopes;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch (e) {
      return [];
    }
  }
  if (!Array.isArray(raw)) return [];
  return raw.filter(function (e) {
    return e && (e.id || e.name);
  });
}

export function hasUserEnvelopes(userSettings) {
  return parseUserEnvelopes(userSettings).length > 0;
}

/** Spending types that must target a real envelope. */
export function expenseTypeRequiresEnvelope(expType) {
  return expType === 'one_time' || expType === 'recurring';
}

export function showEnvelopeRequiredAlert(opts) {
  opts = opts || {};
  var title = opts.title || 'Create an envelope first';
  var message = opts.message || 'This app uses envelope budgeting. Add at least one envelope on the Dashboard before logging expenses or paying bills.';
  if (Platform.OS === 'web') {
    window.alert(title + '\n\n' + message);
    if (typeof opts.onAcknowledge === 'function') opts.onAcknowledge();
  } else {
    Alert.alert(title, message, [{ text: 'OK', onPress: opts.onAcknowledge }]);
  }
}

/**
 * Whether a bill/expense can be paid or saved against envelopes.
 */
export function validateEnvelopeForSpend(userSettings, category) {
  var envelopes = parseUserEnvelopes(userSettings);
  if (envelopes.length === 0) {
    return {
      ok: false,
      reason: 'no_envelopes',
      message: 'Create at least one envelope on the Dashboard before spending.'
    };
  }
  if (category != null && category !== '' && !findEnvelopeForCategory(envelopes, category)) {
    return {
      ok: false,
      reason: 'orphan_category',
      message: 'This bill is not linked to an envelope. Edit the bill or recreate your envelopes first.'
    };
  }
  return { ok: true, envelopes: envelopes };
}

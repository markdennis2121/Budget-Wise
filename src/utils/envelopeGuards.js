import { Alert, Platform } from 'react-native';
import { findEnvelopeForCategory } from './envelopeBudget';
import { getMonthStr } from './helpers';

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
export function expenseTypeRequiresEnvelope(expType, userSettings) {
  // If user is in Simple Mode, envelopes are optional.
  if (userSettings && userSettings.budgeting_style === 'simple') {
    return false;
  }
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
 * Calculate Envelope Balances - Unified Source of Truth for logic.
 */
export function computeEnvelopeBalances(rawEnvelopes, userHistory, recurringExpenses, curMonth) {
  var envs = rawEnvelopes.map(function (e) {
    return {
      ...e, // Senior Developer: Preserve all properties (archived, etc.)
      assigned: parseFloat(e.assigned) || 0,
      spent: 0,
      reserved: 0,
      spentThisMonth: 0
    };
  });

  // 1. Calculate LIFETIME spent for each envelope from history source of truth
  userHistory.forEach(function (h) {
    var amt = parseFloat(h.amount) || 0;
    var env = envs.find(function (e) { return e.id === h.category || e.name === h.category; });
    if (!env) return;

    if (h.expense_type === 'One-Time' || h.expense_type === 'Recurring') {
      env.spent += amt;
      if (curMonth && getMonthStr(h.date) === curMonth) env.spentThisMonth += amt;
    }
  });

  // 2. Reserved money for PENDING bills
  recurringExpenses.forEach(function (r) {
    if (r.status === 'Pending') {
      var amt = parseFloat(r.amount) || 0;
      var env = envs.find(function (e) { return e.id === r.category || e.name === r.category; });
      if (env) env.reserved += amt;
    }
  });

  return envs.map(function (e) {
    var available = e.assigned - e.spent - e.reserved;
    var budgetThisMonth = available + e.spentThisMonth;
    var spentPct = budgetThisMonth > 0 ? Math.min(100, Math.round((e.spentThisMonth / budgetThisMonth) * 100)) : (e.spentThisMonth > 0 ? 100 : 0);
    return { ...e, available, budgetThisMonth, spentPct };
  });
}

/**
 * Unified Spending Rules for both Quick Spend and Bill features.
 */
export function validateSpendOperation(params) {
  var amount = params.amount;
  var categoryId = params.categoryId;
  var envelopeBalances = params.envelopeBalances || [];
  var accountId = params.accountId;
  var accounts = params.accounts || [];
  var isRecurringPayment = !!params.isRecurringPayment;
  var isEdit = !!params.isEdit;
  var oldAmount = params.oldAmount || 0;

  // 1. Envelope Guard (Skip if no category provided, e.g. Simple Mode)
  if (categoryId) {
    var env = envelopeBalances.find(function(e) { return e.id === categoryId; });
    if (!env) {
      return { ok: false, message: 'Please select a valid budget envelope.' };
    }

    // If editing, we only care about the INCREASE in amount
    var effectiveAmount = isEdit ? (amount - oldAmount) : amount;

    if (effectiveAmount > 0) {
      if (isRecurringPayment) {
        // If paying a bill, the money is ALREADY reserved.
        // "Insufficient" means the envelope available balance is negative (you spent the reserved money elsewhere).
        if (env.available < 0) {
          return {
            ok: false,
            message: 'Insufficient funds in "' + env.name + '". You are overspent by ₱' + Math.abs(env.available).toFixed(2) + '. You must return money to this envelope before paying this bill.'
          };
        }
      } else {
        // For new Quick Spend or Edit increase, check if we have enough available balance.
        if (env.available < effectiveAmount) {
          return {
            ok: false,
            message: 'Insufficient funds in "' + env.name + '". Available: ₱' + env.available.toFixed(2) + (isEdit ? ' (Need ₱' + effectiveAmount.toFixed(2) + ' more)' : '')
          };
        }
      }
    }
  }

  var effectiveAmount = isEdit ? (amount - oldAmount) : amount;

  // 2. Wallet Guard
  if (accountId && accountId !== 'unlinked' && effectiveAmount > 0) {
    var acc = accounts.find(function(a) { return a.id === accountId; });
    if (acc && acc.balance < effectiveAmount) {
      return {
        ok: false,
        message: 'Insufficient funds in wallet: ' + acc.name + '. Balance: ₱' + acc.balance.toFixed(2) + (isEdit ? ' (Need ₱' + effectiveAmount.toFixed(2) + ' more)' : '')
      };
    }
  }

  return { ok: true };
}

/**
 * Rules for moving money between wallets.
 */
export function validateTransferOperation(params) {
  var amount = params.amount;
  var sourceId = params.sourceId;
  var destId = params.destId;
  var accounts = params.accounts || [];

  if (!sourceId || sourceId === 'unlinked') return { ok: false, message: 'Select a source wallet.' };
  if (!destId || destId === 'unlinked') return { ok: false, message: 'Select a destination wallet.' };
  if (sourceId === destId) return { ok: false, message: 'Source and destination must be different.' };

  var srcAcc = accounts.find(a => a.id === sourceId);
  if (srcAcc && srcAcc.balance < amount) {
    return { ok: false, message: 'Insufficient funds in ' + srcAcc.name + '. Balance: ₱' + srcAcc.balance.toFixed(2) };
  }

  return { ok: true };
}

/**
 * Basic presence check.
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

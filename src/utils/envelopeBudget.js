import { getMonthStr } from './helpers';

/** Internal envelope ids (env-xxx) that no longer exist in settings. */
export function isStaleEnvelopeId(category) {
  if (category == null || category === '') return false;
  return /^env-/i.test(String(category).trim());
}

/**
 * Map expense category to a stable stats bucket + human label.
 * Deleted envelopes roll up to "Deleted envelope" instead of raw ids.
 */
export function resolveCategoryBucket(category, envelopes) {
  var env = findEnvelopeForCategory(envelopes, category);
  if (env) {
    return { bucketKey: env.id, displayName: env.name, isOrphan: false };
  }

  var raw = category == null ? '' : String(category).trim();
  if (!raw) {
    return { bucketKey: '__other__', displayName: 'Other', isOrphan: true };
  }

  if (isStaleEnvelopeId(raw)) {
    return { bucketKey: '__deleted__', displayName: 'Deleted envelope', isOrphan: true };
  }

  return { bucketKey: '__legacy__:' + raw, displayName: raw, isOrphan: true };
}

function addSpendingToMap(map, category, amount, envelopes) {
  var amt = parseFloat(amount) || 0;
  if (amt <= 0) return;
  var bucket = resolveCategoryBucket(category, envelopes);
  if (!map[bucket.bucketKey]) {
    map[bucket.bucketKey] = { name: bucket.displayName, spent: 0, isOrphan: bucket.isOrphan };
  }
  map[bucket.bucketKey].spent += amt;
}

/**
 * Current-month (or filtered) spending grouped by envelope for charts/stats.
 */
export function buildEnvelopeSpendingForMonth(opts) {
  opts = opts || {};
  var envelopes = opts.envelopes || [];
  var curMonth = opts.curMonth;
  var map = {};

  envelopes.forEach(function (e) {
    map[e.id] = { name: e.name, spent: 0, isOrphan: false };
  });

  (opts.oneTimeExpenses || []).forEach(function (o) {
    if (curMonth && getMonthStr(o.date) !== curMonth) return;
    addSpendingToMap(map, o.category, o.amount, envelopes);
  });

  (opts.historyEntries || []).forEach(function (h) {
    if (h.expense_type !== 'Recurring') return;
    if (curMonth && getMonthStr(h.date) !== curMonth) return;
    var category = h.category;
    if (category == null || category === '') {
      var rec = opts.recurringByName && h.expense_name
        ? opts.recurringByName[h.expense_name]
        : null;
      if (rec) category = rec.category;
    }
    addSpendingToMap(map, category, h.amount, envelopes);
  });

  return Object.values(map)
    .filter(function (e) { return e.spent > 0; })
    .sort(function (a, b) { return b.spent - a.spent; });
}

/** Match recurring bill category to an envelope by id or legacy name. */
export function envelopeMatchesCategory(envelope, category) {
  if (!envelope || category == null || category === '') return false;
  return envelope.id === category || envelope.name === category;
}

export function findEnvelopeForCategory(envelopes, category) {
  if (!envelopes || !envelopes.length) return null;
  return envelopes.find(function (e) {
    return envelopeMatchesCategory(e, category);
  }) || null;
}

/** Pending recurring bills tied to a specific envelope. */
export function getPendingBillsForEnvelope(recurringExpenses, envelope) {
  if (!envelope || !recurringExpenses) return [];
  return recurringExpenses.filter(function (r) {
    return r.status === 'Pending' && envelopeMatchesCategory(envelope, r.category);
  });
}

/** Pending bills whose envelope no longer exists. */
export function getOrphanPendingBills(recurringExpenses, envelopes) {
  if (!recurringExpenses) return [];
  return recurringExpenses.filter(function (r) {
    if (r.status !== 'Pending') return false;
    return !findEnvelopeForCategory(envelopes, r.category);
  });
}

export function sumBillAmounts(bills) {
  return (bills || []).reduce(function (sum, b) {
    return sum + (parseFloat(b.amount) || 0);
  }, 0);
}

/**
 * Reassign pending bills to another envelope, or delete them if none remain.
 */
export function buildPendingBillCleanupPromises(mutateUpdateRecurring, mutateDeleteRecurring, pendingBills, remainingEnvelopes) {
  if (!pendingBills || !pendingBills.length) return [];

  var fallback = remainingEnvelopes && remainingEnvelopes.length > 0 ? remainingEnvelopes[0] : null;

  return pendingBills.map(function (bill) {
    if (fallback && mutateUpdateRecurring) {
      return mutateUpdateRecurring({
        id: bill.id,
        data: { category: fallback.id }
      });
    }
    if (mutateDeleteRecurring) {
      return mutateDeleteRecurring({ id: bill.id });
    }
    return Promise.resolve();
  });
}

export function isEnvelopeArchived(e) {
  if (!e) return false;
  return e.isArchived === true || e.isArchived === 'true' ||
         e.archived === true || e.archived === 'true' ||
         e.is_archived === true || e.is_archived === 'true';
}

/** Archive envelope in settings and fix pending bills that pointed at it. */
export function deleteEnvelopeAndCleanup(params) {
  var envelopeId = params.envelopeId;
  var envelopes = params.envelopes || [];
  var target = envelopes.find(function (e) { return e.id === envelopeId; });
  var pending = target ? getPendingBillsForEnvelope(params.recurringExpenses || [], target) : [];

  // Senior Developer Fix: Instead of removing, we mark as archived.
  var newList = envelopes.map(function (e) {
    if (e.id === envelopeId) {
      return {
        ...e,
        isArchived: true,
        archived: true,
        is_archived: true,
        assigned: 0
      };
    }
    return e;
  });

  var activeEnvelopes = newList.filter(function(e) {
    return !isEnvelopeArchived(e);
  });

  var cleanup = buildPendingBillCleanupPromises(
    params.mutateUpdateRecurring,
    params.mutateDeleteRecurring,
    pending,
    activeEnvelopes
  );

  // Instead of unlinking, we keep the link because the envelope still exists in the "Archive"
  // This keeps history browsing accurate.

  return Promise.all(cleanup).then(function () {
    if (!params.userSettings || !params.mutateUpdateSettings) return;
    return params.mutateUpdateSettings({
      id: params.userSettings.id,
      data: { envelopes: newList }
    });
  });
}

export function formatPendingBillsSummary(bills, formatCurrency) {
  if (!bills || !bills.length) return '';
  return bills.map(function (b) {
    return '"' + b.name + '" (' + formatCurrency(b.amount) + ')';
  }).join(', ');
}

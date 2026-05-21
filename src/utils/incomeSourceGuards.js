import { getCurrentMonthStr, getMonthStr } from './helpers';

export var INCOME_EDIT_BLOCKED_MSG =
  'Cannot reduce income below the amount already allocated or spent.';

export var INCOME_DELETE_BLOCKED_MSG =
  'Cannot delete this income source because the money has already been assigned or spent.';

export function sumIncomeSourceBudgetAmounts(incomeSources) {
  return (incomeSources || []).reduce(function (sum, src) {
    return sum + (parseFloat(src.amount) || 0);
  }, 0);
}

/**
 * Money already committed from income: envelope assignments + spending drawn from envelopes.
 */
export function computeBudgetCommitments(envelopes, envelopeBalances, oneTimeExpenses, userHistory, curMonth) {
  curMonth = curMonth || getCurrentMonthStr();

  var totalAssigned = (envelopes || []).reduce(function (sum, env) {
    return sum + (parseFloat(env.assigned) || 0);
  }, 0);

  var totalSpent = 0;
  if (envelopeBalances && envelopeBalances.length) {
    envelopeBalances.forEach(function (env) {
      totalSpent += parseFloat(env.spent) || 0;
    });
  } else {
    (oneTimeExpenses || []).forEach(function (o) {
      if (getMonthStr(o.date) === curMonth) {
        totalSpent += parseFloat(o.amount) || 0;
      }
    });
    (userHistory || []).forEach(function (h) {
      if (h.expense_type === 'Recurring' && getMonthStr(h.date) === curMonth) {
        totalSpent += parseFloat(h.amount) || 0;
      }
    });
  }

  return {
    totalAssigned: totalAssigned,
    totalSpent: totalSpent,
    totalUsed: totalAssigned + totalSpent
  };
}

function projectedReadyToAssignAfterDelta(readyToAssign, delta) {
  return (parseFloat(readyToAssign) || 0) + delta;
}

export function validateIncomeSourceAmountEdit(opts) {
  opts = opts || {};
  var incomeSources = opts.incomeSources || [];
  var sourceId = opts.sourceId;
  var newAmount = parseFloat(opts.newAmount);
  if (isNaN(newAmount) || newAmount < 0) newAmount = 0;

  var source = incomeSources.find(function (s) { return s.id === sourceId; });
  if (!source) return { ok: true };

  var commitments = opts.commitments || computeBudgetCommitments(
    opts.envelopes,
    opts.envelopeBalances,
    opts.oneTimeExpenses,
    opts.userHistory,
    opts.curMonth
  );

  var oldAmt = parseFloat(source.amount) || 0;
  var totalBudget = sumIncomeSourceBudgetAmounts(incomeSources);
  var newTotalBudget = totalBudget - oldAmt + newAmount;

  if (newTotalBudget < commitments.totalUsed) {
    return { ok: false, message: INCOME_EDIT_BLOCKED_MSG };
  }

  var reduction = Math.max(0, oldAmt - newAmount);
  if (reduction > 0 && projectedReadyToAssignAfterDelta(opts.readyToAssign, -reduction) < 0) {
    return { ok: false, message: INCOME_EDIT_BLOCKED_MSG };
  }

  var totalAvailableMoney = parseFloat(opts.totalAvailableMoney) || 0;
  if (totalAvailableMoney < commitments.totalUsed && newTotalBudget < commitments.totalUsed) {
    return { ok: false, message: INCOME_EDIT_BLOCKED_MSG };
  }

  return { ok: true };
}

export function validateIncomeSourceDelete(opts) {
  opts = opts || {};
  var incomeSources = opts.incomeSources || [];
  var sourceId = opts.sourceId;
  var source = incomeSources.find(function (s) { return s.id === sourceId; });
  if (!source) return { ok: true };

  var commitments = opts.commitments || computeBudgetCommitments(
    opts.envelopes,
    opts.envelopeBalances,
    opts.oneTimeExpenses,
    opts.userHistory,
    opts.curMonth
  );

  var sourceAmt = parseFloat(source.amount) || 0;
  var totalBudget = sumIncomeSourceBudgetAmounts(incomeSources);
  var projectedBudget = totalBudget - sourceAmt;

  if (projectedReadyToAssignAfterDelta(opts.readyToAssign, -sourceAmt) < 0) {
    return { ok: false, message: INCOME_DELETE_BLOCKED_MSG };
  }

  if (projectedBudget < commitments.totalUsed) {
    return { ok: false, message: INCOME_DELETE_BLOCKED_MSG };
  }

  return { ok: true };
}

export function validateIncomeTransactionEdit(opts) {
  opts = opts || {};
  var txn = opts.transaction;
  if (!txn || txn.expense_type !== 'Income') return { ok: true };

  var oldAmt = parseFloat(txn.amount) || 0;
  var newAmt = parseFloat(opts.newAmount);
  if (isNaN(newAmt) || newAmt < 0) newAmt = 0;

  var commitments = opts.commitments || computeBudgetCommitments(
    opts.envelopes,
    opts.envelopeBalances,
    opts.oneTimeExpenses,
    opts.userHistory,
    opts.curMonth
  );

  var delta = newAmt - oldAmt;
  if (projectedReadyToAssignAfterDelta(opts.readyToAssign, delta) < 0) {
    return { ok: false, message: INCOME_EDIT_BLOCKED_MSG };
  }

  var totalAvailableMoney = parseFloat(opts.totalAvailableMoney) || 0;
  if (totalAvailableMoney + delta < commitments.totalUsed) {
    return { ok: false, message: INCOME_EDIT_BLOCKED_MSG };
  }

  return { ok: true };
}

export function validateIncomeTransactionDelete(opts) {
  opts = opts || {};
  var txn = opts.transaction;
  if (!txn || txn.expense_type !== 'Income') return { ok: true };

  var amt = parseFloat(txn.amount) || 0;
  var commitments = opts.commitments || computeBudgetCommitments(
    opts.envelopes,
    opts.envelopeBalances,
    opts.oneTimeExpenses,
    opts.userHistory,
    opts.curMonth
  );

  if (projectedReadyToAssignAfterDelta(opts.readyToAssign, -amt) < 0) {
    return { ok: false, message: INCOME_DELETE_BLOCKED_MSG };
  }

  var totalAvailableMoney = parseFloat(opts.totalAvailableMoney) || 0;
  if (totalAvailableMoney - amt < commitments.totalUsed) {
    return { ok: false, message: INCOME_DELETE_BLOCKED_MSG };
  }

  return { ok: true };
}

/**
 * PENNY — COMPREHENSIVE MATH INTEGRITY TEST SUITE
 * ============================================================
 * Tests all financial math in the app against the EXACT production logic.
 *
 * Modules covered:
 *  1. accountBalances.js  — buildAccountsWithBalances
 *  2. envelopeGuards.js   — computeEnvelopeBalances, validateSpendOperation, validateTransferOperation
 *  3. amountFormat.js     — sanitizeAmountDigits, formatAmountWithCommas, parseFormattedAmount,
 *                           evaluateAmountExpression, normalizeAmountInputValue
 *  4. incomeSourceGuards  — sumIncomeSourceBudgetAmounts, computeBudgetCommitments, validateIncomeSourceAmountEdit,
 *                           validateIncomeSourceDelete
 *  5. envelopeBudget.js   — buildEnvelopeSpendingForMonth, sumBillAmounts, isEnvelopeArchived
 *  6. monthlyInsights.js  — buildMonthlyInsight
 *  7. helpers.js          — formatCurrency, parseAmount, getMonthStr
 *
 * Run:  node math-integrity-test.js
 */

// ═══════════════════════════════════════════════════════════════
//  PORTABLE REPLICAS OF PRODUCTION FUNCTIONS
//  (faithfully copied from /src/utils/* so this runs in Node.js)
// ═══════════════════════════════════════════════════════════════

// --- helpers.js ---
function padNum(n) { return n < 10 ? '0' + n : String(n); }
function getMonthStr(dateStr) {
  if (!dateStr) return '';
  var parts = dateStr.split('T')[0].split('-');
  return parts[0] + '-' + parts[1];
}
function getCurrentMonthStr() {
  var d = new Date();
  return d.getFullYear() + '-' + padNum(d.getMonth() + 1);
}

// --- amountFormat.js ---
function sanitizeAmountDigits(val, opts) {
  opts = opts || {};
  if (opts.allowExpression) {
    return String(val || '').replace(/[^0-9.+\-*/() ]/g, '');
  }
  var s = String(val || '').replace(/,/g, '');
  var neg = s.startsWith('-');
  s = s.replace(/-/g, '');
  s = s.replace(/[^0-9.]/g, '');
  var parts = s.split('.');
  if (parts.length > 2) {
    s = parts[0] + '.' + parts.slice(1).join('');
    parts = s.split('.');
  }
  var intPart = parts[0] || '';
  var dec = parts.length > 1 ? parts[1].slice(0, 2) : null;
  var out = intPart;
  if (dec !== null) out += '.' + dec;
  else if (parts.length > 1) out += '.';
  if (neg && (intPart !== '' || dec !== null || out.endsWith('.'))) {
    out = '-' + out;
  }
  return out;
}
function formatAmountWithCommas(raw) {
  var s = sanitizeAmountDigits(raw);
  if (s === '' || s === '-') return s;
  if (s === '.') return '0.';
  var neg = s.startsWith('-');
  if (neg) s = s.slice(1);
  var trailingDot = s.endsWith('.');
  var parts = s.split('.');
  var intPart = parts[0] || '0';
  if (intPart === '') intPart = '0';
  intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  var out = intPart;
  if (parts.length > 1 && parts[1] !== undefined) {
    out += '.' + parts[1];
  } else if (trailingDot) {
    out += '.';
  }
  return neg ? '-' + out : out;
}
function parseFormattedAmount(val) {
  if (val === '' || val === null || val === undefined) return NaN;
  var s = String(val).replace(/,/g, '').trim();
  if (s === '-' || s === '.' || s === '-.') return NaN;
  return parseFloat(s);
}
function evaluateAmountExpression(expr) {
  var s = sanitizeAmountDigits(expr, { allowExpression: true }).trim();
  if (!s || !/^[\d\s()+\-*/.]+$/.test(s)) return NaN;
  try {
    var result = Function('"use strict";return (' + s + ')')();
    if (typeof result !== 'number' || !isFinite(result)) return NaN;
    return result;
  } catch (e) {
    return NaN;
  }
}
function normalizeAmountInputValue(val, opts) {
  opts = opts || {};
  if (opts.allowExpression) {
    var evaluated = evaluateAmountExpression(val);
    if (!isNaN(evaluated)) {
      var n = Math.round(evaluated * 100) / 100;
      var raw = String(n);
      if (raw.indexOf('.') !== -1) raw = raw.replace(/\.?0+$/, '');
      return sanitizeAmountDigits(raw);
    }
  }
  return sanitizeAmountDigits(val);
}
function formatAmountForEdit(amount) {
  var n = parseFloat(amount);
  if (isNaN(n)) return '';
  if (n === 0) return '0';
  var s = String(n);
  if (s.indexOf('.') !== -1) {
    s = s.replace(/\.?0+$/, '');
  }
  return formatAmountWithCommas(s);
}

// --- helpers.js continued ---
function formatCurrency(amount) {
  var num = typeof amount === 'string' && amount.indexOf(',') !== -1
    ? (parseFormattedAmount(amount) || 0)
    : (parseFloat(amount) || 0);
  return '₱' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
function parseAmount(val) {
  if (val === '' || val === null || val === undefined) return 0;
  if (typeof val === 'number') return isNaN(val) ? 0 : val;
  var n = parseFormattedAmount(val);
  return isNaN(n) ? 0 : n;
}

// --- accountBalances.js ---
function buildAccountsWithBalances(opts) {
  opts = opts || {};
  // Simplified: skip migration/getStoredAccountsList, use raw accounts
  var rawList = (opts.userSettings && opts.userSettings.accounts) || [];
  var accs = rawList.map(function (a) {
    return {
      id: a.id,
      name: a.name,
      starting_balance: parseFloat(a.starting_balance) || 0,
      type: a.type || 'Custom',
      color: a.color || '#0F766E',
      balance: parseFloat(a.starting_balance) || 0
    };
  });

  (opts.userHistory || []).forEach(function (h) {
    var amt = parseFloat(h.amount) || 0;
    var accountId = h.account_id;
    var acc = accs.find(function (a) { return a.id === accountId; });

    if (h.expense_type === 'Transfer') {
      if (acc) {
        acc.balance -= amt;
      } else if ((!accountId || accountId === 'unlinked') && accs.length > 0) {
        accs[0].balance -= amt;
      }
      if (h.dest_account_id) {
        var d = accs.find(function (a) { return a.id === h.dest_account_id; });
        if (d) d.balance += amt;
      }
      return;
    }

    if (!acc && (!accountId || accountId === 'unlinked') && accs.length > 0) {
      acc = accs[0];
    }
    if (!acc) return;

    if (h.expense_type === 'Income') {
      acc.balance += amt;
    } else if (h.expense_type === 'One-Time' || h.expense_type === 'Recurring') {
      acc.balance -= amt;
    } else if (h.expense_type === 'Adjustment') {
      if (h.category === 'Income') {
        acc.balance += amt;
      } else {
        acc.balance -= amt;
      }
    }
  });
  return accs;
}

// --- envelopeGuards.js ---
function computeEnvelopeBalances(rawEnvelopes, userHistory, recurringExpenses, curMonth) {
  var envs = rawEnvelopes.map(function (e) {
    return {
      ...e,
      assigned: parseFloat(e.assigned) || 0,
      spent: 0,
      reserved: 0,
      spentThisMonth: 0
    };
  });

  userHistory.forEach(function (h) {
    var amt = parseFloat(h.amount) || 0;
    var env = envs.find(function (e) { return e.id === h.category || e.name === h.category; });
    if (!env) return;
    if (h.expense_type === 'One-Time' || h.expense_type === 'Recurring') {
      env.spent += amt;
      if (curMonth && getMonthStr(h.date) === curMonth) env.spentThisMonth += amt;
    }
  });

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

function validateSpendOperation(params) {
  var amount = params.amount;
  var categoryId = params.categoryId;
  var envelopeBalances = params.envelopeBalances || [];
  var accountId = params.accountId;
  var accounts = params.accounts || [];
  var isRecurringPayment = !!params.isRecurringPayment;
  var isEdit = !!params.isEdit;
  var oldAmount = params.oldAmount || 0;

  if (categoryId) {
    var env = envelopeBalances.find(function(e) { return e.id === categoryId; });
    if (!env) {
      return { ok: false, message: 'Please select a valid budget envelope.' };
    }
    var effectiveAmount = isEdit ? (amount - oldAmount) : amount;
    if (effectiveAmount > 0) {
      if (isRecurringPayment) {
        if (env.available < 0) {
          return { ok: false, message: 'Insufficient funds in "' + env.name + '".' };
        }
      } else {
        if (env.available < effectiveAmount) {
          return { ok: false, message: 'Insufficient funds in "' + env.name + '".' };
        }
      }
    }
  }

  var effectiveAmount = isEdit ? (amount - oldAmount) : amount;
  if (accountId && accountId !== 'unlinked' && effectiveAmount > 0) {
    var acc = accounts.find(function(a) { return a.id === accountId; });
    if (acc && acc.balance < effectiveAmount) {
      return { ok: false, message: 'Insufficient funds in wallet: ' + acc.name + '.' };
    }
  }
  return { ok: true };
}

function validateTransferOperation(params) {
  var amount = params.amount;
  var sourceId = params.sourceId;
  var destId = params.destId;
  var accounts = params.accounts || [];
  if (!sourceId || sourceId === 'unlinked') return { ok: false, message: 'Select a source wallet.' };
  if (!destId || destId === 'unlinked') return { ok: false, message: 'Select a destination wallet.' };
  if (sourceId === destId) return { ok: false, message: 'Source and destination must be different.' };
  var srcAcc = accounts.find(function (a) { return a.id === sourceId; });
  if (srcAcc && srcAcc.balance < amount) {
    return { ok: false, message: 'Insufficient funds in ' + srcAcc.name + '.' };
  }
  return { ok: true };
}

// --- envelopeBudget.js ---
function isEnvelopeArchived(e) {
  if (!e) return false;
  return e.isArchived === true || e.isArchived === 'true' ||
         e.archived === true || e.archived === 'true' ||
         e.is_archived === true || e.is_archived === 'true';
}

function sumBillAmounts(bills) {
  return (bills || []).reduce(function (sum, b) {
    return sum + (parseFloat(b.amount) || 0);
  }, 0);
}

function envelopeMatchesCategory(envelope, category) {
  if (!envelope || category == null || category === '') return false;
  return envelope.id === category || envelope.name === category;
}

function findEnvelopeForCategory(envelopes, category) {
  if (!envelopes || !envelopes.length) return null;
  return envelopes.find(function (e) {
    return envelopeMatchesCategory(e, category);
  }) || null;
}

function getPendingBillsForEnvelope(recurringExpenses, envelope) {
  if (!envelope || !recurringExpenses) return [];
  return recurringExpenses.filter(function (r) {
    return r.status === 'Pending' && envelopeMatchesCategory(envelope, r.category);
  });
}

function getOrphanPendingBills(recurringExpenses, envelopes) {
  if (!recurringExpenses) return [];
  return recurringExpenses.filter(function (r) {
    if (r.status !== 'Pending') return false;
    return !findEnvelopeForCategory(envelopes, r.category);
  });
}

function isStaleEnvelopeId(category) {
  if (category == null || category === '') return false;
  return /^env-/i.test(String(category).trim());
}

function resolveCategoryBucket(category, envelopes) {
  var env = findEnvelopeForCategory(envelopes, category);
  if (env) return { bucketKey: env.id, displayName: env.name, isOrphan: false };
  var raw = category == null ? '' : String(category).trim();
  if (!raw) return { bucketKey: '__other__', displayName: 'Other', isOrphan: true };
  if (isStaleEnvelopeId(raw)) return { bucketKey: '__deleted__', displayName: 'Deleted envelope', isOrphan: true };
  return { bucketKey: '__legacy__:' + raw, displayName: raw, isOrphan: true };
}

// --- incomeSourceGuards.js ---
function sumIncomeSourceBudgetAmounts(incomeSources) {
  return (incomeSources || []).reduce(function (sum, src) {
    return sum + (parseFloat(src.amount) || 0);
  }, 0);
}

function computeBudgetCommitments(envelopes, envelopeBalances, oneTimeExpenses, userHistory, curMonth) {
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
  return { totalAssigned, totalSpent, totalUsed: totalAssigned + totalSpent };
}

// --- monthlyInsights.js ---
function buildMonthlyInsight(opts) {
  opts = opts || {};
  var months = opts.monthlyTotals || [];
  var envelopeSpending = opts.envelopeSpending || [];
  if (months.length < 2) {
    return { icon: 'insights', color: '#3B82F6', title: 'Keep logging', text: 'Add a few more weeks...' };
  }
  var cur = months[months.length - 1];
  var prev = months[months.length - 2];
  var curSpent = parseFloat(cur.spent) || 0;
  var prevSpent = parseFloat(prev.spent) || 0;
  var curIncome = parseFloat(cur.income) || 0;
  var prevIncome = parseFloat(prev.income) || 0;
  var curNet = curIncome - curSpent;
  if (curSpent === 0 && curIncome === 0) {
    return { icon: 'add-chart', color: '#3B82F6', title: 'Start tracking', text: '...' };
  }
  var spendDelta = curSpent - prevSpent;
  var spendPct = prevSpent > 0 ? Math.round((spendDelta / prevSpent) * 100) : null;
  if (spendPct !== null && spendPct >= 25) return { title: 'Spending is up' };
  if (spendPct !== null && spendPct <= -15 && curSpent > 0) return { title: 'Spending is down' };
  if (curNet < 0 && curIncome > 0) return { title: 'Over budget this month' };
  if (curNet > 0 && curIncome > 0) return { title: 'On track to save' };
  return { title: 'Monthly snapshot' };
}


// ═══════════════════════════════════════════════════════════════
//  TEST RUNNER
// ═══════════════════════════════════════════════════════════════

let totalTests = 0;
let passed = 0;
let failed = 0;
const failures = [];

function assertEqual(label, actual, expected) {
  totalTests++;
  if (actual === expected) {
    passed++;
    console.log('  ✅ ' + label);
  } else {
    failed++;
    var msg = '  ❌ ' + label + '  →  expected ' + JSON.stringify(expected) + ', got ' + JSON.stringify(actual);
    console.log(msg);
    failures.push(msg);
  }
}

function assertApprox(label, actual, expected, epsilon) {
  epsilon = epsilon || 0.005;
  totalTests++;
  if (Math.abs(actual - expected) < epsilon) {
    passed++;
    console.log('  ✅ ' + label);
  } else {
    failed++;
    var msg = '  ❌ ' + label + '  →  expected ~' + expected + ', got ' + actual;
    console.log(msg);
    failures.push(msg);
  }
}

function assertTrue(label, val) {
  assertEqual(label, !!val, true);
}

function assertFalse(label, val) {
  assertEqual(label, !!val, false);
}

function section(name) {
  console.log('\n══════════════════════════════════════');
  console.log('  ' + name);
  console.log('══════════════════════════════════════');
}

// ─── 1. ACCOUNT BALANCE TESTS ─────────────────────────────────
section('1. ACCOUNT BALANCES');

(function() {
  // 1a. Initial starting balance
  var accs = buildAccountsWithBalances({
    userSettings: { accounts: [{ id: 'w1', name: 'Cash', starting_balance: 5000 }] },
    userHistory: []
  });
  assertEqual('1a. Starting balance = 5000', accs[0].balance, 5000);

  // 1b. Income adds
  accs = buildAccountsWithBalances({
    userSettings: { accounts: [{ id: 'w1', name: 'Cash', starting_balance: 1000 }] },
    userHistory: [
      { id: 'h1', expense_type: 'Income', amount: 500, account_id: 'w1', date: '2024-05-01' },
      { id: 'h2', expense_type: 'Income', amount: 250, account_id: 'w1', date: '2024-05-02' }
    ]
  });
  assertEqual('1b. Income: 1000 + 500 + 250 = 1750', accs[0].balance, 1750);

  // 1c. One-Time expense
  accs = buildAccountsWithBalances({
    userSettings: { accounts: [{ id: 'w1', name: 'Cash', starting_balance: 1000 }] },
    userHistory: [
      { id: 'h1', expense_type: 'One-Time', amount: 250, account_id: 'w1', date: '2024-05-03' }
    ]
  });
  assertEqual('1c. One-Time expense: 1000 - 250 = 750', accs[0].balance, 750);

  // 1d. Recurring expense
  accs = buildAccountsWithBalances({
    userSettings: { accounts: [{ id: 'w1', name: 'Cash', starting_balance: 1000 }] },
    userHistory: [
      { id: 'h1', expense_type: 'Recurring', amount: 100, account_id: 'w1', date: '2024-05-01' }
    ]
  });
  assertEqual('1d. Recurring expense: 1000 - 100 = 900', accs[0].balance, 900);

  // 1e. Transfer: source debited, dest credited
  accs = buildAccountsWithBalances({
    userSettings: {
      accounts: [
        { id: 'w1', name: 'Cash', starting_balance: 1000 },
        { id: 'w2', name: 'Savings', starting_balance: 0 }
      ]
    },
    userHistory: [
      { id: 'h1', expense_type: 'Transfer', amount: 300, account_id: 'w1', dest_account_id: 'w2', date: '2024-05-01' }
    ]
  });
  assertEqual('1e. Transfer source: 1000 - 300 = 700', accs[0].balance, 700);
  assertEqual('1e. Transfer dest: 0 + 300 = 300', accs[1].balance, 300);

  // 1f. Net worth conservation after transfer
  var net = accs.reduce((s, a) => s + a.balance, 0);
  assertEqual('1f. Net worth after transfer = 1000', net, 1000);

  // 1g. Adjustment (Income)
  accs = buildAccountsWithBalances({
    userSettings: { accounts: [{ id: 'w1', name: 'Cash', starting_balance: 500 }] },
    userHistory: [
      { id: 'h1', expense_type: 'Adjustment', amount: 100, account_id: 'w1', category: 'Income', date: '2024-05-01' }
    ]
  });
  assertEqual('1g. Adjustment Income: 500 + 100 = 600', accs[0].balance, 600);

  // 1h. Adjustment (Expense)
  accs = buildAccountsWithBalances({
    userSettings: { accounts: [{ id: 'w1', name: 'Cash', starting_balance: 500 }] },
    userHistory: [
      { id: 'h1', expense_type: 'Adjustment', amount: 50, account_id: 'w1', category: 'Expense', date: '2024-05-01' }
    ]
  });
  assertEqual('1h. Adjustment Expense: 500 - 50 = 450', accs[0].balance, 450);

  // 1i. Unlinked transaction falls back to first account
  accs = buildAccountsWithBalances({
    userSettings: { accounts: [{ id: 'w1', name: 'Cash', starting_balance: 500 }] },
    userHistory: [
      { id: 'h1', expense_type: 'Income', amount: 200, account_id: 'unlinked', date: '2024-05-01' }
    ]
  });
  assertEqual('1i. Unlinked income falls back to first wallet: 500 + 200 = 700', accs[0].balance, 700);

  // 1j. Multiple accounts, mixed operations
  accs = buildAccountsWithBalances({
    userSettings: {
      accounts: [
        { id: 'w1', name: 'GCash', starting_balance: 2000 },
        { id: 'w2', name: 'BPI', starting_balance: 5000 }
      ]
    },
    userHistory: [
      { id: 'h1', expense_type: 'Income', amount: 1000, account_id: 'w1', date: '2024-05-01' },
      { id: 'h2', expense_type: 'One-Time', amount: 500, account_id: 'w2', date: '2024-05-02' },
      { id: 'h3', expense_type: 'Transfer', amount: 200, account_id: 'w1', dest_account_id: 'w2', date: '2024-05-03' },
      { id: 'h4', expense_type: 'Recurring', amount: 150, account_id: 'w2', date: '2024-05-04' }
    ]
  });
  // w1: 2000 + 1000 - 200(transfer) = 2800
  // w2: 5000 - 500 + 200 - 150 = 4550
  assertEqual('1j. Multi-account GCash: 2000+1000-200 = 2800', accs[0].balance, 2800);
  assertEqual('1j. Multi-account BPI: 5000-500+200-150 = 4550', accs[1].balance, 4550);
  net = accs[0].balance + accs[1].balance;
  assertEqual('1j. Net worth: 2800+4550 = 7350 (started 7000, +1000 income, -500-150 expenses)', net, 7350);

  // 1k. Floating-point precision (e.g. 0.1 + 0.2 == 0.3 challenge)
  accs = buildAccountsWithBalances({
    userSettings: { accounts: [{ id: 'w1', name: 'Cash', starting_balance: 0.1 }] },
    userHistory: [
      { id: 'h1', expense_type: 'Income', amount: 0.2, account_id: 'w1', date: '2024-05-01' }
    ]
  });
  assertApprox('1k. Floating point: 0.1 + 0.2 ≈ 0.3', accs[0].balance, 0.3);

  // 1l. String amounts parsed correctly
  accs = buildAccountsWithBalances({
    userSettings: { accounts: [{ id: 'w1', name: 'Cash', starting_balance: '1000' }] },
    userHistory: [
      { id: 'h1', expense_type: 'Income', amount: '500.50', account_id: 'w1', date: '2024-05-01' }
    ]
  });
  assertApprox('1l. String amounts: "1000" + "500.50" = 1500.50', accs[0].balance, 1500.50);

  // 1m. Zero / missing amounts
  accs = buildAccountsWithBalances({
    userSettings: { accounts: [{ id: 'w1', name: 'Cash', starting_balance: 100 }] },
    userHistory: [
      { id: 'h1', expense_type: 'Income', amount: 0, account_id: 'w1', date: '2024-05-01' },
      { id: 'h2', expense_type: 'Income', amount: null, account_id: 'w1', date: '2024-05-02' },
      { id: 'h3', expense_type: 'Income', amount: undefined, account_id: 'w1', date: '2024-05-03' },
      { id: 'h4', expense_type: 'Income', amount: 'abc', account_id: 'w1', date: '2024-05-04' }
    ]
  });
  assertEqual('1m. Zero/null/undefined/invalid amounts = no change: 100', accs[0].balance, 100);

  // 1n. Transfer with no destination (one-way out)
  accs = buildAccountsWithBalances({
    userSettings: { accounts: [{ id: 'w1', name: 'Cash', starting_balance: 500 }] },
    userHistory: [
      { id: 'h1', expense_type: 'Transfer', amount: 200, account_id: 'w1', date: '2024-05-01' }
    ]
  });
  assertEqual('1n. Transfer with no dest: 500 - 200 = 300 (money leaves system)', accs[0].balance, 300);
})();


// ─── 2. ENVELOPE BALANCE TESTS ────────────────────────────────
section('2. ENVELOPE BALANCES');

(function() {
  // 2a. Basic envelope: assigned - spent = available
  var envs = computeEnvelopeBalances(
    [{ id: 'e1', name: 'Food', assigned: 500 }],
    [{ id: 'h1', expense_type: 'One-Time', amount: 150, category: 'e1', date: '2024-05-01' }],
    [],
    '2024-05'
  );
  assertEqual('2a. Envelope available: 500 - 150 = 350', envs[0].available, 350);
  assertEqual('2a. spentThisMonth = 150', envs[0].spentThisMonth, 150);

  // 2b. With pending bill reservation
  envs = computeEnvelopeBalances(
    [{ id: 'e1', name: 'Food', assigned: 500 }],
    [{ id: 'h1', expense_type: 'One-Time', amount: 100, category: 'e1', date: '2024-05-01' }],
    [{ id: 'r1', name: 'Netflix', amount: 50, category: 'e1', status: 'Pending' }],
    '2024-05'
  );
  assertEqual('2b. With reservation: 500 - 100 - 50 = 350', envs[0].available, 350);

  // 2c. Multiple envelopes independent
  envs = computeEnvelopeBalances(
    [
      { id: 'e1', name: 'Food', assigned: 300 },
      { id: 'e2', name: 'Transport', assigned: 200 }
    ],
    [
      { id: 'h1', expense_type: 'One-Time', amount: 100, category: 'e1', date: '2024-05-01' },
      { id: 'h2', expense_type: 'One-Time', amount: 50, category: 'e2', date: '2024-05-02' }
    ],
    [],
    '2024-05'
  );
  assertEqual('2c. Food available: 300 - 100 = 200', envs[0].available, 200);
  assertEqual('2c. Transport available: 200 - 50 = 150', envs[1].available, 150);

  // 2d. spentThisMonth only counts current month
  envs = computeEnvelopeBalances(
    [{ id: 'e1', name: 'Food', assigned: 500 }],
    [
      { id: 'h1', expense_type: 'One-Time', amount: 100, category: 'e1', date: '2024-04-15' },
      { id: 'h2', expense_type: 'One-Time', amount: 200, category: 'e1', date: '2024-05-10' }
    ],
    [],
    '2024-05'
  );
  assertEqual('2d. Total spent (lifetime): 300', envs[0].spent, 300);
  assertEqual('2d. spentThisMonth (May only): 200', envs[0].spentThisMonth, 200);
  assertEqual('2d. Available: 500 - 300 = 200', envs[0].available, 200);

  // 2e. Recurring expense contributes to envelope
  envs = computeEnvelopeBalances(
    [{ id: 'e1', name: 'Bills', assigned: 1000 }],
    [
      { id: 'h1', expense_type: 'Recurring', amount: 299, category: 'e1', date: '2024-05-01' },
      { id: 'h2', expense_type: 'One-Time', amount: 100, category: 'e1', date: '2024-05-05' }
    ],
    [],
    '2024-05'
  );
  assertEqual('2e. Recurring + One-Time spent: 299 + 100 = 399', envs[0].spent, 399);
  assertEqual('2e. Available: 1000 - 399 = 601', envs[0].available, 601);

  // 2f. Paid bill (not Pending) does NOT reserve
  envs = computeEnvelopeBalances(
    [{ id: 'e1', name: 'Bills', assigned: 500 }],
    [],
    [
      { id: 'r1', name: 'Spotify', amount: 100, category: 'e1', status: 'Paid' },
      { id: 'r2', name: 'Netflix', amount: 50, category: 'e1', status: 'Pending' }
    ],
    '2024-05'
  );
  assertEqual('2f. Only pending reserved: 500 - 0(spent) - 50(reserved) = 450', envs[0].available, 450);

  // 2g. Overspent envelope (negative available)
  envs = computeEnvelopeBalances(
    [{ id: 'e1', name: 'Food', assigned: 100 }],
    [{ id: 'h1', expense_type: 'One-Time', amount: 200, category: 'e1', date: '2024-05-01' }],
    [],
    '2024-05'
  );
  assertEqual('2g. Overspent: 100 - 200 = -100', envs[0].available, -100);

  // 2h. budgetThisMonth and spentPct calculation
  envs = computeEnvelopeBalances(
    [{ id: 'e1', name: 'Food', assigned: 500 }],
    [
      { id: 'h1', expense_type: 'One-Time', amount: 100, category: 'e1', date: '2024-05-01' },
      { id: 'h2', expense_type: 'One-Time', amount: 50, category: 'e1', date: '2024-05-10' }
    ],
    [],
    '2024-05'
  );
  // available = 500 - 150 = 350; budgetThisMonth = 350 + 150 = 500; pct = 150/500 * 100 = 30%
  assertEqual('2h. budgetThisMonth = 500', envs[0].budgetThisMonth, 500);
  assertEqual('2h. spentPct = 30%', envs[0].spentPct, 30);

  // 2i. Expense matched by envelope name (legacy)
  envs = computeEnvelopeBalances(
    [{ id: 'e1', name: 'Food', assigned: 300 }],
    [{ id: 'h1', expense_type: 'One-Time', amount: 100, category: 'Food', date: '2024-05-01' }],
    [],
    '2024-05'
  );
  assertEqual('2i. Match by name (legacy): 300 - 100 = 200', envs[0].available, 200);

  // 2j. Unmatched expense category ignored
  envs = computeEnvelopeBalances(
    [{ id: 'e1', name: 'Food', assigned: 300 }],
    [{ id: 'h1', expense_type: 'One-Time', amount: 100, category: 'e-unknown', date: '2024-05-01' }],
    [],
    '2024-05'
  );
  assertEqual('2j. Unmatched category ignored: available = 300', envs[0].available, 300);
})();


// ─── 3. AMOUNT FORMAT & PARSE TESTS ──────────────────────────
section('3. AMOUNT FORMAT & PARSE');

(function() {
  // 3a. sanitizeAmountDigits
  assertEqual('3a. Sanitize "₱1,234.56" → "1234.56"', sanitizeAmountDigits('₱1,234.56'), '1234.56');
  assertEqual('3a. Sanitize "abc123" → "123"', sanitizeAmountDigits('abc123'), '123');
  assertEqual('3a. Sanitize "-500" → "-500"', sanitizeAmountDigits('-500'), '-500');
  assertEqual('3a. Sanitize "1.2.3" → "1.23"', sanitizeAmountDigits('1.2.3'), '1.23');
  assertEqual('3a. Sanitize "1.555" → "1.55" (2 decimal cap)', sanitizeAmountDigits('1.555'), '1.55');
  assertEqual('3a. Sanitize "" → ""', sanitizeAmountDigits(''), '');

  // 3b. formatAmountWithCommas
  assertEqual('3b. Format "1234567" → "1,234,567"', formatAmountWithCommas('1234567'), '1,234,567');
  assertEqual('3b. Format "1234.50" → "1,234.50"', formatAmountWithCommas('1234.50'), '1,234.50');
  assertEqual('3b. Format "0" → "0"', formatAmountWithCommas('0'), '0');
  assertEqual('3b. Format "" → ""', formatAmountWithCommas(''), '');
  assertEqual('3b. Format "-1234" → "-1,234"', formatAmountWithCommas('-1234'), '-1,234');

  // 3c. parseFormattedAmount
  assertEqual('3c. Parse "1,234.56" → 1234.56', parseFormattedAmount('1,234.56'), 1234.56);
  assertEqual('3c. Parse "500" → 500', parseFormattedAmount('500'), 500);
  assertTrue('3c. Parse "" → NaN', isNaN(parseFormattedAmount('')));
  assertTrue('3c. Parse null → NaN', isNaN(parseFormattedAmount(null)));
  assertTrue('3c. Parse "-" → NaN', isNaN(parseFormattedAmount('-')));
  assertTrue('3c. Parse "." → NaN', isNaN(parseFormattedAmount('.')));

  // 3d. evaluateAmountExpression
  assertEqual('3d. Expr "100+50" → 150', evaluateAmountExpression('100+50'), 150);
  assertEqual('3d. Expr "200-75" → 125', evaluateAmountExpression('200-75'), 125);
  assertEqual('3d. Expr "10*5" → 50', evaluateAmountExpression('10*5'), 50);
  assertEqual('3d. Expr "100/4" → 25', evaluateAmountExpression('100/4'), 25);
  assertEqual('3d. Expr "(100+50)*2" → 300', evaluateAmountExpression('(100+50)*2'), 300);
  assertTrue('3d. Expr "abc" → NaN', isNaN(evaluateAmountExpression('abc')));
  assertTrue('3d. Expr "1/0" → NaN (Infinity)', isNaN(evaluateAmountExpression('1/0')));

  // 3e. normalizeAmountInputValue
  assertEqual('3e. Normalize "100+50" with expression → "150"', normalizeAmountInputValue('100+50', { allowExpression: true }), '150');
  assertEqual('3e. Normalize "100+50" without expression → "10050"', normalizeAmountInputValue('100+50'), '10050');

  // 3f. formatAmountForEdit
  assertEqual('3f. FormatForEdit 1234 → "1,234"', formatAmountForEdit(1234), '1,234');
  assertEqual('3f. FormatForEdit 0 → "0"', formatAmountForEdit(0), '0');
  assertEqual('3f. FormatForEdit NaN → ""', formatAmountForEdit(NaN), '');
  assertEqual('3f. FormatForEdit 1234.50 → "1,234.5"', formatAmountForEdit(1234.5), '1,234.5');

  // 3g. formatCurrency
  assertEqual('3g. formatCurrency(1234.5) → "₱1,234.50"', formatCurrency(1234.5), '₱1,234.50');
  assertEqual('3g. formatCurrency(0) → "₱0.00"', formatCurrency(0), '₱0.00');
  assertEqual('3g. formatCurrency("1,000") → "₱1,000.00"', formatCurrency('1,000'), '₱1,000.00');

  // 3h. parseAmount
  assertEqual('3h. parseAmount("1,234.56") → 1234.56', parseAmount('1,234.56'), 1234.56);
  assertEqual('3h. parseAmount("") → 0', parseAmount(''), 0);
  assertEqual('3h. parseAmount(null) → 0', parseAmount(null), 0);
  assertEqual('3h. parseAmount(42) → 42', parseAmount(42), 42);
  assertEqual('3h. parseAmount(NaN) → 0', parseAmount(NaN), 0);
})();


// ─── 4. SPENDING & TRANSFER VALIDATION ────────────────────────
section('4. SPENDING & TRANSFER VALIDATION');

(function() {
  var envBalances = [
    { id: 'e1', name: 'Food', available: 200, spent: 100, assigned: 300 }
  ];
  var accounts = [
    { id: 'w1', name: 'Cash', balance: 500 }
  ];

  // 4a. Valid spend
  var r = validateSpendOperation({ amount: 100, categoryId: 'e1', envelopeBalances: envBalances, accountId: 'w1', accounts: accounts });
  assertTrue('4a. Valid spend: ok=true', r.ok);

  // 4b. Overspend envelope
  r = validateSpendOperation({ amount: 300, categoryId: 'e1', envelopeBalances: envBalances, accountId: 'w1', accounts: accounts });
  assertFalse('4b. Overspend envelope: ok=false', r.ok);

  // 4c. Overspend wallet
  r = validateSpendOperation({ amount: 100, categoryId: 'e1', envelopeBalances: [{ id: 'e1', name: 'Food', available: 1000 }], accountId: 'w1', accounts: [{ id: 'w1', name: 'Cash', balance: 50 }] });
  assertFalse('4c. Overspend wallet: ok=false', r.ok);

  // 4d. Invalid envelope ID
  r = validateSpendOperation({ amount: 50, categoryId: 'e-invalid', envelopeBalances: envBalances });
  assertFalse('4d. Invalid envelope ID: ok=false', r.ok);

  // 4e. Edit with increase within budget
  r = validateSpendOperation({ amount: 150, categoryId: 'e1', envelopeBalances: envBalances, isEdit: true, oldAmount: 100 });
  assertTrue('4e. Edit increase by 50, within 200 available: ok=true', r.ok);

  // 4f. Edit with decrease (always ok)
  r = validateSpendOperation({ amount: 50, categoryId: 'e1', envelopeBalances: envBalances, isEdit: true, oldAmount: 100 });
  assertTrue('4f. Edit decrease: ok=true', r.ok);

  // 4g. Transfer validation: valid
  r = validateTransferOperation({ amount: 100, sourceId: 'w1', destId: 'w2', accounts: [{ id: 'w1', name: 'Cash', balance: 500 }, { id: 'w2', name: 'Savings', balance: 0 }] });
  assertTrue('4g. Valid transfer: ok=true', r.ok);

  // 4h. Transfer: same source and dest
  r = validateTransferOperation({ amount: 100, sourceId: 'w1', destId: 'w1', accounts: [{ id: 'w1', name: 'Cash', balance: 500 }] });
  assertFalse('4h. Same source/dest: ok=false', r.ok);

  // 4i. Transfer: insufficient funds
  r = validateTransferOperation({ amount: 600, sourceId: 'w1', destId: 'w2', accounts: [{ id: 'w1', name: 'Cash', balance: 500 }, { id: 'w2', name: 'Savings', balance: 0 }] });
  assertFalse('4i. Insufficient transfer: ok=false', r.ok);

  // 4j. Transfer: missing source
  r = validateTransferOperation({ amount: 100, sourceId: '', destId: 'w2', accounts: [] });
  assertFalse('4j. Missing source: ok=false', r.ok);

  // 4k. Transfer: unlinked source
  r = validateTransferOperation({ amount: 100, sourceId: 'unlinked', destId: 'w2', accounts: [] });
  assertFalse('4k. Unlinked source: ok=false', r.ok);

  // 4l. Recurring payment with negative available (overspent envelope)
  r = validateSpendOperation({
    amount: 100,
    categoryId: 'e1',
    envelopeBalances: [{ id: 'e1', name: 'Food', available: -50 }],
    isRecurringPayment: true
  });
  assertFalse('4l. Recurring on overspent envelope: ok=false', r.ok);

  // 4m. Recurring payment with positive available
  r = validateSpendOperation({
    amount: 100,
    categoryId: 'e1',
    envelopeBalances: [{ id: 'e1', name: 'Food', available: 50 }],
    isRecurringPayment: true
  });
  assertTrue('4m. Recurring on funded envelope: ok=true', r.ok);
})();


// ─── 5. ENVELOPE BUDGET UTILITIES ─────────────────────────────
section('5. ENVELOPE BUDGET UTILITIES');

(function() {
  // 5a. sumBillAmounts
  assertEqual('5a. sumBillAmounts([]): 0', sumBillAmounts([]), 0);
  assertEqual('5a. sumBillAmounts: 100+200+50 = 350', sumBillAmounts([{ amount: 100 }, { amount: 200 }, { amount: 50 }]), 350);
  assertEqual('5a. sumBillAmounts with string: "75"+25 = 100', sumBillAmounts([{ amount: '75' }, { amount: 25 }]), 100);

  // 5b. isEnvelopeArchived
  assertTrue('5b. archived=true → true', isEnvelopeArchived({ archived: true }));
  assertTrue('5b. isArchived="true" → true', isEnvelopeArchived({ isArchived: 'true' }));
  assertTrue('5b. is_archived=true → true', isEnvelopeArchived({ is_archived: true }));
  assertFalse('5b. No archive flag → false', isEnvelopeArchived({ id: 'e1', name: 'Food' }));
  assertFalse('5b. null → false', isEnvelopeArchived(null));

  // 5c. envelopeMatchesCategory
  assertTrue('5c. Match by id', envelopeMatchesCategory({ id: 'e1', name: 'Food' }, 'e1'));
  assertTrue('5c. Match by name', envelopeMatchesCategory({ id: 'e1', name: 'Food' }, 'Food'));
  assertFalse('5c. No match', envelopeMatchesCategory({ id: 'e1', name: 'Food' }, 'e2'));
  assertFalse('5c. Null category', envelopeMatchesCategory({ id: 'e1' }, null));
  assertFalse('5c. Empty category', envelopeMatchesCategory({ id: 'e1' }, ''));

  // 5d. findEnvelopeForCategory
  var envs = [{ id: 'e1', name: 'Food' }, { id: 'e2', name: 'Transport' }];
  assertEqual('5d. Find by id', findEnvelopeForCategory(envs, 'e2').name, 'Transport');
  assertEqual('5d. Find by name', findEnvelopeForCategory(envs, 'Food').id, 'e1');
  assertEqual('5d. Not found → null', findEnvelopeForCategory(envs, 'e99'), null);
  assertEqual('5d. Empty list → null', findEnvelopeForCategory([], 'e1'), null);

  // 5e. getPendingBillsForEnvelope
  var bills = [
    { id: 'r1', status: 'Pending', category: 'e1', name: 'Netflix' },
    { id: 'r2', status: 'Paid', category: 'e1', name: 'Spotify' },
    { id: 'r3', status: 'Pending', category: 'e2', name: 'Electric' }
  ];
  var pending = getPendingBillsForEnvelope(bills, { id: 'e1', name: 'Food' });
  assertEqual('5e. Pending bills for e1: 1 (Netflix)', pending.length, 1);
  assertEqual('5e. Correct bill name', pending[0].name, 'Netflix');

  // 5f. getOrphanPendingBills
  var orphans = getOrphanPendingBills(bills, [{ id: 'e1', name: 'Food' }]);
  assertEqual('5f. Orphan pending (e2 missing): 1', orphans.length, 1);
  assertEqual('5f. Orphan bill = Electric', orphans[0].name, 'Electric');

  // 5g. isStaleEnvelopeId
  assertTrue('5g. "env-food" is stale', isStaleEnvelopeId('env-food'));
  assertTrue('5g. "ENV-123" is stale (case insensitive)', isStaleEnvelopeId('ENV-123'));
  assertFalse('5g. "Food" is not stale', isStaleEnvelopeId('Food'));
  assertFalse('5g. empty is not stale', isStaleEnvelopeId(''));
  assertFalse('5g. null is not stale', isStaleEnvelopeId(null));

  // 5h. resolveCategoryBucket
  var bucket = resolveCategoryBucket('e1', envs);
  assertEqual('5h. Known id → bucketKey=e1', bucket.bucketKey, 'e1');
  assertFalse('5h. Known id → not orphan', bucket.isOrphan);

  bucket = resolveCategoryBucket('env-deleted-999', envs);
  assertEqual('5h. Stale id → __deleted__', bucket.bucketKey, '__deleted__');
  assertTrue('5h. Stale → orphan', bucket.isOrphan);

  bucket = resolveCategoryBucket(null, envs);
  assertEqual('5h. null → __other__', bucket.bucketKey, '__other__');

  bucket = resolveCategoryBucket('SomeLegacy', envs);
  assertEqual('5h. Legacy name → __legacy__:SomeLegacy', bucket.bucketKey, '__legacy__:SomeLegacy');
})();


// ─── 6. INCOME SOURCE GUARDS ─────────────────────────────────
section('6. INCOME SOURCE GUARDS');

(function() {
  // 6a. sumIncomeSourceBudgetAmounts
  assertEqual('6a. Sum income: 1000+500 = 1500', sumIncomeSourceBudgetAmounts([{ amount: 1000 }, { amount: 500 }]), 1500);
  assertEqual('6a. Empty → 0', sumIncomeSourceBudgetAmounts([]), 0);

  // 6b. computeBudgetCommitments
  var envelopes = [{ assigned: 300 }, { assigned: 200 }];
  var envBalances = [{ spent: 100 }, { spent: 50 }];
  var c = computeBudgetCommitments(envelopes, envBalances, [], []);
  assertEqual('6b. totalAssigned = 500', c.totalAssigned, 500);
  assertEqual('6b. totalSpent = 150', c.totalSpent, 150);
  assertEqual('6b. totalUsed = 650', c.totalUsed, 650);

  // 6c. computeBudgetCommitments with no envelope balances (fallback)
  c = computeBudgetCommitments(
    [{ assigned: 300 }], null,
    [{ date: '2024-05-01', amount: 100 }],
    [{ expense_type: 'Recurring', date: '2024-05-05', amount: 50 }],
    '2024-05'
  );
  assertEqual('6c. Fallback: totalSpent from expenses = 150', c.totalSpent, 150);
})();


// ─── 7. MONTHLY INSIGHTS ─────────────────────────────────────
section('7. MONTHLY INSIGHTS');

(function() {
  // 7a. Less than 2 months → "Keep logging"
  var r = buildMonthlyInsight({ monthlyTotals: [{ key: '2024-05', spent: 100, income: 200 }] });
  assertEqual('7a. <2 months → "Keep logging"', r.title, 'Keep logging');

  // 7b. Zero current month → "Start tracking"
  r = buildMonthlyInsight({ monthlyTotals: [
    { key: '2024-04', spent: 100, income: 200 },
    { key: '2024-05', spent: 0, income: 0 }
  ]});
  assertEqual('7b. Zero month → "Start tracking"', r.title, 'Start tracking');

  // 7c. Spending up 50% → "Spending is up"
  r = buildMonthlyInsight({ monthlyTotals: [
    { key: '2024-04', spent: 1000, income: 2000, label: 'Apr' },
    { key: '2024-05', spent: 1500, income: 2000, label: 'May' }
  ]});
  assertEqual('7c. 50% increase → "Spending is up"', r.title, 'Spending is up');

  // 7d. Spending down 20% → "Spending is down"
  r = buildMonthlyInsight({ monthlyTotals: [
    { key: '2024-04', spent: 1000, income: 2000, label: 'Apr' },
    { key: '2024-05', spent: 750, income: 2000, label: 'May' }
  ]});
  assertEqual('7d. -25% → "Spending is down"', r.title, 'Spending is down');

  // 7e. Over budget → "Over budget" (spending increase <25% so trend check doesn't fire first)
  r = buildMonthlyInsight({ monthlyTotals: [
    { key: '2024-04', spent: 1900, income: 2000, label: 'Apr' },
    { key: '2024-05', spent: 2000, income: 1500, label: 'May' }
  ]});
  assertEqual('7e. Expense > Income → "Over budget this month"', r.title, 'Over budget this month');

  // 7f. On track to save
  r = buildMonthlyInsight({ monthlyTotals: [
    { key: '2024-04', spent: 1000, income: 2000, label: 'Apr' },
    { key: '2024-05', spent: 1000, income: 2000, label: 'May' }
  ]});
  assertEqual('7f. Net positive, flat → "On track to save"', r.title, 'On track to save');
})();


// ─── 8. HELPER UTILITIES ──────────────────────────────────────
section('8. HELPER UTILITIES');

(function() {
  // 8a. getMonthStr
  assertEqual('8a. getMonthStr("2024-05-15") → "2024-05"', getMonthStr('2024-05-15'), '2024-05');
  assertEqual('8a. getMonthStr("2024-12-31T10:00:00") → "2024-12"', getMonthStr('2024-12-31T10:00:00'), '2024-12');
  assertEqual('8a. getMonthStr("") → ""', getMonthStr(''), '');

  // 8b. padNum
  assertEqual('8b. padNum(5) → "05"', padNum(5), '05');
  assertEqual('8b. padNum(12) → "12"', padNum(12), '12');
})();


// ─── 9. COMPLEX INTEGRATION SCENARIOS ─────────────────────────
section('9. INTEGRATION SCENARIOS');

(function() {
  // Full scenario: Salary → Assign envelopes → Spend → Pay bills → Transfer → Verify everything

  var userSettings = {
    accounts: [
      { id: 'w1', name: 'GCash', starting_balance: 0 },
      { id: 'w2', name: 'Savings', starting_balance: 0 }
    ],
    envelopes: [
      { id: 'e1', name: 'Food', assigned: 5000 },
      { id: 'e2', name: 'Bills', assigned: 3000 },
      { id: 'e3', name: 'Transport', assigned: 2000 }
    ]
  };
  var userHistory = [];
  var recurringExpenses = [];
  var curMonth = '2024-05';

  // Step 1: Receive salary
  userHistory.push({ id: 'h1', expense_type: 'Income', amount: 25000, account_id: 'w1', date: '2024-05-01' });
  var accs = buildAccountsWithBalances({ userSettings, userHistory });
  assertEqual('9a. Salary received: GCash = 25000', accs[0].balance, 25000);

  // Step 2: Transfer to savings
  userHistory.push({ id: 'h2', expense_type: 'Transfer', amount: 15000, account_id: 'w1', dest_account_id: 'w2', date: '2024-05-01' });
  accs = buildAccountsWithBalances({ userSettings, userHistory });
  assertEqual('9b. After transfer: GCash = 10000', accs[0].balance, 10000);
  assertEqual('9b. After transfer: Savings = 15000', accs[1].balance, 15000);

  // Step 3: Grocery shopping
  userHistory.push({ id: 'h3', expense_type: 'One-Time', amount: 1500, account_id: 'w1', category: 'e1', date: '2024-05-05' });
  // Step 4: Electricity bill
  userHistory.push({ id: 'h4', expense_type: 'Recurring', amount: 2500, account_id: 'w1', category: 'e2', date: '2024-05-10' });
  // Step 5: Grab rides
  userHistory.push({ id: 'h5', expense_type: 'One-Time', amount: 800, account_id: 'w1', category: 'e3', date: '2024-05-15' });

  accs = buildAccountsWithBalances({ userSettings, userHistory });
  // GCash: 25000 - 15000(transfer) - 1500 - 2500 - 800 = 5200
  assertEqual('9c. After spending: GCash = 5200', accs[0].balance, 5200);

  // Step 6: Pending water bill
  recurringExpenses.push({ id: 'r1', name: 'Water', amount: 500, category: 'e2', status: 'Pending' });

  // Verify envelope balances
  var envs = computeEnvelopeBalances(userSettings.envelopes, userHistory, recurringExpenses, curMonth);
  assertEqual('9d. Food: 5000 - 1500 = 3500', envs[0].available, 3500);
  assertEqual('9d. Bills: 3000 - 2500 - 500(reserved) = 0', envs[1].available, 0);
  assertEqual('9d. Transport: 2000 - 800 = 1200', envs[2].available, 1200);

  // Verify total net worth
  var totalNet = accs.reduce((s, a) => s + a.balance, 0);
  // Started 0, earned 25000, spent 1500+2500+800 = 4800, net = 20200
  assertEqual('9e. Net worth: 25000 - 4800 = 20200', totalNet, 20200);

  // Step 7: Validate that we can't overspend the Bills envelope
  var envBalances = computeEnvelopeBalances(userSettings.envelopes, userHistory, recurringExpenses, curMonth);
  var r = validateSpendOperation({
    amount: 100,
    categoryId: 'e2',
    envelopeBalances: envBalances,
    accountId: 'w1',
    accounts: accs
  });
  assertFalse('9f. Cannot spend from Bills (available=0): ok=false', r.ok);

  // Step 8: Can still spend from Food
  r = validateSpendOperation({
    amount: 500,
    categoryId: 'e1',
    envelopeBalances: envBalances,
    accountId: 'w1',
    accounts: accs
  });
  assertTrue('9g. Can spend 500 from Food (available=3500): ok=true', r.ok);

  // Step 9: Cannot transfer more than wallet balance
  r = validateTransferOperation({
    amount: 6000,
    sourceId: 'w1',
    destId: 'w2',
    accounts: accs
  });
  assertFalse('9h. Cannot transfer 6000 from GCash (balance=5200): ok=false', r.ok);

  // Step 10: Can transfer within balance
  r = validateTransferOperation({
    amount: 5000,
    sourceId: 'w1',
    destId: 'w2',
    accounts: accs
  });
  assertTrue('9i. Can transfer 5000 from GCash (balance=5200): ok=true', r.ok);
})();


// ─── 10. EDGE CASES ───────────────────────────────────────────
section('10. EDGE CASES');

(function() {
  // 10a. Empty history
  var accs = buildAccountsWithBalances({
    userSettings: { accounts: [{ id: 'w1', name: 'Cash', starting_balance: 100 }] },
    userHistory: []
  });
  assertEqual('10a. Empty history: balance = starting', accs[0].balance, 100);

  // 10b. Empty accounts
  accs = buildAccountsWithBalances({
    userSettings: { accounts: [] },
    userHistory: []
  });
  assertEqual('10b. No accounts: empty array', accs.length, 0);

  // 10c. Negative starting balance (shouldn't happen but shouldn't crash)
  accs = buildAccountsWithBalances({
    userSettings: { accounts: [{ id: 'w1', name: 'Cash', starting_balance: -100 }] },
    userHistory: []
  });
  assertEqual('10c. Negative starting balance: -100', accs[0].balance, -100);

  // 10d. Very large numbers
  accs = buildAccountsWithBalances({
    userSettings: { accounts: [{ id: 'w1', name: 'Cash', starting_balance: 999999999 }] },
    userHistory: [
      { id: 'h1', expense_type: 'Income', amount: 1, account_id: 'w1', date: '2024-05-01' }
    ]
  });
  assertEqual('10d. Large number: 999999999 + 1 = 1000000000', accs[0].balance, 1000000000);

  // 10e. formatCurrency with large numbers
  assertEqual('10e. formatCurrency(1000000) → "₱1,000,000.00"', formatCurrency(1000000), '₱1,000,000.00');

  // 10f. Multiple decimals in sanitize
  assertEqual('10f. sanitize "12.34.56.78" → "12.34"', sanitizeAmountDigits('12.34.56.78'), '12.34');

  // 10g. Expression with spaces
  assertEqual('10g. Expr "100 + 50" → 150', evaluateAmountExpression('100 + 50'), 150);

  // 10h. Envelope with zero assigned
  var envs = computeEnvelopeBalances(
    [{ id: 'e1', name: 'Empty', assigned: 0 }],
    [{ id: 'h1', expense_type: 'One-Time', amount: 50, category: 'e1', date: '2024-05-01' }],
    [],
    '2024-05'
  );
  assertEqual('10h. Zero assigned, 50 spent → available = -50', envs[0].available, -50);
  assertEqual('10h. spentPct = 100 (overspent)', envs[0].spentPct, 100);

  // 10i. Transaction with unknown expense_type is ignored
  accs = buildAccountsWithBalances({
    userSettings: { accounts: [{ id: 'w1', name: 'Cash', starting_balance: 1000 }] },
    userHistory: [
      { id: 'h1', expense_type: 'RandomType', amount: 500, account_id: 'w1', date: '2024-05-01' }
    ]
  });
  assertEqual('10i. Unknown expense_type ignored: balance = 1000', accs[0].balance, 1000);

  // 10j. Spend validation with no category (Simple Mode)
  var r = validateSpendOperation({
    amount: 100,
    categoryId: null,
    envelopeBalances: [],
    accountId: 'w1',
    accounts: [{ id: 'w1', name: 'Cash', balance: 500 }]
  });
  assertTrue('10j. No category (Simple Mode): ok=true', r.ok);

  // 10k. Spend validation with unlinked account
  r = validateSpendOperation({
    amount: 100,
    categoryId: null,
    accountId: 'unlinked',
    accounts: [{ id: 'w1', name: 'Cash', balance: 50 }]
  });
  assertTrue('10k. Unlinked account skips wallet guard: ok=true', r.ok);

  // 10l. Multiple pending bills for same envelope
  var envs2 = computeEnvelopeBalances(
    [{ id: 'e1', name: 'Bills', assigned: 1000 }],
    [],
    [
      { id: 'r1', name: 'Netflix', amount: 150, category: 'e1', status: 'Pending' },
      { id: 'r2', name: 'Spotify', amount: 100, category: 'e1', status: 'Pending' },
      { id: 'r3', name: 'Electric', amount: 250, category: 'e1', status: 'Pending' }
    ],
    '2024-05'
  );
  assertEqual('10l. Multiple pending: 1000 - 500 = 500', envs2[0].available, 500);
  assertEqual('10l. Total reserved = 500', envs2[0].reserved, 500);
})();


// ═══════════════════════════════════════════════════════════════
//  FINAL REPORT
// ═══════════════════════════════════════════════════════════════
console.log('\n══════════════════════════════════════');
console.log('  FINAL REPORT');
console.log('══════════════════════════════════════');
console.log('  Total tests:  ' + totalTests);
console.log('  Passed:       ' + passed);
console.log('  Failed:       ' + failed);

if (failed === 0) {
  console.log('\n🌟 ALL ' + totalTests + ' TESTS PASSED 🌟');
  console.log('The Penny math engine is verified stable.\n');
} else {
  console.log('\n⚠️  ' + failed + ' TEST(S) FAILED ⚠️');
  console.log('─────────────────────────────────────');
  failures.forEach(f => console.log(f));
  console.log('');
  process.exit(1);
}

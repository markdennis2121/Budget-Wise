import { getMonthStr } from './helpers';
import { DEFAULT_ACCOUNTS } from '../screens/dashboard/constants';

export function parseUserAccountsRaw(userSettings) {
  if (!userSettings || userSettings.accounts == null) {
    return { accounts: null, customized: false };
  }
  var raw = userSettings.accounts;
  if (typeof raw === 'string') {
    try {
      raw = JSON.parse(raw);
    } catch (e) {
      raw = [];
    }
  }
  return {
    accounts: Array.isArray(raw) ? raw : [],
    customized: !!userSettings.accounts_customized
  };
}

/** Persisted wallet rows only — never save computed `balance` to settings. */
export function serializeAccountsForStorage(accounts) {
  return (accounts || []).map(function (a, idx) {
    return {
      id: a.id || ('acc-' + idx),
      name: (a.name && String(a.name).trim()) || 'Wallet',
      starting_balance: Math.max(0, parseFloat(a.starting_balance) || 0),
      type: a.type || 'Custom',
      color: a.color || '#0F766E'
    };
  });
}

export function getStoredAccountsList(userSettings) {
  var parsed = parseUserAccountsRaw(userSettings);
  if (parsed.accounts === null) {
    return serializeAccountsForStorage(DEFAULT_ACCOUNTS);
  }
  if (parsed.accounts.length === 0 && !parsed.customized) {
    return serializeAccountsForStorage(DEFAULT_ACCOUNTS);
  }
  return serializeAccountsForStorage(parsed.accounts);
}

export function buildAccountsWithBalances(opts) {
  opts = opts || {};
  var curMonth = opts.curMonth;
  var rawList = getStoredAccountsList(opts.userSettings);

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

  (opts.incomeSources || []).forEach(function (src) {
    if (src.account_id && src.account_id !== 'unlinked') {
      var acc = accs.find(function (a) { return a.id === src.account_id; });
      if (acc) acc.balance += parseFloat(src.amount) || 0;
    }
  });

  (opts.oneTimeExpenses || []).forEach(function (o) {
    if (o.account_id && o.account_id !== 'unlinked') {
      var accO = accs.find(function (a) { return a.id === o.account_id; });
      if (accO) accO.balance -= parseFloat(o.amount) || 0;
    }
  });

  (opts.userHistory || []).forEach(function (h) {
    if (!h.account_id || h.account_id === 'unlinked') return;

    if (h.expense_type === 'Recurring') {
      if (curMonth && getMonthStr(h.date) !== curMonth) return;
      var accR = accs.find(function (a) { return a.id === h.account_id; });
      if (accR) accR.balance -= parseFloat(h.amount) || 0;
      return;
    }

    if (h.expense_type === 'Income') {
      if (curMonth && getMonthStr(h.date) !== curMonth) return;
      var accI = accs.find(function (a) { return a.id === h.account_id; });
      if (accI) accI.balance += parseFloat(h.amount) || 0;
      return;
    }

    if (h.expense_type === 'Transfer' && h.dest_account_id) {
      var amt = parseFloat(h.amount) || 0;
      var srcAcc = accs.find(function (a) { return a.id === h.account_id; });
      var destAcc = accs.find(function (a) { return a.id === h.dest_account_id; });
      if (srcAcc) srcAcc.balance -= amt;
      if (destAcc) destAcc.balance += amt;
    }
  });

  return accs;
}

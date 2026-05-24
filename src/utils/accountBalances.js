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
  return (accounts || []).map(function (a) {
    return {
      id: a.id,
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

  // Calculate LIFETIME wallet balance from history (Source of Truth)
  // Wallets are physical containers of cash; they don't reset every month.
  (opts.userHistory || []).forEach(function (h) {
    var amt = parseFloat(h.amount) || 0;
    var accountId = h.account_id;

    var acc = accs.find(function (a) { return a.id === accountId; });

    // Senior Debugger Fix: Handle Transfers as a distinct architectural operation.
    // This fixes the bug where withdrawals from virtual sources (like Savings)
    // weren't being added back to the destination wallet correctly, or were
    // incorrectly stealing from the fallback 'Cash' wallet.
    if (h.expense_type === 'Transfer') {
      // 1. Deduct from source if it's a real wallet
      if (acc) {
        acc.balance -= amt;
      } else if ((!accountId || accountId === 'unlinked') && accs.length > 0) {
        // Fallback for untracked source transfers
        accs[0].balance -= amt;
      }

      // 2. Add to destination if it's a real wallet
      if (h.dest_account_id) {
        var d = accs.find(function (a) { return a.id === h.dest_account_id; });
        if (d) d.balance += amt;
      }
      return; // Exit early: Transfer logic is self-contained.
    }

    // Fallback for unlinked non-transfer transactions
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

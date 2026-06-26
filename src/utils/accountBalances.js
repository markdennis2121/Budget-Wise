import { getMonthStr } from './helpers';
import { DEFAULT_ACCOUNTS, WALLET_STYLES } from '../screens/dashboard/constants';

/**
 * Senior Debugger & Mobile Engineer: Automatically migrates "Custom" accounts
 * to official bank types if the user named them after a supported bank.
 */
function migrateAccountType(acc) {
  if (!acc || !acc.name) return acc;

  var name = acc.name.toLowerCase().trim();
  var currentType = acc.type || 'Custom';

  // Only attempt migration if it's currently a Custom type or doesn't match official style
  // or if we just want to ensure it's always up to date.

  // List of official types from WALLET_STYLES (excluding 'Custom' and 'Cash')
  var officialTypes = Object.keys(WALLET_STYLES).filter(t => t !== 'Custom' && t !== 'Cash');

  for (var i = 0; i < officialTypes.length; i++) {
    var type = officialTypes[i];
    var officialInfo = WALLET_STYLES[type];

    // Check if the user name matches the official type key or the official display name
    if (name === type.toLowerCase() || name === officialInfo.name.toLowerCase() || name.includes(type.toLowerCase())) {
       return {
         ...acc,
         type: type,
         // Only override color if it was the default custom teal or missing
         color: (acc.color === '#0F766E' || !acc.color) ? officialInfo.color : acc.color
       };
    }
  }

  return acc;
}

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
    var base = {
      id: a.id,
      name: (a.name && String(a.name).trim()) || 'Wallet',
      starting_balance: Math.max(0, parseFloat(a.starting_balance) || 0),
      type: a.type || 'Custom',
      color: a.color || '#0F766E',
      isArchived: !!(a.isArchived || a.archived || a.is_archived)
    };

    // Senior Developer: Apply auto-detection migration
    return migrateAccountType(base);
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
      isArchived: !!a.isArchived,
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

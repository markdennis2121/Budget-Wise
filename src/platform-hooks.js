import { useState, useEffect } from 'react';

// In-memory/localStorage mock database for budget app
const initialDb = {
  budget_users: [],
  user_settings: [],
  recurring_expenses: [],
  one_time_expenses: [],
  expense_history: [],
};

const DB_STORAGE_KEYS = [
  'budget_tracker_db',
  // Legacy keys from older app names/builds
  'penny_db',
  'budget_wise_db',
  'budgetwise_db',
  'budget_app_db'
];
const DB_SCHEMA_VERSION_KEY = 'budget_tracker_schema_version';
const CURRENT_SCHEMA_VERSION = 5;

const STARTER_ACCOUNTS = [
  { id: 'acc-cash', name: 'Cash Wallet', starting_balance: 0, type: 'Cash', color: '#4B5563' },
  { id: 'acc-gcash', name: 'GCash', starting_balance: 0, type: 'GCash', color: '#1E3A8A' },
  { id: 'acc-maya', name: 'Maya', starting_balance: 0, type: 'Maya', color: '#059669' },
  { id: 'acc-bpi', name: 'BPI Bank', starting_balance: 0, type: 'BPI', color: '#B91C1C' }
];

const normalizeLegacyDbTables = (rawDb) => {
  if (!rawDb || typeof rawDb !== 'object') return null;
  const legacy = { ...rawDb };

  // Map old table names to current schema names.
  if (!legacy.budget_users && Array.isArray(legacy.users)) legacy.budget_users = legacy.users;
  if (!legacy.user_settings && Array.isArray(legacy.settings)) legacy.user_settings = legacy.settings;
  if (!legacy.recurring_expenses && Array.isArray(legacy.recurring)) legacy.recurring_expenses = legacy.recurring;
  if (!legacy.one_time_expenses && Array.isArray(legacy.one_time)) legacy.one_time_expenses = legacy.one_time;
  if (!legacy.one_time_expenses && Array.isArray(legacy.expenses)) legacy.one_time_expenses = legacy.expenses;
  if (!legacy.expense_history && Array.isArray(legacy.history)) legacy.expense_history = legacy.history;

  return legacy;
};

const runVersionedMigrations = (db, fromVersion) => {
  var version = parseInt(fromVersion, 10);
  if (isNaN(version) || version < 0) version = 0;

  if (version < 1) {
    // Ensure user settings have baseline keys expected by newer screens.
    db.user_settings = (db.user_settings || []).map(setting => ({
      ...setting,
      monthly_salary: parseFloat(setting.monthly_salary) || 0,
      envelopes: setting.envelopes || [],
      income_sources: setting.income_sources || [],
      accounts: setting.accounts || []
    }));
    version = 1;
  }

  if (version < 2) {
    // Newer account-aware features rely on account_id existing.
    db.one_time_expenses = (db.one_time_expenses || []).map(exp => ({
      ...exp,
      account_id: exp.account_id || 'unlinked'
    }));
    db.recurring_expenses = (db.recurring_expenses || []).map(rec => ({
      ...rec,
      account_id: rec.account_id || 'unlinked'
    }));
    db.expense_history = (db.expense_history || []).map(item => ({
      ...item,
      account_id: item.account_id || 'unlinked'
    }));
    version = 2;
  }

  if (version < 3) {
    // Newer UIs assume explicit expense_name in history rows.
    db.expense_history = (db.expense_history || []).map(item => ({
      ...item,
      expense_name: item.expense_name || item.name || 'Transaction'
    }));
    version = 3;
  }

  if (version < 4) {
    db.user_settings = (db.user_settings || []).map(function (setting) {
      var accounts = setting.accounts;
      if (typeof accounts === 'string') {
        try {
          accounts = JSON.parse(accounts);
        } catch (e) {
          accounts = [];
        }
      }
      if (!Array.isArray(accounts)) accounts = [];
      if (accounts.length === 0 && !setting.accounts_customized) {
        accounts = STARTER_ACCOUNTS.map(function (a) { return { ...a }; });
      }
      return { ...setting, accounts: accounts };
    });
    version = 4;
  }

  if (version < 5) {
    // CRITICAL FIX: Ensure all account IDs are consistent and no balances are NaN
    db.user_settings = (db.user_settings || []).map(function (setting) {
      if (setting.accounts && Array.isArray(setting.accounts)) {
        setting.accounts = setting.accounts.map(function (acc) {
          // Map any remaining legacy property names
          var sBal = acc.starting_balance !== undefined ? acc.starting_balance :
                    (acc.startingBalance !== undefined ? acc.startingBalance : 0);
          return {
            ...acc,
            id: acc.id || ('acc-' + Math.random().toString(36).substr(2, 9)),
            starting_balance: parseFloat(sBal) || 0,
            type: acc.type || 'Custom'
          };
        });
      }

      // Fix potential NaN in envelopes
      if (setting.envelopes && Array.isArray(setting.envelopes)) {
        setting.envelopes = setting.envelopes.map(function (e) {
          return {
            ...e,
            assigned: parseFloat(e.assigned) || 0
          };
        });
      }
      return setting;
    });

    // Ensure history rows have valid numbers
    db.expense_history = (db.expense_history || []).map(function (h) {
      return {
        ...h,
        amount: parseFloat(h.amount) || 0,
        account_id: h.account_id || 'unlinked'
      };
    });

    version = 5;
  }

  return db;
};

const sanitizeDb = (db) => {
  if (!db) return initialDb;
  
  // Ensure tables are arrays
  Object.keys(initialDb).forEach(table => {
    if (!db[table] || !Array.isArray(db[table])) {
      db[table] = [];
    }
  });

  // Sanitize user_settings
  db.user_settings = db.user_settings.map(setting => {
    let envelopes = setting.envelopes;
    if (envelopes) {
      try {
        if (typeof envelopes === 'string') {
          envelopes = JSON.parse(envelopes);
        }
      } catch (e) {
        envelopes = [];
      }
    }
    if (!Array.isArray(envelopes)) {
      envelopes = [];
    }
    
    // Repair envelopes values
    envelopes = envelopes.map((e, idx) => {
      const id = e.id || ('env-' + idx);
      const name = e.name || 'Category';
      let assigned = parseFloat(e.assigned);
      if (isNaN(assigned) || assigned < 0) assigned = 0;
      
      let goalAmt = e.goal_amount ? parseFloat(e.goal_amount) : null;
      if (goalAmt !== null && (isNaN(goalAmt) || goalAmt < 0)) goalAmt = null;

      return {
        id,
        name,
        assigned,
        goal_amount: goalAmt,
        goal_date: e.goal_date || null,
        icon: e.icon || null
      };
    });

    let incomeSources = setting.income_sources;
    if (incomeSources) {
      try {
        if (typeof incomeSources === 'string') {
          incomeSources = JSON.parse(incomeSources);
        }
      } catch (e) {
        incomeSources = [];
      }
    }
    if (!Array.isArray(incomeSources)) {
      incomeSources = [];
    }

    // Repair income sources
    incomeSources = incomeSources.map((src, idx) => {
      const id = src.id || ('inc-' + idx);
      const name = src.name || 'Income Source';
      let amt = parseFloat(src.amount);
      if (isNaN(amt) || amt < 0) amt = 0;
      return { id, name, amount: amt, account_id: src.account_id || 'unlinked' };
    });

    let accounts = setting.accounts;
    if (accounts) {
      try {
        if (typeof accounts === 'string') {
          accounts = JSON.parse(accounts);
        }
      } catch (e) {
        accounts = null;
      }
    }
    if (accounts && !Array.isArray(accounts)) {
      accounts = null;
    }
    if (accounts) {
      accounts = accounts.map((acc, idx) => {
        const id = acc.id || ('acc-' + idx);
        const name = acc.name || 'Wallet';
        // Map startingBalance (legacy) to starting_balance
        let sBal = acc.starting_balance !== undefined ? acc.starting_balance : acc.startingBalance;
        let starting_balance = parseFloat(sBal);
        if (isNaN(starting_balance) || starting_balance < 0) starting_balance = 0;
        return {
          id,
          name,
          starting_balance,
          type: acc.type || 'Custom',
          color: acc.color || '#0F766E'
        };
      });
    }

    return {
      ...setting,
      envelopes,
      income_sources: incomeSources,
      accounts
    };
  });

  // Sanitize budget_users
  db.budget_users = db.budget_users
    .filter(user => user && typeof user === 'object')
    .map((user, idx) => {
      const id = user.id || ('usr-' + idx);
      const email = (user.email || '').toString().trim().toLowerCase();
      const name = (user.name || '').toString().trim() || 'User';
      const password = (user.password || '').toString();
      return {
        ...user,
        id,
        email,
        name,
        password,
        created_at: user.created_at || new Date().toISOString().split('T')[0]
      };
    })
    .filter(user => !!user.email);

  // --- Legacy Income Migration Phase ---
  // Identify and extract transactions that represent incomes but were incorrectly logged in one_time_expenses or recurring_expenses
  const legacyIncomes = [];

  // Filter out incomes from one_time_expenses
  db.one_time_expenses = db.one_time_expenses.filter(exp => {
    const name = (exp.name || '').toLowerCase();
    const isLegacyIncome = name.includes('salary') || name.includes('income') || name.includes('payday') || exp.expense_type === 'Income';
    if (isLegacyIncome) {
      legacyIncomes.push({
        id: exp.id,
        user_id: exp.user_id,
        expense_name: exp.name,
        amount: parseFloat(exp.amount) || 0,
        expense_type: 'Income',
        date: exp.date || new Date().toISOString().split('T')[0],
        status: 'Received',
        notes: 'Auto-Migrated from legacy One-Time transaction',
        account_id: exp.account_id || 'unlinked'
      });
      return false; // Remove from one-time expenses (spent)
    }
    return true;
  });

  // Filter out incomes from recurring_expenses
  db.recurring_expenses = db.recurring_expenses.filter(rec => {
    const name = (rec.name || '').toLowerCase();
    const isLegacyIncome = name.includes('salary') || name.includes('income') || name.includes('payday') || rec.expense_type === 'Income';
    if (isLegacyIncome) {
      if (rec.status === 'Paid' || rec.status === 'Paid in Advance' || rec.status === 'Received') {
        legacyIncomes.push({
          id: rec.id,
          user_id: rec.user_id,
          expense_name: rec.name,
          amount: parseFloat(rec.amount) || 0,
          expense_type: 'Income',
          date: rec.due_date || new Date().toISOString().split('T')[0],
          status: 'Received',
          notes: 'Auto-Migrated from legacy Recurring bill',
          account_id: rec.account_id || 'unlinked'
        });
      }
      return false; // Remove from recurring expenses (spent)
    }
    return true;
  });

  // Merge any extracted legacy incomes into expense_history
  if (legacyIncomes.length > 0) {
    if (!db.expense_history) db.expense_history = [];
    legacyIncomes.forEach(inc => {
      const exists = db.expense_history.some(h => h.id === inc.id);
      if (!exists) {
        db.expense_history.push(inc);
      }
    });
  }
  // --------------------------------------

  // Sanitize one_time_expenses
  db.one_time_expenses = db.one_time_expenses.map(exp => {
    let amt = parseFloat(exp.amount);
    if (isNaN(amt) || amt < 0) amt = 0;
    return {
      ...exp,
      amount: amt,
      category: exp.category || 'env-food',
      date: exp.date || new Date().toISOString().split('T')[0]
    };
  });

  // Sanitize recurring_expenses
  db.recurring_expenses = db.recurring_expenses.map(rec => {
    let amt = parseFloat(rec.amount);
    if (isNaN(amt) || amt < 0) amt = 0;
    return {
      ...rec,
      amount: amt,
      category: rec.category || 'env-housing',
      due_date: rec.due_date || new Date().toISOString().split('T')[0],
      status: rec.status || 'Pending'
    };
  });

  // Sanitize expense_history
  db.expense_history = db.expense_history.map(h => {
    let amt = parseFloat(h.amount);
    if (isNaN(amt) || amt < 0) amt = 0;
    return {
      ...h,
      amount: amt,
      expense_type: h.expense_type || 'Expense',
      date: h.date || new Date().toISOString().split('T')[0]
    };
  });

  return db;
};

const getDb = () => {
  try {
    var schemaVersionRaw = localStorage.getItem(DB_SCHEMA_VERSION_KEY);
    var schemaVersion = parseInt(schemaVersionRaw, 10);
    if (isNaN(schemaVersion)) schemaVersion = 0;

    for (var i = 0; i < DB_STORAGE_KEYS.length; i++) {
      const key = DB_STORAGE_KEYS[i];
      const data = localStorage.getItem(key);
      if (!data) continue;
      try {
        const parsed = JSON.parse(data);
        const normalized = normalizeLegacyDbTables(parsed);
        const migrated = runVersionedMigrations(normalized, schemaVersion);
        const sanitized = sanitizeDb(migrated);
        saveDb(sanitized); // Auto-persist repaired schema instantly!
        localStorage.setItem(DB_SCHEMA_VERSION_KEY, String(CURRENT_SCHEMA_VERSION));
        return sanitized;
      } catch (parseErr) {
        // Skip corrupted legacy keys and continue scanning fallbacks.
      }
    }
    return initialDb;
  } catch (e) {
    return initialDb;
  }
};

const saveDb = (db) => {
  try {
    localStorage.setItem('budget_tracker_db', JSON.stringify(db));
  } catch (e) {
    console.error('Failed to save DB', e);
  }
};

// Global listeners to notify queries of updates
const listeners = new Set();
const notifyListeners = () => {
  listeners.forEach(listener => listener());
};

export const useQuery = (table) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchData = () => {
    setLoading(true);
    const db = getDb();
    setData(db[table] || []);
    setLoading(false);
  };

  useEffect(() => {
    fetchData();
    const handleUpdate = () => fetchData();
    listeners.add(handleUpdate);
    return () => {
      listeners.delete(handleUpdate);
    };
  }, [table]);

  return {
    data,
    loading,
    refetch: fetchData
  };
};

export const useMutation = (table, type) => {
  const [loading, setLoading] = useState(false);

  const mutate = (payload) => {
    setLoading(true);
    return new Promise((resolve, reject) => {
      try {
        const db = getDb();
        if (!db[table]) db[table] = [];

        if (type === 'insert') {
          db[table].push(payload);
        } else if (type === 'update') {
          const index = db[table].findIndex(item => item.id === payload.id);
          if (index !== -1) {
            db[table][index] = { ...db[table][index], ...payload.data };
          }
        } else if (type === 'delete') {
          db[table] = db[table].filter(item => item.id !== payload.id);
        }

        saveDb(db);
        notifyListeners();
        setLoading(false);
        resolve(payload);
      } catch (e) {
        setLoading(false);
        reject(e);
      }
    });
  };

  return {
    mutate,
    loading
  };
};

/** Read full local database (for backup/export). */
export const getDatabase = function () {
  return getDb();
};

/** Write full database and refresh all query subscribers. */
export const persistDatabase = function (db) {
  saveDb(db);
  notifyListeners();
};

export const DB_SCHEMA_VERSION = CURRENT_SCHEMA_VERSION;

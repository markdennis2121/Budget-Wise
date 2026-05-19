import { useState, useEffect } from 'react';

// In-memory/localStorage mock database for budget app
const initialDb = {
  budget_users: [],
  user_settings: [],
  recurring_expenses: [],
  one_time_expenses: [],
  expense_history: [],
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
        goal_date: e.goal_date || null
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
      return { id, name, amount: amt };
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
        let starting_balance = parseFloat(acc.starting_balance);
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
    const data = localStorage.getItem('budget_tracker_db');
    if (!data) return initialDb;
    const parsed = JSON.parse(data);
    const sanitized = sanitizeDb(parsed);
    saveDb(sanitized); // Auto-persist repaired schema instantly!
    return sanitized;
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
      setTimeout(() => {
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
      }, 200); // Simulate network latency
    });
  };

  return {
    mutate,
    loading
  };
};

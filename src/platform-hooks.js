import { useState, useEffect } from 'react';

// In-memory/localStorage mock database for budget app
const initialDb = {
  budget_users: [],
  user_settings: [],
  recurring_expenses: [],
  one_time_expenses: [],
  expense_history: [],
};

const getDb = () => {
  try {
    const data = localStorage.getItem('budget_tracker_db');
    return data ? JSON.parse(data) : initialDb;
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

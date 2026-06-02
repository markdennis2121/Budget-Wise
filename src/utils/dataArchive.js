import { generateId } from './helpers';

/**
 * Calculates the Rollup Compression for old history.
 * Groups transactions by Month, Account, Category, and Type.
 * Returns summary transactions that perfectly replace the deleted ones.
 * 
 * @param {Array} history - Full user history
 * @param {String} cutoffDate - YYYY-MM-DD string. Anything strictly BEFORE this date is archived.
 * @param {String} userId - ID of the user.
 * 
 * @returns {Object} { summaryTransactions, historyIdsToDelete, archivedHistory }
 */
export function calculateArchiveRollup(history, cutoffDate, userId) {
  const historyIdsToDelete = [];
  const archivedHistory = [];
  
  // Grouping key: "YYYY-MM|account_id|category|dest_account_id|expense_type"
  const rollups = {};

  history.forEach(h => {
    // Only process items strictly older than the cutoff date
    if (h.date < cutoffDate) {
      historyIdsToDelete.push(h.id);
      archivedHistory.push(h);

      const amt = parseFloat(h.amount) || 0;
      if (amt === 0) return; // Ignore 0 amount transactions

      // Extract Month YYYY-MM
      let month = '';
      try {
        month = h.date.substring(0, 7);
      } catch (e) {
        month = '2000-01';
      }

      const type = h.expense_type || 'Expense';
      const cat = h.category || '';
      const src = h.account_id || 'unlinked';
      const dest = h.dest_account_id || '';

      const key = `${month}|${src}|${cat}|${dest}|${type}`;

      if (!rollups[key]) {
        rollups[key] = {
          month,
          type,
          cat,
          src,
          dest,
          amount: 0
        };
      }
      rollups[key].amount += amt;
    }
  });

  // Convert grouped rollups into new summary transactions
  const summaryTransactions = Object.values(rollups).map(group => {
    // We use the 1st of the month for the summary date
    const date = `${group.month}-01`;
    
    // Create a human-readable summary name for analytics
    let name = `Summary: ${group.month}`;
    if (group.type === 'Transfer') {
      name = `Transfers Summary: ${group.month}`;
    } else if (group.type === 'Income') {
      name = `Income Summary: ${group.month}`;
    } else if (group.type === 'Adjustment') {
      name = `Adjustment Summary: ${group.month}`;
    }

    return {
      id: `rollup-${generateId()}`,
      user_id: userId,
      expense_name: name,
      amount: group.amount,
      expense_type: group.type,
      date: date,
      category: group.cat,
      account_id: group.src,
      dest_account_id: group.dest,
      status: 'Paid',
      notes: 'Auto-compressed historical summary'
    };
  });

  return {
    summaryTransactions,
    historyIdsToDelete,
    archivedHistory
  };
}

export function applyArchiveToDatabase(userId, summaryTransactions, historyIdsToDelete) {
  const { getDatabase, persistDatabase } = require('../platform-hooks');
  const db = getDatabase();
  
  if (!db) return false;

  // 1. Bulk delete old history
  if (db.expense_history && historyIdsToDelete.length > 0) {
    const idsSet = new Set(historyIdsToDelete);
    db.expense_history = db.expense_history.filter(h => !idsSet.has(h.id));
  } else {
    // If expense_history is completely missing for some reason
    db.expense_history = [];
  }

  // 2. Insert summary transactions
  if (summaryTransactions.length > 0) {
    db.expense_history = db.expense_history.concat(summaryTransactions);
  }

  // 3. Persist atomically
  persistDatabase(db);
  return true;
}

import { describe, it, expect } from 'vitest';
import { calculateArchiveRollup } from '../dataArchive';

describe('Data Archive Rollup Compression', () => {
  it('should correctly compress old history into monthly summaries', () => {
    const history = [
      // Group 1: 2023-01 Income Cash
      { id: 'h1', date: '2023-01-05', amount: 1000, expense_type: 'Income', category: 'Income', account_id: 'acc1' },
      { id: 'h2', date: '2023-01-15', amount: 500, expense_type: 'Income', category: 'Income', account_id: 'acc1' },
      
      // Group 2: 2023-01 One-Time env1 Cash
      { id: 'h3', date: '2023-01-10', amount: 100, expense_type: 'One-Time', category: 'env1', account_id: 'acc1' },
      { id: 'h4', date: '2023-01-20', amount: 50, expense_type: 'One-Time', category: 'env1', account_id: 'acc1' },

      // Group 3: 2023-02 Transfer Cash -> Bank
      { id: 'h5', date: '2023-02-01', amount: 300, expense_type: 'Transfer', account_id: 'acc1', dest_account_id: 'acc2' },

      // Too new, shouldn't be archived
      { id: 'h6', date: '2025-01-01', amount: 10, expense_type: 'One-Time', category: 'env1', account_id: 'acc2' }
    ];

    const cutoff = '2024-01-01'; // Archives h1 to h5
    const userId = 'user-1';

    const result = calculateArchiveRollup(history, cutoff, userId);

    // 5 items archived
    expect(result.historyIdsToDelete).toEqual(['h1', 'h2', 'h3', 'h4', 'h5']);

    // Should create 3 summary transactions
    expect(result.summaryTransactions.length).toBe(3);

    // Verify Group 1: 2023-01 Income Cash (1000 + 500 = 1500)
    const incomeSummary = result.summaryTransactions.find(t => t.expense_type === 'Income');
    expect(incomeSummary.amount).toBe(1500);
    expect(incomeSummary.date).toBe('2023-01-01');
    expect(incomeSummary.category).toBe('Income');
    expect(incomeSummary.account_id).toBe('acc1');

    // Verify Group 2: 2023-01 One-Time env1 Cash (100 + 50 = 150)
    const envSummary = result.summaryTransactions.find(t => t.expense_type === 'One-Time');
    expect(envSummary.amount).toBe(150);
    expect(envSummary.date).toBe('2023-01-01');
    expect(envSummary.category).toBe('env1');
    expect(envSummary.account_id).toBe('acc1');

    // Verify Group 3: 2023-02 Transfer Cash -> Bank (300)
    const transferSummary = result.summaryTransactions.find(t => t.expense_type === 'Transfer');
    expect(transferSummary.amount).toBe(300);
    expect(transferSummary.date).toBe('2023-02-01');
    expect(transferSummary.account_id).toBe('acc1');
    expect(transferSummary.dest_account_id).toBe('acc2');
  });
});

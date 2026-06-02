import { describe, it, expect } from 'vitest';
import {
  computeEnvelopeBalances,
  validateSpendOperation,
  validateTransferOperation
} from '../envelopeGuards';

describe('envelopeGuards Math Integration', () => {
  it('should compute envelope balances accurately', () => {
    const rawEnvelopes = [{ id: 'env-1', assigned: 500 }];
    const userHistory = [
      { id: 'h1', category: 'env-1', amount: 100, expense_type: 'One-Time', date: '2026-06-02' }
    ];
    const recurringExpenses = [
      { id: 'r1', category: 'env-1', amount: 50, status: 'Pending' }
    ];

    const balances = computeEnvelopeBalances(rawEnvelopes, userHistory, recurringExpenses, '2026-06');
    expect(balances.length).toBe(1);
    expect(balances[0].assigned).toBe(500);
    expect(balances[0].spent).toBe(100);
    expect(balances[0].reserved).toBe(50);
    expect(balances[0].available).toBe(350); // 500 - 100 - 50
    expect(balances[0].spentThisMonth).toBe(100);
  });

  it('should validate spend operations with envelopes', () => {
    const envelopeBalances = [
      { id: 'env-1', name: 'Food', available: 50 }
    ];

    // Attempt to spend 60 (which is > 50)
    const overspend = validateSpendOperation({
      amount: 60,
      categoryId: 'env-1',
      envelopeBalances
    });
    expect(overspend.ok).toBe(false);
    expect(overspend.message).toContain('Insufficient funds');

    // Attempt to spend 40 (which is < 50)
    const validSpend = validateSpendOperation({
      amount: 40,
      categoryId: 'env-1',
      envelopeBalances
    });
    expect(validSpend.ok).toBe(true);
  });

  it('should validate wallet transfers', () => {
    const accounts = [
      { id: 'acc-1', name: 'Cash', balance: 100 },
      { id: 'acc-2', name: 'Bank', balance: 50 }
    ];

    // Valid transfer
    const valid = validateTransferOperation({ amount: 50, sourceId: 'acc-1', destId: 'acc-2', accounts });
    expect(valid.ok).toBe(true);

    // Insufficient funds
    const invalid = validateTransferOperation({ amount: 150, sourceId: 'acc-1', destId: 'acc-2', accounts });
    expect(invalid.ok).toBe(false);
    expect(invalid.message).toContain('Insufficient funds');
    
    // Same account
    const same = validateTransferOperation({ amount: 10, sourceId: 'acc-1', destId: 'acc-1', accounts });
    expect(same.ok).toBe(false);
  });
});

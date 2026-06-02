import { describe, it, expect } from 'vitest';
import {
  parseUserAccountsRaw,
  serializeAccountsForStorage,
  getStoredAccountsList,
  buildAccountsWithBalances
} from '../accountBalances';

describe('accountBalances Math Integration', () => {
  it('should parse raw user accounts correctly', () => {
    const userSettings = { accounts: [{ id: '1', name: 'My Wallet', starting_balance: 100 }], accounts_customized: true };
    const result = parseUserAccountsRaw(userSettings);
    expect(result.accounts.length).toBe(1);
    expect(result.customized).toBe(true);
  });

  it('should serialize accounts and migrate types', () => {
    const rawAccounts = [{ id: '1', name: 'GCash', starting_balance: 50, type: 'Custom' }];
    const serialized = serializeAccountsForStorage(rawAccounts);
    expect(serialized[0].type).toBe('GCash'); // Should migrate since name is GCash
    expect(serialized[0].starting_balance).toBe(50);
  });

  it('should calculate lifetime balances correctly from history (Income and Expenses)', () => {
    const userSettings = {
      accounts: [
        { id: 'acc-1', name: 'Bank', starting_balance: 100, type: 'BPI' }
      ],
      accounts_customized: true
    };
    const userHistory = [
      { id: 'h1', account_id: 'acc-1', amount: 50, expense_type: 'Income' },
      { id: 'h2', account_id: 'acc-1', amount: 20, expense_type: 'One-Time' }
    ];

    const balances = buildAccountsWithBalances({ userSettings, userHistory });
    expect(balances.length).toBe(1);
    expect(balances[0].balance).toBe(130); // 100 + 50 - 20
  });

  it('should process Transfers correctly', () => {
    const userSettings = {
      accounts: [
        { id: 'acc-1', name: 'Bank 1', starting_balance: 100, type: 'BPI' },
        { id: 'acc-2', name: 'Bank 2', starting_balance: 50, type: 'Maya' }
      ],
      accounts_customized: true
    };
    const userHistory = [
      { id: 'h1', account_id: 'acc-1', dest_account_id: 'acc-2', amount: 30, expense_type: 'Transfer' }
    ];

    const balances = buildAccountsWithBalances({ userSettings, userHistory });
    expect(balances[0].balance).toBe(70); // 100 - 30
    expect(balances[1].balance).toBe(80); // 50 + 30
  });
});

import { getMonthStr } from './helpers';

export function isManualWalletTopUp(h) {
  if (!h || h.expense_type !== 'Income') return false;
  if (h.notes === 'Direct wallet balance top-up') return true;
  var name = h.expense_name || '';
  return name.indexOf('Manual Top-up:') === 0;
}

/** Income history rows that increased a specific wallet balance. */
export function getWalletIncomeHistoryForAccount(userHistory, accountId, opts) {
  opts = opts || {};
  var curMonth = opts.curMonth;
  return (userHistory || [])
    .filter(function (h) {
      if (h.expense_type !== 'Income') return false;
      if (!h.account_id || h.account_id !== accountId) return false;
      if (curMonth && getMonthStr(h.date) !== curMonth) return false;
      return true;
    })
    .sort(function (a, b) {
      if (a.date > b.date) return -1;
      if (a.date < b.date) return 1;
      return 0;
    });
}

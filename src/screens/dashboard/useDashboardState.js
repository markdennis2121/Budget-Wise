import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from 'platform-hooks';
import { getCurrentMonthStr, getMonthStr, isWithin5Days, isOverdue } from '../../utils/helpers';
import { getOrphanPendingBills, sumBillAmounts } from '../../utils/envelopeBudget';
import { parseUserEnvelopes, computeEnvelopeBalances } from '../../utils/envelopeGuards';
import { buildAccountsWithBalances } from '../../utils/accountBalances';

export function useDashboardState(userId) {
  var settingsQuery = useQuery('user_settings');
  var allSettings = settingsQuery.data || [];
  var userSettings = allSettings.find(function (s) { return s.user_id === userId; });

  var recurringQuery = useQuery('recurring_expenses');
  var allRecurring = recurringQuery.data || [];
  var recurringExpenses = allRecurring.filter(function (r) { return r.user_id === userId; });

  var curMonth = getCurrentMonthStr();

  var historyQuery = useQuery('expense_history');
  var allHistory = historyQuery.data || [];
  var userHistory = allHistory.filter(function (h) { return h.user_id === userId; });

  // Source of Truth: All calculations now use userHistory instead of one_time_expenses table
  var userOneTimeAll = useMemo(function() {
    return userHistory.filter(function(h) { return h.expense_type === 'One-Time'; });
  }, [userHistory]);

  var oneTimeExpenses = useMemo(function() {
    return userOneTimeAll.filter(function(o) { return getMonthStr(o.date) === curMonth; });
  }, [userOneTimeAll, curMonth]);

  var updateSettings = useMutation('user_settings', 'update');
  var mutateUpdateSettings = updateSettings.mutate;
  var updateRecurring = useMutation('recurring_expenses', 'update');
  var mutateUpdateRecurring = updateRecurring.mutate;
  var deleteRecurring = useMutation('recurring_expenses', 'delete');
  var mutateDeleteRecurring = deleteRecurring.mutate;
  var deleteHistory = useMutation('expense_history', 'delete');
  var mutateDeleteHistory = deleteHistory.mutate;

  var [showAddModal, setShowAddModal] = useState(false);
  var [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(function () {
    if (!userSettings || userSettings.has_seen_penny_tour) return;
    var timer = setTimeout(function () {
      setShowOnboarding(true);
    }, 450);
    return function () {
      clearTimeout(timer);
    };
  }, [userSettings]);

  var incomeSources = useMemo(function () {
    if (userSettings && userSettings.income_sources) {
      return typeof userSettings.income_sources === 'string' ? JSON.parse(userSettings.income_sources) : userSettings.income_sources;
    }
    var sal = userSettings ? (parseFloat(userSettings.monthly_salary) || 0) : 0;
    return [{ id: 'main-salary', name: 'Main Salary', amount: sal }];
  }, [userSettings]);

  var envelopes = useMemo(function () {
    return parseUserEnvelopes(userSettings);
  }, [userSettings]);

  var accounts = useMemo(function () {
    return buildAccountsWithBalances({
      userSettings: userSettings,
      userHistory: userHistory
    });
  }, [userSettings, userHistory]);

  var totalAvailableMoney = useMemo(function () {
    return accounts.reduce(function (sum, acc) { return sum + acc.balance; }, 0);
  }, [accounts]);

  var totalIncome = useMemo(function () {
    var sum = 0;
    userHistory.forEach(function (h) {
      if (getMonthStr(h.date) === curMonth) {
        var amt = parseFloat(h.amount) || 0;
        if (h.expense_type === 'Income') {
          sum += amt;
        } else if (h.expense_type === 'Adjustment') {
          // Add corrections to income, subtract balance reductions from income
          if (h.category === 'Income') sum += amt;
          if (h.category === 'Adjustment') sum -= amt;
        }
      }
    });
    return sum;
  }, [userHistory, curMonth]);

  var totalAssigned = useMemo(function () {
    return envelopes.reduce(function (sum, env) { return sum + (parseFloat(env.assigned) || 0); }, 0);
  }, [envelopes]);

  var envelopeBalances = useMemo(function () {
    return computeEnvelopeBalances(envelopes, userHistory, recurringExpenses, curMonth);
  }, [envelopes, recurringExpenses, userHistory, curMonth]);

  var orphanPendingTotal = useMemo(function () {
    return sumBillAmounts(getOrphanPendingBills(recurringExpenses, envelopes));
  }, [recurringExpenses, envelopes]);

  var totalExpenses = useMemo(function () {
    var oneTimeTotal = oneTimeExpenses.reduce(function (sum, o) {
      if (getMonthStr(o.date) === curMonth) {
        return sum + (parseFloat(o.amount) || 0);
      }
      return sum;
    }, 0);
    var recurringTotal = userHistory.reduce(function (sum, h) {
      if (h.expense_type === 'Recurring' && getMonthStr(h.date) === curMonth) {
        return sum + (parseFloat(h.amount) || 0);
      }
      return sum;
    }, 0);
    return oneTimeTotal + recurringTotal;
  }, [oneTimeExpenses, userHistory, curMonth]);

  var upcomingBills = useMemo(function () {
    return recurringExpenses.filter(function (r) {
      return r.status === 'Pending' && (isWithin5Days(r.due_date) || isOverdue(r.due_date));
    });
  }, [recurringExpenses]);

  var totalSaved = useMemo(function () {
    var raw = userSettings && userSettings.savings ? userSettings.savings : [];
    try { if (typeof raw === 'string') raw = JSON.parse(raw); } catch (e) { raw = userSettings && userSettings.savings ? userSettings.savings : []; }
    var arr = Array.isArray(raw) ? raw : [];
    return arr.reduce(function (s, r) { return s + (parseFloat(r.amount) || 0); }, 0);
  }, [userSettings]);

  // Ready to Assign is the money you have in your wallets that hasn't been put into an envelope yet.
  var readyToAssign = useMemo(function() {
    var totalEnvelopeLiabilities = envelopeBalances.reduce(function (sum, env) {
      // Money already assigned that is still available (not ready to re-assign)
      // FIX: Liabilities should be calculated based on (assigned - spent), not (available).
      // If we use (available), then reserved bills correctly reduce available balance,
      // but INCORRECTLY reduce liabilities, which makes RTI increase.
      var netEnveloped = (parseFloat(env.assigned) || 0) - (parseFloat(env.spent) || 0);
      return sum + (netEnveloped > 0 ? netEnveloped : 0);
    }, 0);

    var totalOverspending = envelopeBalances.reduce(function (sum, env) {
      // FIX: Overspending is when spent > assigned.
      var netEnveloped = (parseFloat(env.assigned) || 0) - (parseFloat(env.spent) || 0);
      return sum + (netEnveloped < 0 ? Math.abs(netEnveloped) : 0);
    }, 0);

    return totalAvailableMoney - totalEnvelopeLiabilities - orphanPendingTotal - totalOverspending;
  }, [totalAvailableMoney, envelopeBalances, orphanPendingTotal]);

  var refetchAll = useCallback(function () {
    settingsQuery.refetch();
    recurringQuery.refetch();
    historyQuery.refetch();
  }, [settingsQuery, recurringQuery, historyQuery]);

  return {
    userSettings, incomeSources, envelopes, envelopeBalances,
    totalIncome, totalAssigned, readyToAssign, orphanPendingTotal, totalExpenses, upcomingBills,
    showAddModal, setShowAddModal,
    showOnboarding, setShowOnboarding,
    mutateUpdateSettings, mutateUpdateRecurring, mutateDeleteRecurring, mutateDeleteHistory, refetchAll,
    oneTimeExpenses,
    totalSaved,
    accounts,
    totalAvailableMoney,
    userHistory,
    recurringExpenses
  };
}

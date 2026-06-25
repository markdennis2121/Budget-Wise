import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from 'platform-hooks';
import { getCurrentMonthStr, getMonthStr, isWithin5Days, isOverdue } from '../../utils/helpers';
import { getOrphanPendingBills, sumBillAmounts, isEnvelopeArchived } from '../../utils/envelopeBudget';
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

  // Architect: We sort history by date (newest first) globally here
  // so all screens (History, Dashboard, Analytics) have a consistent view.
  var userHistory = useMemo(function() {
    return allHistory
      .filter(function (h) { return h.user_id === userId; })
      .sort(function(a, b) {
        // Primary sort: Date (newest first)
        if (b.date !== a.date) return b.date > a.date ? 1 : -1;
        // Secondary sort: Insertion order (ID) for items on the same day
        return b.id > a.id ? 1 : -1;
      });
  }, [allHistory, userId]);

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
  var updateHistory = useMutation('expense_history', 'update');
  var mutateUpdateHistory = updateHistory.mutate;

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

  var activeEnvelopes = useMemo(function() {
    return envelopes.filter(function(e) { return !isEnvelopeArchived(e); });
  }, [envelopes]);

  var archivedEnvelopes = useMemo(function() {
    return envelopes.filter(isEnvelopeArchived);
  }, [envelopes]);

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
    return activeEnvelopes.reduce(function (sum, env) { return sum + (parseFloat(env.assigned) || 0); }, 0);
  }, [activeEnvelopes]);

  var envelopeBalances = useMemo(function () {
    return computeEnvelopeBalances(activeEnvelopes, userHistory, recurringExpenses, curMonth);
  }, [activeEnvelopes, recurringExpenses, userHistory, curMonth]);

  var orphanPendingTotal = useMemo(function () {
    return sumBillAmounts(getOrphanPendingBills(recurringExpenses, activeEnvelopes));
  }, [recurringExpenses, activeEnvelopes]);

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
    var totalReduction = envelopeBalances.reduce(function (sum, env) {
        var netEnveloped = (parseFloat(env.assigned) || 0) - (parseFloat(env.spent) || 0);
        var reserved = parseFloat(env.reserved) || 0;

        // 1. Commitment: The higher of what we planned (assigned-spent) or what we must pay (reserved)
        var commitment = Math.max(0, netEnveloped, reserved);

        // 2. Overspending: If we spent more than assigned, that cash is already gone and must be "paid back"
        var overspending = Math.max(0, -netEnveloped);

        return sum + commitment + overspending;
    }, 0);

    return totalAvailableMoney - totalReduction - orphanPendingTotal;
  }, [totalAvailableMoney, envelopeBalances, orphanPendingTotal]);

  var refetchAll = useCallback(function () {
    settingsQuery.refetch();
    recurringQuery.refetch();
    historyQuery.refetch();
  }, [settingsQuery, recurringQuery, historyQuery]);

  /**
   * Senior Developer: Monthly Sweep Logic.
   * Moves all leftover available funds from envelopes back to Ready to Assign.
   */
  var performMonthlySweep = useCallback(function() {
    if (!userSettings || !envelopes.length) return Promise.resolve();

    var curMonth = getCurrentMonthStr();
    var balances = computeEnvelopeBalances(envelopes, userHistory, recurringExpenses, curMonth);

    var updatedEnvelopes = envelopes.map(function(env) {
      var bal = balances.find(function(b) { return b.id === env.id; });
      if (!bal) return env;

      // Reduce the 'assigned' amount by the 'available' amount.
      // This effectively brings the available balance to 0 and returns the money to the RTA pool.
      var leftover = bal.available;
      if (leftover <= 0) return env;

      return {
        ...env,
        assigned: (parseFloat(env.assigned) || 0) - leftover
      };
    });

    return mutateUpdateSettings({
      id: userSettings.id,
      data: {
        envelopes: updatedEnvelopes,
        last_settled_month: curMonth
      }
    }).then(refetchAll);
  }, [userSettings, envelopes, userHistory, recurringExpenses, mutateUpdateSettings, refetchAll]);

  var skipMonthlySweep = useCallback(function() {
    if (!userSettings) return Promise.resolve();
    return mutateUpdateSettings({
      id: userSettings.id,
      data: { last_settled_month: getCurrentMonthStr() }
    }).then(refetchAll);
  }, [userSettings, mutateUpdateSettings, refetchAll]);

  return {
    userSettings, incomeSources, envelopes, activeEnvelopes, archivedEnvelopes, envelopeBalances,
    totalIncome, totalAssigned, readyToAssign, orphanPendingTotal, totalExpenses, upcomingBills,
    showAddModal, setShowAddModal,
    showOnboarding, setShowOnboarding,
    mutateUpdateSettings, mutateUpdateRecurring, mutateDeleteRecurring, mutateDeleteHistory, mutateUpdateHistory, refetchAll,
    performMonthlySweep, skipMonthlySweep,
    oneTimeExpenses,
    totalSaved,
    accounts,
    totalAvailableMoney,
    userHistory,
    recurringExpenses
  };
}

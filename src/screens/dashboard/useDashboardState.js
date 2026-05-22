import { useState, useMemo, useCallback, useEffect } from 'react';
import { useQuery, useMutation } from 'platform-hooks';
import { getCurrentMonthStr, getMonthStr, isWithin5Days, isOverdue } from '../../utils/helpers';
import { getOrphanPendingBills, sumBillAmounts } from '../../utils/envelopeBudget';
import { parseUserEnvelopes } from '../../utils/envelopeGuards';
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
      incomeSources: incomeSources,
      oneTimeExpenses: userOneTimeAll,
      userHistory: userHistory,
      curMonth: curMonth
    });
  }, [userSettings, incomeSources, userOneTimeAll, userHistory, curMonth]);

  var totalAvailableMoney = useMemo(function () {
    return accounts.reduce(function (sum, acc) { return sum + acc.balance; }, 0);
  }, [accounts]);

  var totalIncome = useMemo(function () {
    var sum = 0;
    var hasOlderHistory = false;
    userHistory.forEach(function (h) {
      if (getMonthStr(h.date) < curMonth) hasOlderHistory = true;
      if (h.expense_type === 'Income' && getMonthStr(h.date) === curMonth) {
        sum += (parseFloat(h.amount) || 0);
      }
    });

    if (!hasOlderHistory) {
      var totalSeed = accounts.reduce(function (s, a) {
        return s + (parseFloat(a.starting_balance) || 0);
      }, 0);
      sum += totalSeed;
    }
    return sum;
  }, [userHistory, curMonth, accounts]);

  var totalAssigned = useMemo(function () {
    return envelopes.reduce(function (sum, env) { return sum + (parseFloat(env.assigned) || 0); }, 0);
  }, [envelopes]);

  var envelopeBalances = useMemo(function () {
    var envs = envelopes.map(function (e) {
      return { id: e.id, name: e.name, assigned: parseFloat(e.assigned) || 0, spent: 0, reserved: 0, spentThisMonth: 0 };
    });

    // 1. Calculate LIFETIME spent for each envelope from history source of truth
    userHistory.forEach(function (h) {
      var amt = parseFloat(h.amount) || 0;
      var env = envs.find(function (e) { return e.id === h.category || e.name === h.category; });
      if (!env) return;

      if (h.expense_type === 'One-Time' || h.expense_type === 'Recurring') {
        env.spent += amt;
        if (getMonthStr(h.date) === curMonth) env.spentThisMonth += amt;
      }
    });

    recurringExpenses.forEach(function (r) {
      if (r.status === 'Pending') {
        var amt = parseFloat(r.amount) || 0;
        var env = envs.find(function (e) { return e.id === r.category || e.name === r.category; });
        if (env) env.reserved += amt;
      }
    });

    return envs.map(function (e) {
      var available = e.assigned - e.spent - e.reserved;
      var budgetThisMonth = available + e.spentThisMonth;
      var spentPct = budgetThisMonth > 0 ? Math.min(100, Math.round((e.spentThisMonth / budgetThisMonth) * 100)) : (e.spentThisMonth > 0 ? 100 : 0);
      return { ...e, available, budgetThisMonth, spentPct };
    });
  }, [envelopes, recurringExpenses, oneTimeExpenses, userHistory, curMonth]);

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

  var totalEnvelopeAvailable = envelopeBalances.reduce(function (sum, env) { return sum + (parseFloat(env.available) || 0); }, 0);
  var readyToAssign = totalAvailableMoney - totalEnvelopeAvailable - orphanPendingTotal;

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
    mutateUpdateSettings, mutateUpdateRecurring, mutateDeleteRecurring, refetchAll,
    oneTimeExpenses,
    totalSaved,
    accounts,
    totalAvailableMoney,
    userHistory,
    recurringExpenses
  };
}

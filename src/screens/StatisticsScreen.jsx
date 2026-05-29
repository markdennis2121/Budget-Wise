import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Platform, TouchableOpacity, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'platform-hooks';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { formatCurrency, formatDate, getCurrentMonthStr, getMonthStr } from '../utils/helpers';
import { buildMonthlyInsight, getLast6Months, MONTH_LABELS } from '../utils/monthlyInsights';
import { buildEnvelopeSpendingForMonth } from '../utils/envelopeBudget';
import { buildAccountsWithBalances } from '../utils/accountBalances';
import { parseUserEnvelopes } from '../utils/envelopeGuards';

const TAB_MENU_HEIGHT = Platform.OS === 'web' ? 56 : 49;
const WEB_TAB_MENU_PADDING = 90;

const StatisticsScreen = function() {
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var userCtx = useUser();
  var userId = userCtx.currentUser ? userCtx.currentUser.id : '';
  var insets = useSafeAreaInsets();
  var scrollBottomPadding = Platform.OS === 'web' ? WEB_TAB_MENU_PADDING : (TAB_MENU_HEIGHT + insets.bottom + 16);

  var settingsQuery = useQuery('user_settings');
  var allSettings = settingsQuery.data || [];
  var userSettings = allSettings.find(function(s) { return s.user_id === userId; });

  var recurringQuery = useQuery('recurring_expenses');
  var userRecurring = (recurringQuery.data || []).filter(function(r) { return r.user_id === userId; });

  var historyQuery = useQuery('expense_history');
  var userHistory = useMemo(function() {
    return (historyQuery.data || []).filter(function(h) { return h.user_id === userId; });
  }, [historyQuery.data, userId]);

  var userOneTime = useMemo(function() {
    return userHistory.filter(function(h) { return h.expense_type === 'One-Time'; });
  }, [userHistory]);

  var curMonth = getCurrentMonthStr();

  var envelopes = useMemo(function() {
    return parseUserEnvelopes(userSettings);
  }, [userSettings]);

  var accounts = useMemo(function() {
    return buildAccountsWithBalances({
      userSettings: userSettings,
      userHistory: userHistory
    });
  }, [userSettings, userHistory]);

  var incomeSources = useMemo(function() {
    if (!userSettings) return [];
    if (userSettings.income_sources) {
      var raw = typeof userSettings.income_sources === 'string' ? JSON.parse(userSettings.income_sources) : userSettings.income_sources;
      return Array.isArray(raw) ? raw : [];
    }
    return [{ id: 'main-salary', name: 'Main Salary', amount: parseFloat(userSettings.monthly_salary) || 0 }];
  }, [userSettings]);

  var incomeHistory = useMemo(function() {
    return userHistory.filter(function(h) {
      return (h.expense_type === 'Income' || h.expense_type === 'Adjustment') &&
             getMonthStr(h.date) === curMonth;
    });
  }, [userHistory, curMonth]);

  var incomeReceivedBySource = useMemo(function() {
    var received = {};
    incomeHistory.forEach(function(h) {
      var key = h.category || 'unlinked';
      received[key] = (received[key] || 0) + (parseFloat(h.amount) || 0);
    });

    return Object.keys(received).map(function(key) {
      var src = incomeSources.find(function(s) { return s.id === key; });
      var name = 'Extra Income';
      if (src) name = src.name;
      else if (key === 'Income') name = 'Manual Deposit';

      return {
        id: key,
        name: name,
        amount: received[key],
        percent: 0
      };
    }).sort(function(a, b) { return b.amount - a.amount; });
  }, [incomeHistory, incomeSources]);

  var incomeReceivedByAccount = useMemo(function() {
    var received = {};
    incomeHistory.forEach(function(h) {
      var accountId = h.account_id || 'unlinked';
      received[accountId] = (received[accountId] || 0) + (parseFloat(h.amount) || 0);
    });
    return Object.keys(received).map(function(accountId) {
      var acc = accounts.find(function(a) { return a.id === accountId; });
      return {
        id: accountId,
        name: acc ? acc.name : (accountId === 'unlinked' ? 'Unlinked Cash' : 'Unknown Account'),
        amount: received[accountId]
      };
    }).sort(function(a, b) { return b.amount - a.amount; });
  }, [accounts, incomeHistory]);

  var totalMonthlyIncome = useMemo(function() {
    return incomeHistory.reduce(function(s, h) {
      var amt = parseFloat(h.amount) || 0;
      if (h.expense_type === 'Adjustment' && h.category === 'Adjustment') {
        return s - amt;
      }
      return s + amt;
    }, 0);
  }, [incomeHistory]);

  var totalIncomeThisMonth = totalMonthlyIncome;

  var recentIncomeActivity = useMemo(function() {
    return incomeHistory.slice().sort(function(a, b) {
      return new Date(b.date) - new Date(a.date);
    }).slice(0, 6);
  }, [incomeHistory]);

  var recurringByName = useMemo(function () {
    var lookup = {};
    userRecurring.forEach(function (r) {
      if (r && r.name) lookup[r.name] = r;
    });
    return lookup;
  }, [userRecurring]);

  var envelopeSpending = useMemo(function () {
    return buildEnvelopeSpendingForMonth({
      envelopes: envelopes,
      curMonth: curMonth,
      oneTimeExpenses: userOneTime,
      historyEntries: userHistory,
      recurringByName: recurringByName
    });
  }, [userHistory, userOneTime, envelopes, curMonth, recurringByName]);

  var totalMonthSpent = useMemo(function() {
    return envelopeSpending.reduce(function(s, e) { return s + e.spent; }, 0);
  }, [envelopeSpending]);

  var maxEnvSpent = envelopeSpending.length > 0 ? envelopeSpending[0].spent : 1;
  var savings = totalMonthlyIncome - totalMonthSpent;

  var dailyAvg = useMemo(function() {
    var day = new Date().getDate();
    return totalMonthSpent / (day || 1);
  }, [totalMonthSpent]);

  // Privacy State: Persist visibility
  var [balancesVisible] = useState(function() {
    try {
      var saved = localStorage.getItem('penny_balances_visible');
      return saved !== null ? JSON.parse(saved) : true;
    } catch (e) { return true; }
  });
  var maskAmount = function(amt) {
    return balancesVisible ? formatCurrency(amt) : '••••••';
  };

  var [selectedEnvIndex, setSelectedEnvIndex] = useState(null);
  var [infoModalConfig, setInfoModalConfig] = useState({ visible: false, title: '', content: null });

  var handleIncomeInfo = function() {
    var templateIncome = 0;
    var manualIncome = 0;
    incomeHistory.forEach(function(h) {
      var isTemplate = incomeSources.some(function(src) { return src.id === h.category; });
      var amt = parseFloat(h.amount) || 0;
      if (isTemplate) {
        templateIncome += amt;
      } else {
        manualIncome += amt;
      }
    });

    setInfoModalConfig({
      visible: true,
      title: 'Total Monthly Income',
      content: (
        <View>
          <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginBottom: 16, lineHeight: 20 }}>
            This is the total income earned or logged this month. All money comes strictly from actual logged transactions.
          </Text>
          <View style={{ backgroundColor: theme.colors.background, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontSize: 14, color: theme.colors.textPrimary, fontWeight: '600' }}>Template-Logged Income</Text>
              <Text style={{ fontSize: 14, color: theme.colors.textPrimary, fontWeight: 'bold' }}>{formatCurrency(templateIncome)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, color: theme.colors.textPrimary, fontWeight: '600' }}>Manual & Extra Income</Text>
              <Text style={{ fontSize: 14, color: theme.colors.textPrimary, fontWeight: 'bold' }}>{formatCurrency(manualIncome)}</Text>
            </View>
            <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: 14 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, color: theme.colors.primary, fontWeight: 'bold' }}>Total Income</Text>
              <Text style={{ fontSize: 16, color: theme.colors.primary, fontWeight: 'bold' }}>{maskAmount(totalMonthlyIncome)}</Text>
            </View>
          </View>
        </View>
      )
    });
  };

  var handleSpentInfo = function() {
    setInfoModalConfig({
      visible: true,
      title: 'Total Spent',
      content: (
        <View>
          <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginBottom: 16, lineHeight: 20 }}>
            This is the sum of all your one-time expenses and paid recurring bills for the current month.
          </Text>
          <View style={{ backgroundColor: 'rgba(220, 38, 38, 0.1)', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center' }}>
            <MaterialIcons name="shopping-cart" size={20} color="#DC2626" style={{ marginRight: 10 }} />
            <Text style={{ fontSize: 13, color: '#B91C1C', fontWeight: 'bold', flex: 1 }}>
              Tip: Check the 'Spending by Envelope' chart below for a detailed breakdown.
            </Text>
          </View>
        </View>
      )
    });
  };

  var handleSavedInfo = function() {
    setInfoModalConfig({
      visible: true,
      title: savings >= 0 ? 'Total Saved' : 'Over Budget',
      content: (
        <View>
          <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginBottom: 16, lineHeight: 20 }}>
            This is simply your Total Income minus your Total Spent for this month.
          </Text>
          <View style={{ backgroundColor: savings >= 0 ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center' }}>
            <MaterialIcons name={savings >= 0 ? 'savings' : 'warning'} size={20} color={savings >= 0 ? '#16A34A' : '#DC2626'} style={{ marginRight: 10 }} />
            <Text style={{ fontSize: 13, color: savings >= 0 ? '#15803D' : '#B91C1C', fontWeight: 'bold', flex: 1 }}>
              {savings >= 0 ? "Great job keeping your expenses below your income!" : "You have spent more than your total monthly income."}
            </Text>
          </View>
        </View>
      )
    });
  };

  const SEGMENT_COLORS = [
    '#FF6B6B', '#4D96FF', '#6BCB77', '#FFD93D', '#9B5DE5', '#F15BB5', '#00F5D4', '#FF9F1C',
  ];

  var coloredSpending = useMemo(function() {
    return envelopeSpending.map(function(env, idx) {
      return {
        ...env,
        color: env.isOrphan ? '#9CA3AF' : SEGMENT_COLORS[idx % SEGMENT_COLORS.length]
      };
    });
  }, [envelopeSpending]);

  var svgSegments = useMemo(function() {
    var radius = 35;
    var strokeWidth = 10;
    var circ = 2 * Math.PI * radius;
    var accumulatedPercent = 0;

    return coloredSpending.map(function(env, idx) {
      var pct = totalMonthSpent > 0 ? (env.spent / totalMonthSpent) : 0;
      var strokeDashoffset = circ - (pct * circ);
      var strokeDasharray = circ;
      var angle = accumulatedPercent * 360 - 90;
      accumulatedPercent += pct;

      var isSelected = selectedEnvIndex === idx;

      return React.createElement('circle', {
        key: idx,
        cx: 50,
        cy: 50,
        r: radius,
        fill: 'transparent',
        stroke: env.color,
        strokeWidth: isSelected ? strokeWidth + 2 : strokeWidth,
        strokeDasharray: strokeDasharray,
        strokeDashoffset: strokeDashoffset,
        transform: 'rotate(' + angle + ' 50 50)',
        strokeLinecap: 'round',
        style: {
          cursor: 'pointer',
          transition: 'all 0.3s ease',
          opacity: selectedEnvIndex === null || isSelected ? 1 : 0.4
        },
        onClick: function() {
          setSelectedEnvIndex(selectedEnvIndex === idx ? null : idx);
        }
      });
    });
  }, [coloredSpending, selectedEnvIndex, totalMonthSpent]);

  var centerLabel = selectedEnvIndex !== null ? coloredSpending[selectedEnvIndex].name : 'Total Spent';
  var centerValue = selectedEnvIndex !== null ? maskAmount(coloredSpending[selectedEnvIndex].spent) : maskAmount(totalMonthSpent);

  // 6-month trend
  var last6Months = getLast6Months();
  var monthlyTotals = useMemo(function() {
    return last6Months.map(function(m) {
      var spent = 0;
      var income = 0;

      userHistory.forEach(function(h) {
        if (getMonthStr(h.date) === m.key) {
          var amt = parseFloat(h.amount) || 0;
          if (h.expense_type === 'Recurring' || h.expense_type === 'One-Time') {
            spent += amt;
          } else if (h.expense_type === 'Income') {
            income += amt;
          } else if (h.expense_type === 'Adjustment') {
            if (h.category === 'Income') income += amt;
            if (h.category === 'Adjustment') income -= amt;
          }
        }
      });

      return { label: m.label, spent: spent, income: income, key: m.key };
    });
  }, [userHistory]);

  var maxTrendValue = Math.max.apply(null, monthlyTotals.map(function(m) { return Math.max(m.spent, m.income); }).concat([1]));

  var monthlyInsight = useMemo(function() {
    return buildMonthlyInsight({
      monthlyTotals: monthlyTotals,
      curMonthKey: curMonth,
      envelopeSpending: envelopeSpending
    });
  }, [monthlyTotals, curMonth, envelopeSpending]);

  var incomeBySourceWithPercent = useMemo(function() {
    return incomeReceivedBySource.map(function(src) {
      return {
        id: src.id,
        name: src.name,
        amount: src.amount,
        percent: totalIncomeThisMonth > 0 ? Math.round((src.amount / totalIncomeThisMonth) * 100) : 0
      };
    });
  }, [incomeReceivedBySource, totalIncomeThisMonth]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: theme.colors.primary, paddingTop: insets.top + 16, paddingBottom: 28, paddingHorizontal: 20 }}>
        <Text style={{ ...theme.typography.h2, color: '#FFFFFF' }}>Statistics</Text>
        <Text style={{ ...theme.typography.bodySmall, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
          Insights for {MONTH_LABELS[new Date().getMonth()] || ''} {new Date().getFullYear()}
        </Text>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 20, paddingHorizontal: 16, paddingBottom: scrollBottomPadding }}>

        {/* Insight Card */}
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: monthlyInsight.color + '33', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 }}>
          <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
            <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: monthlyInsight.color + '18', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <MaterialIcons name={monthlyInsight.icon} size={22} color={monthlyInsight.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 15, fontWeight: 'bold', color: theme.colors.textPrimary, marginBottom: 6 }}>{monthlyInsight.title}</Text>
              <Text style={{ fontSize: 13, color: theme.colors.textSecondary, lineHeight: 20 }}>{monthlyInsight.text}</Text>
            </View>
          </View>
        </View>

        {/* ── Professional Summary Grid ── */}
        <View style={{ flexDirection: 'row', marginBottom: 20, gap: 10 }}>
          <TouchableOpacity activeOpacity={0.8} onPress={handleIncomeInfo} style={{ flex: 1, backgroundColor: theme.isDark ? 'rgba(16, 185, 129, 0.05)' : '#F0FDF4', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: theme.isDark ? 'rgba(16, 185, 129, 0.2)' : '#DCFCE7', justifyContent: 'space-between', minHeight: 100 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 10, color: '#16A34A', fontWeight: '800', letterSpacing: 0.5 }}>INCOME</Text>
              <MaterialIcons name="trending-up" size={14} color="#16A34A" />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary }}>{maskAmount(totalMonthlyIncome)}</Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.8} onPress={handleSpentInfo} style={{ flex: 1, backgroundColor: theme.isDark ? 'rgba(239, 68, 68, 0.05)' : '#FEF2F2', borderRadius: 20, padding: 14, borderWidth: 1, borderColor: theme.isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2', justifyContent: 'space-between', minHeight: 100 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 10, color: '#DC2626', fontWeight: '800', letterSpacing: 0.5 }}>SPENT</Text>
              <MaterialIcons name="shopping-cart" size={14} color="#DC2626" />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary }}>{maskAmount(totalMonthSpent)}</Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.8} onPress={handleSavedInfo} style={{ flex: 1, backgroundColor: theme.isDark ? (savings >= 0 ? 'rgba(59, 130, 246, 0.05)' : 'rgba(239, 68, 68, 0.05)') : (savings >= 0 ? '#EFF6FF' : '#FEF2F2'), borderRadius: 20, padding: 14, borderWidth: 1, borderColor: theme.isDark ? (savings >= 0 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)') : (savings >= 0 ? '#DBEAFE' : '#FEE2E2'), justifyContent: 'space-between', minHeight: 100 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 10, color: savings >= 0 ? '#2563EB' : '#DC2626', fontWeight: '800', letterSpacing: 0.5 }}>{savings >= 0 ? 'SAVED' : 'DEFICIT'}</Text>
              <MaterialIcons name={savings >= 0 ? "savings" : "warning"} size={14} color={savings >= 0 ? "#2563EB" : "#DC2626"} />
            </View>
            <Text style={{ fontSize: 18, fontWeight: '800', color: theme.colors.textPrimary }}>{maskAmount(Math.abs(savings))}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Income by Source ── */}
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: theme.colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: theme.colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <MaterialIcons name='category' size={18} color={theme.colors.primary} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.textPrimary }}>Income by Source</Text>
          </View>

          {incomeBySourceWithPercent.length === 0
            ? <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>No income transactions recorded this month.</Text>
            : incomeBySourceWithPercent.map(function(src) {
                return (
                  <View key={src.id} style={{ marginBottom: 20 }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary }}>{src.name}</Text>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#16A34A' }}>{maskAmount(src.amount)}</Text>
                    </View>
                    <View style={{ height: 8, backgroundColor: theme.colors.border, borderRadius: 4, overflow: 'hidden' }}>
                      <View style={{ width: src.percent + '%', height: '100%', backgroundColor: theme.colors.primary }} />
                    </View>
                    <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 6, fontWeight: '600' }}>{src.percent}% of total monthly income</Text>
                  </View>
                );
              })
          }
        </View>

        {/* ── Wallets & Accounts Summary ── */}
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: theme.colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <MaterialIcons name='account-balance-wallet' size={18} color={theme.colors.primary} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.textPrimary }}>Wallets & Accounts</Text>
          </View>

          {accounts.length === 0
            ? <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>No accounts found.</Text>
            : accounts.map(function(acc, idx) {
                return (
                  <View key={acc.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: idx < accounts.length - 1 ? 1 : 0, borderBottomColor: theme.colors.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: acc.color || theme.colors.primary, marginRight: 10 }} />
                      <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary }}>{acc.name}</Text>
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary }}>{maskAmount(acc.balance)}</Text>
                  </View>
                );
              })
          }
        </View>

        {/* ── Deposits by Account ── */}
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: theme.colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <MaterialIcons name='input' size={18} color='#16A34A' />
            </View>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.textPrimary }}>Deposits by Account</Text>
          </View>

          {incomeReceivedByAccount.length === 0
            ? <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>No account deposits recorded this month.</Text>
            : incomeReceivedByAccount.map(function(acc, idx) {
                return (
                  <View key={acc.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 14, borderBottomWidth: idx < incomeReceivedByAccount.length - 1 ? 1 : 0, borderBottomColor: theme.colors.border }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary }}>{acc.name}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#16A34A' }}>{maskAmount(acc.amount)}</Text>
                  </View>
                );
              })
          }
        </View>

        {/* ── Recent Income Activity ── */}
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: theme.colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <MaterialIcons name='history' size={18} color='#7C3AED' />
            </View>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.textPrimary }}>Recent Income Activity</Text>
          </View>

          {recentIncomeActivity.length === 0
            ? <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>No income transactions yet.</Text>
            : recentIncomeActivity.map(function(item, idx) {
                var source = incomeSources.find(function(src) { return src.id === item.category; });
                var account = accounts.find(function(acc) { return acc.id === item.account_id; });
                return (
                  <View key={item.id} style={{ paddingVertical: 14, borderBottomWidth: idx < recentIncomeActivity.length - 1 ? 1 : 0, borderBottomColor: theme.colors.border }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ fontSize: 14, fontWeight: '800', color: '#16A34A' }}>{maskAmount(item.amount)}</Text>
                      <Text style={{ fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600' }}>{formatDate(item.date)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>Source: <Text style={{ fontWeight: '700' }}>{source ? source.name : (item.category || 'Unknown')}</Text></Text>
                      <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>Wallet: <Text style={{ fontWeight: '700' }}>{account ? account.name : (item.account_id === 'unlinked' ? 'Unlinked Cash' : 'Unknown Account')}</Text></Text>
                    </View>
                  </View>
                );
              })
          }
        </View>

        {/* ── Daily Average Card ── */}
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: theme.colors.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <TouchableOpacity onPress={() => setInfoModalConfig({
                visible: true,
                title: 'Daily Spending Average',
                content: (
                  <View>
                    <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginBottom: 12, lineHeight: 22 }}>
                      This is your total spending this month divided by the number of days passed so far.
                    </Text>
                    <View style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center' }}>
                      <MaterialIcons name="speed" size={20} color="#3B82F6" style={{ marginRight: 10 }} />
                      <Text style={{ fontSize: 13, color: '#1D4ED8', fontWeight: 'bold', flex: 1 }}>
                        Knowing your daily pace helps you decide if you can afford that extra treat today!
                      </Text>
                    </View>
                  </View>
                )
              })} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.textPrimary, marginRight: 6 }}>Daily Average</Text>
              <MaterialIcons name="info-outline" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '800', color: theme.colors.primary }}>{maskAmount(dailyAvg)}</Text>
          </View>
          <Text style={{ fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600' }}>
            On average, you spend {maskAmount(dailyAvg)} every day this month.
          </Text>
        </View>

        {/* ── Spending by Envelope ── */}
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: theme.colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <MaterialIcons name='pie-chart' size={20} color={theme.colors.primary} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.textPrimary }}>Spending by Envelope</Text>
          </View>

          {envelopeSpending.length === 0
            ? <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <MaterialIcons name="inbox" size={48} color={theme.colors.border} />
                <Text style={{ color: theme.colors.textSecondary, marginTop: 12, fontSize: 14 }}>No spending recorded yet</Text>
              </View>
            : <View>
                <View style={{ alignItems: 'center', justifyContent: 'center', marginVertical: 10 }}>
                  <View style={{ alignItems: 'center', justifyContent: 'center', width: 200, height: 200 }}>
                    <View style={{ position: 'absolute', width: 200, height: 200 }}>
                      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>{svgSegments}</svg>
                    </View>
                    <TouchableOpacity
                      onPress={function() { setSelectedEnvIndex(null); }}
                      style={{
                        width: 120,
                        height: 120,
                        borderRadius: 60,
                        backgroundColor: theme.colors.card,
                        alignItems: 'center',
                        justifyContent: 'center',
                        elevation: 6,
                        shadowColor: '#000',
                        shadowOffset: { width: 0, height: 3 },
                        shadowOpacity: 0.12,
                        shadowRadius: 5,
                        borderWidth: 1,
                        borderColor: theme.colors.border
                      }}
                    >
                      <Text numberOfLines={1} style={{ fontSize: 9, color: theme.colors.textSecondary, textTransform: 'uppercase', fontWeight: 'bold', textAlign: 'center', width: 90, letterSpacing: 0.5 }}>{centerLabel}</Text>
                      <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary, marginTop: 4, textAlign: 'center', width: 100 }}>{centerValue}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ marginTop: 20 }}>
                  {coloredSpending.map(function(env, i) {
                    var isSelected = selectedEnvIndex === i;
                    var isAnySelected = selectedEnvIndex !== null;
                    var pct = maxEnvSpent > 0 ? Math.round((env.spent / maxEnvSpent) * 100) : 0;
                    var sharePct = totalMonthSpent > 0 ? Math.round((env.spent / totalMonthSpent) * 100) : 0;

                    return (
                      <TouchableOpacity
                        key={i}
                        onPress={function() { setSelectedEnvIndex(isSelected ? null : i); }}
                        style={{
                          padding: 12,
                          borderRadius: 14,
                          backgroundColor: isSelected ? (theme.isDark ? 'rgba(255,237,213,0.08)' : 'rgba(255,237,213,0.4)') : 'transparent',
                          borderWidth: 1,
                          borderColor: isSelected ? theme.colors.primary : 'transparent',
                          marginBottom: 8,
                          opacity: !isAnySelected || isSelected ? 1 : 0.6
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: env.color, marginRight: 10 }} />
                            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary }}>{env.name}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary }}>{maskAmount(env.spent)}</Text>
                            <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginLeft: 8 }}>({sharePct}%)</Text>
                          </View>
                        </View>
                        <View style={{ height: 6, backgroundColor: theme.colors.border, borderRadius: 3, overflow: 'hidden' }}>
                          <View style={{ width: pct + '%', height: '100%', backgroundColor: env.color, borderRadius: 3 }} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
          }
        </View>

        {/* ── 6-Month Trend ── */}
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: theme.colors.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <MaterialIcons name='bar-chart' size={20} color='#2563EB' />
              </View>
              <TouchableOpacity
                onPress={() => setInfoModalConfig({
                  visible: true,
                  title: '6-Month Trend',
                  content: (
                    <View>
                      <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginBottom: 12, lineHeight: 22 }}>
                        This chart compares your total income (green) versus your total expenses (red) over the last half-year.
                      </Text>
                      <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialIcons name="trending-up" size={20} color="#10B981" style={{ marginRight: 10 }} />
                        <Text style={{ fontSize: 13, color: '#047857', fontWeight: 'bold', flex: 1 }}>
                          A healthy trend shows your green bars consistently taller than your red bars!
                        </Text>
                      </View>
                    </View>
                  )
                })}
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.textPrimary, marginRight: 6 }}>6-Month Trend</Text>
                <MaterialIcons name="info-outline" size={16} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginRight: 4 }} />
                <Text style={{ fontSize: 10, color: theme.colors.textSecondary, fontWeight: '700' }}>IN</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', marginRight: 4 }} />
                <Text style={{ fontSize: 10, color: theme.colors.textSecondary, fontWeight: '700' }}>OUT</Text>
              </View>
            </View>
          </View>

          <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 160, paddingBottom: 10 }}>
            {monthlyTotals.map(function(m, i) {
              var spentPct = maxTrendValue > 0 ? (m.spent / maxTrendValue) : 0;
              var incomePct = maxTrendValue > 0 ? (m.income / maxTrendValue) : 0;
              var spentHeight = Math.max(6, Math.round(spentPct * 120));
              var incomeHeight = Math.max(6, Math.round(incomePct * 120));
              var isCurrent = m.key === curMonth;
              return (
                <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', width: '100%', marginBottom: 10 }}>
                    <View style={{ width: '25%', height: incomeHeight, backgroundColor: '#10B981', borderTopLeftRadius: 4, borderTopRightRadius: 4, marginRight: 2, shadowColor: '#10B981', shadowOpacity: 0.3, shadowRadius: 3, elevation: 2 }} />
                    <View style={{ width: '25%', height: spentHeight, backgroundColor: '#EF4444', borderTopLeftRadius: 4, borderTopRightRadius: 4, shadowColor: '#EF4444', shadowOpacity: 0.3, shadowRadius: 3, elevation: 2 }} />
                  </View>
                  <Text style={{ fontSize: 10, fontWeight: isCurrent ? 'bold' : '600', color: isCurrent ? theme.colors.primary : theme.colors.textSecondary }}>{m.label}</Text>
                </View>
              );
            })}
          </View>
        </View>

        {/* ── Monthly Financial Audit ── */}
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: theme.colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <MaterialIcons name='analytics' size={20} color='#10B981' />
            </View>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.textPrimary }}>Monthly Financial Audit</Text>
          </View>

          <View>
            {monthlyTotals.slice().reverse().map(function(m, i) {
              var isCurrent = m.key === curMonth;
              var savings = m.income - m.spent;
              return (
                <View key={i} style={{
                  padding: 16,
                  borderRadius: 18,
                  backgroundColor: isCurrent ? (theme.isDark ? 'rgba(16, 185, 129, 0.04)' : '#F0FDF4') : theme.colors.background,
                  borderWidth: 1,
                  borderColor: isCurrent ? theme.colors.primary + '33' : theme.colors.border,
                  marginBottom: 12
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                    <Text style={{ fontSize: 15, fontWeight: 'bold', color: isCurrent ? theme.colors.primary : theme.colors.textPrimary }}>{m.label + (isCurrent ? ' (Current)' : '')}</Text>
                    <View style={{ backgroundColor: savings >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: savings >= 0 ? '#10B981' : theme.colors.error }}>{(savings >= 0 ? '+' : '') + maskAmount(savings)}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: 12 }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, color: theme.colors.textSecondary, marginBottom: 4, fontWeight: '800', letterSpacing: 0.5 }}>INCOME</Text>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#16A34A' }}>{maskAmount(m.income)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 10, color: theme.colors.textSecondary, marginBottom: 4, fontWeight: '800', letterSpacing: 0.5 }}>SPENT</Text>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#DC2626' }}>-{maskAmount(m.spent)}</Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 10, color: theme.colors.textSecondary, marginBottom: 4, fontWeight: '800', letterSpacing: 0.5 }}>SAVED</Text>
                      <Text style={{ fontSize: 14, fontWeight: '700', color: '#2563EB' }}>{maskAmount(Math.max(0, savings))}</Text>
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        </View>
      </ScrollView>

      <Modal key="stats-info-modal" visible={infoModalConfig.visible} animationType="fade" transparent={true} onRequestClose={() => setInfoModalConfig({ ...infoModalConfig, visible: false })}>
        <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 20 }}>
          <View style={{ backgroundColor: theme.colors.card, borderRadius: 24, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.textPrimary }}>{infoModalConfig.title}</Text>
              <TouchableOpacity onPress={() => setInfoModalConfig({ ...infoModalConfig, visible: false })} style={{ padding: 4, backgroundColor: theme.colors.background, borderRadius: 12 }}>
                <MaterialIcons name="close" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {infoModalConfig.content}
            <TouchableOpacity onPress={() => setInfoModalConfig({ ...infoModalConfig, visible: false })} style={{ marginTop: 24, backgroundColor: theme.colors.primary, borderRadius: 12, padding: 16, alignItems: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 }}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default StatisticsScreen;

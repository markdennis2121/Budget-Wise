import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Platform, TouchableOpacity, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'platform-hooks';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { formatCurrency, getCurrentMonthStr, getMonthStr } from '../utils/helpers';
import { buildMonthlyInsight, getLast6Months, MONTH_LABELS } from '../utils/monthlyInsights';
import { buildEnvelopeSpendingForMonth } from '../utils/envelopeBudget';
import { getStoredAccountsList, buildAccountsWithBalances } from '../utils/accountBalances';
import { parseUserEnvelopes } from '../utils/envelopeGuards';
import TrialCountdownBanner from '../components/TrialCountdownBanner';

const TAB_MENU_HEIGHT = Platform.OS === 'web' ? 56 : 49;
const WEB_TAB_MENU_PADDING = 90;
function fmt(amount) {
  var num = Math.max(0, parseFloat(amount) || 0);
  if (num >= 1000) return '₱' + (num / 1000).toFixed(1) + 'k';
  return '₱' + num.toFixed(0);
}

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

  var totalStartingBalances = useMemo(function() {
    return accounts.reduce(function(sum, acc) { return sum + (parseFloat(acc.starting_balance) || 0); }, 0);
  }, [accounts]);

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
      // If it's a "Reduce Funds" adjustment, subtract it from total income
      if (h.expense_type === 'Adjustment' && h.category === 'Adjustment') {
        return s - amt;
      }
      return s + amt;
    }, 0);
  }, [incomeHistory]);

  var totalIncomeThisMonth = totalMonthlyIncome;
  var incomeSourceTotal = useMemo(function() {
    return incomeReceivedBySource.reduce(function(sum, src) { return sum + src.amount; }, 0);
  }, [incomeReceivedBySource]);

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
  var savingsRate = totalMonthlyIncome > 0 ? Math.round((savings / totalMonthlyIncome) * 100) : 0;

  var dailyAvg = useMemo(function() {
    var day = new Date().getDate();
    return totalMonthSpent / day;
  }, [totalMonthSpent]);

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
              <Text style={{ fontSize: 16, color: theme.colors.primary, fontWeight: 'bold' }}>{formatCurrency(totalMonthlyIncome)}</Text>
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
    '#FF6B6B', // Vibrant Coral Red
    '#4D96FF', // Sky Blue
    '#6BCB77', // Emerald Green
    '#FFD93D', // Golden Yellow
    '#9B5DE5', // Amethyst Purple
    '#F15BB5', // Hot Pink
    '#00F5D4', // Turquoise
    '#FF9F1C', // Deep Amber
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
      var pct = env.spent / totalMonthSpent;
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
  var centerValue = selectedEnvIndex !== null ? formatCurrency(coloredSpending[selectedEnvIndex].spent) : formatCurrency(totalMonthSpent);

  // 6-month trend
  var last6Months = getLast6Months();
  var monthlyTotals = useMemo(function() {
    return last6Months.map(function(m) {
      var spent = 0;
      var income = 0;

      // 1. Sum one-time expenses from userOneTime
      userOneTime.forEach(function(o) {
        if (getMonthStr(o.date) === m.key) {
          spent += parseFloat(o.amount) || 0;
        }
      });

      // 2. Sum paid recurring bills and extra incomes from history
      userHistory.forEach(function(h) {
        if (getMonthStr(h.date) === m.key) {
          var amt = parseFloat(h.amount) || 0;
          if (h.expense_type === 'Recurring' || h.expense_type === 'One-Time') {
            spent += amt;
          } else if (h.expense_type === 'Income') {
            income += amt;
          } else if (h.expense_type === 'Adjustment') {
            if (h.category === 'Income') income += amt;
            if (h.category === 'Adjustment') income -= amt; // Subtract from income trend
          }
        }
      });

      return { label: m.label, spent: spent, income: income, key: m.key };
    });
  }, [userOneTime, userHistory]);

  var maxTrendValue = Math.max.apply(null, monthlyTotals.map(function(m) { return Math.max(m.spent, m.income); }).concat([1]));

  var monthlyInsight = useMemo(function() {
    return buildMonthlyInsight({
      monthlyTotals: monthlyTotals,
      curMonthKey: curMonth,
      envelopeSpending: envelopeSpending
    });
  }, [monthlyTotals, curMonth, envelopeSpending]);

  return React.createElement(View, { style: { flex: 1, backgroundColor: theme.colors.background } },

    // Header
    React.createElement(View, { style: { backgroundColor: theme.colors.primary, paddingTop: insets.top + 16, paddingBottom: 28, paddingHorizontal: 20 } },
      React.createElement(Text, { style: { ...theme.typography.h2, color: '#FFFFFF' } }, 'Statistics'),
      React.createElement(Text, { style: { ...theme.typography.bodySmall, color: 'rgba(255,255,255,0.75)', marginTop: 2 } }, 'Insights for ' + (MONTH_LABELS[new Date().getMonth()] || '') + ' ' + new Date().getFullYear())
    ),

    React.createElement(ScrollView, { style: { flex: 1 }, contentContainerStyle: { paddingTop: 20, paddingHorizontal: 16, paddingBottom: scrollBottomPadding } },

      React.createElement(TrialCountdownBanner, { theme: theme, compact: true }),

      React.createElement(View, { style: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 18, marginBottom: 16, borderWidth: 1, borderColor: monthlyInsight.color + '33', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 } },
        React.createElement(View, { style: { flexDirection: 'row', alignItems: 'flex-start' } },
          React.createElement(View, { style: { width: 40, height: 40, borderRadius: 20, backgroundColor: monthlyInsight.color + '18', alignItems: 'center', justifyContent: 'center', marginRight: 12 } },
            React.createElement(MaterialIcons, { name: monthlyInsight.icon, size: 22, color: monthlyInsight.color })
          ),
          React.createElement(View, { style: { flex: 1 } },
            React.createElement(Text, { style: { fontSize: 15, fontWeight: 'bold', color: theme.colors.textPrimary, marginBottom: 6 } }, monthlyInsight.title),
            React.createElement(Text, { style: { fontSize: 13, color: theme.colors.textSecondary, lineHeight: 20 } }, monthlyInsight.text)
          )
        )
      ),

      // ── Summary row ──────────────────────────────────────────────────────
      <View style={{ flexDirection: 'row', marginBottom: 16, gap: 8 }}>
        <TouchableOpacity activeOpacity={0.8} onPress={handleIncomeInfo} style={{ flex: 1, backgroundColor: '#FFEDD5', borderRadius: 14, padding: 14, position: 'relative' }}>
          <View style={{ position: 'absolute', top: 8, right: 8 }}>
            <MaterialIcons name="info-outline" size={14} color="rgba(146, 64, 14, 0.5)" />
          </View>
          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <MaterialIcons name="account-balance-wallet" size={18} color={theme.colors.primary} />
          </View>
          <Text style={{ ...theme.typography.subtitle, color: theme.colors.textPrimary }}>{formatCurrency(totalMonthlyIncome)}</Text>
          <Text style={{ ...theme.typography.caption, color: '#92400E', marginTop: 2 }}>Income</Text>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.8} onPress={handleSpentInfo} style={{ flex: 1, backgroundColor: '#FEE2E2', borderRadius: 14, padding: 14, position: 'relative' }}>
          <View style={{ position: 'absolute', top: 8, right: 8 }}>
            <MaterialIcons name="info-outline" size={14} color="rgba(153, 27, 27, 0.5)" />
          </View>
          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <MaterialIcons name="shopping-cart" size={18} color="#DC2626" />
          </View>
          <Text style={{ ...theme.typography.subtitle, color: '#DC2626' }}>{formatCurrency(totalMonthSpent)}</Text>
          <Text style={{ ...theme.typography.caption, color: '#991B1B', marginTop: 2 }}>Spent</Text>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.8} onPress={handleSavedInfo} style={{ flex: 1, backgroundColor: savings >= 0 ? '#DCFCE7' : '#FEE2E2', borderRadius: 14, padding: 14, position: 'relative' }}>
          <View style={{ position: 'absolute', top: 8, right: 8 }}>
            <MaterialIcons name="info-outline" size={14} color={savings >= 0 ? "rgba(20, 83, 45, 0.5)" : "rgba(153, 27, 27, 0.5)"} />
          </View>
          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <MaterialIcons name="savings" size={18} color={savings >= 0 ? '#16A34A' : '#DC2626'} />
          </View>
          <Text style={{ ...theme.typography.subtitle, color: savings >= 0 ? '#16A34A' : '#DC2626' }}>{formatCurrency(Math.abs(savings))}</Text>
          <Text style={{ ...theme.typography.caption, color: savings >= 0 ? '#14532D' : '#991B1B', marginTop: 2 }}>{savings >= 0 ? 'Saved' : 'Over budget'}</Text>
        </TouchableOpacity>
      </View>,

      // ── Income This Month summary ───────────────────────────────────────
      React.createElement(View, { style: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 18, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 } },
        React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 } },
          React.createElement(View, { style: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginRight: 12 } },
            React.createElement(MaterialIcons, { name: 'trending-up', size: 22, color: '#2563EB' })
          ),
          React.createElement(View, null,
            React.createElement(Text, { style: { ...theme.typography.subtitle, color: theme.colors.textPrimary } }, 'Income This Month'),
            React.createElement(Text, { style: { ...theme.typography.bodySmall, color: theme.colors.textSecondary, marginTop: 2 } }, 'Actual income recorded in the current month.')
          )
        ),
        React.createElement(Text, { style: { ...theme.typography.h2, color: theme.colors.primary, marginTop: 4 } }, formatCurrency(totalMonthlyIncome))
      ),

      // ── Income by Source ─────────────────────────────────────────────────
      React.createElement(View, { style: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 18, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 } },
        React.createElement(Text, { style: { ...theme.typography.subtitle, color: theme.colors.textPrimary, marginBottom: 14 } }, 'Income by Source'),
        incomeBySourceWithPercent.length === 0
          ? React.createElement(Text, { style: { color: theme.colors.textSecondary, fontSize: 13 } }, 'No income transactions recorded this month.')
          : incomeBySourceWithPercent.map(function(src) {
              return React.createElement(View, { key: src.id, style: { marginBottom: 16 } },
                React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 } },
                  React.createElement(Text, { style: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary } }, src.name),
                  React.createElement(Text, { style: { fontSize: 14, fontWeight: '700', color: theme.colors.primary } }, formatCurrency(src.amount))
                ),
                React.createElement(View, { style: { height: 8, backgroundColor: theme.colors.border, borderRadius: 999, overflow: 'hidden' } },
                  React.createElement(View, { style: { width: src.percent + '%', height: '100%', backgroundColor: '#2563EB' } })
                ),
                React.createElement(Text, { style: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 6 } }, src.percent + '% of income')
              );
            })
      ),

      // ── Wallets & Accounts Summary ───────────────────────────────────────
      React.createElement(View, { style: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 18, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 } },
        React.createElement(Text, { style: { ...theme.typography.subtitle, color: theme.colors.textPrimary, marginBottom: 14 } }, 'Wallets & Accounts'),
        accounts.length === 0
          ? React.createElement(Text, { style: { color: theme.colors.textSecondary, fontSize: 13 } }, 'No accounts found.')
          : accounts.map(function(acc, idx) {
              return React.createElement(View, { key: acc.id, style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: idx < accounts.length - 1 ? 1 : 0, borderBottomColor: theme.colors.border } },
                React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center' } },
                  React.createElement(View, { style: { width: 8, height: 8, borderRadius: 4, backgroundColor: acc.color || theme.colors.primary, marginRight: 8 } }),
                  React.createElement(Text, { style: { fontSize: 13, color: theme.colors.textPrimary } }, acc.name)
                ),
                React.createElement(Text, { style: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary } }, formatCurrency(acc.balance))
              );
            })
      ),

      // ── Deposits by Account ───────────────────────────────────────────────
      React.createElement(View, { style: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 18, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 } },
        React.createElement(Text, { style: { ...theme.typography.subtitle, color: theme.colors.textPrimary, marginBottom: 14 } }, 'Deposits by Account'),
        incomeReceivedByAccount.length === 0
          ? React.createElement(Text, { style: { color: theme.colors.textSecondary, fontSize: 13 } }, 'No account deposits recorded this month.')
          : incomeReceivedByAccount.map(function(acc, idx) {
              return React.createElement(View, { key: acc.id, style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 12, borderBottomWidth: idx < incomeReceivedByAccount.length - 1 ? 1 : 0, borderBottomColor: theme.colors.border } },
                React.createElement(Text, { style: { fontSize: 13, color: theme.colors.textPrimary } }, acc.name),
                React.createElement(Text, { style: { fontSize: 13, fontWeight: '700', color: theme.colors.primary } }, formatCurrency(acc.amount))
              );
            })
      ),

      // ── Recent Income Activity ───────────────────────────────────────────
      React.createElement(View, { style: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 18, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 } },
        React.createElement(Text, { style: { ...theme.typography.subtitle, color: theme.colors.textPrimary, marginBottom: 14 } }, 'Recent Income Activity'),
        recentIncomeActivity.length === 0
          ? React.createElement(Text, { style: { color: theme.colors.textSecondary, fontSize: 13 } }, 'No income transactions yet.')
          : recentIncomeActivity.map(function(item) {
              var source = incomeSources.find(function(src) { return src.id === item.category; });
              var account = accounts.find(function(acc) { return acc.id === item.account_id; });
              return React.createElement(View, { key: item.id, style: { marginBottom: 14 } },
                React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 } },
                  React.createElement(Text, { style: { fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary } }, formatCurrency(item.amount)),
                  React.createElement(Text, { style: { fontSize: 12, color: theme.colors.textSecondary } }, getMonthStr(item.date))
                ),
                React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 } },
                  React.createElement(Text, { style: { fontSize: 12, color: theme.colors.textSecondary } }, 'Source: ' + (source ? source.name : (item.category || 'Unknown'))),
                  React.createElement(Text, { style: { fontSize: 12, color: theme.colors.textSecondary } }, 'Account: ' + (account ? account.name : (item.account_id === 'unlinked' ? 'Unlinked Cash' : 'Unknown Account')))
                )
              );
            })
      ),

      // ── Daily Average Card ────────────────────────────────────────────────
      React.createElement(View, { style: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 18, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 } },
        React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 } },
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
            <Text style={{ ...theme.typography.subtitle, color: theme.colors.textPrimary, marginRight: 6 }}>Daily Average</Text>
            <MaterialIcons name="info-outline" size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>,
          React.createElement(Text, { style: { ...theme.typography.subtitle, color: theme.colors.primary } }, formatCurrency(dailyAvg))
        ),
        React.createElement(Text, { style: { fontSize: 12, color: theme.colors.textSecondary } },
          'On average, you spend ' + formatCurrency(dailyAvg) + ' every day this month.'
        )
      ),

      // ── Spending by Envelope (Interactive Doughnut Chart) ───────────────────
      React.createElement(View, { style: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 18, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 } },
        React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 } },
          React.createElement(View, { style: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center', marginRight: 10 } },
            React.createElement(MaterialIcons, { name: 'pie-chart', size: 18, color: theme.colors.primary })
          ),
          React.createElement(Text, { style: { fontSize: 15, fontWeight: 'bold', color: theme.colors.textPrimary } }, 'Spending by Envelope')
        ),

        envelopeSpending.length === 0
          ? React.createElement(View, { style: { alignItems: 'center', paddingVertical: 24 } },
              React.createElement(MaterialIcons, { name: 'inbox', size: 44, color: theme.colors.border }),
              React.createElement(Text, { style: { color: theme.colors.textSecondary, marginTop: 10, fontSize: 14 } }, 'No spending recorded yet')
            )
          : React.createElement(View, null,
              // Centered SVG Doughnut Chart
              React.createElement(View, { style: { alignItems: 'center', justifyContent: 'center', marginVertical: 12 } },
                React.createElement(View, { style: { alignItems: 'center', justifyContent: 'center', width: 180, height: 180 } },
                  React.createElement('svg', {
                    viewBox: '0 0 100 100',
                    style: { width: 180, height: 180, position: 'absolute' }
                  },
                    svgSegments
                  ),
                  React.createElement(TouchableOpacity, {
                    onPress: function() { setSelectedEnvIndex(null); },
                    style: {
                      width: 110,
                      height: 110,
                      borderRadius: 55,
                      backgroundColor: theme.colors.card,
                      alignItems: 'center',
                      justifyContent: 'center',
                      elevation: 4,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.1,
                      shadowRadius: 3
                    }
                  },
                    React.createElement(Text, { numberOfLines: 1, style: { fontSize: 9, color: theme.colors.textSecondary, textTransform: 'uppercase', fontWeight: 'bold', textAlign: 'center', width: 90 } }, centerLabel),
                    React.createElement(Text, { numberOfLines: 1, style: { ...theme.typography.subtitle, color: theme.colors.textPrimary, marginTop: 2, textAlign: 'center', width: 95 } }, centerValue)
                  )
                )
              ),

              // Interactive category list below the chart
              React.createElement(View, { style: { marginTop: 16 } },
                coloredSpending.map(function(env, i) {
                  var isSelected = selectedEnvIndex === i;
                  var isAnySelected = selectedEnvIndex !== null;
                  var pct = maxEnvSpent > 0 ? Math.round((env.spent / maxEnvSpent) * 100) : 0;
                  var sharePct = totalMonthSpent > 0 ? Math.round((env.spent / totalMonthSpent) * 100) : 0;

                  return React.createElement(TouchableOpacity, {
                    key: i,
                    onPress: function() { setSelectedEnvIndex(isSelected ? null : i); },
                    style: {
                      padding: 10,
                      borderRadius: 10,
                      backgroundColor: isSelected ? 'rgba(255,237,213,0.4)' : 'transparent',
                      borderWidth: 1,
                      borderColor: isSelected ? theme.colors.primary : 'transparent',
                      marginBottom: i < coloredSpending.length - 1 ? 8 : 0,
                      opacity: !isAnySelected || isSelected ? 1 : 0.6,
                      transition: 'all 0.2s ease'
                    }
                  },
                    React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 } },
                      React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center' } },
                        React.createElement(View, { style: { width: 12, height: 12, borderRadius: 6, backgroundColor: env.color, marginRight: 8 } }),
                        React.createElement(Text, { style: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary } }, env.name)
                      ),
                      React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center' } },
                        React.createElement(Text, { style: { fontSize: 13, fontWeight: 'bold', color: theme.colors.textPrimary } }, formatCurrency(env.spent)),
                        React.createElement(Text, { style: { fontSize: 11, color: theme.colors.textSecondary, marginLeft: 6 } }, `(${sharePct}%)`)
                      )
                    ),
                    React.createElement(View, { style: { height: 8, backgroundColor: theme.colors.border, borderRadius: 4, overflow: 'hidden' } },
                      React.createElement(View, { style: { width: pct + '%', height: '100%', backgroundColor: env.color, borderRadius: 4 } })
                    )
                  );
                })
              )
            )
      ),

      // ── 6-Month Trend ─────────────────────────────────────────────────────
      React.createElement(View, { style: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 18, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 } },
        React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 } },
          React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center' } },
            React.createElement(View, { style: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center', marginRight: 10 } },
              React.createElement(MaterialIcons, { name: 'bar-chart', size: 18, color: theme.colors.primary })
            ),
            <TouchableOpacity onPress={() => setInfoModalConfig({
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
              })} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ ...theme.typography.subtitle, color: theme.colors.textPrimary, marginRight: 6 }}>6-Month Trend</Text>
              <MaterialIcons name="info-outline" size={16} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          ),
          React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center', gap: 12 } },
            React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center' } },
              React.createElement(View, { style: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#10B981', marginRight: 4 } }),
              React.createElement(Text, { style: { fontSize: 10, color: theme.colors.textSecondary } }, 'In')
            ),
            React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center' } },
              React.createElement(View, { style: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#EF4444', marginRight: 4 } }),
              React.createElement(Text, { style: { fontSize: 10, color: theme.colors.textSecondary } }, 'Out')
            )
          )
        ),

        // Chart area
        React.createElement(View, { style: { flexDirection: 'row', alignItems: 'flex-end', height: 140 } },
          monthlyTotals.map(function(m, i) {
            var spentPct = maxTrendValue > 0 ? (m.spent / maxTrendValue) : 0;
            var incomePct = maxTrendValue > 0 ? (m.income / maxTrendValue) : 0;
            var spentHeight = Math.max(4, Math.round(spentPct * 110));
            var incomeHeight = Math.max(4, Math.round(incomePct * 110));
            var isCurrent = m.key === curMonth;
            return React.createElement(View, { key: i, style: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' } },
              React.createElement(View, { style: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', width: '100%', marginBottom: 6 } },
                React.createElement(View, { style: { width: '30%', height: incomeHeight, backgroundColor: '#10B981', borderTopLeftRadius: 3, borderTopRightRadius: 3, marginRight: 2 } }),
                React.createElement(View, { style: { width: '30%', height: spentHeight, backgroundColor: '#EF4444', borderTopLeftRadius: 3, borderTopRightRadius: 3 } })
              ),
              React.createElement(Text, { style: { fontSize: 10, fontWeight: isCurrent ? 'bold' : '400', color: isCurrent ? theme.colors.primary : theme.colors.textSecondary } }, m.label)
            );
          })
        )
      ),

      // ── Monthly Audit History ─────────────────────────────────────────────
      React.createElement(View, { style: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 18, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 } },
        React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 } },
          React.createElement(View, { style: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginRight: 10 } },
            React.createElement(MaterialIcons, { name: 'analytics', size: 18, color: '#10B981' })
          ),
          React.createElement(Text, { style: { ...theme.typography.subtitle, color: theme.colors.textPrimary } }, 'Monthly Financial Audit')
        ),
        React.createElement(View, null,
          monthlyTotals.slice().reverse().map(function(m, i) {
            var isCurrent = m.key === curMonth;
            var savings = m.income - m.spent;
            return React.createElement(View, { key: i, style: { paddingVertical: 14, borderBottomWidth: i < monthlyTotals.length - 1 ? 1 : 0, borderBottomColor: theme.colors.border } },
              React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 } },
                React.createElement(Text, { style: { fontSize: 15, fontWeight: 'bold', color: isCurrent ? theme.colors.primary : theme.colors.textPrimary } }, m.label + (isCurrent ? ' (Current)' : '')),
                React.createElement(Text, { style: { fontSize: 14, fontWeight: 'bold', color: savings >= 0 ? '#10B981' : theme.colors.error } }, (savings >= 0 ? '+' : '') + formatCurrency(savings))
              ),
              React.createElement(View, { style: { flexDirection: 'row', gap: 12 } },
                React.createElement(View, { style: { flex: 1 } },
                  React.createElement(Text, { style: { fontSize: 10, color: theme.colors.textSecondary, marginBottom: 2, textTransform: 'uppercase' } }, 'Income'),
                  React.createElement(Text, { style: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary } }, formatCurrency(m.income))
                ),
                React.createElement(View, { style: { flex: 1 } },
                  React.createElement(Text, { style: { fontSize: 10, color: theme.colors.textSecondary, marginBottom: 2, textTransform: 'uppercase' } }, 'Spent'),
                  React.createElement(Text, { style: { fontSize: 13, fontWeight: '600', color: theme.colors.error } }, '-' + formatCurrency(m.spent))
                ),
                React.createElement(View, { style: { flex: 1, alignItems: 'flex-end' } },
                  React.createElement(Text, { style: { fontSize: 10, color: theme.colors.textSecondary, marginBottom: 2, textTransform: 'uppercase' } }, 'Saved'),
                  React.createElement(Text, { style: { fontSize: 13, fontWeight: '600', color: '#10B981' } }, formatCurrency(Math.max(0, savings)))
                )
              )
            );
          })
        )
      )
    ),
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
  );
};

export default StatisticsScreen;

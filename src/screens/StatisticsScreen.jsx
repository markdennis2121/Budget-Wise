import React, { useMemo, useState, useEffect } from 'react';
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
import { triggerImpactHaptic } from '../utils/feedback';
import { scale, moderateScale, normalize } from '../utils/responsive';

const TAB_MENU_HEIGHT = Platform.OS === 'web' ? 56 : 81;
const WEB_TAB_MENU_PADDING = 90;

const StatisticsScreen = function(props) {
  var navigation = props.navigation;
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var userCtx = useUser();
  var userId = userCtx.currentUser ? userCtx.currentUser.id : '';
  var insets = useSafeAreaInsets();
  var scrollBottomPadding = Platform.OS === 'web' ? WEB_TAB_MENU_PADDING : (TAB_MENU_HEIGHT + insets.bottom + 16);

  var settingsQuery = useQuery('user_settings');
  var allSettings = settingsQuery.data || [];
  var userSettings = allSettings.find(function(s) { return s.user_id === userId; });
  var isPremium = userSettings?.is_premium || false;

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

  var allAccounts = useMemo(function() {
    return buildAccountsWithBalances({
      userSettings: userSettings,
      userHistory: userHistory
    });
  }, [userSettings, userHistory]);

  var accounts = useMemo(function() {
    return allAccounts.filter(function(a) { return !a.isArchived; });
  }, [allAccounts]);

  var incomeSources = useMemo(function() {
    if (!userSettings) return [];
    if (userSettings.income_sources) {
      var raw = typeof userSettings.income_sources === 'string' ? JSON.parse(userSettings.income_sources) : userSettings.income_sources;
      return Array.isArray(raw) ? raw : [];
    }
    return [{ id: 'main-salary', name: 'Main Salary', amount: parseFloat(userSettings.monthly_salary) || 0 }];
  }, [userSettings]);

  var isSimpleMode = userSettings && userSettings.budgeting_style === 'simple';

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

  var spendingByAccount = useMemo(function() {
    var spent = {};
    userHistory.forEach(function(h) {
      if (getMonthStr(h.date) === curMonth && (h.expense_type === 'One-Time' || h.expense_type === 'Recurring')) {
        var accountId = h.account_id || 'unlinked';
        spent[accountId] = (spent[accountId] || 0) + (parseFloat(h.amount) || 0);
      }
    });

    return Object.keys(spent).map(function(accountId) {
      var acc = accounts.find(function(a) { return a.id === accountId; });
      return {
        id: accountId,
        name: acc ? acc.name : (accountId === 'unlinked' ? 'Unlinked Cash' : 'Unknown'),
        spent: spent[accountId],
        color: acc ? acc.color : '#9CA3AF'
      };
    }).sort(function(a, b) { return b.spent - a.spent; });
  }, [accounts, userHistory, curMonth]);

  var totalMonthSpent = useMemo(function() {
    if (isSimpleMode) {
      return spendingByAccount.reduce(function(s, a) { return s + a.spent; }, 0);
    }
    return envelopeSpending.reduce(function(s, e) { return s + e.spent; }, 0);
  }, [envelopeSpending, spendingByAccount, isSimpleMode]);

  var maxSpentItem = isSimpleMode
    ? (spendingByAccount.length > 0 ? spendingByAccount[0].spent : 1)
    : (envelopeSpending.length > 0 ? envelopeSpending[0].spent : 1);
  var savings = totalMonthlyIncome - totalMonthSpent;

  var dailyAvg = useMemo(function() {
    var day = new Date().getDate();
    return totalMonthSpent / (day || 1);
  }, [totalMonthSpent]);

  // Privacy State: Persist visibility
  var [balancesVisible, setBalancesVisible] = useState(function() {
    try {
      var saved = localStorage.getItem('penny_balances_visible');
      return saved !== null ? JSON.parse(saved) : true;
    } catch (e) { return true; }
  });

  // Listener to sync visibility when switching tabs or reopening
  useEffect(function() {
    var syncVisibility = function() {
      try {
        var saved = localStorage.getItem('penny_balances_visible');
        var val = saved !== null ? JSON.parse(saved) : true;
        setBalancesVisible(val);
      } catch (e) {}
    };

    var unsubscribe = navigation ? navigation.addListener('focus', syncVisibility) : null;
    return unsubscribe;
  }, [navigation]);

  var toggleBalances = function() {
    triggerImpactHaptic('Medium');
    var newVal = !balancesVisible;
    setBalancesVisible(newVal);
    try {
      localStorage.setItem('penny_balances_visible', JSON.stringify(newVal));
    } catch (e) {}
  };

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
          <Text style={{ fontSize: normalize(14), color: theme.colors.textSecondary, marginBottom: moderateScale(16), lineHeight: normalize(20) }}>
            This is the total income earned or logged this month. All money comes strictly from actual logged transactions.
          </Text>
          <View style={{ backgroundColor: theme.colors.background, borderRadius: scale(12), padding: moderateScale(16), borderWidth: 1, borderColor: theme.colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: moderateScale(12) }}>
              <Text style={{ fontSize: normalize(14), color: theme.colors.textPrimary, fontWeight: '600' }}>Template-Logged Income</Text>
              <Text style={{ fontSize: normalize(14), color: theme.colors.textPrimary, fontWeight: 'bold' }}>{formatCurrency(templateIncome)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: normalize(14), color: theme.colors.textPrimary, fontWeight: '600' }}>Manual & Extra Income</Text>
              <Text style={{ fontSize: normalize(14), color: theme.colors.textPrimary, fontWeight: 'bold' }}>{formatCurrency(manualIncome)}</Text>
            </View>
            <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: moderateScale(14) }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: normalize(16), color: theme.colors.primary, fontWeight: 'bold' }}>Total Income</Text>
              <Text style={{ fontSize: normalize(16), color: theme.colors.primary, fontWeight: 'bold' }}>{maskAmount(totalMonthlyIncome)}</Text>
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
          <Text style={{ fontSize: normalize(14), color: theme.colors.textSecondary, marginBottom: moderateScale(16), lineHeight: normalize(20) }}>
            This is the sum of all your one-time expenses and paid recurring bills for the current month.
          </Text>
          <View style={{ backgroundColor: 'rgba(220, 38, 38, 0.1)', borderRadius: scale(12), padding: moderateScale(14), flexDirection: 'row', alignItems: 'center' }}>
            <MaterialIcons name="shopping-cart" size={scale(20)} color="#DC2626" style={{ marginRight: moderateScale(10) }} />
            <Text style={{ fontSize: normalize(13), color: '#B91C1C', fontWeight: 'bold', flex: 1 }}>
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
          <Text style={{ fontSize: normalize(14), color: theme.colors.textSecondary, marginBottom: moderateScale(16), lineHeight: normalize(20) }}>
            This is simply your Total Income minus your Total Spent for this month.
          </Text>
          <View style={{ backgroundColor: savings >= 0 ? 'rgba(22, 163, 74, 0.1)' : 'rgba(220, 38, 38, 0.1)', borderRadius: scale(12), padding: moderateScale(14), flexDirection: 'row', alignItems: 'center' }}>
            <MaterialIcons name={savings >= 0 ? 'savings' : 'warning'} size={scale(20)} color={savings >= 0 ? '#16A34A' : '#DC2626'} style={{ marginRight: moderateScale(10) }} />
            <Text style={{ fontSize: normalize(13), color: savings >= 0 ? '#15803D' : '#B91C1C', fontWeight: 'bold', flex: 1 }}>
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
    if (isSimpleMode) {
      return spendingByAccount.map(function(acc, idx) {
        return {
          ...acc,
          color: acc.color || SEGMENT_COLORS[idx % SEGMENT_COLORS.length]
        };
      });
    }
    return envelopeSpending.map(function(env, idx) {
      return {
        ...env,
        color: env.isOrphan ? '#9CA3AF' : SEGMENT_COLORS[idx % SEGMENT_COLORS.length]
      };
    });
  }, [envelopeSpending, spendingByAccount, isSimpleMode]);

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

  var centerLabel = selectedEnvIndex !== null ? coloredSpending[selectedEnvIndex].name : (isSimpleMode ? 'Total Expenses' : 'Total Spent');
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

  var netWorthTrend = useMemo(function() {
    // 1. Get current total net worth
    var currentNetWorth = accounts.reduce(function(s, a) { return s + a.balance; }, 0);

    // 2. We need to work backwards from newest to oldest
    // monthlyTotals is oldest -> newest [M-5, M-4, M-3, M-2, M-1, M-now]
    var trend = [];
    var runningNetWorth = currentNetWorth;

    // Start from the latest (current) month
    for (var i = monthlyTotals.length - 1; i >= 0; i--) {
      var m = monthlyTotals[i];
      trend.unshift({
        label: m.label,
        value: runningNetWorth,
        key: m.key
      });

      // Calculate net change for this month to find the previous month's ending balance
      var netChange = m.income - m.spent;
      runningNetWorth -= netChange;
    }

    return trend;
  }, [accounts, monthlyTotals]);

  var maxNetWorth = Math.max.apply(null, netWorthTrend.map(function(t) { return t.value; }).concat([1]));
  var minNetWorth = Math.min.apply(null, netWorthTrend.map(function(t) { return t.value; }).concat([0]));
  // Buffer for visual headroom
  var chartMax = maxNetWorth * 1.15;
  var chartMin = minNetWorth * 0.85;
  if (chartMin < 0) chartMin = 0;

  var monthlyInsight = useMemo(function() {
    var base = buildMonthlyInsight({
      monthlyTotals: monthlyTotals,
      curMonthKey: curMonth,
      envelopeSpending: envelopeSpending
    });
    if (isSimpleMode) {
      // Sanitize text for simple mode (remove envelope references)
      base.text = base.text.replace(/envelopes/gi, 'wallets').replace(/envelope/gi, 'account');
    }
    return base;
  }, [monthlyTotals, curMonth, envelopeSpending, isSimpleMode]);

  var [showInsight, setShowInsight] = useState(true);

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
      <View style={{ backgroundColor: theme.colors.primary, paddingTop: insets.top + moderateScale(16), paddingBottom: moderateScale(28), paddingHorizontal: moderateScale(20) }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ ...theme.typography.h2, color: '#FFFFFF' }}>Statistics</Text>
            <Text style={{ ...theme.typography.bodySmall, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>
              Insights for {MONTH_LABELS[new Date().getMonth()] || ''} {new Date().getFullYear()}
            </Text>
          </View>
          <TouchableOpacity
            onPress={toggleBalances}
            style={{ width: scale(44), height: scale(44), borderRadius: scale(22), backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
          >
            <MaterialIcons name={balancesVisible ? 'visibility' : 'visibility-off'} size={scale(22)} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: moderateScale(20), paddingHorizontal: moderateScale(16), paddingBottom: scrollBottomPadding }}>

        {/* Insight Card */}
        {showInsight && (
          <View style={{ backgroundColor: theme.colors.card, borderRadius: scale(16), padding: moderateScale(18), marginBottom: moderateScale(16), borderWidth: 1, borderColor: monthlyInsight.color + '33', elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 }}>
            <View style={{ flexDirection: 'row', alignItems: 'flex-start' }}>
              <View style={{ width: scale(40), height: scale(40), borderRadius: scale(20), backgroundColor: monthlyInsight.color + '18', alignItems: 'center', justifyContent: 'center', marginRight: moderateScale(12) }}>
                <MaterialIcons name={monthlyInsight.icon} size={scale(22)} color={monthlyInsight.color} />
              </View>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                  <Text style={{ fontSize: normalize(15), fontWeight: 'bold', color: theme.colors.textPrimary, marginBottom: 6, flex: 1 }}>{monthlyInsight.title}</Text>
                  <TouchableOpacity onPress={() => { triggerImpactHaptic('Light'); setShowInsight(false); }} style={{ padding: 4 }}>
                    <MaterialIcons name="close" size={scale(18)} color={theme.colors.textSecondary} />
                  </TouchableOpacity>
                </View>
                <Text style={{ fontSize: normalize(13), color: theme.colors.textSecondary, lineHeight: normalize(20), paddingRight: 8 }}>{monthlyInsight.text}</Text>
              </View>
            </View>
          </View>
        )}

        {/* ── Net Worth Growth Chart (Line Chart) ── */}
        <View style={{ backgroundColor: theme.colors.card, borderRadius: scale(24), padding: moderateScale(20), marginBottom: moderateScale(20), shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(20) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: scale(36), height: scale(36), borderRadius: scale(10), backgroundColor: theme.colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: moderateScale(12) }}>
                <MaterialIcons name='show-chart' size={scale(20)} color={theme.colors.primary} />
              </View>
              <Text style={{ fontSize: normalize(16), fontWeight: 'bold', color: theme.colors.textPrimary }}>Asset Growth Trend</Text>
            </View>
            <View style={{ backgroundColor: theme.isDark ? '#374151' : '#F3F4F6', paddingHorizontal: scale(10), paddingVertical: scale(4), borderRadius: scale(8) }}>
              <Text style={{ fontSize: scale(10), color: theme.colors.textSecondary, fontWeight: 'bold' }}>TOTAL ASSETS</Text>
            </View>
          </View>

          <View style={{ height: scale(180), width: '100%', marginBottom: 10 }}>
            {!isPremium ? (
               <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background + '88', borderRadius: 16 }}>
                  <MaterialIcons name="lock" size={32} color={theme.colors.primary} style={{ marginBottom: 12 }} />
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.textPrimary, textAlign: 'center' }}>Premium Feature</Text>
                  <Text style={{ fontSize: 11, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 4, paddingHorizontal: 20 }}>Upgrade to Premium to visualize your net worth growth over time.</Text>
                  <TouchableOpacity
                    onPress={() => navigation.navigate('MainApp', { screen: 'Dashboard', params: { showPremium: true } })}
                    style={{ marginTop: 14, backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 }}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>Unlock Trends</Text>
                  </TouchableOpacity>
               </View>
            ) : netWorthTrend.length > 1 ? (
              <svg viewBox="0 0 300 120" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                <defs>
                  <linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor={theme.colors.primary} stopOpacity="0.3" />
                    <stop offset="100%" stopColor={theme.colors.primary} stopOpacity="0" />
                  </linearGradient>
                </defs>
                {/* Grid Lines */}
                <line x1="0" y1="0" x2="300" y2="0" stroke={theme.colors.border} strokeWidth="0.5" strokeDasharray="4 4" />
                <line x1="0" y1="60" x2="300" y2="60" stroke={theme.colors.border} strokeWidth="0.5" strokeDasharray="4 4" />
                <line x1="0" y1="120" x2="300" y2="120" stroke={theme.colors.border} strokeWidth="1" />

                {(() => {
                  var points = netWorthTrend.map((t, i) => {
                    var x = (i / (netWorthTrend.length - 1)) * 300;
                    var y = 120 - ((t.value - chartMin) / (chartMax - chartMin)) * 120;
                    if (isNaN(y)) y = 120;
                    return { x, y };
                  });

                  // Create Smooth Curve (Cubic Bezier)
                  var pathData = `M ${points[0].x} ${points[0].y}`;
                  for (var i = 0; i < points.length - 1; i++) {
                    var p0 = points[i];
                    var p1 = points[i + 1];
                    var cp1x = p0.x + (p1.x - p0.x) / 2;
                    var cp1y = p0.y;
                    var cp2x = p0.x + (p1.x - p0.x) / 2;
                    var cp2y = p1.y;
                    pathData += ` C ${cp1x} ${cp1y}, ${cp2x} ${cp2y}, ${p1.x} ${p1.y}`;
                  }

                  var areaData = pathData + ` L ${points[points.length-1].x} 120 L ${points[0].x} 120 Z`;

                  return (
                    <>
                      <path d={areaData} fill="url(#areaGradient)" />
                      <path d={pathData} fill="transparent" stroke={theme.colors.primary} strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
                      {points.map((p, i) => (
                        <circle key={i} cx={p.x} cy={p.y} r="4" fill={theme.colors.card} stroke={theme.colors.primary} strokeWidth="2" />
                      ))}
                    </>
                  );
                })()}
              </svg>
            ) : (
              <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: theme.colors.textSecondary }}>Insufficient history for trend</Text>
              </View>
            )}
          </View>

          {isPremium && (
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 5 }}>
              {netWorthTrend.map((t, i) => (
                <View key={i} style={{ alignItems: 'center' }}>
                  <Text style={{ fontSize: normalize(9), fontWeight: 'bold', color: i === netWorthTrend.length - 1 ? theme.colors.primary : theme.colors.textSecondary }}>{t.label}</Text>
                  <Text style={{ fontSize: normalize(8), color: theme.colors.textSecondary, marginTop: 2 }}>{balancesVisible ? (t.value >= 10000 ? (t.value / 1000).toFixed(0) + 'k' : t.value.toFixed(0)) : '•••'}</Text>
                </View>
              ))}
            </View>
          )}

          <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: moderateScale(16) }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
            <View>
              <Text style={{ fontSize: normalize(11), color: theme.colors.textSecondary, fontWeight: '600' }}>Current Liquid Worth</Text>
              <Text style={{ fontSize: normalize(18), fontWeight: '900', color: theme.colors.textPrimary, marginTop: 2 }}>{maskAmount(netWorthTrend[netWorthTrend.length-1].value)}</Text>
            </View>
            {isPremium && netWorthTrend.length > 1 && (
              <View style={{ alignItems: 'flex-end' }}>
                {(() => {
                  var current = netWorthTrend[netWorthTrend.length-1].value;
                  var prev = netWorthTrend[netWorthTrend.length-2].value;
                  var diff = current - prev;
                  var pct = prev !== 0 ? ((diff / Math.abs(prev)) * 100).toFixed(1) : '100';
                  var isUp = diff >= 0;
                  return (
                    <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isUp ? '#DCFCE7' : '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                      <MaterialIcons name={isUp ? 'trending-up' : 'trending-down'} size={14} color={isUp ? '#16A34A' : '#DC2626'} style={{ marginRight: 4 }} />
                      <Text style={{ fontSize: normalize(11), fontWeight: 'bold', color: isUp ? '#16A34A' : '#DC2626' }}>{isUp ? '+' : ''}{pct}%</Text>
                    </View>
                  );
                })()}
                <Text style={{ fontSize: normalize(9), color: theme.colors.textSecondary, marginTop: 4, fontWeight: '600' }}>vs last month</Text>
              </View>
            )}
          </View>
        </View>

        {/* ── Professional Summary Grid ── */}
        <View style={{ flexDirection: 'row', marginBottom: moderateScale(20), gap: moderateScale(10) }}>
          <TouchableOpacity activeOpacity={0.8} onPress={handleIncomeInfo} style={{ flex: 1, backgroundColor: theme.isDark ? 'rgba(16, 185, 129, 0.05)' : '#F0FDF4', borderRadius: scale(20), padding: moderateScale(14), borderWidth: 1, borderColor: theme.isDark ? 'rgba(16, 185, 129, 0.2)' : '#DCFCE7', justifyContent: 'space-between', minHeight: scale(100) }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: normalize(10), color: '#16A34A', fontWeight: '800', letterSpacing: 0.5 }}>INCOME</Text>
              <MaterialIcons name="trending-up" size={scale(14)} color="#16A34A" />
            </View>
            <Text style={{ fontSize: normalize(18), fontWeight: '800', color: theme.colors.textPrimary }}>{maskAmount(totalMonthlyIncome)}</Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.8} onPress={handleSpentInfo} style={{ flex: 1, backgroundColor: theme.isDark ? 'rgba(239, 68, 68, 0.05)' : '#FEF2F2', borderRadius: scale(20), padding: moderateScale(14), borderWidth: 1, borderColor: theme.isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2', justifyContent: 'space-between', minHeight: scale(100) }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: normalize(10), color: '#DC2626', fontWeight: '800', letterSpacing: 0.5 }}>{isSimpleMode ? 'EXPENSES' : 'SPENT'}</Text>
              <MaterialIcons name="shopping-cart" size={scale(14)} color="#DC2626" />
            </View>
            <Text style={{ fontSize: normalize(18), fontWeight: '800', color: theme.colors.textPrimary }}>{maskAmount(totalMonthSpent)}</Text>
          </TouchableOpacity>

          <TouchableOpacity activeOpacity={0.8} onPress={handleSavedInfo} style={{ flex: 1, backgroundColor: theme.isDark ? (savings >= 0 ? 'rgba(59, 130, 246, 0.05)' : 'rgba(239, 68, 68, 0.05)') : (savings >= 0 ? '#EFF6FF' : '#FEF2F2'), borderRadius: scale(20), padding: moderateScale(14), borderWidth: 1, borderColor: theme.isDark ? (savings >= 0 ? 'rgba(59, 130, 246, 0.2)' : 'rgba(239, 68, 68, 0.2)') : (savings >= 0 ? '#DBEAFE' : '#FEE2E2'), justifyContent: 'space-between', minHeight: scale(100) }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: normalize(10), color: savings >= 0 ? '#2563EB' : '#DC2626', fontWeight: '800', letterSpacing: 0.5 }}>{savings >= 0 ? 'SAVED' : 'DEFICIT'}</Text>
              <MaterialIcons name={savings >= 0 ? "savings" : "warning"} size={scale(14)} color={savings >= 0 ? "#2563EB" : "#DC2626"} />
            </View>
            <Text style={{ fontSize: normalize(18), fontWeight: '800', color: theme.colors.textPrimary }}>{maskAmount(Math.abs(savings))}</Text>
          </TouchableOpacity>
        </View>

        {/* ── Income by Source ── */}
        <View style={{ backgroundColor: theme.colors.card, borderRadius: scale(24), padding: moderateScale(20), marginBottom: moderateScale(20), shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: theme.colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(18) }}>
            <View style={{ width: scale(32), height: scale(32), borderRadius: scale(10), backgroundColor: theme.colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: moderateScale(12) }}>
              <MaterialIcons name='category' size={scale(18)} color={theme.colors.primary} />
            </View>
            <Text style={{ fontSize: normalize(16), fontWeight: 'bold', color: theme.colors.textPrimary }}>Income by Source</Text>
          </View>

          {incomeBySourceWithPercent.length === 0
            ? <Text style={{ color: theme.colors.textSecondary, fontSize: normalize(13) }}>No income transactions recorded this month.</Text>
            : incomeBySourceWithPercent.map(function(src) {
                return (
                  <View key={src.id} style={{ marginBottom: moderateScale(20) }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(8) }}>
                      <Text style={{ fontSize: normalize(14), fontWeight: '700', color: theme.colors.textPrimary }}>{src.name}</Text>
                      <Text style={{ fontSize: normalize(14), fontWeight: '800', color: '#16A34A' }}>{maskAmount(src.amount)}</Text>
                    </View>
                    <View style={{ height: scale(8), backgroundColor: theme.colors.border, borderRadius: scale(4), overflow: 'hidden' }}>
                      <View style={{ width: src.percent + '%', height: '100%', backgroundColor: theme.colors.primary }} />
                    </View>
                    <Text style={{ fontSize: normalize(11), color: theme.colors.textSecondary, marginTop: moderateScale(6), fontWeight: '600' }}>{src.percent}% of total monthly income</Text>
                  </View>
                );
              })
          }
        </View>

        {/* ── Wallets & Accounts Summary ── */}
        <View style={{ backgroundColor: theme.colors.card, borderRadius: scale(24), padding: moderateScale(20), marginBottom: moderateScale(20), shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: theme.colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(18) }}>
            <View style={{ width: scale(32), height: scale(32), borderRadius: scale(10), backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center', marginRight: moderateScale(12) }}>
              <MaterialIcons name='account-balance-wallet' size={scale(18)} color={theme.colors.primary} />
            </View>
            <Text style={{ fontSize: normalize(16), fontWeight: 'bold', color: theme.colors.textPrimary }}>Wallets & Accounts</Text>
          </View>

          {accounts.length === 0
            ? <Text style={{ color: theme.colors.textSecondary, fontSize: normalize(13) }}>No accounts found.</Text>
            : accounts.map(function(acc, idx) {
                return (
                  <View key={acc.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: moderateScale(14), borderBottomWidth: idx < accounts.length - 1 ? 1 : 0, borderBottomColor: theme.colors.border }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                      <View style={{ width: scale(10), height: scale(10), borderRadius: scale(5), backgroundColor: acc.color || theme.colors.primary, marginRight: moderateScale(10) }} />
                      <Text style={{ fontSize: normalize(14), fontWeight: '600', color: theme.colors.textPrimary }}>{acc.name}</Text>
                    </View>
                    <Text style={{ fontSize: normalize(14), fontWeight: '800', color: theme.colors.textPrimary }}>{maskAmount(acc.balance)}</Text>
                  </View>
                );
              })
          }
        </View>

        {/* ── Deposits by Account ── */}
        <View style={{ backgroundColor: theme.colors.card, borderRadius: scale(24), padding: moderateScale(20), marginBottom: moderateScale(20), shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: theme.colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(18) }}>
            <View style={{ width: scale(32), height: scale(32), borderRadius: scale(10), backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginRight: moderateScale(12) }}>
              <MaterialIcons name='input' size={scale(18)} color='#16A34A' />
            </View>
            <Text style={{ fontSize: normalize(16), fontWeight: 'bold', color: theme.colors.textPrimary }}>Deposits by Account</Text>
          </View>

          {incomeReceivedByAccount.length === 0
            ? <Text style={{ color: theme.colors.textSecondary, fontSize: normalize(13) }}>No account deposits recorded this month.</Text>
            : incomeReceivedByAccount.map(function(acc, idx) {
                return (
                  <View key={acc.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: moderateScale(14), borderBottomWidth: idx < incomeReceivedByAccount.length - 1 ? 1 : 0, borderBottomColor: theme.colors.border }}>
                    <Text style={{ fontSize: normalize(14), fontWeight: '600', color: theme.colors.textPrimary }}>{acc.name}</Text>
                    <Text style={{ fontSize: normalize(14), fontWeight: '800', color: '#16A34A' }}>{maskAmount(acc.amount)}</Text>
                  </View>
                );
              })
          }
        </View>

        {/* ── Recent Income Activity ── */}
        <View style={{ backgroundColor: theme.colors.card, borderRadius: scale(24), padding: moderateScale(20), marginBottom: moderateScale(20), shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: theme.colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(18) }}>
            <View style={{ width: scale(32), height: scale(32), borderRadius: scale(10), backgroundColor: '#EDE9FE', alignItems: 'center', justifyContent: 'center', marginRight: moderateScale(12) }}>
              <MaterialIcons name='history' size={scale(18)} color='#7C3AED' />
            </View>
            <Text style={{ fontSize: normalize(16), fontWeight: 'bold', color: theme.colors.textPrimary }}>Recent Income Activity</Text>
          </View>

          {recentIncomeActivity.length === 0
            ? <Text style={{ color: theme.colors.textSecondary, fontSize: normalize(13) }}>No income transactions yet.</Text>
            : recentIncomeActivity.map(function(item, idx) {
                var source = incomeSources.find(function(src) { return src.id === item.category; });
                var account = accounts.find(function(acc) { return acc.id === item.account_id; });
                return (
                  <View key={item.id} style={{ paddingVertical: moderateScale(14), borderBottomWidth: idx < recentIncomeActivity.length - 1 ? 1 : 0, borderBottomColor: theme.colors.border }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                      <Text style={{ fontSize: normalize(14), fontWeight: '800', color: '#16A34A' }}>{maskAmount(item.amount)}</Text>
                      <Text style={{ fontSize: normalize(12), color: theme.colors.textSecondary, fontWeight: '600' }}>{formatDate(item.date)}</Text>
                    </View>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', flexWrap: 'wrap', gap: 8 }}>
                      <Text style={{ fontSize: normalize(12), color: theme.colors.textSecondary }}>Source: <Text style={{ fontWeight: '700' }}>{source ? source.name : (item.category || 'Unknown')}</Text></Text>
                      <Text style={{ fontSize: normalize(12), color: theme.colors.textSecondary }}>Wallet: <Text style={{ fontWeight: '700' }}>{account ? account.name : (item.account_id === 'unlinked' ? 'Unlinked Cash' : 'Unknown Account')}</Text></Text>
                    </View>
                  </View>
                );
              })
          }
        </View>

        {/* ── Spending Chart (Dynamic) ── */}
        <View style={{ backgroundColor: theme.colors.card, borderRadius: scale(24), padding: moderateScale(20), marginBottom: moderateScale(20), shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: theme.colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(20) }}>
            <View style={{ width: scale(36), height: scale(36), borderRadius: scale(10), backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center', marginRight: moderateScale(12) }}>
              <MaterialIcons name='pie-chart' size={scale(20)} color={theme.colors.primary} />
            </View>
            <Text style={{ fontSize: normalize(16), fontWeight: 'bold', color: theme.colors.textPrimary }}>{isSimpleMode ? 'Spending by Wallet' : 'Spending by Envelope'}</Text>
          </View>

          {coloredSpending.length === 0
            ? <View style={{ alignItems: 'center', paddingVertical: moderateScale(40) }}>
                <MaterialIcons name="inbox" size={scale(48)} color={theme.colors.border} />
                <Text style={{ color: theme.colors.textSecondary, marginTop: moderateScale(12), fontSize: normalize(14) }}>No spending recorded yet</Text>
              </View>
            : <View>
                <View style={{ alignItems: 'center', justifyContent: 'center', marginVertical: moderateScale(10) }}>
                  <View style={{ alignItems: 'center', justifyContent: 'center', width: scale(200), height: scale(200) }}>
                    <View style={{ position: 'absolute', width: scale(200), height: scale(200) }}>
                      <svg viewBox="0 0 100 100" style={{ width: '100%', height: '100%' }}>{svgSegments}</svg>
                    </View>
                    <TouchableOpacity
                      onPress={function() { setSelectedEnvIndex(null); }}
                      style={{
                        width: scale(120),
                        height: scale(120),
                        borderRadius: scale(60),
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
                      <Text numberOfLines={1} style={{ fontSize: normalize(9), color: theme.colors.textSecondary, textTransform: 'uppercase', fontWeight: 'bold', textAlign: 'center', width: scale(90), letterSpacing: 0.5 }}>{centerLabel}</Text>
                      <Text numberOfLines={1} style={{ fontSize: normalize(16), fontWeight: '800', color: theme.colors.textPrimary, marginTop: 4, textAlign: 'center', width: scale(100) }}>{centerValue}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                <View style={{ marginTop: moderateScale(20) }}>
                  {coloredSpending.map(function(item, i) {
                    var isSelected = selectedEnvIndex === i;
                    var isAnySelected = selectedEnvIndex !== null;
                    var pct = maxSpentItem > 0 ? Math.round((item.spent / maxSpentItem) * 100) : 0;
                    var sharePct = totalMonthSpent > 0 ? Math.round((item.spent / totalMonthSpent) * 100) : 0;

                    return (
                      <TouchableOpacity
                        key={i}
                        onPress={function() { setSelectedEnvIndex(isSelected ? null : i); }}
                        style={{
                          padding: moderateScale(12),
                          borderRadius: scale(14),
                          backgroundColor: isSelected ? (theme.isDark ? 'rgba(255,237,213,0.08)' : 'rgba(255,237,213,0.4)') : 'transparent',
                          borderWidth: 1,
                          borderColor: isSelected ? theme.colors.primary : 'transparent',
                          marginBottom: moderateScale(8),
                          opacity: !isAnySelected || isSelected ? 1 : 0.6
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(8) }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: scale(10), height: scale(10), borderRadius: scale(5), backgroundColor: item.color, marginRight: moderateScale(10) }} />
                            <Text style={{ fontSize: normalize(14), fontWeight: '600', color: theme.colors.textPrimary }}>{item.name}</Text>
                          </View>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <Text style={{ fontSize: normalize(14), fontWeight: '800', color: theme.colors.textPrimary }}>{maskAmount(item.spent)}</Text>
                            <Text style={{ fontSize: normalize(11), color: theme.colors.textSecondary, marginLeft: moderateScale(8) }}>({sharePct}%)</Text>
                          </View>
                        </View>
                        <View style={{ height: scale(6), backgroundColor: theme.colors.border, borderRadius: scale(3), overflow: 'hidden' }}>
                          <View style={{ width: pct + '%', height: '100%', backgroundColor: item.color, borderRadius: scale(3) }} />
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
          }
        </View>

        {!isSimpleMode && (
          <View style={{ backgroundColor: theme.colors.card, borderRadius: scale(24), padding: moderateScale(20), marginBottom: moderateScale(20), shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: theme.colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(12) }}>
              <TouchableOpacity onPress={() => setInfoModalConfig({
                  visible: true,
                  title: 'Daily Spending Average',
                  content: (
                    <View>
                      <Text style={{ fontSize: normalize(14), color: theme.colors.textSecondary, marginBottom: 12, lineHeight: normalize(22) }}>
                        This is your total spending this month divided by the number of days passed so far.
                      </Text>
                      <View style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: scale(12), padding: moderateScale(14), flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialIcons name="speed" size={scale(20)} color="#3B82F6" style={{ marginRight: 10 }} />
                        <Text style={{ fontSize: normalize(13), color: '#1D4ED8', fontWeight: 'bold', flex: 1 }}>
                          Knowing your daily pace helps you decide if you can afford that extra treat today!
                        </Text>
                      </View>
                    </View>
                  )
                })} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: normalize(16), fontWeight: 'bold', color: theme.colors.textPrimary, marginRight: 6 }}>Daily Average</Text>
                <MaterialIcons name="info-outline" size={scale(16)} color={theme.colors.textSecondary} />
              </TouchableOpacity>
              <Text style={{ fontSize: normalize(16), fontWeight: '800', color: theme.colors.primary }}>{maskAmount(dailyAvg)}</Text>
            </View>
            <Text style={{ fontSize: normalize(12), color: theme.colors.textSecondary, fontWeight: '600' }}>
              On average, you spend {maskAmount(dailyAvg)} every day this month.
            </Text>
          </View>
        )}

        {/* ── 6-Month Trend ── */}
        <View style={{ backgroundColor: theme.colors.card, borderRadius: scale(24), padding: moderateScale(20), marginBottom: moderateScale(20), shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: theme.colors.border, overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(20) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: scale(36), height: scale(36), borderRadius: scale(10), backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginRight: moderateScale(12) }}>
                <MaterialIcons name='bar-chart' size={scale(20)} color='#2563EB' />
              </View>
              <TouchableOpacity
                onPress={() => setInfoModalConfig({
                  visible: true,
                  title: '6-Month Trend',
                  content: (
                    <View>
                      <Text style={{ fontSize: normalize(14), color: theme.colors.textSecondary, marginBottom: moderateScale(12), lineHeight: normalize(22) }}>
                        This chart compares your total income (green) versus your total expenses (red) over the last half-year.
                      </Text>
                      <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: scale(12), padding: moderateScale(14), flexDirection: 'row', alignItems: 'center' }}>
                        <MaterialIcons name="trending-up" size={scale(20)} color="#10B981" style={{ marginRight: 10 }} />
                        <Text style={{ fontSize: normalize(13), color: '#047857', fontWeight: 'bold', flex: 1 }}>
                          A healthy trend shows your green bars consistently taller than your red bars!
                        </Text>
                      </View>
                    </View>
                  )
                })}
                style={{ flexDirection: 'row', alignItems: 'center' }}
              >
                <Text style={{ fontSize: normalize(16), fontWeight: 'bold', color: theme.colors.textPrimary, marginRight: 6 }}>6-Month Trend</Text>
                <MaterialIcons name="info-outline" size={scale(16)} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: scale(12) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: scale(8), height: scale(8), borderRadius: scale(4), backgroundColor: '#10B981', marginRight: 4 }} />
                <Text style={{ fontSize: normalize(10), color: theme.colors.textSecondary, fontWeight: '700' }}>IN</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: scale(8), height: scale(8), borderRadius: scale(4), backgroundColor: '#EF4444', marginRight: 4 }} />
                <Text style={{ fontSize: normalize(10), color: theme.colors.textSecondary, fontWeight: '700' }}>OUT</Text>
              </View>
            </View>
          </View>

          {!isPremium ? (
            <View style={{ height: scale(160), alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background + '88', borderRadius: 16 }}>
              <MaterialIcons name="insights" size={32} color={theme.colors.primary} style={{ marginBottom: 12 }} />
              <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.textPrimary }}>Premium Analytics</Text>
              <Text style={{ fontSize: 11, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 4, paddingHorizontal: 30 }}>Unlock your income vs. spending comparison for the last 6 months.</Text>
              <TouchableOpacity
                onPress={() => navigation.navigate('MainApp', { screen: 'Dashboard', params: { showPremium: true } })}
                style={{ marginTop: 14, backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 }}
              >
                <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>Upgrade to Premium</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: scale(160), paddingBottom: moderateScale(10) }}>
              {monthlyTotals.map(function(m, i) {
                var spentPct = maxTrendValue > 0 ? (m.spent / maxTrendValue) : 0;
                var incomePct = maxTrendValue > 0 ? (m.income / maxTrendValue) : 0;
                var spentHeight = Math.max(scale(6), Math.round(spentPct * scale(120)));
                var incomeHeight = Math.max(scale(6), Math.round(incomePct * scale(120)));
                var isCurrent = m.key === curMonth;
                return (
                  <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', width: '100%', marginBottom: moderateScale(10) }}>
                      <View style={{ width: '25%', height: incomeHeight, backgroundColor: '#10B981', borderTopLeftRadius: scale(4), borderTopRightRadius: scale(4), marginRight: 2, shadowColor: '#10B981', shadowOpacity: 0.3, shadowRadius: 3, elevation: 2 }} />
                      <View style={{ width: '25%', height: spentHeight, backgroundColor: '#EF4444', borderTopLeftRadius: scale(4), borderTopRightRadius: scale(4), shadowColor: '#EF4444', shadowOpacity: 0.3, shadowRadius: 3, elevation: 2 }} />
                    </View>
                    <Text style={{ fontSize: normalize(10), fontWeight: isCurrent ? 'bold' : '600', color: isCurrent ? theme.colors.primary : theme.colors.textSecondary }}>{m.label}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>


        {/* ── Monthly Financial Audit ── */}
        <View style={{ backgroundColor: theme.colors.card, borderRadius: scale(24), padding: moderateScale(20), marginBottom: moderateScale(20), shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: theme.colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(20) }}>
            <View style={{ width: scale(36), height: scale(36), borderRadius: scale(10), backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginRight: moderateScale(12) }}>
              <MaterialIcons name='analytics' size={scale(20)} color='#10B981' />
            </View>
            <Text style={{ fontSize: normalize(16), fontWeight: 'bold', color: theme.colors.textPrimary }}>Monthly Financial Audit</Text>
          </View>

          <View>
            {monthlyTotals.slice().reverse().map(function(m, i) {
              var isCurrent = m.key === curMonth;

              // UX: In basic mode, only show the current month in the list.
              if (!isPremium && !isCurrent) return null;

              var savings = m.income - m.spent;
              return (
                <View key={i} style={{
                  padding: moderateScale(16),
                  borderRadius: scale(18),
                  backgroundColor: isCurrent ? (theme.isDark ? 'rgba(16, 185, 129, 0.04)' : '#F0FDF4') : theme.colors.background,
                  borderWidth: 1,
                  borderColor: isCurrent ? theme.colors.primary + '33' : theme.colors.border,
                  marginBottom: moderateScale(12)
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: moderateScale(12) }}>
                    <Text style={{ fontSize: normalize(15), fontWeight: 'bold', color: isCurrent ? theme.colors.primary : theme.colors.textPrimary }}>{m.label + (isCurrent ? ' (Current)' : '')}</Text>
                    <View style={{ backgroundColor: savings >= 0 ? 'rgba(16, 185, 129, 0.1)' : 'rgba(239, 68, 68, 0.1)', paddingHorizontal: scale(10), paddingVertical: scale(4), borderRadius: scale(8) }}>
                      <Text style={{ fontSize: normalize(12), fontWeight: 'bold', color: savings >= 0 ? '#10B981' : theme.colors.error }}>{(savings >= 0 ? '+' : '') + maskAmount(savings)}</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', gap: moderateScale(12) }}>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: normalize(10), color: theme.colors.textSecondary, marginBottom: 4, fontWeight: '800', letterSpacing: 0.5 }}>INCOME</Text>
                      <Text style={{ fontSize: normalize(14), fontWeight: '700', color: '#16A34A' }}>{maskAmount(m.income)}</Text>
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: normalize(10), color: theme.colors.textSecondary, marginBottom: 4, fontWeight: '800', letterSpacing: 0.5 }}>SPENT</Text>
                      <Text style={{ fontSize: normalize(14), fontWeight: '700', color: '#DC2626' }}>-{maskAmount(m.spent)}</Text>
                    </View>
                    <View style={{ flex: 1, alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: normalize(10), color: theme.colors.textSecondary, marginBottom: 4, fontWeight: '800', letterSpacing: 0.5 }}>SAVED</Text>
                      <Text style={{ fontSize: normalize(14), fontWeight: '700', color: '#2563EB' }}>{maskAmount(Math.max(0, savings))}</Text>
                    </View>
                  </View>
                </View>
              );
            })}

            {!isPremium && (
               <TouchableOpacity
                 onPress={() => navigation.navigate('MainApp', { screen: 'Dashboard', params: { showPremium: true } })}
                 style={{ padding: 16, backgroundColor: theme.colors.background, borderRadius: 18, borderStyle: 'dashed', borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' }}
               >
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 12, fontWeight: '600' }}>View Audit History in Premium</Text>
               </TouchableOpacity>
            )}
          </View>
        </View>
      </ScrollView>

      <Modal key="stats-info-modal" visible={infoModalConfig.visible} animationType="fade" transparent={true} onRequestClose={() => setInfoModalConfig({ ...infoModalConfig, visible: false })}>
        <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: moderateScale(20) }}>
          <View style={{ backgroundColor: theme.colors.card, borderRadius: scale(24), padding: moderateScale(24), shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.2, shadowRadius: 20, elevation: 10 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(20) }}>
              <Text style={{ fontSize: normalize(18), fontWeight: 'bold', color: theme.colors.textPrimary }}>{infoModalConfig.title}</Text>
              <TouchableOpacity onPress={() => setInfoModalConfig({ ...infoModalConfig, visible: false })} style={{ padding: moderateScale(4), backgroundColor: theme.colors.background, borderRadius: scale(12) }}>
                <MaterialIcons name="close" size={scale(20)} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
            {infoModalConfig.content}
            <TouchableOpacity onPress={() => setInfoModalConfig({ ...infoModalConfig, visible: false })} style={{ marginTop: moderateScale(24), backgroundColor: theme.colors.primary, borderRadius: scale(12), padding: moderateScale(16), alignItems: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: normalize(15) }}>Got it!</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

    </View>
  );
};

export default StatisticsScreen;

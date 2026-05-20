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

  var oneTimeQuery = useQuery('one_time_expenses');
  var userOneTime = (oneTimeQuery.data || []).filter(function(o) { return o.user_id === userId; });

  var historyQuery = useQuery('expense_history');
  var userHistory = (historyQuery.data || []).filter(function(h) { return h.user_id === userId; });

  var curMonth = getCurrentMonthStr();

  var envelopes = useMemo(function() {
    if (userSettings && userSettings.envelopes) {
      var raw = typeof userSettings.envelopes === 'string' ? JSON.parse(userSettings.envelopes) : userSettings.envelopes;
      return Array.isArray(raw) ? raw : [];
    }
    return [];
  }, [userSettings]);

  var accounts = useMemo(function() {
    if (userSettings && userSettings.accounts) {
      var raw = typeof userSettings.accounts === 'string' ? JSON.parse(userSettings.accounts) : userSettings.accounts;
      return Array.isArray(raw) ? raw : [];
    }
    return [];
  }, [userSettings]);

  var totalStartingBalances = useMemo(function() {
    return accounts.reduce(function(sum, acc) { return sum + (parseFloat(acc.starting_balance) || 0); }, 0);
  }, [accounts]);

  var totalMonthlyIncome = useMemo(function() {
    var base = 0;
    if (userSettings) {
      if (userSettings.income_sources) {
        var src = typeof userSettings.income_sources === 'string' ? JSON.parse(userSettings.income_sources) : userSettings.income_sources;
        base = (Array.isArray(src) ? src : []).reduce(function(s, x) { return s + (parseFloat(x.amount) || 0); }, 0);
      } else {
        base = parseFloat(userSettings.monthly_salary) || 0;
      }
    }
    
    var extra = 0;
    userHistory.forEach(function(h) {
      if (h.expense_type === 'Income' && getMonthStr(h.date) === curMonth) {
        extra += (parseFloat(h.amount) || 0);
      }
    });

    return base + extra;
  }, [userSettings, userHistory, curMonth]);

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

  var totalMonthSpent = envelopeSpending.reduce(function(s, e) { return s + e.spent; }, 0);
  var maxEnvSpent = envelopeSpending.length > 0 ? envelopeSpending[0].spent : 1;
  var savings = totalMonthlyIncome - totalMonthSpent;
  var savingsRate = totalMonthlyIncome > 0 ? Math.round((savings / totalMonthlyIncome) * 100) : 0;
  var spendPct = totalMonthlyIncome > 0 ? Math.min(100, Math.round((totalMonthSpent / totalMonthlyIncome) * 100)) : 0;

  var [selectedEnvIndex, setSelectedEnvIndex] = useState(null);
  var [infoModalConfig, setInfoModalConfig] = useState({ visible: false, title: '', content: null });

  var handleIncomeInfo = function() {
    var base = 0;
    if (userSettings) {
      if (userSettings.income_sources) {
        var src = typeof userSettings.income_sources === 'string' ? JSON.parse(userSettings.income_sources) : userSettings.income_sources;
        base = (Array.isArray(src) ? src : []).reduce(function(s, x) { return s + (parseFloat(x.amount) || 0); }, 0);
      } else {
        base = parseFloat(userSettings.monthly_salary) || 0;
      }
    }
    var extra = 0;
    userHistory.forEach(function(h) {
      if (h.expense_type === 'Income' && getMonthStr(h.date) === curMonth) {
        extra += (parseFloat(h.amount) || 0);
      }
    });

    setInfoModalConfig({
      visible: true,
      title: 'Total Monthly Income',
      content: (
        <View>
          <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginBottom: 16, lineHeight: 20 }}>
            This is the total income earned or added this month. 'Expected Income' is your baseline setup, while 'Extra Income' includes manual wallet top-ups and any external income you log. (Note: Initial wallet seed balances are considered starting capital, not income).
          </Text>
          <View style={{ backgroundColor: theme.colors.background, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
              <Text style={{ fontSize: 14, color: theme.colors.textPrimary, fontWeight: '600' }}>Expected Income</Text>
              <Text style={{ fontSize: 14, color: theme.colors.textPrimary, fontWeight: 'bold' }}>{formatCurrency(base)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 14, color: theme.colors.textPrimary, fontWeight: '600' }}>Extra Income</Text>
              <Text style={{ fontSize: 14, color: theme.colors.textPrimary, fontWeight: 'bold' }}>{formatCurrency(extra)}</Text>
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
          if (h.expense_type === 'Recurring') {
            spent += parseFloat(h.amount) || 0;
          } else if (h.expense_type === 'Income') {
            income += parseFloat(h.amount) || 0;
          }
        }
      });
      
      // 3. Add expected base recurring income configured in settings (only for current month)
      if (m.key === curMonth) {
        var base = 0;
        if (userSettings) {
          if (userSettings.income_sources) {
            var src = typeof userSettings.income_sources === 'string' ? JSON.parse(userSettings.income_sources) : userSettings.income_sources;
            base = (Array.isArray(src) ? src : []).reduce(function(s, x) { return s + (parseFloat(x.amount) || 0); }, 0);
          } else {
            base = parseFloat(userSettings.monthly_salary) || 0;
          }
        }
        income += base;
      }

      return { label: m.label, spent: spent, income: income, key: m.key };
    });
  }, [userOneTime, userHistory, userSettings, curMonth]);

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
      React.createElement(Text, { style: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold' } }, 'Statistics'),
      React.createElement(Text, { style: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 } }, 'Insights for ' + (MONTH_LABELS[new Date().getMonth()] || '') + ' ' + new Date().getFullYear())
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
          <Text style={{ fontSize: 17, fontWeight: 'bold', color: theme.colors.textPrimary }}>{formatCurrency(totalMonthlyIncome)}</Text>
          <Text style={{ fontSize: 11, color: '#92400E', marginTop: 2 }}>Income</Text>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.8} onPress={handleSpentInfo} style={{ flex: 1, backgroundColor: '#FEE2E2', borderRadius: 14, padding: 14, position: 'relative' }}>
          <View style={{ position: 'absolute', top: 8, right: 8 }}>
            <MaterialIcons name="info-outline" size={14} color="rgba(153, 27, 27, 0.5)" />
          </View>
          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <MaterialIcons name="shopping-cart" size={18} color="#DC2626" />
          </View>
          <Text style={{ fontSize: 17, fontWeight: 'bold', color: '#DC2626' }}>{formatCurrency(totalMonthSpent)}</Text>
          <Text style={{ fontSize: 11, color: '#991B1B', marginTop: 2 }}>Spent</Text>
        </TouchableOpacity>

        <TouchableOpacity activeOpacity={0.8} onPress={handleSavedInfo} style={{ flex: 1, backgroundColor: savings >= 0 ? '#DCFCE7' : '#FEE2E2', borderRadius: 14, padding: 14, position: 'relative' }}>
          <View style={{ position: 'absolute', top: 8, right: 8 }}>
            <MaterialIcons name="info-outline" size={14} color={savings >= 0 ? "rgba(20, 83, 45, 0.5)" : "rgba(153, 27, 27, 0.5)"} />
          </View>
          <View style={{ width: 32, height: 32, borderRadius: 8, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 8 }}>
            <MaterialIcons name="savings" size={18} color={savings >= 0 ? '#16A34A' : '#DC2626'} />
          </View>
          <Text style={{ fontSize: 17, fontWeight: 'bold', color: savings >= 0 ? '#16A34A' : '#DC2626' }}>{formatCurrency(Math.abs(savings))}</Text>
          <Text style={{ fontSize: 11, color: savings >= 0 ? '#14532D' : '#991B1B', marginTop: 2 }}>{savings >= 0 ? 'Saved' : 'Over budget'}</Text>
        </TouchableOpacity>
      </View>,

      // ── Savings rate card ─────────────────────────────────────────────────
      React.createElement(View, { style: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 18, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 } },
        React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 } },
          <TouchableOpacity onPress={() => setInfoModalConfig({
              visible: true,
              title: 'Budget Used',
              content: (
                <View>
                  <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginBottom: 12, lineHeight: 22 }}>
                    This calculates the percentage of your total monthly income that has already been spent.
                  </Text>
                  <View style={{ backgroundColor: 'rgba(245, 158, 11, 0.1)', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialIcons name="lightbulb" size={20} color="#F59E0B" style={{ marginRight: 10 }} />
                    <Text style={{ fontSize: 13, color: '#B45309', fontWeight: 'bold', flex: 1 }}>
                      Aim to keep this under 80% to ensure you have room for savings!
                    </Text>
                  </View>
                </View>
              )
            })} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ fontSize: 15, fontWeight: 'bold', color: theme.colors.textPrimary, marginRight: 6 }}>Budget Used</Text>
            <MaterialIcons name="info-outline" size={16} color={theme.colors.textSecondary} />
          </TouchableOpacity>,
          React.createElement(Text, { style: { fontSize: 20, fontWeight: 'bold', color: spendPct >= 90 ? '#DC2626' : theme.colors.primary } }, spendPct + '%')
        ),
        React.createElement(View, { style: { height: 10, backgroundColor: theme.colors.border, borderRadius: 5, overflow: 'hidden', marginBottom: 8 } },
          React.createElement(View, { style: { width: spendPct + '%', height: '100%', backgroundColor: spendPct >= 90 ? '#DC2626' : spendPct >= 70 ? '#F59E0B' : theme.colors.primary, borderRadius: 5 } })
        ),
        React.createElement(Text, { style: { fontSize: 12, color: theme.colors.textSecondary } },
          spendPct >= 90 ? '⚠️  You are near or over your budget!' :
          spendPct >= 70 ? '💡  You have used over 70% of your income.' :
          '✅  You are spending within your budget.'
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
                    React.createElement(Text, { numberOfLines: 1, style: { fontSize: 14, fontWeight: 'bold', color: theme.colors.textPrimary, marginTop: 2, textAlign: 'center', width: 95 } }, centerValue)
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
              <Text style={{ fontSize: 15, fontWeight: 'bold', color: theme.colors.textPrimary, marginRight: 6 }}>6-Month Trend</Text>
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

      // ── Money Inserted History ─────────────────────────────────────────────
      React.createElement(View, { style: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 18, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 } },
        React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 } },
          React.createElement(View, { style: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginRight: 10 } },
            React.createElement(MaterialIcons, { name: 'payments', size: 18, color: '#10B981' })
          ),
          React.createElement(Text, { style: { fontSize: 15, fontWeight: 'bold', color: theme.colors.textPrimary } }, 'Money Inserted per Month')
        ),
        React.createElement(View, null,
          monthlyTotals.slice().reverse().map(function(m, i) {
            var isCurrent = m.key === curMonth;
            return React.createElement(View, { key: i, style: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 12, borderBottomWidth: i < monthlyTotals.length - 1 ? 1 : 0, borderBottomColor: theme.colors.border } },
              React.createElement(Text, { style: { fontSize: 14, fontWeight: isCurrent ? 'bold' : '500', color: isCurrent ? theme.colors.primary : theme.colors.textPrimary } }, isCurrent ? 'This Month (' + m.label + ')' : m.label),
              React.createElement(Text, { style: { fontSize: 14, fontWeight: 'bold', color: '#10B981' } }, '+' + formatCurrency(m.income))
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

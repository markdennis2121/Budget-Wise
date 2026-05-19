import React, { useMemo, useState } from 'react';
import { View, Text, ScrollView, Platform, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'platform-hooks';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { formatCurrency, getCurrentMonthStr, getMonthStr } from '../utils/helpers';

const TAB_MENU_HEIGHT = Platform.OS === 'web' ? 56 : 49;
const WEB_TAB_MENU_PADDING = 90;
const MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

function getLast6Months() {
  var result = [];
  var now = new Date();
  for (var i = 5; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: MONTH_LABELS[d.getMonth()],
      key: d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1)
    });
  }
  return result;
}

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

  var curMonth = getCurrentMonthStr();

  var envelopes = useMemo(function() {
    if (userSettings && userSettings.envelopes) {
      var raw = typeof userSettings.envelopes === 'string' ? JSON.parse(userSettings.envelopes) : userSettings.envelopes;
      return Array.isArray(raw) ? raw : [];
    }
    return [];
  }, [userSettings]);

  var totalMonthlyIncome = useMemo(function() {
    if (!userSettings) return 0;
    if (userSettings.income_sources) {
      var src = typeof userSettings.income_sources === 'string' ? JSON.parse(userSettings.income_sources) : userSettings.income_sources;
      return (Array.isArray(src) ? src : []).reduce(function(s, x) { return s + (parseFloat(x.amount) || 0); }, 0);
    }
    return parseFloat(userSettings.monthly_salary) || 0;
  }, [userSettings]);

  // Current month spending by envelope
  var envelopeSpending = useMemo(function() {
    var map = {};
    envelopes.forEach(function(e) { map[e.id] = { name: e.name, spent: 0 }; });

    userRecurring.forEach(function(r) {
      if ((r.status === 'Paid' || r.status === 'Paid in Advance') && getMonthStr(r.due_date) === curMonth) {
        var k = r.category;
        if (!map[k]) map[k] = { name: k || 'Other', spent: 0 };
        map[k].spent += parseFloat(r.amount) || 0;
      }
    });
    userOneTime.forEach(function(o) {
      if (getMonthStr(o.date) === curMonth) {
        var k = o.category;
        if (!map[k]) map[k] = { name: k || 'Other', spent: 0 };
        map[k].spent += parseFloat(o.amount) || 0;
      }
    });

    return Object.values(map).filter(function(e) { return e.spent > 0; }).sort(function(a, b) { return b.spent - a.spent; });
  }, [userRecurring, userOneTime, envelopes, curMonth]);

  var totalMonthSpent = envelopeSpending.reduce(function(s, e) { return s + e.spent; }, 0);
  var maxEnvSpent = envelopeSpending.length > 0 ? envelopeSpending[0].spent : 1;
  var savings = totalMonthlyIncome - totalMonthSpent;
  var savingsRate = totalMonthlyIncome > 0 ? Math.round((savings / totalMonthlyIncome) * 100) : 0;
  var spendPct = totalMonthlyIncome > 0 ? Math.min(100, Math.round((totalMonthSpent / totalMonthlyIncome) * 100)) : 0;

  var [selectedEnvIndex, setSelectedEnvIndex] = useState(null);

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
        color: SEGMENT_COLORS[idx % SEGMENT_COLORS.length]
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
      userRecurring.forEach(function(r) {
        if ((r.status === 'Paid' || r.status === 'Paid in Advance') && getMonthStr(r.due_date) === m.key) {
          spent += parseFloat(r.amount) || 0;
        }
      });
      userOneTime.forEach(function(o) {
        if (getMonthStr(o.date) === m.key) {
          spent += parseFloat(o.amount) || 0;
        }
      });
      return { label: m.label, spent: spent, key: m.key };
    });
  }, [userRecurring, userOneTime]);

  var maxMonthSpent = Math.max.apply(null, monthlyTotals.map(function(m) { return m.spent; }).concat([1]));

  return React.createElement(View, { style: { flex: 1, backgroundColor: theme.colors.background } },

    // Header
    React.createElement(View, { style: { backgroundColor: theme.colors.primary, paddingTop: insets.top + 16, paddingBottom: 28, paddingHorizontal: 20 } },
      React.createElement(Text, { style: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold' } }, 'Statistics'),
      React.createElement(Text, { style: { color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 2 } }, 'Your money overview for this month')
    ),

    React.createElement(ScrollView, { style: { flex: 1 }, contentContainerStyle: { paddingTop: 20, paddingHorizontal: 16, paddingBottom: scrollBottomPadding } },

      // ── Summary row ──────────────────────────────────────────────────────
      React.createElement(View, { style: { flexDirection: 'row', marginBottom: 16, gap: 8 } },
        // Income
        React.createElement(View, { style: { flex: 1, backgroundColor: '#FFEDD5', borderRadius: 14, padding: 14 } },
          React.createElement(View, { style: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 8 } },
            React.createElement(MaterialIcons, { name: 'account-balance-wallet', size: 18, color: theme.colors.primary })
          ),
          React.createElement(Text, { style: { fontSize: 17, fontWeight: 'bold', color: theme.colors.textPrimary } }, formatCurrency(totalMonthlyIncome)),
          React.createElement(Text, { style: { fontSize: 11, color: '#92400E', marginTop: 2 } }, 'Income')
        ),
        // Spent
        React.createElement(View, { style: { flex: 1, backgroundColor: '#FEE2E2', borderRadius: 14, padding: 14 } },
          React.createElement(View, { style: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 8 } },
            React.createElement(MaterialIcons, { name: 'shopping-cart', size: 18, color: '#DC2626' })
          ),
          React.createElement(Text, { style: { fontSize: 17, fontWeight: 'bold', color: '#DC2626' } }, formatCurrency(totalMonthSpent)),
          React.createElement(Text, { style: { fontSize: 11, color: '#991B1B', marginTop: 2 } }, 'Spent')
        ),
        // Saved
        React.createElement(View, { style: { flex: 1, backgroundColor: savings >= 0 ? '#DCFCE7' : '#FEE2E2', borderRadius: 14, padding: 14 } },
          React.createElement(View, { style: { width: 32, height: 32, borderRadius: 8, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center', marginBottom: 8 } },
            React.createElement(MaterialIcons, { name: 'savings', size: 18, color: savings >= 0 ? '#16A34A' : '#DC2626' })
          ),
          React.createElement(Text, { style: { fontSize: 17, fontWeight: 'bold', color: savings >= 0 ? '#16A34A' : '#DC2626' } }, formatCurrency(Math.abs(savings))),
          React.createElement(Text, { style: { fontSize: 11, color: savings >= 0 ? '#14532D' : '#991B1B', marginTop: 2 } }, savings >= 0 ? 'Saved' : 'Over budget')
        )
      ),

      // ── Savings rate card ─────────────────────────────────────────────────
      React.createElement(View, { style: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 18, marginBottom: 16, elevation: 2, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4 } },
        React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 } },
          React.createElement(Text, { style: { fontSize: 15, fontWeight: 'bold', color: theme.colors.textPrimary } }, 'Budget Used'),
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
        React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 } },
          React.createElement(View, { style: { width: 34, height: 34, borderRadius: 9, backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center', marginRight: 10 } },
            React.createElement(MaterialIcons, { name: 'bar-chart', size: 18, color: theme.colors.primary })
          ),
          React.createElement(Text, { style: { fontSize: 15, fontWeight: 'bold', color: theme.colors.textPrimary } }, '6-Month Trend')
        ),

        // Chart area
        React.createElement(View, { style: { flexDirection: 'row', alignItems: 'flex-end', height: 140 } },
          monthlyTotals.map(function(m, i) {
            var barPct = maxMonthSpent > 0 ? (m.spent / maxMonthSpent) : 0;
            var barHeight = Math.max(4, Math.round(barPct * 110));
            var isCurrent = m.key === curMonth;
            return React.createElement(View, { key: i, style: { flex: 1, alignItems: 'center', justifyContent: 'flex-end' } },
              m.spent > 0 ? React.createElement(Text, { style: { fontSize: 9, color: theme.colors.textSecondary, marginBottom: 3, textAlign: 'center' } }, fmt(m.spent)) : null,
              React.createElement(View, { style: { width: '70%', height: barHeight, backgroundColor: isCurrent ? theme.colors.primary : theme.colors.border, borderRadius: 4, marginBottom: 6 } }),
              React.createElement(Text, { style: { fontSize: 10, fontWeight: isCurrent ? 'bold' : '400', color: isCurrent ? theme.colors.primary : theme.colors.textSecondary } }, m.label)
            );
          })
        )
      )
    )
  );
};

export default StatisticsScreen;

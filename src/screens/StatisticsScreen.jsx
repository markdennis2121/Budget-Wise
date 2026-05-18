import React, { useMemo } from 'react';
import { View, Text, ScrollView, Platform } from 'react-native';
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

      // ── Top Envelopes ─────────────────────────────────────────────────────
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
          : envelopeSpending.map(function(env, i) {
              var pct = maxEnvSpent > 0 ? Math.round((env.spent / maxEnvSpent) * 100) : 0;
              return React.createElement(View, { key: i, style: { marginBottom: i < envelopeSpending.length - 1 ? 14 : 0 } },
                React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 } },
                  React.createElement(Text, { style: { fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary } }, env.name),
                  React.createElement(Text, { style: { fontSize: 13, fontWeight: 'bold', color: theme.colors.primary } }, formatCurrency(env.spent))
                ),
                React.createElement(View, { style: { height: 8, backgroundColor: theme.colors.border, borderRadius: 4, overflow: 'hidden' } },
                  React.createElement(View, { style: { width: pct + '%', height: '100%', backgroundColor: theme.colors.primary, borderRadius: 4 } })
                )
              );
            })
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

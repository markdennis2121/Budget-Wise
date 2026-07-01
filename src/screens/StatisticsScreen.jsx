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
  const navigation = props.navigation;
  const themeCtx = useTheme();
  const theme = themeCtx.theme;
  const userCtx = useUser();
  const userId = userCtx.currentUser ? userCtx.currentUser.id : '';
  const insets = useSafeAreaInsets();
  const scrollBottomPadding = Platform.OS === 'web' ? WEB_TAB_MENU_PADDING : (TAB_MENU_HEIGHT + insets.bottom + 16);

  const settingsQuery = useQuery('user_settings');
  const allSettings = settingsQuery.data || [];
  const userSettings = allSettings.find(function(s) { return s.user_id === userId; });
  const isPremium = userSettings?.is_premium || false;

  const recurringQuery = useQuery('recurring_expenses');
  const userRecurring = (recurringQuery.data || []).filter(function(r) { return r.user_id === userId; });

  const historyQuery = useQuery('expense_history');
  const userHistory = useMemo(function() {
    return (historyQuery.data || []).filter(function(h) { return h.user_id === userId; });
  }, [historyQuery.data, userId]);

  const userOneTime = useMemo(function() {
    return userHistory.filter(function(h) { return h.expense_type === 'One-Time'; });
  }, [userHistory]);

  const curMonth = getCurrentMonthStr();

  const envelopes = useMemo(function() {
    return parseUserEnvelopes(userSettings);
  }, [userSettings]);

  const allAccounts = useMemo(function() {
    return buildAccountsWithBalances({
      userSettings: userSettings,
      userHistory: userHistory
    });
  }, [userSettings, userHistory]);

  const accounts = useMemo(function() {
    return allAccounts.filter(function(a) { return !a.isArchived; });
  }, [allAccounts]);

  const incomeSources = useMemo(function() {
    if (!userSettings) return [];
    if (userSettings.income_sources) {
      const raw = typeof userSettings.income_sources === 'string' ? JSON.parse(userSettings.income_sources) : userSettings.income_sources;
      return Array.isArray(raw) ? raw : [];
    }
    return [{ id: 'main-salary', name: 'Main Salary', amount: parseFloat(userSettings.monthly_salary) || 0 }];
  }, [userSettings]);

  const isSimpleMode = userSettings && userSettings.budgeting_style === 'simple';

  const totalMonthlyIncome = useMemo(function() {
    return userHistory.reduce(function(s, h) {
      if (getMonthStr(h.date) !== curMonth) return s;
      const amt = parseFloat(h.amount) || 0;
      if (h.expense_type === 'Income') return s + amt;
      if (h.expense_type === 'Adjustment') {
        if (h.category === 'Income') return s + amt;
        if (h.category === 'Adjustment') return s - amt;
      }
      return s;
    }, 0);
  }, [userHistory, curMonth]);

  const incomeHistory = useMemo(function() {
    return userHistory.filter(function(h) {
      return (h.expense_type === 'Income' || h.expense_type === 'Adjustment') &&
             getMonthStr(h.date) === curMonth;
    });
  }, [userHistory, curMonth]);

  const incomeReceivedBySource = useMemo(function() {
    const received = {};
    incomeHistory.forEach(function(h) {
      const key = h.category || 'unlinked';
      received[key] = (received[key] || 0) + (parseFloat(h.amount) || 0);
    });

    return Object.keys(received).map(function(key) {
      const src = incomeSources.find(function(s) { return s.id === key; });
      let name = 'Extra Income';
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

  const recurringByName = useMemo(function () {
    const lookup = {};
    userRecurring.forEach(function (r) {
      if (r && r.name) lookup[r.name] = r;
    });
    return lookup;
  }, [userRecurring]);

  const envelopeSpending = useMemo(function () {
    return buildEnvelopeSpendingForMonth({
      envelopes: envelopes,
      curMonth: curMonth,
      oneTimeExpenses: userOneTime,
      historyEntries: userHistory,
      recurringByName: recurringByName
    });
  }, [userHistory, userOneTime, envelopes, curMonth, recurringByName]);

  const totalMonthSpent = useMemo(function() {
    let total = 0;
    userHistory.forEach(function(h) {
      if (getMonthStr(h.date) === curMonth && (h.expense_type === 'One-Time' || h.expense_type === 'Recurring')) {
        total += (parseFloat(h.amount) || 0);
      }
    });
    return total;
  }, [userHistory, curMonth]);

  const savings = totalMonthlyIncome - totalMonthSpent;

  const dailyAvg = useMemo(function() {
    const day = new Date().getDate();
    return totalMonthSpent / (day || 1);
  }, [totalMonthSpent]);

  // Privacy State
  const [balancesVisible, setBalancesVisible] = useState(function() {
    try {
      const saved = localStorage.getItem('penny_balances_visible');
      return saved !== null ? JSON.parse(saved) : true;
    } catch (e) { return true; }
  });

  useEffect(function() {
    const syncVisibility = function() {
      try {
        const saved = localStorage.getItem('penny_balances_visible');
        const val = saved !== null ? JSON.parse(saved) : true;
        setBalancesVisible(val);
      } catch (e) {}
    };
    const unsubscribe = navigation ? navigation.addListener('focus', syncVisibility) : null;
    return unsubscribe;
  }, [navigation]);

  const toggleBalances = function() {
    triggerImpactHaptic('Medium');
    const newVal = !balancesVisible;
    setBalancesVisible(newVal);
    try { localStorage.setItem('penny_balances_visible', JSON.stringify(newVal)); } catch (e) {}
  };

  const maskAmount = function(amt) {
    return balancesVisible ? formatCurrency(amt) : '••••••';
  };

  const [selectedEnvIndex, setSelectedEnvIndex] = useState(null);
  const [infoModalConfig, setInfoModalConfig] = useState({ visible: false, title: '', content: null });

  const isStealthDark = theme.isDark && theme.colors.primary === '#111827';
  const safePrimary = isStealthDark ? '#E5E7EB' : theme.colors.primary;

  const SEGMENT_COLORS = [
    '#FF6B6B', '#4D96FF', '#6BCB77', '#FFD93D', '#9B5DE5', '#F15BB5', '#00F5D4', '#FF9F1C',
  ];

  const spendingByAccount = useMemo(function() {
    const spent = {};
    userHistory.forEach(function(h) {
      if (getMonthStr(h.date) === curMonth && (h.expense_type === 'One-Time' || h.expense_type === 'Recurring')) {
        const accountId = h.account_id || 'unlinked';
        spent[accountId] = (spent[accountId] || 0) + (parseFloat(h.amount) || 0);
      }
    });
    return Object.keys(spent).map(function(accountId) {
      const acc = accounts.find(function(a) { return a.id === accountId; });
      return {
        id: accountId,
        name: acc ? acc.name : (accountId === 'unlinked' ? 'Unlinked Cash' : 'Unknown'),
        spent: spent[accountId],
        color: acc ? acc.color : '#9CA3AF'
      };
    }).sort(function(a, b) { return b.spent - a.spent; });
  }, [accounts, userHistory, curMonth]);

  const coloredSpending = useMemo(function() {
    if (isSimpleMode) {
      return spendingByAccount.map(function(acc, idx) {
        return { ...acc, color: acc.color || SEGMENT_COLORS[idx % SEGMENT_COLORS.length] };
      });
    }
    return envelopeSpending.map(function(env, idx) {
      return { ...env, color: env.isOrphan ? '#9CA3AF' : SEGMENT_COLORS[idx % SEGMENT_COLORS.length] };
    });
  }, [envelopeSpending, spendingByAccount, isSimpleMode]);

  const maxSpentItem = useMemo(function() {
      if (coloredSpending.length === 0) return 1;
      const vals = coloredSpending.map(s => s.spent);
      return Math.max.apply(null, vals.concat([1]));
  }, [coloredSpending]);

  const svgSegments = useMemo(function() {
    const radius = 35;
    const circ = 2 * Math.PI * radius;
    let accumulatedPercent = 0;

    return coloredSpending.map(function(env, idx) {
      const pct = totalMonthSpent > 0 ? (env.spent / totalMonthSpent) : 0;
      const strokeDashoffset = circ - (pct * circ);
      const angle = accumulatedPercent * 360 - 90;
      accumulatedPercent += pct;
      const isSelected = selectedEnvIndex === idx;

      return React.createElement('circle', {
        key: idx, cx: 50, cy: 50, r: radius,
        fill: 'transparent', stroke: env.color,
        strokeWidth: isSelected ? 12 : 10,
        strokeDasharray: circ, strokeDashoffset: strokeDashoffset,
        transform: 'rotate(' + angle + ' 50 50)',
        strokeLinecap: 'round',
        style: { cursor: 'pointer', transition: 'all 0.3s ease', opacity: selectedEnvIndex === null || isSelected ? 1 : 0.4 },
        onClick: function() { setSelectedEnvIndex(selectedEnvIndex === idx ? null : idx); }
      });
    });
  }, [coloredSpending, selectedEnvIndex, totalMonthSpent]);

  const centerLabel = selectedEnvIndex !== null ? coloredSpending[selectedEnvIndex].name : (isSimpleMode ? 'Total Expenses' : 'Total Spent');
  const centerValue = selectedEnvIndex !== null ? maskAmount(coloredSpending[selectedEnvIndex].spent) : maskAmount(totalMonthSpent);

  // 6-month trend
  const last6Months = getLast6Months();
  const monthlyTotals = useMemo(function() {
    return last6Months.map(function(m) {
      let spent = 0;
      let income = 0;
      userHistory.forEach(function(h) {
        if (getMonthStr(h.date) === m.key) {
          const amt = parseFloat(h.amount) || 0;
          if (h.expense_type === 'Recurring' || h.expense_type === 'One-Time') { spent += amt; }
          else if (h.expense_type === 'Income') { income += amt; }
          else if (h.expense_type === 'Adjustment') {
            if (h.category === 'Income') income += amt;
            if (h.category === 'Adjustment') income -= amt;
          }
        }
      });
      return { label: m.label, spent: spent, income: income, key: m.key };
    });
  }, [userHistory]);

  const maxTrendValue = Math.max.apply(null, monthlyTotals.map(function(m) { return Math.max(m.spent, m.income); }).concat([1]));

  const netWorthTrend = useMemo(function() {
    const currentNetWorth = accounts.reduce(function(s, a) { return s + (parseFloat(a.balance) || 0); }, 0);
    const trend = [];
    let runningNetWorth = currentNetWorth;
    for (let i = monthlyTotals.length - 1; i >= 0; i--) {
      const m = monthlyTotals[i];
      trend.unshift({ label: m.label, value: runningNetWorth, key: m.key });
      runningNetWorth -= ((parseFloat(m.income) || 0) - (parseFloat(m.spent) || 0));
    }
    return trend;
  }, [accounts, monthlyTotals]);

  const nwVals = netWorthTrend.map(t => t.value);
  const chartMax = Math.max.apply(null, nwVals.concat([1])) * 1.15;
  const chartMin = Math.max(0, Math.min.apply(null, nwVals.concat([0])) * 0.85);

  const financialPersona = useMemo(function() {
    if (userHistory.length < 5) return { name: 'The Newcomer', icon: 'face', desc: 'Log more to reveal your style.', color: '#94A3B8' };
    let weekendSpend = 0, totalSpendCount = 0;
    userHistory.forEach(h => {
      if (h.expense_type === 'One-Time' || h.expense_type === 'Recurring') {
        totalSpendCount++;
        const day = new Date(h.date).getDay();
        if (day === 0 || day === 5 || day === 6) weekendSpend++;
      }
    });
    const paidEarly = userRecurring.filter(r => r.status === 'Paid' || r.status === 'Paid in Advance').length;
    if (userRecurring.length > 0 && (paidEarly / userRecurring.length) > 0.8) return { name: 'The Bill Ninja', icon: 'visibility-off', desc: 'You strike down bills before they arrive.', color: '#3B82F6' };
    if (totalSpendCount > 0 && (weekendSpend / totalSpendCount) > 0.6) return { name: 'Weekend Warrior', icon: 'celebration', desc: 'Your budget goes to war on weekends.', color: '#F59E0B' };
    if (totalMonthlyIncome > 0 && (savings / totalMonthlyIncome) > 0.25) return { name: 'The Master Saver', icon: 'account-balance', desc: 'Your future self is already thanking you.', color: '#10B981' };
    return { name: 'The Consistent One', icon: 'insights', desc: 'Surgical precision and daily discipline.', color: '#8B5CF6' };
  }, [userHistory, userRecurring, savings, totalMonthlyIncome]);

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Header */}
      <View style={{ backgroundColor: theme.colors.primary, paddingTop: insets.top + 16, paddingBottom: 28, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ ...theme.typography.h2, color: '#FFFFFF' }}>Analytics</Text>
            <Text style={{ ...theme.typography.bodySmall, color: 'rgba(255,255,255,0.75)', marginTop: 2 }}>{MONTH_LABELS[new Date().getMonth()]} {new Date().getFullYear()} Insight</Text>
          </View>
          <TouchableOpacity onPress={toggleBalances} style={{ width: scale(44), height: scale(44), borderRadius: scale(22), backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
            <MaterialIcons name={balancesVisible ? 'visibility' : 'visibility-off'} size={scale(22)} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 20, paddingHorizontal: 16, paddingBottom: scrollBottomPadding }}>

        {/* ── Monthly Flow Hero ── */}
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: theme.colors.border }}>
           <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                 <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: safePrimary + '15', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                    <MaterialIcons name="analytics" size={18} color={safePrimary} />
                 </View>
                 <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.textPrimary }}>Cash Flow Audit</Text>
              </View>
              <View style={{ backgroundColor: savings >= 0 ? '#DCFCE7' : '#FEE2E2', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                 <Text style={{ fontSize: 11, fontWeight: 'bold', color: savings >= 0 ? '#16A34A' : '#DC2626' }}>{savings >= 0 ? 'SURPLUS' : 'DEFICIT'}</Text>
              </View>
           </View>

           <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
              <View>
                 <Text style={{ fontSize: 11, color: theme.colors.textSecondary, fontWeight: '800', marginBottom: 4 }}>MONTHLY SAVINGS</Text>
                 <Text style={{ fontSize: 28, fontWeight: '900', color: savings >= 0 ? theme.colors.textPrimary : '#DC2626' }}>{maskAmount(savings)}</Text>
              </View>
              <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: financialPersona.color + '15', alignItems: 'center', justifyContent: 'center' }}>
                 <MaterialIcons name={financialPersona.icon} size={28} color={financialPersona.color} />
              </View>
           </View>

           <View style={{ flexDirection: 'row', gap: 10, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 20 }}>
              <View style={{ flex: 1 }}>
                 <Text style={{ fontSize: 10, color: theme.colors.textSecondary, fontWeight: '800', marginBottom: 2 }}>INCOME</Text>
                 <Text style={{ fontSize: 15, fontWeight: '800', color: '#16A34A' }}>{maskAmount(totalMonthlyIncome)}</Text>
              </View>
              <View style={{ flex: 1 }}>
                 <Text style={{ fontSize: 10, color: theme.colors.textSecondary, fontWeight: '800', marginBottom: 2 }}>EXPENSES</Text>
                 <Text style={{ fontSize: 15, fontWeight: '800', color: '#EF4444' }}>{maskAmount(totalMonthSpent)}</Text>
              </View>
              {!isSimpleMode && (
                 <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 10, color: theme.colors.textSecondary, fontWeight: '800', marginBottom: 2 }}>DAILY PACE</Text>
                    <Text style={{ fontSize: 15, fontWeight: '800', color: theme.colors.primary }}>{maskAmount(dailyAvg)}</Text>
                 </View>
              )}
           </View>
        </View>

        {/* ── Asset Growth Trend ── */}
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: theme.colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: safePrimary + '15', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <MaterialIcons name='show-chart' size={20} color={safePrimary} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.textPrimary }}>Net Worth Trend</Text>
          </View>

          <View style={{ height: scale(160), width: '100%', marginBottom: 15 }}>
            {!isPremium ? (
               <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background + 'CC', borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: theme.colors.border }}>
                  <MaterialIcons name="lock" size={28} color={safePrimary} style={{ marginBottom: 10 }} />
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.textPrimary }}>Premium Analysis</Text>
                  <TouchableOpacity onPress={() => navigation.navigate('MainApp', { screen: 'Dashboard', params: { showPremium: true } })} style={{ marginTop: 10, backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 }} >
                    <Text style={{ color: '#FFFFFF', fontSize: 12, fontWeight: 'bold' }}>Unlock Line Charts</Text>
                  </TouchableOpacity>
               </View>
            ) : netWorthTrend.length > 0 ? (
              <svg viewBox="0 0 300 120" style={{ width: '100%', height: '100%', overflow: 'visible' }}>
                <defs><linearGradient id="areaGradient" x1="0" y1="0" x2="0" y2="1"><stop offset="0%" stopColor={safePrimary} stopOpacity="0.3" /><stop offset="100%" stopColor={safePrimary} stopOpacity="0" /></linearGradient></defs>
                <line x1="0" y1="0" x2="300" y2="0" stroke={theme.colors.border} strokeWidth="0.5" strokeDasharray="4 4" />
                <line x1="0" y1="60" x2="300" y2="60" stroke={theme.colors.border} strokeWidth="0.5" strokeDasharray="4 4" />
                <line x1="0" y1="120" x2="300" y2="120" stroke={theme.colors.border} strokeWidth="1" />
                {(() => {
                  const points = netWorthTrend.map((t, i) => {
                    const x = netWorthTrend.length > 1 ? (i / (netWorthTrend.length - 1)) * 300 : 150;
                    const y = (chartMax - chartMin) !== 0 ? 120 - ((t.value - chartMin) / (chartMax - chartMin)) * 120 : 60;
                    return { x: isNaN(x) ? 0 : x, y: isNaN(y) ? 60 : y };
                  });
                  if (points.length < 1) return null;
                  let pathData = `M ${points[0].x} ${points[0].y}`;
                  for (let i = 0; i < points.length - 1; i++) {
                    const p0 = points[i], p1 = points[i+1], cp1x = p0.x + (p1.x - p0.x) / 2;
                    pathData += ` C ${cp1x} ${p0.y}, ${cp1x} ${p1.y}, ${p1.x} ${p1.y}`;
                  }
                  return <><path d={pathData + ` L ${points[points.length-1].x} 120 L ${points[0].x} 120 Z`} fill="url(#areaGradient)" /><path d={pathData} fill="transparent" stroke={safePrimary} strokeWidth="3" strokeLinecap="round" />{points.map((p, i) => <circle key={i} cx={p.x} cy={p.y} r="4" fill={theme.colors.card} stroke={safePrimary} strokeWidth="2" />)}</>;
                })()}
              </svg>
            ) : <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}><Text style={{ color: theme.colors.textSecondary }}>Insufficient history</Text></View>}
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
            {netWorthTrend.map((t, i) => <Text key={i} style={{ fontSize: 9, fontWeight: 'bold', color: i === netWorthTrend.length-1 ? safePrimary : theme.colors.textSecondary }}>{t.label}</Text>)}
          </View>

          <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: 16 }} />
          <View>
            <Text style={{ fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600' }}>Current Liquid Worth</Text>
            <Text style={{ fontSize: 18, fontWeight: '900', color: theme.colors.textPrimary, marginTop: 2 }}>{maskAmount(netWorthTrend.length > 0 ? netWorthTrend[netWorthTrend.length-1].value : 0)}</Text>
          </View>
        </View>

        {/* ── Spending IQ ── */}
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: theme.colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <MaterialIcons name='pie-chart' size={20} color={theme.colors.primary} />
            </View>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.textPrimary }}>{isSimpleMode ? 'Expenses by Wallet' : 'Spending by Envelope'}</Text>
          </View>

          {coloredSpending.length === 0 ? (
            <View style={{ alignItems: 'center', paddingVertical: 30 }}>
              <MaterialIcons name="inbox" size={40} color={theme.colors.border} />
              <Text style={{ color: theme.colors.textSecondary, marginTop: 10, fontSize: 13 }}>No spending records.</Text>
            </View>
          ) : (
            <View>
                <View style={{ alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                  <View style={{ alignItems: 'center', justifyContent: 'center', width: 180, height: 180 }}>
                    <View style={{ position: 'absolute', width: 180, height: 180 }}><svg viewBox="0 0 100 100">{svgSegments}</svg></View>
                    <TouchableOpacity onPress={() => setSelectedEnvIndex(null)} style={{ width: 110, height: 110, borderRadius: 55, backgroundColor: theme.colors.card, alignItems: 'center', justifyContent: 'center', elevation: 4, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4, borderWidth: 1, borderColor: theme.colors.border }}>
                      <Text numberOfLines={1} style={{ fontSize: 9, color: theme.colors.textSecondary, textTransform: 'uppercase', fontWeight: 'bold', textAlign: 'center', width: 80 }}>{centerLabel}</Text>
                      <Text numberOfLines={1} style={{ fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary, marginTop: 2, textAlign: 'center', width: 90 }}>{centerValue}</Text>
                    </TouchableOpacity>
                  </View>
                </View>

                {coloredSpending.slice(0, selectedEnvIndex !== null ? undefined : 4).map((item, i) => {
                    const isSelected = selectedEnvIndex === i;
                    const pct = maxSpentItem > 0 ? Math.round((item.spent / maxSpentItem) * 100) : 0;
                    return (
                      <TouchableOpacity key={i} onPress={() => setSelectedEnvIndex(isSelected ? null : i)} style={{ padding: 10, borderRadius: 12, backgroundColor: isSelected ? theme.colors.primary + '10' : 'transparent', marginBottom: 4 }}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: item.color, marginRight: 8 }} />
                            <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary }}>{item.name}</Text>
                          </View>
                          <Text style={{ fontSize: 14, fontWeight: '800', color: theme.colors.textPrimary }}>{maskAmount(item.spent)}</Text>
                        </View>
                        <View style={{ height: 4, backgroundColor: theme.colors.border, borderRadius: 2, overflow: 'hidden' }}>
                          <View style={{ width: pct + '%', height: '100%', backgroundColor: item.color }} />
                        </View>
                      </TouchableOpacity>
                    );
                })}
                {coloredSpending.length > 4 && selectedEnvIndex === null && (
                    <Text style={{ fontSize: 11, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 10 }}>+ {coloredSpending.length - 4} more categories</Text>
                )}
            </View>
          )}
        </View>

        {/* ── Income Intelligence ── */}
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: theme.colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 18 }}>
            <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <MaterialIcons name='insights' size={18} color='#16A34A' />
            </View>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.textPrimary }}>Income Intelligence</Text>
          </View>

          {incomeReceivedBySource.length === 0 ? <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>No income this month.</Text> : (
            <>
              {incomeReceivedBySource.map((src, idx) => (
                <View key={src.id} style={{ marginBottom: 16 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 6 }}>
                    <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary }}>{src.name}</Text>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: '#16A34A' }}>{maskAmount(src.amount)}</Text>
                  </View>
                  <View style={{ height: 6, backgroundColor: theme.colors.border, borderRadius: 3, overflow: 'hidden' }}>
                    <View style={{ width: (totalMonthlyIncome > 0 ? (src.amount / totalMonthlyIncome) * 100 : 0) + '%', height: '100%', backgroundColor: theme.colors.primary }} />
                  </View>
                </View>
              ))}
              {incomeReceivedBySource.length > 0 && (
                <View style={{ marginTop: 4, padding: 12, backgroundColor: theme.colors.background, borderRadius: 12, borderLeftWidth: 3, borderLeftColor: theme.colors.primary }}>
                   <Text style={{ fontSize: 12, color: theme.colors.textSecondary, fontStyle: 'italic' }}>
                     Tip: Your largest source is <Text style={{fontWeight:'bold'}}>{incomeReceivedBySource[0].name}</Text>.
                   </Text>
                </View>
              )}
            </>
          )}
        </View>

        {/* ── Performance Trends ── */}
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: theme.colors.border }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#DBEAFE', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <MaterialIcons name='bar-chart' size={20} color='#2563EB' />
              </View>
              <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.textPrimary }}>6-Month Flow</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 10 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#10B981', marginRight: 4 }} /><Text style={{ fontSize: 9, fontWeight: 'bold', color: theme.colors.textSecondary }}>IN</Text></View>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}><View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: '#EF4444', marginRight: 4 }} /><Text style={{ fontSize: 9, fontWeight: 'bold', color: theme.colors.textSecondary }}>OUT</Text></View>
            </View>
          </View>

          {!isPremium ? (
            <View style={{ height: 140, alignItems: 'center', justifyContent: 'center', backgroundColor: theme.colors.background + '88', borderRadius: 16, borderStyle: 'dashed', borderWidth: 1, borderColor: theme.colors.border }}>
              <MaterialIcons name="insights" size={28} color={theme.colors.primary} style={{ marginBottom: 10 }} />
              <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.colors.textPrimary }}>Premium Comparative Data</Text>
              <TouchableOpacity onPress={() => navigation.navigate('MainApp', { screen: 'Dashboard', params: { showPremium: true } })} style={{ marginTop: 8, backgroundColor: theme.colors.primary, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 }}>
                <Text style={{ color: '#FFFFFF', fontSize: 11, fontWeight: 'bold' }}>Upgrade</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'flex-end', height: 140 }}>
              {monthlyTotals.map((m, i) => {
                const sH = Math.round((maxTrendValue > 0 ? m.spent / maxTrendValue : 0) * 100);
                const iH = Math.round((maxTrendValue > 0 ? m.income / maxTrendValue : 0) * 100);
                const isCurrent = m.key === curMonth;
                return (
                  <View key={i} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end' }}>
                    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 2, marginBottom: 8 }}>
                      <View style={{ width: 6, height: Math.max(4, iH), backgroundColor: '#10B981', borderRadius: 2 }} />
                      <View style={{ width: 6, height: Math.max(4, sH), backgroundColor: '#EF4444', borderRadius: 2 }} />
                    </View>
                    <Text style={{ fontSize: 9, fontWeight: isCurrent ? 'bold' : '600', color: isCurrent ? theme.colors.primary : theme.colors.textSecondary }}>{m.label}</Text>
                  </View>
                );
              })}
            </View>
          )}
        </View>

        {/* ── Monthly Audit History ── */}
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: theme.colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
            <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <MaterialIcons name='list-alt' size={20} color='#10B981' />
            </View>
            <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.textPrimary }}>Audit History</Text>
          </View>

          {monthlyTotals.slice().reverse().map((m, i) => {
              if (!isPremium && m.key !== curMonth) return null;
              const isCurrent = m.key === curMonth;
              const diff = m.income - m.spent;
              return (
                <View key={i} style={{ padding: 14, borderRadius: 16, backgroundColor: isCurrent ? theme.colors.primary + '08' : theme.colors.background, borderWidth: 1, borderColor: isCurrent ? theme.colors.primary + '33' : theme.colors.border, marginBottom: 10 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                    <Text style={{ fontSize: 14, fontWeight: 'bold', color: isCurrent ? theme.colors.primary : theme.colors.textPrimary }}>{m.label}</Text>
                    <Text style={{ fontSize: 12, fontWeight: 'bold', color: diff >= 0 ? '#10B981' : '#DC2626' }}>{(diff >= 0 ? '+' : '') + maskAmount(diff)}</Text>
                  </View>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
                    <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>In: <Text style={{color:theme.colors.textPrimary}}>{maskAmount(m.income)}</Text></Text>
                    <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>Out: <Text style={{color:theme.colors.textPrimary}}>{maskAmount(m.spent)}</Text></Text>
                  </View>
                </View>
              );
          })}
          {!isPremium && <TouchableOpacity onPress={() => navigation.navigate('MainApp', { screen: 'Dashboard', params: { showPremium: true } })} style={{ padding: 12, alignItems: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12 }}><Text style={{ color: theme.colors.textSecondary, fontSize: 11, fontWeight: 'bold' }}>Upgrade to see previous months</Text></TouchableOpacity>}
        </View>

      </ScrollView>

      {/* Info Modal */}
      <Modal visible={infoModalConfig.visible} animationType="fade" transparent onRequestClose={() => setInfoModalConfig({ ...infoModalConfig, visible: false })}>
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

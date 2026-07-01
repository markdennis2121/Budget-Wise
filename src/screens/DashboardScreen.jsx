import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Pressable, Platform, Modal, Image, Animated, Alert, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import AddExpenseModal from '../components/AddExpenseModal';
import SaveSuccessOverlay from '../components/SaveSuccessOverlay';
import EmptyStateCard from '../components/EmptyStateCard';
import RtaNudgeBanner from '../components/RtaNudgeBanner';
import OnboardingModal from '../components/OnboardingModal';
import BrandLogo from '../components/BrandLogo';
import { runSaveWithFeedback } from '../utils/saveSuccess';
import { deleteEnvelopeAndCleanup } from '../utils/envelopeBudget';
import { hasUserEnvelopes, showEnvelopeRequiredAlert } from '../utils/envelopeGuards';
import logoImg from '../assets/logo.png';
import { formatCurrency, getCurrentMonthStr, getTodayStr, formatDate } from '../utils/helpers';
import { triggerImpactHaptic } from '../utils/feedback';
import { scale, moderateScale, normalize, SCREEN_WIDTH } from '../utils/responsive';
import {
  TAB_MENU_HEIGHT,
  SCROLL_EXTRA_PADDING,
  WEB_TAB_MENU_PADDING,
  FAB_SPACING,
  FAB_SCROLL_BOTTOM_EXTRA,
  WALLET_STYLES
} from './dashboard/constants';
import { useDashboardState } from './dashboard/useDashboardState';
import { promptDeleteEnvelope, getEnvelopeIcon } from './dashboard/envelopeUtils';
import { MONTH_LABELS } from '../utils/monthlyInsights';
import {
  SpentManagerModal,
  QuickAddBudgetModal,
  IncomeManagerModal,
  AddEnvelopeModal,
  EditEnvelopeModal,
  TransferEnvelopeModal,
  TransferWalletModal,
  SavingsManagerModal,
  AddAccountModal,
  EditAccountModal,
  NotificationCenterModal,
  ArchiveManagerModal,
  PremiumPaywallModal
} from './dashboard/modals';

const DashboardScreen = function (props) {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 1024;

  const themeCtx = useTheme();
  const theme = themeCtx.theme;
  const userCtx = useUser();
  const userId = userCtx.currentUser ? userCtx.currentUser.id : '';
  const userName = userCtx.currentUser ? userCtx.currentUser.name : 'User';
  const insets = useSafeAreaInsets();
  const state = useDashboardState(userId);

  const isSimpleMode = state.userSettings && state.userSettings.budgeting_style === 'simple';

  const [balancesVisible, setBalancesVisible] = useState(function() {
    try {
      const saved = localStorage.getItem('penny_balances_visible');
      return saved !== null ? JSON.parse(saved) : true;
    } catch (e) { return true; }
  });

  const [walletViewMode, setWalletViewMode] = useState(function() {
    try {
      const saved = localStorage.getItem('penny_wallet_view_mode');
      return saved || 'carousel';
    } catch (e) { return 'carousel'; }
  });

  const [envelopeViewMode, setEnvelopeViewMode] = useState(function() {
    try {
      const saved = localStorage.getItem('penny_envelope_view_mode');
      return saved || 'grid';
    } catch (e) { return 'grid'; }
  });

  useEffect(function() {
    try {
      localStorage.setItem('penny_balances_visible', JSON.stringify(balancesVisible));
      localStorage.setItem('penny_wallet_view_mode', walletViewMode);
      localStorage.setItem('penny_envelope_view_mode', envelopeViewMode);
    } catch (e) {}
  }, [balancesVisible, walletViewMode, envelopeViewMode]);

  const toggleBalances = function() {
    triggerImpactHaptic('Medium');
    setBalancesVisible(!balancesVisible);
  };
  const toggleWalletView = function() {
    triggerImpactHaptic('Light');
    setWalletViewMode(walletViewMode === 'carousel' ? 'grid' : 'carousel');
  };
  const toggleEnvelopeView = function() {
    triggerImpactHaptic('Light');
    setEnvelopeViewMode(envelopeViewMode === 'grid' ? 'carousel' : 'grid');
  };
  const maskAmount = function(amt) {
    return balancesVisible ? formatCurrency(amt) : '••••••';
  };

  const isStealthDark = theme.isDark && theme.colors.primary === '#111827';
  const safePrimary = isStealthDark ? '#E5E7EB' : theme.colors.primary;

  const smartInsights = useMemo(function () {
    const insights = [];
    const today = new Date().toISOString().split('T')[0];

    // 1. Low Envelopes warning
    state.envelopeBalances.forEach(function (env) {
      if (env.assigned > 0 && env.spent > 0) {
        const pct = (env.available / env.assigned) * 100;
        if (pct < 15 && pct >= 0) {
          insights.push({
            type: 'warning',
            icon: 'warning',
            color: '#F59E0B',
            text: `Careful! Your "${env.name}" budget is almost gone (${Math.round(pct)}% remaining).`
          });
        }
      }
    });

    // 2. Savings Progress nudge
    if (state.totalSaved && state.totalSaved > 0) {
      insights.push({
        type: 'success',
        icon: 'savings',
        color: '#10B981',
        text: `Awesome! You have stored ${formatCurrency(state.totalSaved)} in Savings. Keep adding to it!`
      });
    }

    // 4. Overall spending ratio nudge
    const baseIncome = state.incomeSources.reduce(function (sum, src) { return sum + (parseFloat(src.amount) || 0); }, 0);
    if (baseIncome > 0) {
      const spendRatio = (state.totalExpenses / baseIncome) * 100;
      if (spendRatio > 70) {
        insights.push({
          type: 'info',
          icon: 'trending-up',
          color: '#3B82F6',
          text: `You have spent ${Math.round(spendRatio)}% of your main salary. Time to consider budget transfers to limit overspending!`
        });
      } else {
        insights.push({
          type: 'success',
          icon: 'check-circle-outline',
          color: '#10B981',
          text: `Budget is looking healthy! You've only spent ${Math.round(spendRatio)}% of your salary.`
        });
      }
    }

    // 4. Overdue bills
    const overdueCount = state.recurringExpenses ? state.recurringExpenses.filter(r => r.status === 'Pending' && r.due_date < today).length : 0;
    if (overdueCount > 0) {
      insights.push({
        type: 'danger',
        icon: 'error-outline',
        color: '#EF4444',
        text: `Alert: You have ${overdueCount} overdue recurring bills. Settle them to keep your credit score high!`
      });
    }

    // Default if list is empty
    if (insights.length === 0) {
      insights.push({
        type: 'info',
        icon: 'lightbulb-outline',
        color: safePrimary,
        text: "Tip: Give every peso a job. Allocate all remaining Ready to Assign funds to your envelopes!"
      });
    }

    return insights;
  }, [state.envelopeBalances, state.incomeSources, state.totalExpenses, state.recurringExpenses, state.readyToAssign, theme]);

  // Entrance Animations
  const contentFade = useRef(new Animated.Value(0)).current;
  const walletsFade = useRef(new Animated.Value(0)).current;
  const envelopesFade = useRef(new Animated.Value(0)).current;

  useEffect(function() {
    Animated.stagger(150, [
      Animated.timing(contentFade, { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(walletsFade, { toValue: 1, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(envelopesFade, { toValue: 1, duration: 500, useNativeDriver: Platform.OS !== 'web' })
    ]).start();
  }, []);

  // FAB Animation
  const fabScale = useRef(new Animated.Value(1)).current;
  const animatedFabStyle = {
    transform: [{ scale: fabScale }]
  };

  const onPressFab = function() {
    triggerImpactHaptic('Medium');
    Animated.sequence([
      Animated.spring(fabScale, { toValue: 1.15, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(fabScale, { toValue: 1, useNativeDriver: Platform.OS !== 'web' })
    ]).start();

    if (!isSimpleMode && !hasUserEnvelopes(state.userSettings)) {
      showEnvelopeRequiredAlert({ onAcknowledge: function () { setShowAddEnvModal(true); } });
      return;
    }
    state.setShowAddModal(true);
  };
  const [showSpentModal, setShowSpentModal] = useState(false);
  const [spentFilter, setSpentFilter] = useState(null);
  const [showIncomeModal, setShowIncomeModal] = useState(false);
  const [showAddEnvModal, setShowAddEnvModal] = useState(false);
  const [showEditEnvModal, setShowEditEnvModal] = useState(false);
  const [selectedEnvelope, setSelectedEnvelope] = useState(null);
  const [showAddAccountModal, setShowAddAccountModal] = useState(false);
  const [showEditAccountModal, setShowEditAccountModal] = useState(false);
  const [selectedAccount, setSelectedAccount] = useState(null);
  const [showSavingsManagerModal, setShowSavingsManagerModal] = useState(false);
  const [showNotificationCenter, setShowNotificationCenter] = useState(false);
  const [showArchiveModal, setShowArchiveModal] = useState(false);
  const [showPremiumModal, setShowPremiumModal] = useState(false);

  // UI/UX Hook: Allow other screens to trigger the paywall
  useEffect(() => {
    if (props.route?.params?.showPremium) {
      setShowPremiumModal(true);
      // Clear the param so it doesn't pop up again on re-focus
      props.navigation.setParams({ showPremium: undefined });
    }
  }, [props.route?.params]);

  // High-End Alert Persistence: Track how many alerts the user has already acknowledged
  const [lastSeenAlertCount, setLastSeenAlertCount] = useState(function() {
    try {
      return parseInt(localStorage.getItem('penny_last_seen_alert_count')) || 0;
    } catch (e) { return 0; }
  });

  // Calculate the current total number of active alerts/reminders
  const currentAlertCount = useMemo(function() {
    const insightCount = smartInsights.filter(i => i.type !== 'info').length;
    const billCount = state.recurringExpenses ? state.recurringExpenses.filter(r => r.status === 'Pending').length : 0;
    return insightCount + billCount;
  }, [smartInsights, state.recurringExpenses]);

  // When user opens the tray, sync the "Last Seen" count to the "Current" count
  useEffect(() => {
    if (showNotificationCenter) {
      setLastSeenAlertCount(currentAlertCount);
      try {
        localStorage.setItem('penny_last_seen_alert_count', currentAlertCount.toString());
      } catch (e) {}
    }
  }, [showNotificationCenter, currentAlertCount]);

  const hasNewAlerts = currentAlertCount > lastSeenAlertCount;

  const [showTransferEnvModal, setShowTransferEnvModal] = useState(false);
  const [showTransferWalletModal, setShowTransferWalletModal] = useState(false);
  const [insightIndex, setInsightIndex] = useState(0);
  const [infoModalConfig, setInfoModalConfig] = useState({ visible: false, title: '', content: null });
  const [showQuickAddModal, setShowQuickAddModal] = useState(false);
  const [quickAddEnv, setQuickAddEnv] = useState(null);
  const [showScreenSaveSuccess, setShowScreenSaveSuccess] = useState(false);
  const [screenSuccessMessage, setScreenSuccessMessage] = useState('Saved!');
  const scrollRef = useRef(null);
  const scrollContentY = useRef(0);
  const envelopeRowY = useRef(0);
  const scrollBottomPadding = Platform.OS === 'web' ? WEB_TAB_MENU_PADDING : (TAB_MENU_HEIGHT + insets.bottom + SCROLL_EXTRA_PADDING);
  const fabBottom = Platform.OS === 'web' ? WEB_TAB_MENU_PADDING : (TAB_MENU_HEIGHT + insets.bottom + FAB_SPACING);

  const totalAvailableMoney = state.accounts.reduce(function (sum, acc) { return sum + acc.balance; }, 0);
  const totalActualMoney = totalAvailableMoney;
  const rtaColor = state.readyToAssign === 0 ? '#10B981' : (state.readyToAssign > 0 ? theme.colors.primary : theme.colors.error);

  // --- DASHBOARD ENGAGEMENT LOGIC (S2) ---

  const streakCount = state.userSettings ? parseInt(state.userSettings.streak_count) || 0 : 0;

  const getWeeklyProgress = useMemo(function() {
    const last7Days = (state.userHistory || []).filter(h => {
      const d = new Date(h.date);
      const now = new Date();
      return (now - d) / (1000 * 60 * 60 * 24) <= 7;
    });
    const count = last7Days.length;
    if (count === 0) return { label: 'Quiet Week', icon: 'bedtime', color: '#94A3B8' };
    if (count < 5) return { label: 'Active Week', icon: 'auto-awesome', color: '#3B82F6' };
    return { label: 'Power Week!', icon: 'bolt', color: '#10B981' };
  }, [state.userHistory]);

  const spendingWeather = useMemo(function() {
    if (state.totalIncome === 0) return { icon: 'wb-sunny', color: '#10B981', label: 'Clear Skies', sub: 'Log some income to see your budget vibe!' };

    const ratio = state.totalExpenses / state.totalIncome;
    if (ratio <= 0.4) return { icon: 'wb-sunny', color: '#10B981', label: 'Sunny', sub: 'You are saving like a pro!' };
    if (ratio <= 0.8) return { icon: 'cloud-queue', color: '#3B82F6', label: 'Cloudy', sub: 'Spending is normal. Keep it up.' };
    return { icon: 'thunderstorm', color: '#F59E0B', label: 'Stormy', sub: 'Careful! Spending is very high.' };
  }, [state.totalExpenses, state.totalIncome]);

  const userLevel = useMemo(function() {
    const saved = state.totalSaved || 0;
    if (saved < 1000) return { name: 'Penny Pincher', next: 1000, icon: 'eco' };
    if (saved < 10000) return { name: 'Budget Boss', next: 10000, icon: 'shield' };
    return { name: 'Wealth Wizard', next: 100000, icon: 'auto-fix-high' };
  }, [state.totalSaved]);

  const financialPersona = useMemo(function() {
    const isPremiumUser = state.userSettings?.is_premium;
    const history = state.userHistory || [];

    // Basic Users stay as "Consistent" or "Newcomer"
    if (!isPremiumUser) {
       return history.length < 5
        ? { name: 'Newcomer', icon: 'face', desc: 'Log more to reveal your style.' }
        : { name: 'Member', icon: 'person', desc: 'Standard tracking mode active.' };
    }

    if (history.length < 5) return { name: 'The Newcomer', icon: 'face', desc: 'Log more to reveal your style.' };

    let weekendSpend = 0;
    let totalSpendCount = 0;

    history.forEach(h => {
      if (h.expense_type === 'One-Time' || h.expense_type === 'Recurring') {
        totalSpendCount++;
        const date = new Date(h.date);
        const day = date.getDay();
        if (day === 0 || day === 5 || day === 6) weekendSpend++; // Fri, Sat, Sun
      }
    });

    const billCount = state.recurringExpenses.length;
    const paidEarly = state.recurringExpenses.filter(r => r.status === 'Paid' || r.status === 'Paid in Advance').length;

    if (billCount > 0 && (paidEarly / billCount) > 0.8) return { name: 'The Bill Ninja', icon: 'visibility-off', desc: 'You never let a deadline slip!' };
    if (totalSpendCount > 0 && (weekendSpend / totalSpendCount) > 0.6) return { name: 'Weekend Warrior', icon: 'celebration', desc: 'Most of your action happens on weekends.' };
    if (state.totalIncome > 0 && (state.totalSaved / state.totalIncome) > 0.25) return { name: 'The Master Saver', icon: 'account-balance', desc: 'Future you is going to be very rich.' };

    return { name: 'The Consistent One', icon: 'insights', desc: 'Steady tracking, day in and day out.' };
  }, [state.userHistory, state.recurringExpenses, state.totalSaved, state.totalIncome]);

  const renderSavingsJar = function() {
    const saved = state.totalSaved || 0;
    const capacity = userLevel.next || 1000;
    const fillPct = Math.min(100, (saved / capacity) * 100);
    const isFull = fillPct >= 100;

    return (
      <View style={{ marginBottom: moderateScale(24) }}>
        <TouchableOpacity
          onPress={() => setShowSavingsManagerModal(true)}
          style={{
            backgroundColor: theme.colors.card,
            borderRadius: scale(20),
            padding: moderateScale(18),
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: theme.colors.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2
          }}
        >
          <View style={{ width: scale(42), height: scale(42), borderRadius: scale(10), backgroundColor: '#3B82F615', alignItems: 'center', justifyContent: 'center', marginRight: 15 }}>
            <MaterialIcons name="savings" size={scale(22)} color="#3B82F6" />
          </View>

          <View style={{ flex: 1 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginBottom: 6 }}>
              <View>
                <Text style={{ fontSize: scale(9), fontWeight: '800', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Savings Progress</Text>
                <Text style={{ fontSize: scale(18), fontWeight: '900', color: theme.colors.textPrimary }}>{maskAmount(saved)}</Text>
              </View>
              <Text style={{ fontSize: scale(11), fontWeight: 'bold', color: theme.colors.textSecondary }}>{Math.round(fillPct)}%</Text>
            </View>
            <View style={{ height: 6, backgroundColor: theme.colors.border, borderRadius: 3, overflow: 'hidden' }}>
              <View style={{ width: fillPct + '%', height: '100%', backgroundColor: isFull ? '#F59E0B' : '#3B82F6' }} />
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={theme.colors.textSecondary} style={{ marginLeft: 10 }} />
        </TouchableOpacity>
      </View>
    );
  };

  // New Month Assistant Logic
  const curMonth = getCurrentMonthStr();
  const needsSettlement = !isSimpleMode &&
                        state.userSettings &&
                        state.userSettings.last_settled_month !== curMonth &&
                        state.envelopeBalances.some(env => env.available > 0);

  const totalLeftover = useMemo(function() {
    return state.envelopeBalances.reduce((sum, env) => sum + Math.max(0, env.available), 0);
  }, [state.envelopeBalances]);

  const hasNoAccounts = state.accounts.length === 0;
  const hasNoEnvelopes = state.envelopeBalances.length === 0;
  const hasNoIncome = state.totalIncome <= 0 && state.incomeSources.every(s => (parseFloat(s.amount) || 0) <= 0) && hasNoAccounts;

  const handleRtaNudgePress = function () {
    if (hasNoEnvelopes) {
      setShowAddEnvModal(true);
      return;
    }
    if (scrollRef.current) {
      const targetY = scrollContentY.current + envelopeRowY.current - 12;
      scrollRef.current.scrollTo({ y: Math.max(0, targetY), animated: true });
    }
  };

  const handleTotalMoneyInfo = function () {
    const accountsList = state.accounts.map(a => ({ name: a.name, amount: a.balance }));
    setInfoModalConfig({
      visible: true,
      title: 'Total Current Money',
      content: (
        <View>
          <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginBottom: 16, lineHeight: 20 }}>
            This is the exact sum of all the money in your linked wallets and bank accounts right now.
          </Text>
          <View style={{ backgroundColor: theme.colors.background, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.colors.border }}>
            {accountsList.map((acc) => (
              <View key={acc.name} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 }}>
                <Text style={{ fontSize: 14, color: theme.colors.textPrimary, fontWeight: '600' }}>{acc.name}</Text>
                <Text style={{ fontSize: 14, color: theme.colors.textPrimary, fontWeight: 'bold' }}>{formatCurrency(acc.amount)}</Text>
              </View>
            ))}
          </View>
        </View>
      )
    });
  };

  const handleTransferWalletPress = function () {
    triggerImpactHaptic('Light');
    if (state.accounts.length < 2) {
      const msg = "Add another wallet or bank account so you can move money between them.";
      if (Platform.OS === 'web') {
        if (window.confirm("Add Another Account?\n\n" + msg)) {
          setShowAddAccountModal(true);
        }
      } else {
        Alert.alert("Add Another Account?", msg, [
          { text: "Cancel", style: "cancel" },
          { text: "Add Wallet", onPress: function() { setShowAddAccountModal(true); } }
        ]);
      }
      return;
    }
    setShowTransferWalletModal(true);
  };

  const handleTransferEnvPress = function () {
    triggerImpactHaptic('Light');
    if (state.envelopes.length < 2) {
      const msg = "Add another envelope so you can move budget between your categories.";
      if (Platform.OS === 'web') {
        if (window.confirm("Add Another Envelope?\n\n" + msg)) {
          setShowAddEnvModal(true);
        }
      } else {
        Alert.alert("Add Another Envelope?", msg, [
          { text: "Cancel", style: "cancel" },
          { text: "Add Envelope", onPress: function() { setShowAddEnvModal(true); } }
        ]);
      }
      return;
    }
    setShowTransferEnvModal(true);
  };

  const handleReadyToAssignInfo = function () {
    const orphanNote = state.orphanPendingTotal > 0 ? (
      <View style={{ backgroundColor: 'rgba(245, 158, 11, 0.12)', borderRadius: 12, padding: 14, marginBottom: 12 }}>
        <Text style={{ fontSize: 13, color: theme.colors.warning, fontWeight: '600', lineHeight: 20 }}>
          {formatCurrency(state.orphanPendingTotal)} is held for pending bills whose envelope was removed. Reassign those bills on the Bills tab or delete them to free this amount.
        </Text>
      </View>
    ) : null;
    setInfoModalConfig({
      visible: true,
      title: 'Ready To Assign',
      content: (
        <View>
          <Text style={{ fontSize: 15, color: theme.colors.textPrimary, marginBottom: 12, lineHeight: 22 }}>
            Total Current Money minus money already assigned to envelopes and pending bills. Pending bills reduce the envelope they belong to until paid.
          </Text>
          {orphanNote}
          <View style={{ backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center' }}>
            <MaterialIcons name="lightbulb" size={20} color="#10B981" style={{ marginRight: 10 }} />
            <Text style={{ fontSize: 13, color: '#10B981', fontWeight: 'bold', flex: 1 }}>
              Pro Tip: Give every peso a job by transferring this cash into your envelopes!
            </Text>
          </View>
        </View>
      )
    });
  };

  const handleWalletsInfo = function () {
    setInfoModalConfig({
      visible: true,
      title: 'Wallets & Accounts',
      content: (
        <View>
          <Text style={{ fontSize: 15, color: theme.colors.textPrimary, marginBottom: 12, lineHeight: 22 }}>
            This section tracks exactly where your money is physically stored.
          </Text>
          <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginBottom: 16, lineHeight: 22 }}>
            If you have ₱1,000 in Cash, ₱5,000 in GCash, and ₱10,000 in BPI, you add them all here to track your total net worth across all platforms.
          </Text>
          <View style={{ backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: 12, padding: 14, flexDirection: 'row', alignItems: 'center' }}>
            <MaterialIcons name="info" size={20} color="#3B82F6" style={{ marginRight: 10 }} />
            <Text style={{ fontSize: 13, color: '#3B82F6', fontWeight: 'bold', flex: 1 }}>
              Accounts tell you "Where is my money?", while Envelopes tell you "What is this money for?".
            </Text>
          </View>
        </View>
      )
    });
  };

  const activeInsight = smartInsights[insightIndex % smartInsights.length] || smartInsights[0];

  const currentHour = new Date().getHours();
  let greeting = "Good Evening";
  if (currentHour < 12) {
    greeting = "Good Morning";
  } else if (currentHour < 18) {
    greeting = "Good Afternoon";
  }

  const [showDailyAudit, setShowDailyAudit] = useState(false);

  const dailyStats = useMemo(() => {
    const today = getTodayStr();
    const todayHistory = state.userHistory.filter(h => h.date === today);

    let spent = 0;
    let earned = 0;

    todayHistory.forEach(h => {
      const amt = parseFloat(h.amount) || 0;
      if (h.expense_type === 'Income' || (h.expense_type === 'Adjustment' && h.category === 'Income')) {
        earned += amt;
      } else if (h.expense_type === 'One-Time' || h.expense_type === 'Recurring') {
        spent += amt;
      }
    });

    return { spent, earned, count: todayHistory.length, history: todayHistory };
  }, [state.userHistory]);

  const renderDailyAuditButton = function() {
    return (
      <View style={{ marginBottom: moderateScale(20) }}>
        <TouchableOpacity
          onPress={() => { triggerImpactHaptic('Medium'); setShowDailyAudit(true); }}
          style={{
            backgroundColor: theme.colors.card,
            borderRadius: scale(20),
            padding: moderateScale(16),
            flexDirection: 'row',
            alignItems: 'center',
            borderWidth: 1,
            borderColor: theme.colors.border,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.05,
            shadowRadius: 8,
            elevation: 2
          }}
        >
          <View style={{ width: scale(40), height: scale(40), borderRadius: scale(10), backgroundColor: theme.colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
            <MaterialIcons name="summarize" size={scale(20)} color={theme.colors.primary} />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: scale(9), fontWeight: '800', color: theme.colors.textSecondary, textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 2 }}>Today's Financial Audit</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: scale(14), fontWeight: '800', color: '#10B981' }}>+{formatCurrency(dailyStats.earned)}</Text>
              <View style={{ width: 1, height: 10, backgroundColor: theme.colors.border, marginHorizontal: 8 }} />
              <Text style={{ fontSize: scale(14), fontWeight: '800', color: '#EF4444' }}>-{formatCurrency(dailyStats.spent)}</Text>
            </View>
          </View>
          <MaterialIcons name="chevron-right" size={24} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>
    );
  };

  const renderWalletsSection = function() {
    return (
      <Animated.View style={{ marginBottom: isSimpleMode ? moderateScale(24) : 24, opacity: walletsFade, transform: [{ translateX: walletsFade.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <TouchableOpacity onPress={handleWalletsInfo} style={{ flexDirection: 'row', alignItems: 'center' }}>
            <Text style={{ ...theme.typography.h3, color: theme.colors.textPrimary, marginRight: 6 }}>{isSimpleMode ? 'Wallets & Bank Accounts' : 'Wallets & Accounts'}</Text>
            <MaterialIcons name="info-outline" size={18} color={theme.colors.textSecondary} />
          </TouchableOpacity>
          <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
            {!isSimpleMode && (
              <TouchableOpacity onPress={toggleWalletView} style={{ padding: 4 }}>
                <MaterialIcons name={walletViewMode === 'carousel' ? "grid-view" : "view-carousel"} size={20} color={safePrimary} />
              </TouchableOpacity>
            )}
            <TouchableOpacity onPress={handleTransferWalletPress} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons name="swap-horiz" size={16} color={safePrimary} style={{ marginRight: 4 }} />
              <Text style={{ color: safePrimary, fontWeight: 'bold', fontSize: 14 }}>Transfer</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { triggerImpactHaptic('Light'); setShowAddAccountModal(true); }} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons name="add" size={16} color={safePrimary} style={{ marginRight: 4 }} />
              <Text style={{ color: safePrimary, fontWeight: 'bold', fontSize: 14 }}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>

        {hasNoAccounts ? (
          <EmptyStateCard
            theme={theme}
            icon="account-balance-wallet"
            title="No wallets yet"
            message="Add where your money lives — GCash, bank, cash — so Total Current Money stays accurate."
            actionLabel="Add your first wallet"
            onAction={function () { setShowAddAccountModal(true); }}
          />
        ) : (
          (walletViewMode === 'carousel' && !isSimpleMode) ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              nestedScrollEnabled={true}
              style={{ minHeight: scale(118) }}
              contentContainerStyle={{ paddingVertical: 4, paddingRight: 8, alignItems: 'center' }}
            >
              {state.accounts.map(function (acc) {
                const openWalletEditor = function () {
                  triggerImpactHaptic('Light');
                  setSelectedAccount(acc);
                  setShowEditAccountModal(true);
                };
                    return (
                      <Animated.View key={acc.id} style={{ opacity: walletsFade }}>
                        <Pressable
                          onPress={openWalletEditor}
                          style={function ({ pressed }) {
                            const styleInfo = WALLET_STYLES[acc.type] || WALLET_STYLES.Custom;
                            const mainColor = acc.color || styleInfo.color;
                            const shadowColor = mainColor;

                            return {
                              width: scale(190),
                              height: scale(115),
                              backgroundColor: mainColor,
                              borderRadius: scale(24),
                              padding: moderateScale(18),
                              marginRight: moderateScale(16),
                              justifyContent: 'space-between',
                              position: 'relative',
                              overflow: 'hidden',
                              shadowColor: shadowColor,
                              shadowOffset: { width: 0, height: 8 },
                              shadowOpacity: 0.35,
                              shadowRadius: 10,
                              elevation: 10,
                              borderWidth: 1.5,
                              borderColor: 'rgba(255,255,255,0.25)',
                              opacity: pressed ? 0.9 : 1,
                              transform: [{ scale: pressed ? 0.96 : 1 }]
                            };
                          }}
                        >
                          {Platform.OS === 'web' ? (
                            <View style={{
                              position: 'absolute',
                              top: 0, left: 0, right: 0, bottom: 0,
                              backgroundImage: `linear-gradient(135deg, ${(WALLET_STYLES[acc.type] || WALLET_STYLES.Custom).color} 0%, ${(WALLET_STYLES[acc.type] || WALLET_STYLES.Custom).color2 || (WALLET_STYLES[acc.type] || WALLET_STYLES.Custom).color} 100%)`
                            }} />
                          ) : (
                            <View style={{ position: 'absolute', top: -scale(40), left: -scale(40), width: scale(100), height: scale(100), borderRadius: scale(50), backgroundColor: 'rgba(255,255,255,0.12)' }} />
                          )}

                          <View style={{ position: 'absolute', right: scale(-12), bottom: scale(-12), opacity: 0.15 }}>
                             <BrandLogo type={acc.type} size={scale(85)} />
                          </View>

                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 1 }}>
                            <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', padding: scale(7), borderRadius: scale(12), borderWidth: 1, borderColor: 'rgba(255,255,255,0.25)' }}>
                               <BrandLogo type={acc.type} size={scale(20)} />
                            </View>
                            <View style={{ width: scale(30), height: scale(30), borderRadius: scale(15), backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                              <MaterialIcons name="edit" size={scale(15)} color="#FFFFFF" />
                            </View>
                          </View>

                          <View style={{ zIndex: 1 }}>
                            <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 3, borderRadius: 8, marginBottom: 6 }}>
                              <Text style={{ fontSize: scale(9.5), color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 1.2 }} numberOfLines={1}>
                                {acc.name || 'Wallet'}
                              </Text>
                            </View>
                            <Text style={[{ fontSize: scale(21), color: '#FFFFFF', fontWeight: '900' }, Platform.OS === 'web' ? { textShadow: '1px 1px 3px rgba(0,0,0,0.15)' } : { textShadowColor: 'rgba(0,0,0,0.15)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 3 }]}>
                              {maskAmount(acc.balance)}
                            </Text>
                          </View>
                        </Pressable>
                      </Animated.View>
                );
              })}
            </ScrollView>
          ) : (
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
                  {state.accounts.map(function (acc) {
                    const openWalletEditor = function () {
                      triggerImpactHaptic('Light');
                      setSelectedAccount(acc);
                      setShowEditAccountModal(true);
                    };
                    return (
                      <Pressable
                        key={acc.id}
                        onPress={openWalletEditor}
                        style={function ({ pressed }) {
                          const styleInfo = WALLET_STYLES[acc.type] || WALLET_STYLES.Custom;
                          const mainColor = acc.color || styleInfo.color;
                          const shadowColor = mainColor;

                          return {
                            width: '48%',
                            height: isSimpleMode ? scale(125) : scale(105),
                            backgroundColor: mainColor,
                            borderRadius: scale(24),
                            padding: moderateScale(isSimpleMode ? 18 : 14),
                            marginBottom: moderateScale(14),
                            justifyContent: 'space-between',
                            position: 'relative',
                            overflow: 'hidden',
                            shadowColor: shadowColor,
                            shadowOffset: { width: 0, height: 6 },
                            shadowOpacity: 0.3,
                            shadowRadius: 8,
                            elevation: 8,
                            borderWidth: 1.5,
                            borderColor: 'rgba(255,255,255,0.25)',
                            opacity: pressed ? 0.9 : 1,
                            transform: [{ scale: pressed ? 0.97 : 1 }]
                          };
                        }}
                      >
                        {Platform.OS === 'web' ? (
                          <View style={{
                            position: 'absolute',
                            top: 0, left: 0, right: 0, bottom: 0,
                            backgroundImage: `linear-gradient(135deg, ${(WALLET_STYLES[acc.type] || WALLET_STYLES.Custom).color} 0%, ${(WALLET_STYLES[acc.type] || WALLET_STYLES.Custom).color2 || (WALLET_STYLES[acc.type] || WALLET_STYLES.Custom).color} 100%)`
                          }} />
                        ) : (
                          <View style={{ position: 'absolute', top: -scale(30), left: -scale(30), width: scale(80), height: scale(80), borderRadius: scale(40), backgroundColor: 'rgba(255,255,255,0.1)' }} />
                        )}

                        <View style={{ position: 'absolute', right: scale(-8), bottom: scale(-8), opacity: 0.15 }}>
                           <BrandLogo type={acc.type} size={scale(isSimpleMode ? 80 : 60)} />
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', zIndex: 1 }}>
                          <View style={{ backgroundColor: 'rgba(255,255,255,0.18)', padding: scale(5), borderRadius: scale(9), borderWidth: 0.5, borderColor: 'rgba(255,255,255,0.25)' }}>
                            <BrandLogo type={acc.type} size={scale(18)} />
                          </View>
                          <MaterialIcons name="edit" size={scale(14)} color="#FFFFFF" style={{ opacity: 0.9 }} />
                        </View>
                        <View style={{ zIndex: 1 }}>
                          <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', alignSelf: 'flex-start', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, marginBottom: 4 }}>
                            <Text style={{ fontSize: scale(isSimpleMode ? 9.5 : 8.5), color: '#FFFFFF', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.8 }} numberOfLines={1}>
                              {acc.name}
                            </Text>
                          </View>
                          <Text style={[{ fontSize: scale(isSimpleMode ? 20 : 17), color: '#FFFFFF', fontWeight: '900' }, Platform.OS === 'web' ? { textShadow: '1px 1px 2px rgba(0,0,0,0.1)' } : { textShadowColor: 'rgba(0,0,0,0.1)', textShadowOffset: { width: 1, height: 1 }, textShadowRadius: 2 }]}>
                            {maskAmount(acc.balance)}
                          </Text>
                        </View>
                      </Pressable>
                    );
                  })}
            </View>
          )
        )}
      </Animated.View>
    );
  };

  const renderMonthlyStats = function() {
    return (
      <View style={{ backgroundColor: theme.colors.card, borderRadius: scale(24), padding: moderateScale(20), marginBottom: moderateScale(20), shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: theme.colors.border }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(20) }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: scale(32), height: scale(32), borderRadius: scale(10), backgroundColor: safePrimary + '15', alignItems: 'center', justifyContent: 'center', marginRight: scale(10) }}>
              <MaterialIcons name="auto-graph" size={scale(18)} color={safePrimary} />
            </View>
            <Text style={{ fontSize: scale(16), fontWeight: 'bold', color: theme.colors.textPrimary }}>{isSimpleMode ? 'Monthly Snapshot' : 'Money Manager'}</Text>
          </View>
          <View style={{ backgroundColor: theme.isDark ? '#374151' : '#F3F4F6', paddingHorizontal: scale(10), paddingVertical: scale(4), borderRadius: scale(8) }}>
            <Text style={{ fontSize: scale(10), color: theme.colors.textSecondary, fontWeight: 'bold' }}>THIS MONTH</Text>
          </View>
        </View>

        <View style={{ flexDirection: 'row', gap: moderateScale(10), marginBottom: isSimpleMode ? 0 : moderateScale(20) }}>
          <TouchableOpacity
            onPress={function () { triggerImpactHaptic('Light'); setShowIncomeModal(true); }}
            style={{
              flex: 1,
              backgroundColor: theme.colors.background,
              borderRadius: scale(16),
              padding: moderateScale(14),
              borderWidth: 1.5,
              borderColor: '#10B98133',
              alignItems: 'center'
            }}
          >
            <MaterialIcons name="trending-up" size={scale(18)} color="#10B981" style={{ marginBottom: 6 }} />
            <Text style={{ fontSize: scale(10), color: theme.colors.textSecondary, fontWeight: '800', marginBottom: 2, letterSpacing: 0.5 }}>INCOME</Text>
            <Text style={{ fontSize: scale(15), fontWeight: '900', color: '#10B981' }} numberOfLines={1}>{maskAmount(state.totalIncome)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={function () { triggerImpactHaptic('Light'); setSpentFilter(null); setShowSpentModal(true); }}
            style={{
              flex: 1,
              backgroundColor: theme.colors.background,
              borderRadius: scale(16),
              padding: moderateScale(14),
              borderWidth: 1.5,
              borderColor: '#EF444433',
              alignItems: 'center'
            }}
          >
            <MaterialIcons name="trending-down" size={scale(18)} color="#EF4444" style={{ marginBottom: 6 }} />
            <Text style={{ fontSize: scale(10), color: theme.colors.textSecondary, fontWeight: '800', marginBottom: 2, letterSpacing: 0.5 }}>SPENT</Text>
            <Text style={{ fontSize: scale(15), fontWeight: '900', color: '#EF4444' }} numberOfLines={1}>{maskAmount(state.totalExpenses)}</Text>
          </TouchableOpacity>

          <TouchableOpacity
            onPress={function () { triggerImpactHaptic('Light'); setShowSavingsManagerModal(true); }}
            style={{
              flex: 1,
              backgroundColor: theme.colors.background,
              borderRadius: scale(16),
              padding: moderateScale(14),
              borderWidth: 1.5,
              borderColor: '#3B82F633',
              alignItems: 'center'
            }}
          >
            <MaterialIcons name="savings" size={scale(18)} color="#3B82F6" style={{ marginBottom: 6 }} />
            <Text style={{ fontSize: scale(10), color: theme.colors.textSecondary, fontWeight: '800', marginBottom: 2, letterSpacing: 0.5 }}>SAVINGS</Text>
            <Text style={{ fontSize: scale(15), fontWeight: '900', color: '#3B82F6' }} numberOfLines={1}>{maskAmount(state.totalSaved)}</Text>
          </TouchableOpacity>
        </View>

        {!isSimpleMode && (
          <View style={{ backgroundColor: theme.isDark ? 'rgba(0,0,0,0.1)' : '#F9FAFB', padding: moderateScale(14), borderRadius: scale(14), borderWidth: 1, borderColor: theme.colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: scale(12), color: theme.colors.textSecondary, fontWeight: '600' }}>Budget Utilization</Text>
              </View>
              <Text style={{ fontSize: scale(13), fontWeight: '800', color: state.totalIncome > 0 && (state.totalExpenses / state.totalIncome) > 0.9 ? theme.colors.error : theme.colors.primary }}>
                {state.totalIncome > 0 ? Math.round((state.totalExpenses / state.totalIncome) * 100) : 0}%
              </Text>
            </View>
            <View style={{ height: scale(8), backgroundColor: theme.isDark ? '#374151' : '#E5E7EB', borderRadius: scale(6), overflow: 'hidden' }}>
              <View style={{
                width: (state.totalIncome > 0 ? Math.min(100, (state.totalExpenses / state.totalIncome) * 100) : 0) + '%',
                height: '100%',
                backgroundColor: state.totalIncome > 0 && (state.totalExpenses / state.totalIncome) > 0.9 ? theme.colors.error : safePrimary,
                borderRadius: scale(6),
                shadowColor: state.totalIncome > 0 && (state.totalExpenses / state.totalIncome) > 0.9 ? theme.colors.error : safePrimary,
                shadowOffset: { width: 0, height: 0 },
                shadowOpacity: 0.5,
                shadowRadius: 4
              }} />
            </View>
          </View>
        )}
      </View>
    );
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: scrollBottomPadding + FAB_SCROLL_BOTTOM_EXTRA }}>

        <View style={{
          backgroundColor: theme.colors.primary,
          paddingTop: insets.top + moderateScale(15),
          paddingBottom: moderateScale(25),
          borderBottomLeftRadius: scale(35),
          borderBottomRightRadius: scale(35),
          shadowColor: theme.colors.primary,
          shadowOffset: { width: 0, height: 10 },
          shadowOpacity: 0.25,
          shadowRadius: 15,
          elevation: 10,
          overflow: 'hidden'
        }}>
          <View style={{ position: 'absolute', top: scale(-50), right: scale(-30), width: scale(160), height: scale(160), borderRadius: scale(80), backgroundColor: 'rgba(255,255,255,0.08)' }} />
          <View style={{ position: 'absolute', bottom: scale(-40), left: scale(-20), width: scale(120), height: scale(120), borderRadius: scale(60), backgroundColor: 'rgba(255,255,255,0.05)' }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: moderateScale(25), marginBottom: moderateScale(20) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Image source={logoImg} style={{ width: scale(32), height: scale(32), borderRadius: scale(16), borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.3)' }} />
              <Text style={{ fontSize: scale(12), fontWeight: '900', color: '#FFFFFF', letterSpacing: 2 }}>PENNY</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
               <TouchableOpacity
                  onPress={function () { triggerImpactHaptic('Light'); setShowNotificationCenter(true); }}
                  style={{ width: scale(38), height: scale(38), borderRadius: scale(19), backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
                >
                  <MaterialIcons name="notifications-none" size={scale(22)} color="#FFFFFF" />
                  {hasNewAlerts && (
                    <View style={{ position: 'absolute', top: 0, right: 0, backgroundColor: '#EF4444', borderRadius: 8, width: 16, height: 16, alignItems: 'center', justifyContent: 'center', borderWidth: 2, borderColor: theme.colors.primary }}>
                       <View style={{ width: 4, height: 4, borderRadius: 2, backgroundColor: '#FFFFFF' }} />
                    </View>
                  )}
               </TouchableOpacity>
            </View>
          </View>

          <View style={{ paddingHorizontal: moderateScale(25), marginBottom: moderateScale(20) }}>
             <TouchableOpacity onPress={handleTotalMoneyInfo} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4, opacity: 0.8 }}>
                <Text style={{ fontSize: scale(10), fontWeight: '800', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 1 }}>Total Liquid Worth</Text>
                <MaterialIcons name="info-outline" size={12} color="#FFFFFF" style={{ marginLeft: 4 }} />
             </TouchableOpacity>
             <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={{ fontSize: scale(34), fontWeight: '900', color: '#FFFFFF', letterSpacing: -1 }}>{maskAmount(totalActualMoney)}</Text>
                <TouchableOpacity onPress={toggleBalances} style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}>
                   <MaterialIcons name={balancesVisible ? "visibility" : "visibility-off"} size={22} color="#FFFFFF" />
                </TouchableOpacity>
             </View>
          </View>

          <View style={{ flexDirection: 'row', paddingHorizontal: moderateScale(25), gap: 10, marginBottom: moderateScale(20) }}>
             {streakCount > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 }}>
                   <MaterialIcons name="local-fire-department" size={14} color="#FF9F1C" />
                   <Text style={{ marginLeft: 4, fontSize: 11, fontWeight: '900', color: '#FFFFFF' }}>{streakCount}</Text>
                </View>
             )}
             <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 }}>
                <MaterialIcons name={spendingWeather.icon} size={14} color="#FFFFFF" />
                <Text style={{ marginLeft: 5, fontSize: 11, fontWeight: '900', color: '#FFFFFF', textTransform: 'uppercase' }}>{spendingWeather.label}</Text>
             </View>
             <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.15)', paddingHorizontal: 10, paddingVertical: 6, borderRadius: 10 }}>
                <MaterialIcons name={financialPersona.icon} size={14} color="#FFFFFF" />
                <Text style={{ marginLeft: 5, fontSize: 11, fontWeight: '900', color: '#FFFFFF', textTransform: 'uppercase' }}>{financialPersona.name}</Text>
             </View>
          </View>

          <TouchableOpacity
            onPress={() => {
              if (!state.userSettings?.is_premium) {
                setShowPremiumModal(true);
              } else {
                state.setShowAddModal(true);
              }
            }}
            style={{
              marginHorizontal: moderateScale(25),
              backgroundColor: state.userSettings?.is_premium ? 'rgba(255,255,255,0.1)' : 'rgba(255,255,255,0.05)',
              borderRadius: 15,
              paddingVertical: 12,
              paddingHorizontal: 15,
              flexDirection: 'row',
              justifyContent: 'space-between',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: state.userSettings?.is_premium ? 'rgba(255,255,255,0.15)' : 'rgba(255,255,255,0.08)'
            }}
          >
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
               <MaterialIcons name={state.userSettings?.is_premium ? "bolt" : "lock"} size={18} color={state.userSettings?.is_premium ? "#FBBF24" : "rgba(255,255,255,0.6)"} style={{ marginRight: 8 }} />
               {state.userSettings?.is_premium ? (
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: 'rgba(255,255,255,0.9)' }}>Safe to spend <Text style={{ color: '#FFFFFF', fontWeight: '900' }}>{maskAmount(state.safeToSpend)}</Text> today</Text>
               ) : (
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: 'rgba(255,255,255,0.7)', textTransform: 'uppercase', letterSpacing: 0.5 }}>Unlock Daily Spend Limit</Text>
               )}
            </View>
            <MaterialIcons name={state.userSettings?.is_premium ? "add-circle" : "workspace-premium"} size={20} color={state.userSettings?.is_premium ? "#FFFFFF" : "#F59E0B"} />
          </TouchableOpacity>
        </View>

        {needsSettlement && (
          <View style={{ marginHorizontal: moderateScale(20), marginTop: moderateScale(10) }}>
             <View style={{
               backgroundColor: '#F0FDF4',
               borderRadius: scale(20),
               padding: moderateScale(18),
               borderWidth: 1.5,
               borderColor: '#BBF7D0',
               shadowColor: '#16A34A',
               shadowOffset: { width: 0, height: 4 },
               shadowOpacity: 0.1,
               shadowRadius: 8,
               elevation: 4
             }}>
               <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                 <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                   <MaterialIcons name="event-available" size={20} color="#16A34A" />
                 </View>
                 <View style={{ flex: 1 }}>
                   <Text style={{ fontSize: scale(15), fontWeight: 'bold', color: '#166534' }}>{MONTH_LABELS[new Date().getMonth()]} Fresh Start!</Text>
                   <Text style={{ fontSize: scale(12), color: '#15803D', marginTop: 1 }}>You have {formatCurrency(totalLeftover)} leftover from last month.</Text>
                 </View>
               </View>

               <Text style={{ fontSize: scale(13), color: '#166534', lineHeight: 18, marginBottom: 16 }}>
                 Would you like to move these funds back to <Text style={{fontWeight:'bold'}}>Ready to Budget</Text> to start your new monthly plan?
               </Text>

               <View style={{ flexDirection: 'row', gap: 10 }}>
                 <TouchableOpacity
                   onPress={function() { triggerImpactHaptic('Medium'); state.performMonthlySweep(); }}
                   style={{ flex: 1.5, backgroundColor: '#16A34A', borderRadius: 12, paddingVertical: 12, alignItems: 'center' }}
                 >
                   <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 }}>Reset Envelopes</Text>
                 </TouchableOpacity>
                 <TouchableOpacity
                   onPress={function() { triggerImpactHaptic('Light'); state.skipMonthlySweep(); }}
                   style={{ flex: 1, backgroundColor: '#FFFFFF', borderRadius: 12, paddingVertical: 12, alignItems: 'center', borderWidth: 1, borderColor: '#BBF7D0' }}
                 >
                   <Text style={{ color: '#15803D', fontWeight: 'bold', fontSize: 13 }}>Keep Rollover</Text>
                 </TouchableOpacity>
               </View>
             </View>
          </View>
        )}

      <Animated.View
        style={{ paddingHorizontal: moderateScale(20), paddingTop: moderateScale(isSimpleMode ? 16 : 15), opacity: contentFade, transform: [{ translateY: contentFade.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}
        onLayout={function (e) { scrollContentY.current = e.nativeEvent.layout.y; }}
      >

          {isSimpleMode ? (
            <>
              {renderWalletsSection()}

              {hasNoIncome ? (
                <EmptyStateCard
                  theme={theme}
                  icon="payments"
                  title="Set up your income"
                  message="Add your salary or other monthly income so Penny can track spending against what you earn."
                  actionLabel="Add income source"
                  onAction={function () { setShowIncomeModal(true); }}
                  compact={true}
                />
              ) : null}

              {renderMonthlyStats()}

              {renderDailyAuditButton()}

              {renderSavingsJar()}
            </>
          ) : (
            <>
              {renderMonthlyStats()}

              {renderDailyAuditButton()}

              {renderSavingsJar()}

              {hasNoIncome ? (
                <EmptyStateCard
                  theme={theme}
                  icon="payments"
                  title="Set up your income"
                  message="Add your salary or other monthly income so Penny can track spending against what you earn."
                  actionLabel="Add income source"
                  onAction={function () { setShowIncomeModal(true); }}
                  compact={true}
                />
              ) : null}

              {renderWalletsSection()}

              <Animated.View
                onLayout={function (e) { envelopeRowY.current = e.nativeEvent.layout.y; }}
                style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, opacity: envelopesFade, transform: [{ translateX: envelopesFade.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ ...theme.typography.h3, color: theme.colors.textPrimary, marginRight: 8 }}>Envelopes</Text>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <TouchableOpacity onPress={toggleEnvelopeView} style={{ padding: 4, marginRight: 12 }}>
                    <MaterialIcons name={envelopeViewMode === 'grid' ? "view-carousel" : "grid-view"} size={20} color={safePrimary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={handleTransferEnvPress} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
                    <MaterialIcons name="swap-horiz" size={16} color={safePrimary} style={{ marginRight: 4 }} />
                    <Text style={{ color: safePrimary, fontWeight: 'bold', fontSize: 14 }}>Transfer</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => setShowAddEnvModal(true)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                    <MaterialIcons name="add" size={16} color={safePrimary} style={{ marginRight: 4 }} />
                    <Text style={{ color: safePrimary, fontWeight: 'bold', fontSize: 14 }}>Add</Text>
                  </TouchableOpacity>
                </View>
              </Animated.View>

              {hasNoEnvelopes ? (
                <EmptyStateCard
                  theme={theme}
                  icon="folder-open"
                  title="No envelopes yet"
                  message="Envelopes are budgets for Housing, Food, Bills, and more. Create one, then assign money from Ready to Assign."
                  actionLabel="Create your first envelope"
                  onAction={function () { setShowAddEnvModal(true); }}
                />
              ) : (
                envelopeViewMode === 'carousel' ? (
                  <ScrollView
                    horizontal
                    showsHorizontalScrollIndicator={false}
                    nestedScrollEnabled={true}
                    style={{ minHeight: scale(140) }}
                    contentContainerStyle={{ paddingVertical: 4, paddingRight: 8, alignItems: 'center' }}
                  >
                    {state.envelopeBalances.map(function (env) {
                      const actualEnv = state.envelopes.find(ev => ev.id === env.id) || {};
                      const isOverspent = env.available < 0;
                      const accentColor = isOverspent ? theme.colors.error : theme.colors.primary;

                      return (
                        <Animated.View key={env.id} style={{ opacity: envelopesFade }}>
                          <Pressable
                            onPress={function () {
                              setQuickAddEnv(actualEnv);
                              setShowQuickAddModal(true);
                            }}
                            style={function ({ pressed }) {
                              return {
                                width: scale(210),
                                height: scale(140),
                                backgroundColor: theme.colors.card,
                                borderRadius: scale(28),
                                padding: moderateScale(20),
                                marginRight: moderateScale(16),
                                justifyContent: 'space-between',
                                shadowColor: accentColor,
                                shadowOffset: { width: 0, height: 8 },
                                shadowOpacity: 0.15,
                                shadowRadius: 12,
                                elevation: 6,
                                borderWidth: 1.5,
                                borderColor: isOverspent ? theme.colors.error + '33' : theme.colors.primary + '15',
                                opacity: pressed ? 0.94 : 1,
                                transform: [{ scale: pressed ? 0.97 : 1 }],
                                overflow: 'hidden'
                              };
                            }}
                          >
                            <View style={{ position: 'absolute', top: -scale(30), right: -scale(30), width: scale(100), height: scale(100), borderRadius: scale(50), backgroundColor: accentColor + '08' }} />

                            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                               <View style={{ backgroundColor: accentColor + '12', padding: scale(10), borderRadius: scale(14), borderWidth: 1, borderColor: accentColor + '15' }}>
                                 <MaterialIcons name={getEnvelopeIcon(env.name)} size={scale(24)} color={accentColor} />
                               </View>
                               <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                                  <TouchableOpacity
                                    onPress={function (e) {
                                      triggerImpactHaptic('Light');
                                      e.stopPropagation();
                                      promptDeleteEnvelope({
                                        envelopeId: env.id,
                                        envelopes: state.envelopes,
                                        recurringExpenses: state.recurringExpenses,
                                        userHistory: state.userHistory,
                                        onPerformDelete: function () {
                                          if (!state.userSettings) return;
                                          runSaveWithFeedback(
                                            deleteEnvelopeAndCleanup({
                                              envelopeId: env.id,
                                              envelopes: state.envelopes,
                                              recurringExpenses: state.recurringExpenses,
                                              userSettings: state.userSettings,
                                              mutateUpdateSettings: state.mutateUpdateSettings,
                                              mutateUpdateRecurring: state.mutateUpdateRecurring,
                                              mutateDeleteRecurring: state.mutateDeleteRecurring,
                                              userHistory: state.userHistory,
                                              mutateUpdateHistory: state.mutateUpdateHistory
                                            }),
                                            {
                                              onSaved: state.refetchAll,
                                              setShowSuccess: setShowScreenSaveSuccess,
                                              setSuccessMessage: setScreenSuccessMessage,
                                              message: 'Archived!',
                                              errorMessage: 'Could not archive envelope. Please try again.'
                                            }
                                          );
                                        }
                                      });
                                    }}
                                    style={{ padding: scale(7), backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderRadius: scale(10), borderWidth: 1, borderColor: theme.colors.border }}
                                  >
                                    <MaterialIcons name="archive" size={scale(16)} color={theme.colors.textSecondary} />
                                  </TouchableOpacity>
                                  {isOverspent && (
                                    <View style={{ backgroundColor: theme.colors.error, paddingHorizontal: 10, paddingVertical: 5, borderRadius: scale(8), shadowColor: theme.colors.error, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 3 }}>
                                      <Text style={{ fontSize: scale(9), color: '#FFFFFF', fontWeight: '900', letterSpacing: 0.5 }}>OVERSPENT</Text>
                                    </View>
                                  )}
                               </View>
                            </View>

                            <View>
                              <Text style={{ fontSize: scale(13.5), color: theme.colors.textPrimary, fontWeight: '700', letterSpacing: 0.3 }} numberOfLines={1}>{env.name}</Text>
                              <Text style={{ fontSize: scale(22), color: isOverspent ? theme.colors.error : theme.colors.textPrimary, fontWeight: '900', marginTop: 4 }}>{maskAmount(env.available)}</Text>

                              <View style={{ height: scale(8), backgroundColor: theme.isDark ? '#262626' : '#F3F4F6', borderRadius: scale(4), marginTop: 12, overflow: 'hidden', borderWidth: 0.5, borderColor: theme.colors.border }}>
                                <View style={{
                                  width: `${Math.min(100, env.spentPct)}%`,
                                  height: '100%',
                                  backgroundColor: env.spentPct >= 100 ? theme.colors.error : theme.colors.primary,
                                  borderRadius: scale(4),
                                  shadowColor: env.spentPct >= 100 ? theme.colors.error : theme.colors.primary,
                                  shadowOffset: { width: 0, height: 0 },
                                  shadowOpacity: 0.5,
                                  shadowRadius: 4
                                }} />
                              </View>
                            </View>
                          </Pressable>
                        </Animated.View>
                      );
                    })}
                  </ScrollView>
                ) : (
                  <Animated.View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', opacity: envelopesFade, transform: [{ translateY: envelopesFade.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
                    {state.envelopeBalances.map(env => {
                      const actualEnv = state.envelopes.find(ev => ev.id === env.id) || {};
                      const goalAmount = actualEnv.goal_amount || 0;
                      const goalPct = goalAmount > 0 ? Math.min(100, Math.round((env.available / goalAmount) * 100)) : 0;
                      const isOverspent = env.available < 0;
                      const accentColor = isOverspent ? theme.colors.error : theme.colors.primary;

                      return (
                        <TouchableOpacity key={env.id} onPress={function () {
                          setQuickAddEnv(actualEnv);
                          setShowQuickAddModal(true);
                        }} style={{
                          width: '48%',
                          backgroundColor: theme.colors.card,
                          borderRadius: scale(24),
                          padding: moderateScale(18),
                          marginBottom: moderateScale(16),
                          shadowColor: accentColor,
                          shadowOffset: { width: 0, height: 6 },
                          shadowOpacity: 0.12,
                          shadowRadius: 10,
                          elevation: 4,
                          borderWidth: 1.5,
                          borderColor: isOverspent ? theme.colors.error + '25' : theme.colors.border,
                          overflow: 'hidden'
                        }}>
                          <View style={{ position: 'absolute', top: -scale(20), right: -scale(20), width: scale(60), height: scale(60), borderRadius: scale(30), backgroundColor: accentColor + '05' }} />

                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(14) }}>
                            <View style={{ backgroundColor: accentColor + '12', padding: scale(8), borderRadius: scale(10), borderWidth: 1, borderColor: accentColor + '15' }}>
                              <MaterialIcons name={getEnvelopeIcon(env.name)} size={scale(20)} color={accentColor} />
                            </View>
                            <View style={{ flexDirection: 'row', alignItems: 'center', gap: moderateScale(6) }}>
                              <TouchableOpacity onPress={function (e) {
                                triggerImpactHaptic('Light');
                                e.stopPropagation();
                                promptDeleteEnvelope({
                                  envelopeId: env.id,
                                  envelopes: state.envelopes,
                                  recurringExpenses: state.recurringExpenses,
                                  userHistory: state.userHistory,
                                  onPerformDelete: function () {
                                    if (!state.userSettings) return;
                                    runSaveWithFeedback(
                                      deleteEnvelopeAndCleanup({
                                        envelopeId: env.id,
                                        envelopes: state.envelopes,
                                        recurringExpenses: state.recurringExpenses,
                                        userSettings: state.userSettings,
                                        mutateUpdateSettings: state.mutateUpdateSettings,
                                        mutateUpdateRecurring: state.mutateUpdateRecurring,
                                        mutateDeleteRecurring: state.mutateDeleteRecurring,
                                        userHistory: state.userHistory,
                                        mutateUpdateHistory: state.mutateUpdateHistory
                                      }),
                                      {
                                        onSaved: state.refetchAll,
                                        setShowSuccess: setShowScreenSaveSuccess,
                                        setSuccessMessage: setScreenSuccessMessage,
                                        message: 'Archived!',
                                        errorMessage: 'Could not archive envelope. Please try again.'
                                      }
                                    );
                                  }
                                });
                              }} style={{ padding: scale(5), backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.03)', borderRadius: scale(8), borderWidth: 1, borderColor: theme.colors.border }}>
                                <MaterialIcons name="archive" size={scale(14)} color={theme.colors.textSecondary} />
                              </TouchableOpacity>
                            </View>
                          </View>
                          <Text style={{ fontSize: scale(13.5), fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 5 }} numberOfLines={1}>{env.name}</Text>
                          <Text style={{ fontSize: scale(18), fontWeight: '900', color: isOverspent ? theme.colors.error : theme.colors.textPrimary }}>{maskAmount(env.available)}</Text>

                          {env.spentThisMonth > 0 && (
                            <Text style={{ fontSize: scale(9.5), color: theme.colors.textSecondary, marginTop: 6, fontWeight: '700', opacity: 0.8 }}>
                              Used: {formatCurrency(env.spentThisMonth)}
                            </Text>
                          )}

                          <View style={{ height: scale(6), backgroundColor: theme.isDark ? '#262626' : '#F3F4F6', borderRadius: scale(3), marginTop: 12, overflow: 'hidden', borderWidth: 0.5, borderColor: theme.colors.border }}>
                            <View style={{
                              width: `${Math.min(100, env.spentPct)}%`,
                              height: '100%',
                              backgroundColor: env.spentPct >= 100 ? theme.colors.error : theme.colors.primary,
                              shadowColor: env.spentPct >= 100 ? theme.colors.error : theme.colors.primary,
                              shadowOffset: { width: 0, height: 0 },
                              shadowOpacity: 0.4,
                              shadowRadius: 3
                            }} />
                          </View>

                          {goalAmount > 0 ? (
                            <View style={{ marginTop: 12, backgroundColor: theme.isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.05)', borderRadius: scale(12), padding: scale(8), borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.15)' }}>
                              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                                <Text style={{ fontSize: scale(8), color: '#059669', fontWeight: '900', letterSpacing: 0.5 }}>GOAL</Text>
                                <Text style={{ fontSize: scale(8), color: '#059669', fontWeight: '900' }}>{goalPct}%</Text>
                              </View>
                              <Text style={{ fontSize: scale(10), fontWeight: '800', color: theme.colors.textPrimary }} numberOfLines={1}>
                                {maskAmount(env.available)} / {formatCurrency(goalAmount)}
                              </Text>
                            </View>
                          ) : null}
                        </TouchableOpacity>
                      );
                    })}
                  </Animated.View>
                )
              )}
            </>
          )}

        </Animated.View>
      </ScrollView>
      <Animated.View style={[{ position: 'absolute', right: 20, bottom: fabBottom, zIndex: 100 }, animatedFabStyle]}>
        <TouchableOpacity
          onPress={onPressFab}
          style={{
            width: 56,
            height: 56,
            borderRadius: 28,
            backgroundColor: theme.colors.primary,
            alignItems: 'center',
            justifyContent: 'center',
            shadowColor: theme.colors.primary,
            shadowOffset: { width: 0, height: 4 },
            shadowOpacity: 0.4,
            shadowRadius: 8,
            elevation: 6
          }}
        >
          <MaterialIcons name="add" size={28} color="#FFFFFF" />
        </TouchableOpacity>
      </Animated.View>

      <AddExpenseModal visible={state.showAddModal} onClose={() => state.setShowAddModal(false)} onSaved={state.refetchAll} userId={userId} theme={theme} insetsTop={insets.top} insetsBottom={insets.bottom} envelopes={state.envelopeBalances} accounts={state.accounts} />
      <OnboardingModal visible={state.showOnboarding} onClose={() => { state.setShowOnboarding(false); state.refetchAll(); }} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} />
      <SpentManagerModal
        visible={showSpentModal}
        onClose={function () { setShowSpentModal(false); }}
        filter={spentFilter}
        oneTimeExpenses={state.oneTimeExpenses}
        envelopes={state.envelopes}
        userId={userId}
        theme={theme}
        insetsTop={insets.top}
        insetsBottom={insets.bottom}
        onSaved={state.refetchAll}
        userHistory={state.userHistory}
        recurringExpenses={state.recurringExpenses}
        accounts={state.accounts}
        isSimpleMode={isSimpleMode}
      />
      <QuickAddBudgetModal visible={showQuickAddModal} onClose={function () { setShowQuickAddModal(false); }} envelope={quickAddEnv} readyToAssign={state.readyToAssign} envelopes={state.envelopes} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} onSaved={state.refetchAll} theme={theme} setSelectedEnvelope={setSelectedEnvelope} setShowEditEnvModal={setShowEditEnvModal} userId={userId} />
      <IncomeManagerModal
        visible={showIncomeModal}
        onClose={function () { setShowIncomeModal(false); }}
        accounts={state.accounts}
        userSettings={state.userSettings}
        userHistory={state.userHistory}
        theme={theme}
        insetsBottom={insets.bottom}
        onSaved={state.refetchAll}
        onAddAccount={() => { setShowIncomeModal(false); setShowAddAccountModal(true); }}
        readyToAssign={state.readyToAssign}
        totalAvailableMoney={state.totalAvailableMoney}
        envelopes={state.envelopes}
        envelopeBalances={state.envelopeBalances}
        oneTimeExpenses={state.oneTimeExpenses}
        incomeSources={state.incomeSources}
        mutateUpdateSettings={state.mutateUpdateSettings}
      />
      <AddEnvelopeModal visible={showAddEnvModal} onClose={function () { setShowAddEnvModal(false); }} envelopes={state.envelopes} readyToAssign={state.readyToAssign} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} onSaved={state.refetchAll} userId={userId} setShowPremiumModal={setShowPremiumModal} />
      <EditEnvelopeModal visible={showEditEnvModal} onClose={function () { setShowEditEnvModal(false); setSelectedEnvelope(null); }} envelope={selectedEnvelope} readyToAssign={state.readyToAssign} envelopes={state.envelopes} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} mutateUpdateRecurring={state.mutateUpdateRecurring} mutateDeleteRecurring={state.mutateDeleteRecurring} recurringExpenses={state.recurringExpenses} onSaved={state.refetchAll} userHistory={state.userHistory} mutateUpdateHistory={state.mutateUpdateHistory} />
      <TransferEnvelopeModal visible={showTransferEnvModal} onClose={function () { setShowTransferEnvModal(false); }} envelopes={state.envelopes} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} onSaved={state.refetchAll} />
      <TransferWalletModal
        visible={showTransferWalletModal}
        onClose={function () { setShowTransferWalletModal(false); }}
        accounts={state.accounts}
        userHistory={state.userHistory}
        onSaved={state.refetchAll}
        theme={theme}
        insetsBottom={insets.bottom}
        userId={userId}
        userSettings={state.userSettings}
      />
      <SavingsManagerModal visible={showSavingsManagerModal} onClose={function () { setShowSavingsManagerModal(false); }} state={state} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} onSaved={state.refetchAll} />

      <AddAccountModal visible={showAddAccountModal} onClose={() => setShowAddAccountModal(false)} accounts={state.accounts} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} onSaved={state.refetchAll} userId={userId} setShowPremiumModal={setShowPremiumModal} />
      <EditAccountModal visible={showEditAccountModal} onClose={() => { setShowEditAccountModal(false); setSelectedAccount(null); }} account={selectedAccount} accounts={state.accounts} userSettings={state.userSettings} envelopeBalances={state.envelopeBalances} mutateUpdateSettings={state.mutateUpdateSettings} onSaved={state.refetchAll} userId={userId} userHistory={state.userHistory} />
      <NotificationCenterModal visible={showNotificationCenter} onClose={function () { setShowNotificationCenter(false); }} state={state} theme={theme} insets={insets} smartInsights={smartInsights} />
      <ArchiveManagerModal
        visible={showArchiveModal}
        onClose={() => setShowArchiveModal(false)}
        envelopes={state.envelopes}
        accounts={state.allAccounts}
        userSettings={state.userSettings}
        mutateUpdateSettings={state.mutateUpdateSettings}
        onSaved={state.refetchAll}
        theme={theme}
      />
      <PremiumPaywallModal
        visible={showPremiumModal}
        onClose={() => setShowPremiumModal(false)}
        theme={theme}
        userSettings={state.userSettings}
        mutateUpdateSettings={state.mutateUpdateSettings}
        onSaved={state.refetchAll}
      />

      <Modal visible={infoModalConfig.visible} animationType="fade" transparent={true} onRequestClose={() => setInfoModalConfig({ ...infoModalConfig, visible: false })}>
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

      <SaveSuccessOverlay visible={showScreenSaveSuccess} theme={theme} message={screenSuccessMessage} />

      <Modal visible={showDailyAudit} animationType="slide" transparent={true} onRequestClose={() => setShowDailyAudit(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingHorizontal: 24, paddingTop: 12, paddingBottom: insets.bottom + 30, maxHeight: '80%' }}>
            <View style={{ width: 40, height: 5, backgroundColor: theme.colors.border, borderRadius: 3, alignSelf: 'center', marginBottom: 20, opacity: 0.5 }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
              <View>
                <Text style={{ fontSize: 22, fontWeight: '900', color: theme.colors.textPrimary }}>Daily Audit</Text>
                <Text style={{ fontSize: 13, color: theme.colors.textSecondary, fontWeight: '600' }}>{formatDate(getTodayStr())}</Text>
              </View>
              <TouchableOpacity onPress={() => setShowDailyAudit(false)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border }}>
                <MaterialIcons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', gap: 12, marginBottom: 24 }}>
              <View style={{ flex: 1, backgroundColor: '#DCFCE7', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#BBF7D0' }}>
                 <Text style={{ fontSize: 10, fontWeight: '900', color: '#166534', textTransform: 'uppercase', marginBottom: 4 }}>Earned Today</Text>
                 <Text style={{ fontSize: 18, fontWeight: '900', color: '#166534' }}>{formatCurrency(dailyStats.earned)}</Text>
              </View>
              <View style={{ flex: 1, backgroundColor: '#FEE2E2', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#FECACA' }}>
                 <Text style={{ fontSize: 10, fontWeight: '900', color: '#991B1B', textTransform: 'uppercase', marginBottom: 4 }}>Spent Today</Text>
                 <Text style={{ fontSize: 18, fontWeight: '900', color: '#991B1B' }}>{formatCurrency(dailyStats.spent)}</Text>
              </View>
            </View>

            <Text style={{ fontSize: 12, fontWeight: '900', color: theme.colors.textSecondary, textTransform: 'uppercase', marginBottom: 12, letterSpacing: 1 }}>Transaction Breakdown</Text>

            <ScrollView showsVerticalScrollIndicator={false}>
              {dailyStats.history.length === 0 ? (
                <View style={{ padding: 40, alignItems: 'center' }}>
                  <MaterialIcons name="history" size={48} color={theme.colors.border} />
                  <Text style={{ marginTop: 12, color: theme.colors.textSecondary, fontWeight: '600' }}>No activity logged today.</Text>
                </View>
              ) : (
                dailyStats.history.map((h) => {
                  const isIncome = h.expense_type === 'Income' || (h.expense_type === 'Adjustment' && h.category === 'Income');
                  const isTransfer = h.expense_type === 'Transfer';
                  const color = isIncome ? '#16A34A' : (isTransfer ? '#2563EB' : '#DC2626');
                  const bg = isIncome ? '#DCFCE7' : (isTransfer ? '#DBEAFE' : '#FEE2E2');

                  return (
                    <View key={h.id} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.background, padding: 14, borderRadius: 16, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border }}>
                      <View style={{ width: 40, height: 40, borderRadius: 10, backgroundColor: bg, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                        <MaterialIcons name={isIncome ? 'trending-up' : (isTransfer ? 'swap-horiz' : 'trending-down')} size={20} color={color} />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary }} numberOfLines={1}>{h.expense_name}</Text>
                        <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 }}>{h.expense_type}</Text>
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: '900', color: color }}>
                        {isIncome ? '+' : (isTransfer ? '' : '-')}{formatCurrency(h.amount)}
                      </Text>
                    </View>
                  );
                })
              )}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default DashboardScreen;

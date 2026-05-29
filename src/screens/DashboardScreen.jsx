import React, { useState, useMemo, useRef, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Pressable, Platform, Modal, Image, Animated, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import AddExpenseModal from '../components/AddExpenseModal';
import SaveSuccessOverlay from '../components/SaveSuccessOverlay';
import EmptyStateCard from '../components/EmptyStateCard';
import RtaNudgeBanner from '../components/RtaNudgeBanner';
import TrialCountdownBanner from '../components/TrialCountdownBanner';
import OnboardingModal from '../components/OnboardingModal';
import BrandLogo from '../components/BrandLogo';
import { runSaveWithFeedback } from '../utils/saveSuccess';
import { deleteEnvelopeAndCleanup } from '../utils/envelopeBudget';
import { hasUserEnvelopes, showEnvelopeRequiredAlert } from '../utils/envelopeGuards';
import logoImg from '../assets/logo.png';
import { formatCurrency } from '../utils/helpers';
import { triggerImpactHaptic } from '../utils/feedback';
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
  NotificationCenterModal
} from './dashboard/modals';

const DashboardScreen = function (props) {
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var userCtx = useUser();
  var userId = userCtx.currentUser ? userCtx.currentUser.id : '';
  var userName = userCtx.currentUser ? userCtx.currentUser.name : 'User';
  var insets = useSafeAreaInsets();
  var state = useDashboardState(userId);

  var [balancesVisible, setBalancesVisible] = useState(function() {
    try {
      var saved = localStorage.getItem('penny_balances_visible');
      return saved !== null ? JSON.parse(saved) : true;
    } catch (e) { return true; }
  });

  var [walletViewMode, setWalletViewMode] = useState(function() {
    try {
      var saved = localStorage.getItem('penny_wallet_view_mode');
      return saved || 'carousel';
    } catch (e) { return 'carousel'; }
  });

  var [envelopeViewMode, setEnvelopeViewMode] = useState(function() {
    try {
      var saved = localStorage.getItem('penny_envelope_view_mode');
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

  var toggleBalances = function() {
    triggerImpactHaptic('Medium');
    setBalancesVisible(!balancesVisible);
  };
  var toggleWalletView = function() {
    triggerImpactHaptic('Light');
    setWalletViewMode(walletViewMode === 'carousel' ? 'grid' : 'carousel');
  };
  var toggleEnvelopeView = function() {
    triggerImpactHaptic('Light');
    setEnvelopeViewMode(envelopeViewMode === 'grid' ? 'carousel' : 'grid');
  };
  var maskAmount = function(amt) {
    return balancesVisible ? formatCurrency(amt) : '••••••';
  };

  var smartInsights = useMemo(function () {
    var insights = [];
    var today = new Date().toISOString().split('T')[0];

    var isStealthDark = theme.isDark && theme.colors.primary === '#111827';
    var safePrimary = isStealthDark ? '#E5E7EB' : theme.colors.primary;

    // 1. Low Envelopes warning
    state.envelopeBalances.forEach(function (env) {
      if (env.assigned > 0 && env.spent > 0) {
        var pct = (env.available / env.assigned) * 100;
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
    var baseIncome = state.incomeSources.reduce(function (sum, src) { return sum + (parseFloat(src.amount) || 0); }, 0);
    if (baseIncome > 0) {
      var spendRatio = (state.totalExpenses / baseIncome) * 100;
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
    var overdueCount = state.recurringExpenses ? state.recurringExpenses.filter(r => r.status === 'Pending' && r.due_date < today).length : 0;
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
  var contentFade = useRef(new Animated.Value(0)).current;
  var walletsFade = useRef(new Animated.Value(0)).current;
  var envelopesFade = useRef(new Animated.Value(0)).current;

  useEffect(function() {
    Animated.stagger(150, [
      Animated.timing(contentFade, { toValue: 1, duration: 600, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(walletsFade, { toValue: 1, duration: 500, useNativeDriver: Platform.OS !== 'web' }),
      Animated.timing(envelopesFade, { toValue: 1, duration: 500, useNativeDriver: Platform.OS !== 'web' })
    ]).start();
  }, []);

  // FAB Animation
  var fabScale = useRef(new Animated.Value(1)).current;
  var animatedFabStyle = {
    transform: [{ scale: fabScale }]
  };

  var onPressFab = function() {
    triggerImpactHaptic('Medium');
    Animated.sequence([
      Animated.spring(fabScale, { toValue: 1.15, useNativeDriver: Platform.OS !== 'web' }),
      Animated.spring(fabScale, { toValue: 1, useNativeDriver: Platform.OS !== 'web' })
    ]).start();

    if (!hasUserEnvelopes(state.userSettings)) {
      showEnvelopeRequiredAlert({ onAcknowledge: function () { setShowAddEnvModal(true); } });
      return;
    }
    state.setShowAddModal(true);
  };
  var [showSpentModal, setShowSpentModal] = useState(false);
  var [spentFilter, setSpentFilter] = useState(null);
  var [showIncomeModal, setShowIncomeModal] = useState(false);
  var [showAddEnvModal, setShowAddEnvModal] = useState(false);
  var [showEditEnvModal, setShowEditEnvModal] = useState(false);
  var [selectedEnvelope, setSelectedEnvelope] = useState(null);
  var [showAddAccountModal, setShowAddAccountModal] = useState(false);
  var [showEditAccountModal, setShowEditAccountModal] = useState(false);
  var [selectedAccount, setSelectedAccount] = useState(null);
  var [showSavingsManagerModal, setShowSavingsManagerModal] = useState(false);
  var [showNotificationCenter, setShowNotificationCenter] = useState(false);

  // High-End Alert Persistence: Track how many alerts the user has already acknowledged
  var [lastSeenAlertCount, setLastSeenAlertCount] = useState(function() {
    try {
      return parseInt(localStorage.getItem('penny_last_seen_alert_count')) || 0;
    } catch (e) { return 0; }
  });

  // Calculate the current total number of active alerts/reminders
  var currentAlertCount = useMemo(function() {
    var insightCount = smartInsights.filter(i => i.type !== 'info').length;
    var billCount = state.recurringExpenses ? state.recurringExpenses.filter(r => r.status === 'Pending').length : 0;
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

  var hasNewAlerts = currentAlertCount > lastSeenAlertCount;

  var [showTransferEnvModal, setShowTransferEnvModal] = useState(false);
  var [showTransferWalletModal, setShowTransferWalletModal] = useState(false);
  var [insightIndex, setInsightIndex] = useState(0);
  var [infoModalConfig, setInfoModalConfig] = useState({ visible: false, title: '', content: null });
  var [showQuickAddModal, setShowQuickAddModal] = useState(false);
  var [quickAddEnv, setQuickAddEnv] = useState(null);
  var [showScreenSaveSuccess, setShowScreenSaveSuccess] = useState(false);
  var [screenSuccessMessage, setScreenSuccessMessage] = useState('Saved!');
  var scrollRef = useRef(null);
  var scrollContentY = useRef(0);
  var envelopeRowY = useRef(0);
  var scrollBottomPadding = Platform.OS === 'web' ? WEB_TAB_MENU_PADDING : (TAB_MENU_HEIGHT + insets.bottom + SCROLL_EXTRA_PADDING);
  var fabBottom = Platform.OS === 'web' ? WEB_TAB_MENU_PADDING : (TAB_MENU_HEIGHT + insets.bottom + FAB_SPACING);

  var totalAvailableMoney = state.accounts.reduce(function (sum, acc) { return sum + acc.balance; }, 0);
  var totalActualMoney = totalAvailableMoney;
  var rtaColor = state.readyToAssign === 0 ? '#10B981' : (state.readyToAssign > 0 ? theme.colors.primary : theme.colors.error);
  var hasNoAccounts = state.accounts.length === 0;
  var hasNoEnvelopes = state.envelopeBalances.length === 0;
  var hasNoIncome = state.totalIncome <= 0;

  var handleRtaNudgePress = function () {
    if (hasNoEnvelopes) {
      setShowAddEnvModal(true);
      return;
    }
    if (scrollRef.current) {
      var targetY = scrollContentY.current + envelopeRowY.current - 12;
      scrollRef.current.scrollTo({ y: Math.max(0, targetY), animated: true });
    }
  };

  var handleTotalMoneyInfo = function () {
    var accountsList = state.accounts.map(a => ({ name: a.name, amount: a.balance }));
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

  var handleTransferWalletPress = function () {
    triggerImpactHaptic('Light');
    if (state.accounts.length < 2) {
      var msg = "Add another wallet or bank account so you can move money between them.";
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

  var handleTransferEnvPress = function () {
    triggerImpactHaptic('Light');
    if (state.envelopes.length < 2) {
      var msg = "Add another envelope so you can move budget between your categories.";
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

  var handleReadyToAssignInfo = function () {
    var orphanNote = state.orphanPendingTotal > 0 ? (
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

  var handleWalletsInfo = function () {
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

  var smartInsights = useMemo(function () {
    var insights = [];
    var today = new Date().toISOString().split('T')[0];

    var isStealthDark = theme.isDark && theme.colors.primary === '#111827';
    var safePrimary = isStealthDark ? '#E5E7EB' : theme.colors.primary;

    // 1. Low Envelopes warning
    state.envelopeBalances.forEach(function (env) {
      if (env.assigned > 0 && env.spent > 0) {
        var pct = (env.available / env.assigned) * 100;
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
    var baseIncome = state.incomeSources.reduce(function (sum, src) { return sum + (parseFloat(src.amount) || 0); }, 0);
    if (baseIncome > 0) {
      var spendRatio = (state.totalExpenses / baseIncome) * 100;
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
    var overdueCount = state.recurringExpenses ? state.recurringExpenses.filter(r => r.status === 'Pending' && r.due_date < today).length : 0;
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

  var activeInsight = smartInsights[insightIndex % smartInsights.length] || smartInsights[0];

  var currentHour = new Date().getHours();
  var greeting = "Good Evening";
  var aiMessage = "You're doing great. 🌙";
  if (currentHour < 12) {
    greeting = "Good Morning";
    aiMessage = "Let's crush those savings goals today! ☕";
  } else if (currentHour < 18) {
    greeting = "Good Afternoon";
    aiMessage = "Stay on track, you've got this! ✨";
  }

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView ref={scrollRef} style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: scrollBottomPadding + FAB_SCROLL_BOTTOM_EXTRA }}>

        {/* Header Block (Floating Card Style) */}
        <View style={{ paddingTop: insets.top + 16, paddingHorizontal: 20, paddingBottom: 10 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <Image source={logoImg} style={{ width: 44, height: 44, borderRadius: 22, borderWidth: 1, borderColor: theme.colors.border }} />
              <View>
                <Text style={{ ...theme.typography.caption, color: theme.colors.textSecondary, letterSpacing: 1 }}>PENNY BUDGETING</Text>
                <Text style={{ ...theme.typography.h3, color: theme.colors.textPrimary }}>{greeting}, {userName}!</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              onPress={function () { triggerImpactHaptic('Light'); state.setShowOnboarding(true); }}
              accessibilityLabel="Open app tour"
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' }}
            >
              <MaterialIcons name="help-outline" size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={function () { triggerImpactHaptic('Light'); setShowNotificationCenter(true); }}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' }}
            >
              <MaterialIcons name="notifications-active" size={22} color={theme.colors.primary} />
              {hasNewAlerts && (
                <View style={{ position: 'absolute', top: 2, right: 2, backgroundColor: theme.colors.error, borderRadius: 10, minWidth: 20, height: 20, paddingHorizontal: 4, borderWidth: 2, borderColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: 'bold' }}>
                    {(currentAlertCount - lastSeenAlertCount) > 0 ? (currentAlertCount - lastSeenAlertCount) : '!'}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
            </View>
          </View>

          <View style={{
            backgroundColor: theme.colors.primary,
            borderRadius: 24,
            padding: 24,
            flexDirection: 'column',
            gap: 18,
            shadowColor: theme.colors.primary,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.25,
            shadowRadius: 12,
            elevation: 8,
            overflow: 'hidden'
          }}>
            {/* Background overlapping circles for depth */}
            <View style={{ position: 'absolute', top: -40, right: -20, width: 140, height: 140, borderRadius: 70, backgroundColor: 'rgba(255,255,255,0.08)' }} />
            <View style={{ position: 'absolute', bottom: -50, left: -30, width: 120, height: 120, borderRadius: 60, backgroundColor: 'rgba(255,255,255,0.05)' }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
              <View>
                <TouchableOpacity onPress={handleTotalMoneyInfo} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ ...theme.typography.caption, color: 'rgba(255,255,255,0.85)', letterSpacing: 0.5 }}>TOTAL NET WORTH</Text>
                  <MaterialIcons name="info-outline" size={14} color="rgba(255,255,255,0.8)" style={{ marginLeft: 4 }} />
                </TouchableOpacity>
                <Text style={{ ...theme.typography.h1, color: '#FFFFFF' }}>{maskAmount(totalActualMoney)}</Text>
              </View>
              <TouchableOpacity
                onPress={toggleBalances}
                style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
              >
                <MaterialIcons name={balancesVisible ? "visibility" : "visibility-off"} size={22} color="#FFFFFF" />
              </TouchableOpacity>
            </View>

            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 2 }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <TouchableOpacity onPress={handleReadyToAssignInfo} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.7)', fontWeight: '600', textTransform: 'uppercase' }}>Ready to Budget</Text>
                <Text style={{ fontSize: 13, color: '#6EE7B7', fontWeight: 'bold', marginLeft: 8 }}>{maskAmount(state.readyToAssign)}</Text>
              </TouchableOpacity>

              {state.readyToAssign < 0 && (
                <View style={{ backgroundColor: 'rgba(239, 68, 68, 0.2)', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                  <Text style={{ fontSize: 10, color: '#FECACA', fontWeight: 'bold' }}>OVER-ASSIGNED</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Content Container with standard padding */}
      <Animated.View
        style={{ paddingHorizontal: 20, paddingTop: 20, opacity: contentFade, transform: [{ translateY: contentFade.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}
        onLayout={function (e) { scrollContentY.current = e.nativeEvent.layout.y; }}
      >

          {/* Monthly Stats Card - Professional Redesign */}
          <View style={{ backgroundColor: theme.colors.card, borderRadius: 24, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 4, borderWidth: 1, borderColor: theme.colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 18 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                <View style={{ width: 32, height: 32, borderRadius: 10, backgroundColor: theme.colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                  <MaterialIcons name="auto-graph" size={18} color={theme.colors.primary} />
                </View>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.textPrimary }}>Money Manager</Text>
              </View>
              <View style={{ backgroundColor: theme.isDark ? '#374151' : '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 }}>
                <Text style={{ fontSize: 10, color: theme.colors.textSecondary, fontWeight: 'bold' }}>THIS MONTH</Text>
              </View>
            </View>

            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 20 }}>
              {/* Income Block */}
              <TouchableOpacity
                onPress={function () { triggerImpactHaptic('Light'); setShowIncomeModal(true); }}
                style={{ flex: 1, backgroundColor: theme.isDark ? 'rgba(16, 185, 129, 0.05)' : '#F0FDF4', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: theme.isDark ? 'rgba(16, 185, 129, 0.2)' : '#DCFCE7' }}
              >
                <Text style={{ fontSize: 10, color: '#16A34A', fontWeight: '800', marginBottom: 6, letterSpacing: 0.5 }}>INCOME</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary }} numberOfLines={1}>{maskAmount(state.totalIncome)}</Text>
                <MaterialIcons name="add-circle" size={14} color="#16A34A" style={{ position: 'absolute', top: 12, right: 12, opacity: 0.6 }} />
              </TouchableOpacity>

              {/* Spent Block */}
              <TouchableOpacity
                onPress={function () { triggerImpactHaptic('Light'); setSpentFilter(null); setShowSpentModal(true); }}
                style={{ flex: 1, backgroundColor: theme.isDark ? 'rgba(239, 68, 68, 0.05)' : '#FEF2F2', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: theme.isDark ? 'rgba(239, 68, 68, 0.2)' : '#FEE2E2' }}
              >
                <Text style={{ fontSize: 10, color: '#DC2626', fontWeight: '800', marginBottom: 6, letterSpacing: 0.5 }}>SPENT</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary }} numberOfLines={1}>{maskAmount(state.totalExpenses)}</Text>
                <MaterialIcons name="visibility" size={14} color="#DC2626" style={{ position: 'absolute', top: 12, right: 12, opacity: 0.6 }} />
              </TouchableOpacity>

              {/* Savings Block */}
              <TouchableOpacity
                onPress={function () { triggerImpactHaptic('Light'); setShowSavingsManagerModal(true); }}
                style={{ flex: 1, backgroundColor: theme.isDark ? 'rgba(59, 130, 246, 0.05)' : '#EFF6FF', borderRadius: 16, padding: 12, borderWidth: 1, borderColor: theme.isDark ? 'rgba(59, 130, 246, 0.2)' : '#DBEAFE' }}
              >
                <Text style={{ fontSize: 10, color: '#2563EB', fontWeight: '800', marginBottom: 6, letterSpacing: 0.5 }}>SAVINGS</Text>
                <Text style={{ fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary }} numberOfLines={1}>{maskAmount(state.totalSaved)}</Text>
                <MaterialIcons name="account-balance-wallet" size={14} color="#2563EB" style={{ position: 'absolute', top: 12, right: 12, opacity: 0.6 }} />
              </TouchableOpacity>
            </View>

            {/* Spending Progress Bar - Premium Finish */}
            <View style={{ backgroundColor: theme.isDark ? 'rgba(0,0,0,0.1)' : '#F9FAFB', padding: 14, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <Text style={{ fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600' }}>Budget Utilization</Text>
                </View>
                <Text style={{ fontSize: 13, fontWeight: '800', color: state.totalIncome > 0 && (state.totalExpenses / state.totalIncome) > 0.9 ? theme.colors.error : theme.colors.primary }}>
                  {state.totalIncome > 0 ? Math.round((state.totalExpenses / state.totalIncome) * 100) : 0}%
                </Text>
              </View>
              <View style={{ height: 8, backgroundColor: theme.isDark ? '#374151' : '#E5E7EB', borderRadius: 6, overflow: 'hidden' }}>
                <View style={{
                  width: (state.totalIncome > 0 ? Math.min(100, (state.totalExpenses / state.totalIncome) * 100) : 0) + '%',
                  height: '100%',
                  backgroundColor: state.totalIncome > 0 && (state.totalExpenses / state.totalIncome) > 0.9 ? theme.colors.error : theme.colors.primary,
                  borderRadius: 6,
                  shadowColor: state.totalIncome > 0 && (state.totalExpenses / state.totalIncome) > 0.9 ? theme.colors.error : theme.colors.primary,
                  shadowOffset: { width: 0, height: 0 },
                  shadowOpacity: 0.5,
                  shadowRadius: 4
                }} />
              </View>
            </View>
          </View>

          {hasNoIncome ? (
            <EmptyStateCard
              theme={theme}
              icon="payments"
              title="Set up your income"
              message="Add your salary or other monthly income so Budget-Wise can track spending against what you earn."
              actionLabel="Add income source"
              onAction={function () { setShowIncomeModal(true); }}
              compact={true}
            />
          ) : null}

          {/* Wallets & Bank Accounts Section */}
          <Animated.View style={{ marginBottom: 24, opacity: walletsFade, transform: [{ translateX: walletsFade.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <TouchableOpacity onPress={handleWalletsInfo} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ ...theme.typography.h3, color: theme.colors.textPrimary, marginRight: 6 }}>Wallets & Accounts</Text>
                <MaterialIcons name="info-outline" size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
              <View style={{ flexDirection: 'row', gap: 14, alignItems: 'center' }}>
                <TouchableOpacity onPress={toggleWalletView} style={{ padding: 4 }}>
                  <MaterialIcons name={walletViewMode === 'carousel' ? "grid-view" : "view-carousel"} size={20} color={theme.colors.primary} />
                </TouchableOpacity>
                <TouchableOpacity onPress={handleTransferWalletPress} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialIcons name="swap-horiz" size={16} color={theme.colors.primary} style={{ marginRight: 4 }} />
                  <Text style={{ color: theme.colors.primary, fontWeight: 'bold', fontSize: 14 }}>Transfer</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { triggerImpactHaptic('Light'); setShowAddAccountModal(true); }} style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialIcons name="add" size={16} color={theme.colors.primary} style={{ marginRight: 4 }} />
                  <Text style={{ color: theme.colors.primary, fontWeight: 'bold', fontSize: 14 }}>Add</Text>
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
              walletViewMode === 'carousel' ? (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  nestedScrollEnabled={true}
                  style={{ minHeight: 118 }}
                  contentContainerStyle={{ paddingVertical: 4, paddingRight: 8, alignItems: 'center' }}
                >
                  {state.accounts.map(function (acc) {
                    var walletStyle = WALLET_STYLES[acc.type] || WALLET_STYLES.Custom;
                    var openWalletEditor = function () {
                      triggerImpactHaptic('Light');
                      setSelectedAccount(acc);
                      setShowEditAccountModal(true);
                    };
                    return (
                      <Animated.View key={acc.id} style={{ opacity: walletsFade }}>
                        <Pressable
                          onPress={openWalletEditor}
                          style={function (pressed) {
                            return {
                              width: 180,
                              height: 110,
                              backgroundColor: acc.color || walletStyle.color,
                              borderRadius: 20,
                              padding: 16,
                              marginRight: 14,
                              justifyContent: 'space-between',
                              position: 'relative',
                              overflow: 'hidden',
                              shadowColor: acc.color || walletStyle.color,
                              shadowOffset: { width: 0, height: 6 },
                              shadowOpacity: 0.25,
                              shadowRadius: 8,
                              elevation: 8,
                              borderWidth: 1,
                              borderColor: 'rgba(255,255,255,0.2)',
                              opacity: pressed ? 0.9 : 1,
                              transform: [{ scale: pressed ? 0.96 : 1 }]
                            };
                          }}
                        >
                          {/* Background Watermark Icon */}
                          <View style={{ position: 'absolute', right: -15, bottom: -15, opacity: 0.15 }}>
                             <BrandLogo type={acc.type} size={80} />
                          </View>

                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', zIndex: 1 }}>
                            <View style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 6, borderRadius: 10 }}>
                               <BrandLogo type={acc.type} size={22} />
                            </View>
                            <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' }}>
                              <MaterialIcons name="edit" size={14} color="#FFFFFF" />
                            </View>
                          </View>

                          <View style={{ zIndex: 1 }}>
                            <Text style={{ fontSize: 11, color: 'rgba(255,255,255,0.8)', fontWeight: 'bold', textTransform: 'uppercase', letterSpacing: 0.5 }} numberOfLines={1}>
                              {acc.name || 'Wallet'}
                            </Text>
                            <Text style={{ fontSize: 18, color: '#FFFFFF', fontWeight: '800', marginTop: 2 }}>
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
                    var walletStyle = WALLET_STYLES[acc.type] || WALLET_STYLES.Custom;
                    var openWalletEditor = function () {
                      triggerImpactHaptic('Light');
                      setSelectedAccount(acc);
                      setShowEditAccountModal(true);
                    };
                    return (
                      <Pressable
                        key={acc.id}
                        onPress={openWalletEditor}
                        style={function (pressed) {
                          return {
                            width: '48%',
                            height: 100,
                            backgroundColor: acc.color || walletStyle.color,
                            borderRadius: 18,
                            padding: 12,
                            marginBottom: 12,
                            justifyContent: 'space-between',
                            position: 'relative',
                            overflow: 'hidden',
                            shadowColor: acc.color || walletStyle.color,
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.2,
                            shadowRadius: 6,
                            elevation: 4,
                            borderWidth: 1,
                            borderColor: 'rgba(255,255,255,0.15)',
                            opacity: pressed ? 0.9 : 1,
                            transform: [{ scale: pressed ? 0.97 : 1 }]
                          };
                        }}
                      >
                        <View style={{ position: 'absolute', right: -10, bottom: -10, opacity: 0.12 }}>
                           <BrandLogo type={acc.type} size={60} />
                        </View>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                          <BrandLogo type={acc.type} size={20} />
                          <MaterialIcons name="edit" size={12} color="#FFFFFF" style={{ opacity: 0.8 }} />
                        </View>
                        <View>
                          <Text style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', fontWeight: 'bold', textTransform: 'uppercase' }} numberOfLines={1}>
                            {acc.name}
                          </Text>
                          <Text style={{ fontSize: 15, color: '#FFFFFF', fontWeight: '800', marginTop: 1 }}>
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

          <Animated.View
            onLayout={function (e) { envelopeRowY.current = e.nativeEvent.layout.y; }}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12, opacity: envelopesFade, transform: [{ translateX: envelopesFade.interpolate({ inputRange: [0, 1], outputRange: [20, 0] }) }] }}
          >
            <Text style={{ ...theme.typography.h3, color: theme.colors.textPrimary }}>Envelopes</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={toggleEnvelopeView} style={{ padding: 4, marginRight: 12 }}>
                <MaterialIcons name={envelopeViewMode === 'grid' ? "view-carousel" : "grid-view"} size={20} color={theme.colors.primary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={handleTransferEnvPress} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
                <MaterialIcons name="swap-horiz" size={16} color={theme.colors.primary} style={{ marginRight: 4 }} />
                <Text style={{ color: theme.colors.primary, fontWeight: 'bold', fontSize: 14 }}>Transfer</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowAddEnvModal(true)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialIcons name="add" size={16} color={theme.colors.primary} style={{ marginRight: 4 }} />
                <Text style={{ color: theme.colors.primary, fontWeight: 'bold', fontSize: 14 }}>Add</Text>
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
                style={{ minHeight: 140 }}
                contentContainerStyle={{ paddingVertical: 4, paddingRight: 8, alignItems: 'center' }}
              >
                {state.envelopeBalances.map(function (env) {
                  var actualEnv = state.envelopes.find(ev => ev.id === env.id) || {};
                  var goalAmount = actualEnv.goal_amount || 0;
                  var goalPct = goalAmount > 0 ? Math.min(100, Math.round((env.available / goalAmount) * 100)) : 0;
                  var isOverspent = env.available < 0;

                  return (
                    <Animated.View key={env.id} style={{ opacity: envelopesFade }}>
                      <Pressable
                        onPress={function () {
                          setQuickAddEnv(actualEnv);
                          setShowQuickAddModal(true);
                        }}
                        style={function (pressed) {
                          return {
                            width: 200,
                            height: 130,
                            backgroundColor: theme.colors.card,
                            borderRadius: 24,
                            padding: 18,
                            marginRight: 14,
                            justifyContent: 'space-between',
                            shadowColor: isOverspent ? theme.colors.error : theme.colors.primary,
                            shadowOffset: { width: 0, height: 4 },
                            shadowOpacity: 0.1,
                            shadowRadius: 8,
                            elevation: 4,
                            borderWidth: 1.5,
                            borderColor: isOverspent ? theme.colors.error + '44' : theme.colors.primary + '22',
                            opacity: pressed ? 0.92 : 1,
                            transform: [{ scale: pressed ? 0.98 : 1 }]
                          };
                        }}
                      >
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                           <View style={{ backgroundColor: isOverspent ? theme.colors.error + '15' : theme.colors.primary + '15', padding: 8, borderRadius: 12 }}>
                             <MaterialIcons name={getEnvelopeIcon(env.name)} size={22} color={isOverspent ? theme.colors.error : theme.colors.primary} />
                           </View>
                           {isOverspent && (
                             <View style={{ backgroundColor: theme.colors.error, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 }}>
                               <Text style={{ fontSize: 9, color: '#FFFFFF', fontWeight: 'bold' }}>OVERSPENT</Text>
                             </View>
                           )}
                        </View>

                        <View>
                          <Text style={{ fontSize: 13, color: theme.colors.textPrimary, fontWeight: '700' }} numberOfLines={1}>{env.name}</Text>
                          <Text style={{ fontSize: 20, color: isOverspent ? theme.colors.error : theme.colors.textPrimary, fontWeight: '800', marginTop: 2 }}>{maskAmount(env.available)}</Text>

                          <View style={{ height: 6, backgroundColor: theme.colors.border, borderRadius: 3, marginTop: 10, overflow: 'hidden' }}>
                            <View style={{ width: `${env.spentPct}%`, height: '100%', backgroundColor: env.spentPct >= 100 ? theme.colors.error : theme.colors.primary }} />
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
                  var actualEnv = state.envelopes.find(ev => ev.id === env.id) || {};
                  var goalAmount = actualEnv.goal_amount || 0;
                  var goalDate = actualEnv.goal_date || '';
                  var goalPct = goalAmount > 0 ? Math.min(100, Math.round((env.available / goalAmount) * 100)) : 0;
                  var isOverspent = env.available < 0;

                  return (
                    <TouchableOpacity key={env.id} onPress={function () {
                      setQuickAddEnv(actualEnv);
                      setShowQuickAddModal(true);
                    }} style={{
                      width: '48%',
                      backgroundColor: theme.colors.card,
                      borderRadius: 20,
                      padding: 16,
                      marginBottom: 16,
                      shadowColor: '#000',
                      shadowOffset: { width: 0, height: 2 },
                      shadowOpacity: 0.05,
                      shadowRadius: 4,
                      elevation: 2,
                      borderWidth: 1,
                      borderColor: isOverspent ? theme.colors.error + '44' : theme.colors.border
                    }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                        <View style={{ backgroundColor: isOverspent ? theme.colors.error + '10' : theme.colors.primary + '10', padding: 6, borderRadius: 8 }}>
                          <MaterialIcons name={getEnvelopeIcon(env.name)} size={18} color={isOverspent ? theme.colors.error : theme.colors.primary} />
                        </View>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                          <TouchableOpacity onPress={function (e) {
                            triggerImpactHaptic('Light');
                            e.stopPropagation();
                            promptDeleteEnvelope({
                              envelopeId: env.id,
                              envelopes: state.envelopes,
                              recurringExpenses: state.recurringExpenses,
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
                                    mutateDeleteHistory: state.mutateDeleteHistory
                                  }),
                                  {
                                    onSaved: state.refetchAll,
                                    setShowSuccess: setShowScreenSaveSuccess,
                                    setSuccessMessage: setScreenSuccessMessage,
                                    message: 'Deleted!',
                                    errorMessage: 'Could not delete envelope. Please try again.'
                                  }
                                );
                              }
                            });
                          }} style={{ padding: 4, backgroundColor: '#FEF2F2', borderRadius: 6 }}>
                            <MaterialIcons name="delete-outline" size={14} color={theme.colors.error} />
                          </TouchableOpacity>
                        </View>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 4 }} numberOfLines={1}>{env.name}</Text>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: isOverspent ? theme.colors.error : theme.colors.textPrimary }}>{maskAmount(env.available)}</Text>

                      <View style={{ height: 4, backgroundColor: theme.colors.border, borderRadius: 2, marginTop: 12, overflow: 'hidden' }}>
                        <View style={{ width: `${env.spentPct}%`, height: '100%', backgroundColor: env.spentPct >= 100 ? theme.colors.error : theme.colors.primary }} />
                      </View>

                      {goalAmount > 0 ? (
                        <View style={{ marginTop: 10, backgroundColor: theme.isDark ? 'rgba(16, 185, 129, 0.08)' : 'rgba(16, 185, 129, 0.05)', borderRadius: 10, padding: 6, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.15)' }}>
                          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                            <Text style={{ fontSize: 8, color: '#059669', fontWeight: 'bold' }}>GOAL</Text>
                            <Text style={{ fontSize: 8, color: '#059669', fontWeight: 'bold' }}>{goalPct}%</Text>
                          </View>
                          <Text style={{ fontSize: 9, fontWeight: 'bold', color: theme.colors.textPrimary }} numberOfLines={1}>
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
        envelopes={state.envelopeBalances}
        userId={userId}
        theme={theme}
        insetsTop={insets.top}
        insetsBottom={insets.bottom}
        onSaved={state.refetchAll}
        userHistory={state.userHistory}
        recurringExpenses={state.recurringExpenses}
        accounts={state.accounts}
      />
      <QuickAddBudgetModal visible={showQuickAddModal} onClose={function () { setShowQuickAddModal(false); }} envelope={quickAddEnv} readyToAssign={state.readyToAssign} envelopes={state.envelopeBalances} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} onSaved={state.refetchAll} theme={theme} setSelectedEnvelope={setSelectedEnvelope} setShowEditEnvModal={setShowEditEnvModal} userId={userId} />
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
      <AddEnvelopeModal visible={showAddEnvModal} onClose={function () { setShowAddEnvModal(false); }} envelopes={state.envelopes} readyToAssign={state.readyToAssign} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} onSaved={state.refetchAll} userId={userId} />
      <EditEnvelopeModal visible={showEditEnvModal} onClose={function () { setShowEditEnvModal(false); setSelectedEnvelope(null); }} envelope={selectedEnvelope} readyToAssign={state.readyToAssign} envelopes={state.envelopes} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} mutateUpdateRecurring={state.mutateUpdateRecurring} mutateDeleteRecurring={state.mutateDeleteRecurring} recurringExpenses={state.recurringExpenses} onSaved={state.refetchAll} />
      <TransferEnvelopeModal visible={showTransferEnvModal} onClose={function () { setShowTransferEnvModal(false); }} envelopes={state.envelopes} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} onSaved={state.refetchAll} />
      <TransferWalletModal visible={showTransferWalletModal} onClose={function () { setShowTransferWalletModal(false); }} accounts={state.accounts} userHistory={state.userHistory} onSaved={state.refetchAll} theme={theme} insetsBottom={insets.bottom} userId={userId} />
      <SavingsManagerModal visible={showSavingsManagerModal} onClose={function () { setShowSavingsManagerModal(false); }} state={state} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} onSaved={state.refetchAll} />

      <AddAccountModal visible={showAddAccountModal} onClose={() => setShowAddAccountModal(false)} accounts={state.accounts} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} onSaved={state.refetchAll} userId={userId} />
      <EditAccountModal visible={showEditAccountModal} onClose={() => { setShowEditAccountModal(false); setSelectedAccount(null); }} account={selectedAccount} accounts={state.accounts} userSettings={state.userSettings} envelopeBalances={state.envelopeBalances} mutateUpdateSettings={state.mutateUpdateSettings} onSaved={state.refetchAll} userId={userId} userHistory={state.userHistory} />
      <NotificationCenterModal visible={showNotificationCenter} onClose={function () { setShowNotificationCenter(false); }} state={state} theme={theme} insets={insets} smartInsights={smartInsights} />

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

    </View>
  );
};

export default DashboardScreen;

import React, { useState, useMemo, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Pressable, Platform, Modal, Image } from 'react-native';
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
  var [hasViewedAlerts, setHasViewedAlerts] = useState(false);
  var [showTransferEnvModal, setShowTransferEnvModal] = useState(false);
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
  var unlinkedIncome = state.incomeSources.reduce(function (sum, src) {
    if (!src.account_id || src.account_id === 'unlinked') {
      return sum + (parseFloat(src.amount) || 0);
    }
    return sum;
  }, 0);
  var totalActualMoney = totalAvailableMoney + unlinkedIncome;
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
    if (unlinkedIncome > 0) {
      accountsList.push({ name: 'Unlinked Income', amount: unlinkedIncome });
    }
    setInfoModalConfig({
      visible: true,
      title: 'Total Current Money',
      content: (
        <View>
          <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginBottom: 16, lineHeight: 20 }}>
            This is the exact sum of all the money in your linked wallets and banks right now, plus any expected base income not yet assigned to a wallet.
          </Text>
          <View style={{ backgroundColor: theme.colors.background, borderRadius: 12, padding: 16, borderWidth: 1, borderColor: theme.colors.border }}>
            {accountsList.map((acc, idx) => (
              <View key={idx} style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: idx === accountsList.length - 1 ? 0 : 12 }}>
                <Text style={{ fontSize: 14, color: theme.colors.textPrimary, fontWeight: '600' }}>{acc.name}</Text>
                <Text style={{ fontSize: 14, color: theme.colors.textPrimary, fontWeight: 'bold' }}>{formatCurrency(acc.amount)}</Text>
              </View>
            ))}
            <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: 14 }} />
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 16, color: theme.colors.primary, fontWeight: 'bold' }}>Total</Text>
              <Text style={{ fontSize: 16, color: theme.colors.primary, fontWeight: 'bold' }}>{formatCurrency(totalActualMoney)}</Text>
            </View>
          </View>
        </View>
      )
    });
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

    // 3. Ready to Assign nudge
    if (state.readyToAssign > 0) {
      insights.push({
        type: 'info',
        icon: 'account-balance-wallet',
        color: safePrimary,
        text: 'You still have ' + formatCurrency(state.readyToAssign) + ' ready to assign. Tap an envelope below to fund it.'
      });
    } else if (state.readyToAssign < 0) {
      insights.push({
        type: 'warning',
        icon: 'error-outline',
        color: theme.colors.error,
        text: 'You are over-assigned by ' + formatCurrency(Math.abs(state.readyToAssign)) + '. Move money between envelopes or add income.'
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
                <Text style={{ color: theme.colors.textSecondary, fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>PENNY BUDGETING</Text>
                <Text style={{ color: theme.colors.textPrimary, fontSize: 18, fontWeight: 'bold' }}>{greeting}, {userName}!</Text>
              </View>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
            <TouchableOpacity
              onPress={function () { state.setShowOnboarding(true); }}
              accessibilityLabel="Open app tour"
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' }}
            >
              <MaterialIcons name="help-outline" size={22} color={theme.colors.textSecondary} />
            </TouchableOpacity>
            <TouchableOpacity
              onPress={function () { setShowNotificationCenter(true); setHasViewedAlerts(true); }}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center', justifyContent: 'center' }}
            >
              <MaterialIcons name="notifications-active" size={22} color={theme.colors.primary} />
              {!hasViewedAlerts && state.recurringExpenses && state.recurringExpenses.filter(r => r.status === 'Pending').length > 0 && (
                <View style={{ position: 'absolute', top: 2, right: 2, backgroundColor: theme.colors.error, borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 2, borderColor: theme.colors.background, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: 'bold' }}>
                    {state.recurringExpenses.filter(r => r.status === 'Pending').length}
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
                <TouchableOpacity onPress={handleReadyToAssignInfo} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 6 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 13, fontWeight: '700', marginRight: 6, letterSpacing: 0.5 }}>READY TO ASSIGN</Text>
                  <MaterialIcons name="info-outline" size={14} color="rgba(255,255,255,0.8)" />
                </TouchableOpacity>
                <Text style={{ color: '#FFFFFF', fontSize: 34, fontWeight: '900', letterSpacing: -1 }}>{formatCurrency(state.readyToAssign)}</Text>
              </View>
            </View>

            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)', marginVertical: 2 }} />

            <TouchableOpacity onPress={handleTotalMoneyInfo} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' }}>
              <View>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                  <Text style={{ color: 'rgba(255,255,255,0.85)', fontSize: 12, fontWeight: '700', marginRight: 6, letterSpacing: 0.5 }}>TOTAL CURRENT MONEY</Text>
                  <MaterialIcons name="info-outline" size={14} color="rgba(255,255,255,0.8)" />
                </View>
                <Text style={{ color: '#6EE7B7', fontSize: 22, fontWeight: 'bold' }}>{formatCurrency(totalActualMoney)}</Text>
              </View>
            </TouchableOpacity>
          </View>
        </View>

        {/* Content Container with standard padding */}
        <View
          style={{ paddingHorizontal: 20, paddingTop: 20 }}
          onLayout={function (e) { scrollContentY.current = e.nativeEvent.layout.y; }}
        >

          <TrialCountdownBanner theme={theme} />

          <RtaNudgeBanner
            theme={theme}
            readyToAssign={state.readyToAssign}
            orphanPendingTotal={state.orphanPendingTotal}
            onPress={handleRtaNudgePress}
          />

          {/* Dynamic Insights Banner */}
          <TouchableOpacity
            onPress={function () { setInsightIndex(insightIndex + 1); }}
            activeOpacity={0.85}
            style={{
              backgroundColor: theme.isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.025)',
              borderWidth: 1,
              borderColor: activeInsight.color + '33',
              borderRadius: 16,
              padding: 14,
              marginBottom: 20,
              flexDirection: 'row',
              alignItems: 'center',
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 2 },
              shadowOpacity: 0.02,
              shadowRadius: 4,
              elevation: 1
            }}
          >
            <View style={{ width: 38, height: 38, borderRadius: 19, backgroundColor: activeInsight.color + '15', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
              <MaterialIcons name={activeInsight.icon} size={20} color={activeInsight.color} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary, lineHeight: 18 }}>{activeInsight.text}</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 4 }}>
                <MaterialIcons name="touch-app" size={10} color={theme.colors.textSecondary} style={{ marginRight: 2 }} />
                <Text style={{ fontSize: 10, color: theme.colors.textSecondary, fontWeight: '700', letterSpacing: 0.5 }}>TAP FOR NEXT INSIGHT • {((insightIndex % smartInsights.length) + 1)}/{smartInsights.length}</Text>
              </View>
            </View>
          </TouchableOpacity>

          {/* Monthly Stats Card */}
          <View style={{ backgroundColor: theme.colors.card, borderRadius: 16, padding: 18, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.06, shadowRadius: 6, elevation: 3 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 14 }}>
              <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center', marginRight: 10 }}>
                <MaterialIcons name="bar-chart" size={20} color={theme.colors.primary} />
              </View>
              <Text style={{ fontSize: 15, fontWeight: 'bold', color: theme.colors.textPrimary }}>Money Manager</Text>
            </View>

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
              <TouchableOpacity onPress={function () { setShowIncomeModal(true); }} style={{ flex: 1, alignItems: 'center', backgroundColor: '#FFEDD5', borderRadius: 10, padding: 10, marginRight: 6 }}>
                <View style={{ position: 'absolute', right: 8, top: 8 }}>
                  <MaterialIcons name="add-circle-outline" size={13} color="#C2410C" />
                </View>
                <Text style={{ fontSize: 11, color: '#C2410C', fontWeight: '700', marginBottom: 3 }}>INCOME</Text>
                <Text style={{ fontSize: 15, fontWeight: 'bold', color: theme.colors.primary }} numberOfLines={1}>{formatCurrency(state.totalIncome)}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={function () { setSpentFilter(null); setShowSpentModal(true); }} style={{ flex: 1, alignItems: 'center', backgroundColor: '#FEE2E2', borderRadius: 10, padding: 10, marginRight: 6 }}>
                <View style={{ position: 'absolute', right: 8, top: 8 }}>
                  <MaterialIcons name="visibility" size={13} color="#B91C1C" />
                </View>
                <Text style={{ fontSize: 11, color: '#B91C1C', fontWeight: '700', marginBottom: 3 }}>SPENT</Text>
                <Text style={{ fontSize: 15, fontWeight: 'bold', color: theme.colors.error }} numberOfLines={1}>{formatCurrency(state.totalExpenses)}</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={function () {
                setShowSavingsManagerModal(true);
              }} style={{ flex: 1, alignItems: 'center', backgroundColor: '#DCFCE7', borderRadius: 10, padding: 10 }}>
                <View style={{ position: 'absolute', right: 8, top: 8 }}>
                  <MaterialIcons name="account-balance-wallet" size={13} color="#15803D" />
                </View>
                <Text style={{ fontSize: 11, color: '#15803D', fontWeight: '700', marginBottom: 3 }}>SAVINGS</Text>
                <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#16A34A' }} numberOfLines={1}>{formatCurrency(state.totalSaved)}</Text>
              </TouchableOpacity>
            </View>

            {/* Spending Progress Bar */}
            <View>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 5 }}>
                <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}>Budget Used</Text>
                <Text style={{ fontSize: 12, fontWeight: '700', color: state.totalIncome > 0 && (state.totalExpenses / state.totalIncome) > 0.9 ? theme.colors.error : theme.colors.primary }}>
                  {state.totalIncome > 0 ? Math.round((state.totalExpenses / state.totalIncome) * 100) : 0}%
                </Text>
              </View>
              <View style={{ height: 8, backgroundColor: theme.colors.border, borderRadius: 4, overflow: 'hidden' }}>
                <View style={{ width: (state.totalIncome > 0 ? Math.min(100, (state.totalExpenses / state.totalIncome) * 100) : 0) + '%', height: '100%', backgroundColor: state.totalIncome > 0 && (state.totalExpenses / state.totalIncome) > 0.9 ? theme.colors.error : theme.colors.primary, borderRadius: 4 }} />
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
          <View style={{ marginBottom: 24 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <TouchableOpacity onPress={handleWalletsInfo} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.textPrimary, marginRight: 6 }}>Wallets & Accounts</Text>
                <MaterialIcons name="info-outline" size={18} color={theme.colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowAddAccountModal(true)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialIcons name="add" size={16} color={theme.colors.primary} style={{ marginRight: 4 }} />
                <Text style={{ color: theme.colors.primary, fontWeight: 'bold', fontSize: 14 }}>Add Account</Text>
              </TouchableOpacity>
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
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                nestedScrollEnabled={true}
                style={{ minHeight: 108 }}
                contentContainerStyle={{ paddingVertical: 4, paddingRight: 8, alignItems: 'center' }}
              >
                {state.accounts.map(function (acc) {
                  var walletStyle = WALLET_STYLES[acc.type] || WALLET_STYLES.Custom;
                  var openWalletEditor = function () {
                    setSelectedAccount(acc);
                    setShowEditAccountModal(true);
                  };
                  return (
                    <Pressable
                      key={acc.id}
                      onPress={openWalletEditor}
                      style={function (pressed) {
                        return {
                          width: 170,
                          height: 100,
                          backgroundColor: acc.color || walletStyle.color,
                          borderRadius: 14,
                          padding: 12,
                          marginRight: 12,
                          justifyContent: 'space-between',
                          shadowColor: '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: 0.12,
                          shadowRadius: 4,
                          elevation: 4,
                          opacity: pressed ? 0.92 : 1,
                          transform: [{ scale: pressed ? 0.98 : 1 }]
                        };
                      }}
                    >
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                        <BrandLogo type={acc.type} size={28} />
                        <View style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}>
                          <MaterialIcons name="edit" size={12} color="#FFFFFF" />
                        </View>
                      </View>
                      <View>
                        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
                          {acc.name || 'Wallet'}
                        </Text>
                        <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginTop: 2 }}>
                          {formatCurrency(acc.balance)}
                        </Text>
                      </View>
                    </Pressable>
                  );
                })}
              </ScrollView>
            )}
          </View>

          <View
            onLayout={function (e) { envelopeRowY.current = e.nativeEvent.layout.y; }}
            style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}
          >
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.textPrimary }}>Envelopes</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <TouchableOpacity onPress={() => setShowTransferEnvModal(true)} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 16 }}>
                <MaterialIcons name="swap-horiz" size={16} color={theme.colors.primary} style={{ marginRight: 4 }} />
                <Text style={{ color: theme.colors.primary, fontWeight: 'bold', fontSize: 14 }}>Transfer</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setShowAddEnvModal(true)} style={{ flexDirection: 'row', alignItems: 'center' }}>
                <MaterialIcons name="add" size={16} color={theme.colors.primary} style={{ marginRight: 4 }} />
                <Text style={{ color: theme.colors.primary, fontWeight: 'bold', fontSize: 14 }}>Add</Text>
              </TouchableOpacity>
            </View>
          </View>
          {hasNoEnvelopes ? (
            <EmptyStateCard
              theme={theme}
              icon="folder-open"
              title="No envelopes yet"
              message="Envelopes are budgets for Housing, Food, Bills, and more. Create one, then assign money from Ready to Assign."
              actionLabel="Create your first envelope"
              onAction={function () { setShowAddEnvModal(true); }}
            />
          ) : null}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
            {!hasNoEnvelopes && state.envelopeBalances.map(env => {
              var actualEnv = state.envelopes.find(ev => ev.id === env.id) || {};
              var goalAmount = actualEnv.goal_amount || 0;
              var goalDate = actualEnv.goal_date || '';
              var goalPct = goalAmount > 0 ? Math.min(100, Math.round((env.available / goalAmount) * 100)) : 0;

              return (
                <TouchableOpacity key={env.id} onPress={function () {
                  var actualEvObj = state.envelopes.find(ev => ev.id === env.id);
                  setQuickAddEnv(actualEvObj);
                  setShowQuickAddModal(true);
                }} style={{ width: '48%', backgroundColor: theme.colors.card, borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                    <MaterialIcons name={getEnvelopeIcon(env.name)} size={20} color={theme.colors.primary} />
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Text style={{ fontSize: 11, fontWeight: 'bold', color: env.available < 0 ? theme.colors.error : theme.colors.textSecondary }}>
                        {env.available < 0 ? 'OVERSPENT' : ''}
                      </Text>
                      <TouchableOpacity onPress={function (e) {
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
                                mutateDeleteRecurring: state.mutateDeleteRecurring
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
                  <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 4 }}>{env.name}</Text>
                  <Text style={{ fontSize: 18, fontWeight: 'bold', color: env.available < 0 ? theme.colors.error : theme.colors.textPrimary }}>{formatCurrency(env.available)}</Text>

                  <View style={{ height: 4, backgroundColor: '#F3F4F6', borderRadius: 2, marginTop: 12, overflow: 'hidden' }}>
                    <View style={{ width: `${env.spentPct}%`, height: '100%', backgroundColor: env.spentPct >= 100 ? theme.colors.error : theme.colors.primary }} />
                  </View>

                  {goalAmount > 0 ? (
                    <View style={{ marginTop: 8, backgroundColor: 'rgba(16, 185, 129, 0.08)', borderRadius: 10, padding: 6, borderWidth: 1, borderColor: 'rgba(16, 185, 129, 0.15)' }}>
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 2 }}>
                        <Text style={{ fontSize: 9, color: '#059669', fontWeight: 'bold' }}>🎯 GOAL</Text>
                        <Text style={{ fontSize: 9, color: '#059669', fontWeight: 'bold' }}>{goalPct}%</Text>
                      </View>
                      <Text style={{ fontSize: 10, fontWeight: 'bold', color: theme.colors.textPrimary }} numberOfLines={1}>
                        {formatCurrency(env.available)} / {formatCurrency(goalAmount)}
                      </Text>
                      {goalDate ? (
                        <Text style={{ fontSize: 8, color: theme.colors.textSecondary, marginTop: 1 }}>By {goalDate}</Text>
                      ) : null}
                    </View>
                  ) : null}
                </TouchableOpacity>
              );
            })}
          </View>

        </View>
      </ScrollView>
      <TouchableOpacity onPress={function () {
          if (!hasUserEnvelopes(state.userSettings)) {
            showEnvelopeRequiredAlert({ onAcknowledge: function () { setShowAddEnvModal(true); } });
            return;
          }
          state.setShowAddModal(true);
        }} style={{ position: 'absolute', right: 20, bottom: fabBottom, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 }}>
        <MaterialIcons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>

      <AddExpenseModal visible={state.showAddModal} onClose={() => state.setShowAddModal(false)} onSaved={state.refetchAll} userId={userId} theme={theme} insetsTop={insets.top} insetsBottom={insets.bottom} envelopes={state.envelopeBalances} accounts={state.accounts} />
      <OnboardingModal visible={state.showOnboarding} onClose={() => { state.setShowOnboarding(false); state.refetchAll(); }} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} />
      <SpentManagerModal visible={showSpentModal} onClose={function () { setShowSpentModal(false); }} filter={spentFilter} oneTimeExpenses={state.oneTimeExpenses} envelopes={state.envelopeBalances} userId={userId} theme={theme} insetsTop={insets.top} insetsBottom={insets.bottom} onSaved={state.refetchAll} userHistory={state.userHistory} recurringExpenses={state.recurringExpenses} />
      <QuickAddBudgetModal visible={showQuickAddModal} onClose={function () { setShowQuickAddModal(false); }} envelope={quickAddEnv} readyToAssign={state.readyToAssign} envelopes={state.envelopeBalances} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} onSaved={state.refetchAll} theme={theme} setSelectedEnvelope={setSelectedEnvelope} setShowEditEnvModal={setShowEditEnvModal} userId={userId} />
      <IncomeManagerModal visible={showIncomeModal} onClose={function () { setShowIncomeModal(false); }} incomeSources={state.incomeSources} accounts={state.accounts} userSettings={state.userSettings} userHistory={state.userHistory} theme={theme} insetsTop={insets.top} insetsBottom={insets.bottom} onSaved={state.refetchAll} readyToAssign={state.readyToAssign} totalAvailableMoney={totalAvailableMoney} envelopes={state.envelopes} envelopeBalances={state.envelopeBalances} oneTimeExpenses={state.oneTimeExpenses} />
      <AddEnvelopeModal visible={showAddEnvModal} onClose={function () { setShowAddEnvModal(false); }} envelopes={state.envelopes} readyToAssign={state.readyToAssign} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} onSaved={state.refetchAll} userId={userId} />
      <EditEnvelopeModal visible={showEditEnvModal} onClose={function () { setShowEditEnvModal(false); setSelectedEnvelope(null); }} envelope={selectedEnvelope} readyToAssign={state.readyToAssign} envelopes={state.envelopes} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} mutateUpdateRecurring={state.mutateUpdateRecurring} mutateDeleteRecurring={state.mutateDeleteRecurring} recurringExpenses={state.recurringExpenses} onSaved={state.refetchAll} />
      <TransferEnvelopeModal visible={showTransferEnvModal} onClose={function () { setShowTransferEnvModal(false); }} envelopes={state.envelopes} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} onSaved={state.refetchAll} />
      <SavingsManagerModal visible={showSavingsManagerModal} onClose={function () { setShowSavingsManagerModal(false); }} state={state} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} onSaved={state.refetchAll} />

      <AddAccountModal visible={showAddAccountModal} onClose={() => setShowAddAccountModal(false)} accounts={state.accounts} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} onSaved={state.refetchAll} userId={userId} />
      <EditAccountModal visible={showEditAccountModal} onClose={() => { setShowEditAccountModal(false); setSelectedAccount(null); }} account={selectedAccount} accounts={state.accounts} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} onSaved={state.refetchAll} userId={userId} userHistory={state.userHistory} />
      <NotificationCenterModal visible={showNotificationCenter} onClose={function () { setShowNotificationCenter(false); }} state={state} theme={theme} insets={insets} />

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

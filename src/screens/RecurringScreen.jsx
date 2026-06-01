import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform, ActivityIndicator, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'platform-hooks';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import AddExpenseModal from '../components/AddExpenseModal';
import PayModal from '../components/PayModal';
import SaveSuccessOverlay from '../components/SaveSuccessOverlay';
import { runSaveWithFeedback } from '../utils/saveSuccess';
import { findEnvelopeForCategory } from '../utils/envelopeBudget';
import { hasUserEnvelopes, showEnvelopeRequiredAlert, validateEnvelopeForSpend, computeEnvelopeBalances, validateSpendOperation } from '../utils/envelopeGuards';
import { formatCurrency, formatDate, isWithin5Days, isOverdue, getCurrentMonthStr } from '../utils/helpers';
import { triggerImpactHaptic } from '../utils/feedback';
import { buildAccountsWithBalances } from '../utils/accountBalances';
import { scale, moderateScale, normalize } from '../utils/responsive';
import emptyRecurringImg from '../assets/empty_recurring.png';

const TAB_MENU_HEIGHT = Platform.OS === 'web' ? 56 : 49;
const SCROLL_EXTRA_PADDING = 16;
const WEB_TAB_MENU_PADDING = 90;
const FAB_SPACING = 16;

const RecurringScreen = function(props) {
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var userCtx = useUser();
  var userId = userCtx.currentUser ? userCtx.currentUser.id : '';
  var insets = useSafeAreaInsets();
  var scrollBottomPadding = Platform.OS === 'web' ? WEB_TAB_MENU_PADDING : (TAB_MENU_HEIGHT + insets.bottom + SCROLL_EXTRA_PADDING);
  var fabBottom = Platform.OS === 'web' ? WEB_TAB_MENU_PADDING : (TAB_MENU_HEIGHT + insets.bottom + FAB_SPACING);
  
  var recurringQuery = useQuery('recurring_expenses');
  var allRecurring = recurringQuery.data || [];
  var recurringExpenses = allRecurring.filter(function(r) { return r.user_id === userId; });
  var refetch = recurringQuery.refetch;
  var loading = recurringQuery.loading;
  var deleteRecurring = useMutation('recurring_expenses', 'delete');
  var mutateDelete = deleteRecurring.mutate;
  var updateRecurring = useMutation('recurring_expenses', 'update');
  var mutateUpdate = updateRecurring.mutate;

  var historyQuery = useQuery('expense_history');
  var allHistory = historyQuery.data || [];
  var deleteHistory = useMutation('expense_history', 'delete');
  var mutateDeleteHistory = deleteHistory.mutate;

  var settingsQuery = useQuery('user_settings');
  var allSettings = settingsQuery.data || [];
  var userSettings = allSettings.find(function(s) { return s.user_id === userId; });
  var isSimpleMode = userSettings && userSettings.budgeting_style === 'simple';

  var curMonth = getCurrentMonthStr();
  var oneTimeQuery = useQuery('one_time_expenses');
  var userOneTime = (oneTimeQuery.data || []).filter(function (o) { return o.user_id === userId; });
  var userHistory = allHistory.filter(function (h) { return h.user_id === userId; });

  var incomeSources = useMemo(function () {
    if (userSettings && userSettings.income_sources) {
      return typeof userSettings.income_sources === 'string' ? JSON.parse(userSettings.income_sources) : userSettings.income_sources;
    }
    var sal = userSettings ? (parseFloat(userSettings.monthly_salary) || 0) : 0;
    return [{ id: 'main-salary', name: 'Main Salary', amount: sal }];
  }, [userSettings]);

  var accounts = useMemo(function () {
    return buildAccountsWithBalances({
      userSettings: userSettings,
      incomeSources: incomeSources,
      oneTimeExpenses: userOneTime,
      userHistory: userHistory,
      curMonth: curMonth
    });
  }, [userSettings, incomeSources, userOneTime, userHistory, curMonth]);

  var envelopes = useMemo(function () {
    if (userSettings && userSettings.envelopes) {
      var raw = typeof userSettings.envelopes === 'string' ? JSON.parse(userSettings.envelopes) : userSettings.envelopes;
      return Array.isArray(raw) ? raw : [];
    }
    return [];
  }, [userSettings]);

  var envelopeBalances = useMemo(function () {
    return computeEnvelopeBalances(envelopes, userHistory, recurringExpenses, curMonth);
  }, [envelopes, userHistory, recurringExpenses, curMonth]);

  var payModalState = useState(false);
  var showPayModal = payModalState[0]; var setShowPayModal = payModalState[1];
  var selectedExpenseState = useState(null);
  var selectedExpense = selectedExpenseState[0]; var setSelectedExpense = selectedExpenseState[1];
  var showAddState = useState(false);
  var showAdd = showAddState[0]; var setShowAdd = showAddState[1];
  var filterState = useState('All');
  var filter = filterState[0]; var setFilter = filterState[1];
  var [visibleCount, setVisibleCount] = useState(5);
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);
  var [successMessage, setSuccessMessage] = useState('Saved!');
  
  useEffect(() => {
    setVisibleCount(5);
  }, [filter]);

  var afterRecurringAction = function (message, promise) {
    runSaveWithFeedback(promise || Promise.resolve(), {
      onSaved: function () {
        refetch();
        if (historyQuery.refetch) historyQuery.refetch();
      },
      setShowSuccess: setShowSaveSuccess,
      setSuccessMessage: setSuccessMessage,
      message: message || 'Saved!',
      errorMessage: 'Something went wrong. Please try again.'
    });
  };
  
  var filters = ['All', 'Pending', 'Paid', 'Paid in Advance'];
  
  var filtered = useMemo(function() {
    if (filter === 'All') return recurringExpenses;
    return recurringExpenses.filter(function(r) { return r.status === filter; });
  }, [recurringExpenses, filter]);
  
  var handlePayPress = function(expense) {
    var amt = parseFloat(expense.amount) || 0;

    // In Simple Mode, we only care if the WALLET has enough money (if selected).
    // The envelope guard is skipped.
    var payCheck = validateSpendOperation({
      amount: amt,
      categoryId: isSimpleMode ? null : expense.category,
      envelopeBalances: isSimpleMode ? [] : envelopeBalances,
      isRecurringPayment: !isSimpleMode // In simple mode, it's not a "recurring envelope payment"
    });

    if (!isSimpleMode && !payCheck.ok) {
      if (Platform.OS === 'web') {
        window.alert(payCheck.message);
      } else {
        Alert.alert('Cannot pay bill', payCheck.message);
      }
      return;
    }
    setSelectedExpense(expense);
    setShowPayModal(true);
  };
  
  var handleResetStatus = function(expense) {
    var msg = 'Reset "' + expense.name + '" back to Pending? ' + formatCurrency(expense.amount) + ' will be returned to your envelope.';
    var performReset = function () {
      afterRecurringAction(
        'Bill reset!',
        mutateUpdate({ id: expense.id, data: { status: 'Pending' } })
      );
    };
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) performReset();
    } else {
      Alert.alert('Undo Payment', msg, [
        { text: 'Cancel' },
        { text: 'Undo', style: 'destructive', onPress: performReset }
      ]);
    }
  };
  
  var handleDelete = function(expense) {
    var isPaid = expense.status === 'Paid' || expense.status === 'Paid in Advance';
    var msg = isPaid
      ? 'Delete "' + expense.name + '"? Since it was already paid, the spent amount will be returned to your envelope.'
      : 'Delete "' + expense.name + '"?';

    var performDelete = function() {
      var deletePromise = mutateDelete({ id: expense.id }).then(function() {
        if (isPaid) {
          var matchingHistory = allHistory.filter(function(h) {
            return h.user_id === userId
              && h.expense_type === 'Recurring'
              && h.expense_name === expense.name;
          });
          var deletePromises = matchingHistory.map(function(h) {
            return mutateDeleteHistory({ id: h.id });
          });
          return Promise.all(deletePromises);
        }
        return Promise.resolve();
      });
      afterRecurringAction('Deleted!', deletePromise);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(msg)) { performDelete(); }
    } else {
      Alert.alert('Delete Expense', msg, [
        { text: 'Cancel' },
        { text: 'Delete', style: 'destructive', onPress: performDelete }
      ]);
    }
  };
  
  var getStatusColor = function(status) {
    if (status === 'Paid') return theme.colors.primary;
    if (status === 'Paid in Advance') return theme.colors.info;
    return theme.colors.warning;
  };
  
  var getStatusBg = function(status) {
    if (status === 'Paid') return '#FED7AA';
    if (status === 'Paid in Advance') return '#EFF6FF';
    return '#FFFBEB';
  };
  
  return React.createElement(View, { testID: 'View-48', style: { flex: 1, backgroundColor: theme.colors.background, position: 'relative' }, componentId: 'recurring-screen' },
    React.createElement(SaveSuccessOverlay, { visible: showSaveSuccess, theme: theme, message: successMessage }),
    React.createElement(View, { testID: 'View-49', style: { backgroundColor: theme.colors.primary, paddingTop: insets.top + moderateScale(16), paddingBottom: moderateScale(20), paddingHorizontal: moderateScale(20) }, componentId: 'recurring-header' },
      React.createElement(Text, { testID: 'Text-67', style: { ...theme.typography.h2, color: '#FFFFFF' } }, 'Recurring Expenses'),
      React.createElement(Text, { testID: 'Text-68', style: { ...theme.typography.bodySmall, color: 'rgba(255,255,255,0.75)', marginTop: 2 } }, String(recurringExpenses.length) + ' total bills')
    ),
    React.createElement(ScrollView, { testID: 'ScrollView-8', horizontal: true, style: { flexGrow: 'initial', backgroundColor: theme.colors.card, borderBottomWidth: 1, borderBottomColor: '#FED7AA' }, showsHorizontalScrollIndicator: false, contentContainerStyle: { paddingHorizontal: moderateScale(16), paddingVertical: moderateScale(12) } },
      filters.map(function(f) {
        var count = f === 'All' ? recurringExpenses.length : recurringExpenses.filter(r => r.status === f).length;
        return React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-18', key: f, onPress: function() { setFilter(f); },
          style: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: moderateScale(16), paddingVertical: moderateScale(8), borderRadius: scale(20), marginRight: moderateScale(8), backgroundColor: filter === f ? theme.colors.primary : theme.colors.background, borderWidth: 1, borderColor: filter === f ? theme.colors.primary : '#FED7AA' },
          componentId: 'filter-' + f
        },
          React.createElement(Text, { testID: 'Text-69', style: { color: filter === f ? '#FFFFFF' : theme.colors.textSecondary, fontSize: normalize(13), fontWeight: '600' } }, f),
          count > 0 ? React.createElement(View, { style: { marginLeft: moderateScale(6), backgroundColor: filter === f ? 'rgba(255,255,255,0.2)' : '#FED7AA', borderRadius: scale(10), paddingHorizontal: moderateScale(6), paddingVertical: moderateScale(2) } },
            React.createElement(Text, { style: { color: filter === f ? '#FFFFFF' : theme.colors.primary, fontSize: normalize(11), fontWeight: 'bold' } }, String(count))
          ) : null
        );
      })
    ),
    loading ? React.createElement(View, { testID: 'View-50', style: { flex: 1, alignItems: 'center', justifyContent: 'center' }, componentId: 'recurring-loading' },
      React.createElement(ActivityIndicator, { testID: 'ActivityIndicator-4', size: 'large', color: theme.colors.primary })
    ) :
    React.createElement(ScrollView, { testID: 'ScrollView-9', style: { flex: 1 },
      contentContainerStyle: { paddingTop: moderateScale(16), paddingHorizontal: moderateScale(16), paddingBottom: scrollBottomPadding }
    },
      filtered.length === 0 ? React.createElement(View, { testID: 'View-51', style: { alignItems: 'center', paddingTop: moderateScale(40), paddingHorizontal: moderateScale(30) }, componentId: 'recurring-empty' },
        React.createElement(Text, { style: { fontSize: normalize(18), fontWeight: 'bold', color: theme.colors.textPrimary, marginBottom: moderateScale(8), textAlign: 'center' } }, "You're all caught up! 🎉"),
        React.createElement(Text, { testID: 'Text-70', style: { fontSize: normalize(14), color: theme.colors.textSecondary, textAlign: 'center', lineHeight: normalize(22) } }, "No recurring bills to worry about. If you have monthly subscriptions or rent, tap the + button to keep track of them effortlessly.")
      ) :
      [...filtered.slice(0, visibleCount).map(function(expense, idx) {
        var overdue = isOverdue(expense.due_date) && expense.status === 'Pending';
        var upcoming = isWithin5Days(expense.due_date) && !overdue && expense.status === 'Pending';
        var missingEnvelope = !isSimpleMode && expense.status === 'Pending' && !findEnvelopeForCategory(envelopes, expense.category);
        return React.createElement(View, { testID: 'View-52', key: expense.id,
          style: { backgroundColor: theme.colors.card, borderRadius: scale(14), padding: moderateScale(16), marginBottom: moderateScale(12), shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, borderLeftWidth: overdue ? scale(4) : (upcoming ? scale(4) : 0), borderLeftColor: overdue ? theme.colors.error : theme.colors.warning },
          componentId: 'recurring-item-' + idx
        },
          React.createElement(View, { testID: 'View-53', style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' } },
            React.createElement(View, { testID: 'View-54', style: { flex: 1, marginRight: moderateScale(12) } },
              React.createElement(Text, { testID: 'Text-72', style: { fontSize: normalize(16), fontWeight: 'bold', color: theme.colors.textPrimary } }, expense.name),
              React.createElement(Text, { testID: 'Text-73', style: { fontSize: normalize(13), color: theme.colors.textSecondary, marginTop: 3 } }, 'Due: ' + formatDate(expense.due_date)),
              overdue ? React.createElement(Text, { testID: 'Text-74', style: { fontSize: normalize(12), color: theme.colors.error, marginTop: 2 } }, '⚠ OVERDUE') : null,
              upcoming ? React.createElement(Text, { testID: 'Text-75', style: { fontSize: normalize(12), color: theme.colors.warning, marginTop: 2 } }, '⏰ Due soon') : null,
              missingEnvelope ? React.createElement(Text, { testID: 'Text-76', style: { fontSize: normalize(12), color: theme.colors.error, marginTop: 2 } }, '⚠ Envelope missing — edit or delete this bill') : null
            ),
            React.createElement(View, { testID: 'View-55', style: { alignItems: 'flex-end' } },
              React.createElement(Text, { testID: 'Text-77', style: { fontSize: normalize(18), fontWeight: 'bold', color: theme.colors.textPrimary } }, formatCurrency(expense.amount)),
              React.createElement(View, { testID: 'View-56', style: { backgroundColor: getStatusBg(expense.status), borderRadius: scale(20), paddingHorizontal: moderateScale(10), paddingVertical: moderateScale(4), marginTop: 6 } },
                React.createElement(Text, { testID: 'Text-78', style: { fontSize: normalize(11), color: getStatusColor(expense.status), fontWeight: '600' } }, expense.status)
              )
            )
          ),
          React.createElement(View, { testID: 'View-57', style: { flexDirection: 'row', marginTop: moderateScale(14), gap: moderateScale(8) } },
            expense.status === 'Pending' ? React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-19', onPress: function() { triggerImpactHaptic('Light'); handlePayPress(expense); },
              style: { flex: 1, backgroundColor: theme.colors.primary, borderRadius: scale(10), paddingVertical: moderateScale(10), alignItems: 'center' },
              componentId: 'pay-btn-' + idx
            },
              React.createElement(Text, { testID: 'Text-79', style: { color: '#FFFFFF', fontSize: normalize(14), fontWeight: '600' } }, '💰 Pay Now')
            ) : React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-20', onPress: function() { handleResetStatus(expense); },
              style: { flex: 1, backgroundColor: theme.colors.background, borderRadius: scale(10), paddingVertical: moderateScale(10), alignItems: 'center', borderWidth: 1, borderColor: '#FED7AA' },
              componentId: 'reset-btn-' + idx
            },
              React.createElement(Text, { testID: 'Text-80', style: { color: theme.colors.textSecondary, fontSize: normalize(14), fontWeight: '600' } }, '↩ Reset')
            ),
            React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-21', onPress: function() { handleDelete(expense); },
              style: { width: scale(42), height: scale(42), borderRadius: scale(10), backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
              componentId: 'delete-recurring-' + idx
            },
              React.createElement(MaterialIcons, { testID: 'MaterialIcons-10', name: 'delete-outline', size: scale(20), color: theme.colors.error })
            )
          )
        );
      }),
      visibleCount < filtered.length ? React.createElement(TouchableOpacity, {
        key: 'see-more-btn',
        onPress: () => setVisibleCount(visibleCount + 5),
        style: { alignItems: 'center', paddingVertical: moderateScale(16) }
      }, React.createElement(Text, { style: { color: theme.colors.primary, fontWeight: 'bold', fontSize: normalize(14) } }, "See More (" + (filtered.length - visibleCount) + " hidden)")) : null]
    ),
    React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-22', onPress: function() {
        triggerImpactHaptic('Medium');
        if (!isSimpleMode && !hasUserEnvelopes(userSettings)) {
          showEnvelopeRequiredAlert();
          return;
        }
        setShowAdd(true);
      },
      style: { position: 'absolute', right: scale(20), bottom: fabBottom, width: scale(56), height: scale(56), borderRadius: scale(28), backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
      componentId: 'recurring-fab'
    },
      React.createElement(MaterialIcons, { testID: 'MaterialIcons-11', name: 'add', size: scale(28), color: '#FFFFFF' })
    ),
    React.createElement(PayModal, { testID: 'PayModal-1', visible: showPayModal,
      expense: selectedExpense,
      onClose: function() { setShowPayModal(false); },
      onPaid: refetch,
      userId: userId,
      insetsTop: insets.top,
      insetsBottom: insets.bottom,
      theme: theme,
      accounts: accounts,
      userSettings: userSettings,
      envelopeBalances: envelopeBalances
    }),
    React.createElement(AddExpenseModal, { testID: 'AddExpenseModal-2', visible: showAdd,
      onClose: function() { setShowAdd(false); },
      onSaved: refetch,
      userId: userId,
      theme: theme,
      insetsTop: insets.top,
      insetsBottom: insets.bottom,
      accounts: accounts,
      initialExpType: 'recurring'
    })
  );
};

export default RecurringScreen;

import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform, ActivityIndicator, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'platform-hooks';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import AddExpenseModal from '../components/AddExpenseModal';
import PayModal from '../components/PayModal';
import { formatCurrency, formatDate, isWithin5Days, isOverdue } from '../utils/helpers';
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

  var settingsQuery = useQuery('user_settings');
  var allSettings = settingsQuery.data || [];
  var userSettings = allSettings.find(function(s) { return s.user_id === userId; });

  var accounts = useMemo(function() {
    var rawList = [];
    if (userSettings && userSettings.accounts) {
      rawList = typeof userSettings.accounts === 'string' ? JSON.parse(userSettings.accounts) : userSettings.accounts;
    } else {
      rawList = [
        { id: 'acc-cash', name: 'Cash Wallet', starting_balance: 0, type: 'Cash', color: '#4B5563' },
        { id: 'acc-gcash', name: 'GCash', starting_balance: 0, type: 'GCash', color: '#1E3A8A' },
        { id: 'acc-maya', name: 'Maya', starting_balance: 0, type: 'Maya', color: '#059669' },
        { id: 'acc-bpi', name: 'BPI Bank', starting_balance: 0, type: 'BPI', color: '#B91C1C' }
      ];
    }
    return rawList;
  }, [userSettings]);
  
  var payModalState = useState(false);
  var showPayModal = payModalState[0]; var setShowPayModal = payModalState[1];
  var selectedExpenseState = useState(null);
  var selectedExpense = selectedExpenseState[0]; var setSelectedExpense = selectedExpenseState[1];
  var showAddState = useState(false);
  var showAdd = showAddState[0]; var setShowAdd = showAddState[1];
  var filterState = useState('All');
  var filter = filterState[0]; var setFilter = filterState[1];
  var [visibleCount, setVisibleCount] = useState(5);
  
  useEffect(() => {
    setVisibleCount(5);
  }, [filter]);
  
  var filters = ['All', 'Pending', 'Paid', 'Paid in Advance'];
  
  var filtered = useMemo(function() {
    if (filter === 'All') return recurringExpenses;
    return recurringExpenses.filter(function(r) { return r.status === filter; });
  }, [recurringExpenses, filter]);
  
  var handlePayPress = function(expense) {
    setSelectedExpense(expense);
    setShowPayModal(true);
  };
  
  var handleResetStatus = function(expense) {
    var msg = 'Reset "' + expense.name + '" back to Pending? ' + formatCurrency(expense.amount) + ' will be returned to your envelope.';
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) {
        mutateUpdate({ id: expense.id, data: { status: 'Pending' } }).then(function() { refetch(); });
      }
    } else {
      Alert.alert('Undo Payment', msg, [
        { text: 'Cancel' },
        { text: 'Undo', style: 'destructive', onPress: function() { mutateUpdate({ id: expense.id, data: { status: 'Pending' } }).then(function() { refetch(); }); } }
      ]);
    }
  };
  
  var handleDelete = function(expense) {
    var msg = 'Delete "' + expense.name + '"?';
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) { mutateDelete({ id: expense.id }).then(function() { refetch(); }); }
    } else {
      Alert.alert('Delete Expense', msg, [
        { text: 'Cancel' },
        { text: 'Delete', style: 'destructive', onPress: function() { mutateDelete({ id: expense.id }).then(function() { refetch(); }); } }
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
  
  return React.createElement(View, { testID: 'View-48', style: { flex: 1, backgroundColor: theme.colors.background }, componentId: 'recurring-screen' },
    React.createElement(View, { testID: 'View-49', style: { backgroundColor: theme.colors.primary, paddingTop: insets.top + 16, paddingBottom: 20, paddingHorizontal: 20 }, componentId: 'recurring-header' },
      React.createElement(Text, { testID: 'Text-67', style: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold' } }, 'Recurring Expenses'),
      React.createElement(Text, { testID: 'Text-68', style: { color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 2 } }, String(recurringExpenses.length) + ' total bills')
    ),
    React.createElement(ScrollView, { testID: 'ScrollView-8', horizontal: true, style: { flexGrow: 'initial', backgroundColor: theme.colors.card, borderBottomWidth: 1, borderBottomColor: '#FED7AA' }, showsHorizontalScrollIndicator: false, contentContainerStyle: { paddingHorizontal: 16, paddingVertical: 12 } },
      filters.map(function(f) {
        var count = f === 'All' ? recurringExpenses.length : recurringExpenses.filter(r => r.status === f).length;
        return React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-18', key: f, onPress: function() { setFilter(f); },
          style: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: filter === f ? theme.colors.primary : theme.colors.background, borderWidth: 1, borderColor: filter === f ? theme.colors.primary : '#FED7AA' },
          componentId: 'filter-' + f
        },
          React.createElement(Text, { testID: 'Text-69', style: { color: filter === f ? '#FFFFFF' : theme.colors.textSecondary, fontSize: 13, fontWeight: '600' } }, f),
          count > 0 ? React.createElement(View, { style: { marginLeft: 6, backgroundColor: filter === f ? 'rgba(255,255,255,0.2)' : '#FED7AA', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 } },
            React.createElement(Text, { style: { color: filter === f ? '#FFFFFF' : theme.colors.primary, fontSize: 11, fontWeight: 'bold' } }, String(count))
          ) : null
        );
      })
    ),
    loading ? React.createElement(View, { testID: 'View-50', style: { flex: 1, alignItems: 'center', justifyContent: 'center' }, componentId: 'recurring-loading' },
      React.createElement(ActivityIndicator, { testID: 'ActivityIndicator-4', size: 'large', color: theme.colors.primary })
    ) :
    React.createElement(ScrollView, { testID: 'ScrollView-9', style: { flex: 1 },
      contentContainerStyle: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: scrollBottomPadding }
    },
      filtered.length === 0 ? React.createElement(View, { testID: 'View-51', style: { alignItems: 'center', paddingTop: 60 }, componentId: 'recurring-empty' },
        React.createElement(Text, { style: { fontSize: 17, fontWeight: 'bold', color: theme.colors.textPrimary, marginBottom: 6 } }, 'No bills yet'),
        React.createElement(Text, { testID: 'Text-70', style: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 } }, 'Tap the + button to add your recurring monthly bills')
      ) :
      [...filtered.slice(0, visibleCount).map(function(expense, idx) {
        var overdue = isOverdue(expense.due_date) && expense.status === 'Pending';
        var upcoming = isWithin5Days(expense.due_date) && !overdue && expense.status === 'Pending';
        return React.createElement(View, { testID: 'View-52', key: expense.id,
          style: { backgroundColor: theme.colors.card, borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, borderLeftWidth: overdue ? 4 : (upcoming ? 4 : 0), borderLeftColor: overdue ? theme.colors.error : theme.colors.warning },
          componentId: 'recurring-item-' + idx
        },
          React.createElement(View, { testID: 'View-53', style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' } },
            React.createElement(View, { testID: 'View-54', style: { flex: 1, marginRight: 12 } },
              React.createElement(Text, { testID: 'Text-72', style: { fontSize: 16, fontWeight: 'bold', color: theme.colors.textPrimary } }, expense.name),
              React.createElement(Text, { testID: 'Text-73', style: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 3 } }, 'Due: ' + formatDate(expense.due_date)),
              overdue ? React.createElement(Text, { testID: 'Text-74', style: { fontSize: 12, color: theme.colors.error, marginTop: 2 } }, '⚠ OVERDUE') : null,
              upcoming ? React.createElement(Text, { testID: 'Text-75', style: { fontSize: 12, color: theme.colors.warning, marginTop: 2 } }, '⏰ Due soon') : null
            ),
            React.createElement(View, { testID: 'View-55', style: { alignItems: 'flex-end' } },
              React.createElement(Text, { testID: 'Text-76', style: { fontSize: 18, fontWeight: 'bold', color: theme.colors.textPrimary } }, formatCurrency(expense.amount)),
              React.createElement(View, { testID: 'View-56', style: { backgroundColor: getStatusBg(expense.status), borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginTop: 6 } },
                React.createElement(Text, { testID: 'Text-77', style: { fontSize: 11, color: getStatusColor(expense.status), fontWeight: '600' } }, expense.status)
              )
            )
          ),
          React.createElement(View, { testID: 'View-57', style: { flexDirection: 'row', marginTop: 14, gap: 8 } },
            expense.status === 'Pending' ? React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-19', onPress: function() { handlePayPress(expense); },
              style: { flex: 1, backgroundColor: theme.colors.primary, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
              componentId: 'pay-btn-' + idx
            },
              React.createElement(Text, { testID: 'Text-78', style: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' } }, '💰 Pay Now')
            ) : React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-20', onPress: function() { handleResetStatus(expense); },
              style: { flex: 1, backgroundColor: theme.colors.background, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#FED7AA' },
              componentId: 'reset-btn-' + idx
            },
              React.createElement(Text, { testID: 'Text-79', style: { color: theme.colors.textSecondary, fontSize: 14, fontWeight: '600' } }, '↩ Reset')
            ),
            React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-21', onPress: function() { handleDelete(expense); },
              style: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
              componentId: 'delete-recurring-' + idx
            },
              React.createElement(MaterialIcons, { testID: 'MaterialIcons-10', name: 'delete-outline', size: 20, color: theme.colors.error })
            )
          )
        );
      }),
      visibleCount < filtered.length ? React.createElement(TouchableOpacity, {
        key: 'see-more-btn',
        onPress: () => setVisibleCount(visibleCount + 5),
        style: { alignItems: 'center', paddingVertical: 16 }
      }, React.createElement(Text, { style: { color: theme.colors.primary, fontWeight: 'bold' } }, "See More (" + (filtered.length - visibleCount) + " hidden)")) : null]
    ),
    React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-22', onPress: function() { setShowAdd(true); },
      style: { position: 'absolute', right: 20, bottom: fabBottom, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
      componentId: 'recurring-fab'
    },
      React.createElement(MaterialIcons, { testID: 'MaterialIcons-11', name: 'add', size: 28, color: '#FFFFFF' })
    ),
    React.createElement(PayModal, { testID: 'PayModal-1', visible: showPayModal,
      expense: selectedExpense,
      onClose: function() { setShowPayModal(false); },
      onPaid: refetch,
      userId: userId,
      insetsTop: insets.top,
      insetsBottom: insets.bottom,
      theme: theme,
      accounts: accounts
    }),
    React.createElement(AddExpenseModal, { testID: 'AddExpenseModal-2', visible: showAdd,
      onClose: function() { setShowAdd(false); },
      onSaved: refetch,
      userId: userId,
      theme: theme,
      insetsTop: insets.top,
      insetsBottom: insets.bottom,
      accounts: accounts
    })
  );
};

export default RecurringScreen;

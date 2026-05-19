import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, TextInput, Modal, Alert, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'platform-hooks';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import AddExpenseModal from '../components/AddExpenseModal';
import DatePickerInput from '../components/DatePickerInput';
import logoImg from '../assets/logo.png';
import BrandLogo from '../components/BrandLogo';
import { formatCurrency, generateId, getCurrentMonthStr, getMonthStr, isWithin5Days, isOverdue, formatDate } from '../utils/helpers';

const TAB_MENU_HEIGHT = Platform.OS === 'web' ? 56 : 49;
const SCROLL_EXTRA_PADDING = 16;
const WEB_TAB_MENU_PADDING = 90;
const FAB_SPACING = 16;

const DEFAULT_ACCOUNTS = [
  { id: 'acc-cash', name: 'Cash Wallet', starting_balance: 0, type: 'Cash', color: '#4B5563' },
  { id: 'acc-gcash', name: 'GCash', starting_balance: 0, type: 'GCash', color: '#1E3A8A' },
  { id: 'acc-maya', name: 'Maya', starting_balance: 0, type: 'Maya', color: '#059669' },
  { id: 'acc-bpi', name: 'BPI Bank', starting_balance: 0, type: 'BPI', color: '#B91C1C' }
];

const WALLET_STYLES = {
  GCash: { color: '#1E3A8A', name: 'GCash', logo: 'account-balance-wallet' },
  Maya: { color: '#059669', name: 'Maya', logo: 'account-balance-wallet' },
  GoTyme: { color: '#111827', name: 'GoTyme Bank', logo: 'stars' },
  BPI: { color: '#B91C1C', name: 'BPI Bank', logo: 'account-balance' },
  Wise: { color: '#3b82f6', name: 'Wise', logo: 'payment' },
  MariBank: { color: '#EA580C', name: 'MariBank', logo: 'shopping-bag' },
  SeaBank: { color: '#F97316', name: 'SeaBank', logo: 'credit-card' },
  Tonik: { color: '#DB2777', name: 'Tonik Bank', logo: 'savings' },
  PayPal: { color: '#2563EB', name: 'PayPal', logo: 'payment' },
  Cash: { color: '#4B5563', name: 'Cash Wallet', logo: 'money' },
  Custom: { color: '#0F766E', name: 'Wallet/Bank', logo: 'credit-card' }
};

const DEFAULT_ENVELOPES = [
  { id: 'env-housing', name: 'Housing', assigned: 0 },
  { id: 'env-food', name: 'Food', assigned: 0 },
  { id: 'env-transport', name: 'Transport', assigned: 0 },
  { id: 'env-savings', name: 'Savings', assigned: 0 },
];

const useDashboardState = function(userId) {
  var settingsQuery = useQuery('user_settings');
  var allSettings = settingsQuery.data || [];
  var userSettings = allSettings.find(function(s) { return s.user_id === userId; });
  
  var recurringQuery = useQuery('recurring_expenses');
  var allRecurring = recurringQuery.data || [];
  var recurringExpenses = allRecurring.filter(function(r) { return r.user_id === userId; });
  
  var oneTimeQuery = useQuery('one_time_expenses');
  var allOneTime = oneTimeQuery.data || [];
  var curMonth = getCurrentMonthStr();
  var oneTimeExpenses = allOneTime.filter(function(o) { return o.user_id === userId && getMonthStr(o.date) === curMonth; });
  
  var historyQuery = useQuery('expense_history');
  var allHistory = historyQuery.data || [];
  var userHistory = allHistory.filter(function(h) { return h.user_id === userId; });
  
  var updateSettings = useMutation('user_settings', 'update');
  var mutateUpdateSettings = updateSettings.mutate;
  
  var [showAddModal, setShowAddModal] = useState(false);
  var [showAssignModal, setShowAssignModal] = useState(false);
  var [showOnboarding, setShowOnboarding] = useState(false);

  useEffect(() => {
    if (userSettings && !userSettings.has_seen_onboarding) {
      setShowOnboarding(true);
    }
  }, [userSettings]);

  // Income Sources
  var incomeSources = useMemo(function() {
    if (userSettings && userSettings.income_sources) {
      return typeof userSettings.income_sources === 'string' ? JSON.parse(userSettings.income_sources) : userSettings.income_sources;
    }
    var sal = userSettings ? (parseFloat(userSettings.monthly_salary) || 0) : 0;
    return [{ id: 'main-salary', name: 'Main Salary', amount: sal }];
  }, [userSettings]);

  // Envelopes
  var envelopes = useMemo(function() {
    if (userSettings && userSettings.envelopes) {
      return typeof userSettings.envelopes === 'string' ? JSON.parse(userSettings.envelopes) : userSettings.envelopes;
    }
    return DEFAULT_ENVELOPES;
  }, [userSettings]);

  // Accounts
  var accounts = useMemo(function() {
    var rawList = [];
    if (userSettings && userSettings.accounts) {
      rawList = typeof userSettings.accounts === 'string' ? JSON.parse(userSettings.accounts) : userSettings.accounts;
    } else {
      rawList = DEFAULT_ACCOUNTS;
    }

    var accs = rawList.map(function(a) {
      return {
        id: a.id,
        name: a.name,
        starting_balance: parseFloat(a.starting_balance) || 0,
        type: a.type || 'Custom',
        color: a.color || '#0F766E',
        balance: parseFloat(a.starting_balance) || 0
      };
    });



    // Subtract paid recurring expenses
    recurringExpenses.forEach(function(r) {
      if ((r.status === 'Paid' || r.status === 'Paid in Advance') && r.account_id) {
        var acc = accs.find(function(a) { return a.id === r.account_id; });
        if (acc) acc.balance -= (parseFloat(r.amount) || 0);
      }
    });

    // Subtract spent one-time expenses
    oneTimeExpenses.forEach(function(o) {
      if (o.account_id) {
        var acc = accs.find(function(a) { return a.id === o.account_id; });
        if (acc) acc.balance -= (parseFloat(o.amount) || 0);
      }
    });

    // Add linked income sources
    incomeSources.forEach(function(src) {
      if (src.account_id && src.account_id !== 'unlinked') {
        var acc = accs.find(function(a) { return a.id === src.account_id; });
        if (acc) acc.balance += (parseFloat(src.amount) || 0);
      }
    });

    // Add received extra incomes from history
    userHistory.forEach(function(h) {
      if (h.expense_type === 'Income' && h.account_id && getMonthStr(h.date) === curMonth) {
        var acc = accs.find(function(a) { return a.id === h.account_id; });
        if (acc) acc.balance += (parseFloat(h.amount) || 0);
      }
    });

    // Handle inter-wallet transfers from history
    userHistory.forEach(function(h) {
      if (h.expense_type === 'Transfer' && h.account_id && h.dest_account_id) {
        var amt = parseFloat(h.amount) || 0;
        var srcAcc = accs.find(function(a) { return a.id === h.account_id; });
        var destAcc = accs.find(function(a) { return a.id === h.dest_account_id; });
        if (srcAcc) srcAcc.balance -= amt;
        if (destAcc) destAcc.balance += amt;
      }
    });

    return accs;
  }, [userSettings, incomeSources, recurringExpenses, oneTimeExpenses, userHistory, curMonth]);

  // Calculations
  var totalAvailableMoney = useMemo(function() {
    return accounts.reduce(function(sum, acc) { return sum + acc.balance; }, 0);
  }, [accounts]);

  var totalIncome = useMemo(function() {
    var base = incomeSources.reduce(function(sum, src) { return sum + (parseFloat(src.amount) || 0); }, 0);
    var extra = 0;
    userHistory.forEach(function(h) {
      if (h.expense_type === 'Income' && getMonthStr(h.date) === curMonth) {
        extra += (parseFloat(h.amount) || 0);
      }
    });
    return base + extra;
  }, [incomeSources, userHistory, curMonth]);

  var totalAssigned = useMemo(function() {
    return envelopes.reduce(function(sum, env) { return sum + (parseFloat(env.assigned) || 0); }, 0);
  }, [envelopes]);


  var envelopeBalances = useMemo(function() {
    var envs = envelopes.map(function(e) {
      return { id: e.id, name: e.name, assigned: parseFloat(e.assigned) || 0, spent: 0 };
    });
    
    recurringExpenses.forEach(function(r) {
      if (r.status === 'Paid' || r.status === 'Paid in Advance') {
        var amt = parseFloat(r.amount) || 0;
        var env = envs.find(function(e) { return e.id === r.category || e.name === r.category; });
        if (env) env.spent += amt;
      }
    });
    
    oneTimeExpenses.forEach(function(o) {
      var amt = parseFloat(o.amount) || 0;
      var env = envs.find(function(e) { return e.id === o.category || e.name === o.category; });
      if (env) env.spent += amt;
    });

    return envs.map(function(e) {
      var available = e.assigned - e.spent;
      var spentPct = e.assigned > 0 ? Math.min(100, Math.round((e.spent / e.assigned) * 100)) : (e.spent > 0 ? 100 : 0);
      return { ...e, available, spentPct };
    });
  }, [envelopes, recurringExpenses, oneTimeExpenses]);

  var totalExpenses = useMemo(function() {
    return envelopeBalances.reduce(function(sum, e) { return sum + e.spent; }, 0);
  }, [envelopeBalances]);

  var upcomingBills = useMemo(function() {
    return recurringExpenses.filter(function(r) {
      return r.status === 'Pending' && (isWithin5Days(r.due_date) || isOverdue(r.due_date));
    });
  }, [recurringExpenses]);

  var totalSaved = useMemo(function() {
    var savingsEnv = envelopeBalances.find(function(e) {
      return e.id === 'env-savings' || e.name.toLowerCase().includes('saving');
    });
    return savingsEnv ? savingsEnv.available : 0;
  }, [envelopeBalances]);

  var totalStartingBalances = accounts.reduce(function(sum, acc) { return sum + (parseFloat(acc.starting_balance) || 0); }, 0);
  var readyToAssign = totalIncome + totalStartingBalances - totalAssigned;

  var refetchAll = useCallback(function() {
    settingsQuery.refetch(); recurringQuery.refetch(); oneTimeQuery.refetch(); historyQuery.refetch();
  }, [settingsQuery, recurringQuery, oneTimeQuery, historyQuery]);
  
  return {
    userSettings, incomeSources, envelopes, envelopeBalances,
    totalIncome, totalAssigned, readyToAssign, totalExpenses, upcomingBills,
    showAddModal, setShowAddModal, showAssignModal, setShowAssignModal,
    showOnboarding, setShowOnboarding,
    mutateUpdateSettings, refetchAll,
    oneTimeExpenses,
    totalSaved,
    accounts,
    totalAvailableMoney
  };
};

const AssignMoneyModal = function({ visible, onClose, readyToAssign, totalIncome, envelopes, userSettings, mutateUpdateSettings, onSaved }) {
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var insets = useSafeAreaInsets();
  var [amounts, setAmounts] = useState({});

  useEffect(() => {
    if (visible) {
      setAmounts({});
    }
  }, [visible]);

  var handleAssign = () => {
    // 1. Validate no negative final envelope assignments
    for (var i = 0; i < envelopes.length; i++) {
      var e = envelopes[i];
      var valStr = amounts[e.id];
      var addedAmt = valStr !== undefined && valStr !== '' && valStr !== '-' ? (parseFloat(valStr) || 0) : 0;
      var finalAmt = (parseFloat(e.assigned) || 0) + addedAmt;
      if (finalAmt < 0) {
        var msg = `Cannot reduce "${e.name}" envelope below ₱0.00! Current assigned: ${formatCurrency(e.assigned)}`;
        Platform.OS === 'web' ? window.alert(msg) : Alert.alert('Error', msg);
        return;
      }
    }

    // 2. Validate no Ready to Assign overspending
    var totalInput = envelopes.reduce((s, env) => {
      var valStr = amounts[env.id];
      var val = valStr !== undefined && valStr !== '' && valStr !== '-' ? (parseFloat(valStr) || 0) : 0;
      return s + val;
    }, 0);
    if (readyToAssign - totalInput < 0) {
      var overspendMsg = 'You cannot assign more money than you have available in Ready to Assign!';
      Platform.OS === 'web' ? window.alert(overspendMsg) : Alert.alert('Error', overspendMsg);
      return;
    }

    var newEnvelopes = envelopes.map(e => {
      var valStr = amounts[e.id];
      var addedAmt = valStr !== undefined && valStr !== '' && valStr !== '-' ? (parseFloat(valStr) || 0) : 0;
      var finalAmt = (parseFloat(e.assigned) || 0) + addedAmt;
      return { id: e.id, name: e.name, assigned: finalAmt };
    });
    if (userSettings) {
      mutateUpdateSettings({ id: userSettings.id, data: { envelopes: newEnvelopes } }).then(() => {
        onClose();
        if (onSaved) onSaved();
      });
    }
  };

  var handleDeleteEnvelope = (id) => {
    var performDelete = () => {
      var newList = envelopes.filter(e => e.id !== id);
      if (userSettings) {
        mutateUpdateSettings({ id: userSettings.id, data: { envelopes: newList } }).then(() => {
          onSaved();
        });
      }
    };

    var targetEnv = envelopes.find(e => e.id === id);
    var name = targetEnv ? targetEnv.name : 'this envelope';
    var amt = targetEnv ? (targetEnv.available !== undefined ? targetEnv.available : (targetEnv.assigned || 0)) : 0;
    var msg = `This will remove the "${name}" envelope. Any money currently inside it (${formatCurrency(amt)}) will be returned to Ready to Assign.`;

    if (Platform.OS === 'web') {
      if (window.confirm(msg)) {
        performDelete();
      }
    } else {
      Alert.alert(
        'Delete Envelope',
        msg,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: performDelete }
        ]
      );
    }
  };

  var totalInput = envelopes.reduce((s, env) => {
    var valStr = amounts[env.id];
    var val = valStr !== undefined && valStr !== '' && valStr !== '-' ? (parseFloat(valStr) || 0) : 0;
    return s + val;
  }, 0);
  var remaining = readyToAssign - totalInput;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)', marginTop: insets.top }}>
        <View style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: insets.bottom + 24, maxHeight: '90%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.colors.textPrimary }}>Assign Money</Text>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={24} color={theme.colors.textSecondary} /></TouchableOpacity>
          </View>
          <View style={{ backgroundColor: '#FFEDD5', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 14, color: '#C2410C', fontWeight: 'bold', marginBottom: 4 }}>Ready to Assign</Text>
            <Text style={{ fontSize: 28, fontWeight: 'bold', color: remaining < 0 ? theme.colors.error : theme.colors.primary }}>{formatCurrency(remaining)}</Text>
            {remaining < 0 && <Text style={{ color: theme.colors.error, fontSize: 12, marginTop: 4 }}>You assigned more than available!</Text>}
          </View>
          <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0, maxHeight: 300 }}>
            {envelopes.map(env => (
              <View key={env.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, marginRight: 8 }}>
                  <View>
                    <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary }}>{env.name}</Text>
                    <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>Current: {formatCurrency(env.available || 0)}</Text>
                  </View>
                  <TouchableOpacity onPress={() => handleDeleteEnvelope(env.id)} style={{ marginLeft: 8, padding: 4 }}>
                    <MaterialIcons name="delete-outline" size={16} color={theme.colors.error} />
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12 }}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 14 }}>+ ₱</Text>
                  <TextInput
                    value={amounts[env.id] || ''}
                    onChangeText={(val) => {
                      var s = val.replace(/[^0-9.-]/g, '');
                      setAmounts(prev => ({ ...prev, [env.id]: s }));
                    }}
                    placeholder="0.00"
                    keyboardType="numeric"
                    style={{ width: 80, paddingVertical: 10, paddingLeft: 6, fontSize: 15, color: theme.colors.textPrimary, textAlign: 'right' }}
                  />
                </View>
              </View>
            ))}
          </ScrollView>



          <TouchableOpacity onPress={handleAssign} disabled={remaining < 0} style={{ backgroundColor: remaining < 0 ? theme.colors.accent : theme.colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>Save Assignments</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const AddEnvelopeModal = function({ visible, onClose, envelopes, readyToAssign, userSettings, mutateUpdateSettings, onSaved }) {
  var [name, setName] = useState('');
  var [assigned, setAssigned] = useState('');
  var themeCtx = useTheme();
  var theme = themeCtx.theme;

  useEffect(() => {
    if (visible) {
      setName('');
      setAssigned('');
    }
  }, [visible]);

  var handleCreate = function() {
    if (!name.trim()) return;
    if (envelopes.find(e => e.name.toLowerCase() === name.trim().toLowerCase())) {
      Platform.OS === 'web' ? window.alert('Envelope already exists!') : Alert.alert('Error', 'Envelope already exists!');
      return;
    }
    var assignedAmt = parseFloat(assigned) || 0;
    if (assignedAmt > readyToAssign) {
      Platform.OS === 'web' ? window.alert('Not enough Ready to Assign money!') : Alert.alert('Error', 'Not enough Ready to Assign money!');
      return;
    }

    var newId = 'env-' + generateId();
    var newEnv = { id: newId, name: name.trim(), assigned: assignedAmt };
    var newList = envelopes.concat(newEnv);
    if (userSettings) {
      mutateUpdateSettings({ id: userSettings.id, data: { envelopes: newList } }).then(() => {
        setName('');
        setAssigned('');
        onClose();
        onSaved();
      });
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }}>
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 16, padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.textPrimary }}>Add Envelope</Text>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={24} color={theme.colors.textSecondary} /></TouchableOpacity>
          </View>
           <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 }}>ENVELOPE NAME</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Travel, Gifts, Health"
            style={{ backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.textPrimary, marginBottom: 16 }}
          />

          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 }}>ASSIGN INITIAL BUDGET (OPTIONAL)</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, marginBottom: 20 }}>
            <Text style={{ fontSize: 15, color: theme.colors.textSecondary }}>₱</Text>
            <TextInput
              value={assigned}
              onChangeText={(val) => {
                var s = val.replace(/[^0-9.]/g, '');
                var parts = s.split('.');
                if (parts.length > 2) s = parts[0] + '.' + parts.slice(1).join('');
                setAssigned(s);
              }}
              placeholder="0.00"
              keyboardType="decimal-pad"
              style={{ flex: 1, paddingVertical: 10, paddingLeft: 6, fontSize: 15, color: theme.colors.textPrimary }}
            />
          </View>

          <TouchableOpacity onPress={handleCreate} style={{ backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>Create Envelope</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const SavingsManagerModal = function({ visible, onClose, state, userSettings, mutateUpdateSettings, onSaved }) {
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var [amount, setAmount] = useState('');

  useEffect(() => {
    if (visible) {
      setAmount('');
    }
  }, [visible]);

  // Find the savings envelope
  var savingsEnv = state.envelopes.find(function(e) {
    return e.id === 'env-savings' || e.name.toLowerCase().includes('saving');
  });

  var currentSavings = savingsEnv ? (parseFloat(savingsEnv.assigned) || 0) : 0;
  var readyToAssign = state.readyToAssign;

  var handleAdd = function() {
    var val = parseFloat(amount) || 0;
    if (val <= 0) return;
    if (val > readyToAssign) {
      Platform.OS === 'web' 
        ? window.alert('You cannot save more than your Ready to Assign balance!') 
        : Alert.alert('Invalid Amount', 'You cannot save more than your Ready to Assign balance!');
      return;
    }

    var updatedEnvelopes = [];
    if (!savingsEnv) {
      // Auto-create "Savings" envelope
      var newSavings = { id: 'env-savings', name: 'Savings', assigned: val };
      updatedEnvelopes = state.envelopes.concat(newSavings);
    } else {
      updatedEnvelopes = state.envelopes.map(function(e) {
        if (e.id === savingsEnv.id) {
          return { ...e, assigned: currentSavings + val };
        }
        return e;
      });
    }

    if (userSettings) {
      mutateUpdateSettings({ id: userSettings.id, data: { envelopes: updatedEnvelopes } }).then(() => {
        setAmount('');
        onClose();
        onSaved();
      });
    }
  };

  var handleWithdraw = function() {
    var val = parseFloat(amount) || 0;
    if (val <= 0) return;
    if (!savingsEnv || val > currentSavings) {
      Platform.OS === 'web' 
        ? window.alert('You cannot withdraw more than your current Savings!') 
        : Alert.alert('Invalid Amount', 'You cannot withdraw more than your current Savings!');
      return;
    }

    var updatedEnvelopes = state.envelopes.map(function(e) {
      if (e.id === savingsEnv.id) {
        return { ...e, assigned: currentSavings - val };
      }
      return e;
    });

    if (userSettings) {
      mutateUpdateSettings({ id: userSettings.id, data: { envelopes: updatedEnvelopes } }).then(() => {
        setAmount('');
        onClose();
        onSaved();
      });
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }}>
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 16, padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.textPrimary }}>Manage Savings</Text>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={24} color={theme.colors.textSecondary} /></TouchableOpacity>
          </View>

          <View style={{ backgroundColor: '#DCFCE7', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 13, color: '#15803D', fontWeight: 'bold', marginBottom: 4 }}>Current Savings</Text>
            <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#16A34A' }}>{formatCurrency(currentSavings)}</Text>
          </View>

          <View style={{ backgroundColor: '#FEF3C7', borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 12, color: '#D97706', fontWeight: '700' }}>
              Ready to Assign: {formatCurrency(readyToAssign)}
            </Text>
          </View>

          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 }}>PHP (₱) AMOUNT</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, marginBottom: 20 }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 14 }}>₱</Text>
            <TextInput
              value={amount}
              onChangeText={function(val) {
                var s = val.replace(/[^0-9.]/g, '');
                var parts = s.split('.');
                if (parts.length > 2) s = parts[0] + '.' + parts.slice(1).join('');
                setAmount(s);
              }}
              placeholder="0.00"
              keyboardType="decimal-pad"
              style={{ flex: 1, paddingVertical: 12, paddingLeft: 8, fontSize: 15, color: theme.colors.textPrimary }}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={handleAdd} style={{ flex: 1, backgroundColor: '#16A34A', borderRadius: 12, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
              <MaterialIcons name="add" size={18} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' }}>Add to Savings</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={handleWithdraw} style={{ flex: 1, backgroundColor: '#EA580C', borderRadius: 12, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6 }}>
              <MaterialIcons name="remove" size={18} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' }}>Withdraw</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const NotificationCenterModal = function({ visible, onClose, state, theme, insets }) {
  var handleTestNotification = async () => {
    try {
      if (Platform.OS === 'web') {
        if (typeof window !== 'undefined' && 'Notification' in window) {
          const permission = await window.Notification.requestPermission();
          if (permission === 'granted') {
            new window.Notification("Penny System Test", {
              body: "Notification channel verified. Everything is working correctly."
            });
          } else {
            alert("Please enable notification permissions in your browser settings!");
          }
        }
      } else {
        const { LocalNotifications } = require('@capacitor/local-notifications');
        await LocalNotifications.schedule({
          notifications: [
            {
              id: 9999,
              title: "Penny System Test",
              body: "Notification channel verified. Everything is working correctly.",
              sound: 'default'
            }
          ]
        });
      }
    } catch (e) {
      console.warn("Failed to send test notification", e);
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)', marginTop: insets.top }}>
        <View style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: insets.bottom + 24, maxHeight: '85%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialIcons name="notifications-none" size={24} color={theme.colors.primary} />
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.colors.textPrimary }}>Alerts & Reminders</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: 20 }}>
            {/* Active Subscriptions / Reminders */}
            <View style={{ backgroundColor: theme.colors.background, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: theme.colors.border }}>
              <Text style={{ fontSize: 11, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 6, letterSpacing: 0.5 }}>SYSTEM TRIGGERS</Text>
              
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary }}>Daily Budget Check</Text>
                  <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>Daily log nudge scheduled at 8:00 PM</Text>
                </View>
                <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#065F46' }}>ACTIVE</Text>
                </View>
              </View>

              <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: 6 }} />

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary }}>Upcoming Bill Alerts</Text>
                  <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>Fires 1 day before due date at 9:00 AM</Text>
                </View>
                <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#065F46' }}>ACTIVE</Text>
                </View>
              </View>
            </View>

            {/* Upcoming Alerts List */}
            <Text style={{ fontSize: 15, fontWeight: 'bold', color: theme.colors.textPrimary, marginBottom: 12 }}>Scheduled Bill Reminders</Text>
            
            {state.upcomingBills.length === 0 ? (
              <View style={{ alignItems: 'center', padding: 24, backgroundColor: theme.colors.background, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border }}>
                <MaterialIcons name="notifications-none" size={32} color={theme.colors.textSecondary} style={{ marginBottom: 8 }} />
                <Text style={{ fontSize: 13, color: theme.colors.textSecondary, textAlign: 'center' }}>
                  No upcoming bills due in the next 5 days.
                </Text>
              </View>
            ) : (
              state.upcomingBills.map(bill => {
                var overdue = isOverdue(bill.due_date);
                return (
                  <View key={bill.id} style={{ backgroundColor: overdue ? (theme.isDark ? '#3F1A1A' : '#FEF2F2') : (theme.isDark ? '#3F351A' : '#FFFBEB'), borderRadius: 12, padding: 14, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: overdue ? theme.colors.error : theme.colors.warning }}>
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1, marginRight: 8 }}>
                        <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary }} numberOfLines={1}>{bill.name}</Text>
                        <Text style={{ fontSize: 12, color: overdue ? theme.colors.error : theme.colors.warning, marginTop: 4 }}>
                          {overdue ? `⚠ Overdue: ${formatDate(bill.due_date)}` : `⏰ Due: ${formatDate(bill.due_date)}`}
                        </Text>
                        <Text style={{ fontSize: 10, color: theme.colors.textSecondary, marginTop: 4 }}>
                          Alert fires on: {new Date(new Date(bill.due_date).getTime() - 24 * 60 * 60 * 1000).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at 9:00 AM
                        </Text>
                      </View>
                      <Text style={{ fontSize: 16, fontWeight: 'bold', color: overdue ? theme.colors.error : theme.colors.warning }}>{formatCurrency(bill.amount)}</Text>
                    </View>
                  </View>
                );
              })
            )}
          </ScrollView>

          <TouchableOpacity onPress={handleTestNotification} style={{ backgroundColor: theme.colors.border, borderRadius: 12, paddingVertical: 12, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ color: theme.colors.textSecondary, fontSize: 13, fontWeight: '600' }}>Run Notification Diagnostics</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const AddAccountModal = function({ visible, onClose, accounts, userSettings, mutateUpdateSettings, onSaved }) {
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var [name, setName] = useState('');
  var [type, setType] = useState('GCash');
  var [startingBalance, setStartingBalance] = useState('');

  useEffect(() => {
    if (visible) {
      setName('GCash');
      setType('GCash');
      setStartingBalance('');
    }
  }, [visible]);

  var handleCreate = function() {
    var finalName = type === 'Custom' ? name.trim() : (WALLET_STYLES[type]?.name || type);
    if (!finalName) {
      Platform.OS === 'web' ? window.alert('Please enter an account name.') : Alert.alert('Error', 'Please enter an account name.');
      return;
    }
    if (accounts.find(a => a.name.toLowerCase() === finalName.toLowerCase())) {
      Platform.OS === 'web' ? window.alert('Account already exists!') : Alert.alert('Error', 'Account already exists!');
      return;
    }
    var walletStyle = WALLET_STYLES[type] || WALLET_STYLES.Custom;
    var newId = 'acc-' + generateId();
    var newAcc = { 
      id: newId, 
      name: finalName, 
      type: type, 
      starting_balance: parseFloat(startingBalance) || 0,
      color: walletStyle.color
    };
    var newList = accounts.concat(newAcc);
    if (userSettings) {
      mutateUpdateSettings({ id: userSettings.id, data: { accounts: newList } }).then(() => {
        onClose();
        onSaved();
      });
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }}>
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 16, padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.textPrimary }}>Add Wallet / Bank Account</Text>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={24} color={theme.colors.textSecondary} /></TouchableOpacity>
          </View>
          
          {type === 'Custom' && (
            <>
              <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 }}>ACCOUNT NAME</Text>
              <TextInput
                value={name}
                onChangeText={setName}
                placeholder="e.g. BDO Personal, GCash Business"
                style={{ backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.textPrimary, marginBottom: 16 }}
              />
            </>
          )}

          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 }}>WALLET / BANK TYPE</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {Object.keys(WALLET_STYLES).map(t => {
              var isSelected = type === t;
              return (
                <TouchableOpacity
                  key={t}
                  onPress={() => {
                    setType(t);
                    if (t !== 'Custom') {
                      setName(WALLET_STYLES[t]?.name || t);
                    } else {
                      setName('');
                    }
                  }}
                  style={{ marginRight: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: isSelected ? theme.colors.primary : theme.colors.background, borderWidth: 1, borderColor: isSelected ? theme.colors.primary : theme.colors.border }}
                >
                  <Text style={{ color: isSelected ? '#FFFFFF' : theme.colors.textPrimary, fontSize: 13, fontWeight: '600' }}>{t}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 4 }}>INITIAL SEED BALANCE</Text>
          <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 8 }}>How much money is currently inside this wallet today?</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, marginBottom: 20 }}>
            <Text style={{ fontSize: 15, color: theme.colors.textSecondary }}>₱</Text>
            <TextInput
              value={startingBalance}
              onChangeText={(val) => {
                var s = val.replace(/[^0-9.]/g, '');
                var parts = s.split('.');
                if (parts.length > 2) s = parts[0] + '.' + parts.slice(1).join('');
                setStartingBalance(s);
              }}
              placeholder="0.00"
              keyboardType="decimal-pad"
              style={{ flex: 1, paddingVertical: 10, paddingLeft: 6, fontSize: 15, color: theme.colors.textPrimary }}
            />
          </View>

          <TouchableOpacity onPress={handleCreate} style={{ backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>Create Wallet / Account</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const EditAccountModal = function({ visible, onClose, account, accounts, userSettings, mutateUpdateSettings, onSaved }) {
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var [name, setName] = useState('');
  var [startingBalance, setStartingBalance] = useState('');

  useEffect(() => {
    if (visible && account) {
      setName(account.name);
      setStartingBalance(String(account.starting_balance || 0));
    }
  }, [visible, account]);

  var handleSave = () => {
    if (!name.trim()) return;
    var newList = accounts.map(a => {
      if (a.id === account.id) {
        return { ...a, name: name.trim(), starting_balance: parseFloat(startingBalance) || 0 };
      }
      return a;
    });

    if (userSettings) {
      mutateUpdateSettings({ id: userSettings.id, data: { accounts: newList } }).then(() => {
        onClose();
        onSaved();
      });
    }
  };

  var handleDelete = () => {
    var performDelete = () => {
      var newList = accounts.filter(a => a.id !== account.id);
      if (userSettings) {
        mutateUpdateSettings({ id: userSettings.id, data: { accounts: newList } }).then(() => {
          onClose();
          onSaved();
        });
      }
    };

    var msg = `This will remove the "${account.name}" wallet from your account management. Live tracking for transactions tied to it will fallback.`;

    if (Platform.OS === 'web') {
      if (window.confirm(msg)) {
        performDelete();
      }
    } else {
      Alert.alert(
        'Delete Wallet/Account',
        msg,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: performDelete }
        ]
      );
    }
  };

  if (!visible || !account) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }}>
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 16, padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.colors.textPrimary }}>Edit Wallet / Account</Text>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={24} color={theme.colors.textSecondary} /></TouchableOpacity>
          </View>

          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 }}>ACCOUNT NAME</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Account Name"
            style={{ backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.textPrimary, marginBottom: 16 }}
          />

          <View style={{ backgroundColor: 'rgba(15, 118, 110, 0.08)', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(15, 118, 110, 0.15)' }}>
            <Text style={{ fontSize: 11, color: theme.colors.primary, fontWeight: 'bold', marginBottom: 2 }}>CURRENT LIVE BALANCE</Text>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.textPrimary }}>{formatCurrency(account.balance || 0)}</Text>
            <Text style={{ fontSize: 10, color: theme.colors.textSecondary, marginTop: 4 }}>This is the live amount calculated from: Starting Balance + Incomes - Expenses & Transfers.</Text>
          </View>

          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 4 }}>BASE BALANCE BASELINE</Text>
          <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 8 }}>Adjust this baseline to match your actual bank or physical cash count if you ever notice a discrepancy.</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, marginBottom: 20 }}>
            <Text style={{ fontSize: 15, color: theme.colors.textSecondary }}>₱</Text>
            <TextInput
              value={startingBalance}
              onChangeText={(val) => {
                var s = val.replace(/[^0-9.]/g, '');
                var parts = s.split('.');
                if (parts.length > 2) s = parts[0] + '.' + parts.slice(1).join('');
                setStartingBalance(s);
              }}
              placeholder="0.00"
              keyboardType="decimal-pad"
              style={{ flex: 1, paddingVertical: 10, paddingLeft: 6, fontSize: 15, color: theme.colors.textPrimary }}
            />
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={handleDelete} style={{ flex: 1, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: theme.colors.error, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: theme.colors.error, fontSize: 15, fontWeight: 'bold' }}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={{ flex: 2, backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' }}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const EditEnvelopeModal = function({ visible, onClose, envelope, readyToAssign, envelopes, userSettings, mutateUpdateSettings, onSaved }) {
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var [name, setName] = useState('');
  var [assigned, setAssigned] = useState('');
  var [goalAmount, setGoalAmount] = useState('');
  var [goalDate, setGoalDate] = useState('');

  useEffect(() => {
    if (visible && envelope) {
      setName(envelope.name);
      setAssigned(String(envelope.assigned));
      setGoalAmount(envelope.goal_amount ? String(envelope.goal_amount) : '');
      setGoalDate(envelope.goal_date || '');
    }
  }, [visible, envelope]);

  var handleSave = () => {
    if (!name.trim()) return;
    var originalAssigned = envelope.assigned || 0;
    var newAssigned = parseFloat(assigned) || 0;
    if (newAssigned < 0) {
      Platform.OS === 'web' ? window.alert('Assigned budget cannot be negative!') : Alert.alert('Error', 'Assigned budget cannot be negative!');
      return;
    }
    var difference = newAssigned - originalAssigned;

    if (difference > readyToAssign) {
      Platform.OS === 'web' ? window.alert('Not enough Ready to Assign money!') : Alert.alert('Error', 'Not enough Ready to Assign money!');
      return;
    }

    var newGoalAmt = parseFloat(goalAmount) || 0;
    if (newGoalAmt < 0) {
      Platform.OS === 'web' ? window.alert('Goal target amount cannot be negative!') : Alert.alert('Error', 'Goal target amount cannot be negative!');
      return;
    }
    var newGoalDate = goalDate.trim() || '';

    var newList = envelopes.map(e => {
      if (e.id === envelope.id) {
        return { 
          ...e, 
          name: name.trim(), 
          assigned: newAssigned,
          goal_amount: newGoalAmt > 0 ? newGoalAmt : null,
          goal_date: newGoalDate || null
        };
      }
      return e;
    });

    if (userSettings) {
      mutateUpdateSettings({ id: userSettings.id, data: { envelopes: newList } }).then(() => {
        onClose();
        onSaved();
      });
    }
  };

  var handleDelete = () => {
    var performDelete = () => {
      var newList = envelopes.filter(e => e.id !== envelope.id);
      if (userSettings) {
        mutateUpdateSettings({ id: userSettings.id, data: { envelopes: newList } }).then(() => {
          onClose();
          onSaved();
        });
      }
    };

    var name = envelope.name;
    var amt = envelope.assigned || 0;
    var msg = `This will remove the "${name}" envelope. Any money currently inside it (${formatCurrency(amt)}) will be returned to Ready to Assign.`;

    if (Platform.OS === 'web') {
      if (window.confirm(msg)) {
        performDelete();
      }
    } else {
      Alert.alert(
        'Delete Envelope',
        msg,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Delete', style: 'destructive', onPress: performDelete }
        ]
      );
    }
  };

  if (!visible || !envelope) return null;

  var originalAssigned = envelope.assigned || 0;
  var newAssigned = parseFloat(assigned) || 0;
  var difference = newAssigned - originalAssigned;
  var remaining = readyToAssign - difference;

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }}>
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 16, padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.colors.textPrimary }}>Edit Envelope</Text>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={24} color={theme.colors.textSecondary} /></TouchableOpacity>
          </View>

          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 }}>ENVELOPE NAME</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Envelope Name"
            style={{ backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.textPrimary, marginBottom: 16 }}
          />

          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 }}>ASSIGNED BUDGET</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, marginBottom: 16 }}>
            <Text style={{ fontSize: 15, color: theme.colors.textSecondary }}>₱</Text>
            <TextInput
              value={assigned}
              onChangeText={(val) => {
                var s = val.replace(/[^0-9.]/g, '');
                var parts = s.split('.');
                if (parts.length > 2) s = parts[0] + '.' + parts.slice(1).join('');
                setAssigned(s);
              }}
              placeholder="0.00"
              keyboardType="decimal-pad"
              style={{ flex: 1, paddingVertical: 10, paddingLeft: 6, fontSize: 15, color: theme.colors.textPrimary }}
            />
          </View>

          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 }}>SAVINGS GOAL TARGET AMOUNT (OPTIONAL)</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, marginBottom: 16 }}>
            <Text style={{ fontSize: 15, color: theme.colors.textSecondary }}>₱</Text>
            <TextInput
              value={goalAmount}
              onChangeText={(val) => {
                var s = val.replace(/[^0-9.]/g, '');
                var parts = s.split('.');
                if (parts.length > 2) s = parts[0] + '.' + parts.slice(1).join('');
                setGoalAmount(s);
              }}
              placeholder="e.g. 15000 (Target Amount)"
              keyboardType="decimal-pad"
              style={{ flex: 1, paddingVertical: 10, paddingLeft: 6, fontSize: 14, color: theme.colors.textPrimary }}
            />
          </View>

          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 }}>TARGET DATE (OPTIONAL)</Text>
          <DatePickerInput
            value={goalDate}
            onChange={setGoalDate}
            placeholder="Select target savings date..."
            style={{ backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16 }}
          />

          <View style={{ backgroundColor: '#FFEDD5', borderRadius: 12, padding: 12, alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 12, color: '#C2410C', fontWeight: 'bold', marginBottom: 2 }}>Ready to Assign after change</Text>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: remaining < 0 ? theme.colors.error : theme.colors.primary }}>{formatCurrency(remaining)}</Text>
          </View>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={handleDelete} style={{ flex: 1, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: theme.colors.error, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: theme.colors.error, fontSize: 15, fontWeight: 'bold' }}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} disabled={remaining < 0} style={{ flex: 2, backgroundColor: remaining < 0 ? theme.colors.accent : theme.colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' }}>Save Changes</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const TransferEnvelopeModal = function({ visible, onClose, envelopes, userSettings, mutateUpdateSettings, onSaved }) {
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var [sourceId, setSourceId] = useState('');
  var [destId, setDestId] = useState('');
  var [amount, setAmount] = useState('');
  var [errorMsg, setErrorMsg] = useState('');

  var insertHistory = useMutation('expense_history', 'insert');
  var mutateHistory = insertHistory.mutate;

  useEffect(() => {
    if (visible) {
      setErrorMsg('');
      setAmount('');
      if (envelopes && envelopes.length > 0) {
        setSourceId(envelopes[0].id);
        setDestId(envelopes[1] ? envelopes[1].id : envelopes[0].id);
      }
    }
  }, [visible, envelopes]);

  var handleTransfer = () => {
    var amt = parseFloat(amount) || 0;
    if (amt <= 0) {
      setErrorMsg('Please enter a valid transfer amount.');
      return;
    }
    if (sourceId === destId) {
      setErrorMsg('Source and Destination envelopes must be different.');
      return;
    }
    var sourceEnv = envelopes.find(e => e.id === sourceId);
    var destEnv = envelopes.find(e => e.id === destId);
    if (!sourceEnv || !destEnv) {
      setErrorMsg('Invalid envelopes selected.');
      return;
    }
    if ((sourceEnv.assigned || 0) < amt) {
      setErrorMsg(`Insufficient budget in "${sourceEnv.name}". Available: ${formatCurrency(sourceEnv.assigned)}`);
      return;
    }

    var newList = envelopes.map(e => {
      if (e.id === sourceId) {
        return { ...e, assigned: (parseFloat(e.assigned) || 0) - amt };
      }
      if (e.id === destId) {
        return { ...e, assigned: (parseFloat(e.assigned) || 0) + amt };
      }
      return e;
    });

    if (userSettings) {
      mutateUpdateSettings({ id: userSettings.id, data: { envelopes: newList } }).then(() => {
        return mutateHistory({
          id: generateId(),
          user_id: userSettings.user_id,
          expense_name: `Transfer: ${sourceEnv.name} ➔ ${destEnv.name}`,
          amount: amt,
          expense_type: 'Transfer',
          category: sourceEnv.id,
          date: getTodayStr(),
          status: 'Spent',
          notes: `Transferred budget of ${formatCurrency(amt)} from ${sourceEnv.name} to ${destEnv.name}`
        });
      }).then(() => {
        onSaved();
        onClose();
      });
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }}>
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 16, padding: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.colors.textPrimary }}>Envelope Budget Transfer</Text>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={24} color={theme.colors.textSecondary} /></TouchableOpacity>
          </View>

          {errorMsg ? (
            <Text style={{ color: theme.colors.error, fontSize: 13, marginBottom: 12, fontWeight: '600' }}>{errorMsg}</Text>
          ) : null}

          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 }}>FROM ENVELOPE (SOURCE)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {envelopes.map(e => {
              var isSel = sourceId === e.id;
              return (
                <TouchableOpacity key={e.id} onPress={() => setSourceId(e.id)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: isSel ? theme.colors.primary : theme.colors.background, borderWidth: 1, borderColor: isSel ? theme.colors.primary : theme.colors.border, marginRight: 6 }}>
                  <Text style={{ color: isSel ? '#FFFFFF' : theme.colors.textPrimary, fontSize: 13, fontWeight: '600' }}>{e.name} ({formatCurrency(e.assigned || 0)})</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 }}>TO ENVELOPE (DESTINATION)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
            {envelopes.map(e => {
              var isSel = destId === e.id;
              return (
                <TouchableOpacity key={e.id} onPress={() => setDestId(e.id)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, backgroundColor: isSel ? theme.colors.primary : theme.colors.background, borderWidth: 1, borderColor: isSel ? theme.colors.primary : theme.colors.border, marginRight: 6 }}>
                  <Text style={{ color: isSel ? '#FFFFFF' : theme.colors.textPrimary, fontSize: 13, fontWeight: '600' }}>{e.name} ({formatCurrency(e.assigned || 0)})</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 }}>AMOUNT TO TRANSFER</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, marginBottom: 20 }}>
            <Text style={{ fontSize: 15, color: theme.colors.textSecondary }}>₱</Text>
            <TextInput
              value={amount}
              onChangeText={(val) => {
                var s = val.replace(/[^0-9.]/g, '');
                var parts = s.split('.');
                if (parts.length > 2) s = parts[0] + '.' + parts.slice(1).join('');
                setAmount(s);
              }}
              placeholder="0.00"
              keyboardType="decimal-pad"
              style={{ flex: 1, paddingVertical: 10, paddingLeft: 6, fontSize: 15, color: theme.colors.textPrimary }}
            />
          </View>

          <TouchableOpacity onPress={handleTransfer} style={{ backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' }}>Complete Transfer</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const EditSalaryModal = function({ visible, onClose, incomeSources, userSettings, mutateUpdateSettings }) {
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var insets = useSafeAreaInsets();
  var mainSalarySrc = incomeSources.find(s => s.id === 'main-salary') || { id: 'main-salary', name: 'Main Salary', amount: 0 };
  var [salary, setSalary] = useState(String(mainSalarySrc.amount || ''));

  var handleSave = () => {
    var newAmt = parseFloat(salary) || 0;
    var newSources = incomeSources.map(s => s.id === 'main-salary' ? { ...s, amount: newAmt } : s);
    if (!incomeSources.find(s => s.id === 'main-salary')) {
      newSources.unshift({ id: 'main-salary', name: 'Main Salary', amount: newAmt });
    }
    if (userSettings) {
      mutateUpdateSettings({ id: userSettings.id, data: { income_sources: newSources, monthly_salary: newAmt } }).then(() => {
        onClose();
      });
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }}>
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 16, padding: 24 }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.colors.textPrimary, marginBottom: 16 }}>Edit Main Salary</Text>
          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 }}>MONTHLY AMOUNT</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, marginBottom: 20 }}>
            <Text style={{ fontSize: 16, color: theme.colors.textSecondary }}>₱</Text>
            <TextInput
              value={salary}
              onChangeText={(val) => {
                var s = val.replace(/[^0-9.]/g, '');
                var parts = s.split('.');
                if (parts.length > 2) s = parts[0] + '.' + parts.slice(1).join('');
                setSalary(s);
              }}
              placeholder="0.00"
              keyboardType="decimal-pad"
              style={{ flex: 1, paddingVertical: 12, paddingLeft: 8, fontSize: 16, color: theme.colors.textPrimary }}
            />
          </View>
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
            <TouchableOpacity onPress={onClose} style={{ padding: 12 }}><Text style={{ color: theme.colors.textSecondary, fontWeight: '600', fontSize: 15 }}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={{ backgroundColor: theme.colors.primary, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 12 }}><Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 }}>Save</Text></TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const OnboardingModal = function({ visible, onClose, userSettings, mutateUpdateSettings }) {
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var insets = useSafeAreaInsets();

  var handleComplete = () => {
    if (userSettings) {
      mutateUpdateSettings({ id: userSettings.id, data: { has_seen_onboarding: true } }).then(() => {
        onClose();
      });
    } else {
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 24 }}>
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 20, padding: 24, alignItems: 'center' }}>
          <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
            <MaterialIcons name="mail" size={32} color={theme.colors.primary} />
          </View>
          <Text style={{ fontSize: 22, fontWeight: 'bold', color: theme.colors.textPrimary, marginBottom: 12, textAlign: 'center' }}>Welcome to Envelope Budgeting!</Text>
          <Text style={{ fontSize: 15, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 24 }}>
            Instead of just tracking expenses, you now give every penny a job. {'\n\n'}
            1. Your income goes into <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>Ready to Assign</Text>.{'\n'}
            2. You move that money into <Text style={{ fontWeight: 'bold', color: theme.colors.primary }}>Envelopes</Text> (categories).{'\n'}
            3. You spend money from those Envelopes.{'\n\n'}
            If an Envelope is empty, you can't spend from it!
          </Text>
          <TouchableOpacity onPress={handleComplete} style={{ backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 14, paddingHorizontal: 32, width: '100%', alignItems: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>Got it, let's start!</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const IncomeManagerModal = function({ visible, onClose, incomeSources, accounts = [], userSettings, theme, insetsTop, insetsBottom, onSaved }) {
  var [newSourceName, setNewSourceName] = useState('');
  var [newSourceAmount, setNewSourceAmount] = useState('');
  var [newSourceAccount, setNewSourceAccount] = useState('');
  var [editingSourceId, setEditingSourceId] = useState(null);
  var [editName, setEditName] = useState('');
  var [editAmount, setEditAmount] = useState('');
  var [editAccount, setEditAccount] = useState('');
  var [showSaved, setShowSaved] = useState(false);

  var updateSettings = useMutation('user_settings', 'update');
  var mutateUpdate = updateSettings.mutate;

  useEffect(() => {
    if (visible) {
      setNewSourceAccount('unlinked');
    }
  }, [visible]);

  var handleAddSource = function() {
    if (!newSourceName.trim()) {
      Platform.OS === 'web' ? window.alert('Please enter source name.') : Alert.alert('Error', 'Please enter source name.');
      return;
    }
    var amt = parseFloat(newSourceAmount);
    if (isNaN(amt) || amt < 0) {
      Platform.OS === 'web' ? window.alert('Please enter a valid monthly amount.') : Alert.alert('Error', 'Please enter a valid monthly amount.');
      return;
    }
    var newSrc = { 
      id: 'src-' + generateId(), 
      name: newSourceName.trim(), 
      amount: amt,
      account_id: newSourceAccount
    };
    var newList = incomeSources.concat(newSrc);
    
    if (userSettings) {
      mutateUpdate({ id: userSettings.id, data: { income_sources: newList } }).then(function() {
        setNewSourceName(''); setNewSourceAmount(''); onSaved(); setShowSaved(true);
        setTimeout(function() { setShowSaved(false); }, 2000);
      });
    }
  };

  var handleDeleteSource = function(id) {
    if (incomeSources.length <= 1) {
      Platform.OS === 'web' ? window.alert('You must have at least one income source.') : Alert.alert('Error', 'You must have at least one income source.');
      return;
    }
    var newList = incomeSources.filter(function(src) { return src.id !== id; });
    if (userSettings) {
      mutateUpdate({ id: userSettings.id, data: { income_sources: newList, monthly_salary: newList[0] ? newList[0].amount : 0 } }).then(function() {
        onSaved();
      });
    }
  };

  var handleStartEdit = function(src) {
    setEditingSourceId(src.id);
    setEditName(src.name);
    setEditAmount(String(src.amount || ''));
    setEditAccount(src.account_id || (accounts[0] ? accounts[0].id : ''));
  };

  var handleSaveEdit = function(id) {
    var amt = parseFloat(editAmount);
    if (!editName.trim()) {
      Platform.OS === 'web' ? window.alert('Please enter a name.') : Alert.alert('Error', 'Please enter a name.');
      return;
    }
    if (isNaN(amt) || amt < 0) {
      Platform.OS === 'web' ? window.alert('Please enter a valid amount.') : Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }
    var newList = incomeSources.map(function(src) {
      return src.id === id ? { ...src, name: editName.trim(), amount: amt, account_id: editAccount } : src;
    });
    if (userSettings) {
      mutateUpdate({ id: userSettings.id, data: { income_sources: newList, monthly_salary: newList[0] ? newList[0].amount : 0 } }).then(function() {
        setEditingSourceId(null); setEditName(''); setEditAmount(''); setEditAccount('');
        onSaved(); setShowSaved(true);
        setTimeout(function() { setShowSaved(false); }, 2000);
      });
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)', marginTop: insetsTop }}>
        <View style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: insetsBottom + 24, maxHeight: '85%' }}>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.textPrimary }}>My Income Sources</Text>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={24} color={theme.colors.textSecondary} /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0, maxHeight: 350 }}>
            {incomeSources.map(function(src) {
              var isEditing = editingSourceId === src.id;
              var acc = accounts.find(a => a.id === src.account_id) || accounts[0];
              var accName = acc ? acc.name : 'Physical Cash';
              
              return (
                <View key={src.id} style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                  {isEditing ? (
                    <View>
                      <TextInput 
                        value={editName} 
                        onChangeText={setEditName} 
                        placeholder="Source name"
                        style={{ backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 8, fontSize: 14, color: theme.colors.textPrimary, marginBottom: 8 }}
                      />
                      
                      <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
                        <View style={{ flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 10 }}>
                          <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>₱</Text>
                          <TextInput 
                            value={editAmount} 
                            onChangeText={setEditAmount} 
                            keyboardType="decimal-pad" 
                            placeholder="0.00"
                            style={{ flex: 1, paddingVertical: 8, paddingLeft: 4, fontSize: 14, color: theme.colors.textPrimary }}
                          />
                        </View>
                      </View>

                      <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 6 }}>LINKED ACCOUNT / WALLET</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
                        {accounts.map(a => {
                          var isSel = editAccount === a.id;
                          var styleInfo = WALLET_STYLES[a.type] || WALLET_STYLES.Custom;
                          var brandColor = a.color || styleInfo.color;
                          return (
                            <TouchableOpacity key={a.id} onPress={() => setEditAccount(a.id)} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: isSel ? theme.colors.primary : theme.colors.background, borderWidth: 1, borderColor: isSel ? theme.colors.primary : theme.colors.border }}>
                              <BrandLogo type={a.type} size={14} style={{ marginRight: 6 }} />
                              <Text style={{ color: isSel ? '#FFFFFF' : brandColor, fontSize: 12, fontWeight: '600' }}>{a.name}</Text>
                            </TouchableOpacity>
                          );
                        })}

                      </ScrollView>

                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={function() { handleSaveEdit(src.id); }} style={{ backgroundColor: theme.colors.primary, borderRadius: 8, paddingHorizontal: 16, paddingVertical: 10, justifyContent: 'center' }}>
                          <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 }}>Save</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={function() { setEditingSourceId(null); }} style={{ backgroundColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, justifyContent: 'center' }}>
                          <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1 }}>
                        <MaterialIcons name="label-outline" size={16} color={theme.colors.primary} style={{ marginRight: 8 }} />
                        <View>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary }}>{src.name}</Text>
                          <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.colors.primary }}>{formatCurrency(src.amount)}</Text>
                          
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                            <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>💳 Linked to: </Text>
                            {(() => {
                              var styleInfo = WALLET_STYLES[acc.type] || WALLET_STYLES.Custom;
                              return (
                                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                  <BrandLogo type={acc.type} size={12} style={{ marginRight: 4 }} />
                                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: theme.colors.textPrimary }}>{accName}</Text>
                                </View>
                              );
                            })()}
                          </View>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8 }}>
                        <TouchableOpacity onPress={function() { handleStartEdit(src); }} style={{ padding: 6, backgroundColor: '#FFEDD5', borderRadius: 8 }}>
                          <MaterialIcons name="edit" size={17} color={theme.colors.primary} />
                        </TouchableOpacity>
                        {incomeSources.length > 1 && (
                          <TouchableOpacity onPress={function() { handleDeleteSource(src.id); }} style={{ padding: 6, backgroundColor: '#FEF2F2', borderRadius: 8 }}>
                            <MaterialIcons name="delete-outline" size={17} color={theme.colors.error} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              );
            })}
          </ScrollView>

          <View style={{ marginTop: 16, backgroundColor: theme.colors.background, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: 8 }}>➕ ADD NEW INCOME SOURCE</Text>
            <TextInput 
              value={newSourceName} 
              onChangeText={setNewSourceName} 
              placeholder="Source name (e.g. Side Gig)"
              placeholderTextColor={theme.isDark ? '#6B7280' : '#9CA3AF'}
              style={{ backgroundColor: theme.colors.inputBg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.textPrimary, marginBottom: 8 }}
            />
            
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.inputBg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, marginBottom: 12 }}>
              <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginRight: 4 }}>₱</Text>
              <TextInput 
                value={newSourceAmount}
                onChangeText={function(text) {
                  var s = text.replace(/[^0-9.]/g, '');
                  var parts = s.split('.');
                  if (parts.length > 2) { s = parts[0] + '.' + parts.slice(1).join(''); }
                  setNewSourceAmount(s);
                }}
                placeholder="0.00 (Monthly Amount)" 
                placeholderTextColor={theme.isDark ? '#6B7280' : '#9CA3AF'}
                keyboardType="decimal-pad"
                style={{ flex: 1, paddingVertical: 10, fontSize: 14, color: theme.colors.textPrimary }}
              />
            </View>

            <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 6 }}>LINKED ACCOUNT / WALLET (OPTIONAL)</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 8, marginBottom: 12 }}>
              {accounts.map(a => {
                var isSel = newSourceAccount === a.id;
                var styleInfo = WALLET_STYLES[a.type] || WALLET_STYLES.Custom;
                var brandColor = a.color || styleInfo.color;
                return (
                  <TouchableOpacity key={a.id} onPress={() => setNewSourceAccount(a.id)} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 6, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 6, backgroundColor: isSel ? theme.colors.primary : theme.colors.inputBg, borderWidth: 1, borderColor: isSel ? theme.colors.primary : theme.colors.border }}>
                    <BrandLogo type={a.type} size={14} style={{ marginRight: 6 }} />
                    <Text style={{ color: isSel ? '#FFFFFF' : brandColor, fontSize: 12, fontWeight: '600' }}>{a.name}</Text>
                  </TouchableOpacity>
                );
              })}

            </ScrollView>

            <TouchableOpacity onPress={handleAddSource} style={{ backgroundColor: theme.colors.primary, borderRadius: 8, padding: 12, alignItems: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 }}>Add Source</Text>
            </TouchableOpacity>
          </View>

          {showSaved && (
            <View style={{ backgroundColor: '#E6F4EA', borderRadius: 8, padding: 10, marginTop: 12, flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons name="check-circle" size={18} color={theme.colors.primary} />
              <Text style={{ color: theme.colors.primary, fontSize: 13, marginLeft: 8, fontWeight: '600' }}>Income sources updated successfully!</Text>
            </View>
          )}

        </View>
      </View>
    </Modal>
  );
};

const SpentManagerModal = function({ visible, onClose, filter, oneTimeExpenses, envelopes, userId, theme, insetsTop, insetsBottom, onSaved }) {
  var [editingId, setEditingId] = useState(null);
  var [editName, setEditName] = useState('');
  var [editAmount, setEditAmount] = useState('');

  useEffect(() => {
    if (!visible) {
      setEditingId(null);
      setEditName('');
      setEditAmount('');
    }
  }, [visible]);
  
  var deleteOneTime = useMutation('one_time_expenses', 'delete');
  var mutateDeleteOneTime = deleteOneTime.mutate;
  var deleteHistory = useMutation('expense_history', 'delete');
  var mutateDeleteHistory = deleteHistory.mutate;
  
  var updateOneTime = useMutation('one_time_expenses', 'update');
  var mutateUpdateOneTime = updateOneTime.mutate;
  var updateHistory = useMutation('expense_history', 'update');
  var mutateUpdateHistory = updateHistory.mutate;

  var filteredExpenses = useMemo(function() {
    if (!filter) return oneTimeExpenses;
    return oneTimeExpenses.filter(function(o) { return o.category === filter; });
  }, [oneTimeExpenses, filter]);

  var handleStartEdit = function(exp) {
    setEditingId(exp.id);
    setEditName(exp.name);
    setEditAmount(String(exp.amount));
  };

  var handleSaveEdit = function(exp) {
    var amt = parseFloat(editAmount);
    if (!editName.trim()) {
      Platform.OS === 'web' ? window.alert('Please enter a name.') : Alert.alert('Error', 'Please enter a name.');
      return;
    }
    if (isNaN(amt) || amt <= 0) {
      Platform.OS === 'web' ? window.alert('Please enter a valid amount.') : Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }
    
    // Check if envelope has enough funds if edited amount is larger
    var env = envelopes.find(function(e) { return e.id === exp.category; });
    var oldAmt = parseFloat(exp.amount) || 0;
    var diff = amt - oldAmt;
    if (env && env.available < diff) {
      var err = 'Insufficient funds in envelope ' + env.name + '. Available: ' + env.available;
      Platform.OS === 'web' ? window.alert(err) : Alert.alert('Error', err);
      return;
    }

    mutateUpdateOneTime({ id: exp.id, data: { name: editName.trim(), amount: amt } }).then(function() {
      return mutateUpdateHistory({ id: exp.id, data: { expense_name: editName.trim(), amount: amt } });
    }).then(function() {
      setEditingId(null);
      onSaved();
    });
  };

  var handleDelete = function(exp) {
    var msg = 'Delete this expense? The amount (' + formatCurrency(exp.amount) + ') will be returned to your envelope balance.';
    var doDelete = function() {
      mutateDeleteOneTime({ id: exp.id }).then(function() {
        return mutateDeleteHistory({ id: exp.id });
      }).then(function() {
        onSaved();
      });
    };
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) doDelete();
    } else {
      Alert.alert('Delete Expense', msg, [
        { text: 'Cancel' },
        { text: 'Delete', style: 'destructive', onPress: doDelete }
      ]);
    }
  };

  if (!visible) return null;

  var filterEnv = envelopes.find(function(e) { return e.id === filter; });
  var title = filterEnv ? filterEnv.name + ' Spending' : "This Month's Spending";

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)', marginTop: insetsTop }}>
        <View style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: insetsBottom + 24, maxHeight: '85%' }}>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.textPrimary }}>{title}</Text>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={24} color={theme.colors.textSecondary} /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0, maxHeight: 400 }}>
            {filteredExpenses.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <MaterialIcons name="shopping-bag" size={44} color={theme.colors.border} />
                <Text style={{ color: theme.colors.textSecondary, marginTop: 12, fontSize: 14 }}>No spent items for this period</Text>
              </View>
            ) : (
              filteredExpenses.map(function(exp) {
                var isEditing = editingId === exp.id;
                var env = envelopes.find(function(e) { return e.id === exp.category; });
                return React.createElement(View, { key: exp.id, style: { backgroundColor: theme.colors.background, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border } },
                  isEditing
                    ? React.createElement(View, null,
                        React.createElement(TextInput, { value: editName, onChangeText: setEditName, placeholder: 'Name',
                          placeholderTextColor: theme.isDark ? '#6B7280' : '#9CA3AF',
                          style: { backgroundColor: theme.colors.inputBg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, color: theme.colors.textPrimary, marginBottom: 8 }
                        }),
                        React.createElement(View, { style: { flexDirection: 'row', gap: 8 } },
                          React.createElement(View, { style: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.inputBg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 8 } },
                            React.createElement(Text, { style: { fontSize: 14, color: theme.colors.textSecondary } }, '₱'),
                            React.createElement(TextInput, { value: editAmount, onChangeText: setEditAmount, keyboardType: 'decimal-pad', placeholder: '0.00',
                              placeholderTextColor: theme.isDark ? '#6B7280' : '#9CA3AF',
                              style: { flex: 1, paddingVertical: 6, paddingLeft: 4, fontSize: 14, color: theme.colors.textPrimary }
                            })
                          ),
                          React.createElement(TouchableOpacity, { onPress: function() { handleSaveEdit(exp); },
                            style: { backgroundColor: theme.colors.primary, borderRadius: 8, paddingHorizontal: 12, justifyContent: 'center' }
                          },
                            React.createElement(Text, { style: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 } }, 'Save')
                          ),
                          React.createElement(TouchableOpacity, { onPress: function() { setEditingId(null); },
                            style: { backgroundColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 10, justifyContent: 'center' }
                          },
                            React.createElement(Text, { style: { color: theme.colors.textSecondary, fontSize: 13 } }, 'Cancel')
                          )
                        )
                      )
                    : React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } },
                        React.createElement(View, { style: { flex: 1 } },
                          React.createElement(Text, { style: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary } }, exp.name),
                          React.createElement(Text, { style: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 } }, formatDate(exp.date) + (env ? ' • Env: ' + env.name : ''))
                        ),
                        React.createElement(View, { style: { alignItems: 'flex-end' } },
                          React.createElement(Text, { style: { fontSize: 15, fontWeight: 'bold', color: theme.colors.error, marginBottom: 6 } }, '-' + formatCurrency(exp.amount)),
                          React.createElement(View, { style: { flexDirection: 'row', gap: 8 } },
                            React.createElement(TouchableOpacity, { onPress: function() { handleStartEdit(exp); }, style: { padding: 4, backgroundColor: '#FFEDD5', borderRadius: 6 } },
                              React.createElement(MaterialIcons, { name: 'edit', size: 16, color: theme.colors.primary })
                            ),
                            React.createElement(TouchableOpacity, { onPress: function() { handleDelete(exp); }, style: { padding: 4, backgroundColor: '#FEF2F2', borderRadius: 6 } },
                              React.createElement(MaterialIcons, { name: 'delete-outline', size: 16, color: theme.colors.error })
                            )
                          )
                        )
                      )
                );
              })
            )}
          </ScrollView>

        </View>
      </View>
    </Modal>
  );
};

const getEnvelopeIcon = function(name) {
  var lower = (name || '').toLowerCase();
  if (lower.includes('housing') || lower.includes('rent') || lower.includes('home') || lower.includes('house')) return 'home';
  if (lower.includes('food') || lower.includes('dine') || lower.includes('eat') || lower.includes('grocery') || lower.includes('restaurant')) return 'restaurant';
  if (lower.includes('transport') || lower.includes('car') || lower.includes('travel') || lower.includes('commute') || lower.includes('gas') || lower.includes('fare')) return 'directions-car';
  if (lower.includes('saving')) return 'savings';
  if (lower.includes('health') || lower.includes('medical') || lower.includes('hospital') || lower.includes('drug') || lower.includes('clinic')) return 'local-hospital';
  if (lower.includes('school') || lower.includes('education') || lower.includes('book') || lower.includes('course') || lower.includes('class')) return 'school';
  if (lower.includes('utility') || lower.includes('bill') || lower.includes('electric') || lower.includes('water') || lower.includes('internet') || lower.includes('phone')) return 'receipt';
  return 'label-important';
};

const DashboardScreen = function(props) {
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
  var scrollBottomPadding = Platform.OS === 'web' ? WEB_TAB_MENU_PADDING : (TAB_MENU_HEIGHT + insets.bottom + SCROLL_EXTRA_PADDING);
  var fabBottom = Platform.OS === 'web' ? WEB_TAB_MENU_PADDING : (TAB_MENU_HEIGHT + insets.bottom + FAB_SPACING);

  var totalAvailableMoney = state.accounts.reduce(function(sum, acc) { return sum + acc.balance; }, 0);
  var unlinkedIncome = state.incomeSources.reduce(function(sum, src) {
    if (!src.account_id || src.account_id === 'unlinked') {
      return sum + (parseFloat(src.amount) || 0);
    }
    return sum;
  }, 0);
  var totalActualMoney = totalAvailableMoney + unlinkedIncome;
  var rtaColor = state.readyToAssign === 0 ? '#10B981' : (state.readyToAssign > 0 ? theme.colors.primary : theme.colors.error);

  var smartInsights = useMemo(function() {
    var insights = [];
    var today = new Date().toISOString().split('T')[0];

    // 1. Low Envelopes warning
    state.envelopeBalances.forEach(function(env) {
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
    var savingsEnv = state.envelopeBalances.find(function(e) {
      return e.id === 'env-savings' || e.name.toLowerCase().includes('saving');
    });
    if (savingsEnv && savingsEnv.available > 0) {
      insights.push({
        type: 'success',
        icon: 'savings',
        color: '#10B981',
        text: `Awesome! You have stored ${formatCurrency(savingsEnv.available)} in your Savings envelope. Keep adding to it!`
      });
    }

    // 3. Overall spending ratio nudge
    var baseIncome = state.incomeSources.reduce(function(sum, src) { return sum + (parseFloat(src.amount) || 0); }, 0);
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
        color: theme.colors.primary,
        text: "Tip: Give every peso a job. Allocate all remaining Ready to Assign funds to your envelopes!"
      });
    }

    return insights;
  }, [state.envelopeBalances, state.incomeSources, state.totalExpenses, state.recurringExpenses, theme]);

  var activeInsight = smartInsights[insightIndex % smartInsights.length] || smartInsights[0];
  
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingBottom: scrollBottomPadding }}>
        
        {/* Header Block (Moves/Scrolls with everything else!) */}
        <View style={{ backgroundColor: theme.colors.primary, paddingTop: insets.top + 16, paddingBottom: 24, paddingHorizontal: 20, borderBottomLeftRadius: 24, borderBottomRightRadius: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Image source={logoImg} style={{ width: 40, height: 40, borderRadius: 20, borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.6)' }} />
              <View>
                <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '900', letterSpacing: 1 }}>PENNY BUDGETING</Text>
                <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: 'bold' }}>Hi, {userName}!</Text>
              </View>
            </View>
            <TouchableOpacity 
              onPress={function() { setShowNotificationCenter(true); setHasViewedAlerts(true); }}
              style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: 'rgba(255,255,255,0.15)', alignItems: 'center', justifyContent: 'center' }}
            >
              <MaterialIcons name="notifications-active" size={24} color="#FFFFFF" />
              {!hasViewedAlerts && state.recurringExpenses && state.recurringExpenses.filter(r => r.status === 'Pending').length > 0 && (
                <View style={{ position: 'absolute', top: 4, right: 4, backgroundColor: theme.colors.error, borderRadius: 10, paddingHorizontal: 5, paddingVertical: 1, borderWidth: 1, borderColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center' }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' }}>
                    {state.recurringExpenses.filter(r => r.status === 'Pending').length}
                  </Text>
                </View>
              )}
            </TouchableOpacity>
          </View>
          
          <View style={{ backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 20, flexDirection: 'column', gap: 14 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <View>
                <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginBottom: 4, fontWeight: '600' }}>READY TO ASSIGN</Text>
                <Text style={{ color: '#FFFFFF', fontSize: 26, fontWeight: 'bold' }}>{formatCurrency(state.readyToAssign)}</Text>
              </View>
              {state.readyToAssign > 0 && (
                <TouchableOpacity onPress={() => state.setShowAssignModal(true)} style={{ backgroundColor: '#FFFFFF', paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 }}>
                  <Text style={{ color: theme.colors.primary, fontWeight: 'bold', fontSize: 13 }}>Assign</Text>
                </TouchableOpacity>
              )}
            </View>

            <View style={{ height: 1, backgroundColor: 'rgba(255,255,255,0.2)' }} />

            <View>
              <Text style={{ color: 'rgba(255,255,255,0.8)', fontSize: 12, marginBottom: 4, fontWeight: '600' }}>TOTAL CURRENT MONEY</Text>
              <Text style={{ color: '#6EE7B7', fontSize: 26, fontWeight: 'bold' }}>{formatCurrency(totalActualMoney)}</Text>
            </View>
          </View>
        </View>

        {/* Content Container with standard padding */}
        <View style={{ paddingHorizontal: 20, paddingTop: 20 }}>

        {/* Dynamic Insights Banner */}
        <TouchableOpacity 
          onPress={function() { setInsightIndex(insightIndex + 1); }} 
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
            <Text style={{ fontSize: 15, fontWeight: 'bold', color: theme.colors.textPrimary }}>This Month's Overview</Text>
          </View>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 14 }}>
            <TouchableOpacity onPress={function() { setShowIncomeModal(true); }} style={{ flex: 1, alignItems: 'center', backgroundColor: '#FFEDD5', borderRadius: 10, padding: 10, marginRight: 6 }}>
              <View style={{ position: 'absolute', right: 8, top: 8 }}>
                <MaterialIcons name="add-circle-outline" size={13} color="#C2410C" />
              </View>
              <Text style={{ fontSize: 11, color: '#C2410C', fontWeight: '700', marginBottom: 3 }}>INCOME</Text>
              <Text style={{ fontSize: 15, fontWeight: 'bold', color: theme.colors.primary }} numberOfLines={1}>{formatCurrency(state.totalIncome)}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={function() { setSpentFilter(null); setShowSpentModal(true); }} style={{ flex: 1, alignItems: 'center', backgroundColor: '#FEE2E2', borderRadius: 10, padding: 10, marginRight: 6 }}>
              <View style={{ position: 'absolute', right: 8, top: 8 }}>
                <MaterialIcons name="visibility" size={13} color="#B91C1C" />
              </View>
              <Text style={{ fontSize: 11, color: '#B91C1C', fontWeight: '700', marginBottom: 3 }}>SPENT</Text>
              <Text style={{ fontSize: 15, fontWeight: 'bold', color: theme.colors.error }} numberOfLines={1}>{formatCurrency(state.totalExpenses)}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={function() {
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

        {/* Wallets & Bank Accounts Section */}
        <View style={{ marginBottom: 24 }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.textPrimary }}>Wallets & Accounts</Text>
            <TouchableOpacity onPress={() => setShowAddAccountModal(true)} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons name="add" size={16} color={theme.colors.primary} style={{ marginRight: 4 }} />
              <Text style={{ color: theme.colors.primary, fontWeight: 'bold', fontSize: 14 }}>Add Account</Text>
            </TouchableOpacity>
          </View>

          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', paddingVertical: 4 }}>
            {state.accounts.map(acc => {
              var walletStyle = WALLET_STYLES[acc.type] || WALLET_STYLES.Custom;
              return (
                <View 
                  key={acc.id} 
                  style={{ 
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
                    elevation: 4
                  }}
                >
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <BrandLogo type={acc.type} size={28} />
                    <TouchableOpacity 
                      onPress={() => {
                        setSelectedAccount(acc);
                        setShowEditAccountModal(true);
                      }} 
                      style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.2)', alignItems: 'center', justifyContent: 'center' }}
                    >
                      <MaterialIcons name="edit" size={12} color="#FFFFFF" />
                    </TouchableOpacity>
                  </View>
                  <View>
                    <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 11, fontWeight: '600' }} numberOfLines={1}>
                      {acc.name}
                    </Text>
                    <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold', marginTop: 2 }}>
                      {formatCurrency(acc.balance)}
                    </Text>
                  </View>
                </View>
              );
            })}
          </ScrollView>
        </View>

        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
          <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.textPrimary }}>Envelopes</Text>
          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={() => setShowTransferEnvModal(true)} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons name="swap-horiz" size={16} color={theme.colors.primary} style={{ marginRight: 4 }} />
              <Text style={{ color: theme.colors.primary, fontWeight: 'bold', fontSize: 14, marginRight: 8 }}>Transfer</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setShowAddEnvModal(true)} style={{ flexDirection: 'row', alignItems: 'center' }}>
              <MaterialIcons name="add" size={16} color={theme.colors.primary} style={{ marginRight: 4 }} />
              <Text style={{ color: theme.colors.primary, fontWeight: 'bold', fontSize: 14 }}>Add</Text>
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {state.envelopeBalances.map(env => {
            var actualEnv = state.envelopes.find(ev => ev.id === env.id) || {};
            var goalAmount = actualEnv.goal_amount || 0;
            var goalDate = actualEnv.goal_date || '';
            var goalPct = goalAmount > 0 ? Math.min(100, Math.round((env.available / goalAmount) * 100)) : 0;
            
            return (
              <TouchableOpacity key={env.id} onPress={function() { setSpentFilter(env.id); setShowSpentModal(true); }} style={{ width: '48%', backgroundColor: theme.colors.card, borderRadius: 16, padding: 16, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <MaterialIcons name={getEnvelopeIcon(env.name)} size={20} color={theme.colors.primary} />
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Text style={{ fontSize: 11, fontWeight: 'bold', color: env.available < 0 ? theme.colors.error : theme.colors.textSecondary }}>
                      {env.available < 0 ? 'OVERSPENT' : ''}
                    </Text>
                    <TouchableOpacity onPress={function(e) {
                      e.stopPropagation();
                      var actualEvObj = state.envelopes.find(ev => ev.id === env.id);
                      setSelectedEnvelope(actualEvObj);
                      setShowEditEnvModal(true);
                    }} style={{ padding: 4 }}>
                      <MaterialIcons name="edit" size={14} color={theme.colors.textSecondary} />
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
      <TouchableOpacity onPress={() => state.setShowAddModal(true)} style={{ position: 'absolute', right: 20, bottom: fabBottom, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 }}>
        <MaterialIcons name="add" size={28} color="#FFFFFF" />
      </TouchableOpacity>
      
      <AddExpenseModal visible={state.showAddModal} onClose={() => state.setShowAddModal(false)} onSaved={state.refetchAll} userId={userId} theme={theme} insetsTop={insets.top} insetsBottom={insets.bottom} envelopes={state.envelopeBalances} accounts={state.accounts} />
      <AssignMoneyModal visible={state.showAssignModal} onClose={() => { state.setShowAssignModal(false); state.refetchAll(); }} readyToAssign={state.readyToAssign} totalIncome={state.totalAvailableMoney} envelopes={state.envelopeBalances} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} onSaved={state.refetchAll} />
      <OnboardingModal visible={state.showOnboarding} onClose={() => { state.setShowOnboarding(false); state.refetchAll(); }} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} />
      <SpentManagerModal visible={showSpentModal} onClose={function() { setShowSpentModal(false); }} filter={spentFilter} oneTimeExpenses={state.oneTimeExpenses} envelopes={state.envelopeBalances} userId={userId} theme={theme} insetsTop={insets.top} insetsBottom={insets.bottom} onSaved={state.refetchAll} />
      <IncomeManagerModal visible={showIncomeModal} onClose={function() { setShowIncomeModal(false); }} incomeSources={state.incomeSources} accounts={state.accounts} userSettings={state.userSettings} theme={theme} insetsTop={insets.top} insetsBottom={insets.bottom} onSaved={state.refetchAll} />
      <AddEnvelopeModal visible={showAddEnvModal} onClose={function() { setShowAddEnvModal(false); }} envelopes={state.envelopes} readyToAssign={state.readyToAssign} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} onSaved={state.refetchAll} />
      <EditEnvelopeModal visible={showEditEnvModal} onClose={function() { setShowEditEnvModal(false); setSelectedEnvelope(null); }} envelope={selectedEnvelope} readyToAssign={state.readyToAssign} envelopes={state.envelopes} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} onSaved={state.refetchAll} />
      <TransferEnvelopeModal visible={showTransferEnvModal} onClose={function() { setShowTransferEnvModal(false); }} envelopes={state.envelopes} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} onSaved={state.refetchAll} />
      <SavingsManagerModal visible={showSavingsManagerModal} onClose={function() { setShowSavingsManagerModal(false); }} state={state} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} onSaved={state.refetchAll} />
      
      <AddAccountModal visible={showAddAccountModal} onClose={() => setShowAddAccountModal(false)} accounts={state.accounts} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} onSaved={state.refetchAll} />
      <EditAccountModal visible={showEditAccountModal} onClose={() => { setShowEditAccountModal(false); setSelectedAccount(null); }} account={selectedAccount} accounts={state.accounts} userSettings={state.userSettings} mutateUpdateSettings={state.mutateUpdateSettings} onSaved={state.refetchAll} />
      <NotificationCenterModal visible={showNotificationCenter} onClose={function() { setShowNotificationCenter(false); }} state={state} theme={theme} insets={insets} />
    </View>
  );
};

export default DashboardScreen;

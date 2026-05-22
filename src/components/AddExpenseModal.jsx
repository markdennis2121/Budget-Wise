import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, ScrollView, Alert, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery, useMutation } from 'platform-hooks';
import { generateId, getTodayStr, getCurrentMonthStr, getMonthStr, parseAmount } from '../utils/helpers';
import { evaluateAmountExpression } from '../utils/amountFormat';
import DatePickerInput from './DatePickerInput';
import AmountInput from './AmountInput';
import SaveSuccessOverlay from './SaveSuccessOverlay';
import { scheduleBillNotification } from '../utils/notifications';
import { runSaveWithFeedback } from '../utils/saveSuccess';
import { triggerImpactHaptic, triggerErrorHaptic, showUndoToast } from '../utils/feedback';
import {
  parseUserEnvelopes,
  expenseTypeRequiresEnvelope,
  validateEnvelopeForSpend
} from '../utils/envelopeGuards';
import BrandLogo from './BrandLogo';

const WALLET_STYLES = {
  GCash: { color: '#1E3A8A', name: 'GCash', logo: 'account-balance-wallet' },
  Maya: { color: '#059669', name: 'Maya', logo: 'account-balance-wallet' },
  GoTyme: { color: '#111827', name: 'GoTyme Bank', logo: 'stars' },
  BPI: { color: '#B91C1C', name: 'BPI Bank', logo: 'account-balance' },
  BDO: { color: '#002E6E', name: 'BDO Unibank', logo: 'account-balance' },
  EastWest: { color: '#4B1B8A', name: 'EastWest', logo: 'account-balance' },
  Metrobank: { color: '#0033A0', name: 'Metrobank', logo: 'account-balance' },
  PNB: { color: '#8A1B1D', name: 'PNB', logo: 'account-balance' },
  RCBC: { color: '#004B87', name: 'RCBC', logo: 'account-balance' },
  SecurityBank: { color: '#00A4E8', name: 'Security Bank', logo: 'account-balance' },
  Wise: { color: '#9FE870', name: 'Wise', logo: 'payment' },
  MariBank: { color: '#EA580C', name: 'MariBank', logo: 'shopping-bag' },
  SeaBank: { color: '#F97316', name: 'SeaBank', logo: 'credit-card' },
  Tonik: { color: '#DB2777', name: 'Tonik Bank', logo: 'savings' },
  PayPal: { color: '#2563EB', name: 'PayPal', logo: 'payment' },
  Cash: { color: '#4B5563', name: 'Cash Wallet', logo: 'money' },
  Custom: { color: '#0F766E', name: 'Wallet/Bank', logo: 'credit-card' }
};

var EXPENSE_TYPE_HELP = {
  one_time: {
    modalTitle: 'Quick spend',
    tabLabel: 'Spend',
    icon: 'shopping-cart',
    hint: 'Record something you bought today. Pick an envelope (your budget category) and the wallet you paid with.',
    nameLabel: 'What did you buy?',
    namePlaceholder: 'e.g. Groceries, Coffee, Grab ride',
    saveLabel: 'Save spend'
  },
  recurring: {
    modalTitle: 'Monthly bill',
    tabLabel: 'Bill',
    icon: 'event-repeat',
    hint: 'Bills that repeat each month (rent, Netflix, utilities). You pay them later from the Bills tab.',
    nameLabel: 'Bill name',
    namePlaceholder: 'e.g. Rent, Spotify, Internet',
    saveLabel: 'Save bill'
  },
  transfer: {
    modalTitle: 'Wallet transfer',
    tabLabel: 'Wallets',
    icon: 'swap-horiz',
    hint: 'Move cash between your wallets only — not spending. Example: salary bank → GCash. Envelopes and Ready to Assign do not change.',
    nameLabel: 'Note (optional)',
    namePlaceholder: 'e.g. Bank to GCash, Cash withdrawal',
    saveLabel: 'Move money'
  },
  income: {
    modalTitle: 'Add income',
    tabLabel: 'Income',
    icon: 'payments',
    hint: 'Log extra income this month.',
    nameLabel: 'Income source',
    namePlaceholder: 'e.g. Freelance, Bonus',
    saveLabel: 'Save income'
  }
};

function getExpenseHelp(expType) {
  return EXPENSE_TYPE_HELP[expType] || EXPENSE_TYPE_HELP.one_time;
}

const AddExpenseModal = function (props) {
  var visible = props.visible;
  var onClose = props.onClose;
  var onSaved = props.onSaved;
  var userId = props.userId;
  var theme = props.theme;
  var insetsTop = props.insetsTop;
  var insetsBottom = props.insetsBottom;
  var initialExpType = props.initialExpType || 'one_time';

  var [expType, setExpType] = useState(initialExpType);
  var [expName, setExpName] = useState('');
  var [expAmount, setExpAmount] = useState('');
  var [expDate, setExpDate] = useState(getTodayStr());
  var [dueDate, setDueDate] = useState(getTodayStr());
  var [errorMsg, setErrorMsg] = useState('');
  var [selectedFund, setSelectedFund] = useState('');
  var [destAccount, setDestAccount] = useState('');
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);

  var insertRecurring = useMutation('recurring_expenses', 'insert');
  var mutateRecurring = insertRecurring.mutate;
  var insertOneTime = useMutation('one_time_expenses', 'insert');
  var mutateOneTime = insertOneTime.mutate;
  var insertHistory = useMutation('expense_history', 'insert');
  var mutateHistory = insertHistory.mutate;
  var deleteOneTime = useMutation('one_time_expenses', 'delete');
  var mutateDeleteOneTime = deleteOneTime.mutate;
  var deleteRecurring = useMutation('recurring_expenses', 'delete');
  var mutateDeleteRecurring = deleteRecurring.mutate;
  var deleteHistory = useMutation('expense_history', 'delete');
  var mutateDeleteHistory = deleteHistory.mutate;

  var settingsQuery = useQuery('user_settings');
  var allSettings = settingsQuery.data || [];
  var userSettings = allSettings.find(function (s) { return s.user_id === userId; });

  var recurringQuery = useQuery('recurring_expenses');
  var allRecurring = recurringQuery.data || [];
  var recurringExpenses = allRecurring.filter(function (r) { return r.user_id === userId; });

  var oneTimeQuery = useQuery('one_time_expenses');
  var allOneTime = oneTimeQuery.data || [];
  var curMonth = getCurrentMonthStr();
  var oneTimeExpenses = allOneTime.filter(function (o) { return o.user_id === userId && getMonthStr(o.date) === curMonth; });

  var accounts = props.accounts || [];

  var rawEnvelopes = useMemo(function () {
    return parseUserEnvelopes(userSettings);
  }, [userSettings]);

  var spendBlocked = expenseTypeRequiresEnvelope(expType) && rawEnvelopes.length === 0;
  var typeHelp = getExpenseHelp(expType);
  var transferNeedsWallets = expType === 'transfer' && accounts.length < 2;

  // Calculate Envelope Balances (only real user envelopes)
  var envelopes = useMemo(function () {
    var envs = rawEnvelopes;
    var balances = envs.map(e => ({ ...e, assigned: parseFloat(e.assigned) || 0, spent: 0, reserved: 0 }));

    recurringExpenses.forEach(function (r) {
      if (r.status === 'Paid' || r.status === 'Paid in Advance') {
        var envPaid = balances.find(function (e) { return e.id === r.category || e.name === r.category; });
        if (envPaid) envPaid.spent += (parseFloat(r.amount) || 0);
      } else if (r.status === 'Pending') {
        var envPending = balances.find(function (e) { return e.id === r.category || e.name === r.category; });
        if (envPending) envPending.reserved += (parseFloat(r.amount) || 0);
      }
    });
    oneTimeExpenses.forEach(function (o) {
      var env = balances.find(function (e) { return e.id === o.category || e.name === o.category; });
      if (env) env.spent += (parseFloat(o.amount) || 0);
    });

    return balances.map(function (e) { return { ...e, available: e.assigned - e.spent - e.reserved }; });
  }, [rawEnvelopes, recurringExpenses, oneTimeExpenses]);

  var incomeSources = useMemo(function () {
    if (userSettings && userSettings.income_sources) {
      return typeof userSettings.income_sources === 'string' ? JSON.parse(userSettings.income_sources) : userSettings.income_sources;
    }
    var sal = userSettings ? (parseFloat(userSettings.monthly_salary) || 0) : 0;
    return [{ id: 'main-salary', name: 'Main Salary', amount: sal }];
  }, [userSettings]);

  var optionsList = expType === 'income' ? incomeSources : envelopes;
  var [selectedAccount, setSelectedAccount] = useState('');

  useEffect(() => {
    if (visible && optionsList.length > 0) {
      var exists = optionsList.some(function (opt) { return opt.id === selectedFund; });
      if (!exists) {
        setSelectedFund(optionsList[0].id);
      }
    }
  }, [visible, optionsList, expType]);

  useEffect(function () {
    if (visible) {
      setShowSaveSuccess(false);
      var startType = initialExpType;
      if (expenseTypeRequiresEnvelope(initialExpType) && rawEnvelopes.length === 0) {
        startType = 'transfer';
      }
      setExpType(startType);
      setErrorMsg('');
      setExpName('');
      setExpAmount('');
      setExpDate(getTodayStr());
      setDueDate(getTodayStr());
    }
  }, [visible, initialExpType, rawEnvelopes.length]);

  useEffect(function () {
    if (!visible) return;
    if (accounts && accounts.length > 0) {
      setSelectedAccount(accounts[0].id);
    } else {
      setSelectedAccount('unlinked');
    }
    setDestAccount('');
  }, [visible, accounts]);

  var finishSave = function (savePromise, feedbackOpts) {
    feedbackOpts = feedbackOpts || {};
    runSaveWithFeedback(savePromise, {
      onClose: onClose,
      onSaved: onSaved,
      setShowSuccess: setShowSaveSuccess,
      message: feedbackOpts.message,
      undoMessage: feedbackOpts.undoMessage,
      undo: feedbackOpts.undo,
      errorMessage: 'Failed to save. Please try again.',
      onError: function () { setErrorMsg('Failed to save. Try again.'); }
    }).then(function () {
      setExpName('');
      setExpAmount('');
      setExpDate(getTodayStr());
      setDueDate(getTodayStr());
      setSelectedAccount('');
      setDestAccount('');
    });
  };

  var handleSave = function () {
    if (expType !== 'transfer' && !expName.trim()) {
      triggerErrorHaptic();
      setErrorMsg(expType === 'recurring' ? 'Please enter a bill name.' : 'Please enter what you spent on.');
      return;
    }
    var amt = parseAmount(expAmount);
    if (expAmount && /[+\-*/]/.test(expAmount)) {
      var evaluated = evaluateAmountExpression(expAmount);
      if (!isNaN(evaluated)) amt = evaluated;
    }
    if (isNaN(amt) || amt <= 0) {
      triggerErrorHaptic();
      setErrorMsg('Please enter a valid amount.');
      return;
    }
    setErrorMsg('');

    if (expenseTypeRequiresEnvelope(expType)) {
      if (!selectedFund || envelopes.length === 0) {
        setErrorMsg('Select an envelope. Create one on the Dashboard if you have none.');
        return;
      }
      var envCheck = validateEnvelopeForSpend(userSettings, selectedFund);
      if (!envCheck.ok) {
        setErrorMsg(envCheck.message);
        return;
      }
    }

    if (expType === 'transfer') {
      if (!selectedAccount || selectedAccount === 'unlinked') {
        setErrorMsg('Please select a source wallet.');
        return;
      }
      if (!destAccount || destAccount === 'unlinked') {
        setErrorMsg('Please select a destination wallet.');
        return;
      }
      if (selectedAccount === destAccount) {
        setErrorMsg('Source and Destination wallets must be different.');
        return;
      }
      var srcAcc = accounts.find(a => a.id === selectedAccount);
      var destAcc = accounts.find(a => a.id === destAccount);
      if (srcAcc && srcAcc.balance < amt) {
        setErrorMsg(`Insufficient funds in ${srcAcc.name}. Balance: ₱${srcAcc.balance}`);
        return;
      }

      var expId = generateId();
      var timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
      var transferLabel = expName.trim() || (srcAcc.name + ' to ' + destAcc.name);
      mutateHistory({
        id: expId,
        user_id: userId,
        expense_name: transferLabel,
        amount: amt,
        expense_type: 'Transfer',
        date: expDate,
        status: 'Spent',
        notes: timeStr + ' • Wallet transfer: ' + srcAcc.name + ' → ' + destAcc.name,
        account_id: selectedAccount,
        dest_account_id: destAccount
      }).then(function () {
        finishSave(Promise.resolve(), {
          message: 'Money moved!',
          undoMessage: 'Wallet transfer saved',
          undo: function () {
            return mutateDeleteHistory({ id: expId }).then(function () { onSaved && onSaved(); });
          }
        });
      });
      return;
    }

    if (expType !== 'transfer') {
      if (!selectedAccount || selectedAccount === 'unlinked') {
        setErrorMsg('Please select a wallet.');
        return;
      }
    }

    var selectedItem = optionsList.find(o => o.id === selectedFund);
    var fundName = selectedItem ? selectedItem.name : 'Unknown';

    if (expType === 'one_time') {
      var env = envelopes.find(e => e.id === selectedFund);
      if (env && env.available < amt) {
        setErrorMsg(`Insufficient funds in ${env.name}. Available: ${env.available}`);
        return;
      }
      if (selectedAccount && selectedAccount !== 'unlinked') {
        var selectedAcc = accounts.find(a => a.id === selectedAccount);
        if (selectedAcc && selectedAcc.balance < amt) {
          setErrorMsg(`Insufficient funds in wallet: ${selectedAcc.name}. Balance: ₱${selectedAcc.balance.toFixed(2)}`);
          return;
        }
      }
    }

    var selectedAcc = accounts.find(a => a.id === selectedAccount);
    var accName = selectedAcc ? selectedAcc.name : 'Wallet';

    var timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (expType === 'one_time') {
      var expId = generateId();
      var newOneTime = { id: expId, user_id: userId, name: expName.trim(), amount: amt, date: expDate, category: selectedFund, account_id: selectedAccount };
      var savePromise = mutateOneTime(newOneTime).then(function () {
        return mutateHistory({
          id: expId,
          user_id: userId,
          expense_name: expName.trim(),
          amount: amt,
          expense_type: 'One-Time',
          date: expDate,
          status: 'Spent',
          notes: timeStr + ' • Env: ' + fundName + ' • Paid via: ' + accName,
          account_id: selectedAccount,
          category: selectedFund
        });
      });
      finishSave(savePromise, {
        message: 'Expense saved!',
        undoMessage: 'Expense saved',
        undo: function () {
          return mutateDeleteOneTime({ id: expId }).then(function () {
            return mutateDeleteHistory({ id: expId });
          }).then(function () { onSaved && onSaved(); });
        }
      });
    } else if (expType === 'recurring') {
      var newRecurring = { id: generateId(), user_id: userId, name: expName.trim(), amount: amt, due_date: dueDate, status: 'Pending', category: selectedFund, account_id: selectedAccount };
      var recurringId = newRecurring.id;
      var recurringPromise = mutateRecurring(newRecurring).then(function () {
        return scheduleBillNotification(newRecurring);
      });
      finishSave(recurringPromise, {
        message: 'Bill saved!',
        undoMessage: 'Bill saved',
        undo: function () {
          return mutateDeleteRecurring({ id: recurringId }).then(function () { onSaved && onSaved(); });
        }
      });
    } else if (expType === 'income') {
      var expId = generateId();
      finishSave(
        mutateHistory({ id: expId, user_id: userId, expense_name: expName.trim(), amount: amt, expense_type: 'Income', date: expDate, status: 'Received', notes: timeStr + ' • Source: ' + fundName + ' • To: ' + accName, category: selectedFund, account_id: selectedAccount }),
        {
          message: 'Income saved!',
          undoMessage: 'Income logged',
          undo: function () {
            return mutateDeleteHistory({ id: expId }).then(function () { onSaved && onSaved(); });
          }
        }
      );
    }
  };

  var saveMessage = expType === 'recurring' ? 'Bill saved!' : (expType === 'one_time' ? 'Spend saved!' : (expType === 'transfer' ? 'Money moved!' : 'Saved!'));

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)', position: 'relative' }}>
        <SaveSuccessOverlay visible={showSaveSuccess} theme={theme} message={saveMessage} />
        <View style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingHorizontal: 24,
          paddingTop: 10,
          paddingBottom: insetsBottom + 24,
          maxHeight: '92%',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          elevation: 20
        }}>
          {/* Bottom Sheet Handle */}
          <View style={{ width: 40, height: 5, backgroundColor: theme.colors.border, borderRadius: 3, alignSelf: 'center', marginBottom: 15, opacity: 0.8 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.colors.textPrimary }}>{typeHelp.modalTitle}</Text>
              <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 3 }}>Tap a tab below to switch type</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
              <MaterialIcons name="close" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', backgroundColor: theme.colors.background, borderRadius: 12, padding: 4, marginBottom: 12 }}>
              <TouchableOpacity
                onPress={() => { triggerImpactHaptic('Light'); if (rawEnvelopes.length > 0) setExpType('one_time'); }}
                disabled={rawEnvelopes.length === 0}
                style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 10, alignItems: 'center', backgroundColor: expType === 'one_time' ? theme.colors.primary : 'transparent', opacity: rawEnvelopes.length === 0 ? 0.45 : 1 }}
              >
                <MaterialIcons name="shopping-cart" size={16} color={expType === 'one_time' ? '#FFFFFF' : theme.colors.textSecondary} style={{ marginBottom: 2 }} />
                <Text style={{ color: expType === 'one_time' ? '#FFFFFF' : theme.colors.textSecondary, fontWeight: '700', fontSize: 11 }}>{EXPENSE_TYPE_HELP.one_time.tabLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { triggerImpactHaptic('Light'); if (rawEnvelopes.length > 0) setExpType('recurring'); }}
                disabled={rawEnvelopes.length === 0}
                style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 10, alignItems: 'center', backgroundColor: expType === 'recurring' ? theme.colors.primary : 'transparent', opacity: rawEnvelopes.length === 0 ? 0.45 : 1 }}
              >
                <MaterialIcons name="event-repeat" size={16} color={expType === 'recurring' ? '#FFFFFF' : theme.colors.textSecondary} style={{ marginBottom: 2 }} />
                <Text style={{ color: expType === 'recurring' ? '#FFFFFF' : theme.colors.textSecondary, fontWeight: '700', fontSize: 11 }}>{EXPENSE_TYPE_HELP.recurring.tabLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { triggerImpactHaptic('Light'); setExpType('transfer'); }}
                style={{ flex: 1, paddingVertical: 10, paddingHorizontal: 4, borderRadius: 10, alignItems: 'center', backgroundColor: expType === 'transfer' ? theme.colors.primary : 'transparent' }}
              >
                <MaterialIcons name="swap-horiz" size={16} color={expType === 'transfer' ? '#FFFFFF' : theme.colors.textSecondary} style={{ marginBottom: 2 }} />
                <Text style={{ color: expType === 'transfer' ? '#FFFFFF' : theme.colors.textSecondary, fontWeight: '700', fontSize: 11 }}>{EXPENSE_TYPE_HELP.transfer.tabLabel}</Text>
              </TouchableOpacity>
            </View>

            {rawEnvelopes.length === 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.25)' }}>
                <MaterialIcons name="info-outline" size={18} color="#3B82F6" style={{ marginRight: 8, marginTop: 1 }} />
                <Text style={{ flex: 1, fontSize: 12, color: theme.colors.textSecondary, lineHeight: 18 }}>
                  Create an envelope on the Dashboard to use Spend or Bill. You can still use <Text style={{ fontWeight: '700', color: theme.colors.textPrimary }}>Wallets</Text> to move money between accounts.
                </Text>
              </View>
            ) : null}

            <View style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: theme.colors.background, borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: theme.colors.border }}>
              <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.primary + '18', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <MaterialIcons name={typeHelp.icon} size={20} color={theme.colors.primary} />
              </View>
              <Text style={{ flex: 1, fontSize: 13, color: theme.colors.textSecondary, lineHeight: 20 }}>{typeHelp.hint}</Text>
            </View>

            {spendBlocked ? (
              <View style={{ alignItems: 'center', paddingVertical: 20, paddingHorizontal: 8, marginBottom: 8 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary + '18', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <MaterialIcons name="folder-special" size={28} color={theme.colors.primary} />
                </View>
                <Text style={{ fontSize: 17, fontWeight: 'bold', color: theme.colors.textPrimary, textAlign: 'center', marginBottom: 8 }}>
                  Create an envelope first
                </Text>
                <Text style={{ fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 16 }}>
                  Spending and bills need a budget envelope. Close this, tap + on an envelope row, or switch to the <Text style={{ fontWeight: '700' }}>Wallets</Text> tab to move money only.
                </Text>
                <TouchableOpacity onPress={() => setExpType('transfer')} style={{ backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 12, paddingHorizontal: 20, marginBottom: 10 }}>
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' }}>Use wallet transfer instead</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={onClose}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 14, fontWeight: '600' }}>Close</Text>
                </TouchableOpacity>
              </View>
            ) : (
            <>
            {transferNeedsWallets ? (
              <View style={{ backgroundColor: '#FEF3C7', borderRadius: 10, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: '#FCD34D' }}>
                <Text style={{ fontSize: 13, color: '#92400E', lineHeight: 20 }}>
                  Add at least two wallets on the Dashboard (e.g. Bank and GCash) before moving money between them.
                </Text>
              </View>
            ) : null}

            {errorMsg ? (
              <View style={{ backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10, marginBottom: 14 }}>
                <Text style={{ color: theme.colors.error, fontSize: 13 }}>{errorMsg}</Text>
              </View>
            ) : null}

            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 6 }}>
              {typeHelp.nameLabel.toUpperCase()}
            </Text>
            <TextInput value={expName} onChangeText={setExpName} placeholder={typeHelp.namePlaceholder} autoCapitalize="words" style={{ backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 14, fontSize: 15, color: theme.colors.textPrimary, marginBottom: expType === 'one_time' ? 12 : 16 }} />

            {expType === 'one_time' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 16 }}>
                <TouchableOpacity onPress={() => { setExpName('Morning Coffee'); setExpAmount('150'); }} style={{ backgroundColor: 'rgba(77, 150, 255, 0.15)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginRight: 8, borderWidth: 1, borderColor: 'rgba(77, 150, 255, 0.3)' }}>
                  <Text style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 13 }}>☕ Coffee ₱150</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setExpName('Lunch'); setExpAmount('300'); }} style={{ backgroundColor: 'rgba(77, 150, 255, 0.15)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginRight: 8, borderWidth: 1, borderColor: 'rgba(77, 150, 255, 0.3)' }}>
                  <Text style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 13 }}>🍔 Lunch ₱300</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setExpName('Transport'); setExpAmount('100'); }} style={{ backgroundColor: 'rgba(77, 150, 255, 0.15)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginRight: 8, borderWidth: 1, borderColor: 'rgba(77, 150, 255, 0.3)' }}>
                  <Text style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 13 }}>🚕 Transport ₱100</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => { setExpName('Groceries'); setExpAmount('1000'); }} style={{ backgroundColor: 'rgba(77, 150, 255, 0.15)', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, marginRight: 8, borderWidth: 1, borderColor: 'rgba(77, 150, 255, 0.3)' }}>
                  <Text style={{ color: theme.colors.primary, fontWeight: '600', fontSize: 13 }}>🛒 Groceries ₱1k</Text>
                </TouchableOpacity>
              </ScrollView>
            )}

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary }}>AMOUNT</Text>
              <Text style={{ fontSize: 11, color: theme.colors.primary }}>You can do math (e.g. 150+45)</Text>
            </View>
            <AmountInput
              value={expAmount}
              onChangeText={setExpAmount}
              theme={theme}
              variant="boxed"
              allowExpression={true}
              fontSize={18}
              containerStyle={{ marginBottom: 16 }}
              placeholder="0.00"
            />

            {(expType === 'one_time' || expType === 'income' || expType === 'transfer') ? (
              <View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 6 }}>DATE</Text>
                <DatePickerInput value={expDate} onChange={setExpDate} placeholder="Select date" />
              </View>
            ) : (
              <View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 6 }}>DUE DATE</Text>
                <DatePickerInput value={dueDate} onChange={setDueDate} placeholder="Select due date" />
              </View>
            )}

            {expType !== 'transfer' && (
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 4 }}>{expType === 'income' ? 'Income source' : 'Which envelope pays for this?'}</Text>
                {expType !== 'income' ? (
                  <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 8, lineHeight: 16 }}>This is your budget category — not your bank wallet.</Text>
                ) : null}
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  {optionsList.map(opt => {
                    var isSelected = selectedFund === opt.id;
                    var availStr = expType !== 'income' ? ` (Avail: ${opt.available})` : '';
                    var previewAmt = parseAmount(expAmount);
                    if (expAmount && /[+\-*/]/.test(expAmount)) {
                      var ev = evaluateAmountExpression(expAmount);
                      if (!isNaN(ev)) previewAmt = ev;
                    }
                    var isExceeded = expType !== 'income' && opt.available < previewAmt;
                    return (
                      <TouchableOpacity key={opt.id} onPress={() => setSelectedFund(opt.id)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: isSelected ? theme.colors.primary : (isExceeded ? theme.colors.error : theme.colors.border), backgroundColor: isSelected ? '#FFEDD5' : (isExceeded ? '#FEF2F2' : theme.colors.inputBg), alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: isSelected ? theme.colors.primary : (isExceeded ? theme.colors.error : theme.colors.textPrimary) }}>{opt.name}{availStr}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {expType === 'transfer' ? (
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 4 }}>Move from</Text>
                <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 8 }}>Wallet you are taking money out of</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {accounts.map(acc => {
                    var isSelected = selectedAccount === acc.id;
                    var styleInfo = WALLET_STYLES[acc.type] || WALLET_STYLES.Custom;
                    var brandColor = acc.color || styleInfo.color;
                    return (
                      <TouchableOpacity key={acc.id} onPress={() => setSelectedAccount(acc.id)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: isSelected ? theme.colors.primary : theme.colors.border, backgroundColor: isSelected ? '#FFEDD5' : theme.colors.inputBg }}>
                        <BrandLogo type={acc.type} size={14} style={{ marginRight: 6 }} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: isSelected ? theme.colors.primary : brandColor }}>{acc.name} (₱{acc.balance})</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 4 }}>Move to</Text>
                <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 8 }}>Wallet receiving the money</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  {accounts.map(acc => {
                    var isSelected = destAccount === acc.id;
                    var styleInfo = WALLET_STYLES[acc.type] || WALLET_STYLES.Custom;
                    var brandColor = acc.color || styleInfo.color;
                    return (
                      <TouchableOpacity key={acc.id} onPress={() => setDestAccount(acc.id)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: isSelected ? theme.colors.primary : theme.colors.border, backgroundColor: isSelected ? '#FFEDD5' : theme.colors.inputBg }}>
                        <BrandLogo type={acc.type} size={14} style={{ marginRight: 6 }} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: isSelected ? theme.colors.primary : brandColor }}>{acc.name} (₱{acc.balance})</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : (
              accounts.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 4 }}>
                    {expType === 'income' ? 'Deposit to wallet' : 'Paid with (wallet)'}
                  </Text>
                  {expType !== 'income' ? (
                    <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 8, lineHeight: 16 }}>The actual account you used — GCash, bank, cash, etc.</Text>
                  ) : null}
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    {accounts.map(acc => {
                      var isSelected = selectedAccount === acc.id;
                      var styleInfo = WALLET_STYLES[acc.type] || WALLET_STYLES.Custom;
                      var brandColor = acc.color || styleInfo.color;
                      return (
                        <TouchableOpacity key={acc.id} onPress={() => setSelectedAccount(acc.id)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: isSelected ? theme.colors.primary : theme.colors.border, backgroundColor: isSelected ? '#FFEDD5' : theme.colors.inputBg }}>
                          <BrandLogo type={acc.type} size={14} style={{ marginRight: 6 }} />
                          <Text style={{ fontSize: 13, fontWeight: '600', color: isSelected ? theme.colors.primary : brandColor }}>{acc.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              )
            )}

            <TouchableOpacity
              onPress={function () { triggerImpactHaptic('Medium'); handleSave(); }}
              disabled={transferNeedsWallets}
              style={{ backgroundColor: theme.colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24, opacity: transferNeedsWallets ? 0.5 : 1 }}
            >
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>
                {typeHelp.saveLabel}
              </Text>
            </TouchableOpacity>
            </>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default AddExpenseModal;

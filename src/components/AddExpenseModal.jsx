import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, ScrollView, Alert, Platform, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery, useMutation } from 'platform-hooks';
import { generateId, getTodayStr, getCurrentMonthStr, getMonthStr, parseAmount } from '../utils/helpers';
import { evaluateAmountExpression } from '../utils/amountFormat';
import DatePickerInput from './DatePickerInput';
import AmountInput from './AmountInput';
import SaveSuccessOverlay from './SaveSuccessOverlay';
import { scheduleBillNotification } from '../utils/notifications';
import { runSaveWithFeedback } from '../utils/saveSuccess';
import { triggerImpactHaptic, triggerErrorHaptic } from '../utils/feedback';
import {
  parseUserEnvelopes,
  expenseTypeRequiresEnvelope,
  validateEnvelopeForSpend,
  computeEnvelopeBalances,
  validateSpendOperation
} from '../utils/envelopeGuards';
import BrandLogo from './BrandLogo';
import { getEnvelopeIcon } from '../screens/dashboard/envelopeUtils';

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
  Landbank: { color: '#4CAF50', name: 'Landbank', logo: 'account-balance' },
  Vybe: { color: '#7C3AED', name: 'Vybe', logo: 'account-balance-wallet' },
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
  var insetsBottom = props.insetsBottom;
  var initialExpType = props.initialExpType || 'one_time';

  var [expType, setExpType] = useState(initialExpType);
  var [expName, setExpName] = useState('');
  var [expAmount, setExpAmount] = useState('');
  var [expDate, setExpDate] = useState(getTodayStr());
  var [dueDate, setDueDate] = useState(getTodayStr());
  var [errorMsg, setErrorMsg] = useState('');
  var [selectedFund, setSelectedFund] = useState('');
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);
  var [isSaving, setIsSaving] = useState(false);
  var [showHint, setShowHint] = useState(true);

  var insertRecurring = useMutation('recurring_expenses', 'insert');
  var mutateRecurring = insertRecurring.mutate;
  var insertHistory = useMutation('expense_history', 'insert');
  var mutateHistory = insertHistory.mutate;
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

  var historyQuery = useQuery('expense_history');
  var userHistory = (historyQuery.data || []).filter(function (h) { return h.user_id === userId; });

  var accounts = props.accounts || [];

  var rawEnvelopes = useMemo(function () {
    return parseUserEnvelopes(userSettings);
  }, [userSettings]);

  var spendBlocked = rawEnvelopes.length === 0;
  var typeHelp = getExpenseHelp(expType);

  var curMonth = getCurrentMonthStr();

  var envelopes = useMemo(function () {
    return computeEnvelopeBalances(rawEnvelopes, userHistory, recurringExpenses, curMonth);
  }, [rawEnvelopes, userHistory, recurringExpenses, curMonth]);

  var optionsList = envelopes;
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
      if (startType === 'income' || startType === 'transfer') startType = 'one_time';
      setExpType(startType);
      setErrorMsg('');
      setExpName('');
      setExpAmount('');
      setExpDate(getTodayStr());
      setDueDate(getTodayStr());
    }
  }, [visible, initialExpType]);

  useEffect(function () {
    if (!visible) return;
    if (accounts && accounts.length > 0) {
      if (!selectedAccount || selectedAccount === 'unlinked') {
        setSelectedAccount(accounts[0].id);
      }
    } else {
      setSelectedAccount('unlinked');
    }
  }, [visible, accounts, selectedAccount]);

  var finishSave = function (savePromise, feedbackOpts) {
    feedbackOpts = feedbackOpts || {};
    setIsSaving(true);
    runSaveWithFeedback(savePromise, {
      onClose: onClose,
      onSaved: onSaved,
      setShowSuccess: setShowSaveSuccess,
      message: feedbackOpts.message,
      undoMessage: feedbackOpts.undoMessage,
      undo: feedbackOpts.undo,
      errorMessage: 'Failed to save. Please try again.',
      onError: function () {
        setErrorMsg('Failed to save. Try again.');
        setIsSaving(false);
      }
    }).then(function () {
      setExpName('');
      setExpAmount('');
      setExpDate(getTodayStr());
      setDueDate(getTodayStr());
      setSelectedAccount('');
      setIsSaving(false);
    });
  };

  var handleSave = function () {
    if (isSaving) return;
    if (!expName.trim()) {
      triggerErrorHaptic();
      setErrorMsg(expType === 'recurring' ? 'Please enter a bill name.' : 'Please enter description.');
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

    if (!selectedAccount || selectedAccount === 'unlinked') {
      setErrorMsg('Please select a wallet.');
      return;
    }

    var selectedItem = optionsList.find(o => o.id === selectedFund);
    var fundName = selectedItem ? selectedItem.name : 'Unknown';

    if (expType === 'one_time' || expType === 'recurring') {
      var spendCheck = validateSpendOperation({
        amount: amt,
        categoryId: selectedFund,
        envelopeBalances: envelopes,
        accountId: expType === 'one_time' ? selectedAccount : null,
        accounts: accounts,
        isRecurringPayment: false
      });
      if (!spendCheck.ok) {
        setErrorMsg(spendCheck.message);
        return;
      }
    }

    var selectedAcc = accounts.find(a => a.id === selectedAccount);
    var accName = selectedAcc ? selectedAcc.name : 'Wallet';
    var timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (expType === 'one_time') {
      var expId = generateId();
      var savePromise = mutateHistory({
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
      finishSave(savePromise, {
        message: 'Expense saved!',
        undoMessage: 'Expense saved',
        undo: function () {
          return mutateDeleteHistory({ id: expId }).then(function () { onSaved && onSaved(); });
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
    }
  };

  var saveMessage = expType === 'recurring' ? 'Bill saved!' : 'Spend saved!';

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
          <View style={{ width: 40, height: 5, backgroundColor: theme.colors.border, borderRadius: 3, alignSelf: 'center', marginBottom: 15, opacity: 0.8 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontSize: 22, fontWeight: '900', color: theme.colors.textPrimary, letterSpacing: -0.5 }}>{typeHelp.modalTitle}</Text>
              <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginTop: 2, fontWeight: '500' }}>Record financial activity</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }} style={{ backgroundColor: theme.colors.background, padding: 8, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border }}>
              <MaterialIcons name="close" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', backgroundColor: theme.isDark ? 'rgba(0,0,0,0.2)' : theme.colors.background, borderRadius: 16, padding: 6, marginBottom: 20, borderWidth: 1, borderColor: theme.colors.border }}>
              <TouchableOpacity
                onPress={() => { triggerImpactHaptic('Light'); if (rawEnvelopes.length > 0) setExpType('one_time'); }}
                disabled={rawEnvelopes.length === 0}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: expType === 'one_time' ? theme.colors.primary : 'transparent',
                  opacity: rawEnvelopes.length === 0 ? 0.45 : 1,
                  shadowColor: expType === 'one_time' ? theme.colors.primary : 'transparent',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: expType === 'one_time' ? 3 : 0
                }}
              >
                <MaterialIcons name="shopping-cart" size={18} color={expType === 'one_time' ? '#FFFFFF' : theme.colors.textSecondary} style={{ marginRight: 8 }} />
                <Text style={{ color: expType === 'one_time' ? '#FFFFFF' : theme.colors.textSecondary, fontWeight: 'bold', fontSize: 14 }}>{EXPENSE_TYPE_HELP.one_time.tabLabel}</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={() => { triggerImpactHaptic('Light'); if (rawEnvelopes.length > 0) setExpType('recurring'); }}
                disabled={rawEnvelopes.length === 0}
                style={{
                  flex: 1,
                  flexDirection: 'row',
                  paddingVertical: 12,
                  borderRadius: 12,
                  alignItems: 'center',
                  justifyContent: 'center',
                  backgroundColor: expType === 'recurring' ? theme.colors.primary : 'transparent',
                  opacity: rawEnvelopes.length === 0 ? 0.45 : 1,
                  shadowColor: expType === 'recurring' ? theme.colors.primary : 'transparent',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 4,
                  elevation: expType === 'recurring' ? 3 : 0
                }}
              >
                <MaterialIcons name="event-repeat" size={18} color={expType === 'recurring' ? '#FFFFFF' : theme.colors.textSecondary} style={{ marginRight: 8 }} />
                <Text style={{ color: expType === 'recurring' ? '#FFFFFF' : theme.colors.textSecondary, fontWeight: 'bold', fontSize: 14 }}>{EXPENSE_TYPE_HELP.recurring.tabLabel}</Text>
              </TouchableOpacity>
            </View>

            {rawEnvelopes.length === 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.25)' }}>
                <MaterialIcons name="info-outline" size={18} color="#3B82F6" style={{ marginRight: 8, marginTop: 1 }} />
                <Text style={{ flex: 1, fontSize: 12, color: theme.colors.textSecondary, lineHeight: 18 }}>
                  Create an envelope on the Dashboard to use Spend or Bill.
                </Text>
              </View>
            ) : null}

            {showHint && (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: theme.isDark ? 'rgba(59, 130, 246, 0.05)' : theme.colors.background, borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: theme.colors.border }}>
                <View style={{ width: 36, height: 36, borderRadius: 18, backgroundColor: theme.colors.primary + '18', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                  <MaterialIcons name={typeHelp.icon} size={20} color={theme.colors.primary} />
                </View>
                <Text style={{ flex: 1, fontSize: 13, color: theme.colors.textSecondary, lineHeight: 20, paddingRight: 8 }}>{typeHelp.hint}</Text>
                <TouchableOpacity onPress={() => { triggerImpactHaptic('Light'); setShowHint(false); }} style={{ padding: 4 }}>
                  <MaterialIcons name="close" size={16} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
            )}

            {spendBlocked ? (
              <View style={{ alignItems: 'center', paddingVertical: 20, paddingHorizontal: 8, marginBottom: 8 }}>
                <View style={{ width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary + '18', alignItems: 'center', justifyContent: 'center', marginBottom: 14 }}>
                  <MaterialIcons name="folder-special" size={28} color={theme.colors.primary} />
                </View>
                <Text style={{ fontSize: 17, fontWeight: 'bold', color: theme.colors.textPrimary, textAlign: 'center', marginBottom: 8 }}>
                  Create an envelope first
                </Text>
                <Text style={{ fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 22, marginBottom: 16 }}>
                  Spending and bills need a budget envelope. Close this and tap + on an envelope row.
                </Text>
                <TouchableOpacity onPress={onClose}>
                  <Text style={{ color: theme.colors.textSecondary, fontSize: 14, fontWeight: '600' }}>Close</Text>
                </TouchableOpacity>
              </View>
            ) : (
            <>
            {errorMsg ? (
              <View style={{ backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10, marginBottom: 14 }}>
                <Text style={{ color: theme.colors.error, fontSize: 13 }}>{errorMsg}</Text>
              </View>
            ) : null}

            <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 8, letterSpacing: 0.5 }}>
              {typeHelp.nameLabel.toUpperCase()}
            </Text>
            <TextInput value={expName} onChangeText={setExpName} placeholder={typeHelp.namePlaceholder} autoCapitalize="words" style={{ backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 16, fontSize: 16, color: theme.colors.textPrimary, marginBottom: 20 }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 0.5 }}>AMOUNT</Text>
              <Text style={{ fontSize: 11, color: theme.colors.primary, fontWeight: '600' }}>Supports math (e.g. 150+45)</Text>
            </View>
            <AmountInput
              value={expAmount}
              onChangeText={setExpAmount}
              theme={theme}
              variant="boxed"
              allowExpression={true}
              fontSize={20}
              containerStyle={{ marginBottom: 20 }}
              placeholder="0.00"
            />

            {expType === 'one_time' ? (
              <View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 8, letterSpacing: 0.5 }}>DATE</Text>
                <DatePickerInput value={expDate} onChange={setExpDate} placeholder="Select date" />
              </View>
            ) : (
              <View>
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 8, letterSpacing: 0.5 }}>DUE DATE</Text>
                <DatePickerInput value={dueDate} onChange={setDueDate} placeholder="Select due date" />
              </View>
            )}

            <View style={{ marginTop: 16 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 0.5 }}>WHICH ENVELOPE PAYS FOR THIS?</Text>
                {rawEnvelopes.length > 3 && <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>Scroll →</Text>}
              </View>

              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }} contentContainerStyle={{ paddingRight: 20 }}>
                {optionsList.map(opt => {
                  var isSelected = selectedFund === opt.id;
                  var previewAmt = parseAmount(expAmount);
                  if (expAmount && /[+\-*/]/.test(expAmount)) {
                    var ev = evaluateAmountExpression(expAmount);
                    if (!isNaN(ev)) previewAmt = ev;
                  }
                  var isExceeded = opt.available < previewAmt;
                  var icon = getEnvelopeIcon(opt.name);

                  return (
                    <TouchableOpacity
                      key={opt.id}
                      onPress={() => { triggerImpactHaptic('Light'); setSelectedFund(opt.id); }}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 12,
                        borderRadius: 16,
                        borderWidth: 2,
                        borderColor: isSelected ? theme.colors.primary : (isExceeded ? theme.colors.error : theme.colors.border),
                        backgroundColor: isSelected ? (theme.isDark ? theme.colors.primary + '25' : '#FFEDD5') : (isExceeded ? (theme.isDark ? 'rgba(239,68,68,0.1)' : '#FEF2F2') : theme.colors.background),
                        alignItems: 'center',
                        marginRight: 10,
                        flexDirection: 'row',
                        minWidth: 140,
                        shadowColor: isSelected ? theme.colors.primary : '#000',
                        shadowOffset: { width: 0, height: 2 },
                        shadowOpacity: isSelected ? 0.2 : 0.05,
                        shadowRadius: 4,
                        elevation: isSelected ? 3 : 1
                      }}
                    >
                      <View style={{
                        width: 32,
                        height: 32,
                        borderRadius: 16,
                        backgroundColor: isSelected ? theme.colors.primary : (isExceeded ? theme.colors.error : theme.colors.border + '40'),
                        alignItems: 'center',
                        justifyContent: 'center',
                        marginRight: 10
                      }}>
                        <MaterialIcons name={icon} size={18} color={isSelected ? '#FFFFFF' : (isExceeded ? '#FFFFFF' : theme.colors.textSecondary)} />
                      </View>
                      <View>
                        <Text style={{ fontSize: 13, fontWeight: 'bold', color: isExceeded ? theme.colors.error : (isSelected ? theme.colors.primary : theme.colors.textPrimary) }} numberOfLines={1}>
                          {opt.name}
                        </Text>
                        <Text style={{ fontSize: 11, color: isExceeded ? theme.colors.error : (isSelected ? theme.colors.primary : theme.colors.textSecondary), fontWeight: '700', marginTop: 1 }}>
                          ₱{opt.available.toLocaleString()}
                        </Text>
                      </View>
                      {isExceeded && (
                        <MaterialIcons name="warning" size={16} color={theme.colors.error} style={{ marginLeft: 8 }} />
                      )}
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>

            {accounts.length > 0 && (
              <View style={{ marginTop: 20 }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <Text style={{ fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 0.5 }}>PAID WITH (WALLET)</Text>
                  {accounts.length > 2 && <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>Scroll →</Text>}
                </View>

                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 4 }} contentContainerStyle={{ paddingRight: 20 }}>
                  {accounts.map(acc => {
                    var isSelected = selectedAccount === acc.id;
                    var styleInfo = WALLET_STYLES[acc.type] || WALLET_STYLES.Custom;
                    var brandColor = acc.color || styleInfo.color;
                    var displayColor = brandColor;
                    if (theme.isDark && (brandColor === '#111827' || brandColor === '#1E3A8A' || brandColor === '#002E6E')) {
                      displayColor = theme.colors.textPrimary;
                    }

                    return (
                      <TouchableOpacity
                        key={acc.id}
                        onPress={() => { triggerImpactHaptic('Light'); setSelectedAccount(acc.id); }}
                        style={{
                          flexDirection: 'row',
                          alignItems: 'center',
                          paddingHorizontal: 16,
                          paddingVertical: 12,
                          borderRadius: 16,
                          borderWidth: 2,
                          borderColor: isSelected ? theme.colors.primary : theme.colors.border,
                          backgroundColor: isSelected ? (theme.isDark ? theme.colors.primary + '25' : '#FFEDD5') : theme.colors.background,
                          marginRight: 10,
                          minWidth: 150,
                          shadowColor: isSelected ? theme.colors.primary : '#000',
                          shadowOffset: { width: 0, height: 2 },
                          shadowOpacity: isSelected ? 0.2 : 0.05,
                          shadowRadius: 4,
                          elevation: isSelected ? 3 : 1
                        }}
                      >
                        <View style={{ marginRight: 10 }}>
                          <BrandLogo type={acc.type} size={24} />
                        </View>
                        <View>
                          <Text style={{ fontSize: 13, fontWeight: 'bold', color: isSelected ? theme.colors.primary : displayColor }} numberOfLines={1}>
                            {acc.name}
                          </Text>
                          <Text style={{ fontSize: 11, color: theme.colors.textSecondary, fontWeight: '600', marginTop: 1 }}>
                            ₱{acc.balance.toLocaleString()}
                          </Text>
                        </View>
                        {isSelected && (
                          <MaterialIcons name="check-circle" size={14} color={theme.colors.primary} style={{ marginLeft: 6 }} />
                        )}
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>
              </View>
            )}

            <TouchableOpacity
              onPress={function () { triggerImpactHaptic('Medium'); handleSave(); }}
              disabled={isSaving}
              style={{ backgroundColor: theme.colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24, opacity: isSaving ? 0.5 : 1 }}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>
                  {typeHelp.saveLabel}
                </Text>
              )}
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

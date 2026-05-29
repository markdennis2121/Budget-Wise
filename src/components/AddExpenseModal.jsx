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

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.colors.textPrimary }}>{typeHelp.modalTitle}</Text>
              <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 3 }}>Record financial activity</Text>
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
            </View>

            {rawEnvelopes.length === 0 ? (
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', backgroundColor: 'rgba(59, 130, 246, 0.1)', borderRadius: 10, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.25)' }}>
                <MaterialIcons name="info-outline" size={18} color="#3B82F6" style={{ marginRight: 8, marginTop: 1 }} />
                <Text style={{ flex: 1, fontSize: 12, color: theme.colors.textSecondary, lineHeight: 18 }}>
                  Create an envelope on the Dashboard to use Spend or Bill.
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

            {expType === 'one_time' ? (
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

            <View style={{ marginTop: 16 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 4 }}>Which envelope pays for this?</Text>

              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                {optionsList.map(opt => {
                  var isSelected = selectedFund === opt.id;
                  var availStr = ` (Avail: ${opt.available})`;
                  var previewAmt = parseAmount(expAmount);
                  if (expAmount && /[+\-*/]/.test(expAmount)) {
                    var ev = evaluateAmountExpression(expAmount);
                    if (!isNaN(ev)) previewAmt = ev;
                  }
                  var isExceeded = opt.available < previewAmt;
                  return (
                    <TouchableOpacity key={opt.id} onPress={() => setSelectedFund(opt.id)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: isSelected ? theme.colors.primary : (isExceeded ? theme.colors.error : theme.colors.border), backgroundColor: isSelected ? '#FFEDD5' : (isExceeded ? '#FEF2F2' : theme.colors.inputBg), alignItems: 'center' }}>
                      <Text style={{ fontSize: 13, fontWeight: '600', color: isSelected ? theme.colors.primary : (isExceeded ? theme.colors.error : theme.colors.textPrimary) }}>{opt.name}{availStr}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>

            {accounts.length > 0 && (
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 4 }}>Paid with (wallet)</Text>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  {accounts.map(acc => {
                    var isSelected = selectedAccount === acc.id;
                    var styleInfo = WALLET_STYLES[acc.type] || WALLET_STYLES.Custom;
                    var brandColor = acc.color || styleInfo.color;

                    // Senior Developer Fix: Ensure contrast in Dark Mode
                    // If the brand color is too dark (like GoTyme #111827) and we are in dark mode,
                    // we use textPrimary so it's visible against the dark background.
                    var displayColor = brandColor;
                    if (theme.isDark) {
                      if (brandColor === '#111827' || brandColor === '#1E3A8A' || brandColor === '#002E6E') {
                        displayColor = theme.colors.textPrimary;
                      }
                    }

                    return (
                      <TouchableOpacity key={acc.id} onPress={() => setSelectedAccount(acc.id)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: isSelected ? theme.colors.primary : theme.colors.border, backgroundColor: isSelected ? (theme.isDark ? 'rgba(255,237,213,0.2)' : '#FFEDD5') : theme.colors.inputBg }}>
                        <BrandLogo type={acc.type} size={14} style={{ marginRight: 6 }} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: isSelected ? theme.colors.primary : displayColor }}>
                          {acc.name} (₱{acc.balance})
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
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

import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, TextInput, Modal, Alert, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'platform-hooks';
import { useTheme } from '../../contexts/ThemeContext';
import SaveSuccessOverlay from '../../components/SaveSuccessOverlay';
import AmountInput from '../../components/AmountInput';
import DatePickerInput from '../../components/DatePickerInput';
import BrandLogo from '../../components/BrandLogo';
import { runSaveWithFeedback } from '../../utils/saveSuccess';
import { deleteEnvelopeAndCleanup } from '../../utils/envelopeBudget';
import { promptDeleteEnvelope } from './envelopeUtils';
import { formatCurrency, formatDate, generateId, getTodayStr, getCurrentMonthStr, getMonthStr, isWithin5Days, isOverdue, parseAmount } from '../../utils/helpers';
import { formatAmountForEdit } from '../../utils/amountFormat';
import { WALLET_STYLES } from './constants';
import { getStoredAccountsList, serializeAccountsForStorage } from '../../utils/accountBalances';
import { getWalletIncomeHistoryForAccount, isManualWalletTopUp } from '../../utils/walletIncomeHistory';
import { parseUserEnvelopes, validateSpendOperation } from '../../utils/envelopeGuards';
import {
  computeBudgetCommitments,
  validateIncomeSourceAmountEdit,
  validateIncomeSourceDelete,
  validateIncomeTransactionEdit,
  validateIncomeTransactionDelete
} from '../../utils/incomeSourceGuards';

const AssignMoneyModal = function ({ visible, onClose, readyToAssign, totalIncome, envelopes, userSettings, mutateUpdateSettings, mutateUpdateRecurring, mutateDeleteRecurring, recurringExpenses, onSaved }) {
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var insets = useSafeAreaInsets();
  var [amounts, setAmounts] = useState({});
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);
  var [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setAmounts({});
      setShowSaveSuccess(false);
      setIsSaving(false);
    }
  }, [visible]);

  var handleAssign = () => {
    if (isSaving) return;
    // 1. Validate no negative final envelope assignments
    for (var i = 0; i < envelopes.length; i++) {
      var e = envelopes[i];
      var valStr = amounts[e.id];
      var addedAmt = valStr !== undefined && valStr !== '' && valStr !== '-' ? parseAmount(valStr) : 0;
      var finalAmt = (parseFloat(e.assigned) || 0) + addedAmt;
      if (finalAmt < 0) {
        var msg = `Cannot reduce "${e.name}" envelope below ₱0.00! Current assigned: ${formatCurrency(e.assigned)}`;
        triggerErrorHaptic();
        showUndoToast({ message: msg, type: 'error' });
        return;
      }
    }

    // 2. Validate no Ready to Assign overspending
    var totalInput = envelopes.reduce((s, env) => {
      var valStr = amounts[env.id];
      var val = valStr !== undefined && valStr !== '' && valStr !== '-' ? parseAmount(valStr) : 0;
      return s + val;
    }, 0);
    if (readyToAssign - totalInput < 0) {
      var overspendMsg = 'You cannot assign more money than you have available in Ready to Assign!';
      triggerErrorHaptic();
      showUndoToast({ message: overspendMsg, type: 'error' });
      return;
    }

    var newEnvelopes = envelopes.map(e => {
      var valStr = amounts[e.id];
      var addedAmt = valStr !== undefined && valStr !== '' && valStr !== '-' ? parseAmount(valStr) : 0;
      var finalAmt = (parseFloat(e.assigned) || 0) + addedAmt;
      return { id: e.id, name: e.name, assigned: finalAmt };
    });
    if (userSettings) {
      setIsSaving(true);
      runSaveWithFeedback(
        mutateUpdateSettings({ id: userSettings.id, data: { envelopes: newEnvelopes } }),
        {
          onClose: onClose,
          onSaved: onSaved,
          setShowSuccess: setShowSaveSuccess,
          message: 'Money assigned!',
          errorMessage: 'Could not save assignments. Please try again.',
          onError: () => setIsSaving(false)
        }
      ).then(() => setIsSaving(false));
    }
  };

  var handleDeleteEnvelope = (id) => {
    promptDeleteEnvelope({
      envelopeId: id,
      envelopes: envelopes,
      recurringExpenses: recurringExpenses,
      onPerformDelete: function () {
        if (!userSettings) return;
        runSaveWithFeedback(
          deleteEnvelopeAndCleanup({
            envelopeId: id,
            envelopes: envelopes,
            recurringExpenses: recurringExpenses,
            userSettings: userSettings,
            mutateUpdateSettings: mutateUpdateSettings,
            mutateUpdateRecurring: mutateUpdateRecurring,
            mutateDeleteRecurring: mutateDeleteRecurring
          }),
          {
            onSaved: onSaved,
            setShowSuccess: setShowSaveSuccess,
            message: 'Deleted!',
            errorMessage: 'Could not delete envelope. Please try again.'
          }
        );
      }
    });
  };

  var totalInput = envelopes.reduce((s, env) => {
    var valStr = amounts[env.id];
    var val = valStr !== undefined && valStr !== '' && valStr !== '-' ? parseAmount(valStr) : 0;
    return s + val;
  }, 0);
  var remaining = readyToAssign - totalInput;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingHorizontal: 24,
          paddingTop: 10,
          paddingBottom: insets.bottom + 24,
          maxHeight: '92%',
          position: 'relative',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          elevation: 20
        }}>
          {/* Handle */}
          <View style={{ width: 40, height: 5, backgroundColor: theme.colors.border, borderRadius: 3, alignSelf: 'center', marginBottom: 15, opacity: 0.8 }} />

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
                <AmountInput
                  value={amounts[env.id] || ''}
                  onChangeText={(val) => setAmounts(function (prev) { return { ...prev, [env.id]: val }; })}
                  theme={theme}
                  variant="compact"
                  allowNegative={true}
                  fontSize={15}
                  placeholder="0"
                  containerStyle={{ width: 120 }}
                />
              </View>
            ))}
          </ScrollView>



          <TouchableOpacity onPress={handleAssign} disabled={remaining < 0 || isSaving} style={{ backgroundColor: (remaining < 0 || isSaving) ? theme.colors.accent : theme.colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 }}>
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>Save Assignments</Text>
            )}
          </TouchableOpacity>
          <SaveSuccessOverlay visible={showSaveSuccess} theme={theme} message="Money assigned!" />
        </View>
      </View>
    </Modal>
  );
};

const AddEnvelopeModal = function ({ visible, onClose, envelopes, readyToAssign, userSettings, mutateUpdateSettings, onSaved, userId }) {
  var [name, setName] = useState('');
  var [assigned, setAssigned] = useState('');
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);
  var [isSaving, setIsSaving] = useState(false);
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var insertHistory = useMutation('expense_history', 'insert');
  var mutateInsertHistory = insertHistory.mutate;

  useEffect(() => {
    if (visible) {
      setName('');
      setAssigned('');
      setShowSaveSuccess(false);
      setIsSaving(false);
    }
  }, [visible]);

  var handleCreate = function () {
    if (isSaving || !name.trim()) return;
    if (envelopes.find(e => e.name.toLowerCase() === name.trim().toLowerCase())) {
      Platform.OS === 'web' ? window.alert('Envelope already exists!') : Alert.alert('Error', 'Envelope already exists!');
      return;
    }
    var assignedAmt = parseAmount(assigned);
    if (assignedAmt > readyToAssign) {
      Platform.OS === 'web' ? window.alert('Not enough Ready to Assign money!') : Alert.alert('Error', 'Not enough Ready to Assign money!');
      return;
    }

    var newId = 'env-' + generateId();
    var newEnv = { id: newId, name: name.trim(), assigned: assignedAmt };
    var newList = envelopes.concat(newEnv);
    if (userSettings) {
      setIsSaving(true);
      var savePromise = mutateUpdateSettings({ id: userSettings.id, data: { envelopes: newList } }).then(function () {
        if (assignedAmt > 0) {
          return mutateInsertHistory({
            id: generateId(),
            user_id: userId,
            expense_name: 'Initial Budget Added: ' + name.trim(),
            amount: assignedAmt,
            date: new Date().toISOString(),
            expense_type: 'Budget Assignment',
            category: newId,
            account_id: null,
            notes: '+' + formatCurrency(assignedAmt) + ' assigned upon creation'
          });
        }
        return Promise.resolve();
      });
      runSaveWithFeedback(savePromise, {
        onClose: onClose,
        onSaved: onSaved,
        setShowSuccess: setShowSaveSuccess,
        errorMessage: 'Could not create envelope. Please try again.',
        onError: () => setIsSaving(false)
      }).then(function () {
        setName('');
        setAssigned('');
        setIsSaving(false);
      });
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingHorizontal: 24,
          paddingTop: 10,
          paddingBottom: 40,
          position: 'relative',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          elevation: 20
        }}>
          {/* Handle */}
          <View style={{ width: 40, height: 5, backgroundColor: theme.colors.border, borderRadius: 3, alignSelf: 'center', marginBottom: 15, opacity: 0.8 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.textPrimary }}>Add Envelope</Text>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={24} color={theme.colors.textSecondary} /></TouchableOpacity>
          </View>

          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 }}>ENVELOPE NAME</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Travel, Gifts"
            style={{ backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 14, color: theme.colors.textPrimary, marginBottom: 16 }}
          />

          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 }}>ASSIGN INITIAL BUDGET (OPTIONAL)</Text>
          <AmountInput value={assigned} onChangeText={setAssigned} theme={theme} fontSize={22} containerStyle={{ marginBottom: 22 }} />

          <TouchableOpacity onPress={handleCreate} disabled={isSaving} style={{ backgroundColor: isSaving ? theme.colors.accent : theme.colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>Create Envelope</Text>
            )}
          </TouchableOpacity>
          <SaveSuccessOverlay visible={showSaveSuccess} theme={theme} message="Saved!" />
        </View>
      </View>
    </Modal>
  );
};

const SavingsManagerModal = function ({ visible, onClose, state, userSettings, mutateUpdateSettings, onSaved }) {
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var [amount, setAmount] = useState('');
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);
  var [successMessage, setSuccessMessage] = useState('Saved!');
  var [selectedSource, setSelectedSource] = useState('');
  var [isSaving, setIsSaving] = useState(false);

  var insertHistory = useMutation('expense_history', 'insert');
  var mutateInsertHistory = insertHistory.mutate;
  var deleteHistory = useMutation('expense_history', 'delete');
  var mutateDeleteHistory = deleteHistory.mutate;

  useEffect(() => {
    if (visible) {
      setAmount('');
      setShowSaveSuccess(false);
      setIsSaving(false);
      if (!selectedSource && (state.accounts || []).length > 0) setSelectedSource((state.accounts || [])[0].id);
    }
  }, [visible]);
  var storedSavingsRaw = userSettings && userSettings.savings ? userSettings.savings : [];
  try { if (typeof storedSavingsRaw === 'string') storedSavingsRaw = JSON.parse(storedSavingsRaw); } catch (e) { storedSavingsRaw = userSettings && userSettings.savings ? userSettings.savings : []; }
  var storedSavings = Array.isArray(storedSavingsRaw) ? storedSavingsRaw : [];
  var currentSavings = storedSavings.reduce(function(s, r){ return s + (parseFloat(r.amount) || 0); }, 0);
  var accountsList = state.accounts || getStoredAccountsList(userSettings);
  var selectedAccountObj = accountsList.find(function(a){ return a.id === selectedSource; });
  var selectedSourceBalance = selectedAccountObj ? parseFloat(selectedAccountObj.balance || 0) : 0;
  var parsedAmount = parseAmount(amount) || 0;
  var addExceedsSource = parsedAmount > selectedSourceBalance;

  var handleAdd = function () {
    var val = parseAmount(amount);
    if (val <= 0 || isSaving) return;
    if (userSettings) {
      setIsSaving(true);
      var historyId = generateId();
      var historyPromise = Promise.resolve();
      if (selectedSource) {
        var srcAcc = accountsList.find(function(a){ return a.id === selectedSource; });
        var historyEntry = {
          id: historyId,
          user_id: userSettings.user_id || userSettings.id,
          expense_name: 'Saved to Savings',
          amount: val,
          expense_type: 'Transfer',
          date: getTodayStr(),
          status: 'Saved',
          notes: 'Saved to Savings • From: ' + (srcAcc ? srcAcc.name : selectedSource),
          account_id: selectedSource,
          dest_account_id: 'savings'
        };
        historyPromise = mutateInsertHistory(historyEntry);
      }

      var newSavingsEntry = { id: generateId(), amount: val, source: selectedSource || null, date: getTodayStr() };
      var updatedSavings = storedSavings.concat(newSavingsEntry);
      var settingsPromise = mutateUpdateSettings({ id: userSettings.id, data: { savings: updatedSavings } });

      runSaveWithFeedback(
        Promise.all([settingsPromise, historyPromise]),
        {
          onClose: onClose,
          onSaved: onSaved,
          setShowSuccess: setShowSaveSuccess,
          setSuccessMessage: setSuccessMessage,
          message: 'Saved to Savings!',
          errorMessage: 'Could not add to savings. Please try again.',
          onError: () => setIsSaving(false),
          undo: function () {
            return Promise.resolve().then(function () {
              var p = Promise.resolve();
              if (selectedSource) p = mutateDeleteHistory({ id: historyId });
              return p;
            }).then(function () { if (onSaved) onSaved(); });
          }
        }
      ).then(function () { setAmount(''); setIsSaving(false); });
    }
  };

  var handleWithdraw = function () {
    var val = parseAmount(amount);
    if (val <= 0 || isSaving) return;
    if (val > currentSavings) {
      Platform.OS === 'web'
        ? window.alert('You cannot withdraw more than your current Savings!')
        : Alert.alert('Invalid Amount', 'You cannot withdraw more than your current Savings!');
      return;
    }

    // Consume savings entries FIFO
    var remaining = val;
    var updatedSavings = [];
    for (var i = 0; i < storedSavings.length; i++) {
      var s = storedSavings[i];
      var amt = parseFloat(s.amount) || 0;
      if (remaining <= 0) {
        updatedSavings.push(s);
        continue;
      }
      if (amt <= remaining) {
        remaining -= amt;
        // consumed entirely, skip adding back
        continue;
      }
      // partially consume
      updatedSavings.push({ ...s, amount: (amt - remaining) });
      remaining = 0;
    }

    if (userSettings) {
      setIsSaving(true);
      var historyId = generateId();
      var historyPromise = Promise.resolve();
      if (selectedSource) {
        var historyEntry = {
          id: historyId,
          user_id: userSettings.user_id || userSettings.id,
          expense_name: 'Withdrawn from Savings',
          amount: val,
          expense_type: 'Transfer',
          date: getTodayStr(),
          status: 'Received',
          notes: 'Withdrawn from Savings • To: ' + (selectedAccountObj ? selectedAccountObj.name : selectedSource),
          account_id: 'savings',
          dest_account_id: selectedSource
        };
        historyPromise = mutateInsertHistory(historyEntry);
      }

      var settingsPromise = mutateUpdateSettings({ id: userSettings.id, data: { savings: updatedSavings } });

      runSaveWithFeedback(
        Promise.all([settingsPromise, historyPromise]),
        {
          onClose: onClose,
          onSaved: onSaved,
          setShowSuccess: setShowSaveSuccess,
          setSuccessMessage: setSuccessMessage,
          message: 'Withdrawn!',
          errorMessage: 'Could not withdraw from savings. Please try again.',
          onError: () => setIsSaving(false)
        }
      ).then(function () { setAmount(''); setIsSaving(false); });
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingHorizontal: 24,
          paddingTop: 10,
          paddingBottom: 40,
          position: 'relative',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          elevation: 20
        }}>
          {/* Handle */}
          <View style={{ width: 40, height: 5, backgroundColor: theme.colors.border, borderRadius: 3, alignSelf: 'center', marginBottom: 15, opacity: 0.8 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.textPrimary }}>Manage Savings</Text>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={24} color={theme.colors.textSecondary} /></TouchableOpacity>
          </View>

          <View style={{ backgroundColor: '#DCFCE7', borderRadius: 12, padding: 16, alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 13, color: '#15803D', fontWeight: 'bold', marginBottom: 4 }}>Current Savings</Text>
            <Text style={{ fontSize: 28, fontWeight: 'bold', color: '#16A34A' }}>{formatCurrency(currentSavings)}</Text>
          </View>

          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 }}>AMOUNT</Text>
          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 }}>SOURCE</Text>
          <ScrollView horizontal={true} showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
            { (accountsList || []).map(function(a){
              return (
                React.createElement(TouchableOpacity, { key: a.id, onPress: function() { setSelectedSource(a.id); }, style: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, marginRight: 8, borderWidth: 1, borderColor: selectedSource === a.id ? theme.colors.primary : theme.colors.border, backgroundColor: selectedSource === a.id ? (theme.colors.primary + '22') : theme.colors.background } },
                  React.createElement(Text, { style: { color: selectedSource === a.id ? theme.colors.primary : theme.colors.textSecondary, fontWeight: '700' } }, a.name)
                )
              );
            }) }
          </ScrollView>

          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 }}>AMOUNT</Text>
          <AmountInput value={amount} onChangeText={setAmount} theme={theme} containerStyle={{ marginBottom: 8 }} />

          <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 6 }}>Saved from: { ((accountsList.find(a => a.id === selectedSource) || {}).name || selectedSource || '—') }</Text>
          <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 12 }}>Source balance: {formatCurrency(selectedSourceBalance)}</Text>

          { addExceedsSource ? (
            React.createElement(Text, { style: { color: theme.colors.error, marginBottom: 8 } }, 'Amount exceeds selected source balance.')
          ) : null }

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity disabled={parsedAmount <= 0 || addExceedsSource || isSaving} onPress={parsedAmount > 0 && !addExceedsSource ? handleAdd : undefined} style={{ flex: 1, backgroundColor: (parsedAmount > 0 && !addExceedsSource && !isSaving) ? '#16A34A' : '#94A3B8', borderRadius: 12, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, opacity: (parsedAmount > 0 && !addExceedsSource && !isSaving) ? 1 : 0.6 }}>
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <>
                  <MaterialIcons name="add" size={18} color="#FFFFFF" />
                  <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' }}>Add to Savings</Text>
                </>
              )}
            </TouchableOpacity>

            <TouchableOpacity disabled={isSaving} onPress={!isSaving ? handleWithdraw : undefined} style={{ flex: 1, backgroundColor: isSaving ? '#94A3B8' : '#EA580C', borderRadius: 12, paddingVertical: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center', gap: 6, opacity: isSaving ? 0.6 : 1 }}>
              <MaterialIcons name="remove" size={18} color="#FFFFFF" />
              <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' }}>Withdraw</Text>
            </TouchableOpacity>
          </View>
          <SaveSuccessOverlay visible={showSaveSuccess} theme={theme} message={successMessage} />
        </View>
      </View>
    </Modal>
  );
};

const NotificationCenterModal = function ({ visible, onClose, state, theme, insets }) {
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
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingHorizontal: 24,
          paddingTop: 10,
          paddingBottom: insets.bottom + 24,
          maxHeight: '92%',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          elevation: 20
        }}>
          {/* Handle */}
          <View style={{ width: 40, height: 5, backgroundColor: theme.colors.border, borderRadius: 3, alignSelf: 'center', marginBottom: 15, opacity: 0.8 }} />

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

              <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: 6 }} />

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary }}>Beta Testing Deadline</Text>
                  <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>Final feedback by August 1 deadline</Text>
                </View>
                <View style={{ backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                  <Text style={{ fontSize: 11, fontWeight: 'bold', color: '#B91C1C' }}>CRITICAL</Text>
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

const AddAccountModal = function ({ visible, onClose, accounts, userSettings, mutateUpdateSettings, onSaved, userId }) {
  var [name, setName] = useState('');
  var [type, setType] = useState('GCash');
  var [startingBalance, setStartingBalance] = useState('');
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);
  var [isSaving, setIsSaving] = useState(false);
  var themeCtx = useTheme();
  var theme = themeCtx.theme;

  var insertHistory = useMutation('expense_history', 'insert');
  var mutateInsertHistory = insertHistory.mutate;

  useEffect(() => {
    if (visible) {
      setName('GCash');
      setType('GCash');
      setStartingBalance('');
      setShowSaveSuccess(false);
      setIsSaving(false);
    }
  }, [visible]);

  var handleCreate = function () {
    if (isSaving) return;
    var finalName = type === 'Custom' ? name.trim() : (WALLET_STYLES[type]?.name || type);
    if (!finalName) {
      triggerErrorHaptic();
      showUndoToast({ message: 'Please enter an account name.', type: 'error' });
      return;
    }
    if (accounts.find(a => a.name.toLowerCase() === finalName.toLowerCase())) {
      triggerErrorHaptic();
      showUndoToast({ message: 'Account already exists!', type: 'error' });
      return;
    }
    var walletStyle = WALLET_STYLES[type] || WALLET_STYLES.Custom;
    var newId = 'acc-' + generateId();
    var amt = parseAmount(startingBalance);
    var newAcc = {
      id: newId,
      name: finalName,
      type: type,
      starting_balance: 0, // No longer using static seed
      color: walletStyle.color
    };
    var newList = getStoredAccountsList(userSettings).concat([newAcc]);
    if (userSettings) {
      setIsSaving(true);
      var savePromise = mutateUpdateSettings({ id: userSettings.id, data: { accounts: newList, accounts_customized: true } });
      if (amt > 0) {
        savePromise = savePromise.then(function () {
          return mutateInsertHistory({
            id: 'tx-' + generateId(),
            user_id: userId,
            expense_name: 'Opening Balance: ' + finalName,
            amount: amt,
            date: getTodayStr(),
            expense_type: 'Income',
            category: 'Income',
            account_id: newId,
            notes: 'Initial wallet balance'
          });
        });
      }
      runSaveWithFeedback(
        savePromise,
        { onClose: onClose, onSaved: onSaved, setShowSuccess: setShowSaveSuccess, errorMessage: 'Could not create wallet. Please try again.', onError: () => setIsSaving(false) }
      ).then(() => setIsSaving(false));
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingHorizontal: 24,
          paddingTop: 10,
          paddingBottom: 40,
          position: 'relative',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          elevation: 20
        }}>
          {/* Handle */}
          <View style={{ width: 40, height: 5, backgroundColor: theme.colors.border, borderRadius: 3, alignSelf: 'center', marginBottom: 15, opacity: 0.8 }} />

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

          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 4 }}>OPENING BALANCE</Text>
          <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 8 }}>How much money is currently inside this wallet?</Text>
          <AmountInput value={startingBalance} onChangeText={setStartingBalance} theme={theme} containerStyle={{ marginBottom: 20 }} />

          <TouchableOpacity disabled={isSaving} onPress={handleCreate} style={{ backgroundColor: isSaving ? theme.colors.accent : theme.colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>Create Wallet / Account</Text>
            )}
          </TouchableOpacity>
          <SaveSuccessOverlay visible={showSaveSuccess} theme={theme} message="Saved!" />
        </View>
      </View>
    </Modal>
  );
};

const EditAccountModal = function ({ visible, onClose, account, accounts, userSettings, envelopeBalances, mutateUpdateSettings, onSaved, userId, userHistory }) {
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var [name, setName] = useState('');
  var [mode, setMode] = useState('add'); // 'add' or 'reduce'
  var [amount, setAmount] = useState('');
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);
  var [successMessage, setSuccessMessage] = useState('Saved!');
  var [isSaving, setIsSaving] = useState(false);

  var insertHistory = useMutation('expense_history', 'insert');
  var mutateInsertHistory = insertHistory.mutate;
  var deleteHistory = useMutation('expense_history', 'delete');
  var mutateDeleteHistory = deleteHistory.mutate;

  useEffect(() => {
    if (visible && account) {
      setName(account.name);
      setMode('add');
      setAmount('');
      setShowSaveSuccess(false);
      setSuccessMessage('Saved!');
      setIsSaving(false);
    }
  }, [visible, account]);

  // Total money "promised" to envelopes (liabilities)
  var totalEnvelopeLiabilities = useMemo(function () {
    return (envelopeBalances || []).reduce(function (sum, env) {
      return sum + Math.max(0, parseFloat(env.available) || 0);
    }, 0);
  }, [envelopeBalances]);

  var handleSave = () => {
    if (isSaving || !name.trim()) return;

    var val = parseAmount(amount) || 0;
    var addVal = mode === 'add' ? val : 0;
    var redVal = mode === 'reduce' ? val : 0;

    var liveBal = parseFloat(account.balance) || 0;
    var previewBal = liveBal + addVal - redVal;

    var otherWalletsTotal = (accounts || []).filter(a => a.id !== account.id).reduce((s, a) => s + (parseFloat(a.balance) || 0), 0);
    var projectedTotalCash = otherWalletsTotal + previewBal;

    if (previewBal < 0) {
      var err = `Cannot save. Resulting balance would be negative (${formatCurrency(previewBal)}).`;
      Platform.OS === 'web' ? window.alert(err) : Alert.alert('Invalid Balance', err);
      return;
    }

    if (projectedTotalCash < totalEnvelopeLiabilities) {
      var deficit = totalEnvelopeLiabilities - projectedTotalCash;
      var err = `Budget Integrity Error: You need ${formatCurrency(totalEnvelopeLiabilities)} for your envelopes, but you will only have ${formatCurrency(projectedTotalCash)} cash left. Reduce your envelope budgets by ${formatCurrency(deficit)} first.`;
      Platform.OS === 'web' ? window.alert(err) : Alert.alert('Budget Integrity', err);
      return;
    }

    var newList = getStoredAccountsList(userSettings).map(function (a) {
      if (a.id === account.id) {
        return {
          id: a.id,
          name: name.trim(),
          starting_balance: a.starting_balance || 0,
          type: a.type || account.type || 'Custom',
          color: a.color || account.color || '#0F766E'
        };
      }
      return a;
    });

    if (userSettings) {
      setIsSaving(true);
      var savePromise = mutateUpdateSettings({ id: userSettings.id, data: { accounts: newList, accounts_customized: true } }).then(function () {
        var today = new Date().toISOString().split('T')[0];
        if (val <= 0) return Promise.resolve();

        if (mode === 'add') {
          return mutateInsertHistory({
            id: generateId(),
            user_id: userId,
            expense_name: 'Balance Correction (Add): ' + name.trim(),
            amount: val,
            date: today,
            expense_type: 'Adjustment',
            category: 'Income',
            account_id: account.id,
            notes: 'Manual balance adjustment'
          });
        } else {
          return mutateInsertHistory({
            id: generateId(),
            user_id: userId,
            expense_name: 'Balance Correction (Reduce): ' + name.trim(),
            amount: val,
            date: today,
            expense_type: 'Adjustment',
            category: 'Adjustment',
            account_id: account.id,
            notes: 'Manual balance adjustment'
          });
        }
      });

      runSaveWithFeedback(savePromise, {
        onClose: onClose,
        onSaved: onSaved,
        setShowSuccess: setShowSaveSuccess,
        setSuccessMessage: setSuccessMessage,
        message: 'Wallet updated!',
        errorMessage: 'Could not save changes.',
        onError: () => setIsSaving(false)
      }).then(() => setIsSaving(false));
    }
  };

  var handleDelete = () => {
    if (isSaving) return;
    var otherWalletsTotal = (accounts || []).filter(a => a.id !== account.id).reduce((s, a) => s + (parseFloat(a.balance) || 0), 0);

    if (otherWalletsTotal < totalEnvelopeLiabilities) {
      var deficit = totalEnvelopeLiabilities - otherWalletsTotal;
      var err = `Budget Integrity Error: You cannot delete "${account.name}" because your remaining wallets will only have ${formatCurrency(otherWalletsTotal)}, but your envelopes need ${formatCurrency(totalEnvelopeLiabilities)}. Please reduce your envelope budgets by ${formatCurrency(deficit)} first.`;
      Platform.OS === 'web' ? window.alert(err) : Alert.alert('Budget Integrity', err);
      return;
    }

    var performDelete = function () {
      var newList = getStoredAccountsList(userSettings).filter(function (a) { return a.id !== account.id; });
      if (userSettings) {
        var relatedHistory = (userHistory || []).filter(function (h) {
          return h.account_id === account.id || h.dest_account_id === account.id;
        });
        var historyCleanup = relatedHistory.map(function (h) {
          return mutateDeleteHistory({ id: h.id });
        });
        setIsSaving(true);
        var deletePromise = Promise.all(historyCleanup).then(function () {
          return mutateUpdateSettings({ id: userSettings.id, data: { accounts: newList, accounts_customized: true } });
        });
        runSaveWithFeedback(deletePromise, {
          onClose: onClose,
          onSaved: onSaved,
          setShowSuccess: setShowSaveSuccess,
          setSuccessMessage: setSuccessMessage,
          message: 'Wallet & History Deleted!',
          errorMessage: 'Could not delete wallet history.',
          onError: () => setIsSaving(false)
        }).then(() => setIsSaving(false));
      }
    };

    var msg = `Deleting "${account.name}" will PERMANENTLY DELETE all linked spending and income history. Total cash will be updated. Continue?`;
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) performDelete();
    } else {
      Alert.alert('Delete Wallet & History?', msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete Everything', style: 'destructive', onPress: performDelete }]);
    }
  };

  if (!visible || !account) return null;

  var valInput = parseAmount(amount) || 0;
  var liveBal = parseFloat(account.balance) || 0;
  var previewBal = mode === 'add' ? (liveBal + valInput) : (liveBal - valInput);

  var otherWalletsTotal = (accounts || []).filter(a => a.id !== account.id).reduce((s, a) => s + (parseFloat(a.balance) || 0), 0);
  var projectedTotalCash = otherWalletsTotal + previewBal;

  var isNegativeWarning = previewBal < 0;
  var isIntegrityWarning = projectedTotalCash < totalEnvelopeLiabilities;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingHorizontal: 24,
          paddingTop: 10,
          paddingBottom: 40,
          maxHeight: '92%',
          position: 'relative',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          elevation: 20
        }}>
          <View style={{ width: 40, height: 5, backgroundColor: theme.colors.border, borderRadius: 3, alignSelf: 'center', marginBottom: 15, opacity: 0.8 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.colors.textPrimary }}>Edit Wallet</Text>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={24} color={theme.colors.textSecondary} /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: 8, letterSpacing: 0.5 }}>WALLET NAME</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Account Name"
              style={{ backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.colors.textPrimary, marginBottom: 20 }}
            />

            <View style={{ backgroundColor: (isNegativeWarning || isIntegrityWarning) ? 'rgba(239, 68, 68, 0.08)' : 'rgba(15, 118, 110, 0.08)', borderRadius: 16, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: (isNegativeWarning || isIntegrityWarning) ? theme.colors.error : 'rgba(15, 118, 110, 0.15)' }}>
              <Text style={{ fontSize: 11, color: (isNegativeWarning || isIntegrityWarning) ? theme.colors.error : theme.colors.primary, fontWeight: '800', marginBottom: 4, letterSpacing: 0.5 }}>
                {isNegativeWarning ? 'RESULTING BALANCE (NEGATIVE!)' : (isIntegrityWarning ? 'BUDGET INTEGRITY ERROR' : 'PROJECTED LIVE BALANCE')}
              </Text>
              <Text style={{ fontSize: 28, fontWeight: 'bold', color: (isNegativeWarning || isIntegrityWarning) ? theme.colors.error : theme.colors.textPrimary }}>{formatCurrency(previewBal)}</Text>

              {isIntegrityWarning && (
                <Text style={{ fontSize: 12, color: theme.colors.error, marginTop: 8, fontWeight: '600', lineHeight: 18 }}>
                  Budget Integrity: You need {formatCurrency(totalEnvelopeLiabilities)} for envelopes, but will only have {formatCurrency(projectedTotalCash)} left.
                </Text>
              )}
            </View>

            <View style={{ marginBottom: 20 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                <MaterialIcons name="tune" size={16} color={theme.colors.textSecondary} style={{ marginRight: 6 }} />
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.textSecondary, letterSpacing: 0.5 }}>BALANCE ADJUSTMENT</Text>
              </View>

              <View style={{ flexDirection: 'row', backgroundColor: theme.colors.background, borderRadius: 12, padding: 4, marginBottom: 16, borderWidth: 1, borderColor: theme.colors.border }}>
                <TouchableOpacity onPress={() => setMode('add')} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: mode === 'add' ? theme.colors.primary : 'transparent', borderRadius: 8 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 13, color: mode === 'add' ? '#FFFFFF' : theme.colors.textSecondary }}>ADD FUNDS</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMode('reduce')} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: mode === 'reduce' ? theme.colors.error : 'transparent', borderRadius: 8 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: 13, color: mode === 'reduce' ? '#FFFFFF' : theme.colors.textSecondary }}>REDUCE FUNDS</Text>
                </TouchableOpacity>
              </View>

              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 8 }}>Amount to {mode === 'add' ? 'Deposit' : 'Withdraw'}</Text>
              <AmountInput value={amount} onChangeText={setAmount} theme={theme} variant="boxed" containerStyle={{ marginBottom: 12 }} placeholder="0.00" />
            </View>
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 12 }}>
            <TouchableOpacity disabled={isSaving} onPress={handleDelete} style={{ flex: 1, backgroundColor: theme.isDark ? '#2D1A1A' : '#FEF2F2', borderWidth: 1, borderColor: theme.colors.error, borderRadius: 14, paddingVertical: 14, alignItems: 'center', opacity: isSaving ? 0.6 : 1 }}>
              <Text style={{ color: theme.colors.error, fontSize: 15, fontWeight: 'bold' }}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={handleSave}
              disabled={isNegativeWarning || isIntegrityWarning || !name.trim() || isSaving}
              style={{ flex: 2, backgroundColor: (isNegativeWarning || isIntegrityWarning || !name.trim() || isSaving) ? theme.colors.border : (mode === 'reduce' ? theme.colors.error : theme.colors.primary), borderRadius: 14, paddingVertical: 14, alignItems: 'center', opacity: (isNegativeWarning || isIntegrityWarning || !name.trim() || isSaving) ? 0.6 : 1 }}
            >
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' }}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
          <SaveSuccessOverlay visible={showSaveSuccess} theme={theme} message={successMessage} />
        </View>
      </View>
    </Modal>
  );
};

const EditEnvelopeModal = function ({ visible, onClose, envelope, readyToAssign, envelopes, userSettings, mutateUpdateSettings, mutateUpdateRecurring, mutateDeleteRecurring, recurringExpenses, onSaved }) {
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var [name, setName] = useState('');
  var [goalAmount, setGoalAmount] = useState('');
  var [goalDate, setGoalDate] = useState('');
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);
  var [successMessage, setSuccessMessage] = useState('Saved!');
  var [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible && envelope) {
      setName(envelope.name);
      setGoalAmount(envelope.goal_amount ? String(envelope.goal_amount) : '');
      setGoalDate(envelope.goal_date || '');
      setShowSaveSuccess(false);
      setSuccessMessage('Saved!');
      setIsSaving(false);
    }
  }, [visible, envelope]);

  var handleSave = () => {
    if (isSaving || !name.trim()) return;
    var newGoalAmt = parseAmount(goalAmount);
    if (newGoalAmt < 0) {
      triggerErrorHaptic();
      showUndoToast({ message: 'Goal target amount cannot be negative!', type: 'error' });
      return;
    }
    var newGoalDate = goalDate.trim() || '';

    var newList = envelopes.map(e => {
      if (e.id === envelope.id) {
        return {
          ...e,
          name: name.trim(),
          goal_amount: newGoalAmt > 0 ? newGoalAmt : null,
          goal_date: newGoalDate || null
        };
      }
      return e;
    });

    if (userSettings) {
      setIsSaving(true);
      runSaveWithFeedback(
        mutateUpdateSettings({ id: userSettings.id, data: { envelopes: newList } }),
        {
          onClose: onClose,
          onSaved: onSaved,
          setShowSuccess: setShowSaveSuccess,
          setSuccessMessage: setSuccessMessage,
          message: 'Saved!',
          errorMessage: 'Could not save envelope. Please try again.',
          onError: () => setIsSaving(false)
        }
      ).then(() => setIsSaving(false));
    }
  };

  var handleDelete = () => {
    if (isSaving || !envelope) return;
    promptDeleteEnvelope({
      envelopeId: envelope.id,
      envelopes: envelopes,
      recurringExpenses: recurringExpenses,
      onPerformDelete: function () {
        if (!userSettings) return;
        setIsSaving(true);
        runSaveWithFeedback(
          deleteEnvelopeAndCleanup({
            envelopeId: envelope.id,
            envelopes: envelopes,
            recurringExpenses: recurringExpenses,
            userSettings: userSettings,
            mutateUpdateSettings: mutateUpdateSettings,
            mutateUpdateRecurring: mutateUpdateRecurring,
            mutateDeleteRecurring: mutateDeleteRecurring
          }),
          {
            onClose: onClose,
            onSaved: onSaved,
            setShowSuccess: setShowSaveSuccess,
            setSuccessMessage: setSuccessMessage,
            message: 'Deleted!',
            errorMessage: 'Could not delete envelope. Please try again.',
            onError: () => setIsSaving(false)
          }
        ).then(() => setIsSaving(false));
      }
    });
  };

  if (!visible || !envelope) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingHorizontal: 24,
          paddingTop: 10,
          paddingBottom: 40,
          position: 'relative',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          elevation: 20
        }}>
          {/* Handle */}
          <View style={{ width: 40, height: 5, backgroundColor: theme.colors.border, borderRadius: 3, alignSelf: 'center', marginBottom: 15, opacity: 0.8 }} />

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



          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 }}>SAVINGS GOAL TARGET AMOUNT (OPTIONAL)</Text>
          <AmountInput value={goalAmount} onChangeText={setGoalAmount} theme={theme} fontSize={20} containerStyle={{ marginBottom: 16 }} placeholder="15000" />

          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 }}>TARGET DATE (OPTIONAL)</Text>
          <DatePickerInput
            value={goalDate}
            onChange={setGoalDate}
            placeholder="Select target savings date..."
            style={{ backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16 }}
          />



          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <TouchableOpacity onPress={handleDelete} disabled={isSaving} style={{ flex: 1, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: theme.colors.error, borderRadius: 12, paddingVertical: 14, alignItems: 'center', opacity: isSaving ? 0.6 : 1 }}>
              <Text style={{ color: theme.colors.error, fontSize: 15, fontWeight: 'bold' }}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} disabled={isSaving} style={{ flex: 2, backgroundColor: isSaving ? theme.colors.accent : theme.colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' }}>Save Changes</Text>
              )}
            </TouchableOpacity>
          </View>
          <SaveSuccessOverlay visible={showSaveSuccess} theme={theme} message={successMessage} />
        </View>
      </View>
    </Modal>
  );
};

const TransferEnvelopeModal = function ({ visible, onClose, envelopes, userSettings, mutateUpdateSettings, onSaved }) {
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var [sourceId, setSourceId] = useState('');
  var [destId, setDestId] = useState('');
  var [amount, setAmount] = useState('');
  var [errorMsg, setErrorMsg] = useState('');
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);
  var [isSaving, setIsSaving] = useState(false);

  var insertHistory = useMutation('expense_history', 'insert');
  var mutateHistory = insertHistory.mutate;

  useEffect(() => {
    if (visible) {
      setErrorMsg('');
      setAmount('');
      setShowSaveSuccess(false);
      setIsSaving(false);
      if (envelopes && envelopes.length > 0) {
        setSourceId(envelopes[0].id);
        setDestId(envelopes[1] ? envelopes[1].id : envelopes[0].id);
      }
    }
  }, [visible, envelopes]);

  var handleTransfer = () => {
    if (isSaving) return;
    var amt = parseAmount(amount);
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
      setIsSaving(true);
      var transferPromise = mutateUpdateSettings({ id: userSettings.id, data: { envelopes: newList } }).then(function () {
        return mutateHistory({
          id: generateId(),
          user_id: userSettings.user_id,
          expense_name: `Transfer: ${sourceEnv.name} ➔ ${destEnv.name}`,
          amount: amt,
          expense_type: 'Transfer',
          category: sourceEnv.id,
          date: getTodayStr(),
          status: 'Completed',
          notes: `Transferred budget of ${formatCurrency(amt)} from ${sourceEnv.name} to ${destEnv.name}`
        });
      });
      runSaveWithFeedback(transferPromise, {
        onClose: onClose,
        onSaved: onSaved,
        setShowSuccess: setShowSaveSuccess,
        message: 'Transferred!',
        errorMessage: 'Transfer failed. Please try again.',
        onError: function () {
          setErrorMsg('Transfer failed. Please try again.');
          setIsSaving(false);
        }
      }).then(() => setIsSaving(false));
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingHorizontal: 24,
          paddingTop: 10,
          paddingBottom: 40,
          position: 'relative',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          elevation: 20
        }}>
          {/* Handle */}
          <View style={{ width: 40, height: 5, backgroundColor: theme.colors.border, borderRadius: 3, alignSelf: 'center', marginBottom: 15, opacity: 0.8 }} />

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
          <AmountInput value={amount} onChangeText={setAmount} theme={theme} fontSize={22} containerStyle={{ marginBottom: 20 }} />

          <TouchableOpacity disabled={isSaving} onPress={handleTransfer} style={{ backgroundColor: isSaving ? theme.colors.accent : theme.colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' }}>Complete Transfer</Text>
            )}
          </TouchableOpacity>
          <SaveSuccessOverlay visible={showSaveSuccess} theme={theme} message="Transferred!" />
        </View>
      </View>
    </Modal>
  );
};

const TransferWalletModal = function ({ visible, onClose, accounts, userHistory, onSaved, theme, insetsBottom, userId }) {
  var [sourceId, setSourceId] = useState('');
  var [destId, setDestId] = useState('');
  var [amount, setAmount] = useState('');
  var [errorMsg, setErrorMsg] = useState('');
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);
  var [isSaving, setIsSaving] = useState(false);

  var insertHistory = useMutation('expense_history', 'insert');
  var mutateHistory = insertHistory.mutate;

  useEffect(() => {
    if (visible) {
      setErrorMsg('');
      setAmount('');
      setShowSaveSuccess(false);
      setIsSaving(false);
      if (accounts && accounts.length > 0) {
        setSourceId(accounts[0].id);
        setDestId(accounts[1] ? accounts[1].id : accounts[0].id);
      }
    }
  }, [visible, accounts]);

  var handleTransfer = () => {
    if (isSaving) return;
    var amt = parseAmount(amount);
    if (amt <= 0) {
      setErrorMsg('Please enter a valid transfer amount.');
      return;
    }
    if (sourceId === destId) {
      setErrorMsg('Source and Destination wallets must be different.');
      return;
    }
    var srcAcc = accounts.find(a => a.id === sourceId);
    var destAcc = accounts.find(a => a.id === destId);
    if (!srcAcc || !destAcc) {
      setErrorMsg('Invalid wallets selected.');
      return;
    }
    if (srcAcc.balance < amt) {
      setErrorMsg(`Insufficient funds in "${srcAcc.name}". Balance: ${formatCurrency(srcAcc.balance)}`);
      return;
    }

    var timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    var expId = generateId();

    setIsSaving(true);
    runSaveWithFeedback(
      mutateHistory({
        id: expId,
        user_id: userId,
        expense_name: `Transfer: ${srcAcc.name} → ${destAcc.name}`,
        amount: amt,
        expense_type: 'Transfer',
        date: getTodayStr(),
        status: 'Completed',
        notes: timeStr + ' • Wallet transfer',
        account_id: sourceId,
        dest_account_id: destId
      }),
      {
        onClose: onClose,
        onSaved: onSaved,
        setShowSuccess: setShowSaveSuccess,
        message: 'Money moved!',
        errorMessage: 'Transfer failed. Please try again.',
        onError: () => setIsSaving(false)
      }
    ).then(() => setIsSaving(false));
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingHorizontal: 24,
          paddingTop: 10,
          paddingBottom: insetsBottom + 24,
          maxHeight: '92%',
          position: 'relative',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          elevation: 20
        }}>
          {/* Handle */}
          <View style={{ width: 40, height: 5, backgroundColor: theme.colors.border, borderRadius: 3, alignSelf: 'center', marginBottom: 15, opacity: 0.8 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.colors.textPrimary }}>Wallet Money Transfer</Text>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={24} color={theme.colors.textSecondary} /></TouchableOpacity>
          </View>

          {errorMsg ? (
            <View style={{ backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10, marginBottom: 16 }}>
              <Text style={{ color: theme.colors.error, fontSize: 13, fontWeight: '600' }}>{errorMsg}</Text>
            </View>
          ) : null}

          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8, fontWeight: '600' }}>MOVE FROM (SOURCE)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 16 }}>
            {accounts.map(acc => {
              var isSel = sourceId === acc.id;
              var styleInfo = WALLET_STYLES[acc.type] || WALLET_STYLES.Custom;
              var brandColor = acc.color || styleInfo.color;
              return (
                <TouchableOpacity key={acc.id} onPress={() => setSourceId(acc.id)} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: isSel ? theme.colors.primary : theme.colors.background, borderWidth: 1, borderColor: isSel ? theme.colors.primary : theme.colors.border, marginRight: 8, flexDirection: 'row', alignItems: 'center' }}>
                  <BrandLogo type={acc.type} size={14} style={{ marginRight: 6 }} />
                  <Text style={{ color: isSel ? '#FFFFFF' : brandColor, fontSize: 13, fontWeight: '700' }}>{acc.name} ({formatCurrency(acc.balance)})</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8, fontWeight: '600' }}>MOVE TO (DESTINATION)</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 16 }}>
            {accounts.map(acc => {
              var isSel = destId === acc.id;
              var styleInfo = WALLET_STYLES[acc.type] || WALLET_STYLES.Custom;
              var brandColor = acc.color || styleInfo.color;
              return (
                <TouchableOpacity key={acc.id} onPress={() => setDestId(acc.id)} style={{ paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: isSel ? theme.colors.primary : theme.colors.background, borderWidth: 1, borderColor: isSel ? theme.colors.primary : theme.colors.border, marginRight: 8, flexDirection: 'row', alignItems: 'center' }}>
                  <BrandLogo type={acc.type} size={14} style={{ marginRight: 6 }} />
                  <Text style={{ color: isSel ? '#FFFFFF' : brandColor, fontSize: 13, fontWeight: '700' }}>{acc.name} ({formatCurrency(acc.balance)})</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8, fontWeight: '600' }}>AMOUNT TO MOVE</Text>
          <AmountInput value={amount} onChangeText={setAmount} theme={theme} fontSize={22} containerStyle={{ marginBottom: 24 }} />

          <TouchableOpacity disabled={isSaving || accounts.length < 2} onPress={handleTransfer} style={{ backgroundColor: (isSaving || accounts.length < 2) ? theme.colors.border : theme.colors.primary, borderRadius: 14, paddingVertical: 16, alignItems: 'center', elevation: 2 }}>
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>Complete Transfer</Text>
            )}
          </TouchableOpacity>
          <SaveSuccessOverlay visible={showSaveSuccess} theme={theme} message="Money moved!" />
        </View>
      </View>
    </Modal>
  );
};

const EditSalaryModal = function ({ visible, onClose, incomeSources, userSettings, mutateUpdateSettings, readyToAssign, totalAvailableMoney, envelopes, envelopeBalances, oneTimeExpenses, userHistory }) {
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var insets = useSafeAreaInsets();
  var mainSalarySrc = incomeSources.find(s => s.id === 'main-salary') || { id: 'main-salary', name: 'Main Salary', amount: 0 };
  var [salary, setSalary] = useState(String(mainSalarySrc.amount || ''));
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);
  var [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setIsSaving(false);
      setShowSaveSuccess(false);
      setSalary(String(mainSalarySrc.amount || ''));
    }
  }, [visible, mainSalarySrc.amount]);

  var handleSave = () => {
    if (isSaving) return;
    var newAmt = parseAmount(salary);
    var guard = validateIncomeSourceAmountEdit({
      incomeSources: incomeSources,
      sourceId: 'main-salary',
      newAmount: newAmt,
      readyToAssign: readyToAssign,
      totalAvailableMoney: totalAvailableMoney,
      envelopes: envelopes,
      envelopeBalances: envelopeBalances,
      oneTimeExpenses: oneTimeExpenses,
      userHistory: userHistory
    });
    if (!guard.ok) {
      Platform.OS === 'web' ? window.alert(guard.message) : Alert.alert('Cannot Update Income', guard.message);
      return;
    }
    var newSources = incomeSources.map(s => s.id === 'main-salary' ? { ...s, amount: newAmt } : s);
    if (!incomeSources.find(s => s.id === 'main-salary')) {
      newSources.unshift({ id: 'main-salary', name: 'Main Salary', amount: newAmt });
    }
    if (userSettings) {
      setIsSaving(true);
      runSaveWithFeedback(
        mutateUpdateSettings({ id: userSettings.id, data: { income_sources: newSources, monthly_salary: newAmt } }),
        {
          onClose: onClose,
          setShowSuccess: setShowSaveSuccess,
          message: 'Salary saved!',
          errorMessage: 'Could not save salary. Please try again.',
          onError: () => setIsSaving(false)
        }
      ).then(() => setIsSaving(false));
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }}>
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 16, padding: 24, position: 'relative', overflow: 'hidden' }}>
          <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.colors.textPrimary, marginBottom: 16 }}>Edit Main Salary</Text>
          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 }}>MONTHLY AMOUNT</Text>
          <AmountInput value={salary} onChangeText={setSalary} theme={theme} fontSize={22} containerStyle={{ marginBottom: 20 }} />
          <View style={{ flexDirection: 'row', justifyContent: 'flex-end', gap: 12 }}>
            <TouchableOpacity onPress={onClose} disabled={isSaving} style={{ padding: 12 }}><Text style={{ color: theme.colors.textSecondary, fontWeight: '600', fontSize: 15 }}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={handleSave} disabled={isSaving} style={{ backgroundColor: isSaving ? theme.colors.accent : theme.colors.primary, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 12, minWidth: 80, alignItems: 'center' }}>
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 }}>Save</Text>
              )}
            </TouchableOpacity>
          </View>
          <SaveSuccessOverlay visible={showSaveSuccess} theme={theme} message="Salary saved!" />
        </View>
      </View>
    </Modal>
  );
};

const IncomeManagerModal = function ({ visible, onClose, accounts = [], userSettings, userHistory, theme, insetsBottom, onSaved, onAddAccount, readyToAssign, totalAvailableMoney, envelopes, envelopeBalances, oneTimeExpenses, incomeSources, mutateUpdateSettings }) {
  // Calculate Actual Income Received this month per source
  var incomeReceivedBySource = useMemo(function() {
    var received = {};
    var curMonth = getCurrentMonthStr();
    (userHistory || []).forEach(function(h) {
      if (getMonthStr(h.date) === curMonth) {
        var amt = parseFloat(h.amount) || 0;
        if (h.expense_type === 'Income') {
          var key = h.category || 'unlinked';
          received[key] = (received[key] || 0) + amt;
        } else if (h.expense_type === 'Adjustment') {
          if (h.category === 'Income') {
            received['Income'] = (received['Income'] || 0) + amt;
          } else if (h.category === 'Adjustment') {
            // Net down the primary income if it was a general reduction
            received['main-salary'] = (received['main-salary'] || 0) - amt;
          }
        }
      }
    });
    return received;
  }, [userHistory]);

  // Transaction logging form state
  var [logName, setLogName] = useState('');
  var [logAmount, setLogAmount] = useState('');
  var [logAccount, setLogAccount] = useState('unlinked');
  var [logDate, setLogDate] = useState(getTodayStr());

  // Edit Source State
  var [showEditSources, setShowEditSources] = useState(false);
  var [editingSourceId, setEditingSourceId] = useState(null);
  var [editSourceName, setEditSourceName] = useState('');
  var [editSourceAmount, setEditTxnAmount] = useState('');

  // Success messages / overlay states
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);
  var [successMessage, setSuccessMessage] = useState('Saved!');
  var [isSaving, setIsSaving] = useState(false);

  var insertHistory = useMutation('expense_history', 'insert');
  var mutateInsertHistory = insertHistory.mutate;

  var userId = userSettings ? (userSettings.user_id || userSettings.id) : '';

  useEffect(() => {
    if (visible) {
      setLogAccount(accounts[0] ? accounts[0].id : 'unlinked');
      setLogDate(getTodayStr());
      setLogName('');
      setLogAmount('');
      setShowSaveSuccess(false);
      setSuccessMessage('Saved!');
      setShowEditSources(false);
    }
  }, [visible, accounts]);

  var handleSaveLog = function () {
    if (isSaving) return;
    if (!logName.trim()) {
      Platform.OS === 'web' ? window.alert('Please enter a description.') : Alert.alert('Error', 'Please enter a description.');
      return;
    }
    var amt = parseAmount(logAmount);
    if (isNaN(amt) || amt <= 0) {
      Platform.OS === 'web' ? window.alert('Please enter a valid positive amount.') : Alert.alert('Error', 'Please enter a valid positive amount.');
      return;
    }

    if (userSettings) {
      var txn = {
        id: 'tx-' + generateId(),
        user_id: userId,
        expense_name: logName.trim(),
        amount: amt,
        date: logDate || getTodayStr(),
        expense_type: 'Income',
        category: 'Income',
        account_id: logAccount || 'unlinked',
        notes: 'Logged income transaction'
      };

      setIsSaving(true);
      runSaveWithFeedback(
        mutateInsertHistory(txn),
        {
          onClose: onClose,
          onSaved: onSaved,
          setShowSuccess: setShowSaveSuccess,
          setSuccessMessage: setSuccessMessage,
          message: 'Income logged!',
          errorMessage: 'Could not log income. Please try again.',
          onError: () => setIsSaving(false)
        }
      ).then(function() {
        setLogName('');
        setLogAmount('');
        setLogDate(getTodayStr());
        setIsSaving(false);
      });
    }
  };

  var handleUpdateSource = function() {
    if (isSaving || !editingSourceId) return;
    var amt = parseAmount(editSourceAmount);

    var guard = validateIncomeSourceAmountEdit({
      incomeSources: incomeSources,
      sourceId: editingSourceId,
      newAmount: amt,
      readyToAssign: readyToAssign,
      totalAvailableMoney: totalAvailableMoney,
      envelopes: envelopes,
      envelopeBalances: envelopeBalances,
      oneTimeExpenses: oneTimeExpenses,
      userHistory: userHistory
    });

    if (!guard.ok) {
      Platform.OS === 'web' ? window.alert(guard.message) : Alert.alert('Cannot Update Source', guard.message);
      return;
    }

    var newList = incomeSources.map(s => s.id === editingSourceId ? { ...s, name: editSourceName.trim(), amount: amt } : s);
    setIsSaving(true);
    runSaveWithFeedback(
      mutateUpdateSettings({ id: userSettings.id, data: { income_sources: newList } }),
      {
        onSaved: onSaved,
        setShowSuccess: setShowSaveSuccess,
        message: 'Source updated!',
        onError: () => setIsSaving(false)
      }
    ).then(() => {
      setEditingSourceId(null);
      setIsSaving(false);
    });
  };

  var handleDeleteSource = function(id) {
    if (isSaving) return;
    var guard = validateIncomeSourceDelete({
      incomeSources: incomeSources,
      sourceId: id,
      readyToAssign: readyToAssign,
      totalAvailableMoney: totalAvailableMoney,
      envelopes: envelopes,
      envelopeBalances: envelopeBalances,
      oneTimeExpenses: oneTimeExpenses,
      userHistory: userHistory
    });

    if (!guard.ok) {
      Platform.OS === 'web' ? window.alert(guard.message) : Alert.alert('Cannot Delete Source', guard.message);
      return;
    }

    var doDelete = () => {
      var newList = incomeSources.filter(s => s.id !== id);
      setIsSaving(true);
      runSaveWithFeedback(
        mutateUpdateSettings({ id: userSettings.id, data: { income_sources: newList } }),
        {
          onSaved: onSaved,
          setShowSuccess: setShowSaveSuccess,
          message: 'Source removed!',
          onError: () => setIsSaving(false)
        }
      ).then(() => setIsSaving(false));
    };

    if (Platform.OS === 'web') {
      if (window.confirm('Delete this income source?')) doDelete();
    } else {
      Alert.alert('Delete Source', 'Are you sure?', [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: doDelete }]);
    }
  };

  if (!visible) return null;

  var hasNoAccounts = accounts.length === 0;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingHorizontal: 24,
          paddingTop: 10,
          paddingBottom: insetsBottom + 24,
          maxHeight: '92%',
          position: 'relative',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          elevation: 20
        }}>
          <View style={{ width: 40, height: 5, backgroundColor: theme.colors.border, borderRadius: 3, alignSelf: 'center', marginBottom: 15, opacity: 0.8 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <View>
              <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.colors.textPrimary }}>Log Income Receipt</Text>
              {!hasNoAccounts && <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>Record actual money received to update wallet balances.</Text>}
            </View>
            <View style={{ flexDirection: 'row', gap: 8 }}>
              <TouchableOpacity onPress={() => setShowEditSources(!showEditSources)} style={{ padding: 8, backgroundColor: showEditSources ? theme.colors.primary : (theme.isDark ? '#374151' : '#F3F4F6'), borderRadius: 12 }}>
                <MaterialIcons name="settings" size={20} color={showEditSources ? '#FFFFFF' : theme.colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={{ padding: 8, backgroundColor: theme.isDark ? '#374151' : '#F3F4F6', borderRadius: 12 }}>
                <MaterialIcons name="close" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {showEditSources ? (
            <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
              <Text style={{ fontSize: 15, fontWeight: 'bold', color: theme.colors.textPrimary, marginBottom: 16 }}>Manage Income Sources</Text>
              {incomeSources.map(src => {
                var isEditing = editingSourceId === src.id;
                return (
                  <View key={src.id} style={{ backgroundColor: theme.colors.background, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border }}>
                    {isEditing ? (
                      <View>
                        <TextInput value={editSourceName} onChangeText={setEditSourceName} style={{ backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, padding: 10, color: theme.colors.textPrimary, marginBottom: 8 }} />
                        <AmountInput value={editSourceAmount} onChangeText={setEditTxnAmount} theme={theme} containerStyle={{ marginBottom: 10 }} />
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity onPress={handleUpdateSource} style={{ flex: 1, backgroundColor: theme.colors.primary, borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}><Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Save</Text></TouchableOpacity>
                          <TouchableOpacity onPress={() => setEditingSourceId(null)} style={{ flex: 1, backgroundColor: theme.colors.border, borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}><Text style={{ color: theme.colors.textSecondary }}>Cancel</Text></TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View>
                          <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.textPrimary }}>{src.name}</Text>
                          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 2 }}>
                            <Text style={{ fontSize: 13, color: theme.colors.primary, fontWeight: '600' }}>
                              {formatCurrency(incomeReceivedBySource[src.id] || 0)}
                            </Text>
                            <Text style={{ fontSize: 12, color: theme.colors.textSecondary }}> / {formatCurrency(src.amount)} target</Text>
                          </View>
                        </View>
                        <View style={{ flexDirection: 'row', gap: 10 }}>
                          <TouchableOpacity onPress={() => { setEditingSourceId(src.id); setEditSourceName(src.name); setEditTxnAmount(String(src.amount)); }}><MaterialIcons name="edit" size={18} color={theme.colors.primary} /></TouchableOpacity>
                          <TouchableOpacity onPress={() => handleDeleteSource(src.id)}><MaterialIcons name="delete-outline" size={18} color={theme.colors.error} /></TouchableOpacity>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })}
              <TouchableOpacity onPress={() => setShowEditSources(false)} style={{ marginTop: 10, alignItems: 'center', padding: 12 }}><Text style={{ color: theme.colors.primary, fontWeight: '700' }}>Back to Logging</Text></TouchableOpacity>
            </ScrollView>
          ) : hasNoAccounts ? (
            <View style={{ alignItems: 'center', paddingVertical: 40 }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.colors.primary + '20', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                <MaterialIcons name="account-balance-wallet" size={40} color={theme.colors.primary} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.textPrimary, textAlign: 'center', marginBottom: 12 }}>First, let's create a home for your money.</Text>
              <Text style={{ fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 32, lineHeight: 22 }}>
                To track income accurately, Penny needs to know where the money is stored (e.g., GCash, Bank, or Physical Cash).
              </Text>
              <TouchableOpacity
                onPress={onAddAccount}
                style={{ backgroundColor: theme.colors.primary, borderRadius: 16, paddingVertical: 16, paddingHorizontal: 32, width: '100%', alignItems: 'center', elevation: 4 }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>Add My First Wallet</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 8, letterSpacing: 0.5 }}>DESCRIPTION / SOURCE</Text>
              <TextInput
                value={logName}
                onChangeText={setLogName}
                placeholder="e.g. Salary Payment, Side Gig, Cash Gift"
                placeholderTextColor={theme.isDark ? '#6B7280' : '#9CA3AF'}
                style={{ backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.colors.textPrimary, marginBottom: 16 }}
              />

              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 8, letterSpacing: 0.5 }}>AMOUNT RECEIVED</Text>
              <AmountInput
                value={logAmount}
                onChangeText={setLogAmount}
                theme={theme}
                variant="boxed"
                fontSize={18}
                containerStyle={{ marginBottom: 16 }}
                placeholder="0.00"
              />

              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 8, letterSpacing: 0.5 }}>DEPOSIT TO WALLET</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 16 }}>
                {accounts.map(a => {
                  var isSel = logAccount === a.id;
                  var styleInfo = WALLET_STYLES[a.type] || WALLET_STYLES.Custom;
                  var brandColor = a.color || styleInfo.color;
                  return (
                    <TouchableOpacity
                      key={a.id}
                      onPress={() => setLogAccount(a.id)}
                      style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, backgroundColor: isSel ? theme.colors.primary : theme.colors.background, borderWidth: 1, borderColor: isSel ? theme.colors.primary : theme.colors.border }}
                    >
                      <BrandLogo type={a.type} size={16} style={{ marginRight: 8 }} />
                      <Text style={{ color: isSel ? '#FFFFFF' : brandColor, fontSize: 13, fontWeight: '700' }}>
                        {a.name} (₱{a.balance})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 8, letterSpacing: 0.5 }}>DATE RECEIVED</Text>
              <DatePickerInput value={logDate} onChange={setLogDate} theme={theme} containerStyle={{ marginBottom: 20 }} />

              <TouchableOpacity
                onPress={handleSaveLog}
                style={{ backgroundColor: theme.colors.primary, borderRadius: 14, paddingVertical: 14, alignItems: 'center', elevation: 4, marginBottom: 8 }}
              >
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 }}>Log Income Transaction</Text>
              </TouchableOpacity>
            </ScrollView>
          )}
          <SaveSuccessOverlay visible={showSaveSuccess} theme={theme} message={successMessage} />
        </View>
      </View>
    </Modal>
  );
};

const SpentManagerModal = function ({ visible, onClose, filter, oneTimeExpenses, envelopes, userId, theme, insetsTop, insetsBottom, onSaved, userHistory, recurringExpenses, accounts }) {
  var [editingId, setEditingId] = useState(null);
  var [editName, setEditName] = useState('');
  var [editAmount, setEditAmount] = useState('');
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);
  var [successMessage, setSuccessMessage] = useState('Saved!');
  var [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!visible) {
      setEditingId(null);
      setEditName('');
      setEditAmount('');
      setShowSaveSuccess(false);
      setSuccessMessage('Saved!');
      setIsSaving(false);
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
  var updateRecurring = useMutation('recurring_expenses', 'update');
  var mutateUpdateRecurring = updateRecurring.mutate;

  var filteredExpenses = useMemo(function () {
    var curMonth = getCurrentMonthStr();
    var oneTimes = (oneTimeExpenses || []).map(function (o) {
      return { id: o.id, name: o.expense_name || o.name || 'Expense', amount: parseFloat(o.amount) || 0, category: o.category, date: o.date, type: 'One-Time' };
    });

    var recurrings = (userHistory || []).reduce(function (arr, h) {
      if (h.expense_type === 'Recurring' && getMonthStr(h.date) === curMonth) {
        var rec = (recurringExpenses || []).find(function (r) { return r.name === h.expense_name; });
        var category = h.category;
        if (!category) {
          category = rec ? rec.category : 'Other';
        }
        arr.push({
          id: h.id,
          name: h.expense_name || h.name || 'Bill Payment',
          amount: parseFloat(h.amount) || 0,
          category: category,
          date: h.date,
          type: 'Recurring',
          originalBillId: rec ? rec.id : null
        });
      }
      return arr;
    }, []);

    var combined = oneTimes.concat(recurrings);
    if (!filter) return combined;
    return combined.filter(function (o) { return o.category === filter; });
  }, [oneTimeExpenses, userHistory, recurringExpenses, filter]);

  var handleStartEdit = function (exp) {
    setEditingId(exp.id);
    setEditName(exp.name);
    setEditAmount(formatAmountForEdit(exp.amount));
  };

  var handleSaveEdit = function (exp) {
    if (isSaving) return;
    var amt = parseAmount(editAmount);
    if (!editName.trim()) {
      Platform.OS === 'web' ? window.alert('Please enter a name.') : Alert.alert('Error', 'Please enter a name.');
      return;
    }
    if (amt <= 0) {
      Platform.OS === 'web' ? window.alert('Please enter a valid amount.') : Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }

    // Find the history entry to get the account used
    var historyTxn = (userHistory || []).find(function (h) { return h.id === exp.id; });
    var accountId = historyTxn ? historyTxn.account_id : null;

    var spendCheck = validateSpendOperation({
      amount: amt,
      categoryId: exp.category,
      envelopeBalances: envelopes,
      accountId: accountId,
      accounts: accounts,
      isEdit: true,
      oldAmount: exp.amount
    });

    if (!spendCheck.ok) {
      Platform.OS === 'web' ? window.alert(spendCheck.message) : Alert.alert('Error', spendCheck.message);
      return;
    }

    var savePromise;
    var updateData = {
      expense_name: editName.trim(),
      name: editName.trim(), // Write to both for absolute consistency
      amount: amt
    };

    savePromise = mutateUpdateHistory({ id: exp.id, data: updateData });

    setIsSaving(true);
    runSaveWithFeedback(savePromise, {
      onSaved: onSaved,
      setShowSuccess: setShowSaveSuccess,
      setSuccessMessage: setSuccessMessage,
      message: 'Expense updated!',
      errorMessage: 'Could not update expense. Please try again.',
      onError: () => setIsSaving(false)
    }).then(function () {
      setEditingId(null);
      setIsSaving(false);
    });
  };

  var handleDelete = function (exp) {
    if (isSaving) return;
    var msg = 'Delete this expense? The amount (' + formatCurrency(exp.amount) + ') will be returned to your envelope balance.';
    var doDelete = function () {
      var deletePromise;
      if (exp.type === 'One-Time') {
        deletePromise = mutateDeleteHistory({ id: exp.id });
      } else if (exp.type === 'Recurring') {
        deletePromise = mutateDeleteHistory({ id: exp.id }).then(function () {
          if (exp.originalBillId) {
            return mutateUpdateRecurring({ id: exp.originalBillId, data: { status: 'Pending' } });
          }
        });
      } else {
        return;
      }
      setIsSaving(true);
      runSaveWithFeedback(deletePromise, {
        onSaved: onSaved,
        setShowSuccess: setShowSaveSuccess,
        setSuccessMessage: setSuccessMessage,
        message: 'Deleted!',
        errorMessage: 'Could not delete expense. Please try again.',
        onError: () => setIsSaving(false)
      }).then(() => setIsSaving(false));
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

  var filterEnv = envelopes.find(function (e) { return e.id === filter; });
  var title = filterEnv ? filterEnv.name + ' Spending' : "This Month's Spending";

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
        <View style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingHorizontal: 24,
          paddingTop: 10,
          paddingBottom: insetsBottom + 24,
          maxHeight: '85%',
          position: 'relative',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          elevation: 20
        }}>
          {/* Handle */}
          <View style={{ width: 40, height: 5, backgroundColor: theme.colors.border, borderRadius: 3, alignSelf: 'center', marginBottom: 15, opacity: 0.8 }} />

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
              filteredExpenses.map(function (exp) {
                var isEditing = editingId === exp.id;
                var env = envelopes.find(function (e) { return e.id === exp.category; });
                return React.createElement(View, { key: exp.id, style: { backgroundColor: theme.colors.background, borderRadius: 12, padding: 14, marginBottom: 10, borderWidth: 1, borderColor: theme.colors.border } },
                  isEditing
                    ? React.createElement(View, null,
                      React.createElement(TextInput, {
                        value: editName, onChangeText: setEditName, placeholder: 'Name',
                        placeholderTextColor: theme.isDark ? '#6B7280' : '#9CA3AF',
                        style: { backgroundColor: theme.colors.inputBg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, fontSize: 14, color: theme.colors.textPrimary, marginBottom: 8 }
                      }),
                      React.createElement(AmountInput, {
                        value: editAmount,
                        onChangeText: setEditAmount,
                        theme: theme,
                        variant: 'boxed',
                        fontSize: 14,
                        containerStyle: { flex: 1, marginBottom: 0 },
                        placeholder: '0.00'
                      }),
                      React.createElement(View, { style: { flexDirection: 'row', gap: 8, marginTop: 8 } },
                        React.createElement(TouchableOpacity, {
                          onPress: function () { handleSaveEdit(exp); },
                          style: { backgroundColor: theme.colors.primary, borderRadius: 8, paddingHorizontal: 12, justifyContent: 'center' }
                        },
                          React.createElement(Text, { style: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 } }, 'Save')
                        ),
                        React.createElement(TouchableOpacity, {
                          onPress: function () { setEditingId(null); },
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
                          React.createElement(TouchableOpacity, { onPress: function () { handleStartEdit(exp); }, style: { padding: 4, backgroundColor: '#FFEDD5', borderRadius: 6 } },
                            React.createElement(MaterialIcons, { name: 'edit', size: 16, color: theme.colors.primary })
                          ),
                          React.createElement(TouchableOpacity, { onPress: function () { handleDelete(exp); }, style: { padding: 4, backgroundColor: '#FEF2F2', borderRadius: 6 } },
                            React.createElement(MaterialIcons, { name: 'delete-outline', size: 16, color: theme.colors.error })
                          )
                        )
                      )
                    )
                );
              })
            )}
          </ScrollView>

          <SaveSuccessOverlay visible={showSaveSuccess} theme={theme} message={successMessage} />

        </View>
      </View>
    </Modal>
  );
};

const QuickAddBudgetModal = function ({ visible, onClose, envelope, readyToAssign, envelopes, userSettings, mutateUpdateSettings, onSaved, theme, setSelectedEnvelope, setShowEditEnvModal, userId }) {
  var [amount, setAmount] = useState('');
  var [mode, setMode] = useState('add'); // 'add' or 'reduce'
  var [errorMsg, setErrorMsg] = useState('');
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);
  var [isSaving, setIsSaving] = useState(false);

  var insertHistory = useMutation('expense_history', 'insert');
  var mutateInsertHistory = insertHistory.mutate;
  var deleteHistory = useMutation('expense_history', 'delete');
  var mutateDeleteHistory = deleteHistory.mutate;
  var historyQuery = useQuery('expense_history');
  var allHistory = historyQuery.data || [];

  useEffect(() => {
    if (visible) {
      setAmount('');
      setMode('add');
      setErrorMsg('');
      setShowSaveSuccess(false);
      setIsSaving(false);
    }
  }, [visible]);

  if (!envelope) return null;

  var envelopeHistory = allHistory.filter(function (h) {
    return h.expense_type === 'Budget Assignment' && h.category === envelope.id && h.user_id === userId;
  }).sort(function (a, b) { return new Date(b.date) - new Date(a.date); });

  var currentAssigned = parseFloat(envelope.assigned) || 0;
  var currentAvailable = parseFloat(envelope.available) !== undefined ? parseFloat(envelope.available) : currentAssigned;
  var amtVal = parseAmount(amount);
  
  var newAssigned = mode === 'add' ? (currentAssigned + amtVal) : (currentAssigned - amtVal);
  var remainingRta = mode === 'add' ? (readyToAssign - amtVal) : (readyToAssign + amtVal);

  var handleConfirm = function () {
    if (isSaving) return;
    if (!amount.trim()) {
      setErrorMsg('Please enter an amount.');
      return;
    }
    if (isNaN(amtVal) || amtVal <= 0) {
      setErrorMsg('Please enter a valid positive number.');
      return;
    }
    if (mode === 'add' && remainingRta < 0) {
      setErrorMsg('You cannot assign more money than you have in Ready to Assign!');
      return;
    }
    if (mode === 'reduce' && newAssigned < 0) {
      setErrorMsg('Cannot reduce assigned budget below ₱0.00!');
      return;
    }
    if (mode === 'reduce' && currentAvailable - amtVal < 0) {
      setErrorMsg('Cannot reduce budget below what you have already spent! (Available balance would become negative)');
      return;
    }

    var newEnvelopes = envelopes.map(function (e) {
      var rawEnvs = [];
      if (userSettings && userSettings.envelopes) {
        rawEnvs = typeof userSettings.envelopes === 'string' ? JSON.parse(userSettings.envelopes) : userSettings.envelopes;
      }
      var orig = rawEnvs.find(x => x.id === e.id) || {};
      if (e.id === envelope.id) {
        return { ...orig, id: e.id, name: e.name, assigned: newAssigned };
      }
      return { ...orig, id: e.id, name: e.name, assigned: parseFloat(e.assigned) || 0 };
    });

    if (userSettings) {
      var rawBefore = [];
      if (userSettings.envelopes) {
        rawBefore = typeof userSettings.envelopes === 'string'
          ? JSON.parse(userSettings.envelopes)
          : userSettings.envelopes;
      }
      var envelopesSnapshot = JSON.parse(JSON.stringify(rawBefore));
      var historyId = generateId();
      setIsSaving(true);
      var savePromise = mutateUpdateSettings({ id: userSettings.id, data: { envelopes: newEnvelopes } }).then(function () {
        var label = mode === 'add' ? 'Budget Added' : 'Budget Reduced';
        return mutateInsertHistory({
          id: historyId,
          user_id: userId,
          expense_name: label + ': ' + envelope.name,
          amount: amtVal,
          date: new Date().toISOString(),
          expense_type: 'Budget Assignment',
          category: envelope.id,
          account_id: null,
          notes: mode === 'add' ? '+' + formatCurrency(amtVal) + ' assigned' : '-' + formatCurrency(amtVal) + ' returned to RTA'
        });
      });
      runSaveWithFeedback(savePromise, {
        onClose: onClose,
        onSaved: onSaved,
        setShowSuccess: setShowSaveSuccess,
        message: 'Budget updated!',
        undoMessage: 'Budget updated',
        undo: function () {
          return mutateUpdateSettings({ id: userSettings.id, data: { envelopes: envelopesSnapshot } }).then(function () {
            return mutateDeleteHistory({ id: historyId });
          }).then(function () { onSaved && onSaved(); });
        },
        errorMessage: 'Failed to update budget. Please try again.',
        onError: function () {
          setErrorMsg('Failed to update budget. Try again.');
          setIsSaving(false);
        }
      }).then(function () {
        setAmount('');
        setErrorMsg('');
        setIsSaving(false);
      });
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: 16 }}>
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 20, padding: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5, maxHeight: '90%', position: 'relative', overflow: 'hidden' }}>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.textPrimary }}>Adjust Budget: {envelope.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
              <TouchableOpacity onPress={function () {
                onClose();
                var rawEnvs = [];
                if (userSettings && userSettings.envelopes) {
                  rawEnvs = typeof userSettings.envelopes === 'string' ? JSON.parse(userSettings.envelopes) : userSettings.envelopes;
                }
                var orig = rawEnvs.find(x => x.id === envelope.id) || envelope;
                setSelectedEnvelope(orig);
                setShowEditEnvModal(true);
              }} style={{ padding: 4 }}>
                <MaterialIcons name="edit" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={{ padding: 4 }}>
                <MaterialIcons name="close" size={24} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Segmented Mode Picker */}
          <View style={{ flexDirection: 'row', backgroundColor: theme.colors.inputBg, borderRadius: 12, padding: 4, marginBottom: 14, borderWidth: 1, borderColor: theme.colors.border }}>
            <TouchableOpacity onPress={() => { setMode('add'); setErrorMsg(''); }} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: mode === 'add' ? theme.colors.primary : 'transparent', borderRadius: 8 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 13, color: mode === 'add' ? '#FFFFFF' : theme.colors.textSecondary }}>ADD FUNDS</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => { setMode('reduce'); setErrorMsg(''); }} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: mode === 'reduce' ? theme.colors.error : 'transparent', borderRadius: 8 }}>
              <Text style={{ fontWeight: 'bold', fontSize: 13, color: mode === 'reduce' ? '#FFFFFF' : theme.colors.textSecondary }}>REDUCE FUNDS</Text>
            </TouchableOpacity>
          </View>

          {errorMsg ? (
            <View style={{ backgroundColor: '#FEE2E2', borderRadius: 8, padding: 10, marginBottom: 12 }}>
              <Text style={{ color: '#DC2626', fontSize: 13, fontWeight: 'bold' }}>{errorMsg}</Text>
            </View>
          ) : null}

          {/* Balance Summary */}
          <View style={{ backgroundColor: theme.colors.background, borderRadius: 12, padding: 12, marginBottom: 14, borderWidth: 1, borderColor: theme.colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Ready to Assign</Text>
              <Text style={{ color: '#16A34A', fontSize: 13, fontWeight: 'bold' }}>{formatCurrency(readyToAssign)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>{mode === 'add' ? 'Remaining RTA' : 'New RTA Balance'}</Text>
              <Text style={{ color: remainingRta < 0 ? '#DC2626' : '#16A34A', fontSize: 13, fontWeight: 'bold' }}>{formatCurrency(remainingRta)}</Text>
            </View>
          </View>

          {/* Amount Input */}
          <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: 6, textTransform: 'uppercase' }}>
            Amount to {mode === 'add' ? 'Add' : 'Reduce'}
          </Text>
          <AmountInput value={amount} onChangeText={setAmount} theme={theme} containerStyle={{ marginBottom: 18 }} />

          <TouchableOpacity disabled={isSaving} onPress={handleConfirm} style={{ backgroundColor: (isSaving) ? theme.colors.accent : (mode === 'add' ? theme.colors.primary : theme.colors.error), borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 16 }}>
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 }}>
                {mode === 'add' ? 'Add to Envelope' : 'Return to Ready to Assign'}
              </Text>
            )}
          </TouchableOpacity>

          {/* Assignment History Log */}
          {envelopeHistory.length > 0 ? (
            <View>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <MaterialIcons name="history" size={14} color={theme.colors.textSecondary} />
                <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.textSecondary, marginLeft: 4, textTransform: 'uppercase', letterSpacing: 0.5 }}>Assignment History</Text>
              </View>
              <ScrollView style={{ maxHeight: 160 }} showsVerticalScrollIndicator={false}>
                {envelopeHistory.map(function (h) {
                  var isAdd = h.expense_name && h.expense_name.includes('Added');
                  return (
                    <View key={h.id} style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingVertical: 7, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                        <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: isAdd ? '#D1FAE5' : '#FEE2E2', alignItems: 'center', justifyContent: 'center' }}>
                          <MaterialIcons name={isAdd ? 'arrow-downward' : 'arrow-upward'} size={14} color={isAdd ? '#059669' : '#DC2626'} />
                        </View>
                        <View>
                          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary }}>{isAdd ? 'Funds Added' : 'Funds Reduced'}</Text>
                          <Text style={{ fontSize: 11, color: theme.colors.textSecondary }}>{formatDate(h.date)}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 13, fontWeight: 'bold', color: isAdd ? '#059669' : '#DC2626' }}>
                        {isAdd ? '+' : '-'}{formatCurrency(parseFloat(h.amount) || 0)}
                      </Text>
                    </View>
                  );
                })}
              </ScrollView>
            </View>
          ) : null}
          <SaveSuccessOverlay visible={showSaveSuccess} theme={theme} message="Budget updated!" />
        </View>
      </View>
    </Modal>
  );
};
export {
  AssignMoneyModal,
  AddEnvelopeModal,
  SavingsManagerModal,
  NotificationCenterModal,
  AddAccountModal,
  EditAccountModal,
  EditEnvelopeModal,
  TransferEnvelopeModal,
  TransferWalletModal,
  EditSalaryModal,
  IncomeManagerModal,
  SpentManagerModal,
  QuickAddBudgetModal
};

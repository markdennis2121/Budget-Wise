import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, TextInput, Modal, Alert } from 'react-native';
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

const AssignMoneyModal = function ({ visible, onClose, readyToAssign, totalIncome, envelopes, userSettings, mutateUpdateSettings, mutateUpdateRecurring, mutateDeleteRecurring, recurringExpenses, onSaved }) {
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var insets = useSafeAreaInsets();
  var [amounts, setAmounts] = useState({});
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);

  useEffect(() => {
    if (visible) {
      setAmounts({});
      setShowSaveSuccess(false);
    }
  }, [visible]);

  var handleAssign = () => {
    // 1. Validate no negative final envelope assignments
    for (var i = 0; i < envelopes.length; i++) {
      var e = envelopes[i];
      var valStr = amounts[e.id];
      var addedAmt = valStr !== undefined && valStr !== '' && valStr !== '-' ? parseAmount(valStr) : 0;
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
      var val = valStr !== undefined && valStr !== '' && valStr !== '-' ? parseAmount(valStr) : 0;
      return s + val;
    }, 0);
    if (readyToAssign - totalInput < 0) {
      var overspendMsg = 'You cannot assign more money than you have available in Ready to Assign!';
      Platform.OS === 'web' ? window.alert(overspendMsg) : Alert.alert('Error', overspendMsg);
      return;
    }

    var newEnvelopes = envelopes.map(e => {
      var valStr = amounts[e.id];
      var addedAmt = valStr !== undefined && valStr !== '' && valStr !== '-' ? parseAmount(valStr) : 0;
      var finalAmt = (parseFloat(e.assigned) || 0) + addedAmt;
      return { id: e.id, name: e.name, assigned: finalAmt };
    });
    if (userSettings) {
      runSaveWithFeedback(
        mutateUpdateSettings({ id: userSettings.id, data: { envelopes: newEnvelopes } }),
        {
          onClose: onClose,
          onSaved: onSaved,
          setShowSuccess: setShowSaveSuccess,
          message: 'Money assigned!',
          errorMessage: 'Could not save assignments. Please try again.'
        }
      );
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
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)', marginTop: insets.top }}>
        <View style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: insets.bottom + 24, maxHeight: '90%', position: 'relative', overflow: 'hidden' }}>
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



          <TouchableOpacity onPress={handleAssign} disabled={remaining < 0} style={{ backgroundColor: remaining < 0 ? theme.colors.accent : theme.colors.primary, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 16 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>Save Assignments</Text>
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
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var insertHistory = useMutation('expense_history', 'insert');
  var mutateInsertHistory = insertHistory.mutate;

  useEffect(() => {
    if (visible) {
      setName('');
      setAssigned('');
      setShowSaveSuccess(false);
    }
  }, [visible]);

  var handleCreate = function () {
    if (!name.trim()) return;
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
        errorMessage: 'Could not create envelope. Please try again.'
      }).then(function () {
        setName('');
        setAssigned('');
      });
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }}>
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 16, padding: 24, position: 'relative', overflow: 'hidden' }}>
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

          <TouchableOpacity onPress={handleCreate} style={{ backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>Create Envelope</Text>
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

  useEffect(() => {
    if (visible) {
      setAmount('');
      setShowSaveSuccess(false);
    }
  }, [visible]);

  // Find the savings envelope
  var savingsEnv = state.envelopes.find(function (e) {
    return e.id === 'env-savings' || e.name.toLowerCase().includes('saving');
  });

  var currentSavings = savingsEnv ? (parseFloat(savingsEnv.assigned) || 0) : 0;
  var readyToAssign = state.readyToAssign;

  var handleAdd = function () {
    var val = parseAmount(amount);
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
      updatedEnvelopes = state.envelopes.map(function (e) {
        if (e.id === savingsEnv.id) {
          return { ...e, assigned: currentSavings + val };
        }
        return e;
      });
    }

    if (userSettings) {
      runSaveWithFeedback(
        mutateUpdateSettings({ id: userSettings.id, data: { envelopes: updatedEnvelopes } }),
        {
          onClose: onClose,
          onSaved: onSaved,
          setShowSuccess: setShowSaveSuccess,
          setSuccessMessage: setSuccessMessage,
          message: 'Saved to Savings!',
          errorMessage: 'Could not add to savings. Please try again.'
        }
      ).then(function () { setAmount(''); });
    }
  };

  var handleWithdraw = function () {
    var val = parseAmount(amount);
    if (val <= 0) return;
    if (!savingsEnv || val > currentSavings) {
      Platform.OS === 'web'
        ? window.alert('You cannot withdraw more than your current Savings!')
        : Alert.alert('Invalid Amount', 'You cannot withdraw more than your current Savings!');
      return;
    }

    var updatedEnvelopes = state.envelopes.map(function (e) {
      if (e.id === savingsEnv.id) {
        return { ...e, assigned: currentSavings - val };
      }
      return e;
    });

    if (userSettings) {
      runSaveWithFeedback(
        mutateUpdateSettings({ id: userSettings.id, data: { envelopes: updatedEnvelopes } }),
        {
          onClose: onClose,
          onSaved: onSaved,
          setShowSuccess: setShowSaveSuccess,
          setSuccessMessage: setSuccessMessage,
          message: 'Withdrawn!',
          errorMessage: 'Could not withdraw from savings. Please try again.'
        }
      ).then(function () { setAmount(''); });
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }}>
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 16, padding: 24, position: 'relative', overflow: 'hidden' }}>
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

          <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 8 }}>AMOUNT</Text>
          <AmountInput value={amount} onChangeText={setAmount} theme={theme} containerStyle={{ marginBottom: 20 }} />

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

const AddAccountModal = function ({ visible, onClose, accounts, userSettings, mutateUpdateSettings, onSaved, userId }) {
  var [name, setName] = useState('');
  var [type, setType] = useState('GCash');
  var [startingBalance, setStartingBalance] = useState('');
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);
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
    }
  }, [visible]);

  var handleCreate = function () {
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
      starting_balance: parseAmount(startingBalance),
      color: walletStyle.color
    };
    var newList = getStoredAccountsList(userSettings).concat([newAcc]);
    if (userSettings) {
      runSaveWithFeedback(
        mutateUpdateSettings({ id: userSettings.id, data: { accounts: newList, accounts_customized: true } }),
        { onClose: onClose, onSaved: onSaved, setShowSuccess: setShowSaveSuccess, errorMessage: 'Could not create wallet. Please try again.' }
      );
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }}>
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 16, padding: 24, position: 'relative', overflow: 'hidden' }}>
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
          <AmountInput value={startingBalance} onChangeText={setStartingBalance} theme={theme} containerStyle={{ marginBottom: 20 }} />

          <TouchableOpacity onPress={handleCreate} style={{ backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>Create Wallet / Account</Text>
          </TouchableOpacity>
          <SaveSuccessOverlay visible={showSaveSuccess} theme={theme} message="Saved!" />
        </View>
      </View>
    </Modal>
  );
};

const EditAccountModal = function ({ visible, onClose, account, accounts, userSettings, mutateUpdateSettings, onSaved, userId, userHistory }) {
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var [name, setName] = useState('');
  var [addAmount, setAddAmount] = useState('');
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);
  var [successMessage, setSuccessMessage] = useState('Saved!');
  var [editingTopUpId, setEditingTopUpId] = useState(null);
  var [editTopUpAmount, setEditTopUpAmount] = useState('');

  var insertHistory = useMutation('expense_history', 'insert');
  var mutateInsertHistory = insertHistory.mutate;
  var updateHistory = useMutation('expense_history', 'update');
  var mutateUpdateHistory = updateHistory.mutate;
  var deleteHistory = useMutation('expense_history', 'delete');
  var mutateDeleteHistory = deleteHistory.mutate;

  var curMonth = getCurrentMonthStr();
  var walletIncomeRows = useMemo(function () {
    if (!account) return [];
    return getWalletIncomeHistoryForAccount(userHistory, account.id, { curMonth: curMonth });
  }, [userHistory, account, curMonth]);

  useEffect(() => {
    if (visible && account) {
      setName(account.name);
      setAddAmount('');
      setEditingTopUpId(null);
      setEditTopUpAmount('');
      setShowSaveSuccess(false);
      setSuccessMessage('Saved!');
    }
  }, [visible, account]);

  var handleSave = () => {
    if (!name.trim()) return;
    var topUp = parseAmount(addAmount);

    var newList = getStoredAccountsList(userSettings).map(function (a) {
      if (a.id === account.id) {
        return {
          id: a.id,
          name: name.trim(),
          starting_balance: parseFloat(a.starting_balance) || 0,
          type: a.type || account.type || 'Custom',
          color: a.color || account.color || '#0F766E'
        };
      }
      return a;
    });

    if (userSettings) {
      var savePromise = mutateUpdateSettings({ id: userSettings.id, data: { accounts: newList, accounts_customized: true } }).then(function () {
        if (topUp > 0) {
          var today = new Date().toISOString().split('T')[0];
          return mutateInsertHistory({
            id: generateId(),
            user_id: userId,
            expense_name: 'Manual Top-up: ' + name.trim(),
            amount: topUp,
            date: today,
            expense_type: 'Income',
            category: 'Income',
            account_id: account.id,
            notes: 'Direct wallet balance top-up'
          });
        }
        return Promise.resolve();
      });
      runSaveWithFeedback(savePromise, {
        onClose: onClose,
        onSaved: onSaved,
        setShowSuccess: setShowSaveSuccess,
        setSuccessMessage: setSuccessMessage,
        message: 'Saved!',
        errorMessage: 'Could not save wallet changes. Please try again.'
      });
    }
  };

  var handleDelete = () => {
    var performDelete = () => {
      var newList = getStoredAccountsList(userSettings).filter(function (a) { return a.id !== account.id; });
      if (userSettings) {
        runSaveWithFeedback(
          mutateUpdateSettings({ id: userSettings.id, data: { accounts: newList, accounts_customized: true } }),
          {
            onClose: onClose,
            onSaved: onSaved,
            setShowSuccess: setShowSaveSuccess,
            setSuccessMessage: setSuccessMessage,
            message: 'Deleted!',
            errorMessage: 'Could not delete wallet. Please try again.'
          }
        );
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

  var handleStartEditTopUp = function (row) {
    setEditingTopUpId(row.id);
    setEditTopUpAmount(formatAmountForEdit(row.amount));
  };

  var handleSaveTopUpEdit = function (row) {
    var amt = parseAmount(editTopUpAmount);
    if (isNaN(amt) || amt <= 0) {
      Platform.OS === 'web' ? window.alert('Enter a valid amount greater than zero.') : Alert.alert('Invalid amount', 'Enter a valid amount greater than zero.');
      return;
    }
    var label = isManualWalletTopUp(row) ? ('Manual Top-up: ' + name.trim()) : row.expense_name;
    runSaveWithFeedback(
      mutateUpdateHistory({ id: row.id, data: { amount: amt, expense_name: label } }),
      {
        onSaved: onSaved,
        setShowSuccess: setShowSaveSuccess,
        setSuccessMessage: setSuccessMessage,
        message: 'Top-up updated!',
        errorMessage: 'Could not update top-up. Please try again.'
      }
    ).then(function () {
      setEditingTopUpId(null);
      setEditTopUpAmount('');
    });
  };

  var handleDeleteTopUp = function (row) {
    var amt = formatCurrency(parseFloat(row.amount) || 0);
    var msg = 'Remove this ' + amt + ' addition? Your wallet balance will go down by that amount.';
    var doDelete = function () {
      runSaveWithFeedback(mutateDeleteHistory({ id: row.id }), {
        onSaved: onSaved,
        setShowSuccess: setShowSaveSuccess,
        setSuccessMessage: setSuccessMessage,
        message: 'Top-up removed!',
        errorMessage: 'Could not remove top-up. Please try again.'
      });
    };
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) doDelete();
    } else {
      Alert.alert('Remove top-up?', msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Remove', style: 'destructive', onPress: doDelete }
      ]);
    }
  };

  if (!visible || !account) return null;

  var topUp = parseFloat(addAmount) || 0;
  var liveBal = parseFloat(account.balance);
  if (isNaN(liveBal)) liveBal = parseFloat(account.starting_balance) || 0;
  var previewBal = liveBal + topUp;

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }}>
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 16, padding: 24, maxHeight: '90%', position: 'relative', overflow: 'hidden' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.colors.textPrimary }}>Edit Wallet / Account</Text>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={24} color={theme.colors.textSecondary} /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
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
            <Text style={{ fontSize: 10, color: theme.colors.textSecondary, marginTop: 4 }}>Live total from this month's income, spending, and transfers.</Text>
          </View>

          {walletIncomeRows.length > 0 ? (
            <View style={{ marginBottom: 16 }}>
              <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: 6, textTransform: 'uppercase' }}>This month's additions</Text>
              <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 10 }}>Tap edit to fix a wrong top-up or income amount. Balance updates automatically.</Text>
              {walletIncomeRows.map(function (row) {
                var isEditing = editingTopUpId === row.id;
                var rowLabel = isManualWalletTopUp(row) ? 'Direct top-up' : (row.expense_name || 'Income');
                return (
                  <View key={row.id} style={{ backgroundColor: theme.colors.background, borderRadius: 10, padding: 12, marginBottom: 8, borderWidth: 1, borderColor: theme.colors.border }}>
                    {isEditing ? (
                      <View>
                        <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 6 }}>{rowLabel} • {formatDate(row.date)}</Text>
                        <AmountInput value={editTopUpAmount} onChangeText={setEditTopUpAmount} theme={theme} containerStyle={{ marginBottom: 8 }} />
                        <View style={{ flexDirection: 'row', gap: 8 }}>
                          <TouchableOpacity onPress={function () { handleSaveTopUpEdit(row); }} style={{ flex: 1, backgroundColor: theme.colors.primary, borderRadius: 8, paddingVertical: 10, alignItems: 'center' }}>
                            <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 }}>Save</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={function () { setEditingTopUpId(null); }} style={{ paddingHorizontal: 14, justifyContent: 'center', backgroundColor: theme.colors.border, borderRadius: 8 }}>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: 13 }}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary }}>{rowLabel}</Text>
                          <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginTop: 2 }}>{formatDate(row.date)}</Text>
                        </View>
                        <Text style={{ fontSize: 15, fontWeight: 'bold', color: theme.colors.primary, marginRight: 10 }}>+{formatCurrency(parseFloat(row.amount) || 0)}</Text>
                        <TouchableOpacity onPress={function () { handleStartEditTopUp(row); }} style={{ padding: 6, backgroundColor: '#FFEDD5', borderRadius: 6, marginRight: 6 }}>
                          <MaterialIcons name="edit" size={16} color={theme.colors.primary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={function () { handleDeleteTopUp(row); }} style={{ padding: 6, backgroundColor: '#FEF2F2', borderRadius: 6 }}>
                          <MaterialIcons name="delete-outline" size={16} color={theme.colors.error} />
                        </TouchableOpacity>
                      </View>
                    )}
                  </View>
                );
              })}
            </View>
          ) : null}

          <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: 6, textTransform: 'uppercase' }}>Add Funds to This Wallet</Text>
          <Text style={{ fontSize: 11, color: theme.colors.textSecondary, marginBottom: 8 }}>Enter the amount you want to add on top of the current balance. Leave blank if you're only renaming.</Text>
          <AmountInput value={addAmount} onChangeText={setAddAmount} theme={theme} containerStyle={{ marginBottom: topUp > 0 ? 10 : 20 }} />

          {topUp > 0 ? (
            <View style={{ backgroundColor: '#D1FAE5', borderRadius: 8, padding: 10, marginBottom: 16, flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ fontSize: 13, color: '#065F46', fontWeight: '600' }}>Balance after top-up:</Text>
              <Text style={{ fontSize: 13, color: '#065F46', fontWeight: 'bold' }}>{formatCurrency(previewBal)}</Text>
            </View>
          ) : null}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
            <TouchableOpacity onPress={handleDelete} style={{ flex: 1, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: theme.colors.error, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: theme.colors.error, fontSize: 15, fontWeight: 'bold' }}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={{ flex: 2, backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' }}>Save Changes</Text>
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

  useEffect(() => {
    if (visible && envelope) {
      setName(envelope.name);
      setGoalAmount(envelope.goal_amount ? String(envelope.goal_amount) : '');
      setGoalDate(envelope.goal_date || '');
      setShowSaveSuccess(false);
      setSuccessMessage('Saved!');
    }
  }, [visible, envelope]);

  var handleSave = () => {
    if (!name.trim()) return;
    var newGoalAmt = parseAmount(goalAmount);
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
          goal_amount: newGoalAmt > 0 ? newGoalAmt : null,
          goal_date: newGoalDate || null
        };
      }
      return e;
    });

    if (userSettings) {
      runSaveWithFeedback(
        mutateUpdateSettings({ id: userSettings.id, data: { envelopes: newList } }),
        {
          onClose: onClose,
          onSaved: onSaved,
          setShowSuccess: setShowSaveSuccess,
          setSuccessMessage: setSuccessMessage,
          message: 'Saved!',
          errorMessage: 'Could not save envelope. Please try again.'
        }
      );
    }
  };

  var handleDelete = () => {
    if (!envelope) return;
    promptDeleteEnvelope({
      envelopeId: envelope.id,
      envelopes: envelopes,
      recurringExpenses: recurringExpenses,
      onPerformDelete: function () {
        if (!userSettings) return;
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
            errorMessage: 'Could not delete envelope. Please try again.'
          }
        );
      }
    });
  };

  if (!visible || !envelope) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }}>
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 16, padding: 24, position: 'relative', overflow: 'hidden' }}>
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
            <TouchableOpacity onPress={handleDelete} style={{ flex: 1, backgroundColor: '#FEF2F2', borderWidth: 1, borderColor: theme.colors.error, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: theme.colors.error, fontSize: 15, fontWeight: 'bold' }}>Delete</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={{ flex: 2, backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
              <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' }}>Save Changes</Text>
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

  var insertHistory = useMutation('expense_history', 'insert');
  var mutateHistory = insertHistory.mutate;

  useEffect(() => {
    if (visible) {
      setErrorMsg('');
      setAmount('');
      setShowSaveSuccess(false);
      if (envelopes && envelopes.length > 0) {
        setSourceId(envelopes[0].id);
        setDestId(envelopes[1] ? envelopes[1].id : envelopes[0].id);
      }
    }
  }, [visible, envelopes]);

  var handleTransfer = () => {
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
      var transferPromise = mutateUpdateSettings({ id: userSettings.id, data: { envelopes: newList } }).then(function () {
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
      });
      runSaveWithFeedback(transferPromise, {
        onClose: onClose,
        onSaved: onSaved,
        setShowSuccess: setShowSaveSuccess,
        message: 'Transferred!',
        errorMessage: 'Transfer failed. Please try again.',
        onError: function () { setErrorMsg('Transfer failed. Please try again.'); }
      });
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', padding: 20 }}>
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 16, padding: 24, position: 'relative', overflow: 'hidden' }}>
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

          <TouchableOpacity onPress={handleTransfer} style={{ backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
            <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' }}>Complete Transfer</Text>
          </TouchableOpacity>
          <SaveSuccessOverlay visible={showSaveSuccess} theme={theme} message="Transferred!" />
        </View>
      </View>
    </Modal>
  );
};

const EditSalaryModal = function ({ visible, onClose, incomeSources, userSettings, mutateUpdateSettings }) {
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var insets = useSafeAreaInsets();
  var mainSalarySrc = incomeSources.find(s => s.id === 'main-salary') || { id: 'main-salary', name: 'Main Salary', amount: 0 };
  var [salary, setSalary] = useState(String(mainSalarySrc.amount || ''));
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);

  var handleSave = () => {
    var newAmt = parseAmount(salary);
    var newSources = incomeSources.map(s => s.id === 'main-salary' ? { ...s, amount: newAmt } : s);
    if (!incomeSources.find(s => s.id === 'main-salary')) {
      newSources.unshift({ id: 'main-salary', name: 'Main Salary', amount: newAmt });
    }
    if (userSettings) {
      runSaveWithFeedback(
        mutateUpdateSettings({ id: userSettings.id, data: { income_sources: newSources, monthly_salary: newAmt } }),
        {
          onClose: onClose,
          setShowSuccess: setShowSaveSuccess,
          message: 'Salary saved!',
          errorMessage: 'Could not save salary. Please try again.'
        }
      );
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
            <TouchableOpacity onPress={onClose} style={{ padding: 12 }}><Text style={{ color: theme.colors.textSecondary, fontWeight: '600', fontSize: 15 }}>Cancel</Text></TouchableOpacity>
            <TouchableOpacity onPress={handleSave} style={{ backgroundColor: theme.colors.primary, borderRadius: 8, paddingHorizontal: 20, paddingVertical: 12 }}><Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 }}>Save</Text></TouchableOpacity>
          </View>
          <SaveSuccessOverlay visible={showSaveSuccess} theme={theme} message="Salary saved!" />
        </View>
      </View>
    </Modal>
  );
};

const IncomeManagerModal = function ({ visible, onClose, incomeSources, accounts = [], userSettings, theme, insetsTop, insetsBottom, onSaved }) {
  var [newSourceName, setNewSourceName] = useState('');
  var [newSourceAmount, setNewSourceAmount] = useState('');
  var [newSourceAccount, setNewSourceAccount] = useState('');
  var [editingSourceId, setEditingSourceId] = useState(null);
  var [editName, setEditName] = useState('');
  var [editAmount, setEditAmount] = useState('');
  var [editAccount, setEditAccount] = useState('');
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);
  var [successMessage, setSuccessMessage] = useState('Saved!');
  var [isAdding, setIsAdding] = useState(false);

  var updateSettings = useMutation('user_settings', 'update');
  var mutateUpdate = updateSettings.mutate;

  useEffect(() => {
    if (visible) {
      setNewSourceAccount(accounts[0] ? accounts[0].id : 'unlinked');
      setShowSaveSuccess(false);
      setSuccessMessage('Saved!');
      setEditingSourceId(null);
    }
  }, [visible]);

  var handleAddSource = function () {
    if (!newSourceName.trim()) {
      Platform.OS === 'web' ? window.alert('Please enter source name.') : Alert.alert('Error', 'Please enter source name.');
      return;
    }
    var amt = parseAmount(newSourceAmount);
    if (isNaN(amt) || amt < 0) {
      Platform.OS === 'web' ? window.alert('Please enter a valid monthly amount.') : Alert.alert('Error', 'Please enter a valid monthly amount.');
      return;
    }
    // Use the first account as fallback if nothing selected
    var linkedAccount = newSourceAccount && newSourceAccount !== 'unlinked' ? newSourceAccount : (accounts[0] ? accounts[0].id : 'unlinked');
    var newSrc = {
      id: 'src-' + generateId(),
      name: newSourceName.trim(),
      amount: amt,
      account_id: linkedAccount
    };
    var newList = incomeSources.concat(newSrc);

    if (userSettings) {
      runSaveWithFeedback(
        mutateUpdate({ id: userSettings.id, data: { income_sources: newList } }),
        {
          onClose: onClose,
          onSaved: onSaved,
          setShowSuccess: setShowSaveSuccess,
          setSuccessMessage: setSuccessMessage,
          message: 'Income added!',
          errorMessage: 'Could not add income source. Please try again.'
        }
      ).then(function () {
        setNewSourceName('');
        setNewSourceAmount('');
        setNewSourceAccount(accounts[0] ? accounts[0].id : 'unlinked');
        setIsAdding(false);
      });
    }
  };

  var handleDeleteSource = function (id) {
    if (incomeSources.length <= 1) {
      Platform.OS === 'web' ? window.alert('You must have at least one income source.') : Alert.alert('Error', 'You must have at least one income source.');
      return;
    }
    var newList = incomeSources.filter(function (src) { return src.id !== id; });
    if (userSettings) {
      runSaveWithFeedback(
        mutateUpdate({ id: userSettings.id, data: { income_sources: newList, monthly_salary: newList[0] ? newList[0].amount : 0 } }),
        {
          onSaved: onSaved,
          setShowSuccess: setShowSaveSuccess,
          setSuccessMessage: setSuccessMessage,
          message: 'Deleted!',
          errorMessage: 'Could not delete income source. Please try again.'
        }
      );
    }
  };

  var handleStartEdit = function (src) {
    setEditingSourceId(src.id);
    setEditName(src.name);
    setEditAmount(formatAmountForEdit(src.amount));
    setEditAccount(src.account_id || (accounts[0] ? accounts[0].id : ''));
  };

  var handleSaveEdit = function (id) {
    var amt = parseAmount(editAmount);
    if (!editName.trim()) {
      Platform.OS === 'web' ? window.alert('Please enter a name.') : Alert.alert('Error', 'Please enter a name.');
      return;
    }
    if (amt < 0) {
      Platform.OS === 'web' ? window.alert('Please enter a valid amount.') : Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }
    var newList = incomeSources.map(function (src) {
      return src.id === id ? { ...src, name: editName.trim(), amount: amt, account_id: editAccount } : src;
    });
    if (userSettings) {
      runSaveWithFeedback(
        mutateUpdate({ id: userSettings.id, data: { income_sources: newList, monthly_salary: newList[0] ? newList[0].amount : 0 } }),
        {
          onSaved: onSaved,
          setShowSuccess: setShowSaveSuccess,
          setSuccessMessage: setSuccessMessage,
          message: 'Income saved!',
          errorMessage: 'Could not save income changes. Please try again.'
        }
      ).then(function () {
        setEditingSourceId(null);
        setEditName('');
        setEditAmount('');
        setEditAccount('');
      });
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)', marginTop: insetsTop }}>
        <View style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: insetsBottom + 24, maxHeight: '85%', position: 'relative', overflow: 'hidden' }}>

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.textPrimary }}>My Income Sources</Text>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={24} color={theme.colors.textSecondary} /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0, maxHeight: 400 }}>
            {incomeSources.map(function (src) {
              var isEditing = editingSourceId === src.id;
              var isLinked = src.account_id && src.account_id !== 'unlinked';
              var acc = isLinked ? accounts.find(a => a.id === src.account_id) : null;
              var accName = acc ? acc.name : 'Physical Cash (Unlinked)';

              return (
                <View key={src.id} style={{ padding: 16, backgroundColor: theme.colors.background, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 12 }}>
                  {isEditing ? (
                    <View>
                      <TextInput
                        value={editName}
                        onChangeText={setEditName}
                        placeholder="Source name"
                        style={{ backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, fontSize: 15, color: theme.colors.textPrimary, marginBottom: 10 }}
                      />

                      <AmountInput
                        value={editAmount}
                        onChangeText={setEditAmount}
                        theme={theme}
                        variant="boxed"
                        fontSize={16}
                        containerStyle={{ marginBottom: 10 }}
                        placeholder="0.00"
                      />

                      <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 8, letterSpacing: 0.5 }}>LINKED WALLET</Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                        {accounts.map(a => {
                          var isSel = editAccount === a.id;
                          var styleInfo = WALLET_STYLES[a.type] || WALLET_STYLES.Custom;
                          var brandColor = a.color || styleInfo.color;
                          return (
                            <TouchableOpacity key={a.id} onPress={() => setEditAccount(a.id)} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: isSel ? theme.colors.primary : theme.colors.card, borderWidth: 1, borderColor: isSel ? theme.colors.primary : theme.colors.border }}>
                              <BrandLogo type={a.type} size={16} style={{ marginRight: 6 }} />
                              <Text style={{ color: isSel ? '#FFFFFF' : brandColor, fontSize: 13, fontWeight: '600' }}>{a.name}</Text>
                            </TouchableOpacity>
                          );
                        })}

                      </ScrollView>

                      <View style={{ flexDirection: 'row', gap: 10 }}>
                        <TouchableOpacity onPress={function () { handleSaveEdit(src.id); }} style={{ flex: 1, backgroundColor: theme.colors.primary, borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}>
                          <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 }}>Save Changes</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={function () { setEditingSourceId(null); }} style={{ flex: 1, backgroundColor: theme.colors.border, borderRadius: 10, paddingVertical: 12, alignItems: 'center' }}>
                          <Text style={{ color: theme.colors.textSecondary, fontWeight: 'bold', fontSize: 14 }}>Cancel</Text>
                        </TouchableOpacity>
                      </View>
                    </View>
                  ) : (
                    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                      <View style={{ flex: 1 }}>
                        <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.textPrimary, marginBottom: 4 }}>{src.name}</Text>
                        <Text style={{ fontSize: 18, fontWeight: '900', color: theme.colors.primary, marginBottom: 8 }}>{formatCurrency(src.amount)}</Text>

                        <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                          <View style={{ backgroundColor: theme.isDark ? '#374151' : '#F3F4F6', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, flexDirection: 'row', alignItems: 'center' }}>
                            <MaterialIcons name="account-balance-wallet" size={14} color={theme.colors.textSecondary} style={{ marginRight: 4 }} />
                            {acc ? (
                              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                                <BrandLogo type={acc.type} size={12} style={{ marginRight: 4 }} />
                                <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.textPrimary }}>{accName}</Text>
                              </View>
                            ) : (
                              <Text style={{ fontSize: 12, fontWeight: '600', color: theme.colors.textSecondary }}>{accName}</Text>
                            )}
                          </View>
                        </View>
                      </View>
                      <View style={{ flexDirection: 'row', gap: 8, paddingLeft: 12 }}>
                        <TouchableOpacity onPress={function () { handleStartEdit(src); }} style={{ width: 36, height: 36, backgroundColor: 'rgba(16, 185, 129, 0.1)', borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                          <MaterialIcons name="edit" size={18} color={theme.colors.primary} />
                        </TouchableOpacity>
                        {incomeSources.length > 1 && (
                          <TouchableOpacity onPress={function () { handleDeleteSource(src.id); }} style={{ width: 36, height: 36, backgroundColor: 'rgba(239, 68, 68, 0.1)', borderRadius: 18, alignItems: 'center', justifyContent: 'center' }}>
                            <MaterialIcons name="delete-outline" size={18} color={theme.colors.error} />
                          </TouchableOpacity>
                        )}
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            <View style={{ marginTop: 8, backgroundColor: theme.colors.background, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3 }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.textPrimary }}>Add New Income Source</Text>
              </View>
              
              <TextInput
                value={newSourceName}
                onChangeText={setNewSourceName}
                placeholder="e.g. Salary, Side Gigs, Freelance"
                placeholderTextColor={theme.isDark ? '#6B7280' : '#9CA3AF'}
                style={{ backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, paddingHorizontal: 14, paddingVertical: 12, fontSize: 15, color: theme.colors.textPrimary, marginBottom: 12 }}
              />

              <AmountInput
                value={newSourceAmount}
                onChangeText={setNewSourceAmount}
                theme={theme}
                variant="boxed"
                fontSize={15}
                containerStyle={{ marginBottom: 16 }}
                placeholder="0.00 (Monthly Amount)"
              />

              <Text style={{ fontSize: 12, fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 8, letterSpacing: 0.5 }}>LINK TO WALLET (OPTIONAL)</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
                {accounts.map(a => {
                  var isSel = newSourceAccount === a.id;
                  var styleInfo = WALLET_STYLES[a.type] || WALLET_STYLES.Custom;
                  var brandColor = a.color || styleInfo.color;
                  return (
                    <TouchableOpacity key={a.id} onPress={() => setNewSourceAccount(a.id)} style={{ flexDirection: 'row', alignItems: 'center', marginRight: 8, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, backgroundColor: isSel ? theme.colors.primary : theme.colors.card, borderWidth: 1, borderColor: isSel ? theme.colors.primary : theme.colors.border }}>
                      <BrandLogo type={a.type} size={16} style={{ marginRight: 6 }} />
                      <Text style={{ color: isSel ? '#FFFFFF' : brandColor, fontSize: 13, fontWeight: '600' }}>{a.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>

              <TouchableOpacity onPress={handleAddSource} style={{ backgroundColor: theme.colors.primary, borderRadius: 10, paddingVertical: 14, alignItems: 'center' }}>
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 }}>Save New Source</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <SaveSuccessOverlay visible={showSaveSuccess} theme={theme} message={successMessage} />

        </View>
      </View>
    </Modal>
  );
};

const SpentManagerModal = function ({ visible, onClose, filter, oneTimeExpenses, envelopes, userId, theme, insetsTop, insetsBottom, onSaved, userHistory, recurringExpenses }) {
  var [editingId, setEditingId] = useState(null);
  var [editName, setEditName] = useState('');
  var [editAmount, setEditAmount] = useState('');
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);
  var [successMessage, setSuccessMessage] = useState('Saved!');

  useEffect(() => {
    if (!visible) {
      setEditingId(null);
      setEditName('');
      setEditAmount('');
      setShowSaveSuccess(false);
      setSuccessMessage('Saved!');
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
      return { id: o.id, name: o.name, amount: parseFloat(o.amount) || 0, category: o.category, date: o.date, type: 'One-Time' };
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
          name: h.expense_name,
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
    var amt = parseAmount(editAmount);
    if (!editName.trim()) {
      Platform.OS === 'web' ? window.alert('Please enter a name.') : Alert.alert('Error', 'Please enter a name.');
      return;
    }
    if (amt <= 0) {
      Platform.OS === 'web' ? window.alert('Please enter a valid amount.') : Alert.alert('Error', 'Please enter a valid amount.');
      return;
    }

    // Check if envelope has enough funds if edited amount is larger
    var env = envelopes.find(function (e) { return e.id === exp.category; });
    var oldAmt = parseFloat(exp.amount) || 0;
    var diff = amt - oldAmt;
    if (env && env.available < diff) {
      var err = 'Insufficient funds in envelope ' + env.name + '. Available: ' + env.available;
      Platform.OS === 'web' ? window.alert(err) : Alert.alert('Error', err);
      return;
    }

    var savePromise;
    if (exp.type === 'One-Time') {
      savePromise = mutateUpdateOneTime({ id: exp.id, data: { name: editName.trim(), amount: amt } }).then(function () {
        return mutateUpdateHistory({ id: exp.id, data: { expense_name: editName.trim(), amount: amt } });
      });
    } else {
      savePromise = mutateUpdateHistory({ id: exp.id, data: { expense_name: editName.trim(), amount: amt } });
    }

    runSaveWithFeedback(savePromise, {
      onSaved: onSaved,
      setShowSuccess: setShowSaveSuccess,
      setSuccessMessage: setSuccessMessage,
      message: 'Expense updated!',
      errorMessage: 'Could not update expense. Please try again.'
    }).then(function () {
      setEditingId(null);
    });
  };

  var handleDelete = function (exp) {
    var msg = 'Delete this expense? The amount (' + formatCurrency(exp.amount) + ') will be returned to your envelope balance.';
    var doDelete = function () {
      var deletePromise;
      if (exp.type === 'One-Time') {
        deletePromise = mutateDeleteOneTime({ id: exp.id }).then(function () {
          return mutateDeleteHistory({ id: exp.id });
        });
      } else if (exp.type === 'Recurring') {
        deletePromise = mutateDeleteHistory({ id: exp.id }).then(function () {
          if (exp.originalBillId) {
            return mutateUpdateRecurring({ id: exp.originalBillId, data: { status: 'Pending' } });
          }
        });
      } else {
        return;
      }
      runSaveWithFeedback(deletePromise, {
        onSaved: onSaved,
        setShowSuccess: setShowSaveSuccess,
        setSuccessMessage: setSuccessMessage,
        message: 'Deleted!',
        errorMessage: 'Could not delete expense. Please try again.'
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

  var filterEnv = envelopes.find(function (e) { return e.id === filter; });
  var title = filterEnv ? filterEnv.name + ' Spending' : "This Month's Spending";

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)', marginTop: insetsTop }}>
        <View style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: insetsBottom + 24, maxHeight: '85%', position: 'relative', overflow: 'hidden' }}>

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
        onError: function () { setErrorMsg('Failed to update budget. Try again.'); }
      }).then(function () {
        setAmount('');
        setErrorMsg('');
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

          <TouchableOpacity onPress={handleConfirm} style={{ backgroundColor: mode === 'add' ? theme.colors.primary : theme.colors.error, borderRadius: 12, paddingVertical: 12, alignItems: 'center', marginBottom: 16 }}>
            <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 }}>
              {mode === 'add' ? 'Add to Envelope' : 'Return to Ready to Assign'}
            </Text>
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
  EditSalaryModal,
  IncomeManagerModal,
  SpentManagerModal,
  QuickAddBudgetModal
};

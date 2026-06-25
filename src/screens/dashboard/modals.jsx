import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Platform, TextInput, Modal, Alert, ActivityIndicator, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'platform-hooks';
import { useTheme } from '../../contexts/ThemeContext';
import SaveSuccessOverlay from '../../components/SaveSuccessOverlay';
import AmountInput from '../../components/AmountInput';
import DatePickerInput from '../../components/DatePickerInput';
import BrandLogo from '../../components/BrandLogo';
import { runSaveWithFeedback } from '../../utils/saveSuccess';
import { triggerImpactHaptic } from '../../utils/feedback';
import { deleteEnvelopeAndCleanup, isEnvelopeArchived } from '../../utils/envelopeBudget';
import { promptDeleteEnvelope, getEnvelopeIcon } from './envelopeUtils';
import { formatCurrency, formatDate, generateId, getTodayStr, getCurrentMonthStr, getMonthStr, isWithin5Days, isOverdue, parseAmount } from '../../utils/helpers';
import { formatAmountForEdit } from '../../utils/amountFormat';
import { WALLET_STYLES } from './constants';
import { getStoredAccountsList, serializeAccountsForStorage } from '../../utils/accountBalances';
import { getWalletIncomeHistoryForAccount, isManualWalletTopUp } from '../../utils/walletIncomeHistory';
import { parseUserEnvelopes, validateSpendOperation } from '../../utils/envelopeGuards';
import { scale, verticalScale, moderateScale, normalize } from '../../utils/responsive';
import {
  computeBudgetCommitments,
  validateIncomeSourceAmountEdit,
  validateIncomeSourceDelete,
  validateIncomeTransactionEdit,
  validateIncomeTransactionDelete
} from '../../utils/incomeSourceGuards';

const AssignMoneyModal = function ({ visible, onClose, readyToAssign, totalIncome, envelopes, userSettings, mutateUpdateSettings, mutateUpdateRecurring, mutateDeleteRecurring, recurringExpenses, onSaved }) {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 1024;

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
    for (var i = 0; i < envelopes.length; i++) {
      var e = envelopes[i];
      var valStr = amounts[e.id];
      var addedAmt = valStr !== undefined && valStr !== '' && valStr !== '-' ? parseAmount(valStr) : 0;
      var finalAmt = (parseFloat(e.assigned) || 0) + addedAmt;
      if (finalAmt < 0) {
        var msg = `Cannot reduce "${e.name}" envelope below ₱0.00! Current assigned: ${formatCurrency(e.assigned)}`;
        return Alert.alert('Error', msg);
      }
    }

    var totalInput = envelopes.reduce((s, env) => {
      var valStr = amounts[env.id];
      var val = valStr !== undefined && valStr !== '' && valStr !== '-' ? parseAmount(valStr) : 0;
      return s + val;
    }, 0);
    if (readyToAssign - totalInput < 0) {
      return Alert.alert('Error', 'Not enough Ready to Assign money!');
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
          errorMessage: 'Could not save assignments.',
          onError: () => setIsSaving(false)
        }
      ).then(() => setIsSaving(false));
    }
  };

  var totalInput = envelopes.reduce((s, env) => {
    var valStr = amounts[env.id];
    var val = valStr !== undefined && valStr !== '' && valStr !== '-' ? parseAmount(valStr) : 0;
    return s + val;
  }, 0);
  var remaining = readyToAssign - totalInput;

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{
        flex: 1,
        justifyContent: isDesktopWeb ? 'center' : 'flex-end',
        alignItems: isDesktopWeb ? 'center' : 'stretch',
        backgroundColor: 'rgba(0,0,0,0.5)'
      }}>
        <View style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: scale(28),
          borderTopRightRadius: scale(28),
          borderBottomLeftRadius: isDesktopWeb ? scale(28) : 0,
          borderBottomRightRadius: isDesktopWeb ? scale(28) : 0,
          paddingHorizontal: moderateScale(24),
          paddingTop: moderateScale(10),
          paddingBottom: insets.bottom + moderateScale(40),
          maxHeight: isDesktopWeb ? '85%' : '92%',
          width: isDesktopWeb ? 600 : '100%',
          position: 'relative',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: isDesktopWeb ? 10 : -4 },
          shadowOpacity: isDesktopWeb ? 0.25 : 0.1,
          shadowRadius: 15,
          elevation: 20
        }}>
          <View style={{ width: scale(40), height: scale(5), backgroundColor: theme.colors.border, borderRadius: scale(3), alignSelf: 'center', marginBottom: moderateScale(15), opacity: 0.8 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(16) }}>
            <Text style={{ fontSize: normalize(18), fontWeight: 'bold', color: theme.colors.textPrimary }}>Assign Money</Text>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={scale(24)} color={theme.colors.textSecondary} /></TouchableOpacity>
          </View>

          <View style={{ backgroundColor: theme.colors.background, borderRadius: scale(16), padding: moderateScale(16), marginBottom: moderateScale(20), borderWidth: 1, borderColor: theme.colors.border }}>
            <Text style={{ fontSize: normalize(11), color: theme.colors.textSecondary, fontWeight: '800', marginBottom: 4, letterSpacing: 0.5 }}>READY TO ASSIGN</Text>
            <Text style={{ fontSize: normalize(24), fontWeight: 'bold', color: remaining < 0 ? theme.colors.error : theme.colors.primary }}>{formatCurrency(remaining)}</Text>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0, maxHeight: scale(350) }}>
            {envelopes.map(env => (
              <View key={env.id} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: moderateScale(14), paddingBottom: moderateScale(14), borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: normalize(15), fontWeight: '600', color: theme.colors.textPrimary }}>{env.name}</Text>
                  <Text style={{ fontSize: normalize(12), color: theme.colors.textSecondary }}>Currently: {formatCurrency(env.assigned)}</Text>
                </View>
                <View style={{ width: scale(100) }}>
                  <AmountInput
                    value={amounts[env.id] || ''}
                    onChangeText={(val) => setAmounts({ ...amounts, [env.id]: val })}
                    theme={theme}
                    variant="boxed"
                    fontSize={normalize(14)}
                    placeholder="+ 0.00"
                  />
                </View>
              </View>
            ))}
          </ScrollView>

          <TouchableOpacity onPress={handleAssign} disabled={remaining < 0 || isSaving} style={{ backgroundColor: (remaining < 0 || isSaving) ? theme.colors.accent : theme.colors.primary, borderRadius: scale(12), padding: moderateScale(16), alignItems: 'center', marginTop: moderateScale(16) }}>
            {isSaving ? (
              <ActivityIndicator color="#FFFFFF" size="small" />
            ) : (
              <Text style={{ color: '#FFFFFF', fontSize: normalize(16), fontWeight: 'bold' }}>Save Assignments</Text>
            )}
          </TouchableOpacity>
          <SaveSuccessOverlay visible={showSaveSuccess} theme={theme} message="Money assigned!" />
        </View>
      </View>
    </Modal>
  );
};

const AddEnvelopeModal = function ({ visible, onClose, envelopes, readyToAssign, userSettings, mutateUpdateSettings, onSaved, userId }) {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 1024;

  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var insets = useSafeAreaInsets();
  var [name, setName] = useState('');
  var [assigned, setAssigned] = useState('');
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);
  var [isSaving, setIsSaving] = useState(false);
  var [showArchive, setShowArchive] = useState(false);
  var [selectedRestoreEnv, setSelectedRestoreEnv] = useState(null);
  var insertHistory = useMutation('expense_history', 'insert');
  var mutateInsertHistory = insertHistory.mutate;

  useEffect(() => {
    if (visible) {
      setName('');
      setAssigned('');
      setShowSaveSuccess(false);
      setIsSaving(false);
      setShowArchive(false);
      setSelectedRestoreEnv(null);
    }
  }, [visible]);

  var archivedEnvelopesList = useMemo(() => {
    return (envelopes || []).filter(isEnvelopeArchived);
  }, [envelopes]);

  var handleRestore = function (env) {
    if (isSaving) return;
    var activeEnvs = (envelopes || []).filter(e => !isEnvelopeArchived(e));
    if (activeEnvs.find(e => e.name.toLowerCase() === env.name.trim().toLowerCase())) {
      return Alert.alert('Error', 'An active envelope with the name "' + env.name + '" already exists. Please rename or delete the active one before restoring this.');
    }
    var newList = envelopes.map(e => {
      if (e.id === env.id) {
        return { ...e, isArchived: false, archived: false, is_archived: false };
      }
      return e;
    });
    if (userSettings) {
      setIsSaving(true);
      var savePromise = mutateUpdateSettings({ id: userSettings.id, data: { envelopes: newList } });
      runSaveWithFeedback(savePromise, {
        onClose: onClose,
        onSaved: onSaved,
        setShowSuccess: setShowSaveSuccess,
        message: 'Envelope Restored!',
        errorMessage: 'Could not restore.',
        onError: () => setIsSaving(false)
      }).then(() => setIsSaving(false));
    }
  };

  var handleCreate = function () {
    if (isSaving || !name.trim()) return;
    var activeEnvs = (envelopes || []).filter(e => !isEnvelopeArchived(e));
    if (activeEnvs.find(e => e.name.toLowerCase() === name.trim().toLowerCase())) {
      return Alert.alert('Error', 'Envelope already exists!');
    }
    var assignedAmt = parseAmount(assigned);
    if (assignedAmt > readyToAssign) {
      return Alert.alert('Error', 'Not enough Ready to Assign money!');
    }

    var newId = 'env-' + generateId();
    var newEnv = { id: newId, name: name.trim(), assigned: assignedAmt, archived: false };
    var newList = (envelopes || []).concat(newEnv);
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
        errorMessage: 'Could not create envelope.',
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
      <View style={{
        flex: 1,
        justifyContent: isDesktopWeb ? 'center' : 'flex-end',
        alignItems: isDesktopWeb ? 'center' : 'stretch',
        backgroundColor: 'rgba(0,0,0,0.5)'
      }}>
        <View style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: scale(28),
          borderTopRightRadius: scale(28),
          borderBottomLeftRadius: isDesktopWeb ? scale(28) : 0,
          borderBottomRightRadius: isDesktopWeb ? scale(28) : 0,
          paddingHorizontal: moderateScale(24),
          paddingTop: moderateScale(10),
          paddingBottom: insets.bottom + moderateScale(40),
          maxHeight: isDesktopWeb ? '85%' : '92%',
          width: isDesktopWeb ? 600 : '100%',
          position: 'relative',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: isDesktopWeb ? 10 : -4 },
          shadowOpacity: isDesktopWeb ? 0.25 : 0.1,
          shadowRadius: 15,
          elevation: 20
        }}>
          <View style={{ width: scale(40), height: scale(5), backgroundColor: theme.colors.border, borderRadius: scale(3), alignSelf: 'center', marginBottom: moderateScale(15), opacity: 0.8 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(16) }}>
            <Text style={{ fontSize: normalize(18), fontWeight: 'bold', color: theme.colors.textPrimary }}>Add Envelope</Text>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={scale(24)} color={theme.colors.textSecondary} /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 1 }}>
            {archivedEnvelopesList.length > 0 && (
              <TouchableOpacity
                onPress={() => { triggerImpactHaptic('Light'); setShowArchive(!showArchive); }}
                style={{ backgroundColor: theme.colors.primary + '10', padding: 12, borderRadius: 12, marginBottom: 20, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderStyle: 'dashed', borderWidth: 1, borderColor: theme.colors.primary }}
              >
                <MaterialIcons name="history" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
                <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }}>Restore from Archive ({archivedEnvelopesList.length})</Text>
              </TouchableOpacity>
            )}

            {showArchive && archivedEnvelopesList.length > 0 && !selectedRestoreEnv && (
              <View style={{ backgroundColor: theme.colors.background, borderRadius: 12, padding: 12, marginBottom: 20, borderWidth: 1, borderColor: theme.colors.border }}>
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: 10 }}>SELECT TO RESTORE:</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                  {archivedEnvelopesList.map(env => (
                    <TouchableOpacity key={env.id} onPress={() => { triggerImpactHaptic('Light'); setSelectedRestoreEnv(env); }} style={{ backgroundColor: theme.colors.card, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, borderColor: theme.colors.border, flexDirection: 'row', alignItems: 'center' }}>
                      <MaterialIcons name="unarchive" size={14} color={theme.colors.primary} style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 13, color: theme.colors.textPrimary, fontWeight: '600' }}>{env.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}

            {selectedRestoreEnv ? (
              <View style={{ backgroundColor: theme.colors.primary + '10', borderRadius: 16, padding: 16, marginBottom: 20, borderWidth: 1, borderColor: theme.colors.primary + '40' }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                  <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: theme.colors.primary + '20', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                    <MaterialIcons name="unarchive" size={22} color={theme.colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 11, color: theme.colors.textSecondary, fontWeight: 'bold', letterSpacing: 0.5, marginBottom: 2 }}>SELECTED FOR RESTORATION</Text>
                    <Text style={{ fontSize: 18, color: theme.colors.textPrimary, fontWeight: 'bold' }}>{selectedRestoreEnv.name}</Text>
                  </View>
                </View>
                
                <View style={{ flexDirection: 'row', gap: 10 }}>
                  <TouchableOpacity onPress={() => setSelectedRestoreEnv(null)} style={{ flex: 1, backgroundColor: theme.colors.background, paddingVertical: 14, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border }}>
                    <Text style={{ color: theme.colors.textSecondary, fontWeight: 'bold', fontSize: 15 }}>Cancel</Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleRestore(selectedRestoreEnv)} disabled={isSaving} style={{ flex: 1.5, backgroundColor: theme.colors.primary, paddingVertical: 14, borderRadius: 12, alignItems: 'center', opacity: isSaving ? 0.7 : 1 }}>
                    {isSaving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 }}>Restore Envelope</Text>}
                  </TouchableOpacity>
                </View>
              </View>
            ) : (
              <>
                <Text style={{ fontSize: normalize(13), color: theme.colors.textSecondary, marginBottom: moderateScale(8) }}>ENVELOPE NAME</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="e.g. Travel, Gifts"
              style={{ backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: scale(8), paddingHorizontal: moderateScale(12), paddingVertical: moderateScale(10), fontSize: normalize(14), color: theme.colors.textPrimary, marginBottom: moderateScale(16) }}
            />

            <Text style={{ fontSize: normalize(13), color: theme.colors.textSecondary, marginBottom: moderateScale(8) }}>ASSIGN INITIAL BUDGET (OPTIONAL)</Text>
            <AmountInput value={assigned} onChangeText={setAssigned} theme={theme} fontSize={normalize(22)} containerStyle={{ marginBottom: moderateScale(22) }} />

            <TouchableOpacity onPress={handleCreate} disabled={isSaving} style={{ backgroundColor: isSaving ? theme.colors.accent : theme.colors.primary, borderRadius: scale(12), paddingVertical: moderateScale(14), alignItems: 'center', marginBottom: moderateScale(20) }}>
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={{ color: '#FFFFFF', fontSize: normalize(16), fontWeight: 'bold' }}>Create Envelope</Text>
              )}
            </TouchableOpacity>

            {archivedEnvelopesList.length > 0 && (
              <View style={{ borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: moderateScale(20) }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
                  <MaterialIcons name="history" size={18} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: normalize(14), fontWeight: 'bold', color: theme.colors.textSecondary }}>WANT TO RESTORE AN OLD ONE?</Text>
                </View>

                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                  {archivedEnvelopesList.map(env => (
                    <TouchableOpacity
                      key={env.id}
                      onPress={() => { triggerImpactHaptic('Light'); setSelectedRestoreEnv(env); }}
                      style={{
                        backgroundColor: theme.colors.background,
                        borderWidth: 1.5,
                        borderColor: theme.colors.border,
                        borderRadius: scale(12),
                        paddingHorizontal: moderateScale(14),
                        paddingVertical: moderateScale(10),
                        flexDirection: 'row',
                        alignItems: 'center'
                      }}
                    >
                      <MaterialIcons name="unarchive" size={scale(16)} color={theme.colors.primary} style={{ marginRight: 8 }} />
                      <Text style={{ fontSize: normalize(13), color: theme.colors.textPrimary, fontWeight: '700' }}>{env.name}</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>
            )}
              </>
            )}
          </ScrollView>
          <SaveSuccessOverlay visible={showSaveSuccess} theme={theme} message="Saved!" />
        </View>

      </View>
    </Modal>
  );
};

const SavingsManagerModal = function ({ visible, onClose, state, userSettings, mutateUpdateSettings, onSaved }) {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 1024;

  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var insets = useSafeAreaInsets();
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
          errorMessage: 'Could not add to savings.',
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
      return Alert.alert('Error', 'You cannot withdraw more than your current Savings!');
    }

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
        continue;
      }
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
          errorMessage: 'Could not withdraw from savings.',
          onError: () => setIsSaving(false)
        }
      ).then(function () { setAmount(''); setIsSaving(false); });
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{
        flex: 1,
        justifyContent: isDesktopWeb ? 'center' : 'flex-end',
        alignItems: isDesktopWeb ? 'center' : 'stretch',
        backgroundColor: 'rgba(0,0,0,0.5)'
      }}>
        <View style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: scale(28),
          borderTopRightRadius: scale(28),
          borderBottomLeftRadius: isDesktopWeb ? scale(28) : 0,
          borderBottomRightRadius: isDesktopWeb ? scale(28) : 0,
          paddingHorizontal: moderateScale(24),
          paddingTop: moderateScale(10),
          paddingBottom: insets.bottom + moderateScale(40),
          maxHeight: isDesktopWeb ? '85%' : '92%',
          width: isDesktopWeb ? 550 : '100%',
          position: 'relative',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: isDesktopWeb ? 10 : -4 },
          shadowOpacity: isDesktopWeb ? 0.25 : 0.1,
          shadowRadius: 15,
          elevation: 20
        }}>
          <View style={{ width: scale(40), height: scale(5), backgroundColor: theme.colors.border, borderRadius: scale(3), alignSelf: 'center', marginBottom: moderateScale(15), opacity: 0.8 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(20) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialIcons name="savings" size={scale(24)} color={theme.colors.primary} />
              <Text style={{ fontSize: normalize(20), fontWeight: 'bold', color: theme.colors.textPrimary }}>Savings Manager</Text>
            </View>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={scale(24)} color={theme.colors.textSecondary} /></TouchableOpacity>
          </View>

          <View style={{ backgroundColor: theme.colors.background, borderRadius: scale(16), padding: moderateScale(16), marginBottom: moderateScale(20), borderWidth: 1, borderColor: theme.colors.border }}>
            <Text style={{ fontSize: normalize(11), color: theme.colors.textSecondary, fontWeight: '800', marginBottom: 4, letterSpacing: 0.5 }}>TOTAL SAVED</Text>
            <Text style={{ fontSize: normalize(28), fontWeight: 'bold', color: theme.colors.textPrimary }}>{formatCurrency(currentSavings)}</Text>
          </View>

          <Text style={{ fontSize: normalize(12), fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: moderateScale(8), letterSpacing: 0.5 }}>AMOUNT</Text>
          <AmountInput value={amount} onChangeText={setAmount} theme={theme} containerStyle={{ marginBottom: moderateScale(20) }} />

          <Text style={{ fontSize: normalize(12), fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: moderateScale(8), letterSpacing: 0.5 }}>{amount.startsWith('-') || amount === '' ? 'TARGET WALLET' : 'FUND FROM WALLET'}</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: moderateScale(24) }}>
            {accountsList.map(acc => {
              var isSelected = selectedSource === acc.id;
              return (
                <TouchableOpacity key={acc.id} onPress={() => setSelectedSource(acc.id)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isSelected ? theme.colors.primary : theme.colors.background, paddingHorizontal: moderateScale(14), paddingVertical: moderateScale(10), borderRadius: scale(12), marginRight: 8, borderWidth: 1, borderColor: isSelected ? theme.colors.primary : theme.colors.border }}>
                  <BrandLogo type={acc.type} size={16} style={{ marginRight: 8 }} />
                  <Text style={{ fontSize: normalize(13), fontWeight: 'bold', color: isSelected ? '#FFFFFF' : theme.colors.textPrimary }}>{acc.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity onPress={handleWithdraw} disabled={isSaving || currentSavings <= 0} style={{ flex: 1, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: scale(12), paddingVertical: moderateScale(14), alignItems: 'center', opacity: currentSavings <= 0 ? 0.5 : 1 }}>
              <Text style={{ color: theme.colors.textPrimary, fontWeight: 'bold', fontSize: normalize(15) }}>Withdraw</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleAdd} disabled={isSaving || !amount || addExceedsSource} style={{ flex: 1, backgroundColor: addExceedsSource ? theme.colors.border : theme.colors.primary, borderRadius: scale(12), paddingVertical: moderateScale(14), alignItems: 'center', opacity: addExceedsSource ? 0.5 : 1 }}>
              <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: normalize(15) }}>Add to Savings</Text>
            </TouchableOpacity>
          </View>
          <SaveSuccessOverlay visible={showSaveSuccess} theme={theme} message={successMessage} />
        </View>
      </View>
    </Modal>
  );
};

const NotificationCenterModal = function ({ visible, onClose, state, theme, insets, smartInsights = [] }) {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 1024;

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
      <View style={{
        flex: 1,
        justifyContent: isDesktopWeb ? 'center' : 'flex-end',
        alignItems: isDesktopWeb ? 'center' : 'stretch',
        backgroundColor: 'rgba(0,0,0,0.5)'
      }}>
        <View style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: scale(28),
          borderTopRightRadius: scale(28),
          borderBottomLeftRadius: isDesktopWeb ? scale(28) : 0,
          borderBottomRightRadius: isDesktopWeb ? scale(28) : 0,
          paddingHorizontal: moderateScale(24),
          paddingTop: moderateScale(10),
          paddingBottom: insets.bottom + moderateScale(24),
          maxHeight: isDesktopWeb ? '85%' : '92%',
          width: isDesktopWeb ? 550 : '100%',
          position: 'relative',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: isDesktopWeb ? 10 : -4 },
          shadowOpacity: isDesktopWeb ? 0.25 : 0.1,
          shadowRadius: 15,
          elevation: 20
        }}>
          <View style={{ width: scale(40), height: scale(5), backgroundColor: theme.colors.border, borderRadius: scale(3), alignSelf: 'center', marginBottom: moderateScale(15), opacity: 0.8 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(20) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: moderateScale(8) }}>
              <MaterialIcons name="notifications-none" size={scale(24)} color={theme.colors.primary} />
              <Text style={{ fontSize: normalize(20), fontWeight: 'bold', color: theme.colors.textPrimary }}>Alerts & Reminders</Text>
            </View>
            <TouchableOpacity onPress={onClose}>
              <MaterialIcons name="close" size={scale(24)} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>


          <ScrollView showsVerticalScrollIndicator={false} style={{ marginBottom: moderateScale(20) }}>
            <View style={{ backgroundColor: theme.colors.background, borderRadius: scale(12), padding: moderateScale(14), marginBottom: moderateScale(16), borderWidth: 1, borderColor: theme.colors.border }}>
              <Text style={{ fontSize: normalize(11), fontWeight: '700', color: theme.colors.textSecondary, marginBottom: 6, letterSpacing: 0.5 }}>SYSTEM TRIGGERS</Text>

              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 6 }}>
                <View style={{ flex: 1, marginRight: 8 }}>
                  <Text style={{ fontSize: normalize(14), fontWeight: '600', color: theme.colors.textPrimary }}>Daily Budget Check</Text>
                  <Text style={{ fontSize: normalize(12), color: theme.colors.textSecondary, marginTop: 2 }}>Daily log nudge scheduled at 8:00 PM</Text>
                </View>
                <View style={{ backgroundColor: '#D1FAE5', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6 }}>
                  <Text style={{ fontSize: normalize(11), fontWeight: 'bold', color: '#065F46' }}>ACTIVE</Text>
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

            {smartInsights.length > 0 && (
              <View style={{ marginBottom: 20 }}>
                <Text style={{ fontSize: 15, fontWeight: 'bold', color: theme.colors.textPrimary, marginBottom: 12 }}>Penny Smart Insights</Text>
                {smartInsights.map((insight, idx) => (
                  <View key={idx} style={{
                    flexDirection: 'row',
                    alignItems: 'center',
                    backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.02)',
                    borderRadius: 12,
                    padding: 12,
                    marginBottom: 8,
                    borderWidth: 1,
                    borderColor: insight.color + '22'
                  }}>
                    <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: insight.color + '15', alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                      <MaterialIcons name={insight.icon} size={18} color={insight.color} />
                    </View>
                    <Text style={{ flex: 1, fontSize: 13, color: theme.colors.textPrimary, lineHeight: 18 }}>{insight.text}</Text>
                  </View>
                ))}
              </View>
            )}

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

const AddAccountModal = function ({ visible, onClose, accounts, userSettings, mutateUpdateSettings, onSaved, userId, setShowPremiumModal }) {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 1024;

  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var insets = useSafeAreaInsets();
  var [name, setName] = useState('');
  var [balance, setBalance] = useState('');
  var [type, setType] = useState('Cash');
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);
  var [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setName('');
      setBalance('');
      setType('Cash');
      setShowSaveSuccess(false);
      setIsSaving(false);
    }
  }, [visible]);

  var handleCreate = function () {
    var finalName = type === 'Custom' ? name.trim() : (WALLET_STYLES[type] ? WALLET_STYLES[type].name : name.trim());
    if (isSaving || !finalName) return;

    // Senior Developer: Enforce Freemium 5-Account Limit
    var currentAccounts = getStoredAccountsList(userSettings);
    var isPremium = userSettings?.is_premium || false;

    if (currentAccounts.length >= 5 && !isPremium) {
      setShowPremiumModal(true);
      return;
    }

    var startingBal = parseAmount(balance);
    var newId = 'acc-' + generateId();
    var newAcc = { id: newId, name: finalName, starting_balance: startingBal, type: type };
    var newList = currentAccounts.concat(newAcc);
    if (userSettings) {
      setIsSaving(true);
      var savePromise = mutateUpdateSettings({ id: userSettings.id, data: { accounts: newList, accounts_customized: true } });
      runSaveWithFeedback(savePromise, {
        onClose: onClose,
        onSaved: onSaved,
        setShowSuccess: setShowSaveSuccess,
        message: 'Wallet Added!',
        errorMessage: 'Could not add wallet.',
        onError: () => setIsSaving(false)
      }).then(() => setIsSaving(false));
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{
        flex: 1,
        justifyContent: isDesktopWeb ? 'center' : 'flex-end',
        alignItems: isDesktopWeb ? 'center' : 'stretch',
        backgroundColor: 'rgba(0,0,0,0.5)'
      }}>
        <View style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: scale(28),
          borderTopRightRadius: scale(28),
          borderBottomLeftRadius: isDesktopWeb ? scale(28) : 0,
          borderBottomRightRadius: isDesktopWeb ? scale(28) : 0,
          paddingHorizontal: moderateScale(24),
          paddingTop: moderateScale(10),
          paddingBottom: insets.bottom + moderateScale(40),
          maxHeight: isDesktopWeb ? '85%' : '92%',
          width: isDesktopWeb ? 550 : '100%',
          position: 'relative',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: isDesktopWeb ? 10 : -4 },
          shadowOpacity: isDesktopWeb ? 0.25 : 0.1,
          shadowRadius: 15,
          elevation: 20
        }}>
          <View style={{ width: scale(40), height: scale(5), backgroundColor: theme.colors.border, borderRadius: scale(3), alignSelf: 'center', marginBottom: moderateScale(15), opacity: 0.8 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(20) }}>
            <Text style={{ fontSize: normalize(20), fontWeight: 'bold', color: theme.colors.textPrimary }}>Add Wallet</Text>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={scale(24)} color={theme.colors.textSecondary} /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }} keyboardShouldPersistTaps="handled">
            {type === 'Custom' && (
              <>
                <Text style={{ fontSize: normalize(12), fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: moderateScale(8), letterSpacing: 0.5 }}>WALLET NAME</Text>
                <TextInput
                  value={name}
                  onChangeText={setName}
                  placeholder="e.g. My Savings, GCash"
                  style={{ backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: scale(12), paddingHorizontal: moderateScale(14), paddingVertical: moderateScale(12), fontSize: normalize(15), color: theme.colors.textPrimary, marginBottom: moderateScale(20) }}
                />
              </>
            )}

            <Text style={{ fontSize: normalize(12), fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: moderateScale(8), letterSpacing: 0.5 }}>STARTING BALANCE</Text>
            <AmountInput value={balance} onChangeText={setBalance} theme={theme} containerStyle={{ marginBottom: moderateScale(20) }} />

            <Text style={{ fontSize: normalize(12), fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: moderateScale(12), letterSpacing: 0.5 }}>ACCOUNT TYPE</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: moderateScale(30) }}>
              {Object.keys(WALLET_STYLES).map(k => {
                var isSelected = type === k;
                return (
                  <TouchableOpacity key={k} onPress={() => setType(k)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isSelected ? theme.colors.primary : theme.colors.background, paddingHorizontal: moderateScale(12), paddingVertical: moderateScale(8), borderRadius: scale(10), borderWidth: 1, borderColor: isSelected ? theme.colors.primary : theme.colors.border }}>
                    <BrandLogo type={k} size={14} style={{ marginRight: 6 }} />
                    <Text style={{ fontSize: normalize(12), fontWeight: '600', color: isSelected ? '#FFFFFF' : theme.colors.textPrimary }}>{WALLET_STYLES[k].name}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity disabled={isSaving} onPress={handleCreate} style={{ backgroundColor: isSaving ? theme.colors.accent : theme.colors.primary, borderRadius: scale(12), paddingVertical: moderateScale(14), alignItems: 'center', marginBottom: moderateScale(10) }}>
              {isSaving ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: normalize(16) }}>Create Wallet</Text>
              )}
            </TouchableOpacity>
          </ScrollView>
          <SaveSuccessOverlay visible={showSaveSuccess} theme={theme} message="Wallet Added!" />
        </View>
      </View>
    </Modal>
  );
};

const EditAccountModal = function ({ visible, onClose, account, accounts, userSettings, envelopeBalances, mutateUpdateSettings, onSaved, userId, userHistory }) {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 1024;

  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var insets = useSafeAreaInsets();
  var [name, setName] = useState('');
  var [amount, setAmount] = useState('');
  var [mode, setMode] = useState('add');
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
      setAmount('');
      setMode('add');
      setShowSaveSuccess(false);
      setIsSaving(false);
    }
  }, [visible, account]);

  var totalEnvelopeLiabilities = (envelopeBalances || []).reduce((s, e) => s + (parseFloat(e.available) || 0), 0);

  var handleSave = () => {
    if (isSaving || !name.trim()) return;
    var val = parseAmount(amount);
    var liveBal = parseFloat(account.balance) || 0;

    if (userSettings && account) {
      setIsSaving(true);
      var currentAccounts = getStoredAccountsList(userSettings);
      var newList = currentAccounts.map(a => {
        if (a.id === account.id) return { ...a, name: name.trim() };
        return a;
      });

      var savePromise = mutateUpdateSettings({ id: userSettings.id, data: { accounts: newList, accounts_customized: true } }).then(() => {
        var today = new Date().toISOString().split('T')[0];

        // Calculate the actual adjustment amount based on mode
        var finalAdjustmentAmount = 0;
        var adjustmentType = 'Income'; // Default to income (Add)

        if (mode === 'reconcile') {
          // In reconcile mode, 'val' is the target balance.
          finalAdjustmentAmount = Math.abs(val - liveBal);
          adjustmentType = val >= liveBal ? 'Income' : 'Adjustment';
        } else {
          // Standard Add/Reduce mode
          finalAdjustmentAmount = val;
          adjustmentType = mode === 'add' ? 'Income' : 'Adjustment';
        }

        if (finalAdjustmentAmount <= 0) return Promise.resolve();

        return mutateInsertHistory({
          id: generateId(),
          user_id: userId,
          expense_name: 'Balance Correction: ' + name.trim(),
          amount: finalAdjustmentAmount,
          date: today,
          expense_type: 'Adjustment',
          category: adjustmentType,
          account_id: account.id,
          notes: mode === 'reconcile'
            ? `Reconciled from ${formatCurrency(liveBal)} to ${formatCurrency(val)}`
            : 'Manual balance adjustment'
        });
      });

      runSaveWithFeedback(savePromise, {
        onClose: onClose,
        onSaved: onSaved,
        setShowSuccess: setShowSaveSuccess,
        setSuccessMessage: setSuccessMessage,
        message: 'Wallet reconciled!',
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
      return Alert.alert('Budget Integrity', err);
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
    Alert.alert('Delete Wallet & History?', msg, [{ text: 'Cancel', style: 'cancel' }, { text: 'Delete Everything', style: 'destructive', onPress: performDelete }]);
  };

  if (!visible || !account) return null;

  var valInput = parseAmount(amount) || 0;
  var liveBal = parseFloat(account.balance) || 0;

  // Senior Developer Fix: Handle reconcile mode in preview calculation
  var previewBal = mode === 'reconcile'
    ? valInput
    : (mode === 'add' ? (liveBal + valInput) : (liveBal - valInput));

  var otherWalletsTotal = (accounts || []).filter(a => a.id !== account.id).reduce((s, a) => s + (parseFloat(a.balance) || 0), 0);
  var projectedTotalCash = otherWalletsTotal + previewBal;

  var isNegativeWarning = previewBal < 0;
  var isIntegrityWarning = projectedTotalCash < totalEnvelopeLiabilities;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{
        flex: 1,
        justifyContent: isDesktopWeb ? 'center' : 'flex-end',
        alignItems: isDesktopWeb ? 'center' : 'stretch',
        backgroundColor: 'rgba(0,0,0,0.5)'
      }}>
        <View style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: scale(28),
          borderTopRightRadius: scale(28),
          borderBottomLeftRadius: isDesktopWeb ? scale(28) : 0,
          borderBottomRightRadius: isDesktopWeb ? scale(28) : 0,
          paddingHorizontal: moderateScale(24),
          paddingTop: moderateScale(10),
          paddingBottom: insets.bottom + moderateScale(40),
          maxHeight: isDesktopWeb ? '92%' : '92%',
          width: isDesktopWeb ? 550 : '100%',
          position: 'relative',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: isDesktopWeb ? 10 : -4 },
          shadowOpacity: isDesktopWeb ? 0.25 : 0.1,
          shadowRadius: 15,
          elevation: 20
        }}>
          <View style={{ width: scale(40), height: scale(5), backgroundColor: theme.colors.border, borderRadius: scale(3), alignSelf: 'center', marginBottom: moderateScale(15), opacity: 0.8 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(20) }}>
            <Text style={{ fontSize: normalize(20), fontWeight: 'bold', color: theme.colors.textPrimary }}>Edit Wallet</Text>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={scale(24)} color={theme.colors.textSecondary} /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
            <Text style={{ fontSize: normalize(12), fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: moderateScale(8), letterSpacing: 0.5 }}>WALLET NAME</Text>
            <TextInput
              value={name}
              onChangeText={setName}
              placeholder="Account Name"
              style={{ backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: scale(12), paddingHorizontal: moderateScale(14), paddingVertical: moderateScale(12), fontSize: normalize(15), color: theme.colors.textPrimary, marginBottom: moderateScale(20) }}
            />

            <View style={{ backgroundColor: (isNegativeWarning || isIntegrityWarning) ? 'rgba(239, 68, 68, 0.08)' : 'rgba(15, 118, 110, 0.08)', borderRadius: scale(16), padding: moderateScale(16), marginBottom: moderateScale(24), borderWidth: 1, borderColor: (isNegativeWarning || isIntegrityWarning) ? theme.colors.error : 'rgba(15, 118, 110, 0.15)' }}>
              <Text style={{ fontSize: normalize(11), color: (isNegativeWarning || isIntegrityWarning) ? theme.colors.error : theme.colors.primary, fontWeight: '800', marginBottom: 4, letterSpacing: 0.5 }}>
                {isNegativeWarning ? 'RESULTING BALANCE (NEGATIVE!)' : (isIntegrityWarning ? 'BUDGET INTEGRITY ERROR' : 'PROJECTED LIVE BALANCE')}
              </Text>
              <Text style={{ fontSize: normalize(28), fontWeight: 'bold', color: (isNegativeWarning || isIntegrityWarning) ? theme.colors.error : theme.colors.textPrimary }}>{formatCurrency(previewBal)}</Text>

              {isIntegrityWarning && (
                <Text style={{ fontSize: normalize(12), color: theme.colors.error, marginTop: 8, fontWeight: '600', lineHeight: normalize(18) }}>
                  Budget Integrity: You need {formatCurrency(totalEnvelopeLiabilities)} for envelopes, but will only have {formatCurrency(projectedTotalCash)} left.
                </Text>
              )}
            </View>

            <View style={{ marginBottom: moderateScale(20) }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: moderateScale(12) }}>
                <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                  <MaterialIcons name="tune" size={scale(16)} color={theme.colors.textSecondary} style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: normalize(12), fontWeight: 'bold', color: theme.colors.textSecondary, letterSpacing: 0.5 }}>BALANCE ADJUSTMENT</Text>
                </View>
                {mode === 'reconcile' && (
                   <View style={{ backgroundColor: theme.colors.primary + '15', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                     <Text style={{ fontSize: 10, color: theme.colors.primary, fontWeight: 'bold' }}>SMART SYNC</Text>
                   </View>
                )}
              </View>

              <View style={{ flexDirection: 'row', backgroundColor: theme.colors.background, borderRadius: scale(12), padding: 4, marginBottom: moderateScale(14), borderWidth: 1, borderColor: theme.colors.border }}>
                <TouchableOpacity onPress={() => setMode('reconcile')} style={{ flex: 1.2, paddingVertical: 10, alignItems: 'center', backgroundColor: mode === 'reconcile' ? theme.colors.primary : 'transparent', borderRadius: 8 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: normalize(11), color: mode === 'reconcile' ? '#FFFFFF' : theme.colors.textSecondary }}>RECONCILE</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMode('add')} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: mode === 'add' ? theme.colors.primary : 'transparent', borderRadius: 8 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: normalize(11), color: mode === 'add' ? '#FFFFFF' : theme.colors.textSecondary }}>ADD</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setMode('reduce')} style={{ flex: 1, paddingVertical: 10, alignItems: 'center', backgroundColor: mode === 'reduce' ? theme.colors.error : 'transparent', borderRadius: 8 }}>
                  <Text style={{ fontWeight: 'bold', fontSize: normalize(11), color: mode === 'reduce' ? '#FFFFFF' : theme.colors.textSecondary }}>REDUCE</Text>
                </TouchableOpacity>
              </View>

              <AmountInput value={amount} onChangeText={setAmount} theme={theme} containerStyle={{ marginBottom: moderateScale(10) }} placeholder={mode === 'reconcile' ? "How much cash do you have?" : "0.00"} />
              <Text style={{ fontSize: normalize(11), color: theme.colors.textSecondary, fontStyle: 'italic' }}>
                {mode === 'reconcile'
                  ? "Enter the actual total amount currently in your wallet."
                  : "Adjustment will be logged in transaction history."}
              </Text>
            </View>

            <View style={{ flexDirection: 'row', gap: 10 }}>
              <TouchableOpacity onPress={handleDelete} style={{ flex: 1, backgroundColor: '#FEF2F2', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#FEE2E2' }}>
                <Text style={{ color: theme.colors.error, fontWeight: 'bold', fontSize: normalize(16) }}>Delete Wallet</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={handleSave} disabled={isSaving} style={{ flex: 2, backgroundColor: isSaving ? theme.colors.accent : theme.colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
                {isSaving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: normalize(16) }}>Save Changes</Text>}
              </TouchableOpacity>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const EditEnvelopeModal = function ({ visible, onClose, envelope, readyToAssign, envelopes, userSettings, mutateUpdateSettings, mutateUpdateRecurring, mutateDeleteRecurring, recurringExpenses, onSaved, userHistory, mutateUpdateHistory }) {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 1024;

  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var insets = useSafeAreaInsets();
  var [name, setName] = useState('');
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);
  var [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible && envelope) {
      setName(envelope.name);
      setShowSaveSuccess(false);
      setIsSaving(false);
    }
  }, [visible, envelope]);

  var handleSave = () => {
    if (isSaving || !name.trim()) return;
    if (userSettings && envelope) {
      setIsSaving(true);
      var newList = envelopes.map(e => {
        if (e.id === envelope.id) return { ...e, name: name.trim() };
        return e;
      });
      var savePromise = mutateUpdateSettings({ id: userSettings.id, data: { envelopes: newList } });
      runSaveWithFeedback(savePromise, {
        onClose: onClose,
        onSaved: onSaved,
        setShowSuccess: setShowSaveSuccess,
        message: 'Envelope updated!',
        errorMessage: 'Could not save changes.',
        onError: () => setIsSaving(false)
      }).then(() => setIsSaving(false));
    }
  };

  var handleDelete = () => {
    if (isSaving) return;
    promptDeleteEnvelope({
      envelopeId: envelope.id,
      envelopes: envelopes,
      recurringExpenses: recurringExpenses,
      userHistory: userHistory,
      onPerformDelete: function () {
        if (!userSettings) return;
        setIsSaving(true);
        var deletePromise = deleteEnvelopeAndCleanup({
          envelopeId: envelope.id,
          envelopes: envelopes,
          recurringExpenses: recurringExpenses,
          userSettings: userSettings,
          mutateUpdateSettings: mutateUpdateSettings,
          mutateUpdateRecurring: mutateUpdateRecurring,
          mutateDeleteRecurring: mutateDeleteRecurring,
          userHistory: userHistory,
          mutateUpdateHistory: mutateUpdateHistory
        });
        runSaveWithFeedback(deletePromise, {
          onClose: onClose,
          onSaved: onSaved,
          setShowSuccess: setShowSaveSuccess,
          message: 'Envelope Archived!',
          errorMessage: 'Could not archive envelope.',
          onError: () => setIsSaving(false)
        }).then(() => setIsSaving(false));
      }
    });
  };

  if (!visible || !envelope) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{
        flex: 1,
        justifyContent: isDesktopWeb ? 'center' : 'flex-end',
        alignItems: isDesktopWeb ? 'center' : 'stretch',
        backgroundColor: 'rgba(0,0,0,0.5)'
      }}>
        <View style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: scale(28),
          borderTopRightRadius: scale(28),
          borderBottomLeftRadius: isDesktopWeb ? scale(28) : 0,
          borderBottomRightRadius: isDesktopWeb ? scale(28) : 0,
          paddingHorizontal: moderateScale(24),
          paddingTop: moderateScale(10),
          paddingBottom: insets.bottom + moderateScale(40),
          maxHeight: isDesktopWeb ? '85%' : '92%',
          width: isDesktopWeb ? 550 : '100%',
          position: 'relative',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: isDesktopWeb ? 10 : -4 },
          shadowOpacity: isDesktopWeb ? 0.25 : 0.1,
          shadowRadius: 15,
          elevation: 20
        }}>
          <View style={{ width: scale(40), height: scale(5), backgroundColor: theme.colors.border, borderRadius: scale(3), alignSelf: 'center', marginBottom: moderateScale(15), opacity: 0.8 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(20) }}>
            <Text style={{ fontSize: normalize(20), fontWeight: 'bold', color: theme.colors.textPrimary }}>Edit Envelope</Text>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={scale(24)} color={theme.colors.textSecondary} /></TouchableOpacity>
          </View>

          <Text style={{ fontSize: normalize(12), fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: moderateScale(8), letterSpacing: 0.5 }}>ENVELOPE NAME</Text>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="Envelope Name"
            style={{ backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: scale(12), paddingHorizontal: moderateScale(14), paddingVertical: moderateScale(12), fontSize: normalize(15), color: theme.colors.textPrimary, marginBottom: moderateScale(30) }}
          />

          <View style={{ flexDirection: 'row', gap: 10 }}>
            <TouchableOpacity onPress={handleDelete} style={{ flex: 1, backgroundColor: '#FEF2F2', borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: '#FEE2E2' }}>
              <Text style={{ color: theme.colors.error, fontWeight: 'bold', fontSize: normalize(16) }}>Archive</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={handleSave} disabled={isSaving} style={{ flex: 2, backgroundColor: isSaving ? theme.colors.accent : theme.colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
              {isSaving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: normalize(16) }}>Save Changes</Text>}
            </TouchableOpacity>
          </View>
          <SaveSuccessOverlay visible={showSaveSuccess} theme={theme} message="Envelope updated!" />
        </View>
      </View>
    </Modal>
  );
};

const TransferEnvelopeModal = function ({ visible, onClose, envelopes, userSettings, mutateUpdateSettings, onSaved }) {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 1024;

  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var insets = useSafeAreaInsets();
  var [amount, setAmount] = useState('');
  var [sourceId, setSourceId] = useState('');
  var [destId, setDestId] = useState('');
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);
  var [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (visible) {
      setAmount('');
      setSourceId('');
      setDestId('');
      setShowSaveSuccess(false);
      setIsSaving(false);
    }
  }, [visible]);

  var activeEnvelopes = (envelopes || []).filter(e => !isEnvelopeArchived(e));

  var handleTransfer = () => {
    var val = parseAmount(amount);
    if (!sourceId || !destId || val <= 0 || isSaving) return;
    if (sourceId === destId) {
      return Alert.alert('Invalid Transfer', 'Source and destination must be different.');
    }

    var sourceEnv = activeEnvelopes.find(e => e.id === sourceId);
    if (sourceEnv && (parseFloat(sourceEnv.assigned) || 0) < val) {
      return Alert.alert('Insufficient Budget', `"${sourceEnv.name}" only has ${formatCurrency(sourceEnv.assigned)} assigned.`);
    }

    if (userSettings) {
      setIsSaving(true);
      var newList = activeEnvelopes.map(e => {
        if (e.id === sourceId) return { ...e, assigned: (parseFloat(e.assigned) || 0) - val };
        if (e.id === destId) return { ...e, assigned: (parseFloat(e.assigned) || 0) + val };
        return e;
      });
      // Merge with archived envelopes before saving
      var archivedEnvs = (envelopes || []).filter(isEnvelopeArchived);
      var fullList = newList.concat(archivedEnvs);

      var savePromise = mutateUpdateSettings({ id: userSettings.id, data: { envelopes: fullList } });
      runSaveWithFeedback(savePromise, {
        onClose: onClose,
        onSaved: onSaved,
        setShowSuccess: setShowSaveSuccess,
        message: 'Transfer Complete!',
        errorMessage: 'Could not complete transfer.',
        onError: () => setIsSaving(false)
      }).then(() => setIsSaving(false));
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{
        flex: 1,
        justifyContent: isDesktopWeb ? 'center' : 'flex-end',
        alignItems: isDesktopWeb ? 'center' : 'stretch',
        backgroundColor: 'rgba(0,0,0,0.5)'
      }}>
        <View style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: scale(28),
          borderTopRightRadius: scale(28),
          borderBottomLeftRadius: isDesktopWeb ? scale(28) : 0,
          borderBottomRightRadius: isDesktopWeb ? scale(28) : 0,
          paddingHorizontal: moderateScale(24),
          paddingTop: moderateScale(10),
          paddingBottom: insets.bottom + moderateScale(40),
          maxHeight: isDesktopWeb ? '85%' : '92%',
          width: isDesktopWeb ? 550 : '100%',
          position: 'relative',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: isDesktopWeb ? 10 : -4 },
          shadowOpacity: isDesktopWeb ? 0.25 : 0.1,
          shadowRadius: 15,
          elevation: 20
        }}>
          <View style={{ width: scale(40), height: scale(5), backgroundColor: theme.colors.border, borderRadius: scale(3), alignSelf: 'center', marginBottom: moderateScale(15), opacity: 0.8 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(20) }}>
            <Text style={{ fontSize: normalize(20), fontWeight: 'bold', color: theme.colors.textPrimary }}>Transfer Budget</Text>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={scale(24)} color={theme.colors.textSecondary} /></TouchableOpacity>
          </View>

          <Text style={{ fontSize: normalize(12), fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: moderateScale(8), letterSpacing: 0.5 }}>AMOUNT</Text>
          <AmountInput value={amount} onChangeText={setAmount} theme={theme} containerStyle={{ marginBottom: moderateScale(20) }} />

          <View style={{ flexDirection: 'row', gap: 12, marginBottom: moderateScale(30) }}>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: normalize(12), fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: 8, letterSpacing: 0.5 }}>FROM</Text>
              <ScrollView style={{ maxHeight: scale(150), backgroundColor: theme.colors.background, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border }}>
                {activeEnvelopes.map(e => (
                  <TouchableOpacity key={e.id} onPress={() => setSourceId(e.id)} style={{ padding: 12, backgroundColor: sourceId === e.id ? theme.colors.primary : 'transparent', borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                    <Text style={{ fontSize: normalize(13), fontWeight: '600', color: sourceId === e.id ? '#FFFFFF' : theme.colors.textPrimary }}>{e.name}</Text>
                    <Text style={{ fontSize: normalize(11), color: sourceId === e.id ? 'rgba(255,255,255,0.7)' : theme.colors.textSecondary }}>{formatCurrency(e.assigned)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <View style={{ flex: 1 }}>
              <Text style={{ fontSize: normalize(12), fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: 8, letterSpacing: 0.5 }}>TO</Text>
              <ScrollView style={{ maxHeight: scale(150), backgroundColor: theme.colors.background, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border }}>
                {activeEnvelopes.map(e => (
                  <TouchableOpacity key={e.id} onPress={() => setDestId(e.id)} style={{ padding: 12, backgroundColor: destId === e.id ? theme.colors.primary : 'transparent', borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
                    <Text style={{ fontSize: normalize(13), fontWeight: '600', color: destId === e.id ? '#FFFFFF' : theme.colors.textPrimary }}>{e.name}</Text>
                    <Text style={{ fontSize: normalize(11), color: destId === e.id ? 'rgba(255,255,255,0.7)' : theme.colors.textSecondary }}>{formatCurrency(e.assigned)}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          </View>

          <TouchableOpacity onPress={handleTransfer} disabled={isSaving || !sourceId || !destId || !amount} style={{ backgroundColor: (isSaving || !sourceId || !destId || !amount) ? theme.colors.accent : theme.colors.primary, borderRadius: scale(12), paddingVertical: moderateScale(14), alignItems: 'center' }}>
            {isSaving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: normalize(16) }}>Complete Transfer</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const TransferWalletModal = function ({ visible, onClose, accounts, userHistory, onSaved, theme, insetsBottom, userId, userSettings }) {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 1024;
  const isPremium = userSettings?.is_premium || false;

  var [amount, setAmount] = useState('');
  var [sourceId, setSourceId] = useState('');
  var [destId, setDestId] = useState('');
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);
  var [isSaving, setIsSaving] = useState(false);

  var insertHistory = useMutation('expense_history', 'insert');
  var mutateInsertHistory = insertHistory.mutate;

  useEffect(() => {
    if (visible) {
      setAmount('');
      setSourceId('');
      setDestId('');
      setShowSaveSuccess(false);
      setIsSaving(false);
    }
  }, [visible]);

  var handleTransfer = () => {
    var val = parseAmount(amount);
    if (!sourceId || !destId || val <= 0 || isSaving) return;
    if (sourceId === destId) {
      return Alert.alert('Invalid Transfer', 'Source and destination must be different.');
    }

    var sourceAcc = accounts.find(a => a.id === sourceId);
    if (sourceAcc && sourceAcc.balance < val) {
      return Alert.alert('Insufficient Funds', `"${sourceAcc.name}" only has ${formatCurrency(sourceAcc.balance)}.`);
    }

    setIsSaving(true);
    var srcAcc = accounts.find(a => a.id === sourceId);
    var targetAcc = accounts.find(a => a.id === destId);

    var savePromise = mutateInsertHistory({
      id: generateId(),
      user_id: userId,
      expense_name: 'Transfer: ' + (srcAcc ? srcAcc.name : 'Wallet') + ' ➔ ' + (targetAcc ? targetAcc.name : 'Wallet'),
      amount: val,
      date: getTodayStr(),
      expense_type: 'Transfer',
      status: 'Completed',
      notes: 'Internal wallet transfer',
      account_id: sourceId,
      dest_account_id: destId
    });

    runSaveWithFeedback(savePromise, {
      onClose: onClose,
      onSaved: onSaved,
      setShowSuccess: setShowSaveSuccess,
      message: 'Transfer Complete!',
      errorMessage: 'Could not complete transfer.',
      onError: () => setIsSaving(false)
    }).then(() => setIsSaving(false));
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{
        flex: 1,
        justifyContent: isDesktopWeb ? 'center' : 'flex-end',
        alignItems: isDesktopWeb ? 'center' : 'stretch',
        backgroundColor: 'rgba(0,0,0,0.5)'
      }}>
        <View style={{
          backgroundColor: isPremium ? (theme.isDark ? '#111827' : '#FFFFFF') : theme.colors.card,
          borderTopLeftRadius: scale(32),
          borderTopRightRadius: scale(32),
          borderBottomLeftRadius: isDesktopWeb ? scale(32) : 0,
          borderBottomRightRadius: isDesktopWeb ? scale(32) : 0,
          paddingHorizontal: moderateScale(24),
          paddingTop: moderateScale(10),
          paddingBottom: insetsBottom + moderateScale(40),
          maxHeight: isDesktopWeb ? '85%' : '92%',
          width: isDesktopWeb ? 550 : '100%',
          position: 'relative',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: isDesktopWeb ? 10 : -4 },
          shadowOpacity: isDesktopWeb ? 0.25 : 0.1,
          shadowRadius: 15,
          elevation: 20,
          borderWidth: isPremium ? 1 : 0,
          borderColor: isPremium ? 'rgba(245, 158, 11, 0.3)' : 'transparent'
        }}>
          {/* Premium Mesh Gradient Top Decoration */}
          {isPremium && Platform.OS === 'web' && (
            <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: scale(6), backgroundImage: `linear-gradient(90deg, #F59E0B, #D97706, #F59E0B)` }} />
          )}

          <View style={{ width: scale(40), height: scale(5), backgroundColor: theme.colors.border, borderRadius: scale(3), alignSelf: 'center', marginBottom: moderateScale(15), opacity: 0.8 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(20) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Text style={{ fontSize: normalize(20), fontWeight: '900', color: theme.colors.textPrimary }}>Wallet Transfer</Text>
              {isPremium && (
                <View style={{ marginLeft: 10, backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, borderColor: '#F59E0B' }}>
                   <Text style={{ color: '#B45309', fontSize: 10, fontWeight: 'bold' }}>LUXE</Text>
                </View>
              )}
            </View>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={scale(24)} color={theme.colors.textSecondary} /></TouchableOpacity>
          </View>

          <Text style={{ fontSize: normalize(11), fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: moderateScale(8), letterSpacing: 1, textTransform: 'uppercase' }}>AMOUNT TO TRANSFER</Text>
          <AmountInput value={amount} onChangeText={setAmount} theme={theme} containerStyle={{ marginBottom: moderateScale(20) }} />

          {/* Mobile-First Vertical Stack Selector */}
          <View style={{ marginBottom: moderateScale(25) }}>

            {/* FROM SECTION */}
            <View style={{ backgroundColor: isPremium ? (theme.isDark ? 'rgba(255,255,255,0.03)' : '#FFFBEB') : theme.colors.background, borderRadius: 20, borderWidth: 1, borderColor: sourceId ? (isPremium ? '#F59E0B' : theme.colors.primary) : theme.colors.border, padding: 12 }}>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: 8, letterSpacing: 0.5 }}>FROM WALLET</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                {accounts.map(a => (
                  <TouchableOpacity
                    key={a.id}
                    onPress={() => { triggerImpactHaptic('Light'); setSourceId(a.id); }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: 14,
                      backgroundColor: sourceId === a.id ? (isPremium ? '#F59E0B' : theme.colors.primary) : (theme.isDark ? '#374151' : '#F3F4F6'),
                      marginRight: 10,
                      minWidth: scale(115),
                      borderWidth: isPremium && sourceId === a.id ? 1.5 : 0,
                      borderColor: '#FFFFFF'
                    }}
                  >
                    <View style={{ marginRight: 8, backgroundColor: 'rgba(255,255,255,0.2)', padding: 2, borderRadius: 6 }}>
                       <BrandLogo type={a.type} size={22} />
                    </View>
                    <View>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: sourceId === a.id ? '#FFFFFF' : theme.colors.textPrimary }} numberOfLines={1}>{a.name}</Text>
                      <Text style={{ fontSize: 9, color: sourceId === a.id ? 'rgba(255,255,255,0.8)' : theme.colors.textSecondary }}>{formatCurrency(a.balance)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

            {/* TRANSITION ARROW */}
            <View style={{ alignItems: 'center', marginVertical: -12, zIndex: 2 }}>
               <TouchableOpacity
                onPress={() => {
                  triggerImpactHaptic('Medium');
                  var oldSrc = sourceId;
                  setSourceId(destId);
                  setDestId(oldSrc);
                }}
                style={{
                  width: 44,
                  height: 44,
                  borderRadius: 22,
                  backgroundColor: isPremium ? '#F59E0B' : theme.colors.card,
                  borderWidth: 2,
                  borderColor: theme.colors.background,
                  alignItems: 'center',
                  justifyContent: 'center',
                  shadowColor: isPremium ? '#F59E0B' : '#000',
                  shadowOffset: { width: 0, height: 4 },
                  shadowOpacity: 0.2,
                  shadowRadius: 5,
                  elevation: 6
                }}
              >
                <MaterialIcons name="swap-vert" size={24} color={isPremium ? '#FFFFFF' : theme.colors.primary} />
              </TouchableOpacity>
            </View>

            {/* TO SECTION */}
            <View style={{ backgroundColor: isPremium ? (theme.isDark ? 'rgba(255,255,255,0.03)' : '#FFFBEB') : theme.colors.background, borderRadius: 20, borderWidth: 1, borderColor: destId ? (isPremium ? '#F59E0B' : theme.colors.primary) : theme.colors.border, padding: 12 }}>
              <Text style={{ fontSize: 10, fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: 8, letterSpacing: 0.5 }}>TO WALLET</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row' }}>
                {accounts.map(a => (
                  <TouchableOpacity
                    key={a.id}
                    onPress={() => { triggerImpactHaptic('Light'); setDestId(a.id); }}
                    style={{
                      flexDirection: 'row',
                      alignItems: 'center',
                      paddingHorizontal: 12,
                      paddingVertical: 10,
                      borderRadius: 14,
                      backgroundColor: destId === a.id ? (isPremium ? '#F59E0B' : theme.colors.primary) : (theme.isDark ? '#374151' : '#F3F4F6'),
                      marginRight: 10,
                      minWidth: scale(115),
                      borderWidth: isPremium && destId === a.id ? 1.5 : 0,
                      borderColor: '#FFFFFF'
                    }}
                  >
                    <View style={{ marginRight: 8, backgroundColor: 'rgba(255,255,255,0.2)', padding: 2, borderRadius: 6 }}>
                       <BrandLogo type={a.type} size={22} />
                    </View>
                    <View>
                      <Text style={{ fontSize: 12, fontWeight: 'bold', color: destId === a.id ? '#FFFFFF' : theme.colors.textPrimary }} numberOfLines={1}>{a.name}</Text>
                      <Text style={{ fontSize: 9, color: destId === a.id ? 'rgba(255,255,255,0.8)' : theme.colors.textSecondary }}>{formatCurrency(a.balance)}</Text>
                    </View>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>

          </View>

          {/* Real-time Preview Card (Enhanced for Premium) */}
          {sourceId && destId && amount > 0 && (
            <View style={{
              backgroundColor: isPremium ? (theme.isDark ? 'rgba(245, 158, 11, 0.08)' : '#FFFBEB') : (theme.isDark ? 'rgba(16, 185, 129, 0.05)' : '#F0FDF4'),
              borderRadius: 20,
              padding: 18,
              marginBottom: 25,
              borderWidth: 1.5,
              borderColor: isPremium ? '#F59E0B' : theme.colors.primary + '33',
              shadowColor: isPremium ? '#F59E0B' : 'transparent',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.1,
              shadowRadius: 10
            }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <View style={{ flex: 1 }}>
                   <Text style={{ fontSize: 9, color: isPremium ? '#B45309' : theme.colors.textSecondary, fontWeight: '900', letterSpacing: 0.5 }}>NEW {accounts.find(a => a.id === sourceId)?.name.toUpperCase()} BALANCE</Text>
                   <Text style={{ fontSize: 16, fontWeight: '900', color: theme.colors.textPrimary, marginTop: 4 }}>{formatCurrency(accounts.find(a => a.id === sourceId).balance - parseAmount(amount))}</Text>
                </View>
                <View style={{ width: 32, height: 32, borderRadius: 16, backgroundColor: isPremium ? '#F59E0B' : theme.colors.primary, alignItems: 'center', justifyContent: 'center', marginHorizontal: 8 }}>
                   <MaterialIcons name="trending-flat" size={18} color="#FFFFFF" />
                </View>
                <View style={{ flex: 1, alignItems: 'flex-end' }}>
                   <Text style={{ fontSize: 9, color: isPremium ? '#B45309' : theme.colors.textSecondary, fontWeight: '900', letterSpacing: 0.5 }}>NEW {accounts.find(a => a.id === destId)?.name.toUpperCase()} BALANCE</Text>
                   <Text style={{ fontSize: 16, fontWeight: '900', color: isPremium ? '#D97706' : theme.colors.primary, marginTop: 4 }}>{formatCurrency(accounts.find(a => a.id === destId).balance + parseAmount(amount))}</Text>
                </View>
              </View>
            </View>
          )}

          <TouchableOpacity
            onPress={handleTransfer}
            disabled={isSaving || !sourceId || !destId || !amount}
            style={{
              backgroundColor: (isSaving || !sourceId || !destId || !amount) ? theme.colors.border : (isPremium ? '#F59E0B' : theme.colors.primary),
              borderRadius: 20,
              paddingVertical: moderateScale(16),
              alignItems: 'center',
              shadowColor: isPremium ? '#F59E0B' : theme.colors.primary,
              shadowOffset: { width: 0, height: 6 },
              shadowOpacity: 0.3,
              shadowRadius: 10,
              elevation: 8
            }}
          >
            {isSaving ? <ActivityIndicator color="#FFFFFF" size="small" /> : (
              <View style={{ flexDirection: 'row', alignItems: 'center' }}>
                {isPremium && <MaterialIcons name="workspace-premium" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />}
                <Text style={{ color: '#FFFFFF', fontWeight: '900', fontSize: normalize(16), letterSpacing: 0.5 }}>{isPremium ? 'CONFIRM LUXE TRANSFER' : 'Complete Transfer'}</Text>
              </View>
            )}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const EditSalaryModal = function ({ visible, onClose, incomeSources, userSettings, mutateUpdateSettings, onSaved, theme }) {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 1024;

  var [editSources, setEditSources] = useState([]);
  var [isSaving, setIsSaving] = useState(false);
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);

  useEffect(() => {
    if (visible) {
      setEditSources(JSON.parse(JSON.stringify(incomeSources || [])));
      setShowSaveSuccess(false);
      setIsSaving(false);
    }
  }, [visible, incomeSources]);

  var handleAddSource = () => {
    setEditSources([...editSources, { id: generateId(), name: '', amount: 0 }]);
  };

  var handleRemoveSource = (id) => {
    setEditSources(editSources.filter(s => s.id !== id));
  };

  var handleUpdateSource = (id, field, value) => {
    setEditSources(editSources.map(s => {
      if (s.id === id) {
        var upd = { ...s, [field]: value };
        if (field === 'amount') upd.amount = parseAmount(value);
        return upd;
      }
      return s;
    }));
  };

  var handleSave = () => {
    if (isSaving || !userSettings) return;
    setIsSaving(true);
    var savePromise = mutateUpdateSettings({ id: userSettings.id, data: { income_sources: editSources } });
    runSaveWithFeedback(savePromise, {
      onClose: onClose,
      onSaved: onSaved,
      setShowSuccess: setShowSaveSuccess,
      message: 'Income Settings Saved!',
      errorMessage: 'Could not save income settings.',
      onError: () => setIsSaving(false)
    }).then(() => setIsSaving(false));
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{
        flex: 1,
        justifyContent: isDesktopWeb ? 'center' : 'flex-end',
        alignItems: isDesktopWeb ? 'center' : 'stretch',
        backgroundColor: 'rgba(0,0,0,0.5)'
      }}>
        <View style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: scale(28),
          borderTopRightRadius: scale(28),
          borderBottomLeftRadius: isDesktopWeb ? scale(28) : 0,
          borderBottomRightRadius: isDesktopWeb ? scale(28) : 0,
          paddingHorizontal: moderateScale(24),
          paddingTop: moderateScale(10),
          paddingBottom: moderateScale(40),
          maxHeight: isDesktopWeb ? '85%' : '92%',
          width: isDesktopWeb ? 550 : '100%',
          position: 'relative',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: isDesktopWeb ? 10 : -4 },
          shadowOpacity: isDesktopWeb ? 0.25 : 0.1,
          shadowRadius: 15,
          elevation: 20
        }}>
          <View style={{ width: scale(40), height: scale(5), backgroundColor: theme.colors.border, borderRadius: scale(3), alignSelf: 'center', marginBottom: moderateScale(15), opacity: 0.8 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(20) }}>
            <Text style={{ fontSize: normalize(20), fontWeight: 'bold', color: theme.colors.textPrimary }}>Income Sources</Text>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={scale(24)} color={theme.colors.textSecondary} /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0, marginBottom: moderateScale(20) }}>
            {editSources.map((source, idx) => (
              <View key={source.id} style={{ backgroundColor: theme.colors.background, padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1, borderColor: theme.colors.border }}>
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <Text style={{ fontSize: 12, fontWeight: 'bold', color: theme.colors.textSecondary }}>SOURCE #{idx + 1}</Text>
                  <TouchableOpacity onPress={() => handleRemoveSource(source.id)}>
                    <MaterialIcons name="delete-outline" size={20} color={theme.colors.error} />
                  </TouchableOpacity>
                </View>
                <TextInput
                  value={source.name}
                  onChangeText={(val) => handleUpdateSource(source.id, 'name', val)}
                  placeholder="Source Name (e.g. Salary, Side Hustle)"
                  style={{ backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: theme.colors.textPrimary, marginBottom: 10 }}
                />
                <AmountInput
                  value={source.amount.toString()}
                  onChangeText={(val) => handleUpdateSource(source.id, 'amount', val)}
                  theme={theme}
                  variant="boxed"
                  placeholder="Monthly Amount"
                />
              </View>
            ))}
            <TouchableOpacity onPress={handleAddSource} style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', padding: 16, borderStyle: 'dashed', borderWidth: 2, borderColor: theme.colors.border, borderRadius: 16 }}>
              <MaterialIcons name="add" size={20} color={theme.colors.primary} style={{ marginRight: 8 }} />
              <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }}>Add Another Income Source</Text>
            </TouchableOpacity>
          </ScrollView>

          <TouchableOpacity onPress={handleSave} disabled={isSaving} style={{ backgroundColor: isSaving ? theme.colors.accent : theme.colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center' }}>
            {isSaving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 16 }}>Save Income Plan</Text>}
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
};

const IncomeManagerModal = function ({ visible, onClose, accounts = [], userSettings, userHistory, theme, insetsBottom, onSaved, onAddAccount, readyToAssign, totalAvailableMoney, envelopes, envelopeBalances, oneTimeExpenses, incomeSources, mutateUpdateSettings }) {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 1024;

  var [showEditSalary, setShowEditSalary] = useState(false);
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);
  var [isSaving, setIsSaving] = useState(false);
  var [selectedAccount, setSelectedAccount] = useState('');
  var [incomeName, setIncomeName] = useState('');
  var [incomeAmount, setIncomeAmount] = useState('');
  var [incomeDate, setIncomeDate] = useState(getTodayStr());

  var insertHistory = useMutation('expense_history', 'insert');
  var mutateInsertHistory = insertHistory.mutate;
  var deleteHistory = useMutation('expense_history', 'delete');
  var mutateDeleteHistory = deleteHistory.mutate;

  useEffect(() => {
    if (visible) {
      setShowSaveSuccess(false);
      setIsSaving(false);
      setIncomeName('');
      setIncomeAmount('');
      setIncomeDate(getTodayStr());
      if (accounts.length > 0) setSelectedAccount(accounts[0].id);
    }
  }, [visible, accounts]);

  var handleQuickDeposit = (source) => {
    if (isSaving || !selectedAccount) return;
    setIsSaving(true);
    var historyId = generateId();
    var acc = accounts.find(a => a.id === selectedAccount);
    var savePromise = mutateInsertHistory({
      id: historyId,
      user_id: userSettings.user_id || userSettings.id,
      expense_name: source.name,
      amount: source.amount,
      date: getTodayStr(),
      expense_type: 'Income',
      category: source.id,
      account_id: selectedAccount,
      status: 'Received',
      notes: 'Logged via Quick Deposit to ' + (acc ? acc.name : 'Wallet')
    });

    runSaveWithFeedback(savePromise, {
      onSaved: onSaved,
      setShowSuccess: setShowSaveSuccess,
      message: 'Income Logged!',
      errorMessage: 'Could not log income.',
      onError: () => setIsSaving(false),
      undo: () => mutateDeleteHistory({ id: historyId }).then(() => onSaved && onSaved())
    }).then(() => setIsSaving(false));
  };

  var handleManualDeposit = () => {
    var val = parseAmount(incomeAmount);
    if (isSaving || !selectedAccount || !incomeName.trim() || val <= 0) return;
    setIsSaving(true);
    var historyId = generateId();
    var acc = accounts.find(a => a.id === selectedAccount);
    var savePromise = mutateInsertHistory({
      id: historyId,
      user_id: userSettings.user_id || userSettings.id,
      expense_name: incomeName.trim(),
      amount: val,
      date: incomeDate,
      expense_type: 'Income',
      category: 'Income',
      account_id: selectedAccount,
      status: 'Received',
      notes: 'Manual Deposit to ' + (acc ? acc.name : 'Wallet')
    });

    runSaveWithFeedback(savePromise, {
      onSaved: onSaved,
      setShowSuccess: setShowSaveSuccess,
      message: 'Income Logged!',
      errorMessage: 'Could not log income.',
      onError: () => setIsSaving(false),
      undo: () => mutateDeleteHistory({ id: historyId }).then(() => onSaved && onSaved())
    }).then(() => {
      setIncomeName('');
      setIncomeAmount('');
      setIsSaving(false);
    });
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{
        flex: 1,
        justifyContent: isDesktopWeb ? 'center' : 'flex-end',
        alignItems: isDesktopWeb ? 'center' : 'stretch',
        backgroundColor: 'rgba(0,0,0,0.5)'
      }}>
        <View style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: scale(28),
          borderTopRightRadius: scale(28),
          borderBottomLeftRadius: isDesktopWeb ? scale(28) : 0,
          borderBottomRightRadius: isDesktopWeb ? scale(28) : 0,
          paddingHorizontal: moderateScale(24),
          paddingTop: moderateScale(10),
          paddingBottom: insetsBottom + moderateScale(40),
          maxHeight: isDesktopWeb ? '85%' : '92%',
          width: isDesktopWeb ? 600 : '100%',
          position: 'relative',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: isDesktopWeb ? 10 : -4 },
          shadowOpacity: isDesktopWeb ? 0.25 : 0.1,
          shadowRadius: 15,
          elevation: 20
        }}>
          <View style={{ width: scale(40), height: scale(5), backgroundColor: theme.colors.border, borderRadius: scale(3), alignSelf: 'center', marginBottom: moderateScale(15), opacity: 0.8 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(20) }}>
            <View>
              <Text style={{ fontSize: normalize(20), fontWeight: 'bold', color: theme.colors.textPrimary }}>Income Manager</Text>
              <Text style={{ fontSize: normalize(12), color: theme.colors.textSecondary, marginTop: 2 }}>Log money coming into your wallets</Text>
            </View>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={scale(24)} color={theme.colors.textSecondary} /></TouchableOpacity>
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0 }}>
            {/* Wallet Selector */}
            <Text style={{ fontSize: normalize(12), fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: 8, letterSpacing: 0.5 }}>DEPOSIT TO WALLET</Text>
            {accounts.length === 0 ? (
               <TouchableOpacity onPress={onAddAccount} style={{ backgroundColor: '#FEF2F2', padding: 16, borderRadius: 12, marginBottom: 20, borderWidth: 1, borderColor: '#FEE2E2', alignItems: 'center' }}>
                 <Text style={{ color: theme.colors.error, fontWeight: 'bold' }}>No wallets found. Add a wallet first!</Text>
               </TouchableOpacity>
            ) : (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 20 }}>
                {accounts.map(acc => {
                  var isSelected = selectedAccount === acc.id;
                  return (
                    <TouchableOpacity key={acc.id} onPress={() => setSelectedAccount(acc.id)} style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: isSelected ? theme.colors.primary : theme.colors.background, paddingHorizontal: 14, paddingVertical: 10, borderRadius: 12, marginRight: 8, borderWidth: 1, borderColor: isSelected ? theme.colors.primary : theme.colors.border }}>
                      <BrandLogo type={acc.type} size={14} style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: isSelected ? '#FFFFFF' : theme.colors.textPrimary }}>{acc.name}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}

            {/* Quick Deposits */}
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <Text style={{ fontSize: normalize(12), fontWeight: 'bold', color: theme.colors.textSecondary, letterSpacing: 0.5 }}>QUICK DEPOSIT SOURCES</Text>
              <TouchableOpacity onPress={() => setShowEditSalary(true)}>
                <Text style={{ fontSize: 12, color: theme.colors.primary, fontWeight: 'bold' }}>Edit Sources</Text>
              </TouchableOpacity>
            </View>

            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10, marginBottom: 24 }}>
              {incomeSources.map(src => (
                <TouchableOpacity key={src.id} onPress={() => handleQuickDeposit(src)} style={{ flexBasis: '48%', backgroundColor: theme.colors.background, padding: 16, borderRadius: 16, borderWidth: 1, borderColor: theme.colors.border }}>
                  <Text style={{ fontSize: 14, fontWeight: 'bold', color: theme.colors.textPrimary }} numberOfLines={1}>{src.name}</Text>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: '#16A34A', marginTop: 4 }}>{formatCurrency(src.amount)}</Text>
                  <View style={{ position: 'absolute', right: 12, bottom: 12, width: 24, height: 24, borderRadius: 12, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center' }}>
                    <MaterialIcons name="add" size={16} color="#16A34A" />
                  </View>
                </TouchableOpacity>
              ))}
            </View>

            {/* Manual Entry */}
            <Text style={{ fontSize: normalize(12), fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: 12, letterSpacing: 0.5 }}>MANUAL DEPOSIT</Text>
            <View style={{ backgroundColor: theme.colors.background, padding: 18, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border, marginBottom: 20 }}>
              <TextInput
                value={incomeName}
                onChangeText={setIncomeName}
                placeholder="Description (e.g. Gift, Refund)"
                style={{ backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 12, fontSize: 14, color: theme.colors.textPrimary, marginBottom: 10 }}
              />
              <AmountInput value={incomeAmount} onChangeText={setIncomeAmount} theme={theme} variant="boxed" containerStyle={{ marginBottom: 14 }} />
              <DatePickerInput value={incomeDate} onChange={setIncomeDate} placeholder="Received Date" />
              <TouchableOpacity onPress={handleManualDeposit} style={{ backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginTop: 16 }}>
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Log Manual Income</Text>
              </TouchableOpacity>
            </View>
          </ScrollView>

          <EditSalaryModal visible={showEditSalary} onClose={() => setShowEditSalary(false)} incomeSources={incomeSources} userSettings={userSettings} mutateUpdateSettings={mutateUpdateSettings} onSaved={onSaved} theme={theme} />
          <SaveSuccessOverlay visible={showSaveSuccess} theme={theme} message="Income Logged!" />
        </View>
      </View>
    </Modal>
  );
};

const SpentManagerModal = function ({ visible, onClose, filter, oneTimeExpenses, envelopes, userId, theme, insetsTop, insetsBottom, onSaved, userHistory, recurringExpenses, accounts }) {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 1024;

  var [editingId, setEditingId] = useState(null);
  var [editName, setEditName] = useState('');
  var [editAmount, setEditAmount] = useState('');
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);
  var [successMessage, setSuccessMessage] = useState('Saved!');
  var [isSaving, setIsSaving] = useState(false);
  var [searchQuery, setSearchQuery] = useState('');

  useEffect(() => {
    if (!visible) {
      setEditingId(null);
      setEditName('');
      setEditAmount('');
      setShowSaveSuccess(false);
      setSuccessMessage('Saved!');
      setIsSaving(false);
      setSearchQuery('');
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
    var result = filter ? combined.filter(function (o) { return o.category === filter; }) : combined;

    if (searchQuery.trim()) {
      var q = searchQuery.toLowerCase().trim();
      result = result.filter(function (exp) {
        var env = envelopes.find(function (e) { return e.id === exp.category; });
        var envName = env ? env.name.toLowerCase() : '';
        return exp.name.toLowerCase().includes(q) || envName.includes(q);
      });
    }

    return result;
  }, [oneTimeExpenses, userHistory, recurringExpenses, filter, searchQuery, envelopes]);

  var handleStartEdit = function (exp) {
    setEditingId(exp.id);
    setEditName(exp.name);
    setEditAmount(formatAmountForEdit(exp.amount));
  };

  var handleSaveEdit = function (exp) {
    if (isSaving) return;
    var amt = parseAmount(editAmount);
    if (!editName.trim()) {
      return Alert.alert('Error', 'Please enter a name.');
    }
    if (amt <= 0) {
      return Alert.alert('Error', 'Please enter a valid amount.');
    }

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
      return Alert.alert('Error', spendCheck.message);
    }

    var updateData = {
      expense_name: editName.trim(),
      name: editName.trim(),
      amount: amt
    };

    var savePromise = mutateUpdateHistory({ id: exp.id, data: updateData });

    setIsSaving(true);
    runSaveWithFeedback(savePromise, {
      onSaved: onSaved,
      setShowSuccess: setShowSaveSuccess,
      setSuccessMessage: setSuccessMessage,
      message: 'Expense updated!',
      errorMessage: 'Could not update expense.',
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
        errorMessage: 'Could not delete expense.',
        onError: () => setIsSaving(false)
      }).then(() => setIsSaving(false));
    };
    Alert.alert('Delete Expense', msg, [
      { text: 'Cancel' },
      { text: 'Delete', style: 'destructive', onPress: doDelete }
    ]);
  };

  if (!visible) return null;

  var filterEnv = envelopes.find(function (e) { return e.id === filter; });
  var title = filterEnv ? filterEnv.name + ' Spending' : "This Month's Spending";

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{
        flex: 1,
        justifyContent: isDesktopWeb ? 'center' : 'flex-end',
        alignItems: isDesktopWeb ? 'center' : 'stretch',
        backgroundColor: 'rgba(0,0,0,0.5)'
      }}>
        <View style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: scale(28),
          borderTopRightRadius: scale(28),
          borderBottomLeftRadius: isDesktopWeb ? scale(28) : 0,
          borderBottomRightRadius: isDesktopWeb ? scale(28) : 0,
          paddingHorizontal: moderateScale(24),
          paddingTop: moderateScale(10),
          paddingBottom: insetsBottom + moderateScale(40),
          maxHeight: isDesktopWeb ? '85%' : '85%',
          width: isDesktopWeb ? 600 : '100%',
          position: 'relative',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: isDesktopWeb ? 10 : -4 },
          shadowOpacity: isDesktopWeb ? 0.25 : 0.1,
          shadowRadius: 15,
          elevation: 20
        }}>
          <View style={{ width: scale(40), height: scale(5), backgroundColor: theme.colors.border, borderRadius: scale(3), alignSelf: 'center', marginBottom: moderateScale(15), opacity: 0.8 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(15) }}>
            <Text style={{ fontSize: normalize(18), fontWeight: 'bold', color: theme.colors.textPrimary }}>{title}</Text>
            <TouchableOpacity onPress={onClose} hitSlop={{top: 10, bottom: 10, left: 10, right: 10}}><MaterialIcons name="close" size={scale(24)} color={theme.colors.textSecondary} /></TouchableOpacity>
          </View>

          <View style={{
            flexDirection: 'row',
            alignItems: 'center',
            backgroundColor: theme.isDark ? 'rgba(255,255,255,0.05)' : '#F3F4F6',
            borderRadius: scale(16),
            paddingHorizontal: moderateScale(14),
            marginBottom: moderateScale(20),
            borderWidth: 1,
            borderColor: theme.colors.border,
            height: scale(46),
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 2 },
            shadowOpacity: 0.03,
            shadowRadius: 4,
            elevation: 1
          }}>
            <MaterialIcons name="search" size={scale(20)} color={theme.colors.primary} style={{ marginRight: 8 }} />
            <TextInput
              value={searchQuery}
              onChangeText={setSearchQuery}
              placeholder="Find a transaction..."
              placeholderTextColor={theme.colors.textSecondary}
              style={{ flex: 1, color: theme.colors.textPrimary, fontSize: normalize(15), fontWeight: '500', paddingVertical: 0 }}
            />
            {searchQuery.length > 0 && (
              <TouchableOpacity onPress={() => { triggerImpactHaptic('Light'); setSearchQuery(''); }} style={{ padding: 4 }}>
                <MaterialIcons name="close" size={scale(18)} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            )}
          </View>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0, maxHeight: scale(400) }}>
            {filteredExpenses.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: moderateScale(40) }}>
                <MaterialIcons name="shopping-bag" size={scale(44)} color={theme.colors.border} />
                <Text style={{ color: theme.colors.textSecondary, marginTop: moderateScale(12), fontSize: normalize(14) }}>No spent items found</Text>
              </View>
            ) : (
              filteredExpenses.map(function (exp) {
                var isEditing = editingId === exp.id;
                var env = envelopes.find(function (e) { return e.id === exp.category; });
                return (
                  <View key={exp.id} style={{ backgroundColor: theme.colors.background, borderRadius: scale(12), padding: moderateScale(14), marginBottom: moderateScale(10), borderWidth: 1, borderColor: theme.colors.border }}>
                    {isEditing ? (
                      <View>
                        <TextInput
                          value={editName} onChangeText={setEditName} placeholder="Name"
                          placeholderTextColor={theme.isDark ? '#6B7280' : '#9CA3AF'}
                          style={{ backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: scale(8), paddingHorizontal: moderateScale(10), paddingVertical: moderateScale(6), fontSize: normalize(14), color: theme.colors.textPrimary, marginBottom: moderateScale(8) }}
                        />
                        <AmountInput value={editAmount} onChangeText={setEditAmount} theme={theme} variant="boxed" fontSize={normalize(14)} containerStyle={{ flex: 1, marginBottom: 0 }} placeholder="0.00" />
                        <View style={{ flexDirection: 'row', gap: moderateScale(8), marginTop: moderateScale(8) }}>
                          <TouchableOpacity onPress={() => handleSaveEdit(exp)} style={{ backgroundColor: theme.colors.primary, borderRadius: scale(8), paddingHorizontal: moderateScale(12), justifyContent: 'center' }}>
                            <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: normalize(13) }}>Save</Text>
                          </TouchableOpacity>
                          <TouchableOpacity onPress={() => setEditingId(null)} style={{ backgroundColor: theme.colors.border, borderRadius: scale(8), paddingHorizontal: moderateScale(10), justifyContent: 'center' }}>
                            <Text style={{ color: theme.colors.textSecondary, fontSize: normalize(13) }}>Cancel</Text>
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                        <View style={{ flex: 1 }}>
                          <Text style={{ fontSize: normalize(15), fontWeight: '600', color: theme.colors.textPrimary }}>{exp.name}</Text>
                          <Text style={{ fontSize: normalize(12), color: theme.colors.textSecondary, marginTop: 2 }}>{formatDate(exp.date)} {env ? ' • ' + env.name : ''}</Text>
                        </View>
                        <View style={{ alignItems: 'flex-end' }}>
                          <Text style={{ fontSize: normalize(15), fontWeight: 'bold', color: '#DC2626', marginBottom: moderateScale(6) }}>-{formatCurrency(exp.amount)}</Text>
                          <View style={{ flexDirection: 'row', gap: moderateScale(8) }}>
                            <TouchableOpacity onPress={() => handleStartEdit(exp)} style={{ padding: scale(4), backgroundColor: '#FFEDD5', borderRadius: scale(6) }}>
                              <MaterialIcons name="edit" size={scale(16)} color={theme.colors.primary} />
                            </TouchableOpacity>
                            <TouchableOpacity onPress={() => handleDelete(exp)} style={{ padding: scale(4), backgroundColor: '#FEF2F2', borderRadius: scale(6) }}>
                              <MaterialIcons name="delete-outline" size={scale(16)} color={theme.colors.error} />
                            </TouchableOpacity>
                          </View>
                        </View>
                      </View>
                    )}
                  </View>
                );
              })
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const QuickAddBudgetModal = function ({ visible, onClose, envelope, readyToAssign, envelopes, userSettings, mutateUpdateSettings, onSaved, theme, setSelectedEnvelope, setShowEditEnvModal, userId }) {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 1024;

  var [amount, setAmount] = useState('');
  var [mode, setMode] = useState('add');
  var [errorMsg, setErrorMsg] = useState('');
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);
  var [isSaving, setIsSaving] = useState(false);

  var insertHistory = useMutation('expense_history', 'insert');
  var mutateInsertHistory = insertHistory.mutate;
  var deleteHistory = useMutation('expense_history', 'delete');
  var mutateDeleteHistory = deleteHistory.mutate;

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

  var currentAssigned = parseFloat(envelope.assigned) || 0;
  var currentAvailable = parseFloat(envelope.available) !== undefined ? parseFloat(envelope.available) : currentAssigned;
  var amtVal = parseAmount(amount);
  
  var newAssigned = mode === 'add' ? (currentAssigned + amtVal) : (currentAssigned - amtVal);
  var remainingRta = mode === 'add' ? (readyToAssign - amtVal) : (readyToAssign + amtVal);

  var handleConfirm = function () {
    if (isSaving || !amount.trim() || isNaN(amtVal) || amtVal <= 0) return;
    if (mode === 'add' && remainingRta < 0) return setErrorMsg('Not enough RTA money!');
    if (mode === 'reduce' && newAssigned < 0) return setErrorMsg('Assigned budget cannot be negative!');

    var newEnvelopes = envelopes.map(e => {
      if (e.id === envelope.id) return { ...e, assigned: newAssigned };
      return e;
    });

    if (userSettings) {
      var historyId = generateId();
      setIsSaving(true);
      var savePromise = mutateUpdateSettings({ id: userSettings.id, data: { envelopes: newEnvelopes } }).then(() => {
        return mutateInsertHistory({
          id: historyId,
          user_id: userId,
          expense_name: (mode === 'add' ? 'Added to ' : 'Reduced ') + envelope.name,
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
        errorMessage: 'Could not update budget.',
        onError: () => setIsSaving(false)
      }).then(() => setIsSaving(false));
    }
  };

  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={{
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(0,0,0,0.6)',
        padding: moderateScale(16)
      }}>
        <View style={{
          backgroundColor: theme.colors.card,
          borderRadius: scale(20),
          padding: moderateScale(20),
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.1,
          shadowRadius: 12,
          elevation: 5,
          maxHeight: '90%',
          width: isDesktopWeb ? 500 : '100%',
          position: 'relative',
          overflow: 'hidden'
        }}>
          
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(16) }}>
            <Text style={{ fontSize: normalize(18), fontWeight: 'bold', color: theme.colors.textPrimary }}>Adjust Budget: {envelope.name}</Text>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: moderateScale(12) }}>
              <TouchableOpacity onPress={() => { onClose(); setSelectedEnvelope(envelope); setShowEditEnvModal(true); }} style={{ padding: scale(4) }}>
                <MaterialIcons name="edit" size={scale(20)} color={theme.colors.textSecondary} />
              </TouchableOpacity>
              <TouchableOpacity onPress={onClose} style={{ padding: scale(4) }}>
                <MaterialIcons name="close" size={scale(24)} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>
          </View>

          <View style={{ flexDirection: 'row', backgroundColor: theme.colors.background, borderRadius: scale(12), padding: scale(4), marginBottom: moderateScale(14), borderWidth: 1, borderColor: theme.colors.border }}>
            <TouchableOpacity onPress={() => setMode('add')} style={{ flex: 1, paddingVertical: moderateScale(10), alignItems: 'center', backgroundColor: mode === 'add' ? theme.colors.primary : 'transparent', borderRadius: scale(8) }}>
              <Text style={{ fontWeight: 'bold', fontSize: normalize(13), color: mode === 'add' ? '#FFFFFF' : theme.colors.textSecondary }}>ADD FUNDS</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => setMode('reduce')} style={{ flex: 1, paddingVertical: moderateScale(10), alignItems: 'center', backgroundColor: mode === 'reduce' ? theme.colors.error : 'transparent', borderRadius: scale(8) }}>
              <Text style={{ fontWeight: 'bold', fontSize: normalize(13), color: mode === 'reduce' ? '#FFFFFF' : theme.colors.textSecondary }}>REDUCE FUNDS</Text>
            </TouchableOpacity>
          </View>

          {errorMsg ? (
            <View style={{ backgroundColor: '#FEE2E2', borderRadius: scale(8), padding: moderateScale(10), marginBottom: moderateScale(12) }}>
              <Text style={{ color: '#DC2626', fontSize: normalize(13), fontWeight: 'bold' }}>{errorMsg}</Text>
            </View>
          ) : null}

          <View style={{ backgroundColor: theme.colors.background, borderRadius: scale(12), padding: moderateScale(12), marginBottom: moderateScale(14), borderWidth: 1, borderColor: theme.colors.border }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 4 }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: normalize(13) }}>Ready to Assign</Text>
              <Text style={{ color: '#16A34A', fontSize: normalize(13), fontWeight: 'bold' }}>{formatCurrency(readyToAssign)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: theme.colors.textSecondary, fontSize: normalize(13) }}>{mode === 'add' ? 'Remaining RTA' : 'New RTA Balance'}</Text>
              <Text style={{ color: remainingRta < 0 ? '#DC2626' : '#16A34A', fontSize: normalize(13), fontWeight: 'bold' }}>{formatCurrency(remainingRta)}</Text>
            </View>
          </View>

          <Text style={{ fontSize: normalize(12), fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: scale(6), textTransform: 'uppercase' }}>Amount to {mode === 'add' ? 'Add' : 'Reduce'}</Text>
          <AmountInput value={amount} onChangeText={setAmount} theme={theme} containerStyle={{ marginBottom: moderateScale(18) }} />

          <TouchableOpacity disabled={isSaving} onPress={handleConfirm} style={{ backgroundColor: (isSaving) ? theme.colors.accent : (mode === 'add' ? theme.colors.primary : theme.colors.error), borderRadius: scale(12), paddingVertical: moderateScale(12), alignItems: 'center', marginBottom: moderateScale(16) }}>
            {isSaving ? <ActivityIndicator color="#FFFFFF" size="small" /> : <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: normalize(15) }}>{mode === 'add' ? 'Add to Envelope' : 'Return to Ready to Assign'}</Text>}
          </TouchableOpacity>

          <SaveSuccessOverlay visible={showSaveSuccess} theme={theme} message="Budget updated!" />
        </View>
      </View>
    </Modal>
  );
};

const ArchiveManagerModal = function ({ visible, onClose, envelopes, userSettings, mutateUpdateSettings, onSaved, theme }) {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 1024;
  const insets = useSafeAreaInsets();
  var [isSaving, setIsSaving] = useState(false);
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);

  var archivedEnvelopes = useMemo(() => {
    return (envelopes || []).filter(isEnvelopeArchived);
  }, [envelopes]);

  var handleRestore = function (env) {
    if (isSaving) return;
    var activeEnvs = (envelopes || []).filter(e => !isEnvelopeArchived(e));
    if (activeEnvs.find(e => e.name.toLowerCase() === env.name.trim().toLowerCase())) {
      return Alert.alert('Error', 'An active envelope with the name "' + env.name + '" already exists. Please rename or delete the active one before restoring this.');
    }
    var newList = envelopes.map(e => {
      if (e.id === env.id) return { ...e, isArchived: false, archived: false, is_archived: false };
      return e;
    });
    if (userSettings) {
      setIsSaving(true);
      var savePromise = mutateUpdateSettings({ id: userSettings.id, data: { envelopes: newList } });
      runSaveWithFeedback(savePromise, {
        onSaved: onSaved,
        setShowSuccess: setShowSaveSuccess,
        message: 'Envelope Restored!',
        errorMessage: 'Could not restore.',
        onError: () => setIsSaving(false)
      }).then(() => {
        setIsSaving(false);
        if (archivedEnvelopes.length <= 1) onClose();
      });
    }
  };

  if (!visible) return null;

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{
        flex: 1,
        justifyContent: isDesktopWeb ? 'center' : 'flex-end',
        alignItems: isDesktopWeb ? 'center' : 'stretch',
        backgroundColor: 'rgba(0,0,0,0.5)'
      }}>
        <View style={{
          backgroundColor: theme.colors.card,
          borderTopLeftRadius: scale(28),
          borderTopRightRadius: scale(28),
          borderBottomLeftRadius: isDesktopWeb ? scale(28) : 0,
          borderBottomRightRadius: isDesktopWeb ? scale(28) : 0,
          paddingHorizontal: moderateScale(24),
          paddingTop: moderateScale(10),
          paddingBottom: insets.bottom + moderateScale(40),
          maxHeight: isDesktopWeb ? '85%' : '92%',
          width: isDesktopWeb ? 550 : '100%',
          position: 'relative',
          overflow: 'hidden',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: isDesktopWeb ? 10 : -4 },
          shadowOpacity: isDesktopWeb ? 0.25 : 0.1,
          shadowRadius: 15,
          elevation: 20
        }}>
          <View style={{ width: scale(40), height: scale(5), backgroundColor: theme.colors.border, borderRadius: scale(3), alignSelf: 'center', marginBottom: moderateScale(15), opacity: 0.8 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(20) }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
              <MaterialIcons name="archive" size={scale(24)} color={theme.colors.primary} />
              <Text style={{ fontSize: normalize(20), fontWeight: 'bold', color: theme.colors.textPrimary }}>Envelope Archive</Text>
            </View>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={scale(24)} color={theme.colors.textSecondary} /></TouchableOpacity>
          </View>

          <Text style={{ fontSize: normalize(13), color: theme.colors.textSecondary, marginBottom: 20, lineHeight: 18 }}>
            These are your retired budget categories. Restoring them will bring back their history to your dashboard.
          </Text>

          <ScrollView showsVerticalScrollIndicator={false} style={{ flexGrow: 0, maxHeight: scale(400) }}>
            {archivedEnvelopes.length === 0 ? (
              <View style={{ alignItems: 'center', paddingVertical: 40 }}>
                <MaterialIcons name="folder-zip" size={48} color={theme.colors.border} />
                <Text style={{ color: theme.colors.textSecondary, marginTop: 12 }}>No archived envelopes yet.</Text>
              </View>
            ) : (
              archivedEnvelopes.map(env => (
                <View key={env.id} style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  backgroundColor: theme.colors.background,
                  padding: 16,
                  borderRadius: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: theme.colors.border
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 12 }}>
                    <View style={{ backgroundColor: theme.colors.primary + '15', padding: scale(8), borderRadius: scale(10) }}>
                      <MaterialIcons name={getEnvelopeIcon(env.name)} size={scale(18)} color={theme.colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.textPrimary }} numberOfLines={1}>{env.name}</Text>
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => handleRestore(env)}
                    disabled={isSaving}
                    style={{ backgroundColor: theme.colors.primary, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 10 }}
                  >
                    <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 }}>Restore</Text>
                  </TouchableOpacity>
                </View>
              ))
            )}
          </ScrollView>
          <SaveSuccessOverlay visible={showSaveSuccess} theme={theme} message="Envelope Restored!" />
        </View>
      </View>
    </Modal>
  );
};

const PremiumPaywallModal = function ({ visible, onClose, theme, userSettings, mutateUpdateSettings, onSaved }) {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 1024;
  const insets = useSafeAreaInsets();
  const [isActivating, setIsActivating] = useState(false);

  if (!visible) return null;

  const handleTestActivation = async () => {
    if (!userSettings) return;
    setIsActivating(true);

    // Developer Backdoor: Instantly grant premium for testing
    try {
      await mutateUpdateSettings({
        id: userSettings.id,
        data: { is_premium: true }
      });
      if (onSaved) onSaved();
      triggerImpactHaptic('Heavy');
      Alert.alert("Premium Unlocked!", "Developer mode: You now have full access to Luxe features.");
      onClose();
    } catch (e) {
      Alert.alert("Error", "Could not unlock premium.");
    } finally {
      setIsActivating(false);
    }
  };

  const features = [
    { icon: 'account-balance-wallet', text: 'Unlimited Wallets & Bank Accounts', sub: 'Track every single account you own.' },
    { icon: 'insert-chart', text: 'Advanced Analytics', sub: 'Deep dive into your spending habits.' },
    { icon: 'security', text: 'Biometric Security', sub: 'Lock your data with Fingerprint/FaceID.' },
    { icon: 'file-download', text: 'PDF & Excel Exports', sub: 'Professional reports for your finances.' },
    { icon: 'palette', text: 'Exclusive Premium Themes', sub: 'Emerald, Gold, and Midnight designs.' }
  ];

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: isDesktopWeb ? 'center' : 'flex-end', alignItems: isDesktopWeb ? 'center' : 'stretch', backgroundColor: 'rgba(0,0,0,0.7)' }}>
        <View style={{
          backgroundColor: '#064E3B', // Deep Emerald Green
          borderTopLeftRadius: scale(32),
          borderTopRightRadius: scale(32),
          borderBottomLeftRadius: isDesktopWeb ? scale(32) : 0,
          borderBottomRightRadius: isDesktopWeb ? scale(32) : 0,
          paddingHorizontal: moderateScale(24),
          paddingTop: moderateScale(10),
          paddingBottom: insets.bottom + moderateScale(30),
          maxHeight: isDesktopWeb ? '85%' : '95%',
          width: isDesktopWeb ? 500 : '100%',
          overflow: 'hidden'
        }}>
          {/* Gold Decorative Gradient Background */}
          <View style={{ position: 'absolute', top: -100, right: -100, width: 300, height: 300, borderRadius: 150, backgroundColor: '#B45309', opacity: 0.2 }} />

          <View style={{ width: scale(40), height: scale(5), backgroundColor: 'rgba(255,255,255,0.3)', borderRadius: scale(3), alignSelf: 'center', marginBottom: moderateScale(20) }} />

          <ScrollView showsVerticalScrollIndicator={false}>
            <View style={{ alignItems: 'center', marginBottom: 24 }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: '#F59E0B', alignItems: 'center', justifyContent: 'center', marginBottom: 16, shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.5, shadowRadius: 10 }}>
                <MaterialIcons name="workspace-premium" size={48} color="#FFFFFF" />
              </View>
              <Text style={{ fontSize: normalize(24), fontWeight: '900', color: '#FFFFFF', textAlign: 'center' }}>Upgrade to Premium</Text>
              <Text style={{ fontSize: normalize(14), color: '#D1FAE5', textAlign: 'center', marginTop: 4 }}>Unlock the full potential of Budget-Wise</Text>
            </View>

            {features.map((f, i) => (
              <View key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 20 }}>
                <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(255,255,255,0.1)', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                  <MaterialIcons name={f.icon} size={20} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 15, fontWeight: 'bold', color: '#FFFFFF' }}>{f.text}</Text>
                  <Text style={{ fontSize: 12, color: '#A7F3D0' }}>{f.sub}</Text>
                </View>
              </View>
            ))}

            <View style={{ backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: 20, padding: 20, marginVertical: 10, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)', alignItems: 'center' }}>
               <Text style={{ color: '#F59E0B', fontWeight: 'bold', fontSize: 18 }}>₱99.00 / Lifetime</Text>
               <Text style={{ color: '#D1FAE5', fontSize: 12, marginTop: 4 }}>One-time payment. No subscriptions.</Text>
            </View>
          </ScrollView>

          <View style={{ marginTop: 20 }}>
            <TouchableOpacity
              onPress={handleTestActivation}
              disabled={isActivating}
              style={{ backgroundColor: '#F59E0B', borderRadius: 16, paddingVertical: 16, alignItems: 'center', shadowColor: '#F59E0B', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 5 }}
            >
              {isActivating ? <ActivityIndicator color="#FFFFFF" /> : <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>GET PREMIUM ACCESS</Text>}
            </TouchableOpacity>

            <TouchableOpacity onPress={onClose} style={{ marginTop: 16, alignItems: 'center' }}>
              <Text style={{ color: '#D1FAE5', fontSize: 14, fontWeight: '600' }}>Not now, I'll stay with Basic</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export {
  AssignMoneyModal,
  AddEnvelopeModal,
  ArchiveManagerModal,
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
  QuickAddBudgetModal,
  PremiumPaywallModal
};

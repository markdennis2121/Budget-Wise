import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, TextInput, Modal, ScrollView, Alert, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useQuery, useMutation } from 'platform-hooks';
import { primaryColor, textPrimary, textSecondary, backgroundColor, cardColor, dangerColor } from '../contexts/ThemeContext';
import { generateId, getTodayStr, getCurrentMonthStr, getMonthStr } from '../utils/helpers';
import DatePickerInput from './DatePickerInput';
import { scheduleBillNotification } from '../utils/notifications';
import BrandLogo from './BrandLogo';

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

const AddExpenseModal = function (props) {
  var visible = props.visible;
  var onClose = props.onClose;
  var onSaved = props.onSaved;
  var userId = props.userId;
  var theme = props.theme;
  var insetsTop = props.insetsTop;
  var insetsBottom = props.insetsBottom;

  var [expType, setExpType] = useState('one_time');
  var [expName, setExpName] = useState('');
  var [expAmount, setExpAmount] = useState('');
  var [expDate, setExpDate] = useState(getTodayStr());
  var [dueDate, setDueDate] = useState(getTodayStr());
  var [errorMsg, setErrorMsg] = useState('');
  var [selectedFund, setSelectedFund] = useState('');
  var [destAccount, setDestAccount] = useState('');

  var insertRecurring = useMutation('recurring_expenses', 'insert');
  var mutateRecurring = insertRecurring.mutate;
  var insertOneTime = useMutation('one_time_expenses', 'insert');
  var mutateOneTime = insertOneTime.mutate;
  var insertHistory = useMutation('expense_history', 'insert');
  var mutateHistory = insertHistory.mutate;

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

  // Calculate Envelope Balances
  var envelopes = useMemo(function () {
    var envs = [];
    if (userSettings && userSettings.envelopes) {
      envs = typeof userSettings.envelopes === 'string' ? JSON.parse(userSettings.envelopes) : userSettings.envelopes;
    } else {
      envs = [
        { id: 'env-housing', name: 'Housing', assigned: 0 },
        { id: 'env-food', name: 'Food', assigned: 0 },
        { id: 'env-transport', name: 'Transport', assigned: 0 },
        { id: 'env-savings', name: 'Savings', assigned: 0 },
      ];
    }

    var balances = envs.map(e => ({ ...e, assigned: parseFloat(e.assigned) || 0, spent: 0 }));

    recurringExpenses.forEach(r => {
      if (r.status === 'Paid' || r.status === 'Paid in Advance') {
        var env = balances.find(e => e.id === r.category || e.name === r.category);
        if (env) env.spent += (parseFloat(r.amount) || 0);
      }
    });
    oneTimeExpenses.forEach(o => {
      var env = balances.find(e => e.id === o.category || e.name === o.category);
      if (env) env.spent += (parseFloat(o.amount) || 0);
    });

    return balances.map(e => ({ ...e, available: e.assigned - e.spent }));
  }, [userSettings, recurringExpenses, oneTimeExpenses]);

  var incomeSources = useMemo(function () {
    if (userSettings && userSettings.income_sources) {
      return typeof userSettings.income_sources === 'string' ? JSON.parse(userSettings.income_sources) : userSettings.income_sources;
    }
    var sal = userSettings ? (parseFloat(userSettings.monthly_salary) || 0) : 0;
    return [{ id: 'main-salary', name: 'Main Salary', amount: sal }];
  }, [userSettings]);

  var optionsList = expType === 'income' ? incomeSources : envelopes;
  var accounts = props.accounts || [];
  var [selectedAccount, setSelectedAccount] = useState('');

  useEffect(() => {
    if (visible && optionsList.length > 0 && !selectedFund) {
      setSelectedFund(optionsList[0].id);
    }
  }, [visible, optionsList, selectedFund]);

  useEffect(() => {
    if (visible) {
      setSelectedAccount('unlinked');
      setDestAccount('');
    }
  }, [visible]);

  var handleSave = function () {
    if (!expName.trim()) { setErrorMsg('Please enter name.'); return; }
    var amt = parseFloat(expAmount);
    if (isNaN(amt) || amt <= 0) { setErrorMsg('Please enter a valid amount.'); return; }
    setErrorMsg('');

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
      mutateHistory({
        id: expId,
        user_id: userId,
        expense_name: expName.trim(),
        amount: amt,
        expense_type: 'Transfer',
        date: expDate,
        status: 'Spent',
        notes: timeStr + ' • Wallet Transfer: ' + srcAcc.name + ' ➔ ' + destAcc.name,
        account_id: selectedAccount,
        dest_account_id: destAccount
      }).then(function () {
        setExpName(''); setExpAmount(''); setExpDate(getTodayStr()); setSelectedAccount(''); setDestAccount(''); onSaved(); onClose();
      }).catch(function () { setErrorMsg('Failed to save transfer. Try again.'); });
      return;
    }

    var selectedItem = optionsList.find(o => o.id === selectedFund);
    var fundName = selectedItem ? selectedItem.name : 'Unknown';

    if (expType !== 'income') {
      var env = envelopes.find(e => e.id === selectedFund);
      if (env && env.available < amt) {
        setErrorMsg(`Insufficient funds in ${env.name}. Available: ${env.available}`);
        return;
      }
    }

    var selectedAcc = accounts.find(a => a.id === selectedAccount);
    var accName = selectedAcc ? selectedAcc.name : 'Wallet';

    var timeStr = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

    if (expType === 'one_time') {
      var expId = generateId();
      var newOneTime = { id: expId, user_id: userId, name: expName.trim(), amount: amt, date: expDate, category: selectedFund, account_id: selectedAccount };
      mutateOneTime(newOneTime).then(function () {
        return mutateHistory({ id: expId, user_id: userId, expense_name: expName.trim(), amount: amt, expense_type: 'One-Time', date: expDate, status: 'Spent', notes: timeStr + ' • Env: ' + fundName + ' • Paid via: ' + accName, account_id: selectedAccount });
      }).then(function () {
        setExpName(''); setExpAmount(''); setExpDate(getTodayStr()); setSelectedAccount(''); onSaved(); onClose();
      }).catch(function () { setErrorMsg('Failed to save. Try again.'); });
    } else if (expType === 'recurring') {
      var newRecurring = { id: generateId(), user_id: userId, name: expName.trim(), amount: amt, due_date: dueDate, status: 'Pending', category: selectedFund, account_id: selectedAccount };
      mutateRecurring(newRecurring).then(function () {
        scheduleBillNotification(newRecurring);
        setExpName(''); setExpAmount(''); setDueDate(getTodayStr()); setSelectedAccount(''); onSaved(); onClose();
      }).catch(function () { setErrorMsg('Failed to save. Try again.'); });
    } else if (expType === 'income') {
      var expId = generateId();
      mutateHistory({ id: expId, user_id: userId, expense_name: expName.trim(), amount: amt, expense_type: 'Income', date: expDate, status: 'Received', notes: timeStr + ' • Source: ' + fundName + ' • To: ' + accName, category: selectedFund, account_id: selectedAccount })
        .then(function () {
          setExpName(''); setExpAmount(''); setExpDate(getTodayStr()); setSelectedAccount(''); onSaved(); onClose();
        }).catch(function () { setErrorMsg('Failed to save. Try again.'); });
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)', marginTop: insetsTop }}>
        <View style={{ backgroundColor: cardColor, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: insetsBottom + 24, maxHeight: '90%' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: textPrimary }}>{expType === 'income' ? 'Add Income' : 'Add Expense'}</Text>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={24} color={textSecondary} /></TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
            <View style={{ flexDirection: 'row', backgroundColor: backgroundColor, borderRadius: 12, padding: 4, marginBottom: 20 }}>
              <TouchableOpacity onPress={() => setExpType('one_time')} style={{ flex: 1, padding: 8, borderRadius: 10, alignItems: 'center', backgroundColor: expType === 'one_time' ? primaryColor : 'transparent' }}>
                <Text style={{ color: expType === 'one_time' ? '#FFFFFF' : textSecondary, fontWeight: '600', fontSize: 13 }}>One-Time</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setExpType('recurring')} style={{ flex: 1, padding: 8, borderRadius: 10, alignItems: 'center', backgroundColor: expType === 'recurring' ? primaryColor : 'transparent' }}>
                <Text style={{ color: expType === 'recurring' ? '#FFFFFF' : textSecondary, fontWeight: '600', fontSize: 13 }}>Recurring</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setExpType('income')} style={{ flex: 1, padding: 8, borderRadius: 10, alignItems: 'center', backgroundColor: expType === 'income' ? primaryColor : 'transparent' }}>
                <Text style={{ color: expType === 'income' ? '#FFFFFF' : textSecondary, fontWeight: '600', fontSize: 13 }}>Income</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setExpType('transfer')} style={{ flex: 1, padding: 8, borderRadius: 10, alignItems: 'center', backgroundColor: expType === 'transfer' ? primaryColor : 'transparent' }}>
                <Text style={{ color: expType === 'transfer' ? '#FFFFFF' : textSecondary, fontWeight: '600', fontSize: 13 }}>Transfer</Text>
              </TouchableOpacity>
            </View>

            {errorMsg ? (
              <View style={{ backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10, marginBottom: 14 }}>
                <Text style={{ color: dangerColor, fontSize: 13 }}>{errorMsg}</Text>
              </View>
            ) : null}

            <Text style={{ fontSize: 13, fontWeight: '600', color: textSecondary, marginBottom: 6 }}>
              {expType === 'income' ? 'INCOME NAME' : (expType === 'transfer' ? 'TRANSFER REMARK' : 'EXPENSE NAME')}
            </Text>
            <TextInput value={expName} onChangeText={setExpName} placeholder={expType === 'income' ? 'e.g. Freelance, Side Hustle' : (expType === 'transfer' ? 'e.g. BPI to GCash Transfer, GCash Cashout' : 'e.g. Rent, Groceries')} autoCapitalize="words" style={{ backgroundColor: backgroundColor, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 14, fontSize: 15, color: textPrimary, marginBottom: 16 }} />

            <Text style={{ fontSize: 13, fontWeight: '600', color: textSecondary, marginBottom: 6 }}>AMOUNT</Text>
            <TextInput value={expAmount} onChangeText={(text) => {
              var sanitised = text.replace(/[^0-9.]/g, '');
              var parts = sanitised.split('.');
              if (parts.length > 2) sanitised = parts[0] + '.' + parts.slice(1).join('');
              setExpAmount(sanitised);
            }} placeholder="0.00" keyboardType="decimal-pad" style={{ backgroundColor: backgroundColor, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 14, fontSize: 15, color: textPrimary, marginBottom: 16 }} />

            {(expType === 'one_time' || expType === 'income' || expType === 'transfer') ? (
              <View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: textSecondary, marginBottom: 6 }}>DATE</Text>
                <DatePickerInput value={expDate} onChange={setExpDate} placeholder="Select date" />
              </View>
            ) : (
              <View>
                <Text style={{ fontSize: 13, fontWeight: '600', color: textSecondary, marginBottom: 6 }}>DUE DATE</Text>
                <DatePickerInput value={dueDate} onChange={setDueDate} placeholder="Select due date" />
              </View>
            )}

            {expType !== 'transfer' && (
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: textSecondary, marginBottom: 8 }}>{expType === 'income' ? 'CREDIT TO SOURCE' : 'DEDUCT FROM ENVELOPE'}</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  {optionsList.map(opt => {
                    var isSelected = selectedFund === opt.id;
                    var availStr = expType !== 'income' ? ` (Avail: ${opt.available})` : '';
                    var isExceeded = expType !== 'income' && opt.available < (parseFloat(expAmount) || 0);
                    return (
                      <TouchableOpacity key={opt.id} onPress={() => setSelectedFund(opt.id)} style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: isSelected ? primaryColor : (isExceeded ? dangerColor : theme.colors.border), backgroundColor: isSelected ? '#FFEDD5' : (isExceeded ? '#FEF2F2' : '#FFFFFF'), alignItems: 'center' }}>
                        <Text style={{ fontSize: 13, fontWeight: '600', color: isSelected ? primaryColor : (isExceeded ? dangerColor : textPrimary) }}>{opt.name}{availStr}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            )}

            {expType === 'transfer' ? (
              <View style={{ marginTop: 16 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: textSecondary, marginBottom: 8 }}>SOURCE WALLET (FROM)</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                  {accounts.map(acc => {
                    var isSelected = selectedAccount === acc.id;
                    var styleInfo = WALLET_STYLES[acc.type] || WALLET_STYLES.Custom;
                    var brandColor = acc.color || styleInfo.color;
                    return (
                      <TouchableOpacity key={acc.id} onPress={() => setSelectedAccount(acc.id)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: isSelected ? primaryColor : theme.colors.border, backgroundColor: isSelected ? '#FFEDD5' : '#FFFFFF' }}>
                        <BrandLogo type={acc.type} size={14} style={{ marginRight: 6 }} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: isSelected ? primaryColor : brandColor }}>{acc.name} (₱{acc.balance})</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>

                <Text style={{ fontSize: 13, fontWeight: '600', color: textSecondary, marginBottom: 8 }}>DESTINATION WALLET (TO)</Text>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  {accounts.map(acc => {
                    var isSelected = destAccount === acc.id;
                    var styleInfo = WALLET_STYLES[acc.type] || WALLET_STYLES.Custom;
                    var brandColor = acc.color || styleInfo.color;
                    return (
                      <TouchableOpacity key={acc.id} onPress={() => setDestAccount(acc.id)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: isSelected ? primaryColor : theme.colors.border, backgroundColor: isSelected ? '#FFEDD5' : '#FFFFFF' }}>
                        <BrandLogo type={acc.type} size={14} style={{ marginRight: 6 }} />
                        <Text style={{ fontSize: 13, fontWeight: '600', color: isSelected ? primaryColor : brandColor }}>{acc.name} (₱{acc.balance})</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            ) : (
              accounts.length > 0 && (
                <View style={{ marginTop: 16 }}>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: textSecondary, marginBottom: 8 }}>
                    {expType === 'income' ? 'DEPOSIT TO WALLET' : 'PAY FROM WALLET'}
                  </Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                    {accounts.map(acc => {
                      var isSelected = selectedAccount === acc.id;
                      var styleInfo = WALLET_STYLES[acc.type] || WALLET_STYLES.Custom;
                      var brandColor = acc.color || styleInfo.color;
                      return (
                        <TouchableOpacity key={acc.id} onPress={() => setSelectedAccount(acc.id)} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: isSelected ? primaryColor : theme.colors.border, backgroundColor: isSelected ? '#FFEDD5' : '#FFFFFF' }}>
                          <BrandLogo type={acc.type} size={14} style={{ marginRight: 6 }} />
                          <Text style={{ fontSize: 13, fontWeight: '600', color: isSelected ? primaryColor : brandColor }}>{acc.name}</Text>
                        </TouchableOpacity>
                      );
                    })}
                    {(() => {
                      var isUnlinked = selectedAccount === 'unlinked' || selectedAccount === '';
                      return (
                        <TouchableOpacity onPress={() => setSelectedAccount('unlinked')} style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8, borderWidth: 1, borderColor: isUnlinked ? primaryColor : theme.colors.border, backgroundColor: isUnlinked ? '#FFEDD5' : '#FFFFFF' }}>
                          <MaterialIcons name="link-off" size={14} color={isUnlinked ? primaryColor : textSecondary} style={{ marginRight: 6 }} />
                          <Text style={{ fontSize: 13, fontWeight: '600', color: isUnlinked ? primaryColor : textSecondary }}>None / Unlinked</Text>
                        </TouchableOpacity>
                      );
                    })()}
                  </View>
                </View>
              )
            )}

            <TouchableOpacity onPress={handleSave} style={{ backgroundColor: primaryColor, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 }}>
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' }}>
                {expType === 'income' ? 'Save Income' : (expType === 'transfer' ? 'Save Transfer' : 'Save Expense')}
              </Text>
            </TouchableOpacity>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

export default AddExpenseModal;

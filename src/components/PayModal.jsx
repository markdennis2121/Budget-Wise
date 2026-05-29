import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useMutation } from 'platform-hooks';
import { useTheme } from '../contexts/ThemeContext';
import { formatCurrency, isWithin5Days, isOverdue, getTodayStr, generateId } from '../utils/helpers';
import SaveSuccessOverlay from './SaveSuccessOverlay';
import { runSaveWithFeedback } from '../utils/saveSuccess';
import { triggerImpactHaptic, triggerErrorHaptic, showUndoToast } from '../utils/feedback';
import { validateEnvelopeForSpend, validateSpendOperation } from '../utils/envelopeGuards';
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
  Landbank: { color: '#4CAF50', name: 'Landbank', logo: 'account-balance' },
  Vybe: { color: '#7C3AED', name: 'Vybe', logo: 'account-balance-wallet' },
  Cash: { color: '#4B5563', name: 'Cash Wallet', logo: 'money' },
  Custom: { color: '#0F766E', name: 'Wallet/Bank', logo: 'credit-card' }
};

const PayModal = function(props) {
  var visible = props.visible;
  var expense = props.expense;
  var onClose = props.onClose;
  var onPaid = props.onPaid;
  var userId = props.userId;
  var insetsTop = props.insetsTop;
  var insetsBottom = props.insetsBottom;
  var accounts = props.accounts || [];
  var userSettings = props.userSettings;

  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var colors = theme.colors;
  var primaryColor = colors.primary;
  var textPrimary = colors.textPrimary;
  var textSecondary = colors.textSecondary;
  var backgroundColor = colors.inputBg;
  var cardColor = colors.card;
  var dangerColor = colors.error;
  var infoColor = colors.info;

  var updateRecurring = useMutation('recurring_expenses', 'update');
  var mutateUpdate = updateRecurring.mutate;
  var insertHistory = useMutation('expense_history', 'insert');
  var mutateHistory = insertHistory.mutate;
  var deleteHistory = useMutation('expense_history', 'delete');
  var mutateDeleteHistory = deleteHistory.mutate;
  
  var [isLoading, setIsLoading] = useState(false);
  var [selectedAccount, setSelectedAccount] = useState('');
  var [errorMsg, setErrorMsg] = useState('');
  var [showSaveSuccess, setShowSaveSuccess] = useState(false);

  useEffect(function () {
    if (visible) {
      setErrorMsg('');
      setShowSaveSuccess(false);
    }
  }, [visible]);

  useEffect(function () {
    if (!visible) return;
    if (expense && expense.account_id && expense.account_id !== 'unlinked') {
      setSelectedAccount(expense.account_id);
    } else if (accounts && accounts.length > 0) {
      if (!selectedAccount || selectedAccount === 'unlinked') {
        setSelectedAccount(accounts[0].id);
      }
    } else {
      setSelectedAccount('unlinked');
    }
  }, [visible, accounts, expense, selectedAccount]);

  var handlePay = function() {
    if (!expense) return;
    var amt = parseFloat(expense.amount) || 0;

    var spendCheck = validateSpendOperation({
      amount: amt,
      categoryId: expense.category,
      envelopeBalances: props.envelopeBalances,
      accountId: selectedAccount,
      accounts: accounts,
      isRecurringPayment: true
    });

    if (!spendCheck.ok) {
      triggerErrorHaptic();
      setErrorMsg(spendCheck.message);
      return;
    }
    setErrorMsg('');
    setIsLoading(true);
    var isPaidInAdvance = isWithin5Days(expense.due_date) && !isOverdue(expense.due_date);
    var newStatus = isPaidInAdvance ? 'Paid in Advance' : 'Paid';
    
    var acc = accounts.find(a => a.id === selectedAccount);
    var accName = acc ? acc.name : 'Wallet';

    var historyId = generateId();
    var previousStatus = expense.status || 'Pending';
    var previousAccount = expense.account_id;

    var payPromise = mutateUpdate({
      id: expense.id,
      data: { status: newStatus, account_id: selectedAccount }
    }).then(function () {
      return mutateHistory({
        id: historyId,
        user_id: userId,
        expense_name: expense.name,
        amount: amt,
        expense_type: 'Recurring',
        date: getTodayStr(),
        status: newStatus,
        notes: 'Paid from: ' + accName,
        account_id: selectedAccount,
        category: expense.category
      });
    });

    runSaveWithFeedback(payPromise, {
      onClose: onClose,
      onSaved: onPaid,
      setShowSuccess: setShowSaveSuccess,
      message: 'Paid!',
      undoMessage: 'Payment recorded',
      undo: function () {
        return mutateUpdate({
          id: expense.id,
          data: { status: previousStatus, account_id: previousAccount }
        }).then(function () {
          return mutateDeleteHistory({ id: historyId });
        }).then(function () { onPaid && onPaid(); });
      },
      errorMessage: 'Failed to confirm payment. Please try again.',
      onError: function () {
        setIsLoading(false);
        setErrorMsg('Failed to confirm payment. Try again.');
      }
    }).then(function () {
      setIsLoading(false);
    });
  };
  
  if (!expense) return null;
  var isPaidInAdvance = isWithin5Days(expense.due_date) && !isOverdue(expense.due_date);

  var payValidation = validateSpendOperation({
    amount: parseFloat(expense.amount) || 0,
    categoryId: expense.category,
    envelopeBalances: props.envelopeBalances,
    accountId: selectedAccount,
    accounts: accounts,
    isRecurringPayment: true
  });
  var cannotPay = !payValidation.ok;
  
  return (
    <Modal visible={visible} animationType="slide" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)', position: 'relative' }}>
        <SaveSuccessOverlay visible={showSaveSuccess} theme={themeCtx.theme} message="Paid!" />
        <View style={{
          backgroundColor: cardColor,
          borderTopLeftRadius: 28,
          borderTopRightRadius: 28,
          paddingHorizontal: 24,
          paddingTop: 10,
          paddingBottom: insetsBottom + 24,
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.1,
          shadowRadius: 10,
          elevation: 20
        }}>
          {/* Handle */}
          <View style={{ width: 40, height: 5, backgroundColor: theme.colors.border, borderRadius: 3, alignSelf: 'center', marginBottom: 15, opacity: 0.8 }} />

          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: textPrimary }}>Confirm Payment</Text>
            <TouchableOpacity onPress={onClose}><MaterialIcons name="close" size={24} color={textSecondary} /></TouchableOpacity>
          </View>

          <View style={{ backgroundColor: backgroundColor, borderRadius: 12, padding: 16, marginBottom: 16 }}>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: textSecondary, fontSize: 14 }}>Expense</Text>
              <Text style={{ color: textPrimary, fontSize: 14, fontWeight: '600' }}>{expense.name}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 }}>
              <Text style={{ color: textSecondary, fontSize: 14 }}>Amount</Text>
              <Text style={{ color: dangerColor, fontSize: 14, fontWeight: '600' }}>{formatCurrency(expense.amount)}</Text>
            </View>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between' }}>
              <Text style={{ color: textSecondary, fontSize: 14 }}>Status</Text>
              <Text style={{ color: isPaidInAdvance ? infoColor : primaryColor, fontSize: 14, fontWeight: '600' }}>
                {isPaidInAdvance ? 'Paid in Advance' : 'Paid'}
              </Text>
            </View>
          </View>

          {expense.account_id && expense.account_id !== 'unlinked' ? (
            <View style={{ 
              backgroundColor: theme.colors.inputBg, 
              borderRadius: 12, 
              borderWidth: 1, 
              borderColor: theme.colors.border, 
              padding: 14, 
              marginBottom: 16, 
              flexDirection: 'row', 
              alignItems: 'center' 
            }}>
              <MaterialIcons name="account-balance-wallet" size={20} color={primaryColor} style={{ marginRight: 10 }} />
              <View>
                <Text style={{ fontSize: 11, fontWeight: 'bold', color: textSecondary, textTransform: 'uppercase' }}>Paying From Wallet</Text>
                <Text style={{ fontSize: 15, fontWeight: 'bold', color: textPrimary, marginTop: 2 }}>
                  {(() => {
                    var acc = accounts.find(a => a.id === expense.account_id);
                    return acc ? acc.name : 'Linked Wallet';
                  })()}
                </Text>
              </View>
            </View>
          ) : (
            <View>
              <Text style={{ fontSize: 13, fontWeight: '600', color: textSecondary, marginBottom: 8 }}>PAY FROM WALLET</Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 16 }}>
                {accounts.map(acc => {
                  var isSelected = selectedAccount === acc.id;
                  var styleInfo = WALLET_STYLES[acc.type] || WALLET_STYLES.Custom;
                  var brandColor = acc.color || styleInfo.color;

                  var displayColor = brandColor;
                  if (theme.isDark && !isSelected) {
                    if (brandColor === '#111827' || brandColor === '#1E3A8A' || brandColor === '#002E6E') {
                      displayColor = theme.colors.textPrimary;
                    }
                  }

                  return (
                    <TouchableOpacity 
                      key={acc.id} 
                      onPress={() => setSelectedAccount(acc.id)} 
                      style={{ 
                        flexDirection: 'row',
                        alignItems: 'center',
                        marginRight: 8,
                        paddingHorizontal: 12, 
                        paddingVertical: 8, 
                        borderRadius: 8, 
                        borderWidth: 1, 
                        borderColor: isSelected ? primaryColor : theme.colors.border, 
                        backgroundColor: isSelected ? (theme.isDark ? '#374151' : '#FFEDD5') : theme.colors.inputBg
                      }}
                    >
                      <BrandLogo type={acc.type} size={14} style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: isSelected ? primaryColor : displayColor }}>
                        {acc.name} (₱{acc.balance})
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            </View>
          )}

          {cannotPay ? (
            <View style={{ backgroundColor: theme.isDark ? '#451a03' : '#FEF3C7', borderRadius: 10, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: '#F59E0B' }}>
              <Text style={{ color: '#B45309', fontSize: 13, textAlign: 'center', lineHeight: 20, fontWeight: '600' }}>
                {payValidation.message}
              </Text>
            </View>
          ) : null}

          {isPaidInAdvance && !cannotPay && (
            <View style={{ backgroundColor: theme.isDark ? '#1E3A8A' : '#EFF6FF', borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <Text style={{ color: infoColor, fontSize: 13, textAlign: 'center' }}>
                🎉 This bill is due within 5 days — marking as Paid in Advance!
              </Text>
            </View>
          )}

          {errorMsg ? (
            <View style={{ backgroundColor: '#FEE2E2', borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <Text style={{ color: dangerColor, fontSize: 13, textAlign: 'center', fontWeight: '600' }}>
                ⚠️ {errorMsg}
              </Text>
            </View>
          ) : null}

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity 
              onPress={onClose} 
              style={{ flex: 1, backgroundColor: backgroundColor, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border }}
            >
              <Text style={{ color: textSecondary, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={function() { triggerImpactHaptic('Medium'); handlePay(); }}
              disabled={isLoading || !selectedAccount || cannotPay} 
              style={{ flex: 1, backgroundColor: primaryColor, borderRadius: 12, padding: 14, alignItems: 'center', opacity: cannotPay ? 0.5 : 1 }}
            >
              {isLoading ? (
                <ActivityIndicator color="#FFFFFF" size="small" />
              ) : (
                <Text style={{ color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' }}>Confirm Pay</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

export default PayModal;

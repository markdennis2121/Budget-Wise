import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Modal, ActivityIndicator, ScrollView } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useMutation } from 'platform-hooks';
import { primaryColor, textPrimary, textSecondary, backgroundColor, cardColor, dangerColor, infoColor } from '../contexts/ThemeContext';
import { formatCurrency, isWithin5Days, isOverdue, getTodayStr, generateId } from '../utils/helpers';

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

const PayModal = function(props) {
  var visible = props.visible;
  var expense = props.expense;
  var onClose = props.onClose;
  var onPaid = props.onPaid;
  var userId = props.userId;
  var insetsTop = props.insetsTop;
  var insetsBottom = props.insetsBottom;
  var accounts = props.accounts || [];

  var updateRecurring = useMutation('recurring_expenses', 'update');
  var mutateUpdate = updateRecurring.mutate;
  var insertHistory = useMutation('expense_history', 'insert');
  var mutateHistory = insertHistory.mutate;
  
  var [isLoading, setIsLoading] = useState(false);
  var [selectedAccount, setSelectedAccount] = useState('');

  useEffect(() => {
    if (visible) {
      setSelectedAccount('unlinked');
    }
  }, [visible]);

  var handlePay = function() {
    if (!expense) return;
    setIsLoading(true);
    var isPaidInAdvance = isWithin5Days(expense.due_date) && !isOverdue(expense.due_date);
    var newStatus = isPaidInAdvance ? 'Paid in Advance' : 'Paid';
    
    var acc = accounts.find(a => a.id === selectedAccount);
    var accName = acc ? acc.name : 'Wallet';

    mutateUpdate({ 
      id: expense.id, 
      data: { status: newStatus, account_id: selectedAccount } 
    }).then(function() {
      return mutateHistory({ 
        id: generateId(), 
        user_id: userId, 
        expense_name: expense.name, 
        amount: parseFloat(expense.amount) || 0, 
        expense_type: 'Recurring', 
        date: getTodayStr(), 
        status: newStatus, 
        notes: 'Paid from: ' + accName,
        account_id: selectedAccount
      });
    }).then(function() {
      setIsLoading(false);
      onPaid();
      onClose();
    }).catch(function() { 
      setIsLoading(false); 
    });
  };
  
  if (!expense) return null;
  var isPaidInAdvance = isWithin5Days(expense.due_date) && !isOverdue(expense.due_date);
  
  return (
    <Modal visible={visible} animationType="fade" transparent={true} onRequestClose={onClose}>
      <View style={{ flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', marginTop: insetsTop, paddingHorizontal: 20 }}>
        <View style={{ backgroundColor: cardColor, borderRadius: 20, padding: 24, paddingBottom: insetsBottom + 24 }}>
          <View style={{ alignItems: 'center', marginBottom: 20 }}>
            <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: '#FED7AA', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }}>
              <MaterialIcons name="payment" size={30} color={primaryColor} />
            </View>
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: textPrimary }}>Confirm Payment</Text>
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

          <Text style={{ fontSize: 13, fontWeight: '600', color: textSecondary, marginBottom: 8 }}>PAY FROM WALLET</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: 'row', marginBottom: 16 }}>
            {accounts.map(acc => {
              var isSelected = selectedAccount === acc.id;
              var styleInfo = WALLET_STYLES[acc.type] || WALLET_STYLES.Custom;
              var brandColor = acc.color || styleInfo.color;
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
                    borderColor: isSelected ? primaryColor : '#E5E7EB', 
                    backgroundColor: isSelected ? '#FFEDD5' : '#FFFFFF'
                  }}
                >
                  <MaterialIcons name={styleInfo.logo} size={14} color={isSelected ? primaryColor : brandColor} style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isSelected ? primaryColor : brandColor }}>
                    {acc.name}
                  </Text>
                </TouchableOpacity>
              );
            })}
            {(() => {
              var isUnlinked = selectedAccount === 'unlinked' || selectedAccount === '';
              return (
                <TouchableOpacity 
                  onPress={() => setSelectedAccount('unlinked')} 
                  style={{ 
                    flexDirection: 'row',
                    alignItems: 'center',
                    marginRight: 8,
                    paddingHorizontal: 12, 
                    paddingVertical: 8, 
                    borderRadius: 8, 
                    borderWidth: 1, 
                    borderColor: isUnlinked ? primaryColor : '#E5E7EB', 
                    backgroundColor: isUnlinked ? '#FFEDD5' : '#FFFFFF'
                  }}
                >
                  <MaterialIcons name="link-off" size={14} color={isUnlinked ? primaryColor : textSecondary} style={{ marginRight: 6 }} />
                  <Text style={{ fontSize: 13, fontWeight: '600', color: isUnlinked ? primaryColor : textSecondary }}>
                    None / Unlinked
                  </Text>
                </TouchableOpacity>
              );
            })()}
          </ScrollView>

          {isPaidInAdvance && (
            <View style={{ backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12, marginBottom: 16 }}>
              <Text style={{ color: infoColor, fontSize: 13, textAlign: 'center' }}>
                🎉 This bill is due within 5 days — marking as Paid in Advance!
              </Text>
            </View>
          )}

          <View style={{ flexDirection: 'row', gap: 12 }}>
            <TouchableOpacity 
              onPress={onClose} 
              style={{ flex: 1, backgroundColor: backgroundColor, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#FED7AA' }}
            >
              <Text style={{ color: textSecondary, fontSize: 15, fontWeight: '600' }}>Cancel</Text>
            </TouchableOpacity>
            
            <TouchableOpacity 
              onPress={handlePay} 
              disabled={isLoading || !selectedAccount} 
              style={{ flex: 1, backgroundColor: primaryColor, borderRadius: 12, padding: 14, alignItems: 'center' }}
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

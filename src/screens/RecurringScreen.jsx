import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform, ActivityIndicator, Image } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'platform-hooks';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import AddExpenseModal from '../components/AddExpenseModal';
import PayModal from '../components/PayModal';
import SaveSuccessOverlay from '../components/SaveSuccessOverlay';
import { runSaveWithFeedback } from '../utils/saveSuccess';
import { findEnvelopeForCategory } from '../utils/envelopeBudget';
import { hasUserEnvelopes, showEnvelopeRequiredAlert, validateSpendOperation, computeEnvelopeBalances } from '../utils/envelopeGuards';
import { formatCurrency, formatDate, isWithin5Days, isOverdue, getCurrentMonthStr } from '../utils/helpers';
import { triggerImpactHaptic } from '../utils/feedback';
import { buildAccountsWithBalances } from '../utils/accountBalances';
import { scale, moderateScale, normalize } from '../utils/responsive';

const TAB_MENU_HEIGHT = Platform.OS === 'web' ? 56 : 81;
const SCROLL_EXTRA_PADDING = 16;
const WEB_TAB_MENU_PADDING = 90;
const FAB_SPACING = 16;

const RecurringScreen = function(props) {
  const themeCtx = useTheme();
  const theme = themeCtx.theme;
  const userCtx = useUser();
  const userId = userCtx.currentUser ? userCtx.currentUser.id : '';
  const insets = useSafeAreaInsets();
  
  const scrollBottomPadding = Platform.OS === 'web' ? WEB_TAB_MENU_PADDING : (TAB_MENU_HEIGHT + insets.bottom + SCROLL_EXTRA_PADDING);
  const fabBottom = Platform.OS === 'web' ? WEB_TAB_MENU_PADDING : (TAB_MENU_HEIGHT + insets.bottom + FAB_SPACING);

  const recurringQuery = useQuery('recurring_expenses');
  const recurringExpenses = (recurringQuery.data || []).filter(r => r.user_id === userId);
  const { refetch, loading } = recurringQuery;

  const deleteRecurring = useMutation('recurring_expenses', 'delete');
  const updateRecurring = useMutation('recurring_expenses', 'update');

  const historyQuery = useQuery('expense_history');
  const deleteHistory = useMutation('expense_history', 'delete');

  const settingsQuery = useQuery('user_settings');
  const userSettings = (settingsQuery.data || []).find(s => s.user_id === userId);
  const isSimpleMode = userSettings?.budgeting_style === 'simple';

  const curMonth = getCurrentMonthStr();
  const oneTimeQuery = useQuery('one_time_expenses');
  const userOneTime = (oneTimeQuery.data || []).filter(o => o.user_id === userId);
  const userHistory = (historyQuery.data || []).filter(h => h.user_id === userId);

  const envelopes = useMemo(() => {
    if (!userSettings?.envelopes) return [];
    const raw = typeof userSettings.envelopes === 'string' ? JSON.parse(userSettings.envelopes) : userSettings.envelopes;
    return Array.isArray(raw) ? raw : [];
  }, [userSettings]);

  const envelopeBalances = useMemo(() => {
    return computeEnvelopeBalances(envelopes, userHistory, recurringExpenses, curMonth);
  }, [envelopes, userHistory, recurringExpenses, curMonth]);

  const accounts = useMemo(() => {
    return buildAccountsWithBalances({
      userSettings,
      userHistory,
      curMonth
    });
  }, [userSettings, userHistory, curMonth]);

  const [showPayModal, setShowPayModal] = useState(false);
  const [selectedExpense, setSelectedExpense] = useState(null);
  const [showAdd, setShowAdd] = useState(false);
  const [filter, setFilter] = useState('All');
  const [visibleCount, setVisibleCount] = useState(10);
  const [showSaveSuccess, setShowSaveSuccess] = useState(false);
  const [successMessage, setSuccessMessage] = useState('Saved!');
  
  useEffect(() => {
    setVisibleCount(10);
  }, [filter]);

  const afterRecurringAction = (message, promise) => {
    runSaveWithFeedback(promise || Promise.resolve(), {
      onSaved: () => {
        refetch();
        historyQuery.refetch?.();
      },
      setShowSuccess: setShowSaveSuccess,
      setSuccessMessage: setSuccessMessage,
      message: message || 'Saved!',
      errorMessage: 'Something went wrong.'
    });
  };
  
  const filters = ['All', 'Pending', 'Paid', 'Paid in Advance'];
  
  const filtered = useMemo(() => {
    if (filter === 'All') return recurringExpenses;
    return recurringExpenses.filter(r => r.status === filter);
  }, [recurringExpenses, filter]);
  
  const handlePayPress = (expense) => {
    const amt = parseFloat(expense.amount) || 0;
    const payCheck = validateSpendOperation({
      amount: amt,
      categoryId: isSimpleMode ? null : expense.category,
      envelopeBalances: isSimpleMode ? [] : envelopeBalances,
      isRecurringPayment: !isSimpleMode
    });

    if (!isSimpleMode && !payCheck.ok) {
      return Alert.alert('Cannot pay bill', payCheck.message);
    }
    setSelectedExpense(expense);
    setShowPayModal(true);
  };
  
  const handleResetStatus = (expense) => {
    const msg = `Reset "${expense.name}" back to Pending? ${formatCurrency(expense.amount)} will be returned to your envelope.`;
    const onConfirm = () => {
      afterRecurringAction('Bill reset!', updateRecurring.mutate({ id: expense.id, data: { status: 'Pending' } }));
    };
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) onConfirm();
    } else {
      Alert.alert('Undo Payment', msg, [{ text: 'Cancel' }, { text: 'Undo', style: 'destructive', onPress: onConfirm }]);
    }
  };
  
  const handleDelete = (expense) => {
    const isPaid = expense.status === 'Paid' || expense.status === 'Paid in Advance';
    const msg = isPaid
      ? `Delete "${expense.name}"? Since it was already paid, the spent amount will be returned to your envelope.`
      : `Delete "${expense.name}"?`;

    const onConfirm = () => {
      const deletePromise = deleteRecurring.mutate({ id: expense.id }).then(() => {
        if (isPaid) {
          const matchingHistory = userHistory.filter(h => h.expense_type === 'Recurring' && h.expense_name === expense.name);
          return Promise.all(matchingHistory.map(h => deleteHistory.mutate({ id: h.id })));
        }
        return Promise.resolve();
      });
      afterRecurringAction('Deleted!', deletePromise);
    };

    if (Platform.OS === 'web') {
      if (window.confirm(msg)) onConfirm();
    } else {
      Alert.alert('Delete Expense', msg, [{ text: 'Cancel' }, { text: 'Delete', style: 'destructive', onPress: onConfirm }]);
    }
  };
  
  const getStatusColor = (status) => {
    if (status === 'Paid') return '#10B981';
    if (status === 'Paid in Advance') return '#3B82F6';
    return '#F59E0B';
  };
  
  const getStatusBg = (status) => {
    if (status === 'Paid') return '#DCFCE7';
    if (status === 'Paid in Advance') return '#DBEAFE';
    return '#FEF3C7';
  };
  
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <SaveSuccessOverlay visible={showSaveSuccess} theme={theme} message={successMessage} />

      {/* Premium Header */}
      <View style={{ backgroundColor: theme.colors.primary, paddingTop: insets.top + moderateScale(16), paddingBottom: moderateScale(24), paddingHorizontal: moderateScale(20), shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 }}>
        <Text style={{ ...theme.typography.h2, color: '#FFFFFF' }}>Recurring Bills</Text>
        <Text style={{ ...theme.typography.bodySmall, color: 'rgba(255,255,255,0.8)', marginTop: 4, fontWeight: '600' }}>
          Managing {recurringExpenses.length} active subscriptions
        </Text>
      </View>

      {/* Modern Filter Bar */}
      <View style={{ backgroundColor: theme.colors.card, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: moderateScale(16), paddingVertical: moderateScale(14) }}>
          {filters.map(f => {
            const isActive = filter === f;
            const count = f === 'All' ? recurringExpenses.length : recurringExpenses.filter(r => r.status === f).length;
            return (
              <TouchableOpacity
                key={f}
                onPress={() => { triggerImpactHaptic('Light'); setFilter(f); }}
                style={{
                  flexDirection: 'row',
                  alignItems: 'center',
                  paddingHorizontal: moderateScale(16),
                  paddingVertical: moderateScale(8),
                  borderRadius: scale(20),
                  marginRight: moderateScale(10),
                  backgroundColor: isActive ? theme.colors.primary : theme.colors.background,
                  borderWidth: 1,
                  borderColor: isActive ? theme.colors.primary : theme.colors.border,
                  shadowColor: isActive ? theme.colors.primary : '#000',
                  shadowOffset: { width: 0, height: 2 },
                  shadowOpacity: isActive ? 0.2 : 0.05,
                  shadowRadius: 4,
                  elevation: 2
                }}
              >
                <Text style={{ color: isActive ? '#FFFFFF' : theme.colors.textSecondary, fontSize: normalize(13), fontWeight: 'bold' }}>{f}</Text>
                {count > 0 && (
                  <View style={{ marginLeft: 8, backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : theme.colors.border, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 }}>
                    <Text style={{ color: isActive ? '#FFFFFF' : theme.colors.textPrimary, fontSize: normalize(10), fontWeight: '800' }}>{count}</Text>
                  </View>
                )}
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: moderateScale(20), paddingHorizontal: moderateScale(16), paddingBottom: scrollBottomPadding }}>
          {filtered.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: moderateScale(60), paddingHorizontal: moderateScale(40) }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.colors.card, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                 <MaterialIcons name="done-all" size={48} color={theme.colors.primary} />
              </View>
              <Text style={{ fontSize: normalize(18), fontWeight: '900', color: theme.colors.textPrimary, marginBottom: 12, textAlign: 'center' }}>All Caught Up! 🎉</Text>
              <Text style={{ fontSize: normalize(14), color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 22, opacity: 0.8 }}>
                No {filter.toLowerCase()} bills found. High five for staying on top of your finances!
              </Text>
            </View>
          ) : (
            filtered.slice(0, visibleCount).map((expense, idx) => {
              const isPending = expense.status === 'Pending';
              const overdue = isOverdue(expense.due_date) && isPending;
              const upcoming = isWithin5Days(expense.due_date) && !overdue && isPending;
              const statusColor = getStatusColor(expense.status);

              return (
                <View key={expense.id} style={{
                  backgroundColor: theme.colors.card,
                  borderRadius: scale(20),
                  padding: moderateScale(18),
                  marginBottom: moderateScale(14),
                  borderWidth: 1.5,
                  borderColor: overdue ? theme.colors.error + '44' : (upcoming ? theme.colors.warning + '44' : theme.colors.border),
                  shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 3
                }}>
                  <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <View style={{ flex: 1, marginRight: 12 }}>
                      <Text style={{ fontSize: normalize(16), fontWeight: '900', color: theme.colors.textPrimary }} numberOfLines={1}>{expense.name}</Text>
                      <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
                        <MaterialIcons name="event" size={14} color={theme.colors.textSecondary} style={{ marginRight: 4 }} />
                        <Text style={{ fontSize: normalize(13), color: theme.colors.textSecondary, fontWeight: '600' }}>Due {formatDate(expense.due_date)}</Text>
                      </View>

                      {overdue && (
                        <View style={{ alignSelf: 'flex-start', backgroundColor: '#FEE2E2', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 10, flexDirection: 'row', alignItems: 'center' }}>
                           <MaterialIcons name="error-outline" size={14} color="#DC2626" style={{ marginRight: 4 }} />
                           <Text style={{ fontSize: normalize(11), color: '#DC2626', fontWeight: 'bold' }}>OVERDUE</Text>
                        </View>
                      )}
                      {upcoming && (
                        <View style={{ alignSelf: 'flex-start', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 6, marginTop: 10, flexDirection: 'row', alignItems: 'center' }}>
                           <MaterialIcons name="access-time" size={14} color="#B45309" style={{ marginRight: 4 }} />
                           <Text style={{ fontSize: normalize(11), color: '#B45309', fontWeight: 'bold' }}>DUE SOON</Text>
                        </View>
                      )}
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: normalize(20), fontWeight: '900', color: theme.colors.textPrimary }}>{formatCurrency(expense.amount)}</Text>
                      <View style={{ backgroundColor: getStatusBg(expense.status), borderRadius: 12, paddingHorizontal: 10, paddingVertical: 5, marginTop: 8, borderWidth: 1, borderColor: statusColor + '22' }}>
                        <Text style={{ fontSize: normalize(11), color: statusColor, fontWeight: '900', textTransform: 'uppercase' }}>{expense.status}</Text>
                      </View>
                    </View>
                  </View>

                  <View style={{ height: 1, backgroundColor: theme.colors.border, marginVertical: 18, opacity: 0.5 }} />

                  <View style={{ flexDirection: 'row', gap: 10 }}>
                    {isPending ? (
                      <TouchableOpacity
                        onPress={() => { triggerImpactHaptic('Medium'); handlePayPress(expense); }}
                        style={{ flex: 1, backgroundColor: theme.colors.primary, borderRadius: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 4 }}
                      >
                        <MaterialIcons name="check-circle" size={18} color="#FFFFFF" style={{ marginRight: 8 }} />
                        <Text style={{ color: '#FFFFFF', fontSize: normalize(14), fontWeight: '900' }}>Mark as Paid</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleResetStatus(expense)}
                        style={{ flex: 1, backgroundColor: theme.colors.background, borderRadius: 14, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1.5, borderColor: theme.colors.border }}
                      >
                        <MaterialIcons name="undo" size={18} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
                        <Text style={{ color: theme.colors.textSecondary, fontSize: normalize(14), fontWeight: 'bold' }}>Undo Payment</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() => handleDelete(expense)}
                      style={{ width: scale(48), height: scale(48), borderRadius: 14, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FCA5A5' }}
                    >
                      <MaterialIcons name="delete-outline" size={24} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          {visibleCount < filtered.length && (
            <TouchableOpacity onPress={() => setVisibleCount(v => v + 10)} style={{ alignItems: 'center', paddingVertical: 20 }}>
              <Text style={{ color: theme.colors.primary, fontWeight: '900', fontSize: normalize(14) }}>
                Load {filtered.length - visibleCount} More Bills
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Floating Add Button */}
      <TouchableOpacity
        onPress={() => {
          triggerImpactHaptic('Medium');
          if (!isSimpleMode && !hasUserEnvelopes(userSettings)) {
            showEnvelopeRequiredAlert();
            return;
          }
          setShowAdd(true);
        }}
        style={{ position: 'absolute', right: scale(20), bottom: fabBottom, width: scale(60), height: scale(60), borderRadius: scale(30), backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 6 }, shadowOpacity: 0.4, shadowRadius: 10, elevation: 8 }}
      >
        <MaterialIcons name="add" size={scale(32)} color="#FFFFFF" />
      </TouchableOpacity>

      <PayModal
        visible={showPayModal}
        expense={selectedExpense}
        onClose={() => setShowPayModal(false)}
        onPaid={refetch}
        userId={userId}
        insetsTop={insets.top}
        insetsBottom={insets.bottom}
        theme={theme}
        accounts={accounts}
        userSettings={userSettings}
        envelopeBalances={envelopeBalances}
      />

      <AddExpenseModal
        visible={showAdd}
        onClose={() => setShowAdd(false)}
        onSaved={refetch}
        userId={userId}
        theme={theme}
        insetsTop={insets.top}
        insetsBottom={insets.bottom}
        accounts={accounts}
        initialExpType="recurring"
      />
    </View>
  );
};

export default RecurringScreen;

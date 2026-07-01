import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Alert, Platform, ActivityIndicator, Image, useWindowDimensions } from 'react-native';
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

import { getEnvelopeIcon } from './dashboard/envelopeUtils';

const TAB_MENU_HEIGHT = Platform.OS === 'web' ? 56 : 81;
const SCROLL_EXTRA_PADDING = 16;
const WEB_TAB_MENU_PADDING = 90;
const FAB_SPACING = 16;

const RecurringScreen = function(props) {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 1024;

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

  const stats = useMemo(() => {
    const pending = recurringExpenses.filter(r => r.status === 'Pending');
    const totalPendingAmount = pending.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
    const paid = recurringExpenses.filter(r => r.status === 'Paid' || r.status === 'Paid in Advance');
    const totalPaidAmount = paid.reduce((sum, r) => sum + (parseFloat(r.amount) || 0), 0);
    return {
      pendingCount: pending.length,
      pendingAmount: totalPendingAmount,
      paidCount: paid.length,
      paidAmount: totalPaidAmount,
      totalCount: recurringExpenses.length
    };
  }, [recurringExpenses]);

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
      <View style={{ backgroundColor: theme.colors.primary, paddingTop: insets.top + 16, paddingBottom: 20, paddingHorizontal: 20 }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <View>
            <Text style={{ ...theme.typography.h2, color: '#FFFFFF' }}>Recurring Bills</Text>
            <Text style={{ ...theme.typography.bodySmall, color: 'rgba(255,255,255,0.8)', fontWeight: '600' }}>
              {stats.pendingCount} Pending • {stats.paidCount} Paid
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => { triggerImpactHaptic('Medium'); setShowAdd(true); }}
            style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 12 }}
          >
            <MaterialIcons name="add" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 12 }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800' }}>TO PAY</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900' }}>{formatCurrency(stats.pendingAmount)}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 12 }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800' }}>PAID THIS MONTH</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900' }}>{formatCurrency(stats.paidAmount)}</Text>
          </View>
        </View>
      </View>

      {/* Modern Filter Bar */}
      <View style={{ backgroundColor: theme.colors.card, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16, paddingVertical: 12 }}>
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
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  marginRight: 10,
                  backgroundColor: isActive ? theme.colors.primary : theme.colors.background,
                  borderWidth: 1,
                  borderColor: isActive ? theme.colors.primary : theme.colors.border,
                }}
              >
                <Text style={{ color: isActive ? '#FFFFFF' : theme.colors.textSecondary, fontSize: 12, fontWeight: 'bold' }}>{f}</Text>
                {count > 0 && (
                  <View style={{ marginLeft: 8, backgroundColor: isActive ? 'rgba(255,255,255,0.25)' : theme.colors.border, borderRadius: 10, paddingHorizontal: 6, paddingVertical: 1 }}>
                    <Text style={{ color: isActive ? '#FFFFFF' : theme.colors.textPrimary, fontSize: 9, fontWeight: '800' }}>{count}</Text>
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
        <ScrollView style={{ flex: 1 }} contentContainerStyle={{ paddingTop: 16, paddingHorizontal: 16, paddingBottom: scrollBottomPadding }}>
          {filtered.length === 0 ? (
            <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 }}>
              <View style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.colors.card, alignItems: 'center', justifyContent: 'center', marginBottom: 20 }}>
                 <MaterialIcons name="done-all" size={48} color={theme.colors.primary} />
              </View>
              <Text style={{ fontSize: 18, fontWeight: '900', color: theme.colors.textPrimary, marginBottom: 8, textAlign: 'center' }}>No bills found</Text>
              <Text style={{ fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 22 }}>
                {filter === 'All' ? "You haven't added any recurring bills yet." : `No ${filter.toLowerCase()} bills found.`}
              </Text>
            </View>
          ) : (
            filtered.slice(0, visibleCount).map((expense) => {
              const isPending = expense.status === 'Pending';
              const overdue = isOverdue(expense.due_date) && isPending;
              const upcoming = isWithin5Days(expense.due_date) && !overdue && isPending;
              const statusColor = getStatusColor(expense.status);
              const statusBg = getStatusBg(expense.status);

              const env = envelopes.find(e => e.id === expense.category);
              const categoryName = env ? env.name : (isSimpleMode ? 'General' : 'Uncategorized');
              const iconName = getEnvelopeIcon(categoryName);

              return (
                <View key={expense.id} style={{
                  backgroundColor: theme.colors.card,
                  borderRadius: 24,
                  padding: 16,
                  marginBottom: 12,
                  borderWidth: 1,
                  borderColor: overdue ? theme.colors.error : (upcoming ? theme.colors.warning : theme.colors.border),
                }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 16 }}>
                    <View style={{ width: 44, height: 44, borderRadius: 14, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', marginRight: 12, borderWidth: 1, borderColor: theme.colors.border }}>
                      <MaterialIcons name={iconName} size={22} color={theme.colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={{ fontSize: 16, fontWeight: '800', color: theme.colors.textPrimary }} numberOfLines={1}>{expense.name}</Text>
                      <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>{categoryName} • Due {formatDate(expense.due_date)}</Text>
                    </View>
                    <View style={{ alignItems: 'flex-end' }}>
                      <Text style={{ fontSize: 18, fontWeight: '900', color: theme.colors.textPrimary }}>{formatCurrency(expense.amount)}</Text>
                      <View style={{ backgroundColor: statusBg, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 4 }}>
                        <Text style={{ fontSize: 9, color: statusColor, fontWeight: '900', textTransform: 'uppercase' }}>{expense.status}</Text>
                      </View>
                    </View>
                  </View>

                  {overdue && (
                    <View style={{ backgroundColor: '#FEF2F2', padding: 8, borderRadius: 10, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
                       <MaterialIcons name="error-outline" size={14} color="#EF4444" style={{ marginRight: 6 }} />
                       <Text style={{ fontSize: 11, color: '#EF4444', fontWeight: 'bold' }}>OVERDUE</Text>
                    </View>
                  )}
                  {upcoming && (
                    <View style={{ backgroundColor: '#FFFBEB', padding: 8, borderRadius: 10, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
                       <MaterialIcons name="access-time" size={14} color="#D97706" style={{ marginRight: 6 }} />
                       <Text style={{ fontSize: 11, color: '#D97706', fontWeight: 'bold' }}>DUE SOON</Text>
                    </View>
                  )}

                  <View style={{ flexDirection: 'row', gap: 8 }}>
                    {isPending ? (
                      <TouchableOpacity
                        onPress={() => { triggerImpactHaptic('Medium'); handlePayPress(expense); }}
                        style={{ flex: 1, backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}
                      >
                        <MaterialIcons name="check" size={18} color="#FFFFFF" style={{ marginRight: 6 }} />
                        <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: '800' }}>Mark as Paid</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        onPress={() => handleResetStatus(expense)}
                        style={{ flex: 1, backgroundColor: theme.colors.background, borderRadius: 12, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border }}
                      >
                        <MaterialIcons name="undo" size={18} color={theme.colors.textSecondary} style={{ marginRight: 6 }} />
                        <Text style={{ color: theme.colors.textSecondary, fontSize: 14, fontWeight: '700' }}>Undo Payment</Text>
                      </TouchableOpacity>
                    )}

                    <TouchableOpacity
                      onPress={() => handleDelete(expense)}
                      style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FEE2E2' }}
                    >
                      <MaterialIcons name="delete-outline" size={20} color="#EF4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              );
            })
          )}

          {visibleCount < filtered.length && (
            <TouchableOpacity onPress={() => setVisibleCount(v => v + 10)} style={{ alignItems: 'center', paddingVertical: 20 }}>
              <Text style={{ color: theme.colors.primary, fontWeight: '800', fontSize: 14 }}>
                Show More Bills
              </Text>
            </TouchableOpacity>
          )}
        </ScrollView>
      )}

      {/* Floating Add Button */}
      {!isDesktopWeb && (
        <TouchableOpacity
          onPress={() => {
            triggerImpactHaptic('Medium');
            if (!isSimpleMode && !hasUserEnvelopes(userSettings)) {
              showEnvelopeRequiredAlert();
              return;
            }
            setShowAdd(true);
          }}
          style={{ position: 'absolute', right: 20, bottom: fabBottom, width: 56, height: 56, borderRadius: 28, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 6, elevation: 8 }}
        >
          <MaterialIcons name="add" size={32} color="#FFFFFF" />
        </TouchableOpacity>
      )}

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

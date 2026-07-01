import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, FlatList, ActivityIndicator, Platform, Modal, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'platform-hooks';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { formatCurrency, formatDate } from '../utils/helpers';
import { triggerImpactHaptic } from '../utils/feedback';
import { scale, moderateScale, normalize } from '../utils/responsive';

const TAB_MENU_HEIGHT = Platform.OS === 'web' ? 56 : 81;
const SCROLL_EXTRA_PADDING = 16;
const WEB_TAB_MENU_PADDING = 90;

const HistoryScreen = function() {
  const themeCtx = useTheme();
  const theme = themeCtx.theme;
  const userCtx = useUser();
  const userId = userCtx.currentUser ? userCtx.currentUser.id : '';
  const insets = useSafeAreaInsets();
  const scrollBottomPadding = Platform.OS === 'web' ? WEB_TAB_MENU_PADDING : (TAB_MENU_HEIGHT + insets.bottom + SCROLL_EXTRA_PADDING);

  const historyQuery = useQuery('expense_history');
  const userHistory = (historyQuery.data || []).filter(h => h.user_id === userId);
  const { loading } = historyQuery;

  const oneTimeQuery = useQuery('one_time_expenses');
  const userOneTime = (oneTimeQuery.data || []).filter(o => o.user_id === userId);

  const [typeFilter, setTypeFilter] = useState('All');
  const [statusFilter, setStatusFilter] = useState('All');
  const [statusDropdownVisible, setStatusDropdownVisible] = useState(false);
  const [search, setSearch] = useState('');
  const [visibleCount, setVisibleCount] = useState(15);
  const [selectedItem, setSelectedItem] = useState(null);

  useEffect(() => {
    setVisibleCount(15);
  }, [typeFilter, statusFilter, search]);

  const combinedHistory = useMemo(() => {
    const histItems = userHistory.map(h => ({
      id: h.id,
      name: h.expense_name,
      amount: parseFloat(h.amount) || 0,
      type: h.expense_type,
      date: h.date,
      status: h.status,
      notes: h.notes,
      category: h.category
    }));

    const oneTimeItems = userOneTime.map(o => ({
      id: o.id,
      name: o.name,
      amount: parseFloat(o.amount) || 0,
      type: 'One-Time',
      date: o.date,
      status: 'Spent',
      notes: o.notes || '',
      category: o.category
    }));

    const allItems = [...histItems, ...oneTimeItems];
    const seen = new Set();
    const unique = allItems.filter(item => {
      if (seen.has(item.id)) return false;
      seen.add(item.id);
      return true;
    });

    return unique.sort((a, b) => b.date.localeCompare(a.date));
  }, [userHistory, userOneTime]);
  
  const filteredHistory = useMemo(() => {
    return combinedHistory.filter(item => {
      const matchType = typeFilter === 'All' || item.type === typeFilter;
      const matchStatus = statusFilter === 'All' || item.status === statusFilter;
      const matchSearch = !search || item.name.toLowerCase().includes(search.toLowerCase());
      return matchType && matchStatus && matchSearch;
    });
  }, [combinedHistory, typeFilter, statusFilter, search]);

  const groupedHistory = useMemo(() => {
    const groups = {};
    filteredHistory.slice(0, visibleCount).forEach(item => {
      const date = item.date.split('T')[0];
      if (!groups[date]) groups[date] = [];
      groups[date].push(item);
    });
    return Object.entries(groups).map(([date, items]) => ({ date, items }));
  }, [filteredHistory, visibleCount]);

  const stats = useMemo(() => {
    let income = 0;
    let expenses = 0;
    filteredHistory.forEach(i => {
      if (i.type === 'Income') income += i.amount;
      else if (!['Transfer', 'Adjustment'].includes(i.type)) expenses += i.amount;
    });
    return { income, expenses, net: income - expenses };
  }, [filteredHistory]);
  
  const getStatusColor = (status) => {
    const colors = {
      'Received': '#10B981',
      'Paid': '#10B981',
      'Paid in Advance': '#3B82F6',
      'Spent': '#EF4444',
      'Completed': '#0EA5E9'
    };
    return colors[status] || '#F59E0B';
  };
  
  const getTypeIcon = (type) => {
    const icons = {
      'Income': 'trending-up',
      'Transfer': 'swap-horiz',
      'Adjustment': 'tune',
      'Recurring': 'repeat'
    };
    return icons[type] || 'shopping-bag';
  };
  
  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      {/* Premium Header */}
      <View style={{ backgroundColor: theme.colors.primary, paddingTop: insets.top + moderateScale(16), paddingBottom: moderateScale(20), paddingHorizontal: moderateScale(20) }}>
        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
          <View>
            <Text style={{ ...theme.typography.h2, color: '#FFFFFF' }}>History</Text>
            <Text style={{ ...theme.typography.bodySmall, color: 'rgba(255,255,255,0.8)', fontWeight: '600' }}>
              {filteredHistory.length} Transactions
            </Text>
          </View>
          <TouchableOpacity
            onPress={() => setStatusDropdownVisible(!statusDropdownVisible)}
            style={{ backgroundColor: 'rgba(255,255,255,0.2)', padding: 10, borderRadius: 12 }}
          >
            <MaterialIcons name="filter-list" size={24} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Stats Cards */}
        <View style={{ flexDirection: 'row', marginTop: 20, gap: 12 }}>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 12 }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800' }}>INCOME</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900' }}>{formatCurrency(stats.income)}</Text>
          </View>
          <View style={{ flex: 1, backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 12 }}>
            <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 10, fontWeight: '800' }}>EXPENSES</Text>
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '900' }}>{formatCurrency(stats.expenses)}</Text>
          </View>
        </View>
      </View>

      {/* Modern Filter Section */}
      <View style={{ backgroundColor: theme.colors.card, paddingVertical: moderateScale(12), borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
        {/* Integrated Search */}
        <View style={{ marginHorizontal: moderateScale(16), marginBottom: moderateScale(12), flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.background, borderRadius: 14, paddingHorizontal: 12, borderWidth: 1, borderColor: theme.colors.border }}>
          <MaterialIcons name="search" size={20} color={theme.colors.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search transactions..."
            placeholderTextColor={theme.colors.textSecondary}
            style={{ flex: 1, paddingVertical: 10, paddingLeft: 8, fontSize: 14, color: theme.colors.textPrimary, fontWeight: '500' }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')}>
              <MaterialIcons name="cancel" size={18} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: 16 }}>
          {['All','Income','Recurring','One-Time','Adjustment'].map(t => {
            const isActive = typeFilter === t;
            return (
              <TouchableOpacity
                key={t}
                onPress={() => { triggerImpactHaptic('Light'); setTypeFilter(t); }}
                style={{
                  paddingHorizontal: 16,
                  paddingVertical: 8,
                  borderRadius: 20,
                  marginRight: 8,
                  backgroundColor: isActive ? theme.colors.primary : theme.colors.background,
                  borderWidth: 1,
                  borderColor: isActive ? theme.colors.primary : theme.colors.border
                }}
              >
                <Text style={{ color: isActive ? '#FFFFFF' : theme.colors.textSecondary, fontSize: 12, fontWeight: 'bold' }}>{t}</Text>
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
        <FlatList
          data={filteredHistory.slice(0, visibleCount)}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: scrollBottomPadding }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 }}>
              <MaterialIcons name="history" size={64} color={theme.colors.border} />
              <Text style={{ fontSize: 18, fontWeight: '900', color: theme.colors.textPrimary, marginTop: 20 }}>No Records</Text>
              <Text style={{ fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8 }}>
                We couldn't find any transactions matching your filters.
              </Text>
            </View>
          }
          ListFooterComponent={visibleCount < filteredHistory.length ? (
            <TouchableOpacity onPress={() => setVisibleCount(v => v + 15)} style={{ alignItems: 'center', paddingVertical: 24, backgroundColor: theme.colors.card, marginHorizontal: 20, borderRadius: 16, marginTop: 10 }}>
              <Text style={{ color: theme.colors.primary, fontWeight: '800', fontSize: 14 }}>
                Show More Transactions
              </Text>
            </TouchableOpacity>
          ) : null}
          renderItem={({ item, index }) => {
            const isIncome = item.type === 'Income';
            const isTransfer = item.type === 'Transfer';
            const isAdjustment = item.type === 'Adjustment';
            const typeColor = isIncome ? '#10B981' : (isTransfer ? '#3B82F6' : (isAdjustment ? theme.colors.textSecondary : '#EF4444'));
            const typeBg = isIncome ? '#ECFDF5' : (isTransfer ? '#EFF6FF' : (isAdjustment ? '#F3F4F6' : '#FEF2F2'));

            // Show date header if first item or date changed
            const showDateHeader = index === 0 || filteredHistory[index - 1].date.split('T')[0] !== item.date.split('T')[0];

            return (
              <View>
                {showDateHeader && (
                  <Text style={{ fontSize: 12, fontWeight: '800', color: theme.colors.textSecondary, marginTop: index === 0 ? 0 : 20, marginBottom: 10, textTransform: 'uppercase', letterSpacing: 1 }}>
                    {formatDate(item.date)}
                  </Text>
                )}
                <TouchableOpacity
                  activeOpacity={0.7}
                  onPress={() => { triggerImpactHaptic('Light'); setSelectedItem(item); }}
                  style={{
                    backgroundColor: theme.colors.card,
                    borderRadius: 20,
                    padding: 16,
                    marginBottom: 8,
                    flexDirection: 'row',
                    alignItems: 'center',
                    borderWidth: 1,
                    borderColor: theme.colors.border,
                  }}
                >
                  <View style={{ width: 48, height: 48, borderRadius: 14, backgroundColor: typeBg, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                    <MaterialIcons name={getTypeIcon(item.type)} size={24} color={typeColor} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 15, fontWeight: '700', color: theme.colors.textPrimary }} numberOfLines={1}>{item.name}</Text>
                    <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>{item.type}</Text>
                  </View>
                  <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: 16, fontWeight: '900', color: typeColor }}>
                      {(isIncome ? '+' : (isTransfer ? '' : (isAdjustment ? '±' : '-'))) + formatCurrency(item.amount)}
                    </Text>
                    {item.status && (
                       <Text style={{ fontSize: 10, color: getStatusColor(item.status), fontWeight: '800', marginTop: 4 }}>{item.status.toUpperCase()}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              </View>
            );
          }}
        />
      )}

      {/* Transaction Detail Modal */}
      <Modal
        visible={!!selectedItem}
        transparent
        animationType="slide"
        onRequestClose={() => setSelectedItem(null)}
      >
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: theme.colors.background, borderTopLeftRadius: 32, borderTopRightRadius: 32, padding: 24, paddingBottom: insets.bottom + 24 }}>
            <View style={{ width: 40, height: 5, backgroundColor: theme.colors.border, borderRadius: 3, alignSelf: 'center', marginBottom: 20 }} />

            {selectedItem && (
              <>
                <View style={{ alignItems: 'center', marginBottom: 24 }}>
                  <View style={{ width: 64, height: 64, borderRadius: 20, backgroundColor: selectedItem.type === 'Income' ? '#ECFDF5' : '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 16 }}>
                    <MaterialIcons name={getTypeIcon(selectedItem.type)} size={32} color={selectedItem.type === 'Income' ? '#10B981' : '#EF4444'} />
                  </View>
                  <Text style={{ fontSize: 24, fontWeight: '900', color: theme.colors.textPrimary }}>{formatCurrency(selectedItem.amount)}</Text>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: theme.colors.textSecondary, marginTop: 4 }}>{selectedItem.name}</Text>
                </View>

                <View style={{ backgroundColor: theme.colors.card, borderRadius: 24, padding: 20, gap: 16 }}>
                  <DetailRow label="Date" value={formatDate(selectedItem.date)} icon="event" theme={theme} />
                  <DetailRow label="Type" value={selectedItem.type} icon="category" theme={theme} />
                  {selectedItem.status && <DetailRow label="Status" value={selectedItem.status} icon="info" theme={theme} />}
                  {selectedItem.notes ? <DetailRow label="Notes" value={selectedItem.notes} icon="notes" theme={theme} /> : null}
                </View>

                <TouchableOpacity
                  onPress={() => setSelectedItem(null)}
                  style={{ backgroundColor: theme.colors.primary, borderRadius: 16, paddingVertical: 16, alignItems: 'center', marginTop: 24 }}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '800' }}>Close</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Status Filter Modal */}
      <Modal visible={statusDropdownVisible} transparent animationType="fade" onRequestClose={() => setStatusDropdownVisible(false)}>
        <TouchableOpacity
          activeOpacity={1}
          onPress={() => setStatusDropdownVisible(false)}
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.3)', justifyContent: 'center', alignItems: 'center' }}
        >
          <View style={{ width: '80%', backgroundColor: theme.colors.card, borderRadius: 24, padding: 20 }}>
            <Text style={{ fontSize: 18, fontWeight: '900', color: theme.colors.textPrimary, marginBottom: 16 }}>Filter by Status</Text>
            {['All', 'Paid', 'Spent', 'Received', 'Pending'].map(s => (
              <TouchableOpacity
                key={s}
                onPress={() => { setStatusFilter(s); setStatusDropdownVisible(false); }}
                style={{ paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: theme.colors.border, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}
              >
                <Text style={{ fontSize: 16, color: statusFilter === s ? theme.colors.primary : theme.colors.textPrimary, fontWeight: statusFilter === s ? '800' : '600' }}>{s}</Text>
                {statusFilter === s && <MaterialIcons name="check" size={20} color={theme.colors.primary} />}
              </TouchableOpacity>
            ))}
          </View>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const DetailRow = ({ label, value, icon, theme }) => (
  <View style={{ flexDirection: 'row', alignItems: 'center' }}>
    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
      <MaterialIcons name={icon} size={18} color={theme.colors.primary} />
    </View>
    <View>
      <Text style={{ fontSize: 11, fontWeight: '800', color: theme.colors.textSecondary, textTransform: 'uppercase' }}>{label}</Text>
      <Text style={{ fontSize: 14, fontWeight: '700', color: theme.colors.textPrimary, marginTop: 1 }}>{value}</Text>
    </View>
  </View>
);

export default HistoryScreen;

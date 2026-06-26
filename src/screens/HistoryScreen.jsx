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
      notes: h.notes
    }));

    const oneTimeItems = userOneTime.map(o => ({
      id: o.id,
      name: o.name,
      amount: parseFloat(o.amount) || 0,
      type: 'One-Time',
      date: o.date,
      status: 'Spent',
      notes: ''
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
  
  const totalShown = useMemo(() => {
    return filteredHistory.reduce((s, i) => {
      if (i.type === 'Income') return s + i.amount;
      if (['Transfer', 'Adjustment'].includes(i.type)) return s;
      return s - i.amount;
    }, 0);
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
      <View style={{ backgroundColor: theme.colors.primary, paddingTop: insets.top + moderateScale(16), paddingBottom: moderateScale(24), paddingHorizontal: moderateScale(20), shadowColor: theme.colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8, elevation: 5 }}>
        <Text style={{ ...theme.typography.h2, color: '#FFFFFF' }}>Expense History</Text>
        <Text style={{ ...theme.typography.bodySmall, color: 'rgba(255,255,255,0.8)', marginTop: 4, fontWeight: '600' }}>
          {filteredHistory.length} transaction records
        </Text>
      </View>

      {/* Modern Filter Section */}
      <View style={{ backgroundColor: theme.colors.card, paddingVertical: moderateScale(16), borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
        {/* Integrated Search */}
        <View style={{ marginHorizontal: moderateScale(16), marginBottom: moderateScale(16), flexDirection: 'row', alignItems: 'center', backgroundColor: theme.colors.background, borderRadius: scale(14), paddingHorizontal: moderateScale(12), borderWidth: 1, borderColor: theme.colors.border }}>
          <MaterialIcons name="search" size={scale(20)} color={theme.colors.textSecondary} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search by name..."
            placeholderTextColor={theme.colors.textSecondary}
            style={{ flex: 1, paddingVertical: moderateScale(10), paddingLeft: moderateScale(8), fontSize: normalize(14), color: theme.colors.textPrimary, fontWeight: '500' }}
          />
          {search.length > 0 && (
            <TouchableOpacity onPress={() => setSearch('')} style={{ padding: 4 }}>
              <MaterialIcons name="cancel" size={scale(18)} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          )}
        </View>

        {/* Type Filter Pills */}
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ paddingHorizontal: moderateScale(16), paddingBottom: moderateScale(4) }}>
          {['All','Recurring','One-Time','Income','Adjustment'].map(t => {
            const isActive = typeFilter === t;
            return (
              <TouchableOpacity
                key={t}
                onPress={() => { triggerImpactHaptic('Light'); setTypeFilter(t); }}
                style={{
                  paddingHorizontal: moderateScale(14),
                  paddingVertical: moderateScale(8),
                  borderRadius: scale(12),
                  marginRight: moderateScale(8),
                  backgroundColor: isActive ? theme.colors.primary : theme.colors.background,
                  borderWidth: 1,
                  borderColor: isActive ? theme.colors.primary : theme.colors.border
                }}
              >
                <Text style={{ color: isActive ? '#FFFFFF' : theme.colors.textSecondary, fontSize: normalize(12), fontWeight: 'bold' }}>{t}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      {/* Summary Banner */}
      <View style={{ backgroundColor: totalShown >= 0 ? '#DCFCE7' : '#FEE2E2', paddingHorizontal: moderateScale(20), paddingVertical: moderateScale(12), flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: 'rgba(0,0,0,0.05)' }}>
        <Text style={{ color: theme.colors.textSecondary, fontSize: normalize(12), fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 }}>
          {totalShown >= 0 ? 'Net Income' : 'Net Expenses'}
        </Text>
        <Text style={{ color: totalShown >= 0 ? '#166534' : '#991B1B', fontSize: normalize(16), fontWeight: '900' }}>
          {(totalShown >= 0 ? '+' : '-') + formatCurrency(Math.abs(totalShown))}
        </Text>
      </View>

      {loading ? (
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={theme.colors.primary} />
        </View>
      ) : (
        <FlatList
          data={filteredHistory.slice(0, visibleCount)}
          keyExtractor={item => item.id}
          contentContainerStyle={{ paddingHorizontal: moderateScale(16), paddingTop: moderateScale(16), paddingBottom: scrollBottomPadding }}
          ListEmptyComponent={
            <View style={{ alignItems: 'center', paddingTop: 60, paddingHorizontal: 40 }}>
              <MaterialIcons name="history" size={64} color={theme.colors.border} />
              <Text style={{ fontSize: normalize(18), fontWeight: '900', color: theme.colors.textPrimary, marginTop: 20, textAlign: 'center' }}>No Records Found</Text>
              <Text style={{ fontSize: normalize(14), color: theme.colors.textSecondary, textAlign: 'center', marginTop: 8, lineHeight: 22 }}>
                Try adjusting your filters or search terms to find what you're looking for.
              </Text>
            </View>
          }
          ListFooterComponent={visibleCount < filteredHistory.length ? (
            <TouchableOpacity onPress={() => setVisibleCount(v => v + 15)} style={{ alignItems: 'center', paddingVertical: 24 }}>
              <Text style={{ color: theme.colors.primary, fontWeight: '900', fontSize: normalize(14) }}>
                Show More ({filteredHistory.length - visibleCount} hidden)
              </Text>
            </TouchableOpacity>
          ) : null}
          renderItem={({ item }) => {
            const isIncome = item.type === 'Income';
            const isTransfer = item.type === 'Transfer';
            const isAdjustment = item.type === 'Adjustment';

            const typeColor = isIncome ? '#16A34A' : (isTransfer ? '#2563EB' : (isAdjustment ? theme.colors.textSecondary : '#DC2626'));
            const typeBg = isIncome ? '#DCFCE7' : (isTransfer ? '#DBEAFE' : (isAdjustment ? theme.colors.border : '#FEE2E2'));

            return (
              <View style={{
                backgroundColor: theme.colors.card,
                borderRadius: scale(18),
                padding: moderateScale(14),
                marginBottom: moderateScale(10),
                flexDirection: 'row',
                alignItems: 'center',
                borderWidth: 1,
                borderColor: theme.colors.border,
                shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.03, shadowRadius: 4, elevation: 1
              }}>
                 <View style={{ width: scale(42), height: scale(42), borderRadius: scale(12), backgroundColor: typeBg, alignItems: 'center', justifyContent: 'center', marginRight: moderateScale(14) }}>
                    <MaterialIcons name={getTypeIcon(item.type)} size={scale(22)} color={typeColor} />
                 </View>
                 <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: normalize(15), fontWeight: '700', color: theme.colors.textPrimary }} numberOfLines={1}>{item.name}</Text>
                    <Text style={{ fontSize: normalize(12), color: theme.colors.textSecondary, marginTop: 3 }}>
                       {formatDate(item.date)} • {item.type}
                    </Text>
                 </View>
                 <View style={{ alignItems: 'flex-end' }}>
                    <Text style={{ fontSize: normalize(16), fontWeight: '900', color: typeColor }}>
                       {(isIncome ? '+' : (isTransfer ? '⇄ ' : (isAdjustment ? '± ' : '-'))) + formatCurrency(item.amount)}
                    </Text>
                    {item.status && (
                       <View style={{ backgroundColor: getStatusColor(item.status) + '15', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 2, marginTop: 5, borderWidth: 0.5, borderColor: getStatusColor(item.status) + '33' }}>
                          <Text style={{ fontSize: normalize(10), color: getStatusColor(item.status), fontWeight: 'bold' }}>{item.status.toUpperCase()}</Text>
                       </View>
                    )}
                 </View>
              </View>
            );
          }}
        />
      )}
    </View>
  );
};

export default HistoryScreen;

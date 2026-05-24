import React, { useState, useMemo, useEffect } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, FlatList, ActivityIndicator, Platform, Image, Modal, Alert } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'platform-hooks';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { formatCurrency, formatDate } from '../utils/helpers';
import emptyHistoryImg from '../assets/empty_history.png';

const TAB_MENU_HEIGHT = Platform.OS === 'web' ? 56 : 49;
const SCROLL_EXTRA_PADDING = 16;
const WEB_TAB_MENU_PADDING = 90;

const HistoryScreen = function() {
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var userCtx = useUser();
  var userId = userCtx.currentUser ? userCtx.currentUser.id : '';
  var insets = useSafeAreaInsets();
  var scrollBottomPadding = Platform.OS === 'web' ? WEB_TAB_MENU_PADDING : (TAB_MENU_HEIGHT + insets.bottom + SCROLL_EXTRA_PADDING);
  var historyQuery = useQuery('expense_history');
  var allHistory = historyQuery.data || [];
  var userHistory = allHistory.filter(function(h) { return h.user_id === userId; });
  var loading = historyQuery.loading;
  var typeFilterState = useState('All');
  var typeFilter = typeFilterState[0]; var setTypeFilter = typeFilterState[1];
  var statusFilterState = useState('All');
  var statusFilter = statusFilterState[0]; var setStatusFilter = statusFilterState[1];
  var [statusDropdownVisible, setStatusDropdownVisible] = useState(false);
  var searchState = useState('');
  var search = searchState[0]; var setSearch = searchState[1];
  var [visibleCount, setVisibleCount] = useState(5);

  useEffect(() => {
    setVisibleCount(5);
  }, [typeFilter, statusFilter, search]);

  var oneTimeQuery = useQuery('one_time_expenses');
  var allOneTime = oneTimeQuery.data || [];
  var userOneTime = allOneTime.filter(function(o) { return o.user_id === userId; });
  
  var combinedHistory = useMemo(function() {
    var histItems = userHistory.map(function(h) {
      return { id: h.id, name: h.expense_name, amount: parseFloat(h.amount) || 0, type: h.expense_type, date: h.date, status: h.status, notes: h.notes };
    });
    var oneTimeItems = userOneTime.map(function(o) {
      return { id: o.id, name: o.name, amount: parseFloat(o.amount) || 0, type: 'One-Time', date: o.date, status: 'Spent', notes: '' };
    });
    var allItems = histItems.concat(oneTimeItems);
    var seen = {};
    var seenKeys = {};
    var unique = allItems.filter(function(item) {
      if (seen[item.id]) return false;
      seen[item.id] = true;
      if (item.type === 'One-Time') {
        var key = item.name + '_' + item.amount + '_' + item.date;
        if (seenKeys[key]) return false;
        seenKeys[key] = true;
      }
      return true;
    });
    unique.sort(function(a, b) {
      if (a.date > b.date) return -1;
      if (a.date < b.date) return 1;
      return 0;
    });
    return unique;
  }, [userHistory, userOneTime]);
  
  var filteredHistory = useMemo(function() {
    return combinedHistory.filter(function(item) {
      var matchType = typeFilter === 'All' || item.type === typeFilter;
      var matchStatus = statusFilter === 'All' || item.status === statusFilter;
      var matchSearch = !search || item.name.toLowerCase().indexOf(search.toLowerCase()) !== -1;
      return matchType && matchStatus && matchSearch;
    });
  }, [combinedHistory, typeFilter, statusFilter, search]);
  
  var totalShown = useMemo(function() {
    return filteredHistory.reduce(function(s, i) {
      if (i.type === 'Income') return s + i.amount;
      if (i.type === 'Transfer') return s;
      if (i.type === 'Adjustment') return s; // Adjustments are balancing entries, not net income/expense
      return s - i.amount;
    }, 0);
  }, [filteredHistory]);
  
  var getStatusColor = function(status) {
    if (status === 'Received') return theme.colors.primary;
    if (status === 'Paid') return theme.colors.primary;
    if (status === 'Paid in Advance') return theme.colors.info;
    if (status === 'Spent') return theme.colors.error;
    return theme.colors.warning;
  };
  
  var getTypeIcon = function(type) {
    if (type === 'Income') return 'trending-up';
    if (type === 'Transfer') return 'swap-horiz';
    if (type === 'Adjustment') return 'tune';
    return type === 'Recurring' ? 'repeat' : 'shopping-bag';
  };
  
  return React.createElement(View, { testID: 'View-58', style: { flex: 1, backgroundColor: theme.colors.background }, componentId: 'history-screen' },
    React.createElement(View, { testID: 'View-59', style: { backgroundColor: theme.colors.primary, paddingTop: insets.top + 16, paddingBottom: 20, paddingHorizontal: 20 }, componentId: 'history-header' },
      React.createElement(Text, { testID: 'Text-80', style: { ...theme.typography.h2, color: '#FFFFFF' } }, 'Expense History'),
      React.createElement(Text, { testID: 'Text-81', style: { ...theme.typography.bodySmall, color: 'rgba(255,255,255,0.75)', marginTop: 2 } }, String(filteredHistory.length) + ' records')
    ),
    React.createElement(View, { testID: 'View-60', style: { backgroundColor: theme.colors.card, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#FED7AA' }, componentId: 'history-filters' },
      React.createElement(View, { testID: 'View-61', style: { backgroundColor: theme.colors.background, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', marginBottom: 10 } },
        React.createElement(MaterialIcons, { testID: 'MaterialIcons-12', name: 'search', size: 20, color: theme.colors.textSecondary }),
        React.createElement(TextInput, { testID: 'TextInput-9', value: search, onChangeText: setSearch, placeholder: 'Search expenses...',
          style: { flex: 1, paddingVertical: 8, paddingLeft: 8, fontSize: 14, color: theme.colors.textPrimary },
          componentId: 'history-search-input'
        })
      ),
      React.createElement(View, { style: { marginBottom: 10 } },
        React.createElement(Text, { style: { ...theme.typography.caption, color: theme.colors.textSecondary, marginBottom: 6 } }, 'Type'),
        React.createElement(ScrollView, { testID: 'ScrollView-10', horizontal: true, showsHorizontalScrollIndicator: false, style: { flexGrow: 'initial', marginBottom: 10 } },
          ['All','Recurring','One-Time','Income','Adjustment'].map(function(t) {
            var count = t === 'All' ? combinedHistory.length : combinedHistory.filter(i => i.type === t).length;
            return React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-23', key: t, onPress: function() { setTypeFilter(t); },
              style: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 6, backgroundColor: typeFilter === t ? theme.colors.primary : theme.colors.background, borderWidth: 1, borderColor: typeFilter === t ? theme.colors.primary : '#FED7AA' },
              componentId: 'type-filter-' + t
            },
              React.createElement(Text, { style: { color: typeFilter === t ? '#FFFFFF' : theme.colors.textSecondary, fontSize: 12, fontWeight: '600' } }, t),
              count > 0 ? React.createElement(View, { style: { marginLeft: 6, backgroundColor: typeFilter === t ? 'rgba(255,255,255,0.2)' : '#FED7AA', borderRadius: 10, paddingHorizontal: 6, paddingVertical: 2 } },
                React.createElement(Text, { style: { color: typeFilter === t ? '#FFFFFF' : theme.colors.primary, fontSize: 11, fontWeight: 'bold' } }, String(count))
              ) : null
            );
          })
        )
      ),
      React.createElement(View, null,
        React.createElement(Text, { style: { ...theme.typography.caption, color: theme.colors.textSecondary, marginBottom: 6 } }, 'Status'),
        React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-24', onPress: function() { setStatusDropdownVisible(true); },
          style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: 14, paddingVertical: 12, borderRadius: 14, borderWidth: 1, borderColor: theme.colors.border, backgroundColor: theme.colors.background }
        },
          React.createElement(Text, { style: { color: theme.colors.textPrimary, fontSize: 14, fontWeight: '600' } }, statusFilter),
          React.createElement(MaterialIcons, { name: 'keyboard-arrow-down', size: 22, color: theme.colors.textSecondary })
        )
      )
    ),
    React.createElement(Modal, { transparent: true, visible: statusDropdownVisible, animationType: 'fade', onRequestClose: function() { setStatusDropdownVisible(false); } },
      React.createElement(TouchableOpacity, { onPress: function() { setStatusDropdownVisible(false); }, style: { flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 20 } },
        React.createElement(View, { style: { backgroundColor: theme.colors.card, borderRadius: 16, overflow: 'hidden' } },
          ['All','Pending','Paid','Paid in Advance','Spent','Received'].map(function(s) {
            var isActive = statusFilter === s;
            return React.createElement(TouchableOpacity, { key: s, onPress: function() { setStatusFilter(s); setStatusDropdownVisible(false); },
              style: { paddingHorizontal: 16, paddingVertical: 14, backgroundColor: isActive ? (theme.colors.primary + '15') : theme.colors.card, borderBottomWidth: 1, borderBottomColor: theme.colors.border }
            },
              React.createElement(Text, { style: { color: isActive ? theme.colors.primary : theme.colors.textPrimary, fontSize: 15, fontWeight: isActive ? '700' : '600' } }, s)
            );
          })
        )
      )
    ),
    React.createElement(View, { testID: 'View-63', style: { backgroundColor: totalShown >= 0 ? '#E6F4EA' : '#FEF2F2', paddingHorizontal: 20, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, componentId: 'history-summary' },
      React.createElement(Text, { testID: 'Text-84', style: { color: theme.colors.textSecondary, fontSize: 13 } }, totalShown >= 0 ? 'Net Income shown:' : 'Net Expenses shown:'),
      React.createElement(Text, { testID: 'Text-85', style: { color: totalShown >= 0 ? theme.colors.primary : theme.colors.error, fontSize: 15, fontWeight: 'bold' } }, (totalShown >= 0 ? '+' : '-') + formatCurrency(Math.abs(totalShown)))
    ),
    loading ? React.createElement(View, { testID: 'View-64', style: { flex: 1, alignItems: 'center', justifyContent: 'center' }, componentId: 'history-loading' },
      React.createElement(ActivityIndicator, { testID: 'ActivityIndicator-5', size: 'large', color: theme.colors.primary })
    ) :
    React.createElement(FlatList, { testID: 'FlatList-1', data: filteredHistory.slice(0, visibleCount),
      keyExtractor: function(item) { return item.id; },
      contentContainerStyle: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: scrollBottomPadding },
      ListFooterComponent: visibleCount < filteredHistory.length ? React.createElement(TouchableOpacity, {
        onPress: () => setVisibleCount(visibleCount + 5),
        style: { alignItems: 'center', paddingVertical: 16 }
      }, React.createElement(Text, { style: { color: theme.colors.primary, fontWeight: 'bold' } }, "See More (" + (filteredHistory.length - visibleCount) + " hidden)")) : null,
      ListEmptyComponent: React.createElement(View, { testID: 'View-65', style: { alignItems: 'center', paddingTop: 40, paddingHorizontal: 30 }, componentId: 'history-empty' },
        React.createElement(Text, { style: { fontSize: 18, fontWeight: 'bold', color: theme.colors.textPrimary, marginBottom: 8, textAlign: 'center' } }, 'Your history is a clean slate! ✨'),
        React.createElement(Text, { testID: 'Text-86', style: { fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', lineHeight: 22 } }, "It looks a bit quiet here right now. Tap the + button on the home screen to log your first transaction and start tracking your financial journey!")
      ),
      renderItem: function(itemData) {
        var item = itemData.item;
        var isIncome = item.type === 'Income';

        return (
          <View key={item.id} style={{ backgroundColor: theme.colors.card, borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}>
             <View style={{ width: 40, height: 40, borderRadius: 12, backgroundColor: isIncome ? '#FED7AA' : (item.type === 'Transfer' ? '#E0F2FE' : (item.type === 'Recurring' ? '#FFFBEB' : '#EDE9FE')), alignItems: 'center', justifyContent: 'center', marginRight: 12 }}>
                <MaterialIcons name={getTypeIcon(item.type)} size={20} color={isIncome ? theme.colors.primary : (item.type === 'Transfer' ? '#0284C7' : (item.type === 'Recurring' ? theme.colors.warning : '#7C3AED'))} />
             </View>
             <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary }}>{item.name}</Text>
                <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>{formatDate(item.date) + (item.notes ? ' • ' + item.notes : '') + ' • ' + item.type}</Text>
             </View>
             <View style={{ alignItems: 'flex-end' }}>
                <Text style={{ fontSize: 15, fontWeight: 'bold', color: isIncome ? theme.colors.primary : (item.type === 'Transfer' ? '#0284C7' : theme.colors.error) }}>{(isIncome ? '+' : (item.type === 'Transfer' ? '⇄ ' : '-')) + formatCurrency(item.amount)}</Text>
                {item.status ? (
                <View style={{ backgroundColor: item.status === 'Received' ? '#FED7AA' : (item.status === 'Spent' ? '#FEE2E2' : (item.status === 'Paid' ? '#FED7AA' : (item.status === 'Paid in Advance' ? '#EFF6FF' : '#FFFBEB'))), borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 }}>
                   <Text style={{ fontSize: 11, color: getStatusColor(item.status), fontWeight: '600' }}>{item.status}</Text>
                </View>
                ) : null}
             </View>
          </View>
        );
      }
    })
  );
};

export default HistoryScreen;

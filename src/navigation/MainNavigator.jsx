import React, { useState, useEffect } from 'react';
import { View, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import { useQuery } from 'platform-hooks';
import DashboardScreen from '../screens/DashboardScreen';
import RecurringScreen from '../screens/RecurringScreen';
import HistoryScreen from '../screens/HistoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
import ForgotPasswordScreen from '../screens/ForgotPasswordScreen';
import PinLockScreen from '../screens/PinLockScreen';
import StatisticsScreen from '../screens/StatisticsScreen';
import { useUser } from '../contexts/UserContext';

const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const TAB_MENU_HEIGHT = Platform.OS === 'web' ? 56 : 49;

const TabNavigator = function() {
  var insets = useSafeAreaInsets();
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  
  var userCtx = useUser();
  var currentUser = userCtx.currentUser;
  var userId = currentUser ? currentUser.id : null;
  
  var [hasViewedBills, setHasViewedBills] = useState(false);
  var [lastViewedCount, setLastViewedCount] = useState(function() {
    try {
      return parseInt(localStorage.getItem('last_viewed_bill_count_' + userId)) || 0;
    } catch(e) { return 0; }
  });

  var recurringQuery = useQuery('recurring_expenses');
  var allRecurring = recurringQuery.data || [];
  var pendingCount = allRecurring.filter(function(r) { return r.user_id === userId && r.status === 'Pending'; }).length;

  useEffect(() => {
    if (pendingCount > lastViewedCount) {
      setHasViewedBills(false);
    } else {
      setHasViewedBills(true);
    }
  }, [pendingCount, lastViewedCount]);

  return React.createElement(View, { testID: 'View-87', style: { flex: 1, width: '100%', height: '100%', overflow: 'hidden' } },
    React.createElement(Tab.Navigator, { testID: 'Navigator-1', screenOptions: {
        headerShown: false,
        tabBarStyle: { 
          position: 'absolute', 
          bottom: Math.max(insets.bottom, 16),
          left: 16, 
          right: 16, 
          height: 60, 
          borderRadius: 24, 
          borderWidth: 1, 
          borderColor: theme.colors.border,
          backgroundColor: theme.colors.card, 
          shadowColor: '#000', 
          shadowOffset: { width: 0, height: 4 }, 
          shadowOpacity: 0.08, 
          shadowRadius: 12, 
          elevation: 6,
          paddingBottom: 0
        },
        tabBarItemStyle: { paddingVertical: 6 },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarLabelStyle: { fontSize: 10, fontWeight: '600', marginBottom: 2 }
      }
    },
      React.createElement(Tab.Screen, { testID: 'Screen-1', name: 'Dashboard',
        component: DashboardScreen,
        options: {
          tabBarLabel: 'Home',
          tabBarIcon: function(p) { return React.createElement(MaterialIcons, { testID: 'MaterialIcons-18', name: 'home', size: 24, color: p.color }); }
        }
      }),
      React.createElement(Tab.Screen, { testID: 'Screen-2', name: 'Recurring',
        component: RecurringScreen,
        listeners: {
          tabPress: function() {
            setHasViewedBills(true);
            try {
              localStorage.setItem('last_viewed_bill_count_' + userId, pendingCount.toString());
              setLastViewedCount(pendingCount);
            } catch(e) {}
          }
        },
        options: {
          tabBarLabel: 'Bills',
          tabBarBadge: (!hasViewedBills && pendingCount > lastViewedCount) ? (pendingCount - lastViewedCount) : undefined,
          tabBarBadgeStyle: { backgroundColor: '#EF4444', color: '#FFFFFF', fontSize: 10 },
          tabBarIcon: function(p) { return React.createElement(MaterialIcons, { testID: 'MaterialIcons-19', name: 'repeat', size: 24, color: p.color }); }
        }
      }),
      React.createElement(Tab.Screen, { testID: 'Screen-Statistics', name: 'Statistics',
        component: StatisticsScreen,
        options: {
          tabBarLabel: 'Analytics',
          tabBarIcon: function(p) { return React.createElement(MaterialIcons, { testID: 'MaterialIcons-Statistics', name: 'insert-chart', size: 24, color: p.color }); }
        }
      }),
      React.createElement(Tab.Screen, { testID: 'Screen-3', name: 'History',
        component: HistoryScreen,
        options: {
          tabBarLabel: 'History',
          tabBarIcon: function(p) { return React.createElement(MaterialIcons, { testID: 'MaterialIcons-20', name: 'history', size: 24, color: p.color }); }
        }
      }),
      React.createElement(Tab.Screen, { testID: 'Screen-4', name: 'Settings',
        component: SettingsScreen,
        options: {
          tabBarLabel: 'Settings',
          tabBarIcon: function(p) { return React.createElement(MaterialIcons, { testID: 'MaterialIcons-21', name: 'settings', size: 24, color: p.color }); }
        }
      })
    )
  );
};

const MainNavigator = function() {
  var userCtx = useUser();
  var currentUser = userCtx.currentUser;
  var initialRoute = currentUser ? 'MainApp' : 'Login';

  return React.createElement(Stack.Navigator, { 
    testID: 'Navigator-2', 
    screenOptions: { headerShown: false }, 
    initialRouteName: initialRoute 
  },
    React.createElement(Stack.Screen, { testID: 'Screen-5', name: 'Login', component: LoginScreen, options: { gestureEnabled: false } }),
    React.createElement(Stack.Screen, { testID: 'Screen-6', name: 'Register', component: RegisterScreen, options: { gestureEnabled: false } }),
    React.createElement(Stack.Screen, { name: 'ForgotPassword', component: ForgotPasswordScreen, options: { gestureEnabled: false } }),
    React.createElement(Stack.Screen, { testID: 'Screen-7', name: 'MainApp', component: TabNavigator, options: { gestureEnabled: false } })
  );
};

export default MainNavigator;

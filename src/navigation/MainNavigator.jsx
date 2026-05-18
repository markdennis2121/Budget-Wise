import React from 'react';
import { View, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import DashboardScreen from '../screens/DashboardScreen';
import RecurringScreen from '../screens/RecurringScreen';
import HistoryScreen from '../screens/HistoryScreen';
import SettingsScreen from '../screens/SettingsScreen';
import LoginScreen from '../screens/LoginScreen';
import RegisterScreen from '../screens/RegisterScreen';
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
  return React.createElement(View, { testID: 'View-87', style: { flex: 1, width: '100%', height: '100%', overflow: 'hidden' } },
    React.createElement(Tab.Navigator, { testID: 'Navigator-1', screenOptions: {
        headerShown: false,
        tabBarStyle: { position: 'absolute', bottom: 0, height: Platform.OS === 'web' ? TAB_MENU_HEIGHT : TAB_MENU_HEIGHT + insets.bottom, borderTopWidth: 0, backgroundColor: theme.colors.card, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 8 },
        tabBarItemStyle: { padding: 0 },
        tabBarActiveTintColor: theme.colors.primary,
        tabBarInactiveTintColor: theme.colors.textSecondary,
        tabBarLabelStyle: { fontSize: 11, fontWeight: '600', marginBottom: 2 }
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
        options: {
          tabBarLabel: 'Bills',
          tabBarIcon: function(p) { return React.createElement(MaterialIcons, { testID: 'MaterialIcons-19', name: 'repeat', size: 24, color: p.color }); }
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
  return React.createElement(Stack.Navigator, { testID: 'Navigator-2', screenOptions: { headerShown: false }, initialRouteName: 'Login' },
    React.createElement(Stack.Screen, { testID: 'Screen-5', name: 'Login', component: LoginScreen }),
    React.createElement(Stack.Screen, { testID: 'Screen-6', name: 'Register', component: RegisterScreen }),
    React.createElement(Stack.Screen, { testID: 'Screen-7', name: 'MainApp', component: TabNavigator })
  );
};

export default MainNavigator;

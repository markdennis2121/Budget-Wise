import React, { useState, useEffect } from 'react';
import { View, Platform, useWindowDimensions, TouchableOpacity, Text } from 'react-native';
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

const WebSideBar = ({ state, navigation, theme, pendingCount }) => {
  const tabs = [
    { name: 'Dashboard', label: 'Home', icon: 'home' },
    { name: 'Recurring', label: 'Bills', icon: 'repeat', badge: pendingCount > 0 },
    { name: 'Statistics', label: 'Analytics', icon: 'insert-chart' },
    { name: 'History', label: 'History', icon: 'history' },
    { name: 'Settings', label: 'Settings', icon: 'settings' },
  ];

  return (
    <View style={{
      width: 280,
      backgroundColor: theme.colors.card,
      borderRightWidth: 1,
      borderRightColor: theme.colors.border,
      paddingTop: 50,
      paddingHorizontal: 20,
      height: '100%'
    }}>
      <View style={{ marginBottom: 40, paddingHorizontal: 12 }}>
        <Text style={{ fontSize: 28, fontWeight: '900', color: theme.colors.primary, letterSpacing: -1 }}>PENNY</Text>
        <Text style={{ fontSize: 11, fontWeight: 'bold', color: theme.colors.textSecondary, letterSpacing: 1, marginTop: -2 }}>BUDGETING SYSTEM</Text>
      </View>

      {tabs.map((tab, index) => {
        const isSelected = state.index === index;
        return (
          <TouchableOpacity
            key={tab.name}
            onPress={() => navigation.navigate(tab.name)}
            activeOpacity={0.7}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              paddingVertical: 16,
              paddingHorizontal: 18,
              borderRadius: 20,
              backgroundColor: isSelected ? theme.colors.primary + '15' : 'transparent',
              marginBottom: 10
            }}
          >
            <MaterialIcons
              name={tab.icon}
              size={26}
              color={isSelected ? theme.colors.primary : theme.colors.textSecondary}
            />
            <Text style={{
              marginLeft: 16,
              fontSize: 16,
              fontWeight: isSelected ? '800' : '600',
              color: isSelected ? theme.colors.primary : theme.colors.textSecondary
            }}>
              {tab.label}
            </Text>
            {tab.badge && (
              <View style={{
                marginLeft: 'auto',
                backgroundColor: '#EF4444',
                borderRadius: 12,
                paddingHorizontal: 8,
                paddingVertical: 3
              }}>
                <Text style={{ color: '#FFFFFF', fontSize: 10, fontWeight: 'bold' }}>{pendingCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}

      <View style={{ marginTop: 'auto', marginBottom: 30, paddingHorizontal: 12 }}>
        <View style={{ backgroundColor: theme.colors.background, padding: 16, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border }}>
          <Text style={{ fontSize: 12, color: theme.colors.textSecondary, fontWeight: 'bold' }}>VERSION</Text>
          <Text style={{ fontSize: 14, color: theme.colors.textPrimary, fontWeight: '800' }}>5.4.2 Release</Text>
        </View>
      </View>
    </View>
  );
};

const CustomTabBar = (props) => {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 1024;
  const { insets, theme, pendingCount } = props;

  if (isDesktopWeb) {
    return <WebSideBar {...props} theme={theme} pendingCount={pendingCount} />;
  }

  return (
    <View style={{
      position: 'absolute',
      bottom: Math.max(insets.bottom, 16),
      left: 16,
      right: 16,
      height: 65,
      borderRadius: 24,
      borderWidth: 1,
      borderColor: theme.colors.border,
      backgroundColor: theme.colors.card,
      shadowColor: '#000',
      shadowOffset: { width: 0, height: 4 },
      shadowOpacity: 0.1,
      shadowRadius: 15,
      elevation: 8,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-around',
      paddingHorizontal: 10
    }}>
      {props.state.routes.map((route, index) => {
        const { options } = props.descriptors[route.key];
        const label = options.tabBarLabel !== undefined ? options.tabBarLabel : options.title !== undefined ? options.title : route.name;
        const isFocused = props.state.index === index;

        const onPress = () => {
          const event = props.navigation.emit({ type: 'tabPress', target: route.key, canPreventDefault: true });
          if (!isFocused && !event.defaultPrevented) {
            props.navigation.navigate({ name: route.name, merge: true });
          }
        };

        const iconName = route.name === 'Dashboard' ? 'home' : route.name === 'Recurring' ? 'repeat' : route.name === 'Statistics' ? 'insert-chart' : route.name === 'History' ? 'history' : 'settings';

        return (
          <TouchableOpacity
            key={route.key}
            onPress={onPress}
            style={{ alignItems: 'center', justifyContent: 'center', flex: 1, height: '100%' }}
          >
            <View style={{
              paddingVertical: 8,
              paddingHorizontal: 16,
              borderRadius: 16,
              backgroundColor: isFocused ? theme.colors.primary + '10' : 'transparent',
              alignItems: 'center'
            }}>
              <MaterialIcons name={iconName} size={24} color={isFocused ? theme.colors.primary : theme.colors.textSecondary} />
              <Text style={{
                color: isFocused ? theme.colors.primary : theme.colors.textSecondary,
                fontSize: 10,
                fontWeight: isFocused ? 'bold' : '500',
                marginTop: 2
              }}>
                {label}
              </Text>
            </View>
            {route.name === 'Recurring' && props.pendingCount > 0 && (
              <View style={{ position: 'absolute', top: 8, right: '20%', backgroundColor: '#EF4444', borderRadius: 8, minWidth: 16, height: 16, alignItems: 'center', justifyContent: 'center' }}>
                <Text style={{ color: '#FFFFFF', fontSize: 9, fontWeight: 'bold' }}>{props.pendingCount}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
    </View>
  );
};

const TabNavigator = function() {
  const { width } = useWindowDimensions();
  const isDesktopWeb = Platform.OS === 'web' && width > 1024;

  var insets = useSafeAreaInsets();
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  
  var userCtx = useUser();
  var currentUser = userCtx.currentUser;
  var userId = currentUser ? currentUser.id : null;
  
  var recurringQuery = useQuery('recurring_expenses');
  var allRecurring = recurringQuery.data || [];
  var pendingCount = allRecurring.filter(function(r) { return r.user_id === userId && r.status === 'Pending'; }).length;

  return (
    <View style={{ flex: 1, flexDirection: isDesktopWeb ? 'row' : 'column', backgroundColor: theme.colors.background }}>
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} insets={insets} theme={theme} pendingCount={pendingCount} />}
        screenOptions={{
          headerShown: false,
          // Premium Web Layout: Center the content and cap its width
          sceneContainerStyle: isDesktopWeb ? {
            maxWidth: 1200,
            width: '100%',
            alignSelf: 'center',
            backgroundColor: theme.colors.background,
            // Add a subtle border or shadow to the main content area on web
            borderLeftWidth: 1,
            borderLeftColor: theme.colors.border,
            borderRightWidth: 1,
            borderRightColor: theme.colors.border
          } : {}
        }}
      >
        <Tab.Screen name="Dashboard" component={DashboardScreen} options={{ tabBarLabel: 'Home' }} />
        <Tab.Screen name="Recurring" component={RecurringScreen} options={{ tabBarLabel: 'Bills' }} />
        <Tab.Screen name="Statistics" component={StatisticsScreen} options={{ tabBarLabel: 'Analytics' }} />
        <Tab.Screen name="History" component={HistoryScreen} options={{ tabBarLabel: 'History' }} />
        <Tab.Screen name="Settings" component={SettingsScreen} options={{ tabBarLabel: 'Settings' }} />
      </Tab.Navigator>
    </View>
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

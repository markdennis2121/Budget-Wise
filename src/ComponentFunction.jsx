import React, { useState, useEffect, useContext, useMemo, useCallback, createContext } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, Alert, Platform, StatusBar, ActivityIndicator, KeyboardAvoidingView, FlatList, Dimensions, Image } from 'react-native';
import { MaterialIcons, Ionicons } from '@expo/vector-icons';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import { useQuery, useMutation } from 'platform-hooks';
import { NavigationContainer } from '@react-navigation/native';

import { SafeAreaProvider, useSafeAreaInsets } from 'react-native-safe-area-context';
import AppLogo from './assets/logo.png';

const KeyboardAvoidingWrapper = function(props) {
  if (Platform.OS === 'web') {
    return React.createElement(View, { testID: props.testID, style: props.style }, props.children);
  }
  return React.createElement(KeyboardAvoidingView, props);
};

// @section:theme @depends:[]
const primaryColor = '#059669';
const accentColor = '#10B981';
const backgroundColor = '#F0FDF4';
const cardColor = '#FFFFFF';
const textPrimary = '#111827';
const textSecondary = '#6B7280';
const dangerColor = '#EF4444';
const warningColor = '#F59E0B';
const infoColor = '#3B82F6';
// @end:theme

// @section:navigation-setup @depends:[]
const Tab = createBottomTabNavigator();
const Stack = createStackNavigator();
const TAB_MENU_HEIGHT = Platform.OS === 'web' ? 56 : 49;
const SCROLL_EXTRA_PADDING = 16;
const WEB_TAB_MENU_PADDING = 90;
const FAB_SPACING = 16;
// @end:navigation-setup

// @section:utilities @depends:[]
const generateId = function() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    var v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};
const padNum = function(n) { return n < 10 ? '0' + n : String(n); };
const getTodayStr = function() {
  var d = new Date();
  return d.getFullYear() + '-' + padNum(d.getMonth() + 1) + '-' + padNum(d.getDate());
};
const formatCurrency = function(amount) {
  var num = parseFloat(amount) || 0;
  return '₱' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};
const formatDate = function(dateStr) {
  if (!dateStr) return '';
  var parts = dateStr.split('-');
  if (parts.length !== 3) return dateStr;
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[parseInt(parts[1], 10) - 1] + ' ' + parseInt(parts[2], 10) + ', ' + parts[0];
};
const isWithin5Days = function(dueDateStr) {
  if (!dueDateStr) return false;
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);
  var diffMs = due.getTime() - today.getTime();
  var diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 5;
};
const isOverdue = function(dueDateStr) {
  if (!dueDateStr) return false;
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var due = new Date(dueDateStr);
  due.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
};
const getMonthStr = function(dateStr) {
  if (!dateStr) return '';
  var parts = dateStr.split('-');
  return parts[0] + '-' + parts[1];
};
const getCurrentMonthStr = function() {
  var d = new Date();
  return d.getFullYear() + '-' + padNum(d.getMonth() + 1);
};
// @end:utilities

// @section:UserContext @depends:[]
const UserContext = createContext({ currentUser: null, setCurrentUser: function() {} });
const UserProvider = function(props) {
  var userState = useState(null);
  var currentUser = userState[0];
  var setCurrentUser = userState[1];
  var value = useMemo(function() {
    return { currentUser: currentUser, setCurrentUser: setCurrentUser };
  }, [currentUser]);
  return React.createElement(UserContext.Provider, { testID: 'Provider-1', value: value }, props.children);
};
const useUser = function() { return useContext(UserContext); };
// @end:UserContext

// @section:ThemeContext @depends:[theme]
const ThemeContext = createContext({
  theme: {
    colors: {
      primary: primaryColor, accent: accentColor, background: backgroundColor,
      card: cardColor, textPrimary: textPrimary, textSecondary: textSecondary,
      border: '#D1FAE5', success: '#059669', error: dangerColor, warning: warningColor, info: infoColor
    }
  }
});
const ThemeProvider = function(props) {
  var theme = useMemo(function() {
    return {
      colors: {
        primary: primaryColor, accent: accentColor, background: backgroundColor,
        card: cardColor, textPrimary: textPrimary, textSecondary: textSecondary,
        border: '#D1FAE5', success: '#059669', error: dangerColor, warning: warningColor, info: infoColor
      }
    };
  }, []);
  var value = useMemo(function() { return { theme: theme }; }, [theme]);
  return React.createElement(ThemeContext.Provider, { testID: 'Provider-2', value: value }, props.children);
};
const useTheme = function() { return useContext(ThemeContext); };
// @end:ThemeContext

// @section:DatePickerInput @depends:[imports]
const DatePickerInput = function(props) {
  var parsed = props.value ? props.value.split('-') : null;
  var nowYear = new Date().getFullYear();
  var nowMonth = new Date().getMonth() + 1;
  var nowDay = new Date().getDate();
  var initYear = parsed ? parseInt(parsed[0], 10) : nowYear;
  var initMonth = parsed ? parseInt(parsed[1], 10) : nowMonth;
  var initDay = parsed ? parseInt(parsed[2], 10) : nowDay;
  var showState = useState(false);
  var showPicker = showState[0];
  var setShow = showState[1];
  var yearState = useState(initYear);
  var selYear = yearState[0];
  var setSelYear = yearState[1];
  var monthState = useState(initMonth);
  var selMonth = monthState[0];
  var setSelMonth = monthState[1];
  var dayState = useState(initDay);
  var selDay = dayState[0];
  var setSelDay = dayState[1];
  useEffect(function() {
    var maxDay = new Date(selYear, selMonth, 0).getDate();
    if (selDay > maxDay) { setSelDay(maxDay); }
  }, [selYear, selMonth]);
  var handleConfirm = function() {
    if (props.onChange) { props.onChange(selYear + '-' + padNum(selMonth) + '-' + padNum(selDay)); }
    setShow(false);
  };
  var displayValue = props.value ? (padNum(selMonth) + '/' + padNum(selDay) + '/' + selYear) : (props.placeholder || 'Select date');
  if (Platform.OS === 'web') {
    return React.createElement('input', { testID: 'input-1', type: 'date', value: props.value || '',
      onChange: function(e) { if (props.onChange) { props.onChange(e.target.value); } },
      style: Object.assign({}, { padding: 12, border: '1px solid #D1FAE5', borderRadius: 8, fontSize: 16, width: '100%', boxSizing: 'border-box', color: textPrimary, backgroundColor: '#F0FDF4', outline: 'none' }, props.style)
    });
  }
  var MONTHS = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var years = [];
  for (var y = nowYear - 5; y <= nowYear + 5; y++) { years.push(y); }
  var daysInMonth = new Date(selYear, selMonth, 0).getDate();
  var days = [];
  for (var d = 1; d <= daysInMonth; d++) { days.push(d); }
  var colStyle = { flex: 1, maxHeight: 180 };
  var itemStyleFn = function(active) { return { paddingVertical: 10, alignItems: 'center', backgroundColor: active ? '#D1FAE5' : 'transparent' }; };
  var itemTextStyleFn = function(active) { return { fontSize: 15, color: active ? primaryColor : textPrimary, fontWeight: active ? 'bold' : 'normal' }; };
  return React.createElement(View, { testID: 'View-1', componentId: props.componentId },
    React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-1', onPress: function() { setShow(true); },
      style: Object.assign({}, { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', borderWidth: 1, borderColor: '#D1FAE5', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 13, backgroundColor: '#F0FDF4' }, props.style)
    },
      React.createElement(Text, { testID: 'Text-1', style: { fontSize: 15, color: props.value ? textPrimary : textSecondary } }, displayValue),
      React.createElement(MaterialIcons, { testID: 'MaterialIcons-1', name: 'calendar-today', size: 18, color: primaryColor })
    ),
    React.createElement(Modal, { testID: 'Modal-1', visible: showPicker, transparent: true, animationType: 'slide', onRequestClose: function() { setShow(false); } },
      React.createElement(View, { testID: 'View-2', style: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.4)' } },
        React.createElement(View, { testID: 'View-3', style: { backgroundColor: cardColor, borderTopLeftRadius: 20, borderTopRightRadius: 20, padding: 20, paddingBottom: 36 } },
          React.createElement(Text, { testID: 'Text-2', style: { fontSize: 17, fontWeight: 'bold', textAlign: 'center', marginBottom: 16, color: textPrimary } }, 'Select Date'),
          React.createElement(View, { testID: 'View-4', style: { flexDirection: 'row', borderRadius: 10, overflow: 'hidden' } },
            React.createElement(ScrollView, { testID: 'ScrollView-1', style: colStyle, showsVerticalScrollIndicator: false },
              MONTHS.map(function(m, i) {
                var active = selMonth === i + 1;
                return React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-2', key: String(i), onPress: function() { setSelMonth(i + 1); }, style: itemStyleFn(active) },
                  React.createElement(Text, { testID: 'Text-3', style: itemTextStyleFn(active) }, m));
              })
            ),
            React.createElement(ScrollView, { testID: 'ScrollView-2', style: colStyle, showsVerticalScrollIndicator: false },
              days.map(function(d2) {
                var active = selDay === d2;
                return React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-3', key: String(d2), onPress: function() { setSelDay(d2); }, style: itemStyleFn(active) },
                  React.createElement(Text, { testID: 'Text-4', style: itemTextStyleFn(active) }, String(d2)));
              })
            ),
            React.createElement(ScrollView, { testID: 'ScrollView-3', style: colStyle, showsVerticalScrollIndicator: false },
              years.map(function(yr) {
                var active = selYear === yr;
                return React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-4', key: String(yr), onPress: function() { setSelYear(yr); }, style: itemStyleFn(active) },
                  React.createElement(Text, { testID: 'Text-5', style: itemTextStyleFn(active) }, String(yr)));
              })
            )
          ),
          React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-5', onPress: handleConfirm, style: { backgroundColor: primaryColor, borderRadius: 10, padding: 14, alignItems: 'center', marginTop: 16 } },
            React.createElement(Text, { testID: 'Text-6', style: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' } }, 'Confirm')),
          React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-6', onPress: function() { setShow(false); }, style: { padding: 12, alignItems: 'center' } },
            React.createElement(Text, { testID: 'Text-7', style: { color: textSecondary, fontSize: 15 } }, 'Cancel'))
        )
      )
    )
  );
};
// @end:DatePickerInput

// @section:LoginScreen @depends:[ThemeContext,UserContext,styles]
const LoginScreen = function(props) {
  var navigation = props.navigation;
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var userCtx = useUser();
  var insets = useSafeAreaInsets();
  var emailState = useState('');
  var email = emailState[0]; var setEmail = emailState[1];
  var passState = useState('');
  var password = passState[0]; var setPassword = passState[1];
  var errState = useState('');
  var errorMsg = errState[0]; var setErrorMsg = errState[1];
  var usersQuery = useQuery('budget_users');
  var allUsers = usersQuery.data || [];
  var loadingState = useState(false);
  var isLoading = loadingState[0]; var setIsLoading = loadingState[1];
  var handleLogin = function() {
    if (!email.trim() || !password.trim()) { setErrorMsg('Please enter email and password.'); return; }
    setIsLoading(true);
    setErrorMsg('');
    setTimeout(function() {
      var found = allUsers.find(function(u) { return u.email === email.trim().toLowerCase() && u.password === password; });
      if (found) {
        userCtx.setCurrentUser(found);
        navigation.replace('MainApp');
      } else {
        setErrorMsg('Invalid email or password.');
      }
      setIsLoading(false);
    }, 300);
  };
  var winH = Dimensions.get('window').height;
  return React.createElement(KeyboardAvoidingWrapper, { testID: 'KeyboardAvoidingView-1', behavior: Platform.OS === 'ios' ? 'padding' : 'height',
    style: { flex: 1, backgroundColor: theme.colors.background }
  },
    React.createElement(ScrollView, { testID: 'ScrollView-4', contentContainerStyle: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }
    },
      React.createElement(View, { testID: 'View-5', style: { alignItems: 'center', marginBottom: 40 }, componentId: 'login-logo' },
        React.createElement(Image, { source: AppLogo, style: { width: 90, height: 90, borderRadius: 22, marginBottom: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 } }),
        React.createElement(Text, { testID: 'Text-8', style: { fontSize: 28, fontWeight: 'bold', color: textPrimary, letterSpacing: 0.3 } }, 'Budget Tracker'),
        React.createElement(Text, { testID: 'Text-9', style: { fontSize: 15, color: textSecondary, marginTop: 6 } }, 'Track your finances with ease')
      ),
      React.createElement(View, { testID: 'View-7', style: { backgroundColor: cardColor, borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 }, componentId: 'login-card' },
        React.createElement(Text, { testID: 'Text-10', style: { fontSize: 22, fontWeight: 'bold', color: textPrimary, marginBottom: 24 } }, 'Sign In'),
        errorMsg ? React.createElement(View, { testID: 'View-8', style: { backgroundColor: '#FEF2F2', borderRadius: 8, padding: 12, marginBottom: 16 } },
          React.createElement(Text, { testID: 'Text-11', style: { color: dangerColor, fontSize: 14 } }, errorMsg)
        ) : null,
        React.createElement(Text, { testID: 'Text-12', style: { fontSize: 13, fontWeight: '600', color: textSecondary, marginBottom: 6 } }, 'EMAIL'),
        React.createElement(TextInput, { testID: 'TextInput-1', value: email, onChangeText: setEmail, placeholder: 'your@email.com',
          keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false,
          style: { backgroundColor: backgroundColor, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 14, fontSize: 15, color: textPrimary, marginBottom: 16 },
          componentId: 'login-email-input'
        }),
        React.createElement(Text, { testID: 'Text-13', style: { fontSize: 13, fontWeight: '600', color: textSecondary, marginBottom: 6 } }, 'PASSWORD'),
        React.createElement(TextInput, { testID: 'TextInput-2', value: password, onChangeText: setPassword, placeholder: '••••••••',
          secureTextEntry: true, autoCapitalize: 'none', autoCorrect: false,
          style: { backgroundColor: backgroundColor, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 14, fontSize: 15, color: textPrimary, marginBottom: 24 },
          componentId: 'login-password-input'
        }),
        React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-7', onPress: handleLogin, disabled: isLoading,
          style: { backgroundColor: isLoading ? accentColor : primaryColor, borderRadius: 12, padding: 16, alignItems: 'center' },
          componentId: 'login-submit-btn'
        },
          isLoading ? React.createElement(ActivityIndicator, { testID: 'ActivityIndicator-1', color: '#FFFFFF' }) :
          React.createElement(Text, { testID: 'Text-14', style: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' } }, 'Sign In')
        ),
        React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-8', onPress: function() { navigation.navigate('Register'); },
          style: { marginTop: 16, alignItems: 'center' },
          componentId: 'go-register-btn'
        },
          React.createElement(Text, { testID: 'Text-15', style: { color: textSecondary, fontSize: 14 } },
            "Don't have an account? ",
            React.createElement(Text, { testID: 'Text-16', style: { color: primaryColor, fontWeight: '600' } }, 'Sign Up')
          )
        )
      )
    )
  );
};
// @end:LoginScreen

// @section:RegisterScreen @depends:[ThemeContext,UserContext,styles]
const RegisterScreen = function(props) {
  var navigation = props.navigation;
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var userCtx = useUser();
  var insets = useSafeAreaInsets();
  var nameState = useState('');
  var name = nameState[0]; var setName = nameState[1];
  var emailState = useState('');
  var email = emailState[0]; var setEmail = emailState[1];
  var passState = useState('');
  var password = passState[0]; var setPassword = passState[1];
  var confirmPassState = useState('');
  var confirmPassword = confirmPassState[0]; var setConfirmPassword = confirmPassState[1];
  var errState = useState('');
  var errorMsg = errState[0]; var setErrorMsg = errState[1];
  var loadingState = useState(false);
  var isLoading = loadingState[0]; var setIsLoading = loadingState[1];
  var usersQuery = useQuery('budget_users');
  var allUsers = usersQuery.data || [];
  var insertUser = useMutation('budget_users', 'insert');
  var mutateUser = insertUser.mutate;
  var insertSettings = useMutation('user_settings', 'insert');
  var mutateSettings = insertSettings.mutate;
  var handleRegister = function() {
    if (!name.trim() || !email.trim() || !password.trim()) { setErrorMsg('Please fill all fields.'); return; }
    if (password !== confirmPassword) { setErrorMsg('Passwords do not match.'); return; }
    if (password.length < 6) { setErrorMsg('Password must be at least 6 characters.'); return; }
    var existing = allUsers.find(function(u) { return u.email === email.trim().toLowerCase(); });
    if (existing) { setErrorMsg('Email already registered.'); return; }
    setIsLoading(true);
    setErrorMsg('');
    var newId = generateId();
    var newUser = { id: newId, email: email.trim().toLowerCase(), password: password, name: name.trim(), created_at: getTodayStr() };
    mutateUser(newUser).then(function() {
      var settingsId = generateId();
      return mutateSettings({ id: settingsId, user_id: newId, monthly_salary: 0 });
    }).then(function() {
      userCtx.setCurrentUser(newUser);
      navigation.replace('MainApp');
      setIsLoading(false);
    }).catch(function(err) {
      setErrorMsg('Registration failed. Please try again.');
      setIsLoading(false);
    });
  };
  return React.createElement(KeyboardAvoidingWrapper, { testID: 'KeyboardAvoidingView-2', behavior: Platform.OS === 'ios' ? 'padding' : 'height',
    style: { flex: 1, backgroundColor: theme.colors.background }
  },
    React.createElement(ScrollView, { testID: 'ScrollView-5', contentContainerStyle: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }
    },
      React.createElement(View, { testID: 'View-9', style: { alignItems: 'center', marginBottom: 32 }, componentId: 'register-logo' },
        React.createElement(Image, { source: AppLogo, style: { width: 80, height: 80, borderRadius: 20, marginBottom: 14, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.1, shadowRadius: 4 } }),
        React.createElement(Text, { testID: 'Text-17', style: { fontSize: 26, fontWeight: 'bold', color: textPrimary } }, 'Create Account')
      ),
      React.createElement(View, { testID: 'View-11', style: { backgroundColor: cardColor, borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 }, componentId: 'register-card' },
        errorMsg ? React.createElement(View, { testID: 'View-12', style: { backgroundColor: '#FEF2F2', borderRadius: 8, padding: 12, marginBottom: 16 } },
          React.createElement(Text, { testID: 'Text-18', style: { color: dangerColor, fontSize: 14 } }, errorMsg)
        ) : null,
        React.createElement(Text, { testID: 'Text-19', style: { fontSize: 13, fontWeight: '600', color: textSecondary, marginBottom: 6 } }, 'FULL NAME'),
        React.createElement(TextInput, { testID: 'TextInput-3', value: name, onChangeText: setName, placeholder: 'John Doe',
          autoCapitalize: 'words',
          style: { backgroundColor: backgroundColor, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 14, fontSize: 15, color: textPrimary, marginBottom: 16 },
          componentId: 'register-name-input'
        }),
        React.createElement(Text, { testID: 'Text-20', style: { fontSize: 13, fontWeight: '600', color: textSecondary, marginBottom: 6 } }, 'EMAIL'),
        React.createElement(TextInput, { testID: 'TextInput-4', value: email, onChangeText: setEmail, placeholder: 'your@email.com',
          keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false,
          style: { backgroundColor: backgroundColor, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 14, fontSize: 15, color: textPrimary, marginBottom: 16 },
          componentId: 'register-email-input'
        }),
        React.createElement(Text, { testID: 'Text-21', style: { fontSize: 13, fontWeight: '600', color: textSecondary, marginBottom: 6 } }, 'PASSWORD'),
        React.createElement(TextInput, { testID: 'TextInput-5', value: password, onChangeText: setPassword, placeholder: '••••••••',
          secureTextEntry: true, autoCapitalize: 'none', autoCorrect: false,
          style: { backgroundColor: backgroundColor, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 14, fontSize: 15, color: textPrimary, marginBottom: 16 },
          componentId: 'register-pass-input'
        }),
        React.createElement(Text, { testID: 'Text-22', style: { fontSize: 13, fontWeight: '600', color: textSecondary, marginBottom: 6 } }, 'CONFIRM PASSWORD'),
        React.createElement(TextInput, { testID: 'TextInput-6', value: confirmPassword, onChangeText: setConfirmPassword, placeholder: '••••••••',
          secureTextEntry: true, autoCapitalize: 'none', autoCorrect: false,
          style: { backgroundColor: backgroundColor, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 14, fontSize: 15, color: textPrimary, marginBottom: 24 },
          componentId: 'register-confirm-pass-input'
        }),
        React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-9', onPress: handleRegister, disabled: isLoading,
          style: { backgroundColor: isLoading ? accentColor : primaryColor, borderRadius: 12, padding: 16, alignItems: 'center' },
          componentId: 'register-submit-btn'
        },
          isLoading ? React.createElement(ActivityIndicator, { testID: 'ActivityIndicator-2', color: '#FFFFFF' }) :
          React.createElement(Text, { testID: 'Text-23', style: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' } }, 'Create Account')
        ),
        React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-10', onPress: function() { navigation.goBack(); },
          style: { marginTop: 16, alignItems: 'center' },
          componentId: 'go-login-btn'
        },
          React.createElement(Text, { testID: 'Text-24', style: { color: textSecondary, fontSize: 14 } },
            'Already have an account? ',
            React.createElement(Text, { testID: 'Text-25', style: { color: primaryColor, fontWeight: '600' } }, 'Sign In')
          )
        )
      )
    )
  );
};
// @end:RegisterScreen

// @section:AddExpenseModal @depends:[ThemeContext,styles]
const AddExpenseModal = function(props) {
  var visible = props.visible;
  var onClose = props.onClose;
  var onSaved = props.onSaved;
  var userId = props.userId;
  var theme = props.theme;
  var insetsTop = props.insetsTop;
  var insetsBottom = props.insetsBottom;
  var typeState = useState('one_time');
  var expType = typeState[0]; var setExpType = typeState[1];
  var nameState = useState('');
  var expName = nameState[0]; var setExpName = nameState[1];
  var amountState = useState('');
  var expAmount = amountState[0]; var setExpAmount = amountState[1];
  var dateState = useState(getTodayStr());
  var expDate = dateState[0]; var setExpDate = dateState[1];
  var dueDateState = useState(getTodayStr());
  var dueDate = dueDateState[0]; var setDueDate = dueDateState[1];
  var errState = useState('');
  var errorMsg = errState[0]; var setErrorMsg = errState[1];
  var insertRecurring = useMutation('recurring_expenses', 'insert');
  var mutateRecurring = insertRecurring.mutate;
  var insertOneTime = useMutation('one_time_expenses', 'insert');
  var mutateOneTime = insertOneTime.mutate;
  var insertHistory = useMutation('expense_history', 'insert');
  var mutateHistory = insertHistory.mutate;
  var handleSave = function() {
    if (!expName.trim()) { setErrorMsg('Please enter expense name.'); return; }
    var amt = parseFloat(expAmount);
    if (isNaN(amt) || amt <= 0) { setErrorMsg('Please enter a valid amount.'); return; }
    setErrorMsg('');
    if (expType === 'one_time') {
      var newOneTime = { id: generateId(), user_id: userId, name: expName.trim(), amount: amt, date: expDate, category: 'general' };
      mutateOneTime(newOneTime).then(function() {
        return mutateHistory({ id: generateId(), user_id: userId, expense_name: expName.trim(), amount: amt, expense_type: 'One-Time', date: expDate, status: 'Spent', notes: '' });
      }).then(function() {
        setExpName(''); setExpAmount(''); setExpDate(getTodayStr()); onSaved(); onClose();
      }).catch(function() { setErrorMsg('Failed to save. Try again.'); });
    } else {
      var newRecurring = { id: generateId(), user_id: userId, name: expName.trim(), amount: amt, due_date: dueDate, status: 'Pending', category: 'general' };
      mutateRecurring(newRecurring).then(function() {
        setExpName(''); setExpAmount(''); setDueDate(getTodayStr()); onSaved(); onClose();
      }).catch(function() { setErrorMsg('Failed to save. Try again.'); });
    }
  };
  return React.createElement(Modal, { testID: 'Modal-2', visible: visible, animationType: 'slide', transparent: true, onRequestClose: onClose },
    React.createElement(View, { testID: 'View-13', style: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)', marginTop: insetsTop }, componentId: 'add-expense-overlay' },
      React.createElement(View, { testID: 'View-14', style: { backgroundColor: cardColor, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: 24, paddingBottom: insetsBottom + 24, maxHeight: '90%' }, componentId: 'add-expense-content' },
        React.createElement(View, { testID: 'View-15', style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 } },
          React.createElement(Text, { testID: 'Text-26', style: { fontSize: 20, fontWeight: 'bold', color: textPrimary } }, 'Add Expense'),
          React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-11', onPress: onClose, componentId: 'add-expense-close-btn' },
            React.createElement(MaterialIcons, { testID: 'MaterialIcons-4', name: 'close', size: 24, color: textSecondary })
          )
        ),
        React.createElement(ScrollView, { testID: 'ScrollView-6', style: { flex: 1 }, showsVerticalScrollIndicator: false },
          React.createElement(View, { testID: 'View-16', style: { flexDirection: 'row', backgroundColor: backgroundColor, borderRadius: 12, padding: 4, marginBottom: 20 } },
            React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-12', onPress: function() { setExpType('one_time'); },
              style: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center', backgroundColor: expType === 'one_time' ? primaryColor : 'transparent' },
              componentId: 'type-onetime-btn'
            },
              React.createElement(Text, { testID: 'Text-27', style: { color: expType === 'one_time' ? '#FFFFFF' : textSecondary, fontWeight: '600', fontSize: 14 } }, 'One-Time')
            ),
            React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-13', onPress: function() { setExpType('recurring'); },
              style: { flex: 1, padding: 10, borderRadius: 10, alignItems: 'center', backgroundColor: expType === 'recurring' ? primaryColor : 'transparent' },
              componentId: 'type-recurring-btn'
            },
              React.createElement(Text, { testID: 'Text-28', style: { color: expType === 'recurring' ? '#FFFFFF' : textSecondary, fontWeight: '600', fontSize: 14 } }, 'Recurring')
            )
          ),
          errorMsg ? React.createElement(View, { testID: 'View-17', style: { backgroundColor: '#FEF2F2', borderRadius: 8, padding: 10, marginBottom: 14 } },
            React.createElement(Text, { testID: 'Text-29', style: { color: dangerColor, fontSize: 13 } }, errorMsg)
          ) : null,
          React.createElement(Text, { testID: 'Text-30', style: { fontSize: 13, fontWeight: '600', color: textSecondary, marginBottom: 6 } }, 'EXPENSE NAME'),
          React.createElement(TextInput, { testID: 'TextInput-7', value: expName, onChangeText: setExpName, placeholder: 'e.g. Rent, Groceries',
            autoCapitalize: 'words',
            style: { backgroundColor: backgroundColor, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 14, fontSize: 15, color: textPrimary, marginBottom: 16 },
            componentId: 'add-expense-name-input'
          }),
          React.createElement(Text, { testID: 'Text-31', style: { fontSize: 13, fontWeight: '600', color: textSecondary, marginBottom: 6 } }, 'AMOUNT'),
          React.createElement(TextInput, { testID: 'TextInput-8', value: expAmount,
            onChangeText: function(text) {
              var sanitised = text.replace(/[^0-9.]/g, '');
              var parts = sanitised.split('.');
              if (parts.length > 2) { sanitised = parts[0] + '.' + parts.slice(1).join(''); }
              setExpAmount(sanitised);
            },
            placeholder: '0.00', keyboardType: 'decimal-pad',
            style: { backgroundColor: backgroundColor, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 14, fontSize: 15, color: textPrimary, marginBottom: 16 },
            componentId: 'add-expense-amount-input'
          }),
          expType === 'one_time' ? React.createElement(View, { testID: 'View-18' },
            React.createElement(Text, { testID: 'Text-32', style: { fontSize: 13, fontWeight: '600', color: textSecondary, marginBottom: 6 } }, 'DATE'),
            React.createElement(DatePickerInput, { testID: 'DatePickerInput-1', value: expDate, onChange: setExpDate, placeholder: 'Select date', componentId: 'add-expense-date-picker' })
          ) : React.createElement(View, { testID: 'View-19' },
            React.createElement(Text, { testID: 'Text-33', style: { fontSize: 13, fontWeight: '600', color: textSecondary, marginBottom: 6 } }, 'DUE DATE'),
            React.createElement(DatePickerInput, { testID: 'DatePickerInput-2', value: dueDate, onChange: setDueDate, placeholder: 'Select due date', componentId: 'add-expense-duedate-picker' })
          ),
          React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-14', onPress: handleSave,
            style: { backgroundColor: primaryColor, borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 24 },
            componentId: 'add-expense-save-btn'
          },
            React.createElement(Text, { testID: 'Text-34', style: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' } }, 'Save Expense')
          )
        )
      )
    )
  );
};
// @end:AddExpenseModal

// @section:DashboardScreen-state @depends:[UserContext]
const useDashboardState = function(userId) {
  var settingsQuery = useQuery('user_settings');
  var allSettings = settingsQuery.data || [];
  var userSettings = allSettings.find(function(s) { return s.user_id === userId; });
  var salary = userSettings ? (parseFloat(userSettings.monthly_salary) || 0) : 0;
  var settingsLoading = settingsQuery.loading;
  var refetchSettings = settingsQuery.refetch;
  var recurringQuery = useQuery('recurring_expenses');
  var allRecurring = recurringQuery.data || [];
  var recurringExpenses = allRecurring.filter(function(r) { return r.user_id === userId; });
  var refetchRecurring = recurringQuery.refetch;
  var oneTimeQuery = useQuery('one_time_expenses');
  var allOneTime = oneTimeQuery.data || [];
  var curMonth = getCurrentMonthStr();
  var oneTimeExpenses = allOneTime.filter(function(o) { return o.user_id === userId && getMonthStr(o.date) === curMonth; });
  var refetchOneTime = oneTimeQuery.refetch;
  var modalState = useState(false);
  var showAddModal = modalState[0]; var setShowAddModal = modalState[1];
  var totalRecurringPaid = useMemo(function() {
    return recurringExpenses.reduce(function(sum, r) {
      if (r.status === 'Paid' || r.status === 'Paid in Advance') { return sum + (parseFloat(r.amount) || 0); }
      return sum;
    }, 0);
  }, [recurringExpenses]);
  var totalOneTime = useMemo(function() {
    return oneTimeExpenses.reduce(function(sum, o) { return sum + (parseFloat(o.amount) || 0); }, 0);
  }, [oneTimeExpenses]);
  var totalExpenses = totalRecurringPaid + totalOneTime;
  var remaining = salary - totalExpenses;
  var upcomingBills = useMemo(function() {
    return recurringExpenses.filter(function(r) {
      return r.status === 'Pending' && (isWithin5Days(r.due_date) || isOverdue(r.due_date));
    });
  }, [recurringExpenses]);
  var refetchAll = useCallback(function() {
    refetchSettings(); refetchRecurring(); refetchOneTime();
  }, [refetchSettings, refetchRecurring, refetchOneTime]);
  return {
    salary: salary, settingsLoading: settingsLoading,
    recurringExpenses: recurringExpenses, oneTimeExpenses: oneTimeExpenses,
    totalExpenses: totalExpenses, remaining: remaining,
    upcomingBills: upcomingBills, showAddModal: showAddModal, setShowAddModal: setShowAddModal,
    refetchAll: refetchAll
  };
};
// @end:DashboardScreen-state

// @section:DashboardScreen @depends:[DashboardScreen-state,AddExpenseModal,ThemeContext,styles]
const DashboardScreen = function(props) {
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var userCtx = useUser();
  var userId = userCtx.currentUser ? userCtx.currentUser.id : '';
  var userName = userCtx.currentUser ? userCtx.currentUser.name : 'User';
  var insets = useSafeAreaInsets();
  var state = useDashboardState(userId);
  var scrollBottomPadding = Platform.OS === 'web' ? WEB_TAB_MENU_PADDING : (TAB_MENU_HEIGHT + insets.bottom + SCROLL_EXTRA_PADDING);
  var fabBottom = Platform.OS === 'web' ? WEB_TAB_MENU_PADDING : (TAB_MENU_HEIGHT + insets.bottom + FAB_SPACING);
  var balanceColor = state.remaining >= 0 ? primaryColor : dangerColor;
  var curMonthLabel = (function() {
    var d = new Date();
    var months = ['January','February','March','April','May','June','July','August','September','October','November','December'];
    return months[d.getMonth()] + ' ' + d.getFullYear();
  })();
  return React.createElement(View, { testID: 'View-20', style: { flex: 1, backgroundColor: theme.colors.background }, componentId: 'dashboard-screen' },
    React.createElement(View, { testID: 'View-21', style: { backgroundColor: primaryColor, paddingTop: insets.top + 16, paddingBottom: 24, paddingHorizontal: 20 }, componentId: 'dashboard-header' },
      React.createElement(Text, { testID: 'Text-35', style: { color: 'rgba(255,255,255,0.8)', fontSize: 14 } }, 'Welcome back'),
      React.createElement(Text, { testID: 'Text-36', style: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold', marginBottom: 20 } }, userName),
      React.createElement(View, { testID: 'View-22', style: { backgroundColor: 'rgba(255,255,255,0.15)', borderRadius: 16, padding: 20 }, componentId: 'balance-card' },
        React.createElement(Text, { testID: 'Text-37', style: { color: 'rgba(255,255,255,0.8)', fontSize: 13, marginBottom: 4 } }, 'Remaining Balance'),
        React.createElement(Text, { testID: 'Text-38', style: { color: '#FFFFFF', fontSize: 36, fontWeight: 'bold' } }, formatCurrency(state.remaining)),
        React.createElement(Text, { testID: 'Text-39', style: { color: 'rgba(255,255,255,0.7)', fontSize: 12, marginTop: 4 } }, curMonthLabel)
      )
    ),
    React.createElement(ScrollView, { testID: 'ScrollView-7', style: { flex: 1 },
      contentContainerStyle: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: scrollBottomPadding }
    },
      React.createElement(View, { testID: 'View-23', style: { flexDirection: 'row', gap: 12, marginBottom: 20 }, componentId: 'stats-row' },
        React.createElement(View, { testID: 'View-24', style: { flex: 1, backgroundColor: cardColor, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }, componentId: 'salary-card' },
          React.createElement(View, { testID: 'View-25', style: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', marginBottom: 8 } },
            React.createElement(MaterialIcons, { testID: 'MaterialIcons-5', name: 'attach-money', size: 20, color: primaryColor })
          ),
          React.createElement(Text, { testID: 'Text-40', style: { fontSize: 12, color: textSecondary, marginBottom: 4 } }, 'Monthly Salary'),
          React.createElement(Text, { testID: 'Text-41', style: { fontSize: 18, fontWeight: 'bold', color: textPrimary } }, formatCurrency(state.salary))
        ),
        React.createElement(View, { testID: 'View-26', style: { flex: 1, backgroundColor: cardColor, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }, componentId: 'expenses-card' },
          React.createElement(View, { testID: 'View-27', style: { width: 36, height: 36, borderRadius: 10, backgroundColor: '#FEE2E2', alignItems: 'center', justifyContent: 'center', marginBottom: 8 } },
            React.createElement(MaterialIcons, { testID: 'MaterialIcons-6', name: 'trending-down', size: 20, color: dangerColor })
          ),
          React.createElement(Text, { testID: 'Text-42', style: { fontSize: 12, color: textSecondary, marginBottom: 4 } }, 'Total Expenses'),
          React.createElement(Text, { testID: 'Text-43', style: { fontSize: 18, fontWeight: 'bold', color: dangerColor } }, formatCurrency(state.totalExpenses))
        )
      ),
      state.upcomingBills.length > 0 ? React.createElement(View, { testID: 'View-28', style: { marginBottom: 20 }, componentId: 'upcoming-section' },
        React.createElement(Text, { testID: 'Text-44', style: { fontSize: 16, fontWeight: 'bold', color: textPrimary, marginBottom: 12 } }, '⚠️ Attention Required'),
        state.upcomingBills.map(function(bill, idx) {
          var overdue = isOverdue(bill.due_date);
          return React.createElement(View, { testID: 'View-29', key: bill.id,
            style: { backgroundColor: overdue ? '#FEF2F2' : '#FFFBEB', borderRadius: 12, padding: 14, marginBottom: 8, borderLeftWidth: 4, borderLeftColor: overdue ? dangerColor : warningColor },
            componentId: 'upcoming-bill-' + idx
          },
            React.createElement(View, { testID: 'View-30', style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } },
              React.createElement(View, { testID: 'View-31' },
                React.createElement(Text, { testID: 'Text-45', style: { fontSize: 15, fontWeight: '600', color: textPrimary } }, bill.name),
                React.createElement(Text, { testID: 'Text-46', style: { fontSize: 12, color: overdue ? dangerColor : warningColor, marginTop: 2 } },
                  overdue ? '⚠ Overdue: ' + formatDate(bill.due_date) : '⏰ Due: ' + formatDate(bill.due_date)
                )
              ),
              React.createElement(Text, { testID: 'Text-47', style: { fontSize: 16, fontWeight: 'bold', color: overdue ? dangerColor : warningColor } }, formatCurrency(bill.amount))
            )
          );
        })
      ) : null,
      React.createElement(View, { testID: 'View-32', style: { backgroundColor: cardColor, borderRadius: 14, padding: 16, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }, componentId: 'budget-breakdown' },
        React.createElement(Text, { testID: 'Text-48', style: { fontSize: 16, fontWeight: 'bold', color: textPrimary, marginBottom: 16 } }, 'Budget Breakdown'),
        React.createElement(View, { testID: 'View-33', style: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 } },
          React.createElement(Text, { testID: 'Text-49', style: { color: textSecondary, fontSize: 14 } }, 'Monthly Salary'),
          React.createElement(Text, { testID: 'Text-50', style: { color: textPrimary, fontSize: 14, fontWeight: '600' } }, formatCurrency(state.salary))
        ),
        React.createElement(View, { testID: 'View-34', style: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 12 } },
          React.createElement(Text, { testID: 'Text-51', style: { color: textSecondary, fontSize: 14 } }, 'Paid Recurring'),
          React.createElement(Text, { testID: 'Text-52', style: { color: dangerColor, fontSize: 14, fontWeight: '600' } }, '- ' + formatCurrency(state.totalExpenses - state.oneTimeExpenses.reduce(function(s, o) { return s + (parseFloat(o.amount) || 0); }, 0)))
        ),
        React.createElement(View, { testID: 'View-35', style: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 16 } },
          React.createElement(Text, { testID: 'Text-53', style: { color: textSecondary, fontSize: 14 } }, 'One-Time (this month)'),
          React.createElement(Text, { testID: 'Text-54', style: { color: dangerColor, fontSize: 14, fontWeight: '600' } }, '- ' + formatCurrency(state.oneTimeExpenses.reduce(function(s, o) { return s + (parseFloat(o.amount) || 0); }, 0)))
        ),
        React.createElement(View, { testID: 'View-36', style: { height: 1, backgroundColor: '#D1FAE5', marginBottom: 16 } }),
        React.createElement(View, { testID: 'View-37', style: { flexDirection: 'row', justifyContent: 'space-between' } },
          React.createElement(Text, { testID: 'Text-55', style: { fontSize: 15, fontWeight: 'bold', color: textPrimary } }, 'Remaining Balance'),
          React.createElement(Text, { testID: 'Text-56', style: { fontSize: 15, fontWeight: 'bold', color: balanceColor } }, formatCurrency(state.remaining))
        )
      )
    ),
    React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-15', onPress: function() { state.setShowAddModal(true); },
      style: { position: 'absolute', right: 20, bottom: fabBottom, width: 56, height: 56, borderRadius: 28, backgroundColor: primaryColor, alignItems: 'center', justifyContent: 'center', shadowColor: primaryColor, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
      componentId: 'dashboard-fab'
    },
      React.createElement(MaterialIcons, { testID: 'MaterialIcons-7', name: 'add', size: 28, color: '#FFFFFF' })
    ),
    React.createElement(AddExpenseModal, { testID: 'AddExpenseModal-1', visible: state.showAddModal,
      onClose: function() { state.setShowAddModal(false); },
      onSaved: state.refetchAll,
      userId: userId,
      theme: theme,
      insetsTop: insets.top,
      insetsBottom: insets.bottom
    })
  );
};
// @end:DashboardScreen

// @section:PayModal @depends:[ThemeContext,styles]
const PayModal = function(props) {
  var visible = props.visible;
  var expense = props.expense;
  var onClose = props.onClose;
  var onPaid = props.onPaid;
  var userId = props.userId;
  var insetsTop = props.insetsTop;
  var insetsBottom = props.insetsBottom;
  var updateRecurring = useMutation('recurring_expenses', 'update');
  var mutateUpdate = updateRecurring.mutate;
  var insertHistory = useMutation('expense_history', 'insert');
  var mutateHistory = insertHistory.mutate;
  var loadingState = useState(false);
  var isLoading = loadingState[0]; var setIsLoading = loadingState[1];
  var handlePay = function() {
    if (!expense) return;
    setIsLoading(true);
    var isPaidInAdvance = isWithin5Days(expense.due_date) && !isOverdue(expense.due_date);
    var newStatus = isPaidInAdvance ? 'Paid in Advance' : 'Paid';
    mutateUpdate({ id: expense.id, data: { status: newStatus } }).then(function() {
      return mutateHistory({ id: generateId(), user_id: userId, expense_name: expense.name, amount: parseFloat(expense.amount) || 0, expense_type: 'Recurring', date: getTodayStr(), status: newStatus, notes: '' });
    }).then(function() {
      setIsLoading(false);
      onPaid();
      onClose();
    }).catch(function() { setIsLoading(false); });
  };
  if (!expense) return null;
  var isPaidInAdvance = isWithin5Days(expense.due_date) && !isOverdue(expense.due_date);
  return React.createElement(Modal, { testID: 'Modal-3', visible: visible, animationType: 'fade', transparent: true, onRequestClose: onClose },
    React.createElement(View, { testID: 'View-38', style: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.5)', marginTop: insetsTop, paddingHorizontal: 20 }, componentId: 'pay-modal-overlay' },
      React.createElement(View, { testID: 'View-39', style: { backgroundColor: cardColor, borderRadius: 20, padding: 24, paddingBottom: insetsBottom + 24 }, componentId: 'pay-modal-content' },
        React.createElement(View, { testID: 'View-40', style: { alignItems: 'center', marginBottom: 20 } },
          React.createElement(View, { testID: 'View-41', style: { width: 60, height: 60, borderRadius: 30, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', marginBottom: 12 } },
            React.createElement(MaterialIcons, { testID: 'MaterialIcons-8', name: 'payment', size: 30, color: primaryColor })
          ),
          React.createElement(Text, { testID: 'Text-57', style: { fontSize: 20, fontWeight: 'bold', color: textPrimary } }, 'Confirm Payment')
        ),
        React.createElement(View, { testID: 'View-42', style: { backgroundColor: backgroundColor, borderRadius: 12, padding: 16, marginBottom: 16 } },
          React.createElement(View, { testID: 'View-43', style: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 } },
            React.createElement(Text, { testID: 'Text-58', style: { color: textSecondary, fontSize: 14 } }, 'Expense'),
            React.createElement(Text, { testID: 'Text-59', style: { color: textPrimary, fontSize: 14, fontWeight: '600' } }, expense.name)
          ),
          React.createElement(View, { testID: 'View-44', style: { flexDirection: 'row', justifyContent: 'space-between', marginBottom: 8 } },
            React.createElement(Text, { testID: 'Text-60', style: { color: textSecondary, fontSize: 14 } }, 'Amount'),
            React.createElement(Text, { testID: 'Text-61', style: { color: dangerColor, fontSize: 14, fontWeight: '600' } }, formatCurrency(expense.amount))
          ),
          React.createElement(View, { testID: 'View-45', style: { flexDirection: 'row', justifyContent: 'space-between' } },
            React.createElement(Text, { testID: 'Text-62', style: { color: textSecondary, fontSize: 14 } }, 'Status'),
            React.createElement(Text, { testID: 'Text-63', style: { color: isPaidInAdvance ? infoColor : primaryColor, fontSize: 14, fontWeight: '600' } }, isPaidInAdvance ? 'Paid in Advance' : 'Paid')
          )
        ),
        isPaidInAdvance ? React.createElement(View, { testID: 'View-46', style: { backgroundColor: '#EFF6FF', borderRadius: 10, padding: 12, marginBottom: 16 } },
          React.createElement(Text, { testID: 'Text-64', style: { color: infoColor, fontSize: 13, textAlign: 'center' } }, '🎉 This bill is due within 5 days — marking as Paid in Advance!')
        ) : null,
        React.createElement(View, { testID: 'View-47', style: { flexDirection: 'row', gap: 12 } },
          React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-16', onPress: onClose,
            style: { flex: 1, backgroundColor: backgroundColor, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1, borderColor: '#D1FAE5' },
            componentId: 'pay-cancel-btn'
          },
            React.createElement(Text, { testID: 'Text-65', style: { color: textSecondary, fontSize: 15, fontWeight: '600' } }, 'Cancel')
          ),
          React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-17', onPress: handlePay, disabled: isLoading,
            style: { flex: 1, backgroundColor: primaryColor, borderRadius: 12, padding: 14, alignItems: 'center' },
            componentId: 'pay-confirm-btn'
          },
            isLoading ? React.createElement(ActivityIndicator, { testID: 'ActivityIndicator-3', color: '#FFFFFF', size: 'small' }) :
            React.createElement(Text, { testID: 'Text-66', style: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' } }, 'Confirm Pay')
          )
        )
      )
    )
  );
};
// @end:PayModal

// @section:RecurringScreen @depends:[PayModal,AddExpenseModal,ThemeContext,styles]
const RecurringScreen = function(props) {
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var userCtx = useUser();
  var userId = userCtx.currentUser ? userCtx.currentUser.id : '';
  var insets = useSafeAreaInsets();
  var scrollBottomPadding = Platform.OS === 'web' ? WEB_TAB_MENU_PADDING : (TAB_MENU_HEIGHT + insets.bottom + SCROLL_EXTRA_PADDING);
  var fabBottom = Platform.OS === 'web' ? WEB_TAB_MENU_PADDING : (TAB_MENU_HEIGHT + insets.bottom + FAB_SPACING);
  var recurringQuery = useQuery('recurring_expenses');
  var allRecurring = recurringQuery.data || [];
  var recurringExpenses = allRecurring.filter(function(r) { return r.user_id === userId; });
  var refetch = recurringQuery.refetch;
  var loading = recurringQuery.loading;
  var deleteRecurring = useMutation('recurring_expenses', 'delete');
  var mutateDelete = deleteRecurring.mutate;
  var updateRecurring = useMutation('recurring_expenses', 'update');
  var mutateUpdate = updateRecurring.mutate;
  var payModalState = useState(false);
  var showPayModal = payModalState[0]; var setShowPayModal = payModalState[1];
  var selectedExpenseState = useState(null);
  var selectedExpense = selectedExpenseState[0]; var setSelectedExpense = selectedExpenseState[1];
  var showAddState = useState(false);
  var showAdd = showAddState[0]; var setShowAdd = showAddState[1];
  var filterState = useState('All');
  var filter = filterState[0]; var setFilter = filterState[1];
  var filters = ['All', 'Pending', 'Paid', 'Paid in Advance'];
  var filtered = useMemo(function() {
    if (filter === 'All') return recurringExpenses;
    return recurringExpenses.filter(function(r) { return r.status === filter; });
  }, [recurringExpenses, filter]);
  var handlePayPress = function(expense) {
    setSelectedExpense(expense);
    setShowPayModal(true);
  };
  var handleResetStatus = function(expense) {
    var msg = 'Reset "' + expense.name + '" status back to Pending?';
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) {
        mutateUpdate({ id: expense.id, data: { status: 'Pending' } }).then(function() { refetch(); });
      }
    } else {
      Alert.alert('Reset Status', msg, [
        { text: 'Cancel' },
        { text: 'Reset', onPress: function() { mutateUpdate({ id: expense.id, data: { status: 'Pending' } }).then(function() { refetch(); }); } }
      ]);
    }
  };
  var handleDelete = function(expense) {
    var msg = 'Delete "' + expense.name + '"?';
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) { mutateDelete({ id: expense.id }).then(function() { refetch(); }); }
    } else {
      Alert.alert('Delete Expense', msg, [
        { text: 'Cancel' },
        { text: 'Delete', style: 'destructive', onPress: function() { mutateDelete({ id: expense.id }).then(function() { refetch(); }); } }
      ]);
    }
  };
  var getStatusColor = function(status) {
    if (status === 'Paid') return primaryColor;
    if (status === 'Paid in Advance') return infoColor;
    return warningColor;
  };
  var getStatusBg = function(status) {
    if (status === 'Paid') return '#D1FAE5';
    if (status === 'Paid in Advance') return '#EFF6FF';
    return '#FFFBEB';
  };
  return React.createElement(View, { testID: 'View-48', style: { flex: 1, backgroundColor: theme.colors.background }, componentId: 'recurring-screen' },
    React.createElement(View, { testID: 'View-49', style: { backgroundColor: primaryColor, paddingTop: insets.top + 16, paddingBottom: 20, paddingHorizontal: 20 }, componentId: 'recurring-header' },
      React.createElement(Text, { testID: 'Text-67', style: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold' } }, 'Recurring Expenses'),
      React.createElement(Text, { testID: 'Text-68', style: { color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 2 } }, String(recurringExpenses.length) + ' total bills')
    ),
    React.createElement(ScrollView, { testID: 'ScrollView-8', horizontal: true, style: { flexGrow: 'initial', backgroundColor: cardColor, borderBottomWidth: 1, borderBottomColor: '#D1FAE5' }, showsHorizontalScrollIndicator: false, contentContainerStyle: { paddingHorizontal: 16, paddingVertical: 12 } },
      filters.map(function(f) {
        return React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-18', key: f, onPress: function() { setFilter(f); },
          style: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, marginRight: 8, backgroundColor: filter === f ? primaryColor : backgroundColor, borderWidth: 1, borderColor: filter === f ? primaryColor : '#D1FAE5' },
          componentId: 'filter-' + f
        },
          React.createElement(Text, { testID: 'Text-69', style: { color: filter === f ? '#FFFFFF' : textSecondary, fontSize: 13, fontWeight: '600' } }, f)
        );
      })
    ),
    loading ? React.createElement(View, { testID: 'View-50', style: { flex: 1, alignItems: 'center', justifyContent: 'center' }, componentId: 'recurring-loading' },
      React.createElement(ActivityIndicator, { testID: 'ActivityIndicator-4', size: 'large', color: primaryColor })
    ) :
    React.createElement(ScrollView, { testID: 'ScrollView-9', style: { flex: 1 },
      contentContainerStyle: { paddingTop: 16, paddingHorizontal: 16, paddingBottom: scrollBottomPadding }
    },
      filtered.length === 0 ? React.createElement(View, { testID: 'View-51', style: { alignItems: 'center', paddingTop: 60 }, componentId: 'recurring-empty' },
        React.createElement(MaterialIcons, { testID: 'MaterialIcons-9', name: 'receipt-long', size: 64, color: '#D1FAE5' }),
        React.createElement(Text, { testID: 'Text-70', style: { fontSize: 16, color: textSecondary, marginTop: 12 } }, 'No recurring expenses found'),
        React.createElement(Text, { testID: 'Text-71', style: { fontSize: 14, color: textSecondary, marginTop: 4 } }, 'Tap + to add recurring bills')
      ) :
      filtered.map(function(expense, idx) {
        var overdue = isOverdue(expense.due_date) && expense.status === 'Pending';
        var upcoming = isWithin5Days(expense.due_date) && !overdue && expense.status === 'Pending';
        return React.createElement(View, { testID: 'View-52', key: expense.id,
          style: { backgroundColor: cardColor, borderRadius: 14, padding: 16, marginBottom: 12, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, borderLeftWidth: overdue ? 4 : (upcoming ? 4 : 0), borderLeftColor: overdue ? dangerColor : warningColor },
          componentId: 'recurring-item-' + idx
        },
          React.createElement(View, { testID: 'View-53', style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' } },
            React.createElement(View, { testID: 'View-54', style: { flex: 1, marginRight: 12 } },
              React.createElement(Text, { testID: 'Text-72', style: { fontSize: 16, fontWeight: 'bold', color: textPrimary } }, expense.name),
              React.createElement(Text, { testID: 'Text-73', style: { fontSize: 13, color: textSecondary, marginTop: 3 } }, 'Due: ' + formatDate(expense.due_date)),
              overdue ? React.createElement(Text, { testID: 'Text-74', style: { fontSize: 12, color: dangerColor, marginTop: 2 } }, '⚠ OVERDUE') : null,
              upcoming ? React.createElement(Text, { testID: 'Text-75', style: { fontSize: 12, color: warningColor, marginTop: 2 } }, '⏰ Due soon') : null
            ),
            React.createElement(View, { testID: 'View-55', style: { alignItems: 'flex-end' } },
              React.createElement(Text, { testID: 'Text-76', style: { fontSize: 18, fontWeight: 'bold', color: textPrimary } }, formatCurrency(expense.amount)),
              React.createElement(View, { testID: 'View-56', style: { backgroundColor: getStatusBg(expense.status), borderRadius: 20, paddingHorizontal: 10, paddingVertical: 4, marginTop: 6 } },
                React.createElement(Text, { testID: 'Text-77', style: { fontSize: 11, color: getStatusColor(expense.status), fontWeight: '600' } }, expense.status)
              )
            )
          ),
          React.createElement(View, { testID: 'View-57', style: { flexDirection: 'row', marginTop: 14, gap: 8 } },
            expense.status === 'Pending' ? React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-19', onPress: function() { handlePayPress(expense); },
              style: { flex: 1, backgroundColor: primaryColor, borderRadius: 10, paddingVertical: 10, alignItems: 'center' },
              componentId: 'pay-btn-' + idx
            },
              React.createElement(Text, { testID: 'Text-78', style: { color: '#FFFFFF', fontSize: 14, fontWeight: '600' } }, '💰 Pay Now')
            ) : React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-20', onPress: function() { handleResetStatus(expense); },
              style: { flex: 1, backgroundColor: backgroundColor, borderRadius: 10, paddingVertical: 10, alignItems: 'center', borderWidth: 1, borderColor: '#D1FAE5' },
              componentId: 'reset-btn-' + idx
            },
              React.createElement(Text, { testID: 'Text-79', style: { color: textSecondary, fontSize: 14, fontWeight: '600' } }, '↩ Reset')
            ),
            React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-21', onPress: function() { handleDelete(expense); },
              style: { width: 42, height: 42, borderRadius: 10, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center' },
              componentId: 'delete-recurring-' + idx
            },
              React.createElement(MaterialIcons, { testID: 'MaterialIcons-10', name: 'delete-outline', size: 20, color: dangerColor })
            )
          )
        );
      })
    ),
    React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-22', onPress: function() { setShowAdd(true); },
      style: { position: 'absolute', right: 20, bottom: fabBottom, width: 56, height: 56, borderRadius: 28, backgroundColor: primaryColor, alignItems: 'center', justifyContent: 'center', shadowColor: primaryColor, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.4, shadowRadius: 8, elevation: 6 },
      componentId: 'recurring-fab'
    },
      React.createElement(MaterialIcons, { testID: 'MaterialIcons-11', name: 'add', size: 28, color: '#FFFFFF' })
    ),
    React.createElement(PayModal, { testID: 'PayModal-1', visible: showPayModal,
      expense: selectedExpense,
      onClose: function() { setShowPayModal(false); },
      onPaid: refetch,
      userId: userId,
      insetsTop: insets.top,
      insetsBottom: insets.bottom,
      theme: theme
    }),
    React.createElement(AddExpenseModal, { testID: 'AddExpenseModal-2', visible: showAdd,
      onClose: function() { setShowAdd(false); },
      onSaved: refetch,
      userId: userId,
      theme: theme,
      insetsTop: insets.top,
      insetsBottom: insets.bottom
    })
  );
};
// @end:RecurringScreen

// @section:HistoryScreen @depends:[ThemeContext,styles]
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
  var searchState = useState('');
  var search = searchState[0]; var setSearch = searchState[1];
  var oneTimeQuery = useQuery('one_time_expenses');
  var allOneTime = oneTimeQuery.data || [];
  var userOneTime = allOneTime.filter(function(o) { return o.user_id === userId; });
  var combinedHistory = useMemo(function() {
    var histItems = userHistory.map(function(h) {
      return { id: h.id, name: h.expense_name, amount: parseFloat(h.amount) || 0, type: h.expense_type, date: h.date, status: h.status };
    });
    var oneTimeItems = userOneTime.map(function(o) {
      return { id: o.id, name: o.name, amount: parseFloat(o.amount) || 0, type: 'One-Time', date: o.date, status: 'Spent' };
    });
    var allItems = histItems.concat(oneTimeItems);
    var seen = {};
    var unique = allItems.filter(function(item) {
      if (seen[item.id]) return false;
      seen[item.id] = true;
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
    return filteredHistory.reduce(function(s, i) { return s + i.amount; }, 0);
  }, [filteredHistory]);
  var getStatusColor = function(status) {
    if (status === 'Paid') return primaryColor;
    if (status === 'Paid in Advance') return infoColor;
    if (status === 'Spent') return dangerColor;
    return warningColor;
  };
  var getTypeIcon = function(type) {
    return type === 'Recurring' ? 'repeat' : 'shopping-bag';
  };
  return React.createElement(View, { testID: 'View-58', style: { flex: 1, backgroundColor: theme.colors.background }, componentId: 'history-screen' },
    React.createElement(View, { testID: 'View-59', style: { backgroundColor: primaryColor, paddingTop: insets.top + 16, paddingBottom: 20, paddingHorizontal: 20 }, componentId: 'history-header' },
      React.createElement(Text, { testID: 'Text-80', style: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold' } }, 'Expense History'),
      React.createElement(Text, { testID: 'Text-81', style: { color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 2 } }, String(filteredHistory.length) + ' records')
    ),
    React.createElement(View, { testID: 'View-60', style: { backgroundColor: cardColor, paddingHorizontal: 16, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: '#D1FAE5' }, componentId: 'history-filters' },
      React.createElement(View, { testID: 'View-61', style: { backgroundColor: backgroundColor, borderRadius: 10, paddingHorizontal: 12, paddingVertical: 2, flexDirection: 'row', alignItems: 'center', marginBottom: 10 } },
        React.createElement(MaterialIcons, { testID: 'MaterialIcons-12', name: 'search', size: 20, color: textSecondary }),
        React.createElement(TextInput, { testID: 'TextInput-9', value: search, onChangeText: setSearch, placeholder: 'Search expenses...',
          style: { flex: 1, paddingVertical: 8, paddingLeft: 8, fontSize: 14, color: textPrimary },
          componentId: 'history-search-input'
        })
      ),
      React.createElement(View, { testID: 'View-62', style: { flexDirection: 'row', gap: 8 } },
        React.createElement(ScrollView, { testID: 'ScrollView-10', horizontal: true, showsHorizontalScrollIndicator: false, style: { flexGrow: 'initial' } },
          ['All','Recurring','One-Time'].map(function(t) {
            return React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-23', key: t, onPress: function() { setTypeFilter(t); },
              style: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 6, backgroundColor: typeFilter === t ? primaryColor : backgroundColor, borderWidth: 1, borderColor: typeFilter === t ? primaryColor : '#D1FAE5' },
              componentId: 'type-filter-' + t
            },
              React.createElement(Text, { testID: 'Text-82', style: { color: typeFilter === t ? '#FFFFFF' : textSecondary, fontSize: 12, fontWeight: '600' } }, t)
            );
          }),
          ['All','Pending','Paid','Paid in Advance','Spent'].map(function(s) {
            return React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-24', key: s, onPress: function() { setStatusFilter(s); },
              style: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: 16, marginRight: 6, backgroundColor: statusFilter === s ? infoColor : backgroundColor, borderWidth: 1, borderColor: statusFilter === s ? infoColor : '#D1FAE5' },
              componentId: 'status-filter-' + s
            },
              React.createElement(Text, { testID: 'Text-83', style: { color: statusFilter === s ? '#FFFFFF' : textSecondary, fontSize: 12, fontWeight: '600' } }, s)
            );
          })
        )
      )
    ),
    React.createElement(View, { testID: 'View-63', style: { backgroundColor: '#F0FDF4', paddingHorizontal: 20, paddingVertical: 10, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }, componentId: 'history-summary' },
      React.createElement(Text, { testID: 'Text-84', style: { color: textSecondary, fontSize: 13 } }, 'Total shown:'),
      React.createElement(Text, { testID: 'Text-85', style: { color: dangerColor, fontSize: 15, fontWeight: 'bold' } }, formatCurrency(totalShown))
    ),
    loading ? React.createElement(View, { testID: 'View-64', style: { flex: 1, alignItems: 'center', justifyContent: 'center' }, componentId: 'history-loading' },
      React.createElement(ActivityIndicator, { testID: 'ActivityIndicator-5', size: 'large', color: primaryColor })
    ) :
    React.createElement(FlatList, { testID: 'FlatList-1', data: filteredHistory,
      keyExtractor: function(item) { return item.id; },
      contentContainerStyle: { paddingHorizontal: 16, paddingTop: 12, paddingBottom: scrollBottomPadding },
      ListEmptyComponent: React.createElement(View, { testID: 'View-65', style: { alignItems: 'center', paddingTop: 60 }, componentId: 'history-empty' },
        React.createElement(MaterialIcons, { testID: 'MaterialIcons-13', name: 'history', size: 64, color: '#D1FAE5' }),
        React.createElement(Text, { testID: 'Text-86', style: { fontSize: 16, color: textSecondary, marginTop: 12 } }, 'No history found')
      ),
      renderItem: function(itemData) {
        var item = itemData.item;
        var idx = itemData.index;
        return React.createElement(View, { testID: 'View-66', style: { backgroundColor: cardColor, borderRadius: 12, padding: 14, marginBottom: 10, flexDirection: 'row', alignItems: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 },
          componentId: 'history-item-' + idx
        },
          React.createElement(View, { testID: 'View-67', style: { width: 40, height: 40, borderRadius: 12, backgroundColor: item.type === 'Recurring' ? '#D1FAE5' : '#EDE9FE', alignItems: 'center', justifyContent: 'center', marginRight: 12 } },
            React.createElement(MaterialIcons, { testID: 'MaterialIcons-14', name: getTypeIcon(item.type), size: 20, color: item.type === 'Recurring' ? primaryColor : '#7C3AED' })
          ),
          React.createElement(View, { testID: 'View-68', style: { flex: 1 } },
            React.createElement(Text, { testID: 'Text-87', style: { fontSize: 15, fontWeight: '600', color: textPrimary } }, item.name),
            React.createElement(Text, { testID: 'Text-88', style: { fontSize: 12, color: textSecondary, marginTop: 2 } }, formatDate(item.date) + ' • ' + item.type)
          ),
          React.createElement(View, { testID: 'View-69', style: { alignItems: 'flex-end' } },
            React.createElement(Text, { testID: 'Text-89', style: { fontSize: 15, fontWeight: 'bold', color: dangerColor } }, '-' + formatCurrency(item.amount)),
            React.createElement(View, { testID: 'View-70', style: { backgroundColor: item.status === 'Spent' ? '#FEE2E2' : (item.status === 'Paid' ? '#D1FAE5' : (item.status === 'Paid in Advance' ? '#EFF6FF' : '#FFFBEB')), borderRadius: 12, paddingHorizontal: 8, paddingVertical: 3, marginTop: 4 } },
              React.createElement(Text, { testID: 'Text-90', style: { fontSize: 11, color: getStatusColor(item.status), fontWeight: '600' } }, item.status)
            )
          )
        );
      }
    })
  );
};
// @end:HistoryScreen

// @section:SettingsScreen @depends:[ThemeContext,UserContext,styles]
const SettingsScreen = function(props) {
  var navigation = props.navigation;
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var userCtx = useUser();
  var currentUser = userCtx.currentUser;
  var userId = currentUser ? currentUser.id : '';
  var insets = useSafeAreaInsets();
  var scrollBottomPadding = Platform.OS === 'web' ? WEB_TAB_MENU_PADDING : (TAB_MENU_HEIGHT + insets.bottom + SCROLL_EXTRA_PADDING);
  var settingsQuery = useQuery('user_settings');
  var allSettings = settingsQuery.data || [];
  var userSettings = allSettings.find(function(s) { return s.user_id === userId; });
  var refetch = settingsQuery.refetch;
  var salaryState = useState('');
  var salaryInput = salaryState[0]; var setSalaryInput = salaryState[1];
  var savedState = useState(false);
  var showSaved = savedState[0]; var setShowSaved = savedState[1];
  useEffect(function() {
    if (userSettings && userSettings.monthly_salary) {
      setSalaryInput(String(userSettings.monthly_salary));
    }
  }, [userSettings]);
  var updateSettings = useMutation('user_settings', 'update');
  var mutateUpdate = updateSettings.mutate;
  var insertSettings = useMutation('user_settings', 'insert');
  var mutateInsert = insertSettings.mutate;
  var handleSaveSalary = function() {
    var amt = parseFloat(salaryInput);
    if (isNaN(amt) || amt < 0) {
      Platform.OS === 'web' ? window.alert('Please enter a valid salary amount.') : Alert.alert('Invalid Amount', 'Please enter a valid salary amount.');
      return;
    }
    if (userSettings) {
      mutateUpdate({ id: userSettings.id, data: { monthly_salary: amt } }).then(function() {
        refetch(); setShowSaved(true);
        setTimeout(function() { setShowSaved(false); }, 2000);
      });
    } else {
      mutateInsert({ id: generateId(), user_id: userId, monthly_salary: amt }).then(function() {
        refetch(); setShowSaved(true);
        setTimeout(function() { setShowSaved(false); }, 2000);
      });
    }
  };
  var handleLogout = function() {
    var msg = 'Are you sure you want to sign out?';
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) { userCtx.setCurrentUser(null); navigation.replace('Login'); }
    } else {
      Alert.alert('Sign Out', msg, [
        { text: 'Cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: function() { userCtx.setCurrentUser(null); navigation.replace('Login'); } }
      ]);
    }
  };
  return React.createElement(View, { testID: 'View-71', style: { flex: 1, backgroundColor: theme.colors.background }, componentId: 'settings-screen' },
    React.createElement(View, { testID: 'View-72', style: { backgroundColor: primaryColor, paddingTop: insets.top + 16, paddingBottom: 24, paddingHorizontal: 20 }, componentId: 'settings-header' },
      React.createElement(Text, { testID: 'Text-91', style: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold' } }, 'Settings'),
      React.createElement(Text, { testID: 'Text-92', style: { color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 2 } }, currentUser ? currentUser.email : '')
    ),
    React.createElement(ScrollView, { testID: 'ScrollView-11', style: { flex: 1 },
      contentContainerStyle: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: scrollBottomPadding }
    },
      currentUser ? React.createElement(View, { testID: 'View-73', style: { backgroundColor: cardColor, borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }, componentId: 'profile-card' },
        React.createElement(View, { testID: 'View-74', style: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 } },
          React.createElement(View, { testID: 'View-75', style: { width: 52, height: 52, borderRadius: 26, backgroundColor: primaryColor, alignItems: 'center', justifyContent: 'center', marginRight: 14 } },
            React.createElement(Text, { testID: 'Text-93', style: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold' } }, currentUser.name ? currentUser.name[0].toUpperCase() : 'U')
          ),
          React.createElement(View, { testID: 'View-76' },
            React.createElement(Text, { testID: 'Text-94', style: { fontSize: 17, fontWeight: 'bold', color: textPrimary } }, currentUser.name),
            React.createElement(Text, { testID: 'Text-95', style: { fontSize: 13, color: textSecondary, marginTop: 2 } }, currentUser.email)
          )
        )
      ) : null,
      React.createElement(View, { testID: 'View-77', style: { backgroundColor: cardColor, borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }, componentId: 'salary-settings-card' },
        React.createElement(View, { testID: 'View-78', style: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 } },
          React.createElement(View, { testID: 'View-79', style: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#D1FAE5', alignItems: 'center', justifyContent: 'center', marginRight: 12 } },
            React.createElement(MaterialIcons, { testID: 'MaterialIcons-15', name: 'attach-money', size: 22, color: primaryColor })
          ),
          React.createElement(Text, { testID: 'Text-96', style: { fontSize: 17, fontWeight: 'bold', color: textPrimary } }, 'Monthly Salary')
        ),
        React.createElement(Text, { testID: 'Text-97', style: { fontSize: 13, color: textSecondary, marginBottom: 8 } }, 'Set your monthly income to track your budget accurately'),
        React.createElement(View, { testID: 'View-80', style: { flexDirection: 'row', alignItems: 'center', gap: 12 } },
          React.createElement(View, { testID: 'View-81', style: { flex: 1, flexDirection: 'row', alignItems: 'center', backgroundColor: backgroundColor, borderWidth: 1, borderColor: '#D1FAE5', borderRadius: 10, paddingHorizontal: 14 } },
            React.createElement(Text, { testID: 'Text-98', style: { fontSize: 18, color: primaryColor, fontWeight: 'bold', marginRight: 4 } }, '₱'),
            React.createElement(TextInput, { testID: 'TextInput-10', value: salaryInput,
              onChangeText: function(text) {
                var s = text.replace(/[^0-9.]/g, '');
                var parts = s.split('.');
                if (parts.length > 2) { s = parts[0] + '.' + parts.slice(1).join(''); }
                setSalaryInput(s);
              },
              placeholder: '0.00', keyboardType: 'decimal-pad',
              style: { flex: 1, paddingVertical: 14, fontSize: 16, color: textPrimary },
              componentId: 'salary-input'
            })
          ),
          React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-25', onPress: handleSaveSalary,
            style: { backgroundColor: primaryColor, borderRadius: 10, paddingHorizontal: 20, paddingVertical: 14 },
            componentId: 'save-salary-btn'
          },
            React.createElement(Text, { testID: 'Text-99', style: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 15 } }, 'Save')
          )
        ),
        showSaved ? React.createElement(View, { testID: 'View-82', style: { backgroundColor: '#D1FAE5', borderRadius: 8, padding: 10, marginTop: 12, flexDirection: 'row', alignItems: 'center' } },
          React.createElement(MaterialIcons, { testID: 'MaterialIcons-16', name: 'check-circle', size: 18, color: primaryColor }),
          React.createElement(Text, { testID: 'Text-100', style: { color: primaryColor, fontSize: 13, marginLeft: 8, fontWeight: '600' } }, 'Salary updated successfully!')
        ) : null
      ),
      React.createElement(View, { testID: 'View-83', style: { backgroundColor: cardColor, borderRadius: 16, overflow: 'hidden', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }, componentId: 'app-info-card' },
        React.createElement(View, { testID: 'View-84', style: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#D1FAE5' } },
          React.createElement(Text, { testID: 'Text-101', style: { fontSize: 13, fontWeight: '700', color: textSecondary, letterSpacing: 0.5 } }, 'APP INFO')
        ),
        React.createElement(View, { testID: 'View-85', style: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#D1FAE5' } },
          React.createElement(Text, { testID: 'Text-102', style: { color: textPrimary, fontSize: 15 } }, 'App Name'),
          React.createElement(Text, { testID: 'Text-103', style: { color: textSecondary, fontSize: 15 } }, 'Personal Budget Tracker')
        ),
        React.createElement(View, { testID: 'View-86', style: { padding: 16, flexDirection: 'row', justifyContent: 'space-between' } },
          React.createElement(Text, { testID: 'Text-104', style: { color: textPrimary, fontSize: 15 } }, 'Version'),
          React.createElement(Text, { testID: 'Text-105', style: { color: textSecondary, fontSize: 15 } }, '1.0.0')
        )
      ),
      React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-26', onPress: handleLogout,
        style: { backgroundColor: '#FEF2F2', borderRadius: 14, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FECACA' },
        componentId: 'logout-btn'
      },
        React.createElement(MaterialIcons, { testID: 'MaterialIcons-17', name: 'logout', size: 22, color: dangerColor }),
        React.createElement(Text, { testID: 'Text-106', style: { color: dangerColor, fontSize: 16, fontWeight: 'bold', marginLeft: 10 } }, 'Sign Out')
      )
    )
  );
};
// @end:SettingsScreen

// @section:TabNavigator @depends:[DashboardScreen,RecurringScreen,HistoryScreen,SettingsScreen,navigation-setup]
const TabNavigator = function() {
  var insets = useSafeAreaInsets();
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  return React.createElement(View, { testID: 'View-87', style: { flex: 1, width: '100%', height: '100%', overflow: 'hidden' } },
    React.createElement(Tab.Navigator, { testID: 'Navigator-1', screenOptions: {
        headerShown: false,
        tabBarStyle: { position: 'absolute', bottom: 0, height: Platform.OS === 'web' ? TAB_MENU_HEIGHT : TAB_MENU_HEIGHT + insets.bottom, borderTopWidth: 0, backgroundColor: cardColor, shadowColor: '#000', shadowOffset: { width: 0, height: -2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 8 },
        tabBarItemStyle: { padding: 0 },
        tabBarActiveTintColor: primaryColor,
        tabBarInactiveTintColor: textSecondary,
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
// @end:TabNavigator

// @section:MainNavigator @depends:[LoginScreen,RegisterScreen,TabNavigator,navigation-setup]
const MainNavigator = function() {
  return React.createElement(Stack.Navigator, { testID: 'Navigator-2', screenOptions: { headerShown: false }, initialRouteName: 'Login' },
    React.createElement(Stack.Screen, { testID: 'Screen-5', name: 'Login', component: LoginScreen }),
    React.createElement(Stack.Screen, { testID: 'Screen-6', name: 'Register', component: RegisterScreen }),
    React.createElement(Stack.Screen, { testID: 'Screen-7', name: 'MainApp', component: TabNavigator })
  );
};
// @end:MainNavigator

// @section:trial-config
const EXPIRATION_DATE = '2026-05-25'; // Expiration date format: YYYY-MM-DD
// @end:trial-config

const TrialExpiredScreen = function() {
  return React.createElement(View, {
    style: { flex: 1, backgroundColor: '#F0FDF4', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }
  },
    React.createElement(View, {
      style: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 32, alignItems: 'center', width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 }
    },
      React.createElement(View, {
        style: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }
      },
        React.createElement(MaterialIcons, { name: 'lock-clock', size: 42, color: '#EF4444' })
      ),
      React.createElement(Text, {
        style: { fontSize: 22, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 12 }
      }, 'Beta Trial Expired'),
      React.createElement(Text, {
        style: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22 }
      }, 'Thank you for testing the Personal Budget Tracker app! This beta testing build expired on ' + formatDate(EXPIRATION_DATE) + '. Please contact the developer for a newer version or standard update.')
    )
  );
};

// Main container Component
const ComponentFunction = function() {
  var isExpired = useMemo(function() {
    var exp = new Date(EXPIRATION_DATE);
    var now = new Date();
    return now.getTime() > exp.getTime();
  }, []);

  return React.createElement(UserProvider, { testID: 'UserProvider-1' },
    React.createElement(ThemeProvider, { testID: 'ThemeProvider-1' },
      React.createElement(SafeAreaProvider, { style: { flex: 1 } },
        React.createElement(View, { testID: 'View-88', style: { flex: 1, width: '100%', height: '100%' } },
          React.createElement(StatusBar, { testID: 'StatusBar-1', barStyle: 'light-content', backgroundColor: primaryColor }),
          isExpired ? React.createElement(TrialExpiredScreen) : React.createElement(NavigationContainer, {}, React.createElement(MainNavigator))
        )
      )
    )
  );
};

export default ComponentFunction;

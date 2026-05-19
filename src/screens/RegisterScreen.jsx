import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Image, Platform, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'platform-hooks';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import KeyboardAvoidingWrapper from '../components/KeyboardAvoidingWrapper';
import { generateId, getTodayStr } from '../utils/helpers';
import logoImg from '../assets/logo.png';

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
        React.createElement(Image, { 
          source: logoImg, 
          style: { width: 100, height: 100, borderRadius: 24, resizeMode: 'contain', marginBottom: 12 } 
        }),
        React.createElement(Text, { 
          style: { fontSize: 26, fontWeight: 'bold', color: theme.colors.primary, letterSpacing: 1.2, marginBottom: 4 } 
        }, 'Penny'),
        React.createElement(Text, { testID: 'Text-17', style: { fontSize: 14, color: theme.colors.textSecondary } }, 'Join Penny Today!')
      ),
      React.createElement(View, { testID: 'View-11', style: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 }, componentId: 'register-card' },
        errorMsg ? React.createElement(View, { testID: 'View-12', style: { backgroundColor: '#FEF2F2', borderRadius: 8, padding: 12, marginBottom: 16 } },
          React.createElement(Text, { testID: 'Text-18', style: { color: theme.colors.error, fontSize: 14 } }, errorMsg)
        ) : null,
        React.createElement(Text, { testID: 'Text-19', style: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 6 } }, 'FULL NAME'),
        React.createElement(TextInput, { testID: 'TextInput-3', value: name, onChangeText: setName, placeholder: 'John Doe',
          autoCapitalize: 'words',
          style: { backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 14, fontSize: 15, color: theme.colors.textPrimary, marginBottom: 16 },
          componentId: 'register-name-input'
        }),
        React.createElement(Text, { testID: 'Text-20', style: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 6 } }, 'EMAIL'),
        React.createElement(TextInput, { testID: 'TextInput-4', value: email, onChangeText: setEmail, placeholder: 'your@email.com',
          keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false,
          style: { backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 14, fontSize: 15, color: theme.colors.textPrimary, marginBottom: 16 },
          componentId: 'register-email-input'
        }),
        React.createElement(Text, { testID: 'Text-21', style: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 6 } }, 'PASSWORD'),
        React.createElement(TextInput, { testID: 'TextInput-5', value: password, onChangeText: setPassword, placeholder: '••••••••',
          secureTextEntry: true, autoCapitalize: 'none', autoCorrect: false,
          style: { backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 14, fontSize: 15, color: theme.colors.textPrimary, marginBottom: 16 },
          componentId: 'register-pass-input'
        }),
        React.createElement(Text, { testID: 'Text-22', style: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 6 } }, 'CONFIRM PASSWORD'),
        React.createElement(TextInput, { testID: 'TextInput-6', value: confirmPassword, onChangeText: setConfirmPassword, placeholder: '••••••••',
          secureTextEntry: true, autoCapitalize: 'none', autoCorrect: false,
          style: { backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 14, fontSize: 15, color: theme.colors.textPrimary, marginBottom: 24 },
          componentId: 'register-confirm-pass-input'
        }),
        React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-9', onPress: handleRegister, disabled: isLoading,
          style: { backgroundColor: isLoading ? theme.colors.accent : theme.colors.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
          componentId: 'register-submit-btn'
        },
          isLoading ? React.createElement(ActivityIndicator, { testID: 'ActivityIndicator-2', color: '#FFFFFF' }) :
          React.createElement(Text, { testID: 'Text-23', style: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' } }, 'Create Account')
        ),
        React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-10', onPress: function() { navigation.goBack(); },
          style: { marginTop: 16, alignItems: 'center' },
          componentId: 'go-login-btn'
        },
          React.createElement(Text, { testID: 'Text-24', style: { color: theme.colors.textSecondary, fontSize: 14 } },
            'Already have an account? ',
            React.createElement(Text, { testID: 'Text-25', style: { color: theme.colors.primary, fontWeight: '600' } }, 'Sign In')
          )
        )
      )
    )
  );
};

export default RegisterScreen;

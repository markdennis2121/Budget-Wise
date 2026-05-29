import React, { useState } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Image, Platform, ActivityIndicator, Modal } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'platform-hooks';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import KeyboardAvoidingWrapper from '../components/KeyboardAvoidingWrapper';
import { generateId, getTodayStr } from '../utils/helpers';
import { scale, moderateScale, normalize } from '../utils/responsive';
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
  var [agreeTerms, setAgreeTerms] = useState(false);
  var [showTermsModal, setShowTermsModal] = useState(false);
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
    if (!agreeTerms) { setErrorMsg('You must agree to the Terms & Conditions.'); return; }
    var existing = allUsers.find(function(u) { return u.email === email.trim().toLowerCase(); });
    if (existing) { setErrorMsg('Email already registered.'); return; }
    setIsLoading(true);
    setErrorMsg('');
    var newId = generateId();
    var newUser = { id: newId, email: email.trim().toLowerCase(), password: password, name: name.trim(), created_at: getTodayStr() };
    mutateUser(newUser).then(function() {
      var settingsId = generateId();
      // Initialize with explicit empty arrays to prevent picking up global defaults
      return mutateSettings({
        id: settingsId,
        user_id: newId,
        monthly_salary: 0,
        envelopes: [],
        accounts: [],
        savings: [],
        accounts_customized: true // Flag as customized so default accounts aren't auto-injected
      });
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
    React.createElement(ScrollView, { testID: 'ScrollView-5', contentContainerStyle: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: moderateScale(24), paddingTop: insets.top + moderateScale(20), paddingBottom: insets.bottom + moderateScale(40) }
    },
      React.createElement(View, { testID: 'View-9', style: { alignItems: 'center', marginBottom: moderateScale(32) }, componentId: 'register-logo' },
        React.createElement(Image, { 
          source: logoImg, 
          style: { width: scale(100), height: scale(100), borderRadius: scale(24), resizeMode: 'contain', marginBottom: moderateScale(12) }
        }),
        React.createElement(Text, { 
          style: { fontSize: normalize(26), fontWeight: 'bold', color: theme.colors.primary, letterSpacing: 1.2, marginBottom: moderateScale(4) }
        }, 'Penny')

      ),
      React.createElement(View, { testID: 'View-11', style: { backgroundColor: theme.colors.card, borderRadius: scale(16), padding: moderateScale(24), shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 }, componentId: 'register-card' },
        errorMsg ? React.createElement(View, { testID: 'View-12', style: { backgroundColor: '#FEF2F2', borderRadius: scale(8), padding: moderateScale(12), marginBottom: moderateScale(16) } },
          React.createElement(Text, { testID: 'Text-18', style: { color: theme.colors.error, fontSize: normalize(14) } }, errorMsg)
        ) : null,
        React.createElement(Text, { testID: 'Text-19', style: { fontSize: normalize(13), fontWeight: '600', color: theme.colors.textSecondary, marginBottom: moderateScale(6) } }, 'FULL NAME'),
        React.createElement(TextInput, { testID: 'TextInput-3', value: name, onChangeText: setName, placeholder: '',

          autoCapitalize: 'words',
          style: { backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: scale(10), padding: moderateScale(14), fontSize: normalize(15), color: theme.colors.textPrimary, marginBottom: moderateScale(16) },
          componentId: 'register-name-input'
        }),
        React.createElement(Text, { testID: 'Text-20', style: { fontSize: normalize(13), fontWeight: '600', color: theme.colors.textSecondary, marginBottom: moderateScale(6) } }, 'EMAIL'),
        React.createElement(TextInput, { testID: 'TextInput-4', value: email, onChangeText: setEmail, placeholder: '',

          keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false,
          style: { backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: scale(10), padding: moderateScale(14), fontSize: normalize(15), color: theme.colors.textPrimary, marginBottom: moderateScale(16) },
          componentId: 'register-email-input'
        }),
        React.createElement(Text, { testID: 'Text-21', style: { fontSize: normalize(13), fontWeight: '600', color: theme.colors.textSecondary, marginBottom: moderateScale(6) } }, 'PASSWORD'),
        React.createElement(TextInput, { testID: 'TextInput-5', value: password, onChangeText: setPassword, placeholder: '',

          secureTextEntry: true, autoCapitalize: 'none', autoCorrect: false,
          style: { backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: scale(10), padding: moderateScale(14), fontSize: normalize(15), color: theme.colors.textPrimary, marginBottom: moderateScale(16) },
          componentId: 'register-pass-input'
        }),
        React.createElement(Text, { testID: 'Text-22', style: { fontSize: normalize(13), fontWeight: '600', color: theme.colors.textSecondary, marginBottom: moderateScale(6) } }, 'CONFIRM PASSWORD'),
        React.createElement(TextInput, { testID: 'TextInput-6', value: confirmPassword, onChangeText: setConfirmPassword, placeholder: '',

          secureTextEntry: true, autoCapitalize: 'none', autoCorrect: false,
          style: { backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: scale(10), padding: moderateScale(14), fontSize: normalize(15), color: theme.colors.textPrimary, marginBottom: moderateScale(24) },
          componentId: 'register-confirm-pass-input'
        }),
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: moderateScale(24) }}>
          <TouchableOpacity activeOpacity={0.8} onPress={() => setAgreeTerms(!agreeTerms)} style={{ width: scale(20), height: scale(20), borderRadius: scale(6), borderWidth: 2, borderColor: agreeTerms ? theme.colors.primary : theme.colors.border, backgroundColor: agreeTerms ? theme.colors.primary : 'transparent', alignItems: 'center', justifyContent: 'center', marginRight: moderateScale(10) }}>
            {agreeTerms && <MaterialIcons name="check" size={scale(14)} color="#FFFFFF" />}
          </TouchableOpacity>
          <Text style={{ fontSize: normalize(13), color: theme.colors.textSecondary, flex: 1 }}>
            I agree to the <Text onPress={function(e) { if(e && e.stopPropagation) e.stopPropagation(); setShowTermsModal(true); }} style={{ color: theme.colors.primary, fontWeight: 'bold' }}>Terms & Conditions</Text>
          </Text>
        </View>,

        <Modal visible={showTermsModal} animationType="slide" transparent={true} onRequestClose={() => setShowTermsModal(false)}>
          <View style={{ flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.5)' }}>
            <View style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: scale(24), borderTopRightRadius: scale(24), padding: moderateScale(24), paddingBottom: insets.bottom + moderateScale(24) }}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: moderateScale(16) }}>
                <Text style={{ fontSize: normalize(18), fontWeight: 'bold', color: theme.colors.textPrimary }}>Terms & Privacy Policy</Text>
                <TouchableOpacity onPress={() => setShowTermsModal(false)} style={{ padding: moderateScale(4), backgroundColor: theme.colors.background, borderRadius: scale(12) }}>
                  <MaterialIcons name="close" size={scale(20)} color={theme.colors.textSecondary} />
                </TouchableOpacity>
              </View>
              
              <ScrollView style={{ maxHeight: scale(300) }}>
                <Text style={{ fontSize: normalize(15), color: theme.colors.textPrimary, fontWeight: 'bold', marginBottom: moderateScale(8) }}>1. 100% Offline App</Text>
                <Text style={{ fontSize: normalize(14), color: theme.colors.textSecondary, marginBottom: moderateScale(16), lineHeight: normalize(22) }}>
                  Penny is a fully offline application. We do not collect, transmit, or store your financial data on any external servers. All information remains locally on your device.
                </Text>
                
                <Text style={{ fontSize: normalize(15), color: theme.colors.textPrimary, fontWeight: 'bold', marginBottom: moderateScale(8) }}>2. Data Responsibility</Text>
                <Text style={{ fontSize: normalize(14), color: theme.colors.textSecondary, marginBottom: moderateScale(16), lineHeight: normalize(22) }}>
                  Because your data is strictly local, you are solely responsible for it. If you uninstall the app or lose your device without a personal backup, your data will be permanently lost. We cannot recover lost data.
                </Text>
                
                <Text style={{ fontSize: normalize(15), color: theme.colors.textPrimary, fontWeight: 'bold', marginBottom: moderateScale(8) }}>3. Not Financial Advice</Text>
                <Text style={{ fontSize: normalize(14), color: theme.colors.textSecondary, marginBottom: moderateScale(16), lineHeight: normalize(22) }}>
                  This application is a budgeting utility, not professional financial advice. You agree to use it at your own discretion.
                </Text>
              </ScrollView>
              
              <TouchableOpacity onPress={() => setShowTermsModal(false)} style={{ marginTop: moderateScale(16), backgroundColor: theme.colors.primary, borderRadius: scale(12), padding: moderateScale(14), alignItems: 'center' }}>
                <Text style={{ color: '#FFFFFF', fontWeight: 'bold', fontSize: normalize(15) }}>Close</Text>
              </TouchableOpacity>
            </View>
          </View>
        </Modal>,

        React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-9', onPress: handleRegister, disabled: isLoading,
          style: { backgroundColor: isLoading ? theme.colors.accent : theme.colors.primary, borderRadius: scale(12), padding: moderateScale(16), alignItems: 'center' },
          componentId: 'register-submit-btn'
        },
          isLoading ? React.createElement(ActivityIndicator, { testID: 'ActivityIndicator-2', color: '#FFFFFF' }) :
          React.createElement(Text, { testID: 'Text-23', style: { color: '#FFFFFF', fontSize: normalize(16), fontWeight: 'bold' } }, 'Create Account')
        ),
        React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-10', onPress: function() { navigation.goBack(); },
          style: { marginTop: moderateScale(16), alignItems: 'center' },
          componentId: 'go-login-btn'
        },
          React.createElement(Text, { testID: 'Text-24', style: { color: theme.colors.textSecondary, fontSize: normalize(14) } },
            'Already have an account? ',
            React.createElement(Text, { testID: 'Text-25', style: { color: theme.colors.primary, fontWeight: '600' } }, 'Sign In')
          )
        )
      )
    )
  );
};

export default RegisterScreen;


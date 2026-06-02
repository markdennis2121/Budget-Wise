import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Image, Platform, ActivityIndicator, Modal, Vibration } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'platform-hooks';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { scale, moderateScale, normalize } from '../utils/responsive';
import KeyboardAvoidingWrapper from '../components/KeyboardAvoidingWrapper';
import { NativeBiometric } from 'capacitor-native-biometric';
import { Capacitor } from '@capacitor/core';
import logoImg from '../assets/logo.png';

const PIN_LENGTH = 6;
const IS_NATIVE = Capacitor.isNativePlatform();
const IS_WEB = !IS_NATIVE && Platform.OS === 'web';

// Persist the last-logged-in user across logouts so PIN/biometric targets the right account.
const LAST_PIN_USER_KEY = 'penny_last_user_id';
var getLastPinUserId = function () {
  try { return localStorage.getItem(LAST_PIN_USER_KEY) || null; } catch (e) { return null; }
};
var saveLastPinUserId = function (id) {
  try { if (id) localStorage.setItem(LAST_PIN_USER_KEY, id); } catch (e) {} 
};

const LoginScreen = function (props) {
  var navigation = props.navigation;
  var route = props.route;
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var userCtx = useUser();
  var insets = useSafeAreaInsets();

  var routeParams = route && route.params ? route.params : {};
  var [email, setEmail] = useState(routeParams.email || '');
  var [password, setPassword] = useState('');
  var [errorMsg, setErrorMsg] = useState('');
  var [successMsg, setSuccessMsg] = useState(routeParams.resetMessage || '');
  var [isLoading, setIsLoading] = useState(false);

  // PIN modal state
  var [showPinModal, setShowPinModal] = useState(false);
  var [pin, setPin] = useState('');
  var [pinError, setPinError] = useState(false);

  var usersQuery = useQuery('budget_users');
  var allUsers = usersQuery.data || [];
  var settingsQuery = useQuery('user_settings');
  var allSettings = settingsQuery.data || [];

  // Build the full list of all users that have a PIN set.
  // Used for PIN matching (any account's PIN unlocks that account).
  var allPinEntries = allUsers.reduce(function (acc, u) {
    var s = allSettings.find(function (st) { return st.user_id === u.id && st.pin_code; });
    if (s) acc.push({ user: u, pinCode: s.pin_code, biometricsEnabled: s.biometrics_enabled });
    return acc;
  }, []);

  // pinEntry: used ONLY for biometrics — targets the last-logged-in user.
  // Falls back to the first account that has biometrics enabled.
  var lastUserId = getLastPinUserId();
  var pinEntry = (function () {
    if (lastUserId) {
      var lastEntry = allPinEntries.find(function (e) { return e.user.id === lastUserId; });
      if (lastEntry) return lastEntry;
    }
    // Fallback: first account that has biometrics enabled
    var bioEntry = allPinEntries.find(function (e) { return e.biometricsEnabled; });
    if (bioEntry) return bioEntry;
    // Last resort: first account with any PIN
    return allPinEntries[0] || null;
  }());

  // Whether the PIN button should be shown (at least one account has a PIN)
  var hasPinAccount = allPinEntries.length > 0;

  var triggerModalBiometrics = async function () {
    if (IS_WEB) return;
    try {
      var availableRes = await NativeBiometric.isAvailable();
      if (availableRes.isAvailable) {
        await NativeBiometric.verifyIdentity({
          reason: "Sign in to Penny",
          title: "Biometric Login",
          subtitle: "Use fingerprint or Face ID"
        });
        if (pinEntry) {
          setShowPinModal(false);
          setPin('');
          saveLastPinUserId(pinEntry.user.id);
          userCtx.setCurrentUser(pinEntry.user);
          navigation.replace('MainApp');
        }
      }
    } catch (e) {
      console.log("Biometrics failed", e);
    }
  };

  useEffect(function () {
    if (showPinModal && pinEntry?.biometricsEnabled && !IS_WEB) {
      var timer = setTimeout(() => {
        triggerModalBiometrics();
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [showPinModal]);

  // Handle PIN digit entry — scan ALL accounts for a matching PIN.
  // This allows each account's unique PIN to unlock only that account.
  useEffect(function () {
    if (!showPinModal) return;
    if (pin.length === PIN_LENGTH) {
      var matched = allPinEntries.find(function (e) { return e.pinCode === pin; });
      if (matched) {
        setShowPinModal(false);
        setPin('');
        saveLastPinUserId(matched.user.id);
        userCtx.setCurrentUser(matched.user);
        navigation.replace('MainApp');
      } else {
        setPinError(true);
        if (Platform.OS !== 'web') Vibration.vibrate();
        setTimeout(function () { setPin(''); setPinError(false); }, 500);
      }
    }
  }, [pin, showPinModal, allPinEntries]);

  var handlePinPress = function (num) {
    if (pin.length < PIN_LENGTH) { setPin(function (p) { return p + num; }); setPinError(false); }
  };
  var handleBackspace = function () { setPin(function (p) { return p.slice(0, -1); }); setPinError(false); };
  var handleClosePinModal = function () { setShowPinModal(false); setPin(''); setPinError(false); };

  useEffect(function () {
    if (routeParams.resetMessage) {
      setSuccessMsg(routeParams.resetMessage);
      if (routeParams.email) setEmail(routeParams.email);
      navigation.setParams({ resetMessage: undefined, email: undefined });
    }
  }, [routeParams.resetMessage, routeParams.email]);

  var handleLogin = function () {
    if (!email.trim() || !password.trim()) { setErrorMsg('Please enter email and password.'); return; }
    setIsLoading(true); setErrorMsg(''); setSuccessMsg('');
    setTimeout(function () {
      var found = allUsers.find(function (u) { return u.email === email.trim().toLowerCase() && u.password === password; });
      if (found) {
        saveLastPinUserId(found.id); // Remember this user for next PIN/biometric prompt
        userCtx.setCurrentUser(found);
        navigation.replace('MainApp');
      } else {
        setErrorMsg('Invalid email or password.');
      }
      setIsLoading(false);
    }, 300);
  };

  return React.createElement(KeyboardAvoidingWrapper, {
    testID: 'KeyboardAvoidingView-1',
    behavior: Platform.OS === 'ios' ? 'padding' : 'height',
    style: { flex: 1, backgroundColor: theme.colors.background }
  },
    React.createElement(ScrollView, {
      testID: 'ScrollView-4',
      contentContainerStyle: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: moderateScale(24), paddingTop: insets.top + moderateScale(20), paddingBottom: insets.bottom + moderateScale(40) }
    },
      // Logo + mascot
      React.createElement(View, { testID: 'View-5', style: { alignItems: 'center', marginBottom: moderateScale(32) }, componentId: 'login-logo' },
        React.createElement(Image, { 
          source: logoImg, 
          resizeMode: 'contain',
          style: { width: scale(100), height: scale(100), borderRadius: scale(24), marginBottom: moderateScale(12) }
        }),
        React.createElement(Text, { 
          style: { fontSize: normalize(26), fontWeight: 'bold', color: theme.colors.primary, letterSpacing: 1.2 }
        }, 'Penny')
      ),

      // Login card
      React.createElement(View, { testID: 'View-7', style: { backgroundColor: theme.colors.card, borderRadius: scale(16), padding: moderateScale(24), shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 }, componentId: 'login-card' },
        React.createElement(Text, { testID: 'Text-10', style: { fontSize: normalize(22), fontWeight: 'bold', color: theme.colors.textPrimary, marginBottom: moderateScale(24) } }, 'Sign In'),
        successMsg ? React.createElement(View, { style: { backgroundColor: '#E6F4EA', borderRadius: scale(8), padding: moderateScale(12), marginBottom: moderateScale(16) } },
          React.createElement(Text, { style: { color: '#065F46', fontSize: normalize(14) } }, successMsg)
        ) : null,
        errorMsg ? React.createElement(View, { testID: 'View-8', style: { backgroundColor: '#FEF2F2', borderRadius: scale(8), padding: moderateScale(12), marginBottom: moderateScale(16) } },
          React.createElement(Text, { testID: 'Text-11', style: { color: theme.colors.error, fontSize: normalize(14) } }, errorMsg)
        ) : null,
        React.createElement(Text, { testID: 'Text-12', style: { fontSize: normalize(13), fontWeight: '600', color: theme.colors.textSecondary, marginBottom: moderateScale(6) } }, 'EMAIL'),
        React.createElement(TextInput, {
          testID: 'TextInput-1', value: email, onChangeText: setEmail, placeholder: '',

          keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false,
          style: { backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: scale(10), padding: moderateScale(14), fontSize: normalize(15), color: theme.colors.textPrimary, marginBottom: moderateScale(16) },
          componentId: 'login-email-input'
        }),
        React.createElement(Text, { testID: 'Text-13', style: { fontSize: normalize(13), fontWeight: '600', color: theme.colors.textSecondary, marginBottom: moderateScale(6) } }, 'PASSWORD'),
        React.createElement(TextInput, {
          testID: 'TextInput-2', value: password, onChangeText: setPassword, placeholder: '',

          secureTextEntry: true, autoCapitalize: 'none', autoCorrect: false,
          style: { backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: scale(10), padding: moderateScale(14), fontSize: normalize(15), color: theme.colors.textPrimary, marginBottom: moderateScale(12) },
          componentId: 'login-password-input'
        }),
        React.createElement(TouchableOpacity, {
          onPress: function () { navigation.navigate('ForgotPassword'); },
          style: { alignSelf: 'flex-end', marginBottom: moderateScale(20) },
          componentId: 'forgot-password-btn'
        },
          React.createElement(Text, { style: { color: theme.colors.primary, fontSize: normalize(13), fontWeight: '600' } }, 'Forgot password?')
        ),
        React.createElement(TouchableOpacity, {
          testID: 'TouchableOpacity-7', onPress: handleLogin, disabled: isLoading,
          style: { backgroundColor: isLoading ? theme.colors.accent : theme.colors.primary, borderRadius: scale(12), padding: moderateScale(16), alignItems: 'center' },
          componentId: 'login-submit-btn'
        },
          isLoading ? React.createElement(ActivityIndicator, { testID: 'ActivityIndicator-1', color: '#FFFFFF' }) :
            React.createElement(Text, { testID: 'Text-14', style: { color: '#FFFFFF', fontSize: normalize(16), fontWeight: 'bold' } }, 'Sign In')
        ),

        // PIN option — show if ANY account has a PIN set
        hasPinAccount ? React.createElement(TouchableOpacity, {
          onPress: function () { setShowPinModal(true); setPin(''); setPinError(false); },
          style: { marginTop: moderateScale(16), borderWidth: 1, borderColor: theme.colors.border, borderRadius: scale(12), padding: moderateScale(14), alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
          componentId: 'login-pin-btn'
        },
          React.createElement(MaterialIcons, { name: 'dialpad', size: scale(20), color: theme.colors.primary }),
          React.createElement(Text, { style: { color: theme.colors.primary, fontWeight: '700', fontSize: normalize(14), marginLeft: 8 } }, 'Sign in with PIN')
        ) : null,

        React.createElement(TouchableOpacity, {
          testID: 'TouchableOpacity-8', onPress: function () { navigation.navigate('Register'); },
          style: { marginTop: moderateScale(16), alignItems: 'center' }, componentId: 'go-register-btn'
        },
          React.createElement(Text, { testID: 'Text-15', style: { color: theme.colors.textSecondary, fontSize: normalize(14) } },
            "Don't have an account? ",
            React.createElement(Text, { testID: 'Text-16', style: { color: theme.colors.primary, fontWeight: '600' } }, 'Sign Up')
          )
        )
      )
    ),

    // PIN Modal overlay
    React.createElement(Modal, { visible: showPinModal, animationType: 'slide', transparent: true, onRequestClose: handleClosePinModal },
      React.createElement(View, { style: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' } },
        React.createElement(View, { style: { backgroundColor: theme.colors.card, borderTopLeftRadius: scale(28), borderTopRightRadius: scale(28), paddingTop: moderateScale(20), paddingBottom: insets.bottom + moderateScale(32), paddingHorizontal: moderateScale(32), alignItems: 'center' } },

          // Handle bar
          React.createElement(View, { style: { width: scale(40), height: scale(4), borderRadius: scale(2), backgroundColor: theme.colors.border, marginBottom: moderateScale(24) } }),

          React.createElement(Text, { style: { fontSize: normalize(20), fontWeight: 'bold', color: theme.colors.textPrimary, marginBottom: moderateScale(24) } }, 'Enter your PIN'),


          // PIN dots
          React.createElement(View, { style: { flexDirection: 'row', gap: scale(10), marginBottom: moderateScale(8) } },
            Array.from({ length: PIN_LENGTH }).map(function (_, i) {
              return React.createElement(View, { key: i, style: { width: scale(13), height: scale(13), borderRadius: scale(7), backgroundColor: i < pin.length ? theme.colors.primary : 'transparent', borderWidth: 2, borderColor: pinError ? theme.colors.error : (i < pin.length ? theme.colors.primary : theme.colors.border) } });
            })
          ),
          pinError
            ? React.createElement(Text, { style: { color: theme.colors.error, fontSize: normalize(13), fontWeight: '600', marginBottom: moderateScale(16) } }, 'Incorrect PIN')
            : React.createElement(View, { style: { height: scale(26) } }),

          // Dial pad
          React.createElement(View, { style: { width: scale(240), flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: moderateScale(12) } },
            [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (num) {
              return React.createElement(TouchableOpacity, {
                key: num, onPress: function () { handlePinPress(num.toString()); },
                style: { width: scale(68), height: scale(68), borderRadius: scale(34), backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border }
              },
                React.createElement(Text, { style: { fontSize: normalize(24), fontWeight: 'bold', color: theme.colors.textPrimary } }, num)
              );
            }),
            pinEntry?.biometricsEnabled
              ? React.createElement(TouchableOpacity, {
                onPress: triggerModalBiometrics,
                style: { width: scale(68), height: scale(68), borderRadius: scale(34), backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border }
              },
                React.createElement(MaterialIcons, { name: 'fingerprint', size: scale(28), color: theme.colors.primary })
              )
              : React.createElement(TouchableOpacity, { onPress: handleClosePinModal, style: { width: scale(68), height: scale(68), alignItems: 'center', justifyContent: 'center' } },
                React.createElement(Text, { style: { fontSize: normalize(12), color: theme.colors.textSecondary, fontWeight: '600', textAlign: 'center' } }, 'Cancel')
              ),
            React.createElement(TouchableOpacity, {
              onPress: function () { handlePinPress('0'); },
              style: { width: scale(68), height: scale(68), borderRadius: scale(34), backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border }
            },
              React.createElement(Text, { style: { fontSize: normalize(24), fontWeight: 'bold', color: theme.colors.textPrimary } }, '0')
            ),
            React.createElement(TouchableOpacity, { onPress: handleBackspace, style: { width: scale(68), height: scale(68), alignItems: 'center', justifyContent: 'center' } },
              React.createElement(MaterialIcons, { name: 'backspace', size: scale(24), color: theme.colors.textSecondary })
            )
          )
        )
      )
    )
  );
};

export default LoginScreen;

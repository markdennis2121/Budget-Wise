import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, TextInput, ScrollView, Image, Platform, ActivityIndicator, Modal, Vibration } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery } from 'platform-hooks';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import KeyboardAvoidingWrapper from '../components/KeyboardAvoidingWrapper';
import { NativeBiometric } from 'capacitor-native-biometric';
import logoImg from '../assets/logo.png';

const PIN_LENGTH = 6;

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
    if (showPinModal && pinEntry?.biometricsEnabled) {
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
      contentContainerStyle: { flexGrow: 1, justifyContent: 'center', paddingHorizontal: 24, paddingTop: insets.top + 20, paddingBottom: insets.bottom + 40 }
    },
      // Logo + mascot
      React.createElement(View, { testID: 'View-5', style: { alignItems: 'center', marginBottom: 32 }, componentId: 'login-logo' },
        React.createElement(Image, { 
          source: logoImg, 
          style: { width: 100, height: 100, borderRadius: 24, resizeMode: 'contain', marginBottom: 12 } 
        }),
        React.createElement(Text, { 
          style: { fontSize: 26, fontWeight: 'bold', color: theme.colors.primary, letterSpacing: 1.2 } 
        }, 'Penny')
      ),

      // Login card
      React.createElement(View, { testID: 'View-7', style: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.08, shadowRadius: 8, elevation: 3 }, componentId: 'login-card' },
        React.createElement(Text, { testID: 'Text-10', style: { fontSize: 22, fontWeight: 'bold', color: theme.colors.textPrimary, marginBottom: 24 } }, 'Sign In'),
        successMsg ? React.createElement(View, { style: { backgroundColor: '#E6F4EA', borderRadius: 8, padding: 12, marginBottom: 16 } },
          React.createElement(Text, { style: { color: '#065F46', fontSize: 14 } }, successMsg)
        ) : null,
        errorMsg ? React.createElement(View, { testID: 'View-8', style: { backgroundColor: '#FEF2F2', borderRadius: 8, padding: 12, marginBottom: 16 } },
          React.createElement(Text, { testID: 'Text-11', style: { color: theme.colors.error, fontSize: 14 } }, errorMsg)
        ) : null,
        React.createElement(Text, { testID: 'Text-12', style: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 6 } }, 'EMAIL'),
        React.createElement(TextInput, {
          testID: 'TextInput-1', value: email, onChangeText: setEmail, placeholder: 'your@email.com',
          keyboardType: 'email-address', autoCapitalize: 'none', autoCorrect: false,
          style: { backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 14, fontSize: 15, color: theme.colors.textPrimary, marginBottom: 16 },
          componentId: 'login-email-input'
        }),
        React.createElement(Text, { testID: 'Text-13', style: { fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary, marginBottom: 6 } }, 'PASSWORD'),
        React.createElement(TextInput, {
          testID: 'TextInput-2', value: password, onChangeText: setPassword, placeholder: '••••••••',
          secureTextEntry: true, autoCapitalize: 'none', autoCorrect: false,
          style: { backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 10, padding: 14, fontSize: 15, color: theme.colors.textPrimary, marginBottom: 12 },
          componentId: 'login-password-input'
        }),
        React.createElement(TouchableOpacity, {
          onPress: function () { navigation.navigate('ForgotPassword'); },
          style: { alignSelf: 'flex-end', marginBottom: 20 },
          componentId: 'forgot-password-btn'
        },
          React.createElement(Text, { style: { color: theme.colors.primary, fontSize: 13, fontWeight: '600' } }, 'Forgot password?')
        ),
        React.createElement(TouchableOpacity, {
          testID: 'TouchableOpacity-7', onPress: handleLogin, disabled: isLoading,
          style: { backgroundColor: isLoading ? theme.colors.accent : theme.colors.primary, borderRadius: 12, padding: 16, alignItems: 'center' },
          componentId: 'login-submit-btn'
        },
          isLoading ? React.createElement(ActivityIndicator, { testID: 'ActivityIndicator-1', color: '#FFFFFF' }) :
            React.createElement(Text, { testID: 'Text-14', style: { color: '#FFFFFF', fontSize: 16, fontWeight: 'bold' } }, 'Sign In')
        ),

        // PIN option — show if ANY account has a PIN set
        hasPinAccount ? React.createElement(TouchableOpacity, {
          onPress: function () { setShowPinModal(true); setPin(''); setPinError(false); },
          style: { marginTop: 16, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 14, alignItems: 'center', flexDirection: 'row', justifyContent: 'center' },
          componentId: 'login-pin-btn'
        },
          React.createElement(MaterialIcons, { name: 'dialpad', size: 20, color: theme.colors.primary }),
          React.createElement(Text, { style: { color: theme.colors.primary, fontWeight: '700', fontSize: 14, marginLeft: 8 } }, 'Sign in with PIN')
        ) : null,

        React.createElement(TouchableOpacity, {
          testID: 'TouchableOpacity-8', onPress: function () { navigation.navigate('Register'); },
          style: { marginTop: 16, alignItems: 'center' }, componentId: 'go-register-btn'
        },
          React.createElement(Text, { testID: 'Text-15', style: { color: theme.colors.textSecondary, fontSize: 14 } },
            "Don't have an account? ",
            React.createElement(Text, { testID: 'Text-16', style: { color: theme.colors.primary, fontWeight: '600' } }, 'Sign Up')
          )
        )
      )
    ),

    // PIN Modal overlay
    React.createElement(Modal, { visible: showPinModal, animationType: 'slide', transparent: true, onRequestClose: handleClosePinModal },
      React.createElement(View, { style: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' } },
        React.createElement(View, { style: { backgroundColor: theme.colors.card, borderTopLeftRadius: 28, borderTopRightRadius: 28, paddingTop: 20, paddingBottom: insets.bottom + 32, paddingHorizontal: 32, alignItems: 'center' } },

          // Handle bar
          React.createElement(View, { style: { width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, marginBottom: 24 } }),

          React.createElement(Text, { style: { fontSize: 20, fontWeight: 'bold', color: theme.colors.textPrimary, marginBottom: 4 } }, 'Enter your PIN'),
          React.createElement(Text, { style: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 24 } }, 'Each account\'s PIN is unique'),

          // PIN dots
          React.createElement(View, { style: { flexDirection: 'row', gap: 10, marginBottom: 8 } },
            Array.from({ length: PIN_LENGTH }).map(function (_, i) {
              return React.createElement(View, { key: i, style: { width: 13, height: 13, borderRadius: 7, backgroundColor: i < pin.length ? theme.colors.primary : 'transparent', borderWidth: 2, borderColor: pinError ? theme.colors.error : (i < pin.length ? theme.colors.primary : theme.colors.border) } });
            })
          ),
          pinError
            ? React.createElement(Text, { style: { color: theme.colors.error, fontSize: 13, fontWeight: '600', marginBottom: 16 } }, 'Incorrect PIN')
            : React.createElement(View, { style: { height: 26 } }),

          // Dial pad
          React.createElement(View, { style: { width: 240, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 } },
            [1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (num) {
              return React.createElement(TouchableOpacity, {
                key: num, onPress: function () { handlePinPress(num.toString()); },
                style: { width: 68, height: 68, borderRadius: 34, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border }
              },
                React.createElement(Text, { style: { fontSize: 24, fontWeight: 'bold', color: theme.colors.textPrimary } }, num)
              );
            }),
            pinEntry?.biometricsEnabled
              ? React.createElement(TouchableOpacity, {
                onPress: triggerModalBiometrics,
                style: { width: 68, height: 68, borderRadius: 34, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border }
              },
                React.createElement(MaterialIcons, { name: 'fingerprint', size: 28, color: theme.colors.primary })
              )
              : React.createElement(TouchableOpacity, { onPress: handleClosePinModal, style: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' } },
                React.createElement(Text, { style: { fontSize: 12, color: theme.colors.textSecondary, fontWeight: '600', textAlign: 'center' } }, 'Cancel')
              ),
            React.createElement(TouchableOpacity, {
              onPress: function () { handlePinPress('0'); },
              style: { width: 68, height: 68, borderRadius: 34, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: theme.colors.border }
            },
              React.createElement(Text, { style: { fontSize: 24, fontWeight: 'bold', color: theme.colors.textPrimary } }, '0')
            ),
            React.createElement(TouchableOpacity, { onPress: handleBackspace, style: { width: 68, height: 68, alignItems: 'center', justifyContent: 'center' } },
              React.createElement(MaterialIcons, { name: 'backspace', size: 24, color: theme.colors.textSecondary })
            )
          )
        )
      )
    )
  );
};

export default LoginScreen;

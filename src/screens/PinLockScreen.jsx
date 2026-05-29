import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Platform, Vibration, Animated, StyleSheet, Image, AppState } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { useQuery, useMutation } from 'platform-hooks';
import { NativeBiometric } from 'capacitor-native-biometric';
import { Capacitor } from '@capacitor/core';
import { scale, moderateScale, normalize } from '../utils/responsive';
import logoImg from '../assets/logo.png';

const PIN_LENGTH = 6;
const IS_NATIVE = Capacitor.isNativePlatform();
const IS_WEB = !IS_NATIVE && Platform.OS === 'web';

// Animated PIN dot - Matched to Sign In design
var PinDot = function (props) {
  var { filled, error, primary, errorColor, border } = props;
  var scaleAnim = useRef(new Animated.Value(1)).current;

  useEffect(function () {
    if (filled) {
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.3, useNativeDriver: !IS_WEB, speed: 50, bounciness: 10 }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: !IS_WEB, speed: 50, bounciness: 8 }),
      ]).start();
    }
  }, [filled]);

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }],
        width: scale(13),
        height: scale(13),
        borderRadius: scale(7),
        marginHorizontal: scale(5),
        borderWidth: 2,
        borderColor: error ? errorColor : (filled ? primary : border),
        backgroundColor: filled ? (error ? errorColor : primary) : 'transparent',
      }}
    />
  );
};

// Keypad button - Matched to Sign In design
var KeypadButton = function (props) {
  var { onPress, children, style } = props;
  var scaleAnim = useRef(new Animated.Value(1)).current;

  var handlePressIn = function () {
    Animated.spring(scaleAnim, { toValue: 0.92, useNativeDriver: !IS_WEB, speed: 60 }).start();
  };
  var handlePressOut = function () {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: !IS_WEB, speed: 40 }).start();
  };

  return (
    <TouchableOpacity onPress={onPress} onPressIn={handlePressIn} onPressOut={handlePressOut} activeOpacity={1}>
      <Animated.View style={[style, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

var PinLockScreen = function (props) {
  var { onUnlock, userSettings: userSettingsProp } = props;
  var { theme } = useTheme();
  var userCtx = useUser();
  var currentUser = userCtx.currentUser;
  var insets = useSafeAreaInsets();

  var settingsQuery = useQuery('user_settings');
  var userSettings = userSettingsProp || (settingsQuery.data || []).find(s => s.user_id === (currentUser?.id || ''));

  var [pin, setPin] = useState('');
  var [error, setError] = useState(false);
  var isAuthenticating = useRef(false);

  var mountAnim = useRef(new Animated.Value(0)).current;

  var handleBiometricAuth = async () => {
    if (IS_WEB || isAuthenticating.current) return;
    try {
      isAuthenticating.current = true;

      const result = await NativeBiometric.isAvailable();
      if (result.isAvailable && userSettings?.biometrics_enabled) {
        try {
          await NativeBiometric.verifyIdentity({
            reason: "Unlock Penny Budget",
            title: "Biometric Login",
            subtitle: "Use fingerprint or face to unlock",
            description: "Verify your identity to access your budget data.",
            negativeButtonText: "Use PIN"
          });

          onUnlock();
        } catch (authError) {
          console.log("Biometric identity verification cancelled or failed:", authError);
        }
      }
    } catch (e) {
      console.warn("Biometric hardware access error:", e);
    } finally {
      setTimeout(() => { isAuthenticating.current = false; }, 1000);
    }
  };

  useEffect(() => {
    Animated.timing(mountAnim, { toValue: 1, duration: 400, useNativeDriver: !IS_WEB }).start();

    if (userSettings?.biometrics_enabled) {
      var t = setTimeout(handleBiometricAuth, 800);
    }

    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'active' && userSettings?.biometrics_enabled) {
        handleBiometricAuth();
      }
    });

    return () => {
      if (t) clearTimeout(t);
      subscription.remove();
    };
  }, [userSettings?.biometrics_enabled]);

  useEffect(() => {
    if (pin.length === PIN_LENGTH) {
      if (userSettings && userSettings.pin_code === pin) {
        onUnlock();
      } else {
        setError(true);
        if (!IS_WEB) Vibration.vibrate(300);
        setTimeout(() => { setPin(''); setError(false); }, 600);
      }
    }
  }, [pin, userSettings]);

  var keypadButtonStyle = {
    width: scale(68), height: scale(68), borderRadius: scale(34),
    backgroundColor: theme.colors.background,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.colors.border,
    ...(IS_WEB ? {} : { elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } })
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Animated.View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top, paddingBottom: insets.bottom, opacity: mountAnim }}>

        {/* LOGO */}
        <Image
          source={logoImg}
          style={{ width: scale(100), height: scale(100), borderRadius: scale(24), marginBottom: moderateScale(16), resizeMode: 'contain' }}
        />

        <Text style={{ fontSize: normalize(22), fontWeight: 'bold', color: theme.colors.textPrimary, marginBottom: moderateScale(28) }}>Enter PIN</Text>


        <View style={{ flexDirection: 'row', gap: scale(10), marginBottom: moderateScale(8) }}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <PinDot key={i} filled={i < pin.length} error={error} primary={theme.colors.primary} errorColor={theme.colors.error} border={theme.colors.border} />
          ))}
        </View>

        <View style={{ height: scale(26), marginBottom: moderateScale(16), justifyContent: 'center' }}>
          {error && <Text style={{ color: theme.colors.error, fontSize: normalize(13), fontWeight: '600' }}>Incorrect PIN</Text>}
        </View>

        {/* KEYPAD */}
        <View style={{ backgroundColor: theme.colors.card, borderRadius: scale(28), borderWidth: 1, borderColor: theme.colors.border, padding: moderateScale(24), width: scale(300), alignItems: 'center' }}>
          <View style={{ width: scale(40), height: scale(4), borderRadius: scale(2), backgroundColor: theme.colors.border, marginBottom: moderateScale(24) }} />
          <View style={{ width: scale(240), flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: scale(12) }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <KeypadButton key={num} onPress={() => pin.length < PIN_LENGTH && setPin(p => p + num)} style={keypadButtonStyle}>
                <Text style={{ fontSize: normalize(24), fontWeight: 'bold', color: theme.colors.textPrimary }}>{num}</Text>
              </KeypadButton>
            ))}

            {!IS_WEB && userSettings?.biometrics_enabled ? (
              <TouchableOpacity onPress={handleBiometricAuth} style={keypadButtonStyle}>
                <MaterialIcons name="fingerprint" size={scale(32)} color={theme.colors.primary} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: scale(68), height: scale(68) }} />
            )}

            <KeypadButton onPress={() => pin.length < PIN_LENGTH && setPin(p => p + '0')} style={keypadButtonStyle}>
              <Text style={{ fontSize: normalize(24), fontWeight: 'bold', color: theme.colors.textPrimary }}>0</Text>
            </KeypadButton>
            <TouchableOpacity onPress={() => setPin(p => p.slice(0, -1))} style={{ width: scale(68), height: scale(68), alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="backspace" size={scale(24)} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity onPress={() => userCtx.setCurrentUser(null)} style={{ marginTop: moderateScale(32), paddingVertical: moderateScale(10), paddingHorizontal: moderateScale(24), borderRadius: scale(20), borderWidth: 1, borderColor: theme.colors.border }}>
          <Text style={{ fontSize: normalize(13), fontWeight: '600', color: theme.colors.textSecondary }}>Sign Out</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

export default PinLockScreen;

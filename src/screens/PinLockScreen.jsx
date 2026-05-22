import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Platform, Vibration, Animated, StyleSheet, Image } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { useQuery, useMutation } from 'platform-hooks';
import { NativeBiometric } from 'capacitor-native-biometric';
import { Capacitor } from '@capacitor/core';
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
        width: 13,
        height: 13,
        borderRadius: 7,
        marginHorizontal: 5,
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
  var { onUnlock } = props;
  var { theme } = useTheme();
  var userCtx = useUser();
  var currentUser = userCtx.currentUser;
  var insets = useSafeAreaInsets();

  var settingsQuery = useQuery('user_settings');
  var userSettings = (settingsQuery.data || []).find(s => s.user_id === (currentUser?.id || ''));

  var [pin, setPin] = useState('');
  var [error, setError] = useState(false);

  var mountAnim = useRef(new Animated.Value(0)).current;

  var handleBiometricAuth = async () => {
    if (IS_WEB) return;
    try {
      const result = await NativeBiometric.isAvailable();
      if (result.isAvailable && userSettings?.biometrics_enabled) {
        const verified = await NativeBiometric.verifyIdentity({
          reason: "Unlock Penny Budget",
          title: "Biometric Login",
          subtitle: "Use fingerprint or face to unlock",
          description: "Verify your identity to access your budget data."
        });
        if (verified) {
          onUnlock();
        }
      }
    } catch (e) {
      console.error("Biometric error", e);
    }
  };

  useEffect(() => {
    Animated.timing(mountAnim, { toValue: 1, duration: 400, useNativeDriver: !IS_WEB }).start();
    // Auto-trigger biometric on mount if enabled
    if (userSettings?.biometrics_enabled) {
      setTimeout(handleBiometricAuth, 500);
    }
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
    width: 68, height: 68, borderRadius: 34,
    backgroundColor: theme.colors.background,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: theme.colors.border,
    ...(IS_WEB ? {} : { elevation: 1, shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 2, shadowOffset: { width: 0, height: 1 } })
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <Animated.View style={{ flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top, paddingBottom: insets.bottom, opacity: mountAnim }}>

        {/* LOGO - Now using your actual logo image */}
        <Image
          source={logoImg}
          style={{ width: 100, height: 100, borderRadius: 24, marginBottom: 16, resizeMode: 'contain' }}
        />

        <Text style={{ fontSize: 22, fontWeight: 'bold', color: theme.colors.textPrimary, marginBottom: 4 }}>Enter PIN</Text>
        <Text style={{ fontSize: 13, color: theme.colors.textSecondary, marginBottom: 28 }}>Welcome back, {currentUser?.name || 'User'}</Text>

        <View style={{ flexDirection: 'row', gap: 10, marginBottom: 8 }}>
          {Array.from({ length: PIN_LENGTH }).map((_, i) => (
            <PinDot key={i} filled={i < pin.length} error={error} primary={theme.colors.primary} errorColor={theme.colors.error} border={theme.colors.border} />
          ))}
        </View>

        <View style={{ height: 26, marginBottom: 16, justifyContent: 'center' }}>
          {error && <Text style={{ color: theme.colors.error, fontSize: 13, fontWeight: '600' }}>Incorrect PIN</Text>}
        </View>

        {/* KEYPAD - Solid card matching Sign In design */}
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 28, borderWidth: 1, borderColor: theme.colors.border, padding: 24, width: 300, alignItems: 'center' }}>
          <View style={{ width: 40, height: 4, borderRadius: 2, backgroundColor: theme.colors.border, marginBottom: 24 }} />
          <View style={{ width: 240, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 12 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
              <KeypadButton key={num} onPress={() => pin.length < PIN_LENGTH && setPin(p => p + num)} style={keypadButtonStyle}>
                <Text style={{ fontSize: 24, fontWeight: 'bold', color: theme.colors.textPrimary }}>{num}</Text>
              </KeypadButton>
            ))}

            {/* Biometric trigger button (Fingerprint icon) */}
            {!IS_WEB && userSettings?.biometrics_enabled ? (
              <TouchableOpacity onPress={handleBiometricAuth} style={keypadButtonStyle}>
                <MaterialIcons name="fingerprint" size={32} color={theme.colors.primary} />
              </TouchableOpacity>
            ) : (
              <View style={{ width: 68, height: 68 }} />
            )}

            <KeypadButton onPress={() => pin.length < PIN_LENGTH && setPin(p => p + '0')} style={keypadButtonStyle}>
              <Text style={{ fontSize: 24, fontWeight: 'bold', color: theme.colors.textPrimary }}>0</Text>
            </KeypadButton>
            <TouchableOpacity onPress={() => setPin(p => p.slice(0, -1))} style={{ width: 68, height: 68, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="backspace" size={24} color={theme.colors.textSecondary} />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity onPress={() => userCtx.setCurrentUser(null)} style={{ marginTop: 32, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 20, borderWidth: 1, borderColor: theme.colors.border }}>
          <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textSecondary }}>Sign Out</Text>
        </TouchableOpacity>
      </Animated.View>
    </View>
  );
};

export default PinLockScreen;
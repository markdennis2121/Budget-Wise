import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, Platform, Vibration, Animated, StyleSheet } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { useQuery, useMutation } from 'platform-hooks';
import { NativeBiometric } from 'capacitor-native-biometric';

// Capacitor haptics — gracefully falls back when not available
var tryHaptic = async function (style) {
  try {
    var { Haptics, ImpactStyle } = await import('@capacitor/haptics');
    if (style === 'success') {
      await Haptics.notification({ type: 'SUCCESS' });
    } else if (style === 'error') {
      await Haptics.notification({ type: 'ERROR' });
    } else {
      await Haptics.impact({ style: ImpactStyle.Light });
    }
  } catch (_) {}
};

const PIN_LENGTH = 6;

// ─────────────────────────────────────────────
// Animated PIN dot
// ─────────────────────────────────────────────
var PinDot = function (props) {
  var filled = props.filled;
  var error = props.error;
  var primary = props.primary;
  var errorColor = props.errorColor;
  var border = props.border;

  var scaleAnim = useRef(new Animated.Value(1)).current;
  var opacityAnim = useRef(new Animated.Value(filled ? 1 : 0)).current;

  // Pop animation when a digit is entered
  useEffect(function () {
    if (filled) {
      Animated.sequence([
        Animated.spring(scaleAnim, { toValue: 1.35, useNativeDriver: true, speed: 50, bounciness: 12 }),
        Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50, bounciness: 8 }),
      ]).start();
      Animated.timing(opacityAnim, { toValue: 1, duration: 80, useNativeDriver: true }).start();
    } else {
      Animated.timing(opacityAnim, { toValue: 0, duration: 120, useNativeDriver: true }).start();
      Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 50 }).start();
    }
  }, [filled]);

  // Error shake
  var shakeAnim = useRef(new Animated.Value(0)).current;
  useEffect(function () {
    if (error) {
      Animated.sequence([
        Animated.timing(shakeAnim, { toValue: 6, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -6, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 4, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: -4, duration: 60, useNativeDriver: true }),
        Animated.timing(shakeAnim, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]).start();
    }
  }, [error]);

  var dotColor = error ? errorColor : primary;

  return (
    <Animated.View
      style={{
        transform: [{ scale: scaleAnim }, { translateX: shakeAnim }],
        width: 16,
        height: 16,
        borderRadius: 8,
        marginHorizontal: 6,
        borderWidth: 2,
        borderColor: error ? errorColor : (filled ? primary : border),
        overflow: 'hidden',
      }}
    >
      <Animated.View
        style={{
          ...StyleSheet.absoluteFillObject,
          borderRadius: 6,
          backgroundColor: dotColor,
          opacity: opacityAnim,
        }}
      />
    </Animated.View>
  );
};

// ─────────────────────────────────────────────
// Keypad button with press animation
// ─────────────────────────────────────────────
var KeypadButton = function (props) {
  var onPress = props.onPress;
  var children = props.children;
  var glassStyle = props.glassStyle;

  var scaleAnim = useRef(new Animated.Value(1)).current;

  var handlePressIn = function () {
    Animated.spring(scaleAnim, { toValue: 0.88, useNativeDriver: true, speed: 60, bounciness: 10 }).start();
    tryHaptic('light');
  };
  var handlePressOut = function () {
    Animated.spring(scaleAnim, { toValue: 1, useNativeDriver: true, speed: 40, bounciness: 14 }).start();
  };

  return (
    <TouchableOpacity
      onPress={onPress}
      onPressIn={handlePressIn}
      onPressOut={handlePressOut}
      activeOpacity={1}
    >
      <Animated.View style={[glassStyle, { transform: [{ scale: scaleAnim }] }]}>
        {children}
      </Animated.View>
    </TouchableOpacity>
  );
};

// ─────────────────────────────────────────────
// Main screen
// ─────────────────────────────────────────────
var PinLockScreen = function (props) {
  var onUnlock = props.onUnlock;
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var isDark = theme.isDark;
  var userCtx = useUser();
  var currentUser = userCtx.currentUser;
  var insets = useSafeAreaInsets();

  var settingsQuery = useQuery('user_settings');
  var allSettings = settingsQuery.data || [];
  var userSettings = allSettings.find(function (s) { return s.user_id === (currentUser ? currentUser.id : ''); });
  var refetch = settingsQuery.refetch;

  var updateSettings = useMutation('user_settings', 'update');
  var mutateUpdate = updateSettings.mutate;

  var [pin, setPin] = useState('');
  var [error, setError] = useState(false);

  // Subtle fade-in on mount
  var mountAnim = useRef(new Animated.Value(0)).current;
  var slideAnim = useRef(new Animated.Value(40)).current;
  useEffect(function () {
    Animated.parallel([
      Animated.timing(mountAnim, { toValue: 1, duration: 520, useNativeDriver: true }),
      Animated.spring(slideAnim, { toValue: 0, useNativeDriver: true, speed: 14, bounciness: 8 }),
    ]).start();
  }, []);

  var triggerBiometrics = async function () {
    try {
      var availableRes = await NativeBiometric.isAvailable();
      if (availableRes.isAvailable) {
        await NativeBiometric.verifyIdentity({
          reason: 'Unlock Penny to access your budget',
          title: 'Biometric Unlock',
          subtitle: 'Use fingerprint or Face ID',
        });
        await tryHaptic('success');
        onUnlock();
      }
    } catch (e) {
      console.log('Biometrics not available or failed', e);
    }
  };

  useEffect(function () {
    if (userSettings && userSettings.pin_code && userSettings.pin_code.length !== PIN_LENGTH) {
      mutateUpdate({ id: userSettings.id, data: { pin_code: null, biometrics_enabled: false } }).then(function () {
        refetch();
        onUnlock();
      });
    }
  }, [userSettings]);

  useEffect(function () {
    if (userSettings && userSettings.biometrics_enabled) {
      var timer = setTimeout(triggerBiometrics, 300);
      return function () { clearTimeout(timer); };
    }
  }, [userSettings]);

  useEffect(function () {
    if (pin.length === PIN_LENGTH) {
      if (userSettings && userSettings.pin_code === pin) {
        tryHaptic('success');
        onUnlock();
      } else {
        setError(true);
        tryHaptic('error');
        if (Platform.OS !== 'web') Vibration.vibrate(300);
        setTimeout(function () {
          setPin('');
          setError(false);
        }, 600);
      }
    }
  }, [pin, userSettings, onUnlock]);

  var handlePress = function (num) {
    if (pin.length < PIN_LENGTH) {
      setPin(function (prev) { return prev + num; });
      setError(false);
    }
  };

  var handleBackspace = function () {
    setPin(function (prev) { return prev.slice(0, -1); });
    setError(false);
  };

  var handleLogout = function () {
    userCtx.setCurrentUser(null);
  };

  // ─── Gradient colours ───
  // Light: soft green→teal gradient behind a white-tinted keypad card
  // Dark: deep navy→dark teal gradient
  var gradientColors = isDark
    ? ['#0B1120', '#0D2137', '#0B2A2A']
    : ['#E8F5F0', '#D1F0E5', '#C7EDE4'];

  var primary = theme.colors.primary;  // e.g. #10B981
  var primaryDark = theme.colors.accent; // e.g. #059669

  // Glass card colours
  var glassBackground = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(255,255,255,0.72)';
  var glassBorder = isDark ? 'rgba(255,255,255,0.10)' : 'rgba(255,255,255,0.90)';
  var buttonBackground = isDark ? 'rgba(255,255,255,0.08)' : 'rgba(255,255,255,0.75)';
  var buttonBorder = isDark ? 'rgba(255,255,255,0.12)' : 'rgba(16,185,129,0.18)';
  var textColor = isDark ? '#F9FAFB' : '#111827';
  var subtextColor = isDark ? '#9CA3AF' : '#6B7280';

  var glassButtonStyle = {
    width: 80,
    height: 80,
    borderRadius: 40,
    backgroundColor: buttonBackground,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1.5,
    borderColor: buttonBorder,
    shadowColor: primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.12,
    shadowRadius: 8,
    elevation: 3,
  };

  return (
    <LinearGradient
      colors={gradientColors}
      start={{ x: 0.1, y: 0 }}
      end={{ x: 0.9, y: 1 }}
      style={{ flex: 1 }}
    >
      <Animated.View
        style={{
          flex: 1,
          alignItems: 'center',
          justifyContent: 'center',
          paddingTop: insets.top + 20,
          paddingBottom: insets.bottom + 20,
          opacity: mountAnim,
          transform: [{ translateY: slideAnim }],
        }}
      >
        {/* Lock icon badge */}
        <LinearGradient
          colors={[primary, primaryDark]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={{
            width: 84,
            height: 84,
            borderRadius: 28,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 20,
            shadowColor: primary,
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: 0.35,
            shadowRadius: 16,
            elevation: 8,
          }}
        >
          <MaterialIcons name="lock" size={38} color="#FFFFFF" />
        </LinearGradient>

        {/* Title */}
        <Text style={{ fontSize: 26, fontWeight: '800', color: textColor, letterSpacing: 0.4, marginBottom: 6 }}>
          Enter PIN
        </Text>
        <Text style={{ fontSize: 14, color: subtextColor, marginBottom: 36, letterSpacing: 0.2 }}>
          Welcome back, {currentUser ? currentUser.name : ''}
        </Text>

        {/* PIN dots */}
        <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
          {Array.from({ length: PIN_LENGTH }).map(function (_, i) {
            return (
              <PinDot
                key={i}
                filled={i < pin.length}
                error={error}
                primary={primary}
                errorColor={theme.colors.error}
                border={isDark ? 'rgba(255,255,255,0.25)' : 'rgba(0,0,0,0.18)'}
              />
            );
          })}
        </View>

        {/* Error label */}
        <View style={{ height: 24, marginBottom: 24, alignItems: 'center', justifyContent: 'center' }}>
          {error && (
            <Text style={{ color: theme.colors.error, fontSize: 13, fontWeight: '700', letterSpacing: 0.3 }}>
              Incorrect PIN — try again
            </Text>
          )}
        </View>

        {/* Glass keypad card */}
        <View
          style={{
            backgroundColor: glassBackground,
            borderRadius: 28,
            borderWidth: 1.5,
            borderColor: glassBorder,
            padding: 24,
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 8 },
            shadowOpacity: isDark ? 0.4 : 0.08,
            shadowRadius: 24,
            elevation: 10,
          }}
        >
          <View style={{ width: 280, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', rowGap: 14, columnGap: 0 }}>
            {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(function (num) {
              return (
                <KeypadButton key={num} onPress={function () { handlePress(num.toString()); }} glassStyle={glassButtonStyle}>
                  <Text style={{ fontSize: 28, fontWeight: '700', color: textColor }}>{num}</Text>
                </KeypadButton>
              );
            })}

            {/* Biometric or empty slot */}
            {userSettings && userSettings.biometrics_enabled ? (
              <KeypadButton onPress={triggerBiometrics} glassStyle={glassButtonStyle}>
                <MaterialIcons name="fingerprint" size={36} color={primary} />
              </KeypadButton>
            ) : (
              <View style={{ width: 80, height: 80 }} />
            )}

            {/* Zero */}
            <KeypadButton onPress={function () { handlePress('0'); }} glassStyle={glassButtonStyle}>
              <Text style={{ fontSize: 28, fontWeight: '700', color: textColor }}>0</Text>
            </KeypadButton>

            {/* Backspace */}
            <KeypadButton onPress={handleBackspace} glassStyle={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center' }}>
              <MaterialIcons name="backspace" size={26} color={subtextColor} />
            </KeypadButton>
          </View>
        </View>

        {/* Sign out */}
        <TouchableOpacity
          onPress={handleLogout}
          style={{ marginTop: 32, paddingVertical: 10, paddingHorizontal: 24, borderRadius: 20, borderWidth: 1, borderColor: isDark ? 'rgba(255,255,255,0.12)' : 'rgba(0,0,0,0.08)' }}
          activeOpacity={0.7}
        >
          <Text style={{ fontSize: 14, fontWeight: '600', color: subtextColor, letterSpacing: 0.2 }}>
            Sign Out
          </Text>
        </TouchableOpacity>
      </Animated.View>
    </LinearGradient>
  );
};

export default PinLockScreen;

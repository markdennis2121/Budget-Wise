import React, { useEffect, useRef } from 'react';
import { View, Text, Animated } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

const SaveSuccessOverlay = function ({ visible, message, theme }) {
  var scale = useRef(new Animated.Value(0)).current;
  var ringScale = useRef(new Animated.Value(0.6)).current;
  var opacity = useRef(new Animated.Value(0)).current;

  useEffect(function () {
    if (!visible) return;
    scale.setValue(0);
    ringScale.setValue(0.6);
    opacity.setValue(0);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.spring(scale, { toValue: 1, friction: 5, tension: 140, useNativeDriver: true }),
      Animated.spring(ringScale, { toValue: 1, friction: 6, tension: 100, useNativeDriver: true })
    ]).start();
  }, [visible, scale, ringScale, opacity]);

  if (!visible) return null;

  var primary = (theme && theme.colors && theme.colors.primary) || '#0F766E';
  var label = message || 'Saved!';

  return (
    <View
      style={{
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0,0,0,0.42)',
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 9999,
        elevation: 9999
      }}
    >
      <Animated.View style={{ opacity, alignItems: 'center', transform: [{ scale: ringScale }] }}>
        <View
          style={{
            width: 80,
            height: 80,
            borderRadius: 40,
            backgroundColor: primary,
            alignItems: 'center',
            justifyContent: 'center',
            marginBottom: 14,
            shadowColor: primary,
            shadowOffset: { width: 0, height: 6 },
            shadowOpacity: 0.35,
            shadowRadius: 12,
            elevation: 8
          }}
        >
          <Animated.View style={{ transform: [{ scale }] }}>
            <MaterialIcons name="check" size={44} color="#FFFFFF" />
          </Animated.View>
        </View>
        <Text style={{ color: '#FFFFFF', fontSize: 17, fontWeight: 'bold', letterSpacing: 0.3 }}>{label}</Text>
      </Animated.View>
    </View>
  );
};

export default SaveSuccessOverlay;

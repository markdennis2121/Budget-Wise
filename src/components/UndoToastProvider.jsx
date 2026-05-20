import React, { useState, useEffect, useRef, useCallback } from 'react';
import { View, Text, TouchableOpacity, Animated, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../contexts/ThemeContext';
import {
  registerUndoToastHandler,
  unregisterUndoToastHandler,
  UNDO_TOAST_MS
} from '../utils/feedback';

const TAB_MENU_HEIGHT = Platform.OS === 'web' ? 56 : 49;

const UndoToastProvider = function ({ children }) {
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var insets = useSafeAreaInsets();
  var [toast, setToast] = useState(null);
  var timerRef = useRef(null);
  var slide = useRef(new Animated.Value(120)).current;

  var dismiss = useCallback(function () {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    Animated.timing(slide, {
      toValue: 120,
      duration: 200,
      useNativeDriver: true
    }).start(function () {
      setToast(null);
    });
  }, [slide]);

  var showToast = useCallback(function (opts) {
    opts = opts || {};
    if (timerRef.current) clearTimeout(timerRef.current);
    setToast({
      message: opts.message || 'Saved',
      onUndo: opts.onUndo
    });
    slide.setValue(120);
    Animated.spring(slide, {
      toValue: 0,
      friction: 8,
      tension: 80,
      useNativeDriver: true
    }).start();
    timerRef.current = setTimeout(dismiss, opts.duration || UNDO_TOAST_MS);
  }, [dismiss, slide]);

  useEffect(function () {
    registerUndoToastHandler(showToast);
    return function () {
      unregisterUndoToastHandler();
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [showToast]);

  var handleUndo = function () {
    if (toast && typeof toast.onUndo === 'function') {
      var promise = toast.onUndo();
      if (promise && typeof promise.then === 'function') {
        promise.catch(function () {});
      }
    }
    dismiss();
  };

  var bottom = Platform.OS === 'web' ? 90 : TAB_MENU_HEIGHT + insets.bottom + 12;

  return (
    <View style={{ flex: 1 }}>
      {children}
      {toast ? (
        <Animated.View
          pointerEvents="box-none"
          style={{
            position: 'absolute',
            left: 16,
            right: 16,
            bottom: bottom,
            transform: [{ translateY: slide }],
            zIndex: 10000,
            elevation: 10000
          }}
        >
          <View
            style={{
              backgroundColor: theme.colors.card,
              borderRadius: 14,
              paddingVertical: 14,
              paddingHorizontal: 16,
              flexDirection: 'row',
              alignItems: 'center',
              borderWidth: 1,
              borderColor: theme.colors.border,
              shadowColor: '#000',
              shadowOffset: { width: 0, height: 4 },
              shadowOpacity: 0.15,
              shadowRadius: 10,
              elevation: 8
            }}
          >
            <MaterialIcons name="check-circle" size={22} color={theme.colors.primary} style={{ marginRight: 10 }} />
            <Text style={{ flex: 1, fontSize: 14, fontWeight: '600', color: theme.colors.textPrimary }} numberOfLines={2}>
              {toast.message}
            </Text>
            <TouchableOpacity
              onPress={handleUndo}
              style={{
                marginLeft: 10,
                paddingVertical: 8,
                paddingHorizontal: 14,
                backgroundColor: theme.isDark ? 'rgba(255,255,255,0.08)' : '#FFEDD5',
                borderRadius: 8,
                minHeight: 40,
                justifyContent: 'center'
              }}
            >
              <Text style={{ color: theme.colors.primary, fontWeight: 'bold', fontSize: 14 }}>Undo</Text>
            </TouchableOpacity>
          </View>
        </Animated.View>
      ) : null}
    </View>
  );
};

export default UndoToastProvider;

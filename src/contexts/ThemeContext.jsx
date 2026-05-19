import React, { createContext, useState, useMemo, useContext, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

const lightTheme = {
  colors: {
    primary: '#10B981',
    accent: '#059669',
    background: '#FFFFFF',
    card: '#F9FAFB',
    textPrimary: '#111827',
    textSecondary: '#6B7280',
    border: '#E5E7EB',
    success: '#22C55E',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#10B981',
    inputBg: '#FFFFFF'
  },
  isDark: false
};

const darkTheme = {
  colors: {
    primary: '#10B981',
    accent: '#059669',
    background: '#0B0F19',
    card: '#1F2937',
    textPrimary: '#F9FAFB',
    textSecondary: '#9CA3AF',
    border: '#374151',
    success: '#22C55E',
    error: '#EF4444',
    warning: '#FBBF24',
    info: '#10B981',
    inputBg: '#111827'
  },
  isDark: true
};

const ThemeContext = createContext({
  theme: lightTheme,
  toggleTheme: function() {},
  setTheme: function(isDark) {}
});

export const primaryColor = lightTheme.colors.primary;
export const accentColor = lightTheme.colors.accent;
export const backgroundColor = lightTheme.colors.background;
export const cardColor = lightTheme.colors.card;
export const textPrimary = lightTheme.colors.textPrimary;
export const textSecondary = lightTheme.colors.textSecondary;
export const dangerColor = lightTheme.colors.error;
export const warningColor = lightTheme.colors.warning;
export const infoColor = lightTheme.colors.info;

export const ThemeProvider = function(props) {
  var [isDark, setIsDark] = useState(false);

  useEffect(() => {
    try {
      var saved = localStorage.getItem('budget_wise_theme');
      if (saved === 'dark') setIsDark(true);
    } catch (e) {}
  }, []);

  var toggleTheme = useCallback(() => {
    setIsDark(prev => {
      var next = !prev;
      try { localStorage.setItem('budget_wise_theme', next ? 'dark' : 'light'); } catch (e) {}
      return next;
    });
  }, []);

  var setTheme = useCallback((dark) => {
    setIsDark(dark);
    try { localStorage.setItem('budget_wise_theme', dark ? 'dark' : 'light'); } catch (e) {}
  }, []);

  var theme = useMemo(() => isDark ? darkTheme : lightTheme, [isDark]);
  var value = useMemo(() => ({ theme, toggleTheme, setTheme }), [theme, toggleTheme, setTheme]);

  return React.createElement(ThemeContext.Provider, { testID: 'Provider-2', value: value }, props.children);
};

export const useTheme = function() { return useContext(ThemeContext); };

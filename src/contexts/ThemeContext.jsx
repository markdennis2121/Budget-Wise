import React, { createContext, useState, useMemo, useContext, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

const lightTheme = {
  colors: {
    primary: '#F97316',
    accent: '#FB923C',
    background: '#FFF7ED',
    card: '#FFFFFF',
    textPrimary: '#1E293B',
    textSecondary: '#64748B',
    border: '#FED7AA',
    success: '#10B981',
    error: '#EF4444',
    warning: '#F59E0B',
    info: '#F97316',
    inputBg: '#FAFAFA'
  },
  isDark: false
};

const darkTheme = {
  colors: {
    primary: '#F97316',
    accent: '#EA580C',
    background: '#0F172A',
    card: '#1E293B',
    textPrimary: '#F8FAFC',
    textSecondary: '#94A3B8',
    border: '#334155',
    success: '#10B981',
    error: '#F87171',
    warning: '#FBBF24',
    info: '#F97316',
    inputBg: '#0F172A'
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

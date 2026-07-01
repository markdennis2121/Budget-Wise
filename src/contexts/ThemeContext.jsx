import React, { createContext, useState, useMemo, useContext, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';
import { normalize } from '../utils/responsive';

const typography = {
  h1: { fontSize: normalize(32), fontWeight: '900', letterSpacing: -1 },
  h2: { fontSize: normalize(24), fontWeight: 'bold', letterSpacing: -0.5 },
  h3: { fontSize: normalize(20), fontWeight: 'bold' },
  subtitle: { fontSize: normalize(16), fontWeight: '600' },
  body: { fontSize: normalize(14), fontWeight: 'normal' },
  bodyMedium: { fontSize: normalize(14), fontWeight: '600' },
  bodySmall: { fontSize: normalize(12), fontWeight: 'normal' },
  caption: { fontSize: normalize(10), fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' }
};

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
  typography,
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
  typography,
  isDark: true
};

const THEME_MAP = {
  // Standard Themes
  '#10B981': { background: '#0B0F19', card: '#1F2937', border: '#374151' }, // Penny Classic
  '#2563EB': { background: '#0F172A', card: '#1E293B', border: '#334155' }, // Corporate Blue
  '#059669': { background: '#061613', card: '#0D2622', border: '#16423C' }, // Forest Green
  '#111827': { background: '#000000', card: '#1A202C', border: '#2D3748' }, // Stealth Black (Improved Card Contrast)

  // Premium Themes
  '#D97706': { background: '#1A1614', card: '#261F1D', border: '#3D302C' }, // Copper Penny
  '#EAB308': { background: '#0F172A', card: '#1E293B', border: '#334155' }, // Midnight Royal
  '#2DD4BF': { background: '#020D0C', card: '#051A18', border: '#0A3330' }, // Cyber Mint
  '#FB7185': { background: '#1C1012', card: '#2D181B', border: '#452226' }, // Rose Gold
  '#8B5CF6': { background: '#12101C', card: '#1C182E', border: '#2D264A' }, // Lavender Dream
  '#D4A373': { background: '#171412', card: '#241F1C', border: '#382F2A' }, // Latte Neutral

  // Gradients (Using the first color as key)
  '#FF512F': { background: '#1A0D08', card: '#2A140D', border: '#451F14' }, // Sunset Blend
  '#8E2DE2': { background: '#0D081A', card: '#150D2A', border: '#231445' }, // Cosmic Purple
  '#11998E': { background: '#081A18', card: '#0D2A27', border: '#144541' }, // Mint Glow
};

const ThemeContext = createContext({
  theme: lightTheme,
  toggleTheme: function() {},
  setTheme: function(isDark) {},
  setPrimaryColor: function(color) {}
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

/**
 * Safe cross-platform storage wrapper.
 * Uses localStorage on web, in-memory fallback on native (where localStorage is unavailable).
 * This prevents silent failures and theme/color resets on native builds.
 */
const memoryStore = {};
const safeStorage = {
  getItem: function(key) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        return localStorage.getItem(key);
      }
    } catch(e) {}
    return memoryStore[key] !== undefined ? memoryStore[key] : null;
  },
  setItem: function(key, value) {
    try {
      if (typeof localStorage !== 'undefined' && localStorage) {
        localStorage.setItem(key, value);
        return;
      }
    } catch(e) {}
    memoryStore[key] = value;
  }
};

export const ThemeProvider = function(props) {
  var [isDark, setIsDark] = useState(false);
  var [customPrimary, setCustomPrimary] = useState('#10B981');

  useEffect(() => {
    try {
      var savedTheme = safeStorage.getItem('budget_wise_theme');
      if (savedTheme === 'dark') setIsDark(true);

      var savedColor = safeStorage.getItem('budget_wise_color');
      if (savedColor) {
        if (savedColor.startsWith('[')) setCustomPrimary(JSON.parse(savedColor));
        else setCustomPrimary(savedColor);
      }
    } catch (e) {}
  }, []);

  var toggleTheme = useCallback(() => {
    setIsDark(prev => {
      var next = !prev;
      try { safeStorage.setItem('budget_wise_theme', next ? 'dark' : 'light'); } catch (e) {}
      return next;
    });
  }, []);

  var setTheme = useCallback((dark) => {
    setIsDark(dark);
    try { safeStorage.setItem('budget_wise_theme', dark ? 'dark' : 'light'); } catch (e) {}
  }, []);

  var setPrimaryColor = useCallback((color) => {
    setCustomPrimary(color);
    try { safeStorage.setItem('budget_wise_color', Array.isArray(color) ? JSON.stringify(color) : color); } catch (e) {}
  }, []);

  var theme = useMemo(() => {
    var baseTheme = isDark ? darkTheme : lightTheme;
    var primaryStr = Array.isArray(customPrimary) ? customPrimary[0] : customPrimary;
    var gradientArr = Array.isArray(customPrimary) ? customPrimary : [customPrimary, customPrimary];

    var themedColors = {};
    if (isDark && THEME_MAP[primaryStr]) {
      themedColors = THEME_MAP[primaryStr];
    }

    return {
      ...baseTheme,
      colors: {
        ...baseTheme.colors,
        ...themedColors,
        primary: primaryStr,
        primaryGradient: gradientArr,
        info: primaryStr
      }
    };
  }, [isDark, customPrimary]);

  var value = useMemo(() => ({ theme, toggleTheme, setTheme, setPrimaryColor, isDark }), [theme, toggleTheme, setTheme, setPrimaryColor, isDark]);

  return React.createElement(ThemeContext.Provider, { testID: 'Provider-2', value: value }, props.children);
};


export const useTheme = function() { return useContext(ThemeContext); };

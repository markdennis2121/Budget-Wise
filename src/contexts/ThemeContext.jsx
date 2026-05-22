import React, { createContext, useState, useMemo, useContext, useEffect, useCallback } from 'react';
import { Platform } from 'react-native';

const typography = {
  h1: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  h2: { fontSize: 24, fontWeight: 'bold', letterSpacing: -0.5 },
  h3: { fontSize: 20, fontWeight: 'bold' },
  subtitle: { fontSize: 16, fontWeight: '600' },
  body: { fontSize: 14, fontWeight: 'normal' },
  bodyMedium: { fontSize: 14, fontWeight: '600' },
  bodySmall: { fontSize: 12, fontWeight: 'normal' },
  caption: { fontSize: 10, fontWeight: '600', letterSpacing: 0.5, textTransform: 'uppercase' }
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
  '#D97706': { background: '#1A1614', card: '#261F1D', border: '#3D302C' }, // Classic Penny
  '#EAB308': { background: '#0F172A', card: '#1E293B', border: '#334155' }, // Midnight Royal
  '#2DD4BF': { background: '#000000', card: '#121212', border: '#262626' }, // Cyber Mint
  '#059669': { background: '#061613', card: '#0D2622', border: '#16423C' }  // Forest Serenity
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

  export const ThemeProvider = function(props) {
    var [isDark, setIsDark] = useState(false);
    var [customPrimary, setCustomPrimary] = useState('#10B981');
  
    useEffect(() => {
      try {
        var savedTheme = localStorage.getItem('budget_wise_theme');
        if (savedTheme === 'dark') setIsDark(true);
        
        var savedColor = localStorage.getItem('budget_wise_color');
        if (savedColor) {
          if (savedColor.startsWith('[')) setCustomPrimary(JSON.parse(savedColor));
          else setCustomPrimary(savedColor);
        }
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
  
    var setPrimaryColor = useCallback((color) => {
      setCustomPrimary(color);
      try { localStorage.setItem('budget_wise_color', Array.isArray(color) ? JSON.stringify(color) : color); } catch (e) {}
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
    
    var value = useMemo(() => ({ theme, toggleTheme, setTheme, setPrimaryColor }), [theme, toggleTheme, setTheme, setPrimaryColor]);
  
    return React.createElement(ThemeContext.Provider, { testID: 'Provider-2', value: value }, props.children);
  };

export const useTheme = function() { return useContext(ThemeContext); };

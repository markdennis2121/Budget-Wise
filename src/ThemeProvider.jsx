import React, { createContext, useMemo } from 'react';

export const ThemeContext = createContext({});

export const ThemeProvider = ({ children }) => {
  const theme = useMemo(() => ({
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
    },
  }), []);

  return (
    <ThemeContext.Provider value={{ theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

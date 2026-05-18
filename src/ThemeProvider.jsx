import React, { createContext, useMemo } from 'react';

export const ThemeContext = createContext({});

export const ThemeProvider = ({ children }) => {
  const theme = useMemo(() => ({
    colors: {
      primary: '#059669',
      accent: '#10B981',
      background: '#F0FDF4',
      card: '#FFFFFF',
      textPrimary: '#111827',
      textSecondary: '#6B7280',
      border: '#D1FAE5',
      success: '#059669',
      error: '#EF4444',
      warning: '#F59E0B',
      info: '#3B82F6',
    },
  }), []);

  return (
    <ThemeContext.Provider value={{ theme }}>
      {children}
    </ThemeContext.Provider>
  );
};

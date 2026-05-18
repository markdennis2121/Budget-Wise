import React, { createContext, useMemo } from 'react';

export const ThemeContext = createContext({});

export const ThemeProvider = ({ children }) => {
  const theme = useMemo(() => ({
    colors: {
      primary: '#F97316',
      accent: '#10B981',
      background: '#FFF7ED',
      card: '#FFFFFF',
      textPrimary: '#111827',
      textSecondary: '#6B7280',
      border: '#FED7AA',
      success: '#F97316',
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

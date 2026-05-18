import React, { useMemo } from 'react';
import { View, Text, StatusBar } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { UserProvider } from './contexts/UserContext';
import { ThemeProvider, primaryColor } from './contexts/ThemeContext';
import { formatDate } from './utils/helpers';
import MainNavigator from './navigation/MainNavigator';

const EXPIRATION_DATE = '2026-05-25';

const TrialExpiredScreen = function() {
  return React.createElement(View, {
    style: { flex: 1, backgroundColor: '#FFF7ED', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 24 }
  },
    React.createElement(View, {
      style: { backgroundColor: '#FFFFFF', borderRadius: 20, padding: 32, alignItems: 'center', width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.08, shadowRadius: 12, elevation: 4 }
    },
      React.createElement(View, {
        style: { width: 80, height: 80, borderRadius: 40, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginBottom: 20 }
      },
        React.createElement(MaterialIcons, { name: 'lock-clock', size: 42, color: '#EF4444' })
      ),
      React.createElement(Text, {
        style: { fontSize: 22, fontWeight: 'bold', color: '#111827', textAlign: 'center', marginBottom: 12 }
      }, 'Beta Trial Expired'),
      React.createElement(Text, {
        style: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22 }
      }, 'Thank you for testing the Personal Budget Tracker app! This beta testing build expired on ' + formatDate(EXPIRATION_DATE) + '. Please contact the developer for a newer version or standard update.')
    )
  );
};

const ComponentFunction = function() {
  var isExpired = useMemo(function() {
    var exp = new Date(EXPIRATION_DATE);
    var now = new Date();
    return now.getTime() > exp.getTime();
  }, []);

  return React.createElement(UserProvider, { testID: 'UserProvider-1' },
    React.createElement(ThemeProvider, { testID: 'ThemeProvider-1' },
      React.createElement(SafeAreaProvider, { style: { flex: 1 } },
        React.createElement(View, { testID: 'View-88', style: { flex: 1, width: '100%', height: '100%' } },
          React.createElement(StatusBar, { testID: 'StatusBar-1', barStyle: 'light-content', backgroundColor: primaryColor }),
          isExpired ? React.createElement(TrialExpiredScreen) : React.createElement(NavigationContainer, {}, React.createElement(MainNavigator))
        )
      )
    )
  );
};

export default ComponentFunction;

import React, { useMemo, useState, useEffect, useRef } from 'react';
import { View, Text, StatusBar, ScrollView, TouchableOpacity, AppState, Platform, useWindowDimensions } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { NavigationContainer } from '@react-navigation/native';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { UserProvider, useUser } from './contexts/UserContext';
import { ThemeProvider, primaryColor } from './contexts/ThemeContext';
import { formatDate } from './utils/helpers';
import { useQuery } from 'platform-hooks';
import MainNavigator from './navigation/MainNavigator';
import PinLockScreen from './screens/PinLockScreen';
import { scheduleDailyReminder } from './utils/notifications';
import { BETA_EXPIRATION_DATE, isTrialExpired } from './utils/trial';
import UndoToastProvider from './components/UndoToastProvider';
import { useTheme } from './contexts/ThemeContext';

const ThemeAwareStatusBar = function() {
  var themeCtx = useTheme();
  var isDark = themeCtx.theme.isDark;
  return React.createElement(StatusBar, {
    testID: 'StatusBar-1',
    barStyle: isDark ? 'light-content' : 'dark-content',
    backgroundColor: 'transparent',
    translucent: true
  });
};

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
      }, 'Beta Build Expired'),
      React.createElement(Text, {
        style: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 22 }
      }, 'This beta version of Budget-Wise expired on ' + formatDate(BETA_EXPIRATION_DATE) + '. To continue tracking your finances, please contact the developer for the official release build or a new beta key.')
    )
  );
};

const AppContent = function() {
  var userCtx = useUser();
  var currentUser = userCtx.currentUser;
  
  var settingsQuery = useQuery('user_settings');
  var allSettings = settingsQuery.data || [];
  var userSettings = allSettings.find(function(s) { return s.user_id === (currentUser ? currentUser.id : ''); });

  var [isLocked, setIsLocked] = useState(true);
  var [isInitialLoad, setIsInitialLoad] = useState(true);
  var prevUser = useRef(currentUser);

  // Re-lock the app when it is moved to the background
  useEffect(() => {
    const subscription = AppState.addEventListener('change', (nextAppState) => {
      if (nextAppState === 'background' || nextAppState === 'inactive') {
        setIsLocked(true);
      }
    });

    return () => {
      subscription.remove();
    };
  }, []);

  // Handle Loading and Initial Lock State
  useEffect(() => {
    if (!settingsQuery.loading) {
      // Small delay to ensure UI doesn't flicker
      setTimeout(() => setIsInitialLoad(false), 300);
    }
  }, [settingsQuery.loading]);

  // When current user changes, handle lock/unlock transition
  useEffect(() => {
    if (!currentUser) {
      setIsLocked(true);
    } else if (!prevUser.current && currentUser) {
      // User just successfully logged in from null (the Login Screen), so unlock automatically
      setIsLocked(false);
    }
    prevUser.current = currentUser;
  }, [currentUser]);

  if (isInitialLoad && currentUser) {
    return React.createElement(View, { style: { flex: 1, backgroundColor: '#FFFFFF', alignItems: 'center', justifyContent: 'center' } },
      React.createElement(View, { style: { width: 100, height: 100, borderRadius: 50, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' } },
        React.createElement(MaterialIcons, { name: "lock-outline", size: 40, color: "#9CA3AF" })
      )
    );
  }

  var hasPin = userSettings && userSettings.pin_code;

  if (currentUser && hasPin && isLocked) {
    return React.createElement(PinLockScreen, {
      onUnlock: () => setIsLocked(false),
      userSettings: userSettings
    });
  }

  return React.createElement(UndoToastProvider, {},
    React.createElement(NavigationContainer, {}, React.createElement(MainNavigator))
  );
};

const TermsAndConditionsScreen = function(props) {
  var onAccept = props.onAccept;
  var [checked, setChecked] = useState(false);

  return React.createElement(View, {
    style: { flex: 1, backgroundColor: '#FFEDD5', justifyContent: 'center', alignItems: 'center', paddingHorizontal: 20, paddingTop: 40, paddingBottom: 20 }
  },
    React.createElement(View, {
      style: { backgroundColor: '#FFFFFF', borderRadius: 24, padding: 24, flex: 1, width: '100%', shadowColor: '#000', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.1, shadowRadius: 12, elevation: 5, justifyContent: 'space-between' }
    },
      React.createElement(View, { style: { alignItems: 'center', marginBottom: 16 } },
        React.createElement(View, {
          style: { width: 56, height: 56, borderRadius: 28, backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center', marginBottom: 12 }
        },
          React.createElement(MaterialIcons, { name: 'gavel', size: 28, color: primaryColor })
        ),
        React.createElement(Text, {
          style: { fontSize: 20, fontWeight: 'bold', color: '#111827' }
        }, 'Welcome to Budget-Wise ₱!'),
        React.createElement(Text, {
          style: { fontSize: 13, color: '#6B7280', marginTop: 4 }
        }, 'Please agree to our terms to get started')
      ),

      React.createElement(ScrollView, {
        style: { flex: 1, borderWidth: 1, borderColor: '#FED7AA', borderRadius: 12, padding: 14, backgroundColor: '#FFFDFB', marginBottom: 16 }
      },
        React.createElement(Text, { style: { fontSize: 14, fontWeight: 'bold', color: '#111827', marginBottom: 8 } }, '1. Local Data Privacy'),
        React.createElement(Text, { style: { fontSize: 13, color: '#4B5563', lineHeight: 18, marginBottom: 16 } }, 'Budget-Wise stores all your budgeting data, income sources, accounts, and transactions locally on your device. We do not upload, track, or share your financial data with any remote servers. Your data is entirely yours and remains strictly private.'),
        
        React.createElement(Text, { style: { fontSize: 14, fontWeight: 'bold', color: '#111827', marginBottom: 8 } }, '2. Native Security'),
        React.createElement(Text, { style: { fontSize: 13, color: '#4B5563', lineHeight: 18, marginBottom: 16 } }, 'If you enable the PIN lock or Biometric lock, your fingerprint or Face ID is verified directly by your phone\'s local hardware using native OS-level prompts. Budget-Wise never accesses or stores your actual biometric print details.'),
        
        React.createElement(Text, { style: { fontSize: 14, fontWeight: 'bold', color: '#111827', marginBottom: 8 } }, '3. Permission and Notifications'),
        React.createElement(Text, { style: { fontSize: 13, color: '#4B5563', lineHeight: 18, marginBottom: 16 } }, 'Budget-Wise requests Local Notification permissions to schedule daily reminder prompts and alerts for upcoming bills. These alerts are handled locally by your device\'s system alarm scheduler.'),
        
        React.createElement(Text, { style: { fontSize: 14, fontWeight: 'bold', color: '#111827', marginBottom: 8 } }, '4. Disclaimer of Liability'),
        React.createElement(Text, { style: { fontSize: 13, color: '#4B5563', lineHeight: 18, marginBottom: 8 } }, 'Budget-Wise is a personal ledger tool provided "as is". The user is responsible for backing up their data. We are not responsible for any financial decisions or data loss occurring due to hardware failure, device loss, or manual app deletion.')
      ),

      React.createElement(View, null,
        // Checkbox Section
        React.createElement(TouchableOpacity, {
          onPress: function() { setChecked(!checked); },
          style: { flexDirection: 'row', alignItems: 'center', marginBottom: 20, paddingVertical: 4 }
        },
          React.createElement(MaterialIcons, {
            name: checked ? 'check-box' : 'check-box-outline-blank',
            size: 22,
            color: checked ? primaryColor : '#9CA3AF',
            style: { marginRight: 8 }
          }),
          React.createElement(Text, { style: { fontSize: 13, color: '#374151', flex: 1, fontWeight: '500' } }, 'I read and agree to the Terms & Privacy Policy')
        ),

        // Action Button
        React.createElement(TouchableOpacity, {
          onPress: onAccept,
          disabled: !checked,
          style: {
            backgroundColor: checked ? primaryColor : '#E5E7EB',
            borderRadius: 12,
            paddingVertical: 14,
            alignItems: 'center',
            shadowColor: primaryColor,
            shadowOffset: { width: 0, height: checked ? 4 : 0 },
            shadowOpacity: checked ? 0.3 : 0,
            shadowRadius: checked ? 8 : 0,
            elevation: checked ? 4 : 0
          }
        },
          React.createElement(Text, {
            style: { color: checked ? '#FFFFFF' : '#9CA3AF', fontSize: 15, fontWeight: 'bold' }
          }, 'Accept & Continue')
        )
      )
    )
  );
};

const ComponentFunction = function() {
  const { width } = useWindowDimensions();
  const isLargeScreen = width > 600;
  const isWebDesktop = Platform.OS === 'web' && width > 1024;

  const trialExpired = isTrialExpired();

  var [termsAccepted, setTermsAccepted] = useState(function() {
    try {
      return localStorage.getItem('penny_terms_accepted') === 'true';
    } catch (e) {
      return false;
    }
  });

  useEffect(() => {
    scheduleDailyReminder();
  }, []);

  var handleAcceptTerms = function() {
    try {
      localStorage.setItem('penny_terms_accepted', 'true');
    } catch (e) {}
    setTermsAccepted(true);
  };

  const appContent = trialExpired
    ? React.createElement(TrialExpiredScreen)
    : (!termsAccepted
      ? React.createElement(TermsAndConditionsScreen, { onAccept: handleAcceptTerms })
      : React.createElement(AppContent));

  return React.createElement(UserProvider, { testID: 'UserProvider-1' },
    React.createElement(ThemeProvider, { testID: 'ThemeProvider-1' },
      React.createElement(SafeAreaProvider, { style: { flex: 1, backgroundColor: isLargeScreen ? '#F3F4F6' : 'transparent' } },
        React.createElement(View, {
          testID: 'Root-Wrapper',
          style: {
            flex: 1,
            // If it's a web desktop with a sidebar, we allow more width, otherwise we cap it to 480 for mobile-first look
            width: isWebDesktop ? '100%' : (isLargeScreen ? 480 : '100%'),
            maxWidth: isWebDesktop ? 1440 : 480,
            alignSelf: 'center',
            backgroundColor: '#FFFFFF',
            shadowColor: '#000',
            shadowOffset: { width: 0, height: 10 },
            shadowOpacity: isLargeScreen ? 0.1 : 0,
            shadowRadius: 20,
            elevation: isLargeScreen ? 10 : 0,
            // On desktop/tablet, we want a slight margin to make it look like a phone
            marginTop: isLargeScreen && !isWebDesktop ? 20 : 0,
            marginBottom: isLargeScreen && !isWebDesktop ? 20 : 0,
            borderRadius: isLargeScreen && !isWebDesktop ? 32 : 0,
            overflow: 'hidden'
          }
        },
          React.createElement(ThemeAwareStatusBar),
          appContent
        )
      )
    )
  );
};

export default ComponentFunction;

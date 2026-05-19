import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Platform } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'platform-hooks';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { formatCurrency, generateId } from '../utils/helpers';

const TAB_MENU_HEIGHT = Platform.OS === 'web' ? 56 : 49;
const SCROLL_EXTRA_PADDING = 16;
const WEB_TAB_MENU_PADDING = 90;

const PIN_LENGTH = 6;

const SettingsScreen = function(props) {
  var navigation = props.navigation;
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var toggleTheme = themeCtx.toggleTheme;
  var isDark = theme.isDark;
  var userCtx = useUser();
  var currentUser = userCtx.currentUser;
  var userId = currentUser ? currentUser.id : '';
  var insets = useSafeAreaInsets();
  var scrollBottomPadding = Platform.OS === 'web' ? WEB_TAB_MENU_PADDING : (TAB_MENU_HEIGHT + insets.bottom + SCROLL_EXTRA_PADDING);
  var settingsQuery = useQuery('user_settings');
  var allSettings = settingsQuery.data || [];
  var userSettings = allSettings.find(function(s) { return s.user_id === userId; });
  var refetch = settingsQuery.refetch;
  var [pinMode, setPinMode] = useState(false);
  var [newPin, setNewPin] = useState('');
  var [showPinSaved, setShowPinSaved] = useState(false);

  var updateSettings = useMutation('user_settings', 'update');
  var mutateUpdate = updateSettings.mutate;
  var insertSettings = useMutation('user_settings', 'insert');
  var mutateInsert = insertSettings.mutate;

  // Dynamically initialize settings for this user if none exists
  React.useEffect(() => {
    if (userId && !settingsQuery.loading && !userSettings) {
      mutateInsert({
        id: generateId(),
        user_id: userId,
        pin_code: null,
        biometrics_enabled: false
      }).then(() => refetch());
    }
  }, [userId, settingsQuery.loading, userSettings]);

  var handleSavePin = () => {
    if (newPin.length !== PIN_LENGTH) {
      Platform.OS === 'web' ? window.alert('PIN must be 6 digits') : Alert.alert('Error', 'PIN must be 6 digits');
      return;
    }
    if (userSettings) {
      mutateUpdate({ id: userSettings.id, data: { pin_code: newPin } }).then(() => {
        setPinMode(false);
        setNewPin('');
        refetch();
        setShowPinSaved(true);
        setTimeout(() => setShowPinSaved(false), 2000);
      });
    }
  };

  var handleRemovePin = () => {
    var msg = 'Remove PIN lock?';
    var onConfirm = () => {
      if (userSettings) {
        mutateUpdate({ id: userSettings.id, data: { pin_code: null, biometrics_enabled: false } }).then(() => refetch());
      }
    };
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) onConfirm();
    } else {
      Alert.alert('Remove PIN', msg, [{ text: 'Cancel' }, { text: 'Remove', style: 'destructive', onPress: onConfirm }]);
    }
  };
  
  var handleLogout = function() {
    var msg = 'Are you sure you want to sign out?';
    if (Platform.OS === 'web') {
      if (window.confirm(msg)) { userCtx.setCurrentUser(null); navigation.replace('Login'); }
    } else {
      Alert.alert('Sign Out', msg, [
        { text: 'Cancel' },
        { text: 'Sign Out', style: 'destructive', onPress: function() { userCtx.setCurrentUser(null); navigation.replace('Login'); } }
      ]);
    }
  };
  
  return React.createElement(View, { testID: 'View-71', style: { flex: 1, backgroundColor: theme.colors.background }, componentId: 'settings-screen' },
    React.createElement(View, { testID: 'View-72', style: { backgroundColor: theme.colors.primary, paddingTop: insets.top + 16, paddingBottom: 24, paddingHorizontal: 20 }, componentId: 'settings-header' },
      React.createElement(Text, { testID: 'Text-91', style: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold' } }, 'Settings'),
      React.createElement(Text, { testID: 'Text-92', style: { color: 'rgba(255,255,255,0.75)', fontSize: 14, marginTop: 2 } }, currentUser ? currentUser.email : '')
    ),
    React.createElement(ScrollView, { testID: 'ScrollView-11', style: { flex: 1 },
      contentContainerStyle: { paddingTop: 20, paddingHorizontal: 20, paddingBottom: scrollBottomPadding }
    },
      currentUser ? React.createElement(View, { testID: 'View-73', style: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }, componentId: 'profile-card' },
        React.createElement(View, { testID: 'View-74', style: { flexDirection: 'row', alignItems: 'center', marginBottom: 12 } },
          React.createElement(View, { testID: 'View-75', style: { width: 52, height: 52, borderRadius: 26, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 14 } },
            React.createElement(Text, { testID: 'Text-93', style: { color: '#FFFFFF', fontSize: 22, fontWeight: 'bold' } }, currentUser.name ? currentUser.name[0].toUpperCase() : 'U')
          ),
          React.createElement(View, { testID: 'View-76' },
            React.createElement(Text, { testID: 'Text-94', style: { fontSize: 17, fontWeight: 'bold', color: theme.colors.textPrimary } }, currentUser.name),
            React.createElement(Text, { testID: 'Text-95', style: { fontSize: 13, color: theme.colors.textSecondary, marginTop: 2 } }, currentUser.email)
          )
        )
      ) : null,


      React.createElement(View, { style: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 } },
        React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 } },
          React.createElement(View, { style: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center', marginRight: 12 } },
            React.createElement(MaterialIcons, { name: 'security', size: 22, color: theme.colors.info })
          ),
          React.createElement(Text, { style: { fontSize: 17, fontWeight: 'bold', color: theme.colors.textPrimary } }, 'Security')
        ),
        React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } },
          React.createElement(View, null,
            React.createElement(Text, { style: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary } }, 'App PIN Lock'),
            React.createElement(Text, { style: { fontSize: 13, color: theme.colors.textSecondary } }, userSettings?.pin_code ? '6-Digit PIN Enabled' : 'Disabled')
          ),
          userSettings?.pin_code ? 
            React.createElement(TouchableOpacity, { onPress: handleRemovePin, style: { backgroundColor: '#FEF2F2', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 } },
              React.createElement(Text, { style: { color: theme.colors.error, fontWeight: 'bold', fontSize: 13 } }, 'Remove PIN')
            )
          :
            React.createElement(TouchableOpacity, { onPress: () => setPinMode(!pinMode), style: { backgroundColor: theme.colors.info, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 } },
              React.createElement(Text, { style: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 } }, pinMode ? 'Cancel' : 'Set PIN')
            )
        ),
        pinMode && !userSettings?.pin_code ? React.createElement(View, { style: { marginTop: 16, backgroundColor: theme.colors.background, padding: 12, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border } },
          React.createElement(Text, { style: { fontSize: 13, fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: 8 } }, 'Enter 6-digit PIN'),
          React.createElement(View, { style: { flexDirection: 'row', gap: 10 } },
            React.createElement(TextInput, { value: newPin, onChangeText: setNewPin, placeholder: '123456', keyboardType: 'numeric', maxLength: 6, secureTextEntry: true, style: { flex: 1, backgroundColor: theme.colors.inputBg, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 16, color: theme.colors.textPrimary, letterSpacing: 6 } }),
            React.createElement(TouchableOpacity, { onPress: handleSavePin, style: { backgroundColor: theme.colors.info, borderRadius: 8, paddingHorizontal: 16, justifyContent: 'center' } },
              React.createElement(Text, { style: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 14 } }, 'Save')
            )
          )
        ) : null,
        userSettings?.pin_code ? React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: 16, borderTopWidth: 1, borderTopColor: theme.colors.border, paddingTop: 16 } },
          React.createElement(View, null,
            React.createElement(Text, { style: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary } }, 'Biometric Lock'),
            React.createElement(Text, { style: { fontSize: 13, color: theme.colors.textSecondary } }, 'Fingerprint / Face ID authentication')
          ),
          React.createElement(TouchableOpacity, { 
            onPress: () => {
              mutateUpdate({ id: userSettings.id, data: { biometrics_enabled: !userSettings?.biometrics_enabled } }).then(() => refetch());
            }, 
            style: { width: 50, height: 28, borderRadius: 14, backgroundColor: userSettings?.biometrics_enabled ? theme.colors.primary : theme.colors.border, justifyContent: 'center', padding: 2 } 
          },
            React.createElement(View, { style: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', alignSelf: userSettings?.biometrics_enabled ? 'flex-end' : 'flex-start', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 } })
          )
        ) : null,
        showPinSaved ? React.createElement(View, { style: { backgroundColor: '#FFEDD5', borderRadius: 8, padding: 10, marginTop: 12, flexDirection: 'row', alignItems: 'center' } },
          React.createElement(MaterialIcons, { name: 'check-circle', size: 18, color: theme.colors.info }),
          React.createElement(Text, { style: { color: theme.colors.info, fontSize: 13, marginLeft: 8, fontWeight: '600' } }, 'PIN lock enabled!')
        ) : null
      ),

      React.createElement(View, { style: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 } },
        React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 } },
          React.createElement(View, { style: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FFEDD5', alignItems: 'center', justifyContent: 'center', marginRight: 12 } },
            React.createElement(MaterialIcons, { name: 'palette', size: 22, color: theme.colors.primary })
          ),
          React.createElement(Text, { style: { fontSize: 17, fontWeight: 'bold', color: theme.colors.textPrimary } }, 'Appearance')
        ),
        React.createElement(View, { style: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' } },
          React.createElement(View, null,
            React.createElement(Text, { style: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary } }, 'Dark Mode'),
            React.createElement(Text, { style: { fontSize: 13, color: theme.colors.textSecondary } }, 'Switch to a darker theme')
          ),
          React.createElement(TouchableOpacity, { onPress: toggleTheme, style: { width: 50, height: 28, borderRadius: 14, backgroundColor: isDark ? theme.colors.primary : theme.colors.border, justifyContent: 'center', padding: 2 } },
            React.createElement(View, { style: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', alignSelf: isDark ? 'flex-end' : 'flex-start', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 } })
          )
        )
      ),

      React.createElement(View, { testID: 'View-83', style: { backgroundColor: theme.colors.card, borderRadius: 16, overflow: 'hidden', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }, componentId: 'app-info-card' },
        React.createElement(View, { testID: 'View-84', style: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#FED7AA' } },
          React.createElement(Text, { testID: 'Text-101', style: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 0.5 } }, 'APP INFO')
        ),
        React.createElement(View, { testID: 'View-85', style: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#FED7AA' } },
          React.createElement(Text, { testID: 'Text-102', style: { color: theme.colors.textPrimary, fontSize: 15 } }, 'App Name'),
          React.createElement(Text, { testID: 'Text-103', style: { color: theme.colors.textSecondary, fontSize: 15 } }, 'Personal Budget Tracker')
        ),
        React.createElement(View, { testID: 'View-86', style: { padding: 16, flexDirection: 'row', justifyContent: 'space-between' } },
          React.createElement(Text, { testID: 'Text-104', style: { color: theme.colors.textPrimary, fontSize: 15 } }, 'Version'),
          React.createElement(Text, { testID: 'Text-105', style: { color: theme.colors.textSecondary, fontSize: 15 } }, '1.0.0')
        )
      ),
      React.createElement(TouchableOpacity, { testID: 'TouchableOpacity-26', onPress: handleLogout,
        style: { backgroundColor: '#FEF2F2', borderRadius: 14, padding: 18, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: '#FECACA' },
        componentId: 'logout-btn'
      },
        React.createElement(MaterialIcons, { testID: 'MaterialIcons-17', name: 'logout', size: 22, color: theme.colors.error }),
        React.createElement(Text, { testID: 'Text-106', style: { color: theme.colors.error, fontSize: 16, fontWeight: 'bold', marginLeft: 10 } }, 'Sign Out')
      )
    )
  );
};

export default SettingsScreen;

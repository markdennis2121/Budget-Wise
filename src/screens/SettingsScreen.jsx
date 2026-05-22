import React, { useState, useMemo } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Platform, ActivityIndicator } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'platform-hooks';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { formatDate, generateId } from '../utils/helpers';
import { getDatabase, persistDatabase } from '../platform-hooks';
import SaveSuccessOverlay from '../components/SaveSuccessOverlay';
import TrialCountdownBanner from '../components/TrialCountdownBanner';
import OnboardingModal from '../components/OnboardingModal';
import { BETA_EXPIRATION_DATE } from '../utils/trial';
import { runSaveWithFeedback } from '../utils/saveSuccess';
import { NativeBiometric } from 'capacitor-native-biometric';
import { Capacitor } from '@capacitor/core';
import {
  buildUserBackup,
  restoreUserBackup,
  downloadBackupFile,
  copyBackupToClipboard,
  pickBackupFile,
  parseBackupJson,
  formatBackupDate,
  summarizeBackup
} from '../utils/dataBackup';

const TAB_MENU_HEIGHT = Platform.OS === 'web' ? 56 : 49;
const SCROLL_EXTRA_PADDING = 16;
const WEB_TAB_MENU_PADDING = 90;

const PIN_LENGTH = 6;

const THEME_COLORS = [
  { name: 'Copper Penny', color: '#D97706' },
  { name: 'Midnight Royal', color: '#EAB308' },
  { name: 'Cyber Mint', color: '#2DD4BF' },
  { name: 'Forest Green', color: '#059669' },
  { name: 'Penny Classic', color: '#10B981' },
  { name: 'Corporate Blue', color: '#2563EB' },
  { name: 'Rose Gold', color: '#FB7185' },
  { name: 'Lavender Dream', color: '#8B5CF6' },
  { name: 'Stealth Black', color: '#111827' },
  { name: 'Latte Neutral', color: '#D4A373' },
  { name: 'Messenger Vibe', color: ['#00C6FF', '#0072FF'] },
  { name: 'Sunset Blend', color: ['#FF512F', '#F09819'] },
  { name: 'Cosmic Purple', color: ['#8E2DE2', '#4A00E0'] },
  { name: 'Mint Glow', color: ['#11998E', '#38EF7D'] }
];

const SettingsScreen = function(props) {
  var navigation = props.navigation;
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var toggleTheme = themeCtx.toggleTheme;
  var setPrimaryColor = themeCtx.setPrimaryColor;
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
  var [backupBusy, setBackupBusy] = useState(false);
  var [backupNote, setBackupNote] = useState('');
  var [showAppTour, setShowAppTour] = useState(false);

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
    // Block if another account already uses this PIN
    var duplicate = allSettings.find(function (s) {
      return s.pin_code === newPin && s.user_id !== userId;
    });
    if (duplicate) {
      var msg = 'That PIN is already used by another account. Please choose a different PIN.';
      Platform.OS === 'web' ? window.alert(msg) : Alert.alert('PIN Already Taken', msg);
      setNewPin('');
      return;
    }
    if (userSettings) {
      runSaveWithFeedback(
        mutateUpdate({ id: userSettings.id, data: { pin_code: newPin } }),
        {
          setShowSuccess: setShowPinSaved,
          onSaved: refetch,
          errorMessage: 'Could not save PIN. Please try again.'
        }
      ).then(function () {
        setPinMode(false);
        setNewPin('');
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
  
  var showAlert = function (title, message) {
    if (Platform.OS === 'web') {
      window.alert(title + (message ? '\n\n' + message : ''));
    } else {
      Alert.alert(title, message || '');
    }
  };

  var handleExportBackup = function () {
    if (!userId) {
      showAlert('Error', 'Sign in to export your data.');
      return;
    }
    setBackupBusy(true);
    setBackupNote('');
    var backup = buildUserBackup(userId, currentUser);
    downloadBackupFile(backup)
      .then(function (result) {
        if (result.method === 'share') {
          setBackupNote('Backup shared successfully.');
        } else {
          setBackupNote('Saved ' + (result.filename || 'backup file') + ' to your device.');
        }
      })
      .catch(function (err) {
        // Fallback for mobile if sharing fails or web if download fails
        return copyBackupToClipboard(backup).then(function () {
          setBackupNote('Backup copied to clipboard instead. Paste it into Notes or email to save.');
        });
      })
      .catch(function (err) {
        showAlert('Export failed', err && err.message ? err.message : 'Could not export backup.');
      })
      .then(function () {
        setBackupBusy(false);
      });
  };

  var handleRepairData = function () {
    var msg = "This will attempt to fix 'messy' data by recalculating all wallet balances from your transaction history. No data will be deleted. Continue?";
    var performRepair = function () {
      var db = getDatabase();
      if (!db) return;

      // Force clean numeric fields
      if (db.user_settings) {
        db.user_settings = db.user_settings.map(s => ({
          ...s,
          monthly_salary: parseFloat(s.monthly_salary) || 0,
          accounts: (s.accounts || []).map(a => {
            var sBal = a.starting_balance !== undefined ? a.starting_balance : (a.startingBalance !== undefined ? a.startingBalance : 0);
            return {
              ...a,
              starting_balance: parseFloat(sBal) || 0
            };
          }),
          envelopes: (s.envelopes || []).map(e => ({
            ...e,
            assigned: parseFloat(e.assigned) || 0
          }))
        }));
      }

      if (db.expense_history) {
        db.expense_history = db.expense_history.map(h => ({
          ...h,
          amount: parseFloat(h.amount) || 0
        }));
      }

      persistDatabase(db);
      refetch();
      showAlert('Repair Complete', 'Your balances have been recalculated and sanitized.');
    };

    if (Platform.OS === 'web') {
      if (window.confirm(msg)) performRepair();
    } else {
      Alert.alert('Repair & Resync Data', msg, [
        { text: 'Cancel', style: 'cancel' },
        { text: 'Repair Now', onPress: performRepair }
      ]);
    }
  };

  var handleImportBackup = function () {
    if (!userId) {
      showAlert('Error', 'Sign in to restore a backup.');
      return;
    }
    setBackupBusy(true);
    pickBackupFile()
      .then(function (text) {
        var payload = parseBackupJson(text);
        var summary = summarizeBackup(payload);
        var exportedLabel = formatBackupDate(payload.exportedAt);
        var fromUser = payload.user && payload.user.email ? payload.user.email : 'another account';
        var msg =
          'Restore backup from ' + exportedLabel + ' (' + fromUser + ')?\n\n' +
          'This replaces your current envelopes, wallets, bills, and history (' +
          summary.total + ' records) for this account. This cannot be undone.';

        var runRestore = function () {
          restoreUserBackup(userId, payload)
            .then(function () {
              setBackupNote('Backup restored successfully.');
              refetch();
              showAlert('Restored', 'Your budget data was restored from the backup file.');
            })
            .catch(function (err) {
              showAlert('Restore failed', err && err.message ? err.message : 'Could not restore backup.');
            })
            .then(function () {
              setBackupBusy(false);
            });
        };

        setBackupBusy(false);
        if (Platform.OS === 'web') {
          if (window.confirm(msg)) runRestore();
        } else {
          Alert.alert('Restore backup?', msg, [
            { text: 'Cancel', style: 'cancel' },
            { text: 'Restore', style: 'destructive', onPress: runRestore }
          ]);
        }
      })
      .catch(function (err) {
        setBackupBusy(false);
        if (err && err.message === 'No file selected.') return;
        showAlert('Import failed', err && err.message ? err.message : 'Could not read backup file.');
      });
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
  
  var handleToggleBiometrics = async () => {
    // Check if we are in a real native app environment
    var isNative = Capacitor.isNativePlatform();

    if (!isNative && Platform.OS === 'web') {
      showAlert('Not Supported', 'Biometrics are only available on the mobile app.');
      return;
    }
    try {
      const result = await NativeBiometric.isAvailable();
      if (!result.isAvailable) {
        showAlert('Not Available', 'Biometric authentication is not supported or set up on this device.');
        return;
      }

      if (userSettings) {
        mutateUpdate({
          id: userSettings.id,
          data: { biometrics_enabled: !userSettings?.biometrics_enabled }
        }).then(() => refetch());
      }
    } catch (e) {
      showAlert('Error', 'Could not access biometric settings.');
    }
  };

  return React.createElement(View, { testID: 'View-71', style: { flex: 1, backgroundColor: theme.colors.background, position: 'relative' }, componentId: 'settings-screen' },
    React.createElement(OnboardingModal, {
      visible: showAppTour,
      onClose: function () { setShowAppTour(false); refetch(); },
      userSettings: userSettings,
      mutateUpdateSettings: mutateUpdate
    }),
    React.createElement(SaveSuccessOverlay, { visible: showPinSaved, theme: theme, message: 'PIN saved!' }),
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

      React.createElement(TrialCountdownBanner, { theme: theme }),

      React.createElement(View, { style: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 } },
        React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center', marginBottom: 16 } },
          React.createElement(View, { style: { width: 40, height: 40, borderRadius: 12, backgroundColor: isDark ? 'rgba(251,146,60,0.18)' : '#FFEDD5', alignItems: 'center', justifyContent: 'center', marginRight: 12 } },
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
            React.createElement(TouchableOpacity, { onPress: handleRemovePin, style: { backgroundColor: isDark ? 'rgba(239,68,68,0.15)' : '#FEF2F2', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 } },
              React.createElement(Text, { style: { color: theme.colors.error, fontWeight: 'bold', fontSize: 13 } }, 'Remove PIN')
            )
          :
            React.createElement(TouchableOpacity, { onPress: () => setPinMode(!pinMode), style: { backgroundColor: theme.colors.info, paddingHorizontal: 12, paddingVertical: 8, borderRadius: 8 } },
              React.createElement(Text, { style: { color: '#FFFFFF', fontWeight: 'bold', fontSize: 13 } }, pinMode ? 'Cancel' : 'Set PIN')
            )
        ),
        pinMode && !userSettings?.pin_code ? React.createElement(View, { style: { marginTop: 16, backgroundColor: theme.colors.inputBg, padding: 14, borderRadius: 12, borderWidth: 1, borderColor: theme.colors.border } },
          React.createElement(Text, { style: { fontSize: 13, fontWeight: '700', color: theme.colors.textPrimary, marginBottom: 4 } }, 'Enter 6-digit PIN'),
          React.createElement(Text, { style: { fontSize: 12, color: theme.colors.textSecondary, marginBottom: 10 } }, 'Must be unique — PINs are shared across all accounts on this device.'),
          React.createElement(View, { style: { flexDirection: 'row', gap: 10 } },
            React.createElement(TextInput, {
              value: newPin,
              onChangeText: setNewPin,
              placeholder: '● ● ● ● ● ●',
              placeholderTextColor: theme.colors.textSecondary,
              keyboardType: 'numeric',
              maxLength: 6,
              secureTextEntry: true,
              style: { flex: 1, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 8, paddingHorizontal: 12, paddingVertical: 10, fontSize: 18, color: theme.colors.textPrimary, letterSpacing: 8 }
            }),
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
            onPress: handleToggleBiometrics,
            style: { width: 50, height: 28, borderRadius: 14, backgroundColor: userSettings?.biometrics_enabled ? theme.colors.primary : theme.colors.border, justifyContent: 'center', padding: 2 } 
          },
            React.createElement(View, { style: { width: 24, height: 24, borderRadius: 12, backgroundColor: '#FFFFFF', alignSelf: userSettings?.biometrics_enabled ? 'flex-end' : 'flex-start', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.2, shadowRadius: 2, elevation: 2 } })
          )
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
        ),
        React.createElement(View, { style: { marginTop: 24, paddingTop: 16, borderTopWidth: 1, borderTopColor: theme.colors.border } },
          React.createElement(Text, { style: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 4 } }, 'App Accent Color'),
          React.createElement(Text, { style: { fontSize: 13, color: theme.colors.textSecondary, marginBottom: 12 } }, 'Personalize your budgeting experience'),
          React.createElement(ScrollView, { horizontal: true, showsHorizontalScrollIndicator: false, style: { flexDirection: 'row' } },
            THEME_COLORS.map(c => {
              var isArr = Array.isArray(c.color);
              var baseStr = isArr ? c.color[0] : c.color;
              var isSelected = theme.colors.primary === baseStr;
              var isBlackLightMode = (baseStr === '#111827' && !theme.isDark);
              var checkColor = isBlackLightMode ? '#FFFFFF' : (baseStr === '#FFFFFF' ? '#000000' : '#FFFFFF');
              
              return React.createElement(TouchableOpacity, { 
                key: baseStr, 
                onPress: () => setPrimaryColor(c.color),
                style: { width: 50, height: 50, borderRadius: 25, backgroundColor: isArr ? 'transparent' : baseStr, overflow: 'hidden', marginRight: 12, alignItems: 'center', justifyContent: 'center', shadowColor: baseStr, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.3, shadowRadius: 4, elevation: 4 }
              },
                isArr ? React.createElement(View, {
                  style: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, borderRadius: 25, backgroundImage: 'linear-gradient(135deg, ' + c.color[0] + ', ' + c.color[1] + ')' }
                }) : null,
                isSelected ? React.createElement(MaterialIcons, { name: 'check', size: 24, color: checkColor, style: { zIndex: 1 } }) : null
              )
            })
          )
        )
      ),

      React.createElement(View, { style: { backgroundColor: theme.colors.card, borderRadius: 16, overflow: 'hidden', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 } },
        React.createElement(View, { style: { padding: 16, borderBottomWidth: 1, borderBottomColor: theme.colors.border } },
          React.createElement(Text, { style: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 0.5 } }, 'HELP')
        ),
        React.createElement(TouchableOpacity, {
          onPress: function () { setShowAppTour(true); },
          style: { padding: 16, flexDirection: 'row', alignItems: 'center', borderBottomWidth: 1, borderBottomColor: theme.colors.border }
        },
          React.createElement(View, { style: { width: 40, height: 40, borderRadius: 12, backgroundColor: theme.colors.primary + '18', alignItems: 'center', justifyContent: 'center', marginRight: 14 } },
            React.createElement(MaterialIcons, { name: 'school', size: 22, color: theme.colors.primary })
          ),
          React.createElement(View, { style: { flex: 1 } },
            React.createElement(Text, { style: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary } }, 'Replay welcome tour'),
            React.createElement(Text, { style: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 } }, 'Envelope budgeting, taps, privacy & quick start')
          ),
          React.createElement(MaterialIcons, { name: 'chevron-right', size: 22, color: theme.colors.textSecondary })
        ),
        React.createElement(TouchableOpacity, {
          onPress: handleRepairData,
          style: { padding: 16, flexDirection: 'row', alignItems: 'center' }
        },
          React.createElement(View, { style: { width: 40, height: 40, borderRadius: 12, backgroundColor: '#FEF2F2', alignItems: 'center', justifyContent: 'center', marginRight: 14 } },
            React.createElement(MaterialIcons, { name: 'build-circle', size: 22, color: theme.colors.error })
          ),
          React.createElement(View, { style: { flex: 1 } },
            React.createElement(Text, { style: { fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary } }, 'Repair & Resync Data'),
            React.createElement(Text, { style: { fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 } }, 'Recalculate balances and fix "messy" historical data')
          ),
          React.createElement(MaterialIcons, { name: 'sync', size: 22, color: theme.colors.textSecondary })
        )
      ),

      React.createElement(View, { style: { backgroundColor: theme.colors.card, borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }, componentId: 'data-backup-card' },
        React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center', marginBottom: 14 } },
          React.createElement(View, { style: { width: 40, height: 40, borderRadius: 12, backgroundColor: 'rgba(59, 130, 246, 0.12)', alignItems: 'center', justifyContent: 'center', marginRight: 12 } },
            React.createElement(MaterialIcons, { name: 'cloud-off', size: 22, color: '#3B82F6' })
          ),
          React.createElement(Text, { style: { fontSize: 17, fontWeight: 'bold', color: theme.colors.textPrimary } }, 'Your data on this device')
        ),
        React.createElement(View, { style: { backgroundColor: theme.isDark ? 'rgba(59, 130, 246, 0.12)' : 'rgba(59, 130, 246, 0.08)', borderRadius: 12, padding: 14, marginBottom: 16, borderWidth: 1, borderColor: 'rgba(59, 130, 246, 0.2)' } },
          React.createElement(View, { style: { flexDirection: 'row', alignItems: 'flex-start' } },
            React.createElement(MaterialIcons, { name: 'info-outline', size: 18, color: '#3B82F6', style: { marginRight: 10, marginTop: 1 } }),
            React.createElement(Text, { style: { flex: 1, fontSize: 13, color: theme.colors.textSecondary, lineHeight: 20 } },
              'Penny stores your budgets, bills, and transactions locally on this phone or browser. We do not upload them to a cloud server. Export a backup regularly — uninstalling the app or clearing browser data will permanently delete your records.'
            )
          )
        ),
        backupNote ? React.createElement(Text, { style: { fontSize: 12, color: theme.colors.primary, marginBottom: 12, lineHeight: 18 } }, backupNote) : null,
        React.createElement(TouchableOpacity, {
          onPress: handleExportBackup,
          disabled: backupBusy,
          style: { backgroundColor: theme.colors.primary, borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10, minHeight: 48, opacity: backupBusy ? 0.7 : 1 }
        },
          backupBusy
            ? React.createElement(ActivityIndicator, { color: '#FFFFFF', size: 'small' })
            : React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center' } },
                React.createElement(MaterialIcons, { name: 'file-download', size: 20, color: '#FFFFFF', style: { marginRight: 8 } }),
                React.createElement(Text, { style: { color: '#FFFFFF', fontSize: 15, fontWeight: 'bold' } }, 'Export backup (JSON)')
              )
        ),
        React.createElement(TouchableOpacity, {
          onPress: handleImportBackup,
          disabled: backupBusy,
          style: { backgroundColor: theme.colors.background, borderRadius: 12, paddingVertical: 14, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, minHeight: 48, opacity: backupBusy ? 0.7 : 1 }
        },
          React.createElement(View, { style: { flexDirection: 'row', alignItems: 'center' } },
            React.createElement(MaterialIcons, { name: 'file-upload', size: 20, color: theme.colors.textPrimary, style: { marginRight: 8 } }),
            React.createElement(Text, { style: { color: theme.colors.textPrimary, fontSize: 15, fontWeight: '600' } }, 'Restore from backup')
          )
        ),
        React.createElement(Text, { style: { fontSize: 11, color: theme.colors.textSecondary, marginTop: 10, lineHeight: 16, textAlign: 'center' } },
          'Keep backup files private. Restore only replaces data for your signed-in account.'
        )
      ),

      React.createElement(View, { testID: 'View-83', style: { backgroundColor: theme.colors.card, borderRadius: 16, overflow: 'hidden', marginBottom: 20, shadowColor: '#000', shadowOffset: { width: 0, height: 1 }, shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }, componentId: 'app-info-card' },
        React.createElement(View, { testID: 'View-84', style: { padding: 16, borderBottomWidth: 1, borderBottomColor: '#FED7AA' } },
          React.createElement(Text, { testID: 'Text-101', style: { fontSize: 13, fontWeight: '700', color: theme.colors.textSecondary, letterSpacing: 0.5 } }, 'APP INFO')
        ),
        React.createElement(View, { testID: 'View-85', style: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#FED7AA' } },
          React.createElement(Text, { testID: 'Text-102', style: { color: theme.colors.textPrimary, fontSize: 15 } }, 'App Name'),
          React.createElement(Text, { testID: 'Text-103', style: { color: theme.colors.textSecondary, fontSize: 15 } }, 'Penny Budgeting')
        ),
        React.createElement(View, { testID: 'View-86', style: { padding: 16, flexDirection: 'row', justifyContent: 'space-between', borderBottomWidth: 1, borderBottomColor: '#FED7AA' } },
          React.createElement(Text, { testID: 'Text-104', style: { color: theme.colors.textPrimary, fontSize: 15 } }, 'Version'),
          React.createElement(Text, { testID: 'Text-105', style: { color: theme.colors.textSecondary, fontSize: 15 } }, '4.4.0')
        ),
        React.createElement(View, { style: { padding: 16, flexDirection: 'row', justifyContent: 'space-between' } },
          React.createElement(Text, { style: { color: theme.colors.textPrimary, fontSize: 15 } }, 'Beta access ends'),
          React.createElement(Text, { style: { color: theme.colors.textSecondary, fontSize: 15 } }, formatDate(BETA_EXPIRATION_DATE))
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

import React, { useState, useMemo, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Alert, Platform, ActivityIndicator, Modal, Switch } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useQuery, useMutation } from 'platform-hooks';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { formatDate, generateId, formatCurrency } from '../utils/helpers';
import { getDatabase, persistDatabase } from '../platform-hooks';
import SaveSuccessOverlay from '../components/SaveSuccessOverlay';
import OnboardingModal from '../components/OnboardingModal';
import { runSaveWithFeedback } from '../utils/saveSuccess';
import { NativeBiometric } from 'capacitor-native-biometric';
import { Capacitor } from '@capacitor/core';
import {
  downloadCsvFile,
  generateCsvReport,
  downloadFile
} from '../utils/dataBackup';
import { parseUserEnvelopes } from '../utils/envelopeGuards';
import { getStoredAccountsList, buildAccountsWithBalances } from '../utils/accountBalances';
import { calculateArchiveRollup, applyArchiveToDatabase } from '../utils/dataArchive';
import { scale, moderateScale, normalize } from '../utils/responsive';

const TAB_MENU_HEIGHT = Platform.OS === 'web' ? 56 : 81;
const WEB_TAB_MENU_PADDING = 90;
const PIN_LENGTH = 6;

const THEME_COLORS = [
  { name: 'Penny Classic', color: '#10B981' },
  { name: 'Corporate Blue', color: '#2563EB' },
  { name: 'Forest Green', color: '#059669' },
  { name: 'Stealth Black', color: '#111827' },
  { name: 'Copper Penny', color: '#D97706', premium: true },
  { name: 'Midnight Royal', color: '#EAB308', premium: true },
  { name: 'Cyber Mint', color: '#2DD4BF', premium: true },
  { name: 'Rose Gold', color: '#FB7185', premium: true },
  { name: 'Lavender Dream', color: '#8B5CF6', premium: true },
  { name: 'Latte Neutral', color: '#D4A373', premium: true },
  { name: 'Sunset Blend', color: ['#FF512F', '#F09819'], premium: true },
  { name: 'Cosmic Purple', color: ['#8E2DE2', '#4A00E0'], premium: true },
  { name: 'Mint Glow', color: ['#11998E', '#38EF7D'], premium: true }
];

const SettingSection = ({ title, children, theme }) => (
  <View style={{ marginBottom: 24 }}>
    <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.colors.textSecondary, marginBottom: 12, marginLeft: 4, letterSpacing: 0.5, textTransform: 'uppercase' }}>
      {title}
    </Text>
    <View style={{ backgroundColor: theme.colors.card, borderRadius: 20, overflow: 'hidden', borderWidth: 1, borderColor: theme.colors.border }}>
      {children}
    </View>
  </View>
);

const SettingRow = ({ icon, iconColor, title, subtitle, onPress, rightContent, theme, isLast }) => (
  <TouchableOpacity
    onPress={onPress}
    disabled={!onPress}
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: isLast ? 0 : 1,
      borderBottomColor: theme.colors.border
    }}
  >
    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: (iconColor || theme.colors.primary) + '15', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
      <MaterialIcons name={icon} size={20} color={iconColor || theme.colors.primary} />
    </View>
    <View style={{ flex: 1, marginRight: 8 }}>
      <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary }}>{title}</Text>
      {subtitle ? <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>{subtitle}</Text> : null}
    </View>
    {rightContent}
    {onPress && !rightContent && <MaterialIcons name="chevron-right" size={20} color={theme.colors.textSecondary} />}
  </TouchableOpacity>
);

const ToggleRow = ({ icon, iconColor, title, subtitle, value, onValueChange, theme, isLast }) => (
  <View
    style={{
      flexDirection: 'row',
      alignItems: 'center',
      padding: 16,
      borderBottomWidth: isLast ? 0 : 1,
      borderBottomColor: theme.colors.border
    }}
  >
    <View style={{ width: 36, height: 36, borderRadius: 10, backgroundColor: (iconColor || theme.colors.primary) + '15', alignItems: 'center', justifyContent: 'center', marginRight: 14 }}>
      <MaterialIcons name={icon} size={20} color={iconColor || theme.colors.primary} />
    </View>
    <View style={{ flex: 1, marginRight: 8 }}>
      <Text style={{ fontSize: 15, fontWeight: '600', color: theme.colors.textPrimary }}>{title}</Text>
      {subtitle ? <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>{subtitle}</Text> : null}
    </View>
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={() => onValueChange(!value)}
      style={{
        width: 50,
        height: 28,
        borderRadius: 14,
        backgroundColor: value ? theme.colors.primary : (theme.isDark ? '#4B5563' : '#D1D5DB'),
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: value ? 'flex-end' : 'flex-start',
        padding: 2
      }}
    >
      <View
        style={{
          width: 24,
          height: 24,
          borderRadius: 12,
          backgroundColor: '#FFFFFF',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: 2 },
          shadowOpacity: 0.2,
          shadowRadius: 2,
          elevation: 2
        }}
      />
    </TouchableOpacity>
  </View>
);

const SettingsScreen = function(props) {
  const navigation = props.navigation;
  const themeCtx = useTheme();
  const theme = themeCtx.theme;
  const { toggleTheme, setPrimaryColor, isDark } = themeCtx;
  const userCtx = useUser();
  const currentUser = userCtx.currentUser;
  const userId = currentUser ? currentUser.id : '';
  const insets = useSafeAreaInsets();
  const scrollBottomPadding = Platform.OS === 'web' ? WEB_TAB_MENU_PADDING : (TAB_MENU_HEIGHT + insets.bottom + 16);

  const settingsQuery = useQuery('user_settings');
  const userSettings = (settingsQuery.data || []).find(s => s.user_id === userId);
  const updateSettings = useMutation('user_settings', 'update');
  const insertSettings = useMutation('user_settings', 'insert');

  const [pinMode, setPinMode] = useState(false);
  const [newPin, setNewPin] = useState('');
  const [showPinSaved, setShowPinSaved] = useState(false);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupNote, setBackupNote] = useState('');
  const [showAppTour, setShowAppTour] = useState(false);
  const [archiveModalVisible, setArchiveModalVisible] = useState(false);
  const [selectedMonths, setSelectedMonths] = useState(12);
  const [budgetModalVisible, setBudgetModalVisible] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [resetConfirmText, setResetConfirmText] = useState('');

  const historyQuery = useQuery('expense_history');
  const userHistory = (historyQuery.data || []).filter(h => h.user_id === userId);

  const accountsWithBalances = useMemo(() => {
    if (!userSettings) return [];
    return buildAccountsWithBalances({ userSettings: userSettings, userHistory: userHistory });
  }, [userSettings, userHistory]);

  const totalWalletBalance = accountsWithBalances.reduce((sum, acc) => sum + (acc.balance || 0), 0);
  const isArchiveDisabled = Math.abs(totalWalletBalance) > 0.01;

  const refetch = useCallback(() => {
    settingsQuery.refetch();
  }, [settingsQuery]);

  React.useEffect(() => {
    if (userId && !settingsQuery.loading && !userSettings) {
      insertSettings.mutate({
        id: generateId(),
        user_id: userId,
        pin_code: null,
        biometrics_enabled: false,
        budgeting_style: 'envelope'
      }).then(() => refetch());
    }
  }, [userId, settingsQuery.loading, userSettings]);

  const handleSavePin = () => {
    if (newPin.length !== PIN_LENGTH) {
      Alert.alert('Error', `PIN must be ${PIN_LENGTH} digits`);
      return;
    }
    const duplicate = (settingsQuery.data || []).find(s => s.pin_code === newPin && s.user_id !== userId);
    if (duplicate) {
      Alert.alert('PIN Already Taken', 'That PIN is already used by another account. Please choose a different PIN.');
      setNewPin('');
      return;
    }
    if (userSettings) {
      runSaveWithFeedback(
        updateSettings.mutate({ id: userSettings.id, data: { pin_code: newPin } }),
        {
          setShowSuccess: setShowPinSaved,
          onSaved: refetch,
          errorMessage: 'Could not save PIN. Please try again.'
        }
      ).then(() => {
        setPinMode(false);
        setNewPin('');
      });
    }
  };

  const handleRemovePin = () => {
    Alert.alert('Remove PIN', 'Are you sure you want to remove the PIN lock?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Remove', style: 'destructive', onPress: () => {
        updateSettings.mutate({ id: userSettings.id, data: { pin_code: null, biometrics_enabled: false } }).then(() => refetch());
      }}
    ]);
  };

  const handleExportExcel = () => {
    if (!userSettings?.is_premium) {
      navigation.navigate('MainApp', { screen: 'Dashboard', params: { showPremium: true } });
      return;
    }
    setBackupBusy(true);
    const envs = parseUserEnvelopes(userSettings);
    const accs = getStoredAccountsList(userSettings);
    downloadCsvFile(userHistory, envs, accs)
      .then(() => setBackupNote('Excel file generated! Check your downloads.'))
      .catch(() => Alert.alert('Export Failed', 'Could not export data.'))
      .finally(() => setBackupBusy(false));
  };

  const handleArchiveData = () => {
    if (!userSettings?.is_premium) {
      navigation.navigate('MainApp', { screen: 'Dashboard', params: { showPremium: true } });
      return;
    }
    if (isArchiveDisabled) {
      Alert.alert('Archive Locked', 'Wallets must be empty (₱0.00) to compress history. This ensures your final balances remain accurate.');
      return;
    }
    setArchiveModalVisible(true);
  };

  const startCompressionFlow = (monthsAgo) => {
    setArchiveModalVisible(false);
    const cutoffDate = new Date();
    cutoffDate.setMonth(cutoffDate.getMonth() - monthsAgo);
    const cutoffStr = cutoffDate.toISOString().split('T')[0];
    const rollupResult = calculateArchiveRollup(userHistory, cutoffStr, userId);

    if (rollupResult.historyIdsToDelete.length === 0) {
      Alert.alert('No Data Found', `No transactions found older than ${monthsAgo} months.`);
      return;
    }

    Alert.alert('Final Confirmation', `Are you sure? ${rollupResult.historyIdsToDelete.length} transactions will be permanently compressed. A backup CSV will be saved.`, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Compress Now', style: 'destructive', onPress: () => {
        setBackupBusy(true);
        downloadCsvFile(rollupResult.archivedHistory, parseUserEnvelopes(userSettings), getStoredAccountsList(userSettings))
          .then(() => {
            const db = getDatabase();
            const updatedDb = applyArchiveToDatabase(db, userId, rollupResult.summaryTransactions, rollupResult.historyIdsToDelete);
            if (updatedDb) {
              persistDatabase(updatedDb);
              refetch();
              historyQuery.refetch();
              Alert.alert('Success', 'History compressed successfully!');
            }
          })
          .finally(() => setBackupBusy(false));
      }}
    ]);
  };

  const handleToggleBiometrics = async () => {
    if (!userSettings?.is_premium) {
      navigation.navigate('MainApp', { screen: 'Dashboard', params: { showPremium: true } });
      return;
    }
    try {
      const result = await NativeBiometric.isAvailable();
      if (!result.isAvailable) {
        Alert.alert('Not Available', 'Biometric authentication is not supported or set up on this device.');
        return;
      }
      updateSettings.mutate({
        id: userSettings.id,
        data: { biometrics_enabled: !userSettings?.biometrics_enabled }
      }).then(() => refetch());
    } catch (e) {
      Alert.alert('Error', 'Could not access biometric settings.');
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign Out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: () => {
        userCtx.setCurrentUser(null);
        navigation.replace('Login');
      }}
    ]);
  };

  const handleFactoryReset = () => {
    const performReset = () => {
      const db = getDatabase();
      if (db) {
        db.expense_history = (db.expense_history || []).filter(h => h.user_id !== userId);
        db.recurring_expenses = (db.recurring_expenses || []).filter(r => r.user_id !== userId);
        db.one_time_expenses = (db.one_time_expenses || []).filter(o => o.user_id !== userId);
        db.user_settings = (db.user_settings || []).map(s => {
          if (s.user_id === userId) {
            return { ...s, envelopes: [], accounts: [], accounts_customized: false, savings: [], monthly_salary: 0 };
          }
          return s;
        });
        persistDatabase(db);
        refetch();
        historyQuery.refetch();
        setShowResetConfirm(false);
        setResetConfirmText('');
        Alert.alert('Reset Complete', 'Your account has been cleared.');
      }
    };
    performReset();
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background }}>
      <OnboardingModal
        visible={showAppTour}
        onClose={() => { setShowAppTour(false); refetch(); }}
        userSettings={userSettings}
        mutateUpdateSettings={updateSettings.mutate}
      />
      <SaveSuccessOverlay visible={showPinSaved} theme={theme} message="PIN saved!" />

      {/* Header */}
      <View style={{ backgroundColor: theme.colors.primary, paddingTop: insets.top + 16, paddingBottom: 24, paddingHorizontal: 20 }}>
        <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: '900', letterSpacing: -0.5 }}>Settings</Text>
        <Text style={{ color: 'rgba(255,255,255,0.7)', fontSize: 14, marginTop: 4 }}>{currentUser?.email}</Text>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={{ padding: 20, paddingBottom: scrollBottomPadding }}>

        {/* Profile Section */}
        <View style={{ backgroundColor: theme.colors.card, borderRadius: 24, padding: 20, marginBottom: 24, flexDirection: 'row', alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border, shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 10, elevation: 3 }}>
          <View style={{ width: 60, height: 60, borderRadius: 30, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
            <Text style={{ color: '#FFFFFF', fontSize: 24, fontWeight: 'bold' }}>{currentUser?.name?.[0].toUpperCase() || 'U'}</Text>
          </View>
          <View style={{ flex: 1 }}>
            <Text style={{ fontSize: 18, fontWeight: 'bold', color: theme.colors.textPrimary }}>{currentUser?.name}</Text>
            <Text style={{ fontSize: 14, color: theme.colors.textSecondary }}>Member since {formatDate(currentUser?.created_at || new Date())}</Text>
          </View>
          {userSettings?.is_premium && (
            <View style={{ backgroundColor: '#FEF3C7', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8, borderWidth: 1, borderColor: '#F59E0B' }}>
              <Text style={{ color: '#B45309', fontSize: 10, fontWeight: 'bold' }}>LUXE</Text>
            </View>
          )}
        </View>

        {/* Preferences Section */}
        <SettingSection title="Preferences" theme={theme}>
          <SettingRow
            icon="tune"
            title="Budgeting Style"
            subtitle={userSettings?.budgeting_style === 'simple' ? 'Simple Mode (Busy Tracker)' : 'Envelope Mode (Detailed Planner)'}
            onPress={() => setBudgetModalVisible(true)}
            theme={theme}
          />
          <SettingRow
            icon="school"
            title="Replay Welcome Tour"
            subtitle="Learn how to use Penny again"
            onPress={() => setShowAppTour(true)}
            theme={theme}
            isLast={true}
          />
        </SettingSection>

        {/* Security Section */}
        <SettingSection title="Security" theme={theme}>
          <SettingRow
            icon="lock-outline"
            iconColor={theme.colors.info}
            title="PIN Code Lock"
            subtitle={userSettings?.pin_code ? '6-Digit PIN enabled' : 'Not set up'}
            onPress={() => setPinMode(!pinMode)}
            rightContent={
              userSettings?.pin_code ? (
                <TouchableOpacity onPress={handleRemovePin}>
                  <Text style={{ color: theme.colors.error, fontWeight: 'bold', fontSize: 13 }}>Remove</Text>
                </TouchableOpacity>
              ) : null
            }
            theme={theme}
          />

          {pinMode && !userSettings?.pin_code && (
            <View style={{ padding: 16, backgroundColor: theme.colors.background, borderBottomWidth: 1, borderBottomColor: theme.colors.border }}>
              <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginBottom: 12 }}>Enter a unique 6-digit code to protect your data.</Text>
              <View style={{ flexDirection: 'row', gap: 10 }}>
                <TextInput
                  value={newPin}
                  onChangeText={setNewPin}
                  keyboardType="numeric"
                  maxLength={6}
                  secureTextEntry={true}
                  style={{ flex: 1, backgroundColor: theme.colors.card, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 12, fontSize: 18, color: theme.colors.textPrimary, letterSpacing: 8 }}
                />
                <TouchableOpacity onPress={handleSavePin} style={{ backgroundColor: theme.colors.info, borderRadius: 12, paddingHorizontal: 20, justifyContent: 'center' }}>
                  <Text style={{ color: '#FFFFFF', fontWeight: 'bold' }}>Save</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <ToggleRow
            icon="fingerprint"
            iconColor={theme.colors.primary}
            title="Biometrics"
            subtitle="Face ID / Fingerprint"
            value={!!userSettings?.biometrics_enabled}
            onValueChange={handleToggleBiometrics}
            theme={theme}
            isLast={true}
          />
        </SettingSection>

        {/* Appearance Section */}
        <SettingSection title="Appearance" theme={theme}>
          <ToggleRow
            icon="brightness-4"
            title="Dark Mode"
            subtitle="Easier on the eyes"
            value={isDark}
            onValueChange={toggleTheme}
            theme={theme}
          />
          <View style={{ padding: 16 }}>
            <Text style={{ fontSize: 13, fontWeight: '600', color: theme.colors.textPrimary, marginBottom: 12 }}>Accent Color</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false}>
              <View style={{ flexDirection: 'row', gap: 12 }}>
                {THEME_COLORS.map(c => {
                  const isArr = Array.isArray(c.color);
                  const baseStr = isArr ? c.color[0] : c.color;
                  const isSelected = theme.colors.primary === baseStr;
                  const isPremiumLocked = c.premium && !userSettings?.is_premium;

                  return (
                    <TouchableOpacity
                      key={baseStr}
                      onPress={() => isPremiumLocked ? navigation.navigate('MainApp', { screen: 'Dashboard', params: { showPremium: true } }) : setPrimaryColor(c.color)}
                      style={{
                        width: 44, height: 44, borderRadius: 22,
                        backgroundColor: isArr ? baseStr : c.color,
                        borderWidth: 2,
                        borderColor: isSelected ? theme.colors.textPrimary : 'transparent',
                        alignItems: 'center', justifyContent: 'center'
                      }}
                    >
                      {isPremiumLocked && <MaterialIcons name="lock" size={14} color="#FFFFFF" style={{ opacity: 0.8 }} />}
                      {isSelected && <MaterialIcons name="check" size={20} color="#FFFFFF" />}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
          </View>
        </SettingSection>

        {/* Data Management Section */}
        <SettingSection title="Data & Backup" theme={theme}>
          <SettingRow
            icon="file-download"
            iconColor="#3B82F6"
            title="Export to Excel"
            subtitle="Download your history as .CSV"
            onPress={handleExportExcel}
            theme={theme}
          />
          <SettingRow
            icon="auto-delete"
            iconColor={theme.colors.error}
            title="Compress Old Data"
            subtitle="Merge old history to save space"
            onPress={handleArchiveData}
            theme={theme}
            isLast={true}
          />
        </SettingSection>

        {/* Danger Zone */}
        <SettingSection title="Danger Zone" theme={theme}>
          <SettingRow
            icon="refresh"
            iconColor={theme.colors.error}
            title="Factory Reset"
            subtitle="Wipe everything & start fresh"
            onPress={() => setShowResetConfirm(true)}
            theme={theme}
          />
          <SettingRow
            icon="logout"
            iconColor={theme.colors.error}
            title="Sign Out"
            onPress={handleLogout}
            theme={theme}
            isLast={true}
          />
        </SettingSection>

        {/* Developer Center */}
        <View style={{ marginTop: 8, padding: 16, backgroundColor: isDark ? '#1E293B' : '#F1F5F9', borderRadius: 20, borderStyle: 'dashed', borderWidth: 1, borderColor: theme.colors.border }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12 }}>
            <MaterialIcons name="bug-report" size={18} color={theme.colors.textSecondary} style={{ marginRight: 8 }} />
            <Text style={{ fontSize: 13, fontWeight: 'bold', color: theme.colors.textSecondary }}>DEVELOPER TESTING CENTER</Text>
          </View>
          <TouchableOpacity
            onPress={() => updateSettings.mutate({ id: userSettings?.id, data: { is_premium: !userSettings?.is_premium } }).then(() => refetch())}
            style={{ backgroundColor: userSettings?.is_premium ? '#F59E0B' : theme.colors.background, padding: 12, borderRadius: 12, alignItems: 'center', borderWidth: 1, borderColor: theme.colors.border }}
          >
            <Text style={{ color: userSettings?.is_premium ? '#FFFFFF' : theme.colors.textPrimary, fontWeight: 'bold', fontSize: 12 }}>
              {userSettings?.is_premium ? 'DISABLE PREMIUM MODE' : 'ENABLE PREMIUM MODE'}
            </Text>
          </TouchableOpacity>
          <Text style={{ fontSize: 10, color: theme.colors.textSecondary, textAlign: 'center', marginTop: 12 }}>Penny v5.5.2 • Build 38</Text>
        </View>

      </ScrollView>

      {/* Budgeting Style Selection Modal (Dropdown Style) */}
      <Modal visible={budgetModalVisible} transparent animationType="slide" onRequestClose={() => setBudgetModalVisible(false)}>
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'flex-end' }}>
          <View style={{ backgroundColor: theme.colors.card, borderTopLeftRadius: 32, borderTopRightRadius: 32, paddingBottom: insets.bottom + 20, paddingHorizontal: 20 }}>
            <View style={{ width: 40, height: 5, backgroundColor: theme.colors.border, borderRadius: 3, alignSelf: 'center', marginVertical: 12, opacity: 0.5 }} />

            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20, paddingTop: 8 }}>
              <Text style={{ fontSize: 20, fontWeight: '900', color: theme.colors.textPrimary }}>Select Budgeting Style</Text>
              <TouchableOpacity onPress={() => setBudgetModalVisible(false)} style={{ padding: 8, backgroundColor: theme.colors.background, borderRadius: 12 }}>
                <MaterialIcons name="close" size={20} color={theme.colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <TouchableOpacity
              onPress={() => {
                updateSettings.mutate({ id: userSettings.id, data: { budgeting_style: 'envelope' } }).then(() => {
                  refetch();
                  setBudgetModalVisible(false);
                });
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: userSettings?.budgeting_style !== 'simple' ? theme.colors.primary + '10' : 'transparent',
                padding: 16,
                borderRadius: 20,
                marginBottom: 12,
                borderWidth: 2,
                borderColor: userSettings?.budgeting_style !== 'simple' ? theme.colors.primary : theme.colors.border
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#DCFCE7', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <MaterialIcons name="all-inbox" size={24} color="#15803D" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.textPrimary }}>Detailed Planner</Text>
                <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>Plan every peso using the envelope system.</Text>
              </View>
              {userSettings?.budgeting_style !== 'simple' && <MaterialIcons name="check-circle" size={24} color={theme.colors.primary} />}
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => {
                updateSettings.mutate({ id: userSettings.id, data: { budgeting_style: 'simple' } }).then(() => {
                  refetch();
                  setBudgetModalVisible(false);
                });
              }}
              style={{
                flexDirection: 'row',
                alignItems: 'center',
                backgroundColor: userSettings?.budgeting_style === 'simple' ? theme.colors.primary + '10' : 'transparent',
                padding: 16,
                borderRadius: 20,
                marginBottom: 20,
                borderWidth: 2,
                borderColor: userSettings?.budgeting_style === 'simple' ? theme.colors.primary : theme.colors.border
              }}
            >
              <View style={{ width: 44, height: 44, borderRadius: 22, backgroundColor: '#E0F2FE', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <MaterialIcons name="speed" size={24} color="#0369A1" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: 'bold', color: theme.colors.textPrimary }}>Busy Tracker</Text>
                <Text style={{ fontSize: 12, color: theme.colors.textSecondary, marginTop: 2 }}>Simple view focused on wallets and spending.</Text>
              </View>
              {userSettings?.budgeting_style === 'simple' && <MaterialIcons name="check-circle" size={24} color={theme.colors.primary} />}
            </TouchableOpacity>
          </View>
        </View>
      </Modal>

      {/* History Compression Modal */}
      <Modal visible={archiveModalVisible} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: theme.colors.card, borderRadius: 28, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 10 }, shadowOpacity: 0.3, shadowRadius: 20, elevation: 15 }}>
            <MaterialIcons name="auto-delete" size={48} color={theme.colors.error} style={{ alignSelf: 'center', marginBottom: 16 }} />
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.colors.textPrimary, textAlign: 'center', marginBottom: 8 }}>Compress History</Text>
            <Text style={{ fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 24 }}>Detailed transactions will be merged into monthly totals. This is permanent.</Text>
            <View style={{ flexDirection: 'row', gap: 10, marginBottom: 24 }}>
              {[3, 6, 12].map(m => (
                <TouchableOpacity key={m} onPress={() => setSelectedMonths(m)} style={{ flex: 1, paddingVertical: 12, borderRadius: 12, backgroundColor: selectedMonths === m ? theme.colors.primary : theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' }}>
                  <Text style={{ fontWeight: 'bold', color: selectedMonths === m ? '#FFFFFF' : theme.colors.textPrimary }}>{m}m</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => setArchiveModalVisible(false)} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' }}>
                <Text style={{ fontWeight: 'bold', color: theme.colors.textPrimary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => startCompressionFlow(selectedMonths)} style={{ flex: 1.5, paddingVertical: 14, borderRadius: 12, backgroundColor: theme.colors.error, alignItems: 'center' }}>
                <Text style={{ fontWeight: 'bold', color: '#FFFFFF' }}>Compress Now</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Factory Reset Modal */}
      <Modal visible={showResetConfirm} transparent animationType="fade">
        <View style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'center', padding: 24 }}>
          <View style={{ backgroundColor: theme.colors.card, borderRadius: 28, padding: 24, borderWidth: 1, borderColor: theme.colors.error }}>
            <MaterialIcons name="report-problem" size={48} color={theme.colors.error} style={{ alignSelf: 'center', marginBottom: 16 }} />
            <Text style={{ fontSize: 20, fontWeight: 'bold', color: theme.colors.textPrimary, textAlign: 'center', marginBottom: 8 }}>Factory Reset</Text>
            <Text style={{ fontSize: 14, color: theme.colors.textSecondary, textAlign: 'center', marginBottom: 20 }}>This will wipe ALL your data. This cannot be undone.</Text>
            <TextInput
              value={resetConfirmText}
              onChangeText={setResetConfirmText}
              placeholder='Type "RESET"'
              placeholderTextColor={theme.colors.textSecondary}
              style={{ backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, borderRadius: 12, padding: 12, textAlign: 'center', fontWeight: 'bold', marginBottom: 20, color: theme.colors.error }}
            />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <TouchableOpacity onPress={() => { setShowResetConfirm(false); setResetConfirmText(''); }} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: theme.colors.background, borderWidth: 1, borderColor: theme.colors.border, alignItems: 'center' }}>
                <Text style={{ fontWeight: 'bold', color: theme.colors.textPrimary }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity disabled={resetConfirmText !== 'RESET'} onPress={handleFactoryReset} style={{ flex: 1, paddingVertical: 14, borderRadius: 12, backgroundColor: resetConfirmText === 'RESET' ? theme.colors.error : theme.colors.border, alignItems: 'center' }}>
                <Text style={{ fontWeight: 'bold', color: '#FFFFFF' }}>Delete All</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
};

export default SettingsScreen;

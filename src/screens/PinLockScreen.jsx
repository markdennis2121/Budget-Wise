import React, { useState, useEffect } from 'react';
import { View, Text, TouchableOpacity, Platform, Vibration } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { MaterialIcons } from '@expo/vector-icons';
import { useTheme } from '../contexts/ThemeContext';
import { useUser } from '../contexts/UserContext';
import { useQuery } from 'platform-hooks';

const PIN_LENGTH = 8;

const PinLockScreen = function(props) {
  var onUnlock = props.onUnlock;
  var themeCtx = useTheme();
  var theme = themeCtx.theme;
  var userCtx = useUser();
  var currentUser = userCtx.currentUser;
  var insets = useSafeAreaInsets();
  
  var settingsQuery = useQuery('user_settings');
  var allSettings = settingsQuery.data || [];
  var userSettings = allSettings.find(function(s) { return s.user_id === (currentUser ? currentUser.id : ''); });
  
  var [pin, setPin] = useState('');
  var [error, setError] = useState(false);

  useEffect(() => {
    if (pin.length === PIN_LENGTH) {
      if (userSettings && userSettings.pin_code === pin) {
        onUnlock();
      } else {
        setError(true);
        if (Platform.OS !== 'web') Vibration.vibrate();
        setTimeout(() => {
          setPin('');
          setError(false);
        }, 500);
      }
    }
  }, [pin, userSettings, onUnlock]);

  var handlePress = (num) => {
    if (pin.length < PIN_LENGTH) {
      setPin(prev => prev + num);
      setError(false);
    }
  };

  var handleBackspace = () => {
    setPin(prev => prev.slice(0, -1));
    setError(false);
  };
  
  var handleLogout = () => {
    userCtx.setCurrentUser(null);
  };

  return (
    <View style={{ flex: 1, backgroundColor: theme.colors.background, alignItems: 'center', justifyContent: 'center', paddingTop: insets.top, paddingBottom: insets.bottom }}>
      <View style={{ width: 80, height: 80, borderRadius: 24, backgroundColor: theme.colors.primary, alignItems: 'center', justifyContent: 'center', marginBottom: 24 }}>
        <MaterialIcons name="lock" size={36} color="#FFFFFF" />
      </View>
      <Text style={{ fontSize: 22, fontWeight: 'bold', color: theme.colors.textPrimary, marginBottom: 8 }}>Enter PIN</Text>
      <Text style={{ fontSize: 14, color: theme.colors.textSecondary, marginBottom: 32 }}>Welcome back, {currentUser ? currentUser.name : ''}</Text>
      
      <View style={{ flexDirection: 'row', gap: 12, marginBottom: 40 }}>
        {Array.from({ length: PIN_LENGTH }).map((_, i) => (
          <View key={i} style={{ width: 16, height: 16, borderRadius: 8, backgroundColor: i < pin.length ? theme.colors.primary : theme.colors.border, borderWidth: i < pin.length ? 0 : 2, borderColor: error ? theme.colors.error : theme.colors.border }} />
        ))}
      </View>
      
      {error && <Text style={{ color: theme.colors.error, fontSize: 14, fontWeight: '600', marginBottom: 20 }}>Incorrect PIN</Text>}

      <View style={{ width: 280, flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: 16 }}>
        {[1, 2, 3, 4, 5, 6, 7, 8, 9].map(num => (
          <TouchableOpacity key={num} onPress={() => handlePress(num.toString())} style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.colors.card, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
            <Text style={{ fontSize: 28, fontWeight: 'bold', color: theme.colors.textPrimary }}>{num}</Text>
          </TouchableOpacity>
        ))}
        <TouchableOpacity onPress={handleLogout} style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center' }}>
          <Text style={{ fontSize: 16, fontWeight: '600', color: theme.colors.textSecondary }}>Sign Out</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => handlePress('0')} style={{ width: 80, height: 80, borderRadius: 40, backgroundColor: theme.colors.card, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 4, elevation: 2 }}>
          <Text style={{ fontSize: 28, fontWeight: 'bold', color: theme.colors.textPrimary }}>0</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={handleBackspace} style={{ width: 80, height: 80, alignItems: 'center', justifyContent: 'center' }}>
          <MaterialIcons name="backspace" size={28} color={theme.colors.textSecondary} />
        </TouchableOpacity>
      </View>
    </View>
  );
};

export default PinLockScreen;

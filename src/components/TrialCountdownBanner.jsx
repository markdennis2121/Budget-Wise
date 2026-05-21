import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getTrialDaysRemaining, getTrialCountdownLabel, BETA_EXPIRATION_DATE } from '../utils/trial';
import { formatDate } from '../utils/helpers';

/**
 * Compact beta trial reminder for dashboard / settings.
 */
const TrialCountdownBanner = function ({ theme, compact }) {
  var days = getTrialDaysRemaining();
  var label = getTrialCountdownLabel();
  var colors = theme && theme.colors ? theme.colors : {};
  var urgent = days <= 7;
  var isStealthDark = theme.isDark && colors.primary === '#111827';
  var safePrimary = isStealthDark ? '#E5E7EB' : (colors.primary || '#0F766E');
  var accent = urgent ? (colors.warning || '#F59E0B') : safePrimary;
  var bg = urgent ? 'rgba(245, 158, 11, 0.12)' : 'rgba(15, 118, 110, 0.1)';

  if (days <= 0) return null;

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: bg,
        borderRadius: compact ? 10 : 12,
        paddingVertical: compact ? 8 : 10,
        paddingHorizontal: compact ? 10 : 12,
        marginBottom: compact ? 0 : 16,
        borderWidth: 1,
        borderColor: accent + '33'
      }}
    >
      <MaterialIcons name="schedule" size={compact ? 16 : 18} color={accent} style={{ marginRight: 8 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: compact ? 12 : 13, fontWeight: 'bold', color: colors.textPrimary }}>
          {label}
        </Text>
        {!compact ? (
          <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2 }}>
            Beta access ends {formatDate(BETA_EXPIRATION_DATE)}. Export a backup in Settings.
          </Text>
        ) : null}
      </View>
    </View>
  );
};

export default TrialCountdownBanner;

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

  // Only show the banner if there are 5 days or less remaining
  if (days > 5 || days <= 0) return null;

  var isStealthDark = theme.isDark && colors.primary === '#111827';
  var safePrimary = isStealthDark ? '#E5E7EB' : (colors.primary || '#0F766E');
  var accent = colors.error || '#EF4444';
  var bg = 'rgba(239, 68, 68, 0.12)';

  return (
    <View
      style={{
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: bg,
        borderRadius: compact ? 10 : 12,
        paddingVertical: compact ? 10 : 14,
        paddingHorizontal: compact ? 12 : 16,
        marginBottom: compact ? 0 : 16,
        borderWidth: 1,
        borderColor: accent + '44'
      }}
    >
      <MaterialIcons name="report-problem" size={compact ? 20 : 24} color={accent} style={{ marginRight: 10 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: compact ? 13 : 14, fontWeight: 'bold', color: colors.textPrimary }}>
          {label.toUpperCase()}
        </Text>
        <Text style={{ fontSize: 11, color: colors.textSecondary, marginTop: 2, lineHeight: 16 }}>
          Your beta access ends on {formatDate(BETA_EXPIRATION_DATE)}. Contact the developer to get the lifetime version.
        </Text>
      </View>
    </View>
  );
};

export default TrialCountdownBanner;

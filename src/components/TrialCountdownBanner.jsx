import React from 'react';
import { View, Text } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { getTrialDaysRemaining, getTrialCountdownLabel, BETA_EXPIRATION_DATE } from '../utils/trial';
import { formatDate } from '../utils/helpers';
import { scale, moderateScale, normalize } from '../utils/responsive';

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
        borderRadius: compact ? scale(10) : scale(12),
        paddingVertical: compact ? moderateScale(10) : moderateScale(14),
        paddingHorizontal: compact ? moderateScale(12) : moderateScale(16),
        marginBottom: compact ? 0 : moderateScale(16),
        borderWidth: 1,
        borderColor: accent + '44'
      }}
    >
      <MaterialIcons name="report-problem" size={compact ? scale(20) : scale(24)} color={accent} style={{ marginRight: 10 }} />
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: compact ? normalize(13) : normalize(14), fontWeight: 'bold', color: colors.textPrimary }}>
          {label.toUpperCase()}
        </Text>
        <Text style={{ fontSize: normalize(11), color: colors.textSecondary, marginTop: 2, lineHeight: normalize(16) }}>
          Your beta access ends on {formatDate(BETA_EXPIRATION_DATE)}. Contact the developer to get the lifetime version.
        </Text>
      </View>
    </View>
  );
};

export default TrialCountdownBanner;

import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { formatCurrency } from '../utils/helpers';
import { scale, moderateScale, normalize } from '../utils/responsive';

/**
 * Ready-to-Assign guidance: unassigned cash, overspent, or orphan pending bills.
 */
const RtaNudgeBanner = function ({ theme, readyToAssign, orphanPendingTotal, onPress }) {
  var colors = theme && theme.colors ? theme.colors : {};
  var rta = parseFloat(readyToAssign) || 0;
  var orphan = parseFloat(orphanPendingTotal) || 0;

  var config = null;

  var isStealthDark = theme.isDark && colors.primary === '#111827';
  var safePrimary = isStealthDark ? '#E5E7EB' : (colors.primary || '#0F766E');

  if (rta < -0.01) {
    config = {
      icon: 'warning',
      bg: 'rgba(220, 38, 38, 0.1)',
      border: colors.error || '#DC2626',
      title: 'Over-assigned',
      message: 'You assigned more than you have available. Move money between envelopes or add income.',
      cta: 'Review envelopes'
    };
  } else if (orphan > 0.01) {
    config = {
      icon: 'error-outline',
      bg: 'rgba(245, 158, 11, 0.12)',
      border: colors.warning || '#F59E0B',
      title: 'Bills need an envelope',
      message: formatCurrency(orphan) + ' is tied to pending bills whose envelope was removed. Fix them on the Bills tab.',
      cta: null
    };
  } else if (rta > 0.01) {
    config = {
      icon: 'savings',
      bg: 'rgba(15, 118, 110, 0.1)',
      border: safePrimary,
      title: 'Unassigned cash',
      message: 'You still have ' + formatCurrency(rta) + ' ready to assign. Give every peso a job in your envelopes.',
      cta: 'Assign now'
    };
  }

  if (!config) return null;

  var Wrapper = onPress && config.cta ? TouchableOpacity : View;
  var wrapperProps = onPress && config.cta
    ? { onPress: onPress, activeOpacity: 0.85 }
    : {};

  return (
    <Wrapper
      {...wrapperProps}
      style={{
        backgroundColor: config.bg,
        borderRadius: scale(14),
        padding: moderateScale(14),
        marginBottom: moderateScale(16),
        borderWidth: 1,
        borderColor: config.border + '44',
        flexDirection: 'row',
        alignItems: 'center'
      }}
    >
      <View
        style={{
          width: scale(40),
          height: scale(40),
          borderRadius: scale(20),
          backgroundColor: config.border + '22',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: moderateScale(12)
        }}
      >
        <MaterialIcons name={config.icon} size={scale(22)} color={config.border} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: normalize(14), fontWeight: 'bold', color: colors.textPrimary, marginBottom: 2 }}>
          {config.title}
        </Text>
        <Text style={{ fontSize: normalize(12), color: colors.textSecondary, lineHeight: normalize(18) }}>
          {config.message}
        </Text>
        {config.cta ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: moderateScale(6) }}>
            <Text style={{ fontSize: normalize(12), fontWeight: 'bold', color: config.border }}>{config.cta}</Text>
            <MaterialIcons name="chevron-right" size={scale(16)} color={config.border} />
          </View>
        ) : null}
      </View>
    </Wrapper>
  );
};

export default RtaNudgeBanner;

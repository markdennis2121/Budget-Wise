import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { formatCurrency } from '../utils/helpers';

/**
 * Ready-to-Assign guidance: unassigned cash, overspent, or orphan pending bills.
 */
const RtaNudgeBanner = function ({ theme, readyToAssign, orphanPendingTotal, onPress }) {
  var colors = theme && theme.colors ? theme.colors : {};
  var rta = parseFloat(readyToAssign) || 0;
  var orphan = parseFloat(orphanPendingTotal) || 0;

  var config = null;

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
      border: colors.primary || '#0F766E',
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
        borderRadius: 14,
        padding: 14,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: config.border + '44',
        flexDirection: 'row',
        alignItems: 'center'
      }}
    >
      <View
        style={{
          width: 40,
          height: 40,
          borderRadius: 20,
          backgroundColor: config.border + '22',
          alignItems: 'center',
          justifyContent: 'center',
          marginRight: 12
        }}
      >
        <MaterialIcons name={config.icon} size={22} color={config.border} />
      </View>
      <View style={{ flex: 1 }}>
        <Text style={{ fontSize: 14, fontWeight: 'bold', color: colors.textPrimary, marginBottom: 2 }}>
          {config.title}
        </Text>
        <Text style={{ fontSize: 12, color: colors.textSecondary, lineHeight: 18 }}>
          {config.message}
        </Text>
        {config.cta ? (
          <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 6 }}>
            <Text style={{ fontSize: 12, fontWeight: 'bold', color: config.border }}>{config.cta}</Text>
            <MaterialIcons name="chevron-right" size={16} color={config.border} />
          </View>
        ) : null}
      </View>
    </Wrapper>
  );
};

export default RtaNudgeBanner;

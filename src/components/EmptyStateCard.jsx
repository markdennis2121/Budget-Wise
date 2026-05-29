import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';
import { scale, moderateScale, normalize } from '../utils/responsive';

/**
 * Mobile-first empty section: icon, short copy, single primary action.
 */
const EmptyStateCard = function ({
  theme,
  icon = 'inbox',
  title,
  message,
  actionLabel,
  onAction,
  compact = false
}) {
  var colors = theme && theme.colors ? theme.colors : {};

  return (
    <View
      style={{
        backgroundColor: colors.card || '#FFFFFF',
        borderRadius: scale(14),
        padding: compact ? moderateScale(16) : moderateScale(20),
        borderWidth: 1,
        borderColor: colors.border || '#E5E7EB',
        borderStyle: 'dashed',
        alignItems: 'center'
      }}
    >
      <View
        style={{
          width: compact ? scale(48) : scale(56),
          height: compact ? scale(48) : scale(56),
          borderRadius: compact ? scale(24) : scale(28),
          backgroundColor: (colors.primary || '#0F766E') + '18',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: moderateScale(12)
        }}
      >
        <MaterialIcons name={icon} size={compact ? scale(26) : scale(30)} color={colors.primary || '#0F766E'} />
      </View>
      <Text
        style={{
          fontSize: compact ? normalize(15) : normalize(16),
          fontWeight: 'bold',
          color: colors.textPrimary || '#111827',
          textAlign: 'center',
          marginBottom: moderateScale(6)
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontSize: normalize(13),
          color: colors.textSecondary || '#6B7280',
          textAlign: 'center',
          lineHeight: normalize(20),
          marginBottom: onAction && actionLabel ? moderateScale(14) : 0
        }}
      >
        {message}
      </Text>
      {onAction && actionLabel ? (
        <TouchableOpacity
          onPress={onAction}
          style={{
            backgroundColor: colors.primary || '#0F766E',
            borderRadius: scale(10),
            paddingVertical: moderateScale(12),
            paddingHorizontal: moderateScale(20),
            minHeight: scale(44),
            justifyContent: 'center'
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: normalize(14), fontWeight: 'bold' }}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

export default EmptyStateCard;

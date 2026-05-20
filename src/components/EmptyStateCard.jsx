import React from 'react';
import { View, Text, TouchableOpacity } from 'react-native';
import { MaterialIcons } from '@expo/vector-icons';

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
        borderRadius: 14,
        padding: compact ? 16 : 20,
        borderWidth: 1,
        borderColor: colors.border || '#E5E7EB',
        borderStyle: 'dashed',
        alignItems: 'center'
      }}
    >
      <View
        style={{
          width: compact ? 48 : 56,
          height: compact ? 48 : 56,
          borderRadius: compact ? 24 : 28,
          backgroundColor: (colors.primary || '#0F766E') + '18',
          alignItems: 'center',
          justifyContent: 'center',
          marginBottom: 12
        }}
      >
        <MaterialIcons name={icon} size={compact ? 26 : 30} color={colors.primary || '#0F766E'} />
      </View>
      <Text
        style={{
          fontSize: compact ? 15 : 16,
          fontWeight: 'bold',
          color: colors.textPrimary || '#111827',
          textAlign: 'center',
          marginBottom: 6
        }}
      >
        {title}
      </Text>
      <Text
        style={{
          fontSize: 13,
          color: colors.textSecondary || '#6B7280',
          textAlign: 'center',
          lineHeight: 20,
          marginBottom: onAction && actionLabel ? 14 : 0
        }}
      >
        {message}
      </Text>
      {onAction && actionLabel ? (
        <TouchableOpacity
          onPress={onAction}
          style={{
            backgroundColor: colors.primary || '#0F766E',
            borderRadius: 10,
            paddingVertical: 12,
            paddingHorizontal: 20,
            minHeight: 44,
            justifyContent: 'center'
          }}
        >
          <Text style={{ color: '#FFFFFF', fontSize: 14, fontWeight: 'bold' }}>{actionLabel}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
};

export default EmptyStateCard;

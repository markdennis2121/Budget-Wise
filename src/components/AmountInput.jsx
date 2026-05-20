import React from 'react';
import { View, Text, TextInput, Platform } from 'react-native';
import { sanitizeDecimalInput } from '../utils/saveSuccess';

/**
 * Mobile-first peso amount field: large tap target, decimal-pad, underline style.
 */
const AmountInput = function ({
  value,
  onChangeText,
  theme,
  placeholder = '0.00',
  autoFocus = false,
  containerStyle,
  inputStyle,
  prefixSize = 22,
  fontSize = 24
}) {
  var colors = theme && theme.colors ? theme.colors : {};
  var isDark = theme && theme.isDark;

  var handleChange = function (val) {
    if (typeof onChangeText === 'function') {
      onChangeText(sanitizeDecimalInput(val));
    }
  };

  return (
    <View
      style={[{
        flexDirection: 'row',
        alignItems: 'flex-end',
        borderBottomWidth: 1.5,
        borderBottomColor: colors.border || '#E5E7EB',
        paddingBottom: 8,
        minHeight: 52
      }, containerStyle]}
    >
      <Text style={{
        fontSize: prefixSize,
        fontWeight: '700',
        color: colors.textSecondary || '#6B7280',
        marginRight: 6,
        paddingBottom: 2
      }}>₱</Text>
      <TextInput
        value={value}
        onChangeText={handleChange}
        placeholder={placeholder}
        placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
        keyboardType="decimal-pad"
        returnKeyType="done"
        autoFocus={autoFocus}
        selectTextOnFocus={Platform.OS !== 'web'}
        style={[{
          flex: 1,
          paddingVertical: Platform.OS === 'ios' ? 6 : 4,
          paddingHorizontal: 0,
          fontSize: fontSize,
          lineHeight: fontSize + 4,
          color: colors.textPrimary || '#111827',
          fontWeight: '700',
          backgroundColor: 'transparent',
          borderWidth: 0,
          minHeight: 44,
          ...(Platform.OS === 'web' ? { outlineStyle: 'none', outlineWidth: 0 } : {})
        }, inputStyle]}
      />
    </View>
  );
};

export default AmountInput;

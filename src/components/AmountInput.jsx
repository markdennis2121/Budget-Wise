import React from 'react';
import { View, Text, TextInput, Platform } from 'react-native';
import { scale, normalize } from '../utils/responsive';
import {
  sanitizeAmountDigits,
  formatAmountWithCommas,
  normalizeAmountInputValue
} from '../utils/amountFormat';

/**
 * Peso amount field with thousand separators (e.g. 1,234.56).
 * Parent state: raw digits string (no commas). Use parseFormattedAmount() before save.
 */
const AmountInput = function ({
  value,
  onChangeText,
  theme,
  placeholder = '0.00',
  autoFocus = false,
  containerStyle,
  inputStyle,
  prefixSize = normalize(22),
  fontSize = normalize(24),
  allowNegative = false,
  allowExpression = false,
  formatOnBlur = true,
  variant = 'underline'
}) {
  var colors = theme && theme.colors ? theme.colors : {};
  var isDark = theme && theme.isDark;

  var rawValue = value == null ? '' : String(value);
  var displayValue = allowExpression
    ? rawValue
    : formatAmountWithCommas(rawValue);

  var handleChange = function (val) {
    if (typeof onChangeText !== 'function') return;
    if (allowExpression) {
      onChangeText(sanitizeAmountDigits(val, { allowExpression: true }));
      return;
    }
    onChangeText(sanitizeAmountDigits(val, { allowNegative: allowNegative }));
  };

  var handleBlur = function () {
    if (!formatOnBlur || typeof onChangeText !== 'function') return;
    var normalized = normalizeAmountInputValue(rawValue, { allowExpression: allowExpression });
    if (normalized !== rawValue) {
      onChangeText(normalized);
    }
  };

  var isBoxed = variant === 'boxed' || variant === 'compact';

  var shellStyle = isBoxed
    ? {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: colors.inputBg || colors.background || '#F9FAFB',
        borderWidth: 1,
        borderColor: colors.border || '#E5E7EB',
        borderRadius: variant === 'compact' ? scale(8) : scale(10),
        paddingHorizontal: variant === 'compact' ? scale(8) : scale(12),
        minHeight: variant === 'compact' ? scale(40) : scale(44)
      }
    : {
        flexDirection: 'row',
        alignItems: 'flex-end',
        borderBottomWidth: 1.5,
        borderBottomColor: colors.border || '#E5E7EB',
        paddingBottom: scale(8),
        minHeight: scale(52)
      };

  return (
    <View style={[shellStyle, containerStyle]}>
      <Text style={{
        fontSize: isBoxed ? (variant === 'compact' ? 14 : 16) : prefixSize,
        fontWeight: '700',
        color: colors.textSecondary || '#6B7280',
        marginRight: isBoxed ? 4 : 6,
        paddingBottom: isBoxed ? 0 : 2
      }}>₱</Text>
      <TextInput
        value={displayValue}
        onChangeText={handleChange}
        onBlur={handleBlur}
        placeholder={placeholder}
        placeholderTextColor={isDark ? '#6B7280' : '#9CA3AF'}
        keyboardType={allowExpression
          ? (Platform.OS === 'ios' ? 'numbers-and-punctuation' : 'default')
          : 'decimal-pad'}
        returnKeyType="done"
        autoFocus={autoFocus}
        selectTextOnFocus={Platform.OS !== 'web'}
        style={[{
          flex: 1,
          paddingVertical: isBoxed ? (variant === 'compact' ? 8 : 10) : (Platform.OS === 'ios' ? 6 : 4),
          paddingHorizontal: 0,
          fontSize: fontSize,
          lineHeight: isBoxed ? fontSize + 2 : fontSize + 4,
          color: colors.textPrimary || '#111827',
          fontWeight: isBoxed ? '600' : '700',
          backgroundColor: 'transparent',
          borderWidth: 0,
          minHeight: isBoxed ? 36 : 44,
          textAlign: variant === 'compact' ? 'right' : 'left',
          ...(Platform.OS === 'web' ? { outlineStyle: 'none', outlineWidth: 0 } : {})
        }, inputStyle]}
      />
    </View>
  );
};

export default AmountInput;

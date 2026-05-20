/**
 * Amount input sanitizing, thousand-separator display, and parsing.
 * Parent state should store the raw string (no commas); use parseFormattedAmount before save.
 */

export function sanitizeAmountDigits(val, opts) {
  opts = opts || {};
  if (opts.allowExpression) {
    return String(val || '').replace(/[^0-9.+\-*/() ]/g, '');
  }

  var s = String(val || '').replace(/,/g, '');
  var neg = s.startsWith('-');
  s = s.replace(/-/g, '');
  s = s.replace(/[^0-9.]/g, '');

  var parts = s.split('.');
  if (parts.length > 2) {
    s = parts[0] + '.' + parts.slice(1).join('');
    parts = s.split('.');
  }

  var intPart = parts[0] || '';
  var dec = parts.length > 1 ? parts[1].slice(0, 2) : null;
  var out = intPart;
  if (dec !== null) out += '.' + dec;
  else if (parts.length > 1) out += '.';

  if (neg && (intPart !== '' || dec !== null || out.endsWith('.'))) {
    out = '-' + out;
  }
  return out;
}

/** @deprecated Use sanitizeAmountDigits — kept for existing imports */
export function sanitizeDecimalInput(val) {
  return sanitizeAmountDigits(val);
}

export function formatAmountWithCommas(raw) {
  var s = sanitizeAmountDigits(raw);
  if (s === '' || s === '-') return s;
  if (s === '.') return '0.';

  var neg = s.startsWith('-');
  if (neg) s = s.slice(1);

  var trailingDot = s.endsWith('.');
  var parts = s.split('.');
  var intPart = parts[0] || '0';
  if (intPart === '') intPart = '0';

  intPart = intPart.replace(/\B(?=(\d{3})+(?!\d))/g, ',');

  var out = intPart;
  if (parts.length > 1 && parts[1] !== undefined) {
    out += '.' + parts[1];
  } else if (trailingDot) {
    out += '.';
  }

  return neg ? '-' + out : out;
}

export function parseFormattedAmount(val) {
  if (val === '' || val === null || val === undefined) return NaN;
  var s = String(val).replace(/,/g, '').trim();
  if (s === '-' || s === '.' || s === '-.') return NaN;
  return parseFloat(s);
}

/** Format a stored number for display inside an amount field */
export function formatAmountForEdit(amount) {
  var n = parseFloat(amount);
  if (isNaN(n)) return '';
  if (n === 0) return '0';
  var s = String(n);
  if (s.indexOf('.') !== -1) {
    s = s.replace(/\.?0+$/, '');
  }
  return formatAmountWithCommas(s);
}

/** Evaluate simple math in amount fields (e.g. 150+45); returns NaN on failure */
export function evaluateAmountExpression(expr) {
  var s = sanitizeAmountDigits(expr, { allowExpression: true }).trim();
  if (!s || !/^[\d\s()+\-*/.]+$/.test(s)) return NaN;
  try {
    var result = Function('"use strict";return (' + s + ')')();
    if (typeof result !== 'number' || !isFinite(result)) return NaN;
    return result;
  } catch (e) {
    return NaN;
  }
}

export function normalizeAmountInputValue(val, opts) {
  opts = opts || {};
  if (opts.allowExpression) {
    var evaluated = evaluateAmountExpression(val);
    if (!isNaN(evaluated)) {
      var n = Math.round(evaluated * 100) / 100;
      var raw = String(n);
      if (raw.indexOf('.') !== -1) raw = raw.replace(/\.?0+$/, '');
      return sanitizeAmountDigits(raw);
    }
  }
  return sanitizeAmountDigits(val);
}

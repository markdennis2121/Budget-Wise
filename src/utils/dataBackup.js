import { Platform, Share } from 'react-native';
import { getDatabase, persistDatabase, DB_SCHEMA_VERSION } from 'platform-hooks';
import { Capacitor } from '@capacitor/core';

var USER_DATA_TABLES = [
  'user_settings',
  'recurring_expenses',
  'one_time_expenses',
  'expense_history'
];

export function buildUserBackup(userId, user) {
  var db = getDatabase();
  var data = {};

  USER_DATA_TABLES.forEach(function (table) {
    data[table] = (db[table] || []).filter(function (row) {
      return row.user_id === userId;
    });
  });

  return {
    schemaVersion: DB_SCHEMA_VERSION,
    exportedAt: new Date().toISOString(),
    app: 'Penny',
    userId: userId,
    user: user
      ? { id: user.id, name: user.name, email: user.email }
      : null,
    data: data
  };
}

export function validateBackupPayload(payload) {
  if (!payload || typeof payload !== 'object') {
    return { ok: false, error: 'This file is not a valid backup.' };
  }

  // If it's a raw database export (no .data wrapper), normalize it
  var data = payload.data;
  if (!data || typeof data !== 'object') {
    data = payload;
  }

  var hasAny = USER_DATA_TABLES.some(function (table) {
    return Array.isArray(data[table]) && data[table].length > 0;
  });

  if (!hasAny) {
    return { ok: false, error: 'Backup contains no budget records.' };
  }
  return { ok: true };
}

export function summarizeBackup(payload) {
  var counts = {};
  var total = 0;

  // Support both wrapped and raw backup formats
  var data = (payload && payload.data && typeof payload.data === 'object')
    ? payload.data
    : (payload || {});

  USER_DATA_TABLES.forEach(function (table) {
    var n = Array.isArray(data[table]) ? data[table].length : 0;
    counts[table] = n;
    total += n;
  });
  return { counts: counts, total: total };
}

/**
 * Senior Data Engineer: Generates a professional CSV string of all transactions
 * formatted for Excel and other spreadsheet apps.
 */
export function generateCsvReport(history, envelopes, accounts) {
  var headers = ['Date', 'Transaction', 'Type', 'Category', 'Wallet', 'Amount', 'Status', 'Notes'];
  var rows = [headers.join(',')];

  (history || []).forEach(function(h) {
    var date = h.date || '';
    var name = (h.expense_name || h.name || 'Transaction').replace(/,/g, ' '); // Avoid CSV injection
    var type = h.expense_type || '';

    var env = envelopes.find(e => e.id === h.category) || { name: h.category || 'Other' };
    var category = env.name.replace(/,/g, ' ');

    var walletObj = accounts.find(a => a.id === h.account_id) || { name: 'Unlinked' };
    var wallet = walletObj.name.replace(/,/g, ' ');

    var amt = parseFloat(h.amount) || 0;
    var sign = (type === 'Income' || (type === 'Adjustment' && h.category === 'Income')) ? '' : '-';
    var amountStr = sign + amt.toFixed(2);

    var status = h.status || '';
    var notes = (h.notes || '').replace(/,/g, ' ').replace(/\n/g, ' ');

    var row = [date, name, type, category, wallet, amountStr, status, notes];
    rows.push(row.map(cell => `"${cell}"`).join(','));
  });

  var csv = rows.join('\r\n');
  return '\uFEFF' + csv; // Add UTF-8 BOM for Excel compatibility
}

/**
 * Senior Mobile Developer: Unified downloader for JSON, Text, and CSV.
 * Optimized for Mobile App limits.
 */
export async function downloadFile(content, type) {
  var exportDate = new Date();
  var yyyy = exportDate.getFullYear();
  var mm = String(exportDate.getMonth() + 1).padStart(2, '0');
  var dd = String(exportDate.getDate()).padStart(2, '0');
  var stamp = yyyy + '-' + mm + '-' + dd;

  var extension = 'txt';
  if (type === 'application/json') extension = 'json';
  if (type === 'text/csv') extension = 'csv';

  var filename = `penny-export-${stamp}.${extension}`;

  var isNative = Capacitor.isNativePlatform();

  if (isNative) {
    // Audit Check: Android Intent limits (Share) are usually ~100KB for text.
    // If backup is larger, we force Clipboard to prevent "Infinite Loading" crash.
    var isLarge = content.length > 80000;

    if (isLarge && type === 'application/json') {
       await copyBackupToClipboard(content);
       return { method: 'clipboard', filename, large: true };
    }

    try {
      var shareOptions = {
        title: `Penny ${extension.toUpperCase()}`,
        message: content,
      };

      // On iOS, providing a data URL helps the system treat it as a file instead of just text
      if (Platform.OS === 'ios') {
        shareOptions.url = `data:${type};base64,` + btoa(unescape(encodeURIComponent(content)));
      }

      await Promise.race([
        Share.share(shareOptions),
        new Promise((_, reject) => setTimeout(() => reject(new Error('timeout')), 6000))
      ]);
      return { method: 'share', filename };
    } catch (e) {
      // Fallback to clipboard if share sheet fails
      await copyBackupToClipboard(content);
      return { method: 'clipboard', filename };
    }
  }

  // Web Browser Logic
  if (typeof document !== 'undefined') {
    var blob = new Blob([content], { type });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    // Removed immediate revoke so the "ready in dashboard" link can work
    return Promise.resolve({ method: 'download', filename, url: url });
  }

  return Promise.reject(new Error('Unsupported platform'));
}

/**
 * Replace current user's rows with backup data (keeps other users on device).
 */
export function restoreUserBackup(userId, payload) {
  var check = validateBackupPayload(payload);
  if (!check.ok) {
    return Promise.reject(new Error(check.error));
  }

  var db = getDatabase();

  // Support both wrapped and raw backup formats
  var data = (payload && payload.data && typeof payload.data === 'object')
    ? payload.data
    : payload;

  USER_DATA_TABLES.forEach(function (table) {
    var incoming = (data[table] || []).map(function (row) {
      return Object.assign({}, row, { user_id: userId });
    });
    var others = (db[table] || []).filter(function (row) {
      return row.user_id !== userId;
    });
    db[table] = others.concat(incoming);
  });

  persistDatabase(db);
  return Promise.resolve(summarizeBackup(payload));
}

export function formatBackupDate(iso) {
  if (!iso) return 'unknown date';
  try {
    var d = new Date(iso);
    return d.toLocaleDateString(undefined, {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  } catch (e) {
    return iso;
  }
}

export function downloadBackupFile(backup) {
  var json = JSON.stringify(backup, null, 2);
  return downloadFile(json, 'application/json');
}

export function downloadCsvFile(history, envelopes, accounts) {
  var csv = generateCsvReport(history, envelopes, accounts);
  return downloadFile(csv, 'text/csv');
}

export function copyBackupToClipboard(backup) {
  var text = typeof backup === 'string' ? backup : JSON.stringify(backup, null, 2);

  // Try navigator.clipboard first (works on web and Capacitor webviews)
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text).then(function () {
      return { method: 'clipboard' };
    });
  }

  return Promise.reject(new Error('Clipboard not available on this device. Please try again or export in the web version.'));
}

export async function pickBackupFile() {
  var isNative = Capacitor.isNativePlatform();

  // If on Mobile, provide a way to paste from clipboard
  if (isNative) {
    try {
      var text = await navigator.clipboard.readText();
      if (text && text.includes('"app": "Penny"')) {
        return text;
      }
    } catch (e) {}

    // Fallback: Signal to UI that we need manual input
    throw new Error('MOBILE_INPUT_REQUIRED');
  }

  return new Promise(function (resolve, reject) {
    if (typeof document === 'undefined') {
      reject(new Error('Environment not supported.'));
      return;
    }
    var input = document.createElement('input');
    input.type = 'file';
    input.accept = '.json,application/json';
    input.onchange = function () {
      var file = input.files && input.files[0];
      if (!file) {
        reject(new Error('No file selected.'));
        return;
      }
      var reader = new FileReader();
      reader.onload = function () {
        resolve(String(reader.result || ''));
      };
      reader.onerror = function () {
        reject(new Error('Could not read the file.'));
      };
      reader.readAsText(file);
    };
    input.click();
  });
}

export function parseBackupJson(text) {
  try {
    return JSON.parse(text);
  } catch (e) {
    throw new Error('File is not valid JSON.');
  }
}

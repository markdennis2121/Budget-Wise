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
  var isNative = Capacitor.isNativePlatform();

  // Use LOCAL date (not UTC) so the filename matches the user's timezone.
  var exportDate = backup.exportedAt ? new Date(backup.exportedAt) : new Date();
  var yyyy = exportDate.getFullYear();
  var mm = String(exportDate.getMonth() + 1).padStart(2, '0');
  var dd = String(exportDate.getDate()).padStart(2, '0');
  var stamp = yyyy + '-' + mm + '-' + dd;
  var filename = 'penny-backup-' + stamp + '.json';

  // Mobile / Native approach: Use Share dialog
  // Audit Check: Sharing massive strings via intents can hang the UI bridge on Android.
  if (isNative) {
    // If the data is too large (> 500KB), we should warn or use clipboard
    // But since we are in a Share flow, we'll try to share as a message.
    return Promise.race([
      Share.share({
        title: 'Penny Budget Backup',
        message: json,
      }),
      new Promise((_, reject) => setTimeout(() => reject(new Error('Share took too long to respond. This usually happens when backup data is too large for the system share sheet. Try copying to clipboard instead.')), 8000))
    ]).then(function () {
      return { method: 'share', filename: filename };
    });
  }

  // Web approach: use Blob/link download
  if (Platform.OS === 'web' || typeof document !== 'undefined') {
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.style.display = 'none';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    setTimeout(function () { URL.revokeObjectURL(url); }, 200);
    return Promise.resolve({ method: 'download', filename: filename });
  }

  return Promise.reject(new Error('Export is not supported on this platform.'));
}

export function copyBackupToClipboard(backup) {
  var json = JSON.stringify(backup, null, 2);

  // Try navigator.clipboard first (works on web and Capacitor webviews)
  if (typeof navigator !== 'undefined' && navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(json).then(function () {
      return { method: 'clipboard' };
    });
  }

  return Promise.reject(new Error('Clipboard not available on this device. Please try again or export in the web version.'));
}

export function pickBackupFile() {
  return new Promise(function (resolve, reject) {
    if (Platform.OS !== 'web' || typeof document === 'undefined') {
      reject(new Error('File import is available in the browser version of the app.'));
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

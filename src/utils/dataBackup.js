import { Platform } from 'react-native';
import { getDatabase, persistDatabase, DB_SCHEMA_VERSION } from 'platform-hooks';

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
    app: 'Budget-Wise',
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
  if (!payload.data || typeof payload.data !== 'object') {
    return { ok: false, error: 'Backup is missing budget data.' };
  }
  var hasAny = USER_DATA_TABLES.some(function (table) {
    return Array.isArray(payload.data[table]) && payload.data[table].length > 0;
  });
  if (!hasAny) {
    return { ok: false, error: 'Backup contains no budget records.' };
  }
  return { ok: true };
}

export function summarizeBackup(payload) {
  var counts = {};
  var total = 0;
  USER_DATA_TABLES.forEach(function (table) {
    var n = Array.isArray(payload.data[table]) ? payload.data[table].length : 0;
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

  USER_DATA_TABLES.forEach(function (table) {
    var incoming = (payload.data[table] || []).map(function (row) {
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
  var stamp = (backup.exportedAt || new Date().toISOString()).slice(0, 10);
  var filename = 'budget-wise-backup-' + stamp + '.json';

  if (Platform.OS === 'web' && typeof document !== 'undefined') {
    var blob = new Blob([json], { type: 'application/json' });
    var url = URL.createObjectURL(blob);
    var link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
    return Promise.resolve({ method: 'download', filename: filename });
  }

  return Promise.reject(new Error('Download is available in the browser version of the app.'));
}

export function copyBackupToClipboard(backup) {
  var json = JSON.stringify(backup, null, 2);
  if (Platform.OS === 'web' && typeof navigator !== 'undefined' && navigator.clipboard) {
    return navigator.clipboard.writeText(json).then(function () {
      return { method: 'clipboard' };
    });
  }
  return Promise.reject(new Error('Clipboard not available on this device.'));
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

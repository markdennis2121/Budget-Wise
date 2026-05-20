export const generateId = function() {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function(c) {
    var r = Math.random() * 16 | 0;
    var v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
};

export const padNum = function(n) { return n < 10 ? '0' + n : String(n); };

export const getTodayStr = function() {
  var d = new Date();
  return d.getFullYear() + '-' + padNum(d.getMonth() + 1) + '-' + padNum(d.getDate());
};

export const formatCurrency = function(amount) {
  var num = parseFloat(amount) || 0;
  return '₱' + num.toFixed(2).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
};

export const formatDate = function(dateStr) {
  if (!dateStr) return '';
  var parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return dateStr;
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  return months[parseInt(parts[1], 10) - 1] + ' ' + parseInt(parts[2], 10) + ', ' + parts[0];
};

export const parseLocalDate = function(dateStr) {
  if (!dateStr) return new Date();
  var parts = dateStr.split('T')[0].split('-');
  if (parts.length !== 3) return new Date(dateStr);
  return new Date(parseInt(parts[0], 10), parseInt(parts[1], 10) - 1, parseInt(parts[2], 10));
};

export const isWithin5Days = function(dueDateStr) {
  if (!dueDateStr) return false;
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var due = parseLocalDate(dueDateStr);
  due.setHours(0, 0, 0, 0);
  var diffMs = due.getTime() - today.getTime();
  var diffDays = diffMs / (1000 * 60 * 60 * 24);
  return diffDays >= 0 && diffDays <= 5;
};

export const isOverdue = function(dueDateStr) {
  if (!dueDateStr) return false;
  var today = new Date();
  today.setHours(0, 0, 0, 0);
  var due = parseLocalDate(dueDateStr);
  due.setHours(0, 0, 0, 0);
  return due.getTime() < today.getTime();
};

export const getMonthStr = function(dateStr) {
  if (!dateStr) return '';
  var parts = dateStr.split('T')[0].split('-');
  return parts[0] + '-' + parts[1];
};

export const getCurrentMonthStr = function() {
  var d = new Date();
  return d.getFullYear() + '-' + padNum(d.getMonth() + 1);
};

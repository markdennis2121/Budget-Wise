import { Alert, Platform } from 'react-native';
import {
  getPendingBillsForEnvelope,
  formatPendingBillsSummary
} from '../../utils/envelopeBudget';
import { formatCurrency } from '../../utils/helpers';

export function promptDeleteEnvelope(opts) {
  var targetEnv = (opts.envelopes || []).find(function (e) { return e.id === opts.envelopeId; });
  if (!targetEnv) return;

  var pending = getPendingBillsForEnvelope(opts.recurringExpenses || [], targetEnv);
  var newList = (opts.envelopes || []).filter(function (e) { return e.id !== opts.envelopeId; });

  // Calculate total money that will return (Assigned amount)
  var assignedAmt = targetEnv.assigned || 0;

  var msg = 'Delete "' + targetEnv.name + '" envelope?\n\n' +
            'This will delete all spending history and transactions linked to this category. ' +
            'The entire assigned amount (' + formatCurrency(assignedAmt) + ') will be returned to your Ready to Assign balance.';

  if (pending.length) {
    var fallback = newList[0];
    if (fallback) {
      msg += '\n\n' + pending.length + ' pending bill(s) will move to "' + fallback.name + '": ' + formatPendingBillsSummary(pending, formatCurrency) + '.';
    } else {
      msg += '\n\n' + pending.length + ' pending bill(s) will be cancelled: ' + formatPendingBillsSummary(pending, formatCurrency) + '.';
    }
  }

  if (Platform.OS === 'web') {
    if (window.confirm(msg)) opts.onPerformDelete();
  } else {
    Alert.alert('Delete Envelope', msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Delete', style: 'destructive', onPress: opts.onPerformDelete }
    ]);
  }
}

export function getEnvelopeIcon(name) {
  var lower = (name || '').toLowerCase();
  if (lower.includes('housing') || lower.includes('rent') || lower.includes('home') || lower.includes('house')) return 'home';
  if (lower.includes('food') || lower.includes('dine') || lower.includes('eat') || lower.includes('grocery') || lower.includes('restaurant')) return 'restaurant';
  if (lower.includes('transport') || lower.includes('car') || lower.includes('travel') || lower.includes('commute') || lower.includes('gas') || lower.includes('fare')) return 'directions-car';
  if (lower.includes('saving')) return 'savings';
  if (lower.includes('health') || lower.includes('medical') || lower.includes('hospital') || lower.includes('drug') || lower.includes('clinic')) return 'local-hospital';
  if (lower.includes('school') || lower.includes('education') || lower.includes('book') || lower.includes('course') || lower.includes('class')) return 'school';
  if (lower.includes('utility') || lower.includes('bill') || lower.includes('electric') || lower.includes('water') || lower.includes('internet') || lower.includes('phone')) return 'receipt';
  return 'label-important';
}

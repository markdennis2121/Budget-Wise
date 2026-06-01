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
  var history = (opts.userHistory || []).filter(function(h) {
    return h.category === opts.envelopeId && (h.expense_type === 'One-Time' || h.expense_type === 'Recurring');
  });

  var hasHistory = history.length > 0;
  var totalSpent = history.reduce(function(sum, h) { return sum + (parseFloat(h.amount) || 0); }, 0);

  // Calculate total money that will return (Assigned amount minus what was already spent)
  var assignedAmt = targetEnv.assigned || 0;
  var remainingInEnv = assignedAmt - totalSpent;

  var title = hasHistory ? 'Archive Envelope' : 'Delete Envelope';
  var actionVerb = hasHistory ? 'Archive' : 'Delete';

  var msg = actionVerb + ' "' + targetEnv.name + '" envelope?\n\n';

  if (hasHistory) {
    msg += 'This envelope has ' + history.length + ' past transaction(s) totaling ' + formatCurrency(totalSpent) + '. ' +
           'Archiving it will keep your spending records but hide this category from your Dashboard. ' +
           'The remaining ' + formatCurrency(remainingInEnv) + ' will return to your Ready to Assign pool.';
  } else {
    msg += 'This envelope is empty. It will be permanently removed, and its assigned amount (' + formatCurrency(assignedAmt) + ') will return to your Ready to Assign pool.';
  }

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
    Alert.alert(title, msg, [
      { text: 'Cancel', style: 'cancel' },
      { text: actionVerb, style: hasHistory ? 'default' : 'destructive', onPress: opts.onPerformDelete }
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

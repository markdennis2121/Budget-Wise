import { formatCurrency } from './helpers';

export var MONTH_LABELS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

export function getLast6Months() {
  var result = [];
  var now = new Date();
  for (var i = 5; i >= 0; i--) {
    var d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    result.push({
      year: d.getFullYear(),
      month: d.getMonth(),
      label: MONTH_LABELS[d.getMonth()],
      key: d.getFullYear() + '-' + (d.getMonth() + 1 < 10 ? '0' : '') + (d.getMonth() + 1)
    });
  }
  return result;
}

/**
 * Build a plain-language monthly insight from current + prior month totals.
 * @param {Object} opts
 * @param {Array<{ key, label, spent, income }>} opts.monthlyTotals - oldest → newest
 * @param {string} opts.curMonthKey - YYYY-MM
 * @param {Array<{ name, spent }>} opts.envelopeSpending - current month, sorted desc
 */
export function buildMonthlyInsight(opts) {
  opts = opts || {};
  var months = opts.monthlyTotals || [];
  var curKey = opts.curMonthKey;
  var envelopeSpending = opts.envelopeSpending || [];

  if (months.length < 2) {
    return {
      icon: 'insights',
      color: '#3B82F6',
      title: 'Keep logging',
      text: 'Add a few more weeks of expenses to unlock month-over-month insights.'
    };
  }

  var cur = months[months.length - 1];
  var prev = months[months.length - 2];
  var curSpent = parseFloat(cur.spent) || 0;
  var prevSpent = parseFloat(prev.spent) || 0;
  var curIncome = parseFloat(cur.income) || 0;
  var prevIncome = parseFloat(prev.income) || 0;
  var curNet = curIncome - curSpent;
  var prevNet = prevIncome - prevSpent;

  if (curSpent === 0 && curIncome === 0) {
    return {
      icon: 'add-chart',
      color: '#3B82F6',
      title: 'Start tracking',
      text: 'Log income and expenses this month to see personalized insights here.'
    };
  }

  var spendDelta = curSpent - prevSpent;
  var spendPct = prevSpent > 0 ? Math.round((spendDelta / prevSpent) * 100) : null;

  if (spendPct !== null && spendPct >= 25) {
    return {
      icon: 'trending-up',
      color: '#F59E0B',
      title: 'Spending is up',
      text: 'You spent ' + formatCurrency(curSpent) + ' this month — about ' + spendPct + '% more than ' + prev.label + ' (' + formatCurrency(prevSpent) + '). Review your top envelopes.'
    };
  }

  if (spendPct !== null && spendPct <= -15 && curSpent > 0) {
    return {
      icon: 'trending-down',
      color: '#10B981',
      title: 'Spending is down',
      text: 'Nice work — spending fell roughly ' + Math.abs(spendPct) + '% vs ' + prev.label + '. You spent ' + formatCurrency(curSpent) + ' so far this month.'
    };
  }

  if (curNet < 0 && curIncome > 0) {
    return {
      icon: 'warning',
      color: '#EF4444',
      title: 'Over budget this month',
      text: 'Expenses (' + formatCurrency(curSpent) + ') beat income (' + formatCurrency(curIncome) + ') by ' + formatCurrency(Math.abs(curNet)) + '.'
    };
  }

  if (curNet > 0 && curIncome > 0) {
    var saveRate = Math.round((curNet / curIncome) * 100);
    var top = envelopeSpending[0];
    var topNote = top && top.spent > 0
      ? ' Biggest category: ' + top.name + ' (' + formatCurrency(top.spent) + ').'
      : '';
    return {
      icon: 'savings',
      color: '#10B981',
      title: 'On track to save',
      text: 'About ' + saveRate + '% of income left after spending (' + formatCurrency(curNet) + ').' + topNote
    };
  }

  if (prevNet > 0 && curNet < prevNet * 0.5 && curSpent > 0) {
    return {
      icon: 'info',
      color: '#3B82F6',
      title: 'Savings pace slowed',
      text: 'You kept ' + formatCurrency(curNet) + ' this month vs ' + formatCurrency(prevNet) + ' in ' + prev.label + '.'
    };
  }

  return {
    icon: 'lightbulb',
    color: '#3B82F6',
    title: 'Monthly snapshot',
    text: 'This month: ' + formatCurrency(curSpent) + ' spent' + (curIncome > 0 ? ', ' + formatCurrency(curIncome) + ' income.' : '.')
  };
}

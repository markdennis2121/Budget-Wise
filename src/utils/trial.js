/** Beta build expiration (inclusive through end of this calendar day). */
export var BETA_EXPIRATION_DATE = '2026-08-01';

export function isTrialExpired(now) {
  var ref = now ? new Date(now) : new Date();
  var exp = new Date(BETA_EXPIRATION_DATE + 'T23:59:59');
  return ref.getTime() > exp.getTime();
}

export function getTrialDaysRemaining(now) {
  if (isTrialExpired(now)) return 0;
  var ref = now ? new Date(now) : new Date();
  ref.setHours(0, 0, 0, 0);
  var exp = new Date(BETA_EXPIRATION_DATE + 'T00:00:00');
  var diff = exp.getTime() - ref.getTime();
  return Math.max(0, Math.ceil(diff / (24 * 60 * 60 * 1000)));
}

export function getTrialCountdownLabel(now) {
  var days = getTrialDaysRemaining(now);
  if (days === 0) return 'Beta ends today';
  if (days === 1) return '1 day left in beta';
  return days + ' days left in beta';
}

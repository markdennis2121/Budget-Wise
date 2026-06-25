/**
 * Beta Trial Time-Bomb Logic
 * ==========================
 * Prevents access after the expiration date and detects local clock manipulation.
 */

export var BETA_EXPIRATION_DATE = '2026-07-30';

// Storage key to track the furthest date the app has ever seen
const HIGHEST_DATE_KEY = 'penny_highest_seen_date';

export function isTrialExpired() {
  const now = new Date();
  const todayStr = now.toISOString().split('T')[0];

  // 1. Check Hard Expiration
  if (todayStr > BETA_EXPIRATION_DATE) {
    return true;
  }

  // 2. Clock Rollback Protection
  // We store the highest date ever seen by the app.
  // If the current system date is EARLIER than that, the user manipulated their calendar.
  try {
    const highestSeen = localStorage.getItem(HIGHEST_DATE_KEY);

    if (highestSeen && todayStr < highestSeen) {
      // User rolled back their clock!
      return true;
    }

    // If current date is valid, update the "highest seen" so they can't roll back tomorrow
    if (!highestSeen || todayStr > highestSeen) {
      localStorage.setItem(HIGHEST_DATE_KEY, todayStr);
    }
  } catch (e) {
    // Fallback if localStorage fails
  }

  return false;
}

export function getTrialDaysRemaining() {
  const now = new Date();
  const exp = new Date(BETA_EXPIRATION_DATE);
  const diffTime = exp - now;
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  return diffDays > 0 ? diffDays : 0;
}

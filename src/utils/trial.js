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
  // Senior Developer: Use Local Time components to ensure it expires at midnight in the user's timezone.
  // Format: YYYY-MM-DD
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  const todayStr = `${year}-${month}-${day}`;

  // 1. Check Hard Expiration (">" allows them to use the app ON the expiration date)
  // The app will lock on the day AFTER July 30, 2026.
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

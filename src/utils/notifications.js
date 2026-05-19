import { Platform } from 'react-native';
import { LocalNotifications } from '@capacitor/local-notifications';

export const requestNotificationPermission = async () => {
  if (Platform.OS === 'web') {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      const permission = await window.Notification.requestPermission();
      return permission === 'granted';
    }
    return false;
  }
  try {
    const status = await LocalNotifications.requestPermissions();
    return status.display === 'granted';
  } catch (e) {
    console.warn('Local notifications permissions failed', e);
    return false;
  }
};

export const scheduleDailyReminder = async () => {
  if (Platform.OS === 'web') {
    console.log("Web Mode: Daily Reminder (8:00 PM) scheduled.");
    try {
      if (typeof window !== 'undefined' && 'Notification' in window) {
        if (window.Notification.permission === 'default') {
          await window.Notification.requestPermission();
        }
      }
    } catch (e) {}
    return;
  }
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    // Check if daily reminder is already scheduled
    const pending = await LocalNotifications.getPending();
    const exists = pending.notifications.some(n => n.id === 999);
    if (exists) return; // Already scheduled

    // Schedule daily reminder at 8:00 PM
    await LocalNotifications.schedule({
      notifications: [
        {
          id: 999,
          title: "Daily Budget Check",
          body: "Have you logged your transactions today? Keep your budget accurate.",
          schedule: {
            on: {
              hour: 20,
              minute: 0
            },
            repeats: true
          },
          sound: 'default'
        }
      ]
    });
    console.log("Daily budget reminder scheduled for 8:00 PM!");
  } catch (e) {
    console.warn("Failed to schedule daily reminder", e);
  }
};

export const scheduleBillNotification = async (bill) => {
  const title = `Upcoming Bill: ${bill.name}`;
  const body = `Your bill of ₱${bill.amount} is due tomorrow.`;

  if (Platform.OS === 'web') {
    console.log(`Web Mode: Scheduled reminder for bill: ${bill.name}`);
    try {
      const granted = await requestNotificationPermission();
      if (granted) {
        new window.Notification("Reminder Scheduled", {
          body: `Penny will remind you about "${bill.name}" (₱${bill.amount}) on your phone.`
        });
      }
    } catch (e) {}
    return;
  }
  try {
    const granted = await requestNotificationPermission();
    if (!granted) return;

    const dueDate = new Date(bill.due_date);
    const reminderDate = new Date(dueDate.getTime() - 24 * 60 * 60 * 1000);
    reminderDate.setHours(9, 0, 0, 0);

    if (reminderDate.getTime() < Date.now()) return;

    const billIdNum = Array.from(bill.id).reduce((acc, char) => acc + char.charCodeAt(0), 0);

    await LocalNotifications.schedule({
      notifications: [
        {
          id: billIdNum,
          title: title,
          body: body,
          schedule: { at: reminderDate },
          sound: 'default'
        }
      ]
    });
    console.log(`Scheduled reminder for bill: ${bill.name} at ${reminderDate}`);
  } catch (e) {
    console.warn("Failed to schedule bill notification", e);
  }
};

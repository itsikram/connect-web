import { STRINGS, fill, toLocalDigits } from './i18n';

// Web version of expo-connect-app/src/screens/recovery/reminders.ts.
// Browsers cannot schedule notifications ahead of time without push, so these
// timers only fire while a Connect tab is open. Reminder text never leaves the
// device.
const CHECKIN_TIME_KEY = 'connect:recovery-checkin-reminder';
const DEFAULT_CHECKIN_TIME = '21:00';
const MAX_TIMEOUT_MS = 2 ** 31 - 1;

let timers = [];

/** "HH:MM", or "off" when the daily check-in reminder is turned off. */
export const getCheckinReminderTime = () => {
  try {
    return window.localStorage.getItem(CHECKIN_TIME_KEY) || DEFAULT_CHECKIN_TIME;
  } catch (_) {
    return DEFAULT_CHECKIN_TIME;
  }
};

export const setCheckinReminderTime = async (value) => {
  try {
    window.localStorage.setItem(CHECKIN_TIME_KEY, value);
  } catch (_) {
    // Preference only.
  }
  if (value !== 'off' && typeof Notification !== 'undefined' && Notification.permission === 'default') {
    try {
      await Notification.requestPermission();
    } catch (_) {
      // Older browsers use a callback; the in-app card still works.
    }
  }
};

export const clearRecoveryReminders = () => {
  timers.forEach((timer) => clearTimeout(timer));
  timers = [];
};

const notify = (title, body, path) => {
  if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  try {
    const notification = new Notification(title, { body, tag: `recovery-${path}` });
    notification.onclick = () => {
      window.focus();
      window.location.assign(path);
    };
  } catch (_) {
    // Some mobile browsers only allow notifications from a service worker.
  }
};

/** Milliseconds until the next local HH:MM. */
const msUntil = (hour, minute, now = new Date()) => {
  const next = new Date(now);
  next.setHours(hour, minute, 0, 0);
  if (next <= now) next.setDate(next.getDate() + 1);
  return next - now;
};

const daily = (hour, minute, fire) => {
  const schedule = () => {
    timers.push(
      setTimeout(() => {
        fire();
        schedule();
      }, msUntil(hour, minute)),
    );
  };
  schedule();
};

/** Re-schedules check-in, risky-time and milestone reminders from the latest dashboard. */
export const syncRecoveryReminders = (dashboard, lang, paths) => {
  clearRecoveryReminders();
  const profile = dashboard?.profile;
  if (!profile || typeof Notification === 'undefined' || Notification.permission !== 'granted') return;
  const s = STRINGS[lang].reminders;
  const discreet = profile.settings?.discreet !== false;
  const title = discreet ? 'Connect' : STRINGS[lang].common.appName;
  const checkinTime = getCheckinReminderTime();

  if (checkinTime !== 'off') {
    const [hour, minute] = checkinTime.split(':').map(Number);
    daily(hour, minute, () => notify(title, discreet ? s.checkinDiscreet : s.checkin, paths.checkin));
  }
  if (profile.settings?.riskNudges) {
    // 15 minutes before the hour when cravings usually cluster.
    (profile.riskHours || []).slice(0, 2).forEach((hour) => daily((hour + 23) % 24, 45, () => notify(title, discreet ? s.nudgeDiscreet : s.nudge, paths.sos)));
  }
  const primary = (dashboard.substances || []).find((item) => item.primary) || dashboard.substances?.[0];
  const msToMilestone = primary && primary.status === 'clean' && primary.milestone?.nextDays ? primary.milestone.msToNext : 0;
  if (msToMilestone > 60000 && msToMilestone < MAX_TIMEOUT_MS && primary.milestone.nextLabel) {
    const body = discreet ? s.milestoneDiscreet : fill(s.milestone, { label: toLocalDigits(primary.milestone.nextLabel, lang) });
    timers.push(setTimeout(() => notify(title, body, paths.home), msToMilestone));
  }
};

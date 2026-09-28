import api from '../../api/api';

// Same endpoints and offline behaviour as expo-connect-app/src/services/recoveryApi.ts.
const DASHBOARD_CACHE_KEY = 'connect:recovery-dashboard';
const CONTENT_CACHE_PREFIX = 'connect:recovery-content-';
const OUTBOX_KEY = 'connect:recovery-outbox';

export const newClientId = () => `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;

/** True when the request never reached the server (offline, DNS, timeout). */
export const isNetworkError = (error) => !!error && !error.response;

const readJson = (key) => {
  try {
    const cached = window.localStorage.getItem(key);
    return cached ? JSON.parse(cached) : null;
  } catch (_) {
    return null;
  }
};
const writeJson = (key, value) => {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (_) {
    // Cache only; the server is the source of truth.
  }
};
const readOutbox = () => readJson(OUTBOX_KEY) || [];

let flushing = null;

export const recoveryApi = {
  getContent: (lang) => api.get('/recovery/content', { params: { lang } }),
  getCachedContent: (lang) => readJson(`${CONTENT_CACHE_PREFIX}${lang}`),
  cacheContent: (lang, content) => writeJson(`${CONTENT_CACHE_PREFIX}${lang}`, content),

  getDashboard: (lang) => api.get('/recovery/dashboard', { params: { lang } }),
  getCachedDashboard: () => readJson(DASHBOARD_CACHE_KEY),
  cacheDashboard: (dashboard) => writeJson(DASHBOARD_CACHE_KEY, dashboard),
  clearCache: () => {
    [DASHBOARD_CACHE_KEY, OUTBOX_KEY, `${CONTENT_CACHE_PREFIX}en`, `${CONTENT_CACHE_PREFIX}bn`].forEach((key) => {
      try {
        window.localStorage.removeItem(key);
      } catch (_) {
        // Nothing cached.
      }
    });
  },

  getProfile: () => api.get('/recovery/profile'),
  saveProfile: (profile, lang) => api.put('/recovery/profile', profile, { params: { lang } }),
  getDaily: (lang) => api.get('/recovery/daily', { params: { lang }, timeout: 30000 }),

  generatePlan: (lang) => api.post('/recovery/plan/generate', {}, { params: { lang }, timeout: 45000 }),
  updatePlan: (plan, lang) => api.put('/recovery/plan', { plan }, { params: { lang } }),

  getCheckins: (days = 30) => api.get('/recovery/checkins', { params: { days } }),
  saveCheckin: (checkin, lang) => api.post('/recovery/checkins', checkin, { params: { lang }, timeout: 30000 }),

  getCravings: (days = 30) => api.get('/recovery/cravings', { params: { days } }),
  /** Logs an SOS session; when offline it is queued and uploaded later. */
  logCraving: async (craving, lang) => {
    try {
      const response = await api.post('/recovery/cravings', craving, { params: { lang } });
      return response.data;
    } catch (error) {
      if (!isNetworkError(error)) throw error;
      const outbox = readOutbox();
      outbox.push({ kind: 'craving', payload: craving });
      writeJson(OUTBOX_KEY, outbox.slice(-100));
      return { queued: true, pointsEarned: 0, newBadges: [] };
    }
  },
  /** Uploads queued SOS sessions. Resolves to how many were sent. */
  flushOutbox: (lang) => {
    if (flushing) return flushing;
    flushing = (async () => {
      const outbox = readOutbox();
      if (!outbox.length) return 0;
      const remaining = [];
      let sent = 0;
      for (const item of outbox) {
        try {
          await api.post('/recovery/cravings', item.payload, { params: { lang } });
          sent += 1;
        } catch (error) {
          // Keep items that failed for network reasons; drop ones the server rejected.
          if (isNetworkError(error)) remaining.push(item);
        }
      }
      writeJson(OUTBOX_KEY, remaining);
      return sent;
    })().finally(() => {
      flushing = null;
    });
    return flushing;
  },
  pendingCount: () => readOutbox().length,

  getLapses: (days = 90) => api.get('/recovery/lapses', { params: { days } }),
  logLapse: (lapse, lang) => api.post('/recovery/lapses', lapse, { params: { lang }, timeout: 45000 }),

  askCoach: (message, mode, lang) => api.post('/recovery/coach', { message, mode }, { params: { lang }, timeout: 45000 }),
  getCoachHistory: (lang) => api.get('/recovery/coach/history', { params: { lang } }),
  clearCoachHistory: () => api.delete('/recovery/coach/history'),

  exportData: () => api.get('/recovery/export', { timeout: 45000 }),
  reset: () => api.delete('/recovery/reset'),
};

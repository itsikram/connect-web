import api from '../../api/api';

// Same endpoints as expo-connect-app/src/services/fitnessApi.ts.
const DASHBOARD_CACHE_KEY = 'connect:fitness-dashboard';

export const fitnessApi = {
  getProfile: () => api.get('/fitness/profile'),
  saveProfile: (profile) => api.put('/fitness/profile', profile),
  resetFitness: () => api.delete('/fitness/reset'),
  getDashboard: (date) => api.get('/fitness/dashboard', { params: date ? { date } : undefined }),
  getCachedDashboard: () => {
    try {
      const cached = window.localStorage.getItem(DASHBOARD_CACHE_KEY);
      return cached ? JSON.parse(cached) : null;
    } catch (_) {
      return null;
    }
  },
  cacheDashboard: (dashboard) => {
    try { window.localStorage.setItem(DASHBOARD_CACHE_KEY, JSON.stringify(dashboard)); } catch (_) { /* cache is optional */ }
  },
  clearDashboardCache: () => {
    try { window.localStorage.removeItem(DASHBOARD_CACHE_KEY); } catch (_) { /* cache is optional */ }
  },
  askCoach: (question, history = []) => api.post('/fitness/coach', { question, history }, { timeout: 30000 }),
  getRecommendations: (refreshToken = Date.now()) =>
    api.get('/fitness/recommendations', { params: { refresh: refreshToken }, timeout: 30000 }),
  getMeals: (date) => api.get('/fitness/meals', { params: date ? { date } : undefined }),
  getRecentMeals: () => api.get('/fitness/meals/recent'),
  analyzeMeal: (payload) => api.post('/fitness/analyze-food', payload, { timeout: 30000 }),
  createMeal: (meal) => api.post('/fitness/meals', meal),
  updateMeal: (id, meal) => api.put(`/fitness/meals/${id}`, meal),
  deleteMeal: (id) => api.delete(`/fitness/meals/${id}`),
  getWeights: () => api.get('/fitness/weight'),
  addWeight: (weightKg, date, note, bodyFatPercent) => api.post('/fitness/weight', { weightKg, date, note, bodyFatPercent }),
  deleteWeight: (id) => api.delete(`/fitness/weight/${id}`),
  getDaily: (date) => api.get('/fitness/daily', { params: date ? { date } : undefined }),
  updateDaily: (habits) => api.put('/fitness/daily', habits),
  getWorkouts: (days = 30) => api.get('/fitness/workouts', { params: { days } }),
  createWorkout: (workout) => api.post('/fitness/workouts', workout),
  updateWorkout: (id, workout) => api.put(`/fitness/workouts/${id}`, workout),
  deleteWorkout: (id) => api.delete(`/fitness/workouts/${id}`),
  getProgress: (period = 'monthly') => api.get('/fitness/progress', { params: { period } }),
  getReminders: () => api.get('/fitness/reminders'),
  createReminder: (reminder) => api.post('/fitness/reminders', reminder),
  updateReminder: (id, reminder) => api.put(`/fitness/reminders/${id}`, reminder),
  deleteReminder: (id) => api.delete(`/fitness/reminders/${id}`),
};

// All fitness pages live under /health (see Main.js). Screen names match the Expo stack.
export const FIT_BASE = '/health';

const SEGMENTS = {
  dashboard: '',
  setup: 'setup',
  meal: 'meal',
  workout: 'workout',
  weight: 'weight',
  progress: 'progress',
  reminders: 'reminders',
  coach: 'coach',
  ideas: 'ideas',
};

export const fitPath = (name = 'dashboard') => {
  const segment = SEGMENTS[name] ?? name;
  return segment ? `${FIT_BASE}/${segment}` : FIT_BASE;
};

import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';

// All Recovery pages live under /rehab (see Main.js). Screen names match the Expo stack.
export const REC_BASE = '/rehab';

const SEGMENTS = {
  RecoveryHome: '',
  RecoveryOnboarding: 'setup',
  RecoverySos: 'sos',
  RecoveryCoach: 'coach',
  RecoveryCheckIn: 'checkin',
  RecoveryLapse: 'slip',
  RecoveryHelp: 'help',
  RecoveryPlan: 'plan',
  RecoveryProgress: 'progress',
  RecoverySettings: 'settings',
};

export const recPath = (name = 'RecoveryHome') => {
  const segment = SEGMENTS[name] ?? name;
  return segment ? `${REC_BASE}/${segment}` : REC_BASE;
};

export const REMINDER_PATHS = { checkin: recPath('RecoveryCheckIn'), sos: recPath('RecoverySos'), home: recPath('RecoveryHome') };

/**
 * A small `navigation` object with the same calls the Expo screens use
 * (navigate, replace, goBack), so the screens read the same on both platforms.
 * Route params travel in router state.
 */
export const useRecoveryNavigation = () => {
  const navigate = useNavigate();
  return useMemo(
    () => ({
      navigate: (name, params) => navigate(recPath(name), { state: params || null }),
      replace: (name, params) => navigate(recPath(name), { state: params || null, replace: true }),
      goBack: () => {
        if (window.history.state?.idx > 0) navigate(-1);
        else navigate(recPath('RecoveryHome'), { replace: true });
      },
    }),
    [navigate],
  );
};

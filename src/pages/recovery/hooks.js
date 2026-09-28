import { useCallback, useEffect, useRef, useState } from 'react';
import { recoveryApi } from './recoveryApi';
import { errorMessage } from '../fitness/ui';

/** Static Recovery content (catalog, screeners, helplines), cached for offline use. */
export const useRecoveryContent = (lang) => {
  const [content, setContent] = useState(() => recoveryApi.getCachedContent(lang));
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const cached = recoveryApi.getCachedContent(lang);
    if (cached) setContent(cached);
    try {
      const response = await recoveryApi.getContent(lang);
      setContent(response.data);
      setError('');
      recoveryApi.cacheContent(lang, response.data);
    } catch (requestError) {
      if (!cached) setError(errorMessage(requestError, 'Could not load'));
    }
  }, [lang]);

  useEffect(() => {
    load();
  }, [load]);

  return { content, error, reload: load };
};

/**
 * Dashboard data: shows the cached copy immediately, then refreshes from the
 * server (and again whenever the tab regains focus).
 */
export const useRecoveryDashboard = (lang) => {
  const [data, setData] = useState(() => recoveryApi.getCachedDashboard());
  const [loading, setLoading] = useState(() => !recoveryApi.getCachedDashboard());
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [offsetMs, setOffsetMs] = useState(0);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    try {
      const response = await recoveryApi.getDashboard(lang);
      if (!mounted.current) return;
      setData(response.data);
      setError('');
      if (response.data.serverTime) setOffsetMs(Date.parse(response.data.serverTime) - Date.now());
      recoveryApi.cacheDashboard(response.data);
    } catch (requestError) {
      if (mounted.current) setError(errorMessage(requestError, 'Could not load your recovery summary.'));
    } finally {
      if (mounted.current) {
        setLoading(false);
        setRefreshing(false);
      }
    }
  }, [lang]);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const onFocus = () => refresh();
    window.addEventListener('focus', onFocus);
    return () => {
      mounted.current = false;
      window.removeEventListener('focus', onFocus);
    };
  }, [refresh]);

  return {
    data,
    setData,
    loading,
    refreshing,
    error,
    offsetMs,
    refresh,
    pullToRefresh: () => {
      setRefreshing(true);
      refresh();
    },
  };
};

/** The last saved dashboard only (no network), for screens that must work offline such as SOS and Help. */
export const useCachedDashboard = () => {
  const [data] = useState(() => recoveryApi.getCachedDashboard());
  return data;
};

import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import portfolioDefaults from '../pages/portfolio/portfolioDefaults';

const PortfolioContext = createContext(null);
const CACHE_KEY = 'connect_portfolio_content_v1';

function getServerBase() {
  const raw = process.env.REACT_APP_SERVER_ADDR || '';
  return String(raw).trim().replace(/\/+$/, '') || 'https://connect-server-7h7d.onrender.com';
}

function readCache() {
  try {
    if (typeof window === 'undefined') return null;
    const raw = localStorage.getItem(CACHE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (parsed?.profile?.name) return parsed;
  } catch {
    /* ignore bad cache */
  }
  return null;
}

function writeCache(payload) {
  try {
    if (typeof window === 'undefined' || !payload?.profile) return;
    localStorage.setItem(CACHE_KEY, JSON.stringify(payload));
  } catch {
    /* quota / private mode */
  }
}

export function PortfolioProvider({ children }) {
  const [data, setData] = useState(() => readCache());
  const [loading, setLoading] = useState(() => !readCache());
  const [error, setError] = useState(null);

  useEffect(() => {
    let cancelled = false;

    const load = async () => {
      setError(null);
      // Only block the UI when we have nothing to show yet
      if (!readCache()) setLoading(true);

      try {
        const res = await axios.get(`${getServerBase()}/api/portfolio`, {
          timeout: 15000,
          headers: { 'Cache-Control': 'no-cache' },
        });
        if (cancelled) return;

        if (res.data?.profile) {
          setData(res.data);
          writeCache(res.data);
        } else if (!cancelled && !readCache()) {
          setData(portfolioDefaults);
        }
      } catch (err) {
        console.error('Failed to load portfolio content', err);
        if (!cancelled) {
          setError(err);
          // Keep cached content if present; otherwise fall back to defaults once
          setData((prev) => prev || portfolioDefaults);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    load();
    return () => {
      cancelled = true;
    };
  }, []);

  const value = useMemo(
    () => ({
      data,
      loading,
      error,
      ready: !!data && !loading,
    }),
    [data, loading, error]
  );

  return <PortfolioContext.Provider value={value}>{children}</PortfolioContext.Provider>;
}

export function usePortfolio() {
  const ctx = useContext(PortfolioContext);
  if (!ctx) {
    throw new Error('usePortfolio must be used within PortfolioProvider');
  }
  return ctx;
}

export default PortfolioContext;

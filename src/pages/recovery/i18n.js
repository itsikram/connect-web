import { useEffect, useMemo, useState } from 'react';
import { useSelector } from 'react-redux';
import { STRINGS } from './strings';

// Same text and formatting as expo-connect-app/src/screens/recovery/i18n.ts.
// The strings themselves are generated into ./strings.js.
export { STRINGS };

// ---------------------------------------------------------------------------
// Language: follows the app language (browser language if unset) unless
// Recovery has its own override.
// ---------------------------------------------------------------------------
const OVERRIDE_KEY = 'connect:recovery-language';
const readOverride = () => {
  try {
    const stored = window.localStorage.getItem(OVERRIDE_KEY);
    return stored === 'en' || stored === 'bn' ? stored : 'auto';
  } catch (_) {
    return 'auto';
  }
};
let override = readOverride();
const listeners = new Set();

export const setRecoveryLanguage = (value) => {
  override = value;
  listeners.forEach((listener) => listener(value));
  try {
    window.localStorage.setItem(OVERRIDE_KEY, value);
  } catch (_) {
    // Preference only; the browser language still applies.
  }
};

/** App language setting ('eng', 'bn', ...) or the browser language, as 'en' | 'bn'. */
const appLang = (setting) => {
  if (setting) return /^(bn|ben|bangla)/i.test(setting) ? 'bn' : 'en';
  return typeof navigator !== 'undefined' && /^bn/i.test(navigator.language || '') ? 'bn' : 'en';
};

const BN_DIGITS = '০১২৩৪৫৬৭৮৯';
export const toLocalDigits = (value, lang) => (lang === 'bn' ? String(value).replace(/\d/g, (digit) => BN_DIGITS[Number(digit)]) : String(value));

/** Groups like 1,00,000 (lakh style, as used in Bangladesh). */
const groupNumber = (value) => {
  const rounded = String(Math.round(Math.abs(value)));
  if (rounded.length <= 3) return rounded;
  const head = rounded.slice(0, -3).replace(/\B(?=(\d{2})+(?!\d))/g, ',');
  return `${head},${rounded.slice(-3)}`;
};

/** Fills {name} placeholders. */
export const fill = (template, values = {}) => String(template).replace(/\{(\w+)\}/g, (match, key) => (values[key] !== undefined ? String(values[key]) : match));

export const makeFormatters = (lang) => {
  const num = (value, decimals = 0) => {
    const number = Number(value) || 0;
    const text = decimals ? number.toFixed(decimals) : groupNumber(number);
    return toLocalDigits(`${number < 0 ? '-' : ''}${text}`, lang);
  };
  const money = (value) => `৳${num(value)}`;
  const date = (value, options = { day: 'numeric', month: 'short', year: 'numeric' }) => {
    const parsed = new Date(value);
    try {
      return parsed.toLocaleDateString(lang === 'bn' ? 'bn-BD' : 'en-GB', options);
    } catch (_) {
      return toLocalDigits(parsed.toDateString(), lang);
    }
  };
  /** "3 days 4 hrs" style duration for small labels. */
  const duration = (ms) => {
    const s = STRINGS[lang].common;
    const totalMinutes = Math.max(0, Math.floor(ms / 60000));
    const days = Math.floor(totalMinutes / 1440);
    const hours = Math.floor((totalMinutes % 1440) / 60);
    const minutes = totalMinutes % 60;
    if (days) return `${num(days)} ${s.days} ${num(hours)} ${s.hours}`;
    if (hours) return `${num(hours)} ${s.hours} ${num(minutes)} ${s.minutes}`;
    return `${num(minutes)} ${s.minutes}`;
  };
  return { num, money, date, duration };
};

export const useRecoveryI18n = () => {
  const [current, setCurrent] = useState(override);
  const appSetting = useSelector((state) => state?.setting?.language);
  useEffect(() => {
    listeners.add(setCurrent);
    return () => {
      listeners.delete(setCurrent);
    };
  }, []);
  const lang = current === 'auto' ? appLang(appSetting) : current;
  return useMemo(() => ({ lang, override: current, s: STRINGS[lang], f: fill, ...makeFormatters(lang) }), [lang, current]);
};

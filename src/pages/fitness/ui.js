import React, { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import * as Md from 'react-icons/md';

/** Material Community icon names used by the Expo screens, mapped to react-icons. */
const ICONS = {
  'chevron-left': Md.MdChevronLeft,
  'cog-outline': Md.MdSettings,
  'silverware-fork-knife': Md.MdRestaurant,
  'food-drumstick': Md.MdEggAlt,
  'cup-water': Md.MdLocalDrink,
  walk: Md.MdHiking,
  'shoe-print': Md.MdDirectionsWalk,
  dumbbell: Md.MdFitnessCenter,
  'power-sleep': Md.MdBedtime,
  fire: Md.MdLocalFireDepartment,
  'heart-pulse': Md.MdMonitorHeart,
  target: Md.MdGpsFixed,
  'chart-line': Md.MdShowChart,
  run: Md.MdDirectionsRun,
  'run-fast': Md.MdDirectionsRun,
  'robot-happy-outline': Md.MdSmartToy,
  'arrow-right': Md.MdArrowForward,
  'cloud-off-outline': Md.MdCloudOff,
  'wifi-off': Md.MdWifiOff,
  'flag-checkered': Md.MdFlag,
  'check-circle': Md.MdCheckCircle,
  'trash-can-outline': Md.MdDeleteOutline,
  plus: Md.MdAdd,
  'lightbulb-on-outline': Md.MdLightbulbOutline,
  'chart-timeline-variant': Md.MdTimeline,
  'bell-ring-outline': Md.MdNotificationsActive,
  'weather-sunset-up': Md.MdWbTwilight,
  'white-balance-sunny': Md.MdWbSunny,
  'weather-night': Md.MdNightsStay,
  'food-apple-outline': Md.MdCookie,
  bike: Md.MdDirectionsBike,
  'lightning-bolt': Md.MdBolt,
  meditation: Md.MdSelfImprovement,
  swim: Md.MdPool,
  soccer: Md.MdSportsSoccer,
  'arm-flex': Md.MdSportsGymnastics,
  'arm-flex-outline': Md.MdSportsGymnastics,
  'trending-down': Md.MdTrendingDown,
  'trending-up': Md.MdTrendingUp,
  'scale-balance': Md.MdBalance,
  'gender-male': Md.MdMale,
  'gender-female': Md.MdFemale,
  tortoise: Md.MdHourglassBottom,
  'check-decagram-outline': Md.MdVerified,
  rabbit: Md.MdSpeed,
  'sofa-outline': Md.MdChair,
  'weight-lifter': Md.MdSportsMartialArts,
  check: Md.MdCheck,
  creation: Md.MdAutoAwesome,
  close: Md.MdClose,
  'camera-outline': Md.MdCameraAlt,
  'image-outline': Md.MdImage,
  'auto-fix': Md.MdAutoFixHigh,
  'plus-circle-outline': Md.MdAddCircleOutline,
  'alert-circle-outline': Md.MdErrorOutline,
  replay: Md.MdReplay,
  minus: Md.MdRemove,
  'arrow-up': Md.MdArrowUpward,
  'arrow-down': Md.MdArrowDownward,
  'scale-bathroom': Md.MdScale,
  'bullseye-arrow': Md.MdTrackChanges,
  'information-outline': Md.MdInfoOutline,
  refresh: Md.MdRefresh,
  broom: Md.MdCleaningServices,
  'clock-outline': Md.MdAccessTime,
  'bell-outline': Md.MdNotificationsNone,
  'bell-sleep-outline': Md.MdNotificationsOff,
  'circle-outline': Md.MdRadioButtonUnchecked,
  'heart-plus': Md.MdFavorite,
};

export const Icon = ({ name, size = 20, color, style, className }) => {
  const Component = ICONS[name] || Md.MdCircle;
  return <Component size={size} color={color} style={style} className={className} aria-hidden="true" />;
};

export const MEAL_TYPES = [
  { value: 'breakfast', label: 'Breakfast', icon: 'weather-sunset-up' },
  { value: 'lunch', label: 'Lunch', icon: 'white-balance-sunny' },
  { value: 'dinner', label: 'Dinner', icon: 'weather-night' },
  { value: 'snack', label: 'Snack', icon: 'food-apple-outline' },
];

export const WORKOUT_TYPES = [
  { value: 'walking', label: 'Walk', icon: 'walk' },
  { value: 'running', label: 'Run', icon: 'run-fast' },
  { value: 'cycling', label: 'Cycle', icon: 'bike' },
  { value: 'strength', label: 'Strength', icon: 'dumbbell' },
  { value: 'hiit', label: 'HIIT', icon: 'lightning-bolt' },
  { value: 'yoga', label: 'Yoga', icon: 'meditation' },
  { value: 'swimming', label: 'Swim', icon: 'swim' },
  { value: 'sports', label: 'Sports', icon: 'soccer' },
  { value: 'cardio', label: 'Cardio', icon: 'heart-pulse' },
  { value: 'other', label: 'Other', icon: 'arm-flex-outline' },
];

export const FIT = {
  protein: 'var(--fit-protein)',
  carbs: 'var(--fit-carbs)',
  fat: 'var(--fit-fat)',
  water: 'var(--fit-water)',
  steps: 'var(--fit-steps)',
  workout: 'var(--fit-workout)',
  sleep: 'var(--fit-sleep)',
  weight: 'var(--fit-weight)',
  primary: 'var(--fit-primary)',
  success: 'var(--fit-success)',
  warning: 'var(--fit-warning)',
};

export const workoutMeta = (type) => WORKOUT_TYPES.find((item) => item.value === type) || WORKOUT_TYPES[WORKOUT_TYPES.length - 1];
export const num = (value) => Math.round(Number(value) || 0);
export const fmt = (value) => num(value).toLocaleString();
export const clamp01 = (value) => Math.min(Math.max(value, 0), 1);
export const ratio = (value, target) => clamp01((Number(value) || 0) / (Number(target) || 1));
export const timezone = () => Intl.DateTimeFormat().resolvedOptions().timeZone || 'Asia/Dhaka';
export const errorMessage = (error, fallback) => error?.response?.data?.message || fallback;
export const onlyDecimal = (value) => value.replace(/[^0-9.]/g, '');

export const greeting = (date = new Date()) => {
  const hour = date.getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

export const shortDay = (isoDay) => {
  const date = new Date(`${isoDay}T12:00:00`);
  return Number.isNaN(date.getTime()) ? isoDay : date.toLocaleDateString(undefined, { weekday: 'narrow' });
};

export const shortDate = (value) => {
  const date = typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value) ? new Date(`${value}T12:00:00`) : new Date(value);
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
};

export const Spinner = ({ large }) => <span className={`fit-spinner${large ? ' is-large' : ''}`} role="status" aria-label="Loading" />;

export const FitnessPage = ({ title, subtitle, onBack, right, children, footer, contentRef }) => {
  const navigate = useNavigate();
  useEffect(() => { document.title = `${title} · Fitness`; }, [title]);
  return (
    <div className="fit-root">
      <header className="fit-header">
        <div className="fit-header-inner">
          <button type="button" className="fit-icon-btn" aria-label="Go back" onClick={onBack || (() => navigate(-1))}>
            <Icon name="chevron-left" size={24} />
          </button>
          <div className="fit-header-text">
            <h1 className="fit-title">{title}</h1>
            {subtitle ? <div className="fit-subtitle">{subtitle}</div> : null}
          </div>
          {right}
        </div>
      </header>
      <main className="fit-content" ref={contentRef}>{children}</main>
      {footer ? <div className="fit-footer"><div className="fit-footer-inner">{footer}</div></div> : null}
    </div>
  );
};

export const HeaderIconButton = ({ icon, onClick, label }) => (
  <button type="button" className="fit-icon-btn" aria-label={label} title={label} onClick={onClick}>
    <Icon name={icon} size={20} />
  </button>
);

export const Card = ({ children, style, className = '', onClick }) => {
  if (!onClick) return <div className={`fit-card ${className}`} style={style}>{children}</div>;
  return (
    <div
      role="button"
      tabIndex={0}
      className={`fit-card is-pressable ${className}`}
      style={style}
      onClick={onClick}
      onKeyDown={(event) => { if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) { event.preventDefault(); onClick(); } }}
    >
      {children}
    </div>
  );
};

export const SectionHeader = ({ title, action, onAction }) => (
  <div className="fit-section-header">
    <h2 className="fit-section-title">{title}</h2>
    {action && onAction ? <button type="button" className="fit-link" onClick={onAction}>{action}</button> : null}
  </div>
);

export const Ring = ({ size = 120, stroke = 12, progress, color, children }) => {
  const radius = (size - stroke) / 2;
  const circumference = 2 * Math.PI * radius;
  const value = clamp01(progress);
  return (
    <div className="fit-ring" style={{ width: size, height: size }}>
      <svg width={size} height={size} aria-hidden="true">
        <circle cx={size / 2} cy={size / 2} r={radius} stroke="var(--fit-border)" strokeWidth={stroke} fill="none" />
        {value > 0 ? (
          <circle
            cx={size / 2}
            cy={size / 2}
            r={radius}
            stroke={color}
            strokeWidth={stroke}
            fill="none"
            strokeLinecap="round"
            strokeDasharray={`${circumference} ${circumference}`}
            strokeDashoffset={circumference * (1 - value)}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
            style={{ transition: 'stroke-dashoffset 0.5s ease' }}
          />
        ) : null}
      </svg>
      {children}
    </div>
  );
};

export const ProgressBar = ({ value, target, color, height = 8 }) => (
  <div className="fit-track" style={{ height, borderRadius: height / 2 }} role="progressbar" aria-valuenow={Math.round(ratio(value, target) * 100)} aria-valuemin={0} aria-valuemax={100}>
    <div className="fit-fill" style={{ width: `${ratio(value, target) * 100}%`, borderRadius: height / 2, background: color || 'var(--fit-primary)' }} />
  </div>
);

export const Chip = ({ label, selected, onClick, icon }) => (
  <button type="button" aria-pressed={!!selected} className={`fit-chip${selected ? ' is-selected' : ''}`} onClick={onClick}>
    {icon ? <Icon name={icon} size={16} /> : null}
    {label}
  </button>
);

export const ChipGroup = ({ options, value, onChange }) => (
  <div className="fit-chip-group">
    {options.map((option) => <Chip key={option.value} label={option.label} icon={option.icon} selected={value === option.value} onClick={() => onChange(option.value)} />)}
  </div>
);

export const OptionCards = ({ options, value, onChange }) => (
  <div className="fit-option-cards" role="radiogroup">
    {options.map((option) => {
      const selected = option.value === value;
      return (
        <button key={option.value} type="button" role="radio" aria-checked={selected} className={`fit-option${selected ? ' is-selected' : ''}`} onClick={() => onChange(option.value)}>
          {option.icon ? <span className="fit-option-icon"><Icon name={option.icon} size={22} /></span> : null}
          <span style={{ flex: 1 }}>
            <span className="fit-option-label" style={{ display: 'block' }}>{option.label}</span>
            {option.hint ? <span className="fit-option-hint" style={{ display: 'block' }}>{option.hint}</span> : null}
          </span>
          <Icon name={selected ? 'check-circle' : 'circle-outline'} size={22} className="fit-option-check" />
        </button>
      );
    })}
  </div>
);

export const Segmented = ({ options, value, onChange }) => (
  <div className="fit-segmented" role="tablist">
    {options.map((option) => (
      <button key={option.value} type="button" role="tab" aria-selected={option.value === value} className={`fit-segment${option.value === value ? ' is-selected' : ''}`} onClick={() => onChange(option.value)}>
        {option.label}
      </button>
    ))}
  </div>
);

export const Button = ({ label, onClick, icon, variant = 'secondary', loadingLabel, disabled, style, auto }) => {
  const [loading, setLoading] = useState(false);
  const mounted = useRef(true);
  useEffect(() => () => { mounted.current = false; }, []);
  const handleClick = async () => {
    if (loading || disabled) return;
    setLoading(true);
    try { await onClick(); } finally { if (mounted.current) setLoading(false); }
  };
  return (
    <button type="button" disabled={loading || disabled} onClick={handleClick} style={style} className={`fit-btn is-${variant}${auto ? ' is-auto' : ''}`}>
      {loading ? <Spinner /> : icon ? <Icon name={icon} size={18} /> : null}
      {loading && loadingLabel ? loadingLabel : label}
    </button>
  );
};

export const Field = ({ label, value, onChange, inputMode, placeholder, suffix, multiline, style, type = 'text', maxLength }) => {
  const InputTag = multiline ? 'textarea' : 'input';
  return (
    <label className="fit-field" style={style}>
      <span className="fit-label">{label}</span>
      <span className="fit-input-wrap">
        <InputTag
          className="fit-input"
          type={multiline ? undefined : type}
          value={value === undefined || value === null ? '' : String(value)}
          onChange={(event) => onChange(event.target.value)}
          placeholder={placeholder}
          inputMode={inputMode}
          maxLength={maxLength}
        />
        {suffix ? <span className="fit-suffix">{suffix}</span> : null}
      </span>
    </label>
  );
};

export const Stepper = ({ value, onChange, step = 1, min = 0, max = 9999, decimals = 0, suffix }) => {
  const factor = 10 ** decimals;
  const update = (delta) => onChange(Math.min(max, Math.max(min, Math.round((value + delta) * factor) / factor)));
  return (
    <div className="fit-stepper">
      <button type="button" className="fit-step-btn" aria-label="Decrease" onClick={() => update(-step)}><Icon name="minus" size={22} /></button>
      <div className="fit-step-value" aria-live="polite">
        <span className="fit-step-number">{value.toFixed(decimals)}</span>
        {suffix ? <span className="fit-step-suffix">{suffix}</span> : null}
      </div>
      <button type="button" className="fit-step-btn" aria-label="Increase" onClick={() => update(step)}><Icon name="plus" size={22} /></button>
    </div>
  );
};

export const StatTile = ({ icon, label, value, unit, color }) => (
  <div className="fit-stat">
    {icon ? <Icon name={icon} size={18} color={color || 'var(--fit-primary)'} /> : null}
    <div className="fit-stat-value">{value}{unit ? <span className="fit-stat-unit"> {unit}</span> : null}</div>
    <div className="fit-stat-label">{label}</div>
  </div>
);

export const EmptyState = ({ icon, title, message, action, onAction }) => (
  <div className="fit-empty">
    <div className="fit-empty-icon"><Icon name={icon} size={28} /></div>
    <div className="fit-empty-title">{title}</div>
    {message ? <div className="fit-empty-message">{message}</div> : null}
    {action && onAction ? <Button label={action} onClick={onAction} style={{ marginTop: 12 }} /> : null}
  </div>
);

export const Muted = ({ children, style, className = '' }) => <p className={`fit-muted ${className}`} style={style}>{children}</p>;

export const Sheet = ({ open, title, onClose, children }) => {
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (event) => { if (event.key === 'Escape') onClose(); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);
  if (!open) return null;
  return (
    <div className="fit-root" style={{ minHeight: 0, background: 'transparent' }}>
      <div className="fit-backdrop" onClick={onClose}>
        <div className="fit-sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(event) => event.stopPropagation()}>
          <div className="fit-handle" />
          <h2 className="fit-card-title fit-center" style={{ marginBottom: 18 }}>{title}</h2>
          {children}
        </div>
      </div>
    </div>
  );
};

const useWidth = () => {
  const ref = useRef(null);
  const [width, setWidth] = useState(0);
  useLayoutEffect(() => {
    if (!ref.current) return undefined;
    const observer = new ResizeObserver(([entry]) => setWidth(entry.contentRect.width));
    observer.observe(ref.current);
    return () => observer.disconnect();
  }, []);
  return [ref, width];
};

/**
 * Single-series bar chart. Hover (or tap) a bar to read its exact value in the
 * caption row; an optional dashed line marks the target.
 */
export const BarChart = ({ data, target, color, height = 140, unit = '', emptyLabel = 'No data yet' }) => {
  const [hovered, setHovered] = useState(null);
  const [pinned, setPinned] = useState(null);
  const active = hovered ?? pinned;
  const max = Math.max(target || 0, ...data.map((item) => item.value), 1) * 1.1;
  const hasData = data.some((item) => item.value > 0);
  const gap = data.length > 14 ? 2 : 6;
  const labelEvery = Math.ceil(data.length / 7);
  const point = active !== null ? data[active] : null;
  return (
    <div>
      <div className="fit-chart-caption" style={{ color: point ? 'var(--fit-text)' : 'var(--fit-text-3)' }}>
        {point ? `${point.detail || point.label}: ${fmt(point.value)}${unit}` : hasData ? 'Hover or tap a bar for details' : emptyLabel}
      </div>
      <div className="fit-bars" style={{ height, gap }} onMouseLeave={() => setHovered(null)}>
        {target ? <div className="fit-target-line" style={{ bottom: (target / max) * height }} /> : null}
        {data.map((item, index) => {
          const barHeight = item.value > 0 ? Math.max(4, (item.value / max) * height) : 0;
          return (
            <button
              key={`${item.label}-${index}`}
              type="button"
              className="fit-bar-hit"
              aria-label={`${item.detail || item.label} ${fmt(item.value)}${unit}`}
              onMouseEnter={() => setHovered(index)}
              onFocus={() => setHovered(index)}
              onBlur={() => setHovered(null)}
              onClick={() => setPinned(pinned === index ? null : index)}
            >
              <span className="fit-bar" style={{ height: barHeight, background: color || 'var(--fit-primary)', opacity: active === null || active === index ? 1 : 0.4 }} />
            </button>
          );
        })}
      </div>
      <div className="fit-axis" style={{ gap }}>
        {data.map((item, index) => <span key={`${item.label}-axis-${index}`}>{index % labelEvery === 0 ? item.label : ''}</span>)}
      </div>
    </div>
  );
};

/** Single-series line chart with markers, optional dashed target and a hover crosshair. */
export const LineChart = ({ data, target, color, height = 160, unit = '', decimals = 1 }) => {
  const [ref, width] = useWidth();
  const [selected, setSelected] = useState(null);
  const stroke = color || 'var(--fit-primary)';
  const values = data.map((item) => item.value);
  const all = target ? [...values, target] : values;
  const minValue = Math.min(...all);
  const maxValue = Math.max(...all);
  const pad = Math.max((maxValue - minValue) * 0.15, 0.5);
  const low = minValue - pad;
  const high = maxValue + pad;
  const inset = 8;
  const x = (index) => (data.length === 1 ? width / 2 : inset + (index / (data.length - 1)) * (width - inset * 2));
  const y = (value) => inset + (1 - (value - low) / (high - low)) * (height - inset * 2);
  const active = selected !== null ? data[selected] : data[data.length - 1];
  const pick = (clientX) => {
    if (!ref.current || !data.length) return;
    const rect = ref.current.getBoundingClientRect();
    const index = data.length === 1 ? 0 : Math.round(((clientX - rect.left - inset) / (rect.width - inset * 2)) * (data.length - 1));
    setSelected(Math.min(data.length - 1, Math.max(0, index)));
  };
  return (
    <div>
      <div className="fit-chart-caption">{active ? `${active.detail || active.label}: ${active.value.toFixed(decimals)}${unit}` : ''}</div>
      <div ref={ref} style={{ height }}>
        {width > 0 ? (
          <svg
            className="fit-line-svg"
            width={width}
            height={height}
            role="img"
            aria-label={`Trend from ${data[0]?.value}${unit} to ${data[data.length - 1]?.value}${unit}`}
            onMouseMove={(event) => pick(event.clientX)}
            onMouseLeave={() => setSelected(null)}
            onTouchStart={(event) => pick(event.touches[0].clientX)}
            onTouchMove={(event) => pick(event.touches[0].clientX)}
          >
            {[0.25, 0.5, 0.75].map((fraction) => <line key={fraction} x1={0} x2={width} y1={height * fraction} y2={height * fraction} stroke="var(--fit-border)" strokeWidth={1} />)}
            {target ? <line x1={0} x2={width} y1={y(target)} y2={y(target)} stroke="var(--fit-text-3)" strokeWidth={1.5} strokeDasharray="5 5" /> : null}
            {selected !== null ? <line x1={x(selected)} x2={x(selected)} y1={0} y2={height} stroke="var(--fit-text-3)" strokeWidth={1} /> : null}
            {data.length > 1 ? <polyline points={data.map((item, index) => `${x(index)},${y(item.value)}`).join(' ')} fill="none" stroke={stroke} strokeWidth={2} strokeLinejoin="round" strokeLinecap="round" /> : null}
            {data.map((item, index) => (
              <circle key={index} cx={x(index)} cy={y(item.value)} r={selected === index || data.length <= 12 ? 4 : 0} fill={stroke} stroke="var(--fit-surface)" strokeWidth={2} />
            ))}
          </svg>
        ) : null}
      </div>
      {data.length ? (
        <div className="fit-line-axis">
          <span>{data[0].label}</span>
          {target ? <span>- - target {target}{unit}</span> : null}
          <span>{data[data.length - 1].label}</span>
        </div>
      ) : null}
    </div>
  );
};

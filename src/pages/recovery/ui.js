import React, { useEffect, useRef, useState } from 'react';
import * as Md from 'react-icons/md';
import useSpeechToText from '../../hooks/useSpeechToText';
import { Button, Card, FitnessPage, ICONS, Icon, Ring } from '../fitness/ui';
import { STRINGS, fill, makeFormatters, toLocalDigits } from './i18n';

// Web port of expo-connect-app/src/screens/recovery/ui.tsx. Like the Expo
// version it builds on the fitness UI kit.
export {
  BarChart,
  Button,
  Card,
  Chip,
  ChipGroup,
  EmptyState,
  Field,
  HeaderIconButton,
  Icon,
  LineChart,
  Muted,
  OptionCards,
  ProgressBar,
  Ring,
  SectionHeader,
  Segmented,
  Spinner,
  StatTile,
  Stepper,
  errorMessage,
  timezone,
} from '../fitness/ui';

// Material Community icon names used by the Recovery screens (and by the
// server's substance and badge catalog), mapped to react-icons.
Object.assign(ICONS, {
  lifebuoy: Md.MdSupport,
  phone: Md.MdPhone,
  'phone-outline': Md.MdPhone,
  'phone-alert': Md.MdPhoneForwarded,
  'phone-in-talk-outline': Md.MdPhoneInTalk,
  'hand-heart': Md.MdVolunteerActivism,
  'account-heart-outline': Md.MdVolunteerActivism,
  heart: Md.MdFavorite,
  'heart-outline': Md.MdFavoriteBorder,
  'heart-plus-outline': Md.MdHealing,
  sprout: Md.MdSpa,
  'sprout-outline': Md.MdSpa,
  leaf: Md.MdEco,
  'shield-lock-outline': Md.MdLockOutline,
  'lock-outline': Md.MdLockOutline,
  'shield-check': Md.MdVerifiedUser,
  'shield-check-outline': Md.MdGppGood,
  'shield-star-outline': Md.MdGppGood,
  'shield-crown-outline': Md.MdGppGood,
  'shield-alert-outline': Md.MdGppMaybe,
  'alarm-light-outline': Md.MdCrisisAlert,
  'clipboard-text-outline': Md.MdAssignment,
  'lightning-bolt-outline': Md.MdFlashOn,
  star: Md.MdStar,
  'star-outline': Md.MdStarBorder,
  'checkbox-marked-circle': Md.MdCheckCircle,
  'checkbox-blank-circle-outline': Md.MdRadioButtonUnchecked,
  'checkbox-marked': Md.MdCheckBox,
  'checkbox-blank-outline': Md.MdCheckBoxOutlineBlank,
  pill: Md.MdMedication,
  'pill-multiple': Md.MdMedication,
  'diamond-stone': Md.MdDiamond,
  cannabis: Md.MdGrass,
  'cannabis-off': Md.MdGrass,
  smoking: Md.MdSmokingRooms,
  smoke: Md.MdCloud,
  'bottle-tonic-outline': Md.MdMedicationLiquid,
  'flask-outline': Md.MdScience,
  'flask-empty-outline': Md.MdScience,
  'mushroom-outline': Md.MdEco,
  'glass-mug-variant': Md.MdSportsBar,
  spray: Md.MdAir,
  'weather-windy': Md.MdAir,
  'help-circle-outline': Md.MdHelpOutline,
  needle: Md.MdVaccines,
  grain: Md.MdGrain,
  'flag-outline': Md.MdOutlinedFlag,
  'calendar-outline': Md.MdCalendarToday,
  'calendar-clock': Md.MdSchedule,
  'calendar-refresh-outline': Md.MdEventRepeat,
  'calendar-check-outline': Md.MdEventAvailable,
  'calendar-star': Md.MdEventAvailable,
  'chart-line-variant': Md.MdShowChart,
  doctor: Md.MdLocalHospital,
  'hospital-building': Md.MdLocalHospital,
  'medical-bag': Md.MdMedicalServices,
  'map-marker-path': Md.MdRoute,
  'account-plus-outline': Md.MdPersonAdd,
  waves: Md.MdWaves,
  'fast-forward-outline': Md.MdFastForward,
  'hand-back-left-outline': Md.MdPanTool,
  'numeric-4-circle-outline': Md.MdLooks4,
  'numeric-1-circle-outline': Md.MdLooksOne,
  'numeric-2-circle-outline': Md.MdLooksTwo,
  'numeric-3-circle-outline': Md.MdLooks3,
  'numeric-5-circle-outline': Md.MdLooks5,
  'numeric-6-circle-outline': Md.MdLooks6,
  'numeric-7-circle-outline': Md.MdLooks,
  'numeric-8-circle-outline': Md.MdLooks,
  'numeric-9-circle-outline': Md.MdLooks,
  'gamepad-variant-outline': Md.MdSportsEsports,
  'dice-5-outline': Md.MdCasino,
  'chess-knight': Md.MdExtension,
  'circle-small': Md.MdCircle,
  'message-text-outline': Md.MdMessage,
  'message-question-outline': Md.MdContactSupport,
  'view-grid-outline': Md.MdGridView,
  restart: Md.MdRestartAlt,
  'home-outline': Md.MdHome,
  'cloud-upload-outline': Md.MdCloudUpload,
  'chevron-right': Md.MdChevronRight,
  'check-bold': Md.MdCheck,
  play: Md.MdPlayArrow,
  pause: Md.MdPause,
  stop: Md.MdStop,
  'play-circle-outline': Md.MdPlayCircleOutline,
  'robot-off-outline': Md.MdBlock,
  'volume-high': Md.MdVolumeUp,
  'stop-circle-outline': Md.MdStopCircle,
  'link-variant': Md.MdLink,
  'trophy-outline': Md.MdEmojiEvents,
  'human-child': Md.MdChildCare,
  'open-in-new': Md.MdOpenInNew,
  'check-decagram': Md.MdVerified,
  'medal-outline': Md.MdMilitaryTech,
  'party-popper': Md.MdCelebration,
  'cash-multiple': Md.MdPayments,
  'close-circle-outline': Md.MdHighlightOff,
  'progress-clock': Md.MdTimelapse,
  'content-save-outline': Md.MdSave,
  'pencil-outline': Md.MdEdit,
  'export-variant': Md.MdIosShare,
  'delete-outline': Md.MdDeleteOutline,
  'swap-horizontal': Md.MdSwapHoriz,
  'alert-outline': Md.MdWarningAmber,
  microphone: Md.MdMic,
  'microphone-off': Md.MdMicOff,
});

/** Fixed hues; each use is paired with text so meaning never relies on colour alone. */
export const REC = {
  sos: '#E5484D',
  // Deeper red for filled SOS buttons so white text is 4.8:1.
  sosFill: '#D92D3A',
  calm: '#3987e5',
  money: '#199e70',
  warm: '#c98500',
};

// ---------------------------------------------------------------------------
// Phone, SMS and links
// ---------------------------------------------------------------------------
export const callPhone = (phone) => {
  window.location.href = `tel:${String(phone).replace(/[^\d+]/g, '')}`;
};

export const sendSms = (phone, body) => {
  window.location.href = `sms:${String(phone).replace(/[^\d+]/g, '')}?body=${encodeURIComponent(body)}`;
};

export const openLink = (url) => window.open(url, '_blank', 'noopener,noreferrer');

// ---------------------------------------------------------------------------
// Page with a one-tap SOS button in the header of every Recovery screen
// ---------------------------------------------------------------------------
export const RecoveryPage = ({ right, showSos = true, navigation, onRefresh, refreshing, ...props }) => (
  <FitnessPage
    {...props}
    section="Recovery"
    onBack={navigation?.goBack}
    right={
      right || showSos || onRefresh ? (
        <div className="rec-header-right">
          {onRefresh ? (
            <button type="button" className="fit-icon-btn" aria-label="Refresh" title="Refresh" onClick={onRefresh} disabled={refreshing}>
              <Icon name="refresh" size={20} className={refreshing ? 'rec-spin' : ''} />
            </button>
          ) : null}
          {right}
          {showSos ? (
            <button type="button" className="rec-sos-header" aria-label="SOS" title="SOS" onClick={() => navigation?.navigate('RecoverySos')}>
              <Icon name="lifebuoy" size={20} color="#ffffff" />
            </button>
          ) : null}
        </div>
      ) : undefined
    }
  />
);

/** Large, gently pulsing SOS button used in the sticky footer. */
export const SosButton = ({ label, onPress }) => (
  <button type="button" className="rec-sos-button" onClick={onPress}>
    <span className="rec-sos-pulse" aria-hidden="true" />
    <Icon name="lifebuoy" size={22} color="#ffffff" />
    <span>{label}</span>
  </button>
);

export const EmergencyStrip = ({ lang }) => (
  <a className="rec-strip" href="tel:999">
    <Icon name="phone-alert" size={16} color={REC.sos} />
    <span>{STRINGS[lang].common.emergencyStrip}</span>
  </a>
);

export const Banner = ({ icon, text, tone = 'neutral' }) => (
  <div className={`rec-banner is-${tone}`} role={tone === 'warn' ? 'alert' : 'status'}>
    <Icon name={icon} size={18} />
    <span>{text}</span>
  </div>
);

// ---------------------------------------------------------------------------
// Crisis card: curated message + one-tap calls. Never depends on AI.
// ---------------------------------------------------------------------------
export const CrisisCard = ({ crisis, contacts = [], lang, onMoreHelp }) => {
  const s = STRINGS[lang].crisis;
  const lines = (crisis.helplines || []).filter((line) => line.phone && line.phone !== '999');
  return (
    <div role="alert" className="rec-crisis">
      <div className="rec-row-head">
        <Icon name="hand-heart" size={22} color={REC.sos} />
        <h3 className="rec-crisis-title">{s.title}</h3>
      </div>
      <p className="rec-crisis-body">{crisis.message}</p>
      <a className="rec-call999" href="tel:999">
        <Icon name="phone" size={20} color="#ffffff" />
        {s.call999}
      </a>
      {lines.map((line) => (
        <a key={line.key} className="rec-crisis-line" href={`tel:${line.phone}`}>
          <Icon name="phone-outline" size={18} color="var(--fit-primary)" />
          <span style={{ flex: 1 }}>
            <span className="rec-line-name">{fill(s.call, { name: line.name })}</span>
            <span className="rec-line-meta">{[line.display, line.hours].filter(Boolean).join(' · ')}</span>
          </span>
        </a>
      ))}
      {contacts
        .filter((contact) => contact.phone)
        .slice(0, 2)
        .map((contact) => (
          <a key={`${contact.name}-${contact.phone}`} className="rec-crisis-line" href={`tel:${contact.phone.replace(/[^\d+]/g, '')}`}>
            <Icon name="account-heart-outline" size={18} color="var(--fit-primary)" />
            <span className="rec-line-name" style={{ flex: 1 }}>{fill(s.call, { name: contact.name || contact.phone })}</span>
          </a>
        ))}
      {onMoreHelp ? <Button label={s.moreHelp} variant="ghost" icon="lifebuoy" onClick={onMoreHelp} /> : null}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Live clean-time counter (ticks every second)
// ---------------------------------------------------------------------------
const pad = (value) => String(value).padStart(2, '0');

export const CleanTimeCounter = ({ since, until, lang, offsetMs = 0 }) => {
  const [now, setNow] = useState(() => Date.now() + offsetMs);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now() + offsetMs), 1000);
    return () => clearInterval(timer);
  }, [offsetMs]);
  const s = STRINGS[lang].common;
  const { num } = makeFormatters(lang);
  const target = until ?? (since ? Date.parse(since) : now);
  const ms = Math.max(0, until ? target - now : now - target);
  const days = Math.floor(ms / 86400000);
  const hours = Math.floor((ms % 86400000) / 3600000);
  const minutes = Math.floor((ms % 3600000) / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  return (
    <div className="rec-counter" aria-label={`${days} ${s.days} ${hours} ${s.hours} ${minutes} ${s.minutes}`}>
      <div className="rec-counter-days">{num(days)}</div>
      <div className="rec-counter-unit">{days === 1 ? s.day : s.days}</div>
      <div className="rec-counter-clock" aria-hidden="true">{toLocalDigits(`${pad(hours)}:${pad(minutes)}:${pad(seconds)}`, lang)}</div>
    </div>
  );
};

// ---------------------------------------------------------------------------
// Breathing guide
// ---------------------------------------------------------------------------
const PATTERNS = {
  box: [
    { kind: 'in', seconds: 4 },
    { kind: 'hold', seconds: 4 },
    { kind: 'out', seconds: 4 },
    { kind: 'hold', seconds: 4 },
  ],
  relax: [
    { kind: 'in', seconds: 4 },
    { kind: 'hold', seconds: 7 },
    { kind: 'out', seconds: 8 },
  ],
};

const vibrate = (pattern) => {
  try {
    navigator.vibrate?.(pattern);
  } catch (_) {
    // Not supported.
  }
};

export const BreathingCircle = ({ lang, autoStart = false, onRound }) => {
  const s = STRINGS[lang].sos;
  const { num } = makeFormatters(lang);
  const [pattern, setPattern] = useState('box');
  const [running, setRunning] = useState(autoStart);
  const [index, setIndex] = useState(0);
  const [count, setCount] = useState(PATTERNS.box[0].seconds);
  const [round, setRound] = useState(1);
  const [expanded, setExpanded] = useState(false);
  const roundRef = useRef(1);
  const phases = PATTERNS[pattern];
  const phase = phases[index];

  useEffect(() => {
    if (!running) return undefined;
    vibrate(20);
    setCount(phase.seconds);
    if (phase.kind !== 'hold') setExpanded(phase.kind === 'in');
    const tick = setInterval(() => setCount((value) => Math.max(1, value - 1)), 1000);
    const next = setTimeout(() => {
      const nextIndex = (index + 1) % phases.length;
      if (nextIndex === 0) {
        onRound?.(roundRef.current);
        roundRef.current += 1;
        setRound(roundRef.current);
      }
      setIndex(nextIndex);
    }, phase.seconds * 1000);
    return () => {
      clearInterval(tick);
      clearTimeout(next);
    };
  }, [running, index, pattern]); // eslint-disable-line react-hooks/exhaustive-deps

  const stop = () => {
    setRunning(false);
    setIndex(0);
    roundRef.current = 1;
    setRound(1);
    setExpanded(false);
  };

  const label = !running ? s.begin : phase.kind === 'in' ? s.breathIn : phase.kind === 'out' ? s.breathOut : s.hold;
  const transition = running && phase.kind !== 'hold' ? `transform ${phase.seconds}s ease-in-out` : 'transform 0.4s ease';
  return (
    <div className="rec-breath">
      <div className="fit-chip-group" style={{ justifyContent: 'center', marginBottom: 8 }}>
        {['box', 'relax'].map((key) => (
          <button
            key={key}
            type="button"
            aria-pressed={pattern === key}
            className={`fit-chip${pattern === key ? ' is-selected' : ''}`}
            onClick={() => {
              stop();
              setPattern(key);
            }}
          >
            {key === 'box' ? s.boxPattern : s.relaxPattern}
          </button>
        ))}
      </div>
      <button type="button" className="rec-breath-area" aria-label={label} onClick={() => (running ? stop() : setRunning(true))}>
        <span className="rec-breath-glow" style={{ transform: `scale(${expanded ? 1 : 0.55})`, transition }} />
        <span className="rec-breath-core" style={{ transform: `scale(${expanded ? 1 : 0.55})`, transition }} />
        <span className="rec-breath-label" aria-live="polite">
          <span className="rec-breath-phase">{label}</span>
          {running ? <span className="rec-breath-count">{num(count)}</span> : null}
        </span>
      </button>
      <div className="fit-muted" style={{ minHeight: 20 }}>{running ? fill(s.round, { n: num(round) }) : ''}</div>
      {running ? <Button label={s.stop} icon="stop" onClick={stop} /> : null}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Urge-surfing timer
// ---------------------------------------------------------------------------
export const UrgeTimer = ({ lang, minutes = 10, onComplete }) => {
  const s = STRINGS[lang].sos;
  const total = minutes * 60 * 1000;
  const [remaining, setRemaining] = useState(total);
  const [endAt, setEndAt] = useState(null);
  const completed = useRef(false);

  useEffect(() => {
    if (!endAt) return undefined;
    const timer = setInterval(() => {
      const left = Math.max(0, endAt - Date.now());
      setRemaining(left);
      if (left === 0) {
        clearInterval(timer);
        setEndAt(null);
        if (!completed.current) {
          completed.current = true;
          vibrate([0, 200, 120, 200]);
          onComplete?.();
        }
      }
    }, 500);
    return () => clearInterval(timer);
  }, [endAt, onComplete]);

  const running = endAt !== null;
  const done = remaining === 0;
  const mm = Math.floor(remaining / 60000);
  const ss = Math.floor((remaining % 60000) / 1000);
  return (
    <div className="rec-center-col">
      <Ring size={190} stroke={12} progress={1 - remaining / total} color={done ? 'var(--fit-success)' : 'var(--fit-primary)'}>
        {done ? <Icon name="check-bold" size={44} color="var(--fit-success)" /> : <Icon name="waves" size={28} color="var(--fit-primary)" />}
        <span className="rec-timer-text">{toLocalDigits(`${pad(mm)}:${pad(ss)}`, lang)}</span>
        <span className="fit-muted fit-small">{done ? '' : s.left}</span>
      </Ring>
      {done ? (
        <div className="rec-timer-done">{s.waveDone}</div>
      ) : (
        <Button
          label={running ? s.pause : remaining < total ? s.resume : s.startTimer}
          icon={running ? 'pause' : 'play'}
          variant={running ? 'secondary' : 'primary'}
          onClick={() => setEndAt(running ? null : Date.now() + remaining)}
        />
      )}
    </div>
  );
};

// ---------------------------------------------------------------------------
// Scales and chips
// ---------------------------------------------------------------------------
export const NumberScale = ({ min, max, value, onChange, lang, lowLabel, highLabel, danger }) => {
  const values = Array.from({ length: max - min + 1 }, (_, index) => min + index);
  return (
    <div>
      <div className="rec-scale" role="radiogroup">
        {values.map((item) => {
          const selected = value === item;
          const hot = danger && item >= Math.ceil(max * 0.7);
          return (
            <button key={item} type="button" role="radio" aria-checked={selected} aria-label={String(item)} className={`rec-scale-item${selected ? ' is-selected' : ''}${hot ? ' is-hot' : ''}`} onClick={() => onChange(item)}>
              {toLocalDigits(String(item), lang)}
            </button>
          );
        })}
      </div>
      {lowLabel || highLabel ? (
        <div className="rec-scale-labels">
          <span>{lowLabel}</span>
          <span>{highLabel}</span>
        </div>
      ) : null}
    </div>
  );
};

const MOOD_FACES = ['😞', '🙁', '😐', '🙂', '😄'];

export const MoodScale = ({ value, onChange, labels }) => (
  <div className="rec-mood" role="radiogroup">
    {MOOD_FACES.map((face, index) => {
      const selected = value === index + 1;
      return (
        <button key={face} type="button" role="radio" aria-checked={selected} aria-label={labels[index]} className={`rec-mood-item${selected ? ' is-selected' : ''}`} onClick={() => onChange(index + 1)}>
          <span className="rec-mood-face" aria-hidden="true">{face}</span>
          <span className="rec-mood-label">{labels[index]}</span>
        </button>
      );
    })}
  </div>
);

/** Multi-select chips. */
export const MultiChips = ({ options, values, onToggle }) => (
  <div className="fit-chip-group">
    {options.map((option) => {
      const selected = values.includes(option.key);
      return (
        <button key={option.key} type="button" role="checkbox" aria-checked={selected} className={`fit-chip${selected ? ' is-selected' : ''}`} onClick={() => onToggle(option.key)}>
          {selected ? <Icon name="check" size={14} /> : null}
          {option.label}
        </button>
      );
    })}
  </div>
);

/** A titled block inside a card. */
export const Question = ({ title, hint, children }) => (
  <div className="rec-question">
    <div className="rec-question-title">{title}</div>
    {hint ? <div className="rec-question-hint">{hint}</div> : null}
    <div style={{ marginTop: 10 }}>{children}</div>
  </div>
);

export const InfoCard = ({ icon, title, children, tone }) => (
  <Card>
    <div className="rec-row-head">
      <Icon name={icon} size={20} color={tone || 'var(--fit-primary)'} />
      <h3 className="rec-info-title">{title}</h3>
    </div>
    {children}
  </Card>
);

export const Toggle = ({ value, onChange, label, disabled }) => (
  <button type="button" role="switch" aria-checked={!!value} aria-label={label} disabled={disabled} className={`fit-switch${value ? ' is-on' : ''}`} onClick={() => onChange(!value)} />
);

/** Multiline text box with an optional microphone (browser speech recognition). */
export const VoiceTextArea = ({ value, onChange, placeholder, maxLength = 1000, lang, rows = 3, className = 'rec-note', onEnter, disabled }) => {
  const valueRef = useRef(value);
  valueRef.current = value;
  const { listening, supported, toggle } = useSpeechToText({
    lang: lang === 'bn' ? 'bn-BD' : 'en-US',
    onFinal: (text) => onChange(`${valueRef.current ? `${valueRef.current} ` : ''}${text}`.slice(0, maxLength)),
  });
  return (
    <div className={className}>
      <textarea
        value={value}
        rows={rows}
        maxLength={maxLength}
        placeholder={placeholder}
        disabled={disabled}
        onChange={(event) => onChange(event.target.value)}
        onKeyDown={(event) => {
          if (onEnter && event.key === 'Enter' && !event.shiftKey) {
            event.preventDefault();
            onEnter();
          }
        }}
      />
      {supported ? (
        <button type="button" className={`rec-mic${listening ? ' is-on' : ''}`} aria-label={listening ? 'Stop dictation' : 'Dictate'} aria-pressed={listening} disabled={disabled} onClick={toggle}>
          <Icon name={listening ? 'microphone-off' : 'microphone'} size={18} />
        </button>
      ) : null}
    </div>
  );
};

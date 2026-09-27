import React, { useCallback, useEffect, useState } from 'react';
import { toast } from 'react-toastify';
import { fitnessApi } from './fitnessApi';
import { Button, Card, ChipGroup, EmptyState, Field, FitnessPage, Icon, Muted, SectionHeader, Spinner, errorMessage, timezone } from './ui';

const TYPES = [
  { value: 'water', label: 'Water', icon: 'cup-water', title: 'Drink water', message: 'Time for a glass of water.' },
  { value: 'meal', label: 'Meal', icon: 'silverware-fork-knife', title: 'Log your meal', message: 'Log your meal to stay on target.' },
  { value: 'workout', label: 'Workout', icon: 'dumbbell', title: 'Workout time', message: 'Time to move. Even 15 minutes counts.' },
  { value: 'weight', label: 'Weigh-in', icon: 'scale-bathroom', title: 'Morning weigh-in', message: 'Weigh in before breakfast for consistent readings.' },
  { value: 'custom', label: 'Custom', icon: 'bell-outline', title: '', message: '' },
];
const DAYS = ['S', 'M', 'T', 'W', 'T', 'F', 'S'];
const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
const typeMeta = (type) => TYPES.find((item) => item.value === type) || TYPES[4];
const displayTime = (time) => {
  const [h, m] = String(time).split(':').map(Number);
  const date = new Date();
  date.setHours(h || 0, m || 0, 0, 0);
  return date.toLocaleTimeString(undefined, { hour: 'numeric', minute: '2-digit' });
};
const daysLabel = (days) => {
  const list = days && days.length ? [...days].sort() : [0, 1, 2, 3, 4, 5, 6];
  if (list.length === 7) return 'Every day';
  if (list.join() === '1,2,3,4,5') return 'Weekdays';
  if (list.join() === '0,6') return 'Weekends';
  return list.map((day) => DAY_NAMES[day].slice(0, 3)).join(', ');
};

const FitnessReminders = () => {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [type, setType] = useState('water');
  const [title, setTitle] = useState(TYPES[0].title);
  const [time, setTime] = useState('12:00');
  const [days, setDays] = useState([0, 1, 2, 3, 4, 5, 6]);
  const [busyId, setBusyId] = useState(null);

  const load = useCallback(() => fitnessApi.getReminders()
    .then((response) => setReminders(response.data.reminders || []))
    .catch(() => {})
    .finally(() => setLoading(false)), []);
  useEffect(() => { load(); }, [load]);

  const chooseType = (value) => { setType(value); const meta = typeMeta(value); if (meta.title) setTitle(meta.title); };
  const toggleDay = (day) => setDays((old) => (old.includes(day) ? (old.length > 1 ? old.filter((d) => d !== day) : old) : [...old, day]));

  const add = async () => {
    if (!title.trim()) { toast.warn('Give your reminder a title.'); return; }
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(time)) { toast.warn('Choose a valid time.'); return; }
    try {
      await fitnessApi.createReminder({ title: title.trim(), time, type, days, message: typeMeta(type).message || undefined, timezone: timezone() });
      toast.success('Reminder added');
      setShowForm(false);
      load();
    } catch (error) { toast.error(errorMessage(error, 'Could not create this reminder.')); }
  };

  const toggle = async (item, enabled) => {
    setReminders((old) => old.map((r) => (r._id === item._id ? { ...r, enabled } : r)));
    try { await fitnessApi.updateReminder(item._id, { enabled }); } catch (error) {
      setReminders((old) => old.map((r) => (r._id === item._id ? { ...r, enabled: !enabled } : r)));
      toast.error(errorMessage(error, 'Could not update this reminder.'));
    }
  };

  const remove = async (item) => {
    if (!window.confirm(`Delete "${item.title}"?`)) return;
    setBusyId(item._id);
    try { await fitnessApi.deleteReminder(item._id); load(); } catch (error) { toast.error(errorMessage(error, 'Could not delete this reminder.')); } finally { setBusyId(null); }
  };

  const enabledCount = reminders.filter((item) => item.enabled).length;

  return (
    <FitnessPage title="Reminders" subtitle={`${enabledCount} active`}>
      <Muted style={{ marginBottom: 12 }}>Small, well-timed nudges are one of the most effective ways to build lasting habits. Reminders arrive as push notifications on the devices where you use Connect.</Muted>
      {showForm ? (
        <Card>
          <div className="fit-card-title" style={{ fontSize: 17, marginBottom: 12 }}>New reminder</div>
          <ChipGroup value={type} onChange={chooseType} options={TYPES} />
          <Field label="Title" value={title} onChange={setTitle} style={{ marginTop: 14 }} maxLength={120} />
          <span className="fit-label">Time</span>
          <label className="fit-time-btn">
            <Icon name="clock-outline" size={20} />
            <input type="time" value={time} onChange={(event) => setTime(event.target.value)} aria-label="Reminder time" />
          </label>
          <span className="fit-label" style={{ marginTop: 14 }}>Repeat</span>
          <div className="fit-days">
            {DAYS.map((label, day) => (
              <button key={day} type="button" aria-label={DAY_NAMES[day]} aria-pressed={days.includes(day)} className={`fit-day${days.includes(day) ? ' is-selected' : ''}`} onClick={() => toggleDay(day)}>{label}</button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 10, marginTop: 12 }}>
            <Button label="Cancel" onClick={() => setShowForm(false)} style={{ flex: 1 }} />
            <Button label="Add reminder" loadingLabel="Adding..." icon="check" variant="primary" onClick={add} style={{ flex: 2 }} />
          </div>
        </Card>
      ) : <Button label="New reminder" icon="plus" variant="primary" onClick={() => setShowForm(true)} />}

      <SectionHeader title="Your reminders" />
      {loading ? <div className="fit-empty"><Spinner large /></div> : reminders.length ? (
        <Card style={{ padding: '4px 16px' }}>
          {reminders.map((item) => (
            <div key={item._id} className="fit-list-row" style={{ gap: 12, padding: '12px 0', opacity: item.enabled ? 1 : 0.55 }}>
              <span className="fit-tile-icon"><Icon name={typeMeta(item.type).icon} size={20} color="var(--fit-primary)" /></span>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: 17, fontWeight: 800 }}>{displayTime(item.time)}</div>
                <div className="fit-muted" style={{ fontSize: 13, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{item.title} · {daysLabel(item.days)}{item.autoGenerated ? ' · suggested' : ''}</div>
              </div>
              <button type="button" role="switch" aria-checked={!!item.enabled} aria-label={`${item.enabled ? 'Disable' : 'Enable'} ${item.title}`} className={`fit-switch${item.enabled ? ' is-on' : ''}`} onClick={() => toggle(item, !item.enabled)} />
              <button type="button" className="fit-trash" aria-label={`Delete ${item.title}`} disabled={busyId === item._id} onClick={() => remove(item)}>
                {busyId === item._id ? <Spinner /> : <Icon name="trash-can-outline" size={20} />}
              </button>
            </div>
          ))}
        </Card>
      ) : <EmptyState icon="bell-sleep-outline" title="No reminders yet" message="Add a water, meal or workout reminder to stay consistent." />}
    </FitnessPage>
  );
};

export default FitnessReminders;

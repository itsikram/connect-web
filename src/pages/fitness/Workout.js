import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { fitnessApi } from './fitnessApi';
import { Button, Card, Chip, FIT, Field, FitnessPage, Icon, Muted, SectionHeader, Segmented, Stepper, WORKOUT_TYPES, errorMessage, fmt, shortDate, workoutMeta } from './ui';

// Mirrors server/utils/fitnessCalculations.js WORKOUT_METS for the live estimate.
const METS = {
  walking: { light: 2.8, moderate: 3.5, vigorous: 5 },
  running: { light: 7, moderate: 9.8, vigorous: 11.5 },
  cycling: { light: 4, moderate: 6.8, vigorous: 10 },
  strength: { light: 3.5, moderate: 5, vigorous: 6 },
  hiit: { light: 6, moderate: 8, vigorous: 10 },
  yoga: { light: 2.5, moderate: 3, vigorous: 4 },
  swimming: { light: 5, moderate: 7, vigorous: 9.8 },
  sports: { light: 4.5, moderate: 6.5, vigorous: 8 },
  cardio: { light: 4, moderate: 6, vigorous: 8 },
  other: { light: 3, moderate: 4.5, vigorous: 6 },
};

const TEMPLATES = [
  { key: 'walk', name: 'Brisk walk', type: 'walking', durationMin: 30, intensity: 'moderate', icon: 'walk' },
  { key: 'run', name: '5K run', type: 'running', durationMin: 30, intensity: 'moderate', icon: 'run-fast' },
  {
    key: 'fullbody', name: 'Full-body strength', type: 'strength', durationMin: 45, intensity: 'moderate', icon: 'dumbbell',
    exercises: [{ name: 'Squats', sets: 3, reps: 10 }, { name: 'Push-ups', sets: 3, reps: 12 }, { name: 'Dumbbell rows', sets: 3, reps: 10 }, { name: 'Plank (sec)', sets: 3, reps: 45 }],
  },
  { key: 'hiit', name: 'HIIT circuit', type: 'hiit', durationMin: 20, intensity: 'vigorous', icon: 'lightning-bolt' },
  { key: 'yoga', name: 'Yoga & mobility', type: 'yoga', durationMin: 30, intensity: 'light', icon: 'meditation' },
  { key: 'cycle', name: 'Cycling', type: 'cycling', durationMin: 45, intensity: 'moderate', icon: 'bike' },
];

const COMMON_EXERCISES = ['Squats', 'Push-ups', 'Bench press', 'Deadlift', 'Lunges', 'Pull-ups', 'Shoulder press', 'Dumbbell rows', 'Bicep curls', 'Plank (sec)'];

const INTENSITY_HINTS = {
  light: 'Easy pace. You can sing or chat comfortably.',
  moderate: 'Breathing harder. You can talk, but not sing.',
  vigorous: 'Hard effort. Only a few words between breaths.',
};

const FitnessWorkout = () => {
  const navigate = useNavigate();
  const preset = useLocation().state?.preset;
  const [type, setType] = useState('walking');
  const [name, setName] = useState('');
  const [durationMin, setDurationMin] = useState(30);
  const [intensity, setIntensity] = useState('moderate');
  const [exercises, setExercises] = useState([]);
  const [notes, setNotes] = useState('');
  const [calorieOverride, setCalorieOverride] = useState('');
  const [weightKg, setWeightKg] = useState(70);
  const [recent, setRecent] = useState([]);

  const applyTemplate = (template) => {
    setType(template.type);
    setName(template.name);
    setDurationMin(template.durationMin);
    setIntensity(template.intensity);
    setExercises(template.exercises ? template.exercises.map(({ name: exerciseName, sets, reps, weightKg: kg }) => ({ name: exerciseName, sets, reps, weightKg: kg })) : []);
    setCalorieOverride('');
  };

  useEffect(() => {
    const template = TEMPLATES.find((item) => item.key === preset);
    if (template) applyTemplate(template);
    fitnessApi.getProfile().then((response) => { if (response.data.profile?.weightKg) setWeightKg(response.data.profile.weightKg); }).catch(() => {});
    fitnessApi.getWorkouts(30).then((response) => {
      const seen = new Set();
      setRecent((response.data.workouts || []).filter((workout) => {
        const key = workout.name.toLowerCase();
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, 6));
    }).catch(() => {});
  }, [preset]);

  const estimate = useMemo(() => Math.round((METS[type]?.[intensity] || 4.5) * weightKg * (durationMin / 60)), [type, intensity, weightKg, durationMin]);
  const calories = calorieOverride ? Number(calorieOverride) || 0 : estimate;

  const updateExercise = (index, key, value) => {
    setExercises((old) => old.map((item, i) => (i === index ? { ...item, [key]: key === 'name' ? value : Number(value.replace(/[^0-9.]/g, '')) || undefined } : item)));
  };

  const save = async () => {
    if (durationMin < 1) { toast.warn('Add a duration of at least 1 minute.'); return; }
    try {
      await fitnessApi.createWorkout({
        name: name.trim() || workoutMeta(type).label,
        type,
        intensity,
        durationMin,
        caloriesBurned: calories,
        exercises: exercises.filter((item) => item.name.trim()),
        notes: notes.trim() || undefined,
        date: new Date().toISOString(),
      });
      toast.success('Workout logged');
      navigate(-1);
    } catch (error) {
      toast.error(errorMessage(error, 'Could not save this workout.'));
    }
  };

  return (
    <FitnessPage
      title="Log workout"
      footer={
        <>
          <div style={{ flex: 1 }}>
            <div className="fit-footer-kcal">{fmt(calories)} kcal</div>
            <div className="fit-muted" style={{ fontSize: 12 }}>{durationMin} min · {intensity}</div>
          </div>
          <Button label="Save workout" loadingLabel="Saving..." icon="check" variant="primary" onClick={save} auto />
        </>
      }
    >
      <SectionHeader title="Quick start" />
      <div className="fit-hscroll" style={{ gap: 10 }}>
        {TEMPLATES.map((template) => (
          <button key={template.key} type="button" className={`fit-template${name === template.name ? ' is-selected' : ''}`} onClick={() => applyTemplate(template)}>
            <Icon name={template.icon} size={24} />
            <span className="fit-item-name" style={{ marginTop: 4 }}>{template.name}</span>
            <span className="fit-item-sub">{template.durationMin} min</span>
          </button>
        ))}
      </div>

      <SectionHeader title="Activity" />
      <div className="fit-type-grid" role="radiogroup">
        {WORKOUT_TYPES.map((item) => (
          <button
            key={item.value}
            type="button"
            role="radio"
            aria-checked={item.value === type}
            className={`fit-type${item.value === type ? ' is-selected' : ''}`}
            onClick={() => { setType(item.value); if (!name || WORKOUT_TYPES.some((t) => t.label === name)) setName(item.label); }}
          >
            <Icon name={item.icon} size={22} />
            {item.label}
          </button>
        ))}
      </div>

      <Field label="Name" value={name} onChange={setName} placeholder={workoutMeta(type).label} style={{ marginTop: 12 }} />

      <Card>
        <span className="fit-label" style={{ marginBottom: 10 }}>Duration</span>
        <Stepper value={durationMin} onChange={setDurationMin} step={5} min={5} max={600} suffix="min" />
        <div className="fit-chip-group" style={{ marginTop: 14 }}>
          {[15, 30, 45, 60, 90].map((minutes) => <Chip key={minutes} label={`${minutes}`} selected={durationMin === minutes} onClick={() => setDurationMin(minutes)} />)}
        </div>
      </Card>

      <Card>
        <span className="fit-label" style={{ marginBottom: 10 }}>Intensity</span>
        <Segmented value={intensity} onChange={setIntensity} options={[{ label: 'Light', value: 'light' }, { label: 'Moderate', value: 'moderate' }, { label: 'Vigorous', value: 'vigorous' }]} />
        <Muted style={{ fontSize: 13 }}>{INTENSITY_HINTS[intensity]}</Muted>
      </Card>

      <Card>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <Icon name="fire" size={24} color={FIT.workout} />
          <div style={{ flex: 1 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>~{fmt(estimate)} kcal burned</div>
            <Muted style={{ fontSize: 12 }}>Estimated from activity type, intensity, duration and your {weightKg} kg body weight.</Muted>
          </div>
        </div>
        <Field label="Use a watch reading instead (optional)" value={calorieOverride} onChange={(value) => setCalorieOverride(value.replace(/[^0-9]/g, ''))} inputMode="numeric" suffix="kcal" style={{ marginTop: 12, marginBottom: 0 }} />
      </Card>

      {type === 'strength' || type === 'hiit' || exercises.length ? (
        <>
          <SectionHeader title="Exercises" action="Add" onAction={() => setExercises((old) => [...old, { name: '', sets: 3, reps: 10 }])} />
          <Card>
            {exercises.length ? (
              <div>
                <div className="fit-ex-head">
                  <span style={{ flex: 1 }}>Exercise</span>
                  <span className="fit-ex-small">Sets</span>
                  <span className="fit-ex-small">Reps</span>
                  <span className="fit-ex-small">kg</span>
                  <span style={{ width: 24 }} />
                </div>
                {exercises.map((exercise, index) => (
                  <div key={index} className="fit-exercise-row">
                    <input className="fit-ex-input" style={{ flex: 1 }} value={exercise.name} onChange={(event) => updateExercise(index, 'name', event.target.value)} placeholder="Exercise" aria-label="Exercise name" />
                    {['sets', 'reps', 'weightKg'].map((key) => (
                      <input key={key} className="fit-ex-input fit-ex-small" inputMode="decimal" value={exercise[key] ? String(exercise[key]) : ''} onChange={(event) => updateExercise(index, key, event.target.value)} placeholder="-" aria-label={key === 'weightKg' ? 'Weight in kg' : key} />
                    ))}
                    <button type="button" className="fit-trash" aria-label="Remove exercise" onClick={() => setExercises((old) => old.filter((_, i) => i !== index))}><Icon name="close" size={20} /></button>
                  </div>
                ))}
              </div>
            ) : <Muted style={{ fontSize: 13, marginBottom: 8 }}>Track sets, reps and weight to see your strength progress.</Muted>}
            <div className="fit-chip-group" style={{ marginTop: 12 }}>
              {COMMON_EXERCISES.filter((exercise) => !exercises.some((item) => item.name === exercise)).slice(0, 6).map((exercise) => (
                <Chip key={exercise} label={`+ ${exercise}`} onClick={() => setExercises((old) => [...old, { name: exercise, sets: 3, reps: exercise.includes('sec') ? 45 : 10 }])} />
              ))}
            </div>
          </Card>
        </>
      ) : null}

      <Field label="Notes (optional)" value={notes} onChange={setNotes} placeholder="How did it feel? Any personal bests?" multiline />

      {recent.length ? (
        <>
          <SectionHeader title="Repeat a recent workout" />
          <Card style={{ padding: '4px 16px' }}>
            {recent.map((workout) => (
              <button key={workout._id} type="button" className="fit-food-row fit-list-sep" onClick={() => applyTemplate(workout)}>
                <Icon name={workoutMeta(workout.type).icon} size={20} color={FIT.workout} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div className="fit-item-name">{workout.name}</div>
                  <div className="fit-item-sub">{shortDate(workout.date)} · {workout.durationMin} min · {fmt(workout.caloriesBurned)} kcal</div>
                </div>
                <Icon name="replay" size={20} />
              </button>
            ))}
          </Card>
        </>
      ) : null}
    </FitnessPage>
  );
};

export default FitnessWorkout;

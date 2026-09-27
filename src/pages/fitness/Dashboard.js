import React, { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { fitnessApi } from './fitnessApi';
import { fitPath } from './paths';
import {
  BarChart, Button, Card, EmptyState, FIT, FitnessPage, Icon, MEAL_TYPES, Muted, ProgressBar, Ring,
  SectionHeader, Sheet, Spinner, Stepper, errorMessage, fmt, greeting, num, ratio, shortDay, workoutMeta,
} from './ui';

const PILLAR_ACTIONS = {
  nutrition: { title: 'Log your next meal', body: 'Tracking every meal is the #1 predictor of reaching a nutrition goal.', icon: 'silverware-fork-knife', cta: 'Add meal', route: 'meal' },
  protein: { title: 'Prioritise protein', body: 'Protein keeps you full and protects muscle. Add a protein-rich meal or snack.', icon: 'food-drumstick', cta: 'Get ideas', route: 'ideas' },
  hydration: { title: 'Drink a glass of water', body: 'You are behind on hydration today. A glass now keeps energy and focus up.', icon: 'cup-water', cta: '+250 ml' },
  steps: { title: 'Take a 10-minute walk', body: 'A brisk 10-minute walk adds roughly 1,000 steps.', icon: 'walk', cta: 'Log walk', route: 'workout' },
  activity: { title: 'Get 30 active minutes', body: 'Any movement counts: a workout, a sport, or a brisk walk.', icon: 'dumbbell', cta: 'Log workout', route: 'workout' },
  sleep: { title: 'Log last night’s sleep', body: '7–9 hours of sleep supports recovery, appetite control and mood.', icon: 'power-sleep', cta: 'Log sleep' },
};

const scoreLabel = (score) => (score >= 85 ? 'Excellent' : score >= 65 ? 'On track' : score >= 40 ? 'Building' : 'Just getting started');

const FitnessDashboard = () => {
  const navigate = useNavigate();
  const go = (name, state) => navigate(fitPath(name), state ? { state } : undefined);
  const [data, setData] = useState(() => fitnessApi.getCachedDashboard());
  const [loading, setLoading] = useState(!data);
  const [error, setError] = useState('');
  const [sheet, setSheet] = useState(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const mounted = useRef(true);

  const refresh = useCallback(async () => {
    setError('');
    try {
      const response = await fitnessApi.getDashboard();
      if (!mounted.current) return;
      setData(response.data);
      fitnessApi.cacheDashboard(response.data);
    } catch (requestError) {
      if (mounted.current) setError(errorMessage(requestError, 'Could not load your fitness summary.'));
    } finally {
      if (mounted.current) setLoading(false);
    }
  }, []);

  useEffect(() => {
    mounted.current = true;
    refresh();
    const onFocus = () => { if (document.visibilityState === 'visible') refresh(); };
    document.addEventListener('visibilitychange', onFocus);
    return () => { mounted.current = false; document.removeEventListener('visibilitychange', onFocus); };
  }, [refresh]);

  useEffect(() => {
    if (!menuOpen) return undefined;
    const close = () => setMenuOpen(false);
    window.addEventListener('click', close);
    return () => window.removeEventListener('click', close);
  }, [menuOpen]);

  const updateHabits = async (patch, optimistic) => {
    const previous = data;
    setData((old) => ({ ...old, habits: { ...old.habits, ...optimistic } }));
    try {
      const response = await fitnessApi.updateDaily(patch);
      const daily = response.data.daily || {};
      setData((old) => ({ ...old, habits: { ...old.habits, waterMl: daily.waterMl ?? 0, steps: daily.steps ?? 0, sleepHours: daily.sleepHours ?? 0 } }));
      refresh();
    } catch (requestError) {
      setData(previous);
      toast.error(errorMessage(requestError, 'Could not save. Please try again.'));
    }
  };

  const addWater = (amount) => updateHabits({ addWaterMl: amount }, { waterMl: Math.max(0, (data?.habits?.waterMl || 0) + amount) });

  const deleteMeal = async (meal) => {
    if (!window.confirm(`Remove "${meal.name}" from today?`)) return;
    try { await fitnessApi.deleteMeal(meal._id); refresh(); } catch (e) { toast.error(errorMessage(e, 'Could not delete this meal')); }
  };

  const deleteWorkout = async (workout) => {
    if (!window.confirm(`Remove "${workout.name}"?`)) return;
    try { await fitnessApi.deleteWorkout(workout._id); refresh(); } catch (e) { toast.error(errorMessage(e, 'Could not delete this workout')); }
  };

  const reset = async () => {
    setMenuOpen(false);
    if (!window.confirm('Reset fitness data?\n\nThis permanently deletes your profile, meals, workouts, weights, habits and reminders.')) return;
    try {
      await fitnessApi.resetFitness();
      fitnessApi.clearDashboardCache();
      setData({ profile: null });
    } catch (e) { toast.error(errorMessage(e, 'Could not reset fitness data')); }
  };

  const settingsButton = (
    <div style={{ position: 'relative' }}>
      <button type="button" className="fit-icon-btn" aria-label="Fitness settings" aria-haspopup="menu" aria-expanded={menuOpen} onClick={(event) => { event.stopPropagation(); setMenuOpen((open) => !open); }}>
        <Icon name="cog-outline" size={20} />
      </button>
      {menuOpen ? (
        <div className="fit-menu" role="menu">
          <button type="button" role="menuitem" onClick={() => go('setup', { edit: true })}><Icon name="target" size={18} /> Edit my plan</button>
          <button type="button" role="menuitem" onClick={() => go('reminders')}><Icon name="bell-ring-outline" size={18} /> Reminders</button>
          <button type="button" role="menuitem" className="is-danger" onClick={reset}><Icon name="trash-can-outline" size={18} /> Reset all fitness data</button>
        </div>
      ) : null}
    </div>
  );

  if (loading && !data) {
    return <FitnessPage title="Fitness"><div className="fit-empty" style={{ paddingTop: 60 }}><Spinner large /><Muted style={{ marginTop: 12 }}>Loading your day...</Muted></div></FitnessPage>;
  }
  if (error && !data) {
    return <FitnessPage title="Fitness"><EmptyState icon="wifi-off" title="Could not load your summary" message={error} action="Try again" onAction={() => { setLoading(true); refresh(); }} /></FitnessPage>;
  }
  if (!data?.profile) {
    return (
      <FitnessPage title="Fitness">
        <Card style={{ textAlign: 'center', padding: '28px 20px' }}>
          <div className="fit-hero-icon"><Icon name="heart-pulse" size={34} /></div>
          <h2 className="fit-welcome-title">Your personal health coach</h2>
          <Muted style={{ marginTop: 6 }}>Answer a few questions and get science-based daily targets for calories, macros, water, steps, workouts and sleep, plus a projected date for reaching your goal.</Muted>
          <div style={{ textAlign: 'left', maxWidth: 360, margin: '0 auto' }}>
            {[
              ['target', 'Personal calorie & macro targets'],
              ['chart-line', 'Weight trend and goal projection'],
              ['run', 'Workout, steps, water & sleep tracking'],
              ['robot-happy-outline', 'AI meal analysis and coaching'],
            ].map(([icon, text]) => <div key={text} className="fit-feature"><Icon name={icon} size={20} />{text}</div>)}
          </div>
          <Button label="Create my plan" icon="arrow-right" variant="primary" onClick={() => go('setup')} style={{ marginTop: 18 }} />
        </Card>
      </FitnessPage>
    );
  }

  const { profile, totals = {}, burn = {}, habits = {}, week = [], weekSummary = {}, goalProgress, score, streak = 0 } = data;
  const target = num(profile.targetCalories);
  const eaten = num(totals.calories);
  const burned = num(burn.caloriesBurned);
  const remaining = target - eaten + burned;
  const over = remaining < 0;
  const macros = [
    { label: 'Protein', value: totals.proteinG, target: profile.macros?.proteinG, color: FIT.protein },
    { label: 'Carbs', value: totals.carbsG, target: profile.macros?.carbsG, color: FIT.carbs },
    { label: 'Fat', value: totals.fatG, target: profile.macros?.fatG, color: FIT.fat },
  ];
  const weakest = (score?.pillars || []).filter((pillar) => pillar.percent < 100).sort((a, b) => a.percent * b.weight - b.percent * a.weight)[0];
  const nextAction = weakest ? PILLAR_ACTIONS[weakest.key] : null;
  const runAction = () => {
    if (!weakest || !nextAction) return;
    if (weakest.key === 'hydration') { addWater(250); return; }
    if (weakest.key === 'sleep') { setSheet('sleep'); return; }
    go(nextAction.route, weakest.key === 'steps' ? { preset: 'walk' } : undefined);
  };
  const meals = data.meals || [];
  const workouts = data.workouts || [];
  const dateLabel = new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'long', day: 'numeric' });

  return (
    <FitnessPage title="Fitness" subtitle={dateLabel} right={settingsButton}>
      {error ? <div className="fit-banner"><Icon name="cloud-off-outline" size={16} /> Offline. Showing your last saved summary.</div> : null}

      <div className="fit-greeting-row">
        <h2 className="fit-greeting">{greeting()}</h2>
        <span className="fit-streak" title="Consecutive days with a log">
          <Icon name="fire" size={16} color={streak > 0 ? FIT.carbs : 'var(--fit-text-3)'} />
          {streak} day{streak === 1 ? '' : 's'}
        </span>
      </div>

      <Card>
        <div className="fit-calorie-row">
          <Ring size={138} stroke={13} progress={ratio(eaten, target + burned)} color={over ? FIT.warning : FIT.primary}>
            <span className="fit-ring-number">{fmt(Math.abs(remaining))}</span>
            <span className="fit-ring-label">{over ? 'kcal over' : 'kcal left'}</span>
          </Ring>
          <div className="fit-calorie-stats">
            <CalorieLine icon="flag-checkered" label="Target" value={target} />
            <CalorieLine icon="silverware-fork-knife" label="Food" value={eaten} sign="-" />
            <CalorieLine icon="fire" label="Exercise" value={burned} sign="+" />
          </div>
        </div>
        <div className="fit-divider" />
        <div className="fit-macro-row">
          {macros.map((macro) => (
            <div key={macro.label} className="fit-macro">
              <div className="fit-macro-head"><span className="fit-swatch" style={{ background: macro.color }} />{macro.label}</div>
              <div className="fit-macro-value">{num(macro.value)}<span>/{num(macro.target)}g</span></div>
              <ProgressBar value={macro.value} target={macro.target} color={macro.color} height={6} />
            </div>
          ))}
        </div>
      </Card>

      {score ? (
        <Card>
          <div className="fit-score-row">
            <Ring size={64} stroke={7} progress={score.score / 100} color={FIT.success}>
              <span className="fit-score-number">{score.score}</span>
            </Ring>
            <div style={{ flex: 1 }}>
              <div className="fit-card-title">Daily health score</div>
              <Muted className="fit-small" style={{ fontSize: 13 }}>{scoreLabel(score.score)} · nutrition, protein, water, steps, activity & sleep</Muted>
            </div>
          </div>
          {nextAction ? (
            <div className="fit-next">
              <Icon name={nextAction.icon} size={22} />
              <div style={{ flex: 1 }}>
                <div className="fit-next-title">Next best step: {nextAction.title}</div>
                <Muted style={{ fontSize: 13 }}>{nextAction.body}</Muted>
              </div>
              <button type="button" className="fit-pill-btn" onClick={runAction}>{nextAction.cta}</button>
            </div>
          ) : <Muted style={{ marginTop: 10 }}>Every target hit today. Outstanding work!</Muted>}
        </Card>
      ) : null}

      <SectionHeader title="Daily habits" />
      <div className="fit-grid is-4">
        <HabitCard icon="cup-water" color={FIT.water} label="Water" value={(num(habits.waterMl) / 1000).toFixed(1)} unit={`/ ${(num(profile.waterTargetMl) / 1000).toFixed(1)} L`} progress={ratio(habits.waterMl, profile.waterTargetMl)}>
          <div className="fit-water-buttons">
            <button type="button" className="fit-small-btn" aria-label="Remove 250 ml" disabled={!habits.waterMl} onClick={() => addWater(-250)}>-</button>
            <button type="button" className="fit-small-btn is-primary" onClick={() => addWater(250)}>+250</button>
            <button type="button" className="fit-small-btn" onClick={() => addWater(500)}>+500</button>
          </div>
        </HabitCard>
        <HabitCard icon="shoe-print" color={FIT.steps} label="Steps" value={fmt(habits.steps)} unit={`/ ${fmt(profile.stepTarget)}`} progress={ratio(habits.steps, profile.stepTarget)} onClick={() => setSheet('steps')} hint="Click to update" />
        <HabitCard
          icon="dumbbell" color={FIT.workout} label="Workouts this week"
          value={String(weekSummary.workouts || 0)} unit={`/ ${weekSummary.workoutTarget || profile.weeklyWorkoutTarget || 3}`}
          progress={ratio(weekSummary.workouts, weekSummary.workoutTarget || profile.weeklyWorkoutTarget)}
          onClick={() => go('workout')} hint={`${num(burn.durationMin)} active min today`}
        />
        <HabitCard icon="power-sleep" color={FIT.sleep} label="Sleep" value={Number(habits.sleepHours || 0).toFixed(1)} unit={`/ ${profile.sleepTargetHours || 8} h`} progress={ratio(habits.sleepHours, profile.sleepTargetHours || 8)} onClick={() => setSheet('sleep')} hint="Click to log" />
      </div>

      <div style={{ height: 12 }} />
      <GoalCard profile={profile} goalProgress={goalProgress} currentWeightKg={data.currentWeightKg} onClick={() => go('weight')} />

      <Card>
        <div className="fit-card-header">
          <div className="fit-card-title">Calories this week</div>
          <button type="button" className="fit-link" onClick={() => go('progress')}>Insights</button>
        </div>
        <BarChart
          data={week.map((day) => ({ label: shortDay(day.date), value: day.calories, detail: new Date(`${day.date}T12:00:00`).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' }) }))}
          target={target}
          unit=" kcal"
          height={110}
          emptyLabel="Log meals to see your week"
        />
        <Muted className="fit-small" style={{ marginTop: 8, fontSize: 12 }}>Dashed line: your {fmt(target)} kcal daily target</Muted>
      </Card>

      <SectionHeader title="Today's meals" action="Add" onAction={() => go('meal')} />
      <Card style={{ padding: '4px 16px' }}>
        {MEAL_TYPES.map((type) => {
          const items = meals.filter((meal) => (meal.mealType || 'snack') === type.value);
          const kcal = items.reduce((sum, meal) => sum + (Number(meal.calories) || 0), 0);
          return (
            <div key={type.value} className="fit-meal-group fit-list-sep">
              <div className="fit-meal-group-head">
                <Icon name={type.icon} size={20} />
                <span className="fit-meal-group-title">{type.label}</span>
                <span className="fit-muted fit-num" style={{ fontSize: 13 }}>{kcal ? `${fmt(kcal)} kcal` : ''}</span>
                <button type="button" className="fit-add-circle" aria-label={`Add ${type.label}`} onClick={() => go('meal', { mealType: type.value })}><Icon name="plus" size={18} /></button>
              </div>
              {items.map((meal) => (
                <div key={meal._id} className="fit-meal-item" role="button" tabIndex={0} onClick={() => go('meal', { meal })} onKeyDown={(event) => { if (event.key === 'Enter') go('meal', { meal }); }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="fit-item-name">{meal.name}</div>
                    <div className="fit-item-sub">P {num(meal.proteinG)}g · C {num(meal.carbsG)}g · F {num(meal.fatG)}g</div>
                  </div>
                  <span className="fit-item-kcal">{fmt(meal.calories)}</span>
                  <button type="button" className="fit-trash" aria-label={`Delete ${meal.name}`} onClick={(event) => { event.stopPropagation(); deleteMeal(meal); }}><Icon name="trash-can-outline" size={18} /></button>
                </div>
              ))}
            </div>
          );
        })}
      </Card>

      <SectionHeader title="Today's activity" action="Log workout" onAction={() => go('workout')} />
      <Card>
        {workouts.length ? workouts.map((workout) => (
          <div key={workout._id} className="fit-workout-row fit-list-sep">
            <span className="fit-tile-icon"><Icon name={workoutMeta(workout.type).icon} size={20} color={FIT.workout} /></span>
            <div style={{ flex: 1, minWidth: 0 }}>
              <div className="fit-item-name">{workout.name}</div>
              <div className="fit-item-sub">{workout.durationMin} min · {workout.intensity}{workout.exercises?.length ? ` · ${workout.exercises.length} exercises` : ''}</div>
            </div>
            <span className="fit-item-kcal">{fmt(workout.caloriesBurned)} kcal</span>
            <button type="button" className="fit-trash" aria-label={`Delete ${workout.name}`} onClick={() => deleteWorkout(workout)}><Icon name="trash-can-outline" size={18} /></button>
          </div>
        )) : <EmptyState icon="run" title="No activity logged yet" message="Workouts add to your calorie budget and your weekly goal." action="Log a workout" onAction={() => go('workout')} />}
      </Card>

      <SectionHeader title="Tools" />
      <div className="fit-grid is-4">
        <ToolTile icon="robot-happy-outline" label="AI coach" hint="Ask anything" onClick={() => go('coach')} />
        <ToolTile icon="lightbulb-on-outline" label="Meal ideas" hint="Fit your macros" onClick={() => go('ideas')} />
        <ToolTile icon="chart-timeline-variant" label="Progress" hint="Trends & insights" onClick={() => go('progress')} />
        <ToolTile icon="bell-ring-outline" label="Reminders" hint="Build habits" onClick={() => go('reminders')} />
      </div>
      <Muted className="fit-center" style={{ fontSize: 12, marginTop: 14 }}>General wellness guidance, not medical advice. Consult a professional for medical conditions.</Muted>

      <ValueSheet open={sheet === 'steps'} title="Steps today" initial={num(habits.steps)} step={500} max={100000} suffix="steps" onClose={() => setSheet(null)} onSave={(value) => { setSheet(null); updateHabits({ steps: value }, { steps: value }); }} />
      <ValueSheet open={sheet === 'sleep'} title="Hours slept last night" initial={Number(habits.sleepHours) || 7} step={0.5} max={16} decimals={1} suffix="h" onClose={() => setSheet(null)} onSave={(value) => { setSheet(null); updateHabits({ sleepHours: value }, { sleepHours: value }); }} />
    </FitnessPage>
  );
};

const CalorieLine = ({ icon, label, value, sign }) => (
  <div className="fit-calorie-line">
    <Icon name={icon} size={18} />
    <div style={{ flex: 1 }}>
      <div className="fit-calorie-label">{label}</div>
      <div className="fit-calorie-value">{sign && value ? `${sign} ` : ''}{fmt(value)}</div>
    </div>
  </div>
);

const HabitCard = ({ icon, color, label, value, unit, progress, onClick, hint, children }) => (
  <Card className="fit-habit" onClick={onClick}>
    <div className="fit-habit-head">
      <Icon name={icon} size={20} color={color} />
      <span className="fit-habit-label">{label}</span>
      {progress >= 1 ? <Icon name="check-circle" size={16} color={FIT.success} /> : null}
    </div>
    <div className="fit-habit-value">{value} <span className="fit-habit-unit">{unit}</span></div>
    <ProgressBar value={progress} target={1} color={color} height={6} />
    {children || (hint ? <div className="fit-habit-hint">{hint}</div> : null)}
  </Card>
);

const GoalCard = ({ profile, goalProgress, currentWeightKg, onClick }) => {
  const current = currentWeightKg || profile.weightKg;
  const bmiText = profile.bmi ? `BMI ${profile.bmi}${profile.bmiCategory ? ` · ${profile.bmiCategory}` : ''}` : '';
  return (
    <Card onClick={onClick}>
      <div className="fit-card-header">
        <div className="fit-card-title">{profile.goal === 'lose' ? 'Weight-loss goal' : profile.goal === 'gain' ? 'Weight-gain goal' : 'Maintain weight'}</div>
        <span className="fit-link">Log weight</span>
      </div>
      {goalProgress ? (
        <>
          <div className="fit-goal-numbers">
            <GoalNumber label="Start" value={goalProgress.startWeightKg} />
            <GoalNumber label="Current" value={current} emphasis />
            <GoalNumber label="Target" value={goalProgress.targetWeightKg} />
          </div>
          <ProgressBar value={goalProgress.percent} target={100} color={FIT.weight} height={10} />
          <Muted style={{ fontSize: 13, marginTop: 8 }}>
            {goalProgress.reached
              ? 'Goal reached! Switch to maintenance in your plan to lock in your result.'
              : `${goalProgress.percent}% done · ${goalProgress.remainingKg} kg to go${goalProgress.eta ? ` · on pace for ${new Date(goalProgress.eta).toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' })}` : ''}`}
          </Muted>
          {bmiText ? <Muted style={{ fontSize: 12, marginTop: 2 }}>{bmiText} · {goalProgress.weeklyKg} kg/week planned</Muted> : null}
        </>
      ) : (
        <>
          <div className="fit-habit-value">{Number(current).toFixed(1)} <span className="fit-habit-unit">kg</span></div>
          <Muted style={{ fontSize: 13 }}>{bmiText}{profile.healthyWeightRangeKg ? ` · healthy range ${profile.healthyWeightRangeKg.min}–${profile.healthyWeightRangeKg.max} kg` : ''}</Muted>
          {profile.goal !== 'maintain' ? <Muted style={{ fontSize: 13, marginTop: 4 }}>Add a target weight in your plan to see a projected finish date.</Muted> : null}
        </>
      )}
    </Card>
  );
};

const GoalNumber = ({ label, value, emphasis }) => (
  <div className="fit-goal-number">
    <div className={emphasis ? 'fit-goal-current' : 'fit-goal-value'}>{Number(value).toFixed(1)}</div>
    <div className="fit-goal-label">{label} (kg)</div>
  </div>
);

const ToolTile = ({ icon, label, hint, onClick }) => (
  <Card className="fit-habit" onClick={onClick}>
    <Icon name={icon} size={24} color={FIT.primary} />
    <div className="fit-tool-label">{label}</div>
    <div className="fit-habit-hint">{hint}</div>
  </Card>
);

const ValueSheet = ({ open, title, initial, step, max, decimals = 0, suffix, onClose, onSave }) => {
  const [value, setValue] = useState(initial);
  useEffect(() => { if (open) setValue(initial); }, [open, initial]);
  return (
    <Sheet open={open} title={title} onClose={onClose}>
      <Stepper value={value} onChange={setValue} step={step} max={max} decimals={decimals} suffix={suffix} />
      <Button label="Save" variant="primary" onClick={() => onSave(value)} style={{ marginTop: 22 }} />
      <Button label="Cancel" variant="ghost" onClick={onClose} />
    </Sheet>
  );
};

export default FitnessDashboard;

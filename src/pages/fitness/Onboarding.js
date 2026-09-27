import React, { useEffect, useMemo, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { fitnessApi } from './fitnessApi';
import { fitPath } from './paths';
import { Button, Card, ChipGroup, FIT, Field, FitnessPage, Muted, OptionCards, ProgressBar, Spinner, errorMessage, fmt, onlyDecimal, timezone } from './ui';

const ACTIVITY_FACTORS = { sedentary: 1.2, light: 1.375, moderate: 1.55, very_active: 1.725, extra_active: 1.9 };
const PACE = {
  lose: { relaxed: -250, standard: -500, aggressive: -750 },
  gain: { relaxed: 150, standard: 300, aggressive: 450 },
  maintain: { relaxed: 0, standard: 0, aggressive: 0 },
};
const STEP_TARGETS = { sedentary: 6000, light: 7500, moderate: 9000, very_active: 10000, extra_active: 12000 };
const WORKOUT_TARGETS = { sedentary: 2, light: 3, moderate: 4, very_active: 5, extra_active: 6 };

/** Mirrors server/utils/fitnessCalculations.js so the review step can preview the plan. */
const previewPlan = (form) => {
  const age = Number(form.age);
  const height = Number(form.heightCm);
  const weight = Number(form.weightKg);
  if (!age || !height || !weight) return null;
  const offset = form.sex === 'male' ? 5 : form.sex === 'female' ? -161 : -78;
  const bmr = 10 * weight + 6.25 * height - 5 * age + offset;
  const tdee = bmr * (ACTIVITY_FACTORS[form.activityLevel] || 1.55);
  const minimum = form.sex === 'female' ? 1200 : 1500;
  const calories = Math.round(Math.max(minimum, tdee + (PACE[form.goal]?.[form.pace] || 0)));
  const protein = weight * (form.goal === 'lose' ? 1.8 : 1.6);
  const fat = Math.max((calories * 0.25) / 9, weight * 0.6);
  const carbs = Math.max(0, (calories - protein * 4 - fat * 9) / 4);
  const bmi = weight / ((height / 100) ** 2);
  const water = Math.round(Math.min(4500, Math.max(1500, weight * 35 + (['very_active', 'extra_active'].includes(form.activityLevel) ? 500 : 0))) / 50) * 50;
  return { calories, tdee: Math.round(tdee), protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat), bmi: Math.round(bmi * 10) / 10, water, floorApplied: calories === minimum };
};

const STEPS = ['Goal', 'About you', 'Body', 'Activity', 'Your plan'];

const FitnessOnboarding = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const editing = !!location.state?.edit;
  const [step, setStep] = useState(0);
  const [loading, setLoading] = useState(editing);
  const [form, setForm] = useState({ goal: 'lose', pace: 'standard', sex: '', age: '', heightCm: '', weightKg: '', targetWeightKg: '', activityLevel: 'light' });
  const set = (key) => (value) => setForm((old) => ({ ...old, [key]: value }));
  const setNumber = (key) => (value) => setForm((old) => ({ ...old, [key]: onlyDecimal(value) }));

  useEffect(() => {
    if (!editing) return;
    fitnessApi.getProfile()
      .then((response) => {
        const profile = response.data.profile;
        if (profile) {
          setForm({
            goal: profile.goal, pace: profile.pace || 'standard', sex: profile.sex, age: String(profile.age),
            heightCm: String(profile.heightCm), weightKg: String(profile.weightKg),
            targetWeightKg: profile.targetWeightKg ? String(profile.targetWeightKg) : '', activityLevel: profile.activityLevel,
          });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, [editing]);

  const plan = useMemo(() => previewPlan(form), [form]);
  const weeklyKg = Math.round(((Math.abs(PACE[form.goal]?.[form.pace] || 0) * 7) / 7700) * 100) / 100;

  const validate = () => {
    if (step === 1) {
      if (!form.sex) return 'Select an option for sex so we can estimate your metabolism.';
      const age = Number(form.age);
      if (!age || age < 13 || age > 100) return 'Enter an age between 13 and 100.';
    }
    if (step === 2) {
      const height = Number(form.heightCm);
      const weight = Number(form.weightKg);
      if (!height || height < 100 || height > 250) return 'Enter a height between 100 and 250 cm.';
      if (!weight || weight < 25 || weight > 350) return 'Enter a weight between 25 and 350 kg.';
      if (form.targetWeightKg) {
        const target = Number(form.targetWeightKg);
        if (target < 25 || target > 350) return 'Enter a target weight between 25 and 350 kg.';
        if (form.goal === 'lose' && target >= weight) return 'For weight loss, the target should be below your current weight.';
        if (form.goal === 'gain' && target <= weight) return 'For weight gain, the target should be above your current weight.';
      }
    }
    return null;
  };

  const scrollTop = () => window.scrollTo({ top: 0, behavior: 'smooth' });
  const next = () => {
    const problem = validate();
    if (problem) { toast.warn(problem); return; }
    setStep((value) => Math.min(STEPS.length - 1, value + 1));
    scrollTop();
  };
  const back = () => { if (step === 0) navigate(-1); else { setStep((value) => value - 1); scrollTop(); } };

  const save = async () => {
    try {
      await fitnessApi.saveProfile({
        ...form,
        age: Number(form.age),
        heightCm: Number(form.heightCm),
        weightKg: Number(form.weightKg),
        targetWeightKg: form.goal !== 'maintain' && form.targetWeightKg ? Number(form.targetWeightKg) : undefined,
        timezone: timezone(),
      });
      fitnessApi.clearDashboardCache();
      toast.success(editing ? 'Plan updated' : 'Your plan is ready');
      navigate(fitPath('dashboard'), { replace: true });
    } catch (error) {
      toast.error(errorMessage(error, 'Please check your details and try again.'));
    }
  };

  if (loading) return <FitnessPage title="Edit plan"><div className="fit-empty"><Spinner large /></div></FitnessPage>;

  return (
    <FitnessPage
      title={editing ? 'Edit your plan' : 'Create your plan'}
      subtitle={`Step ${step + 1} of ${STEPS.length} · ${STEPS[step]}`}
      onBack={back}
      footer={
        <>
          {step > 0 ? <Button label="Back" onClick={back} style={{ flex: 1, marginTop: 0 }} /> : null}
          {step < STEPS.length - 1
            ? <Button label="Continue" icon="arrow-right" variant="primary" onClick={next} style={{ flex: 2, marginTop: 0 }} />
            : <Button label={editing ? 'Save changes' : 'Start my plan'} loadingLabel="Saving..." icon="check" variant="primary" onClick={save} style={{ flex: 2, marginTop: 0 }} />}
        </>
      }
    >
      <ProgressBar value={step + 1} target={STEPS.length} height={5} />
      <div style={{ height: 20 }} />

      {step === 0 ? (
        <>
          <h2 className="fit-question">What is your main goal?</h2>
          <Muted className="fit-help">We will tune your calories, protein and habits around it. You can change it any time.</Muted>
          <OptionCards
            value={form.goal}
            onChange={set('goal')}
            options={[
              { value: 'lose', label: 'Lose weight', hint: 'Burn fat while keeping muscle with a moderate calorie deficit.', icon: 'trending-down' },
              { value: 'maintain', label: 'Maintain & get healthier', hint: 'Keep your weight steady and build consistent habits.', icon: 'scale-balance' },
              { value: 'gain', label: 'Build muscle / gain weight', hint: 'A small surplus with high protein to support lean gains.', icon: 'arm-flex' },
            ]}
          />
        </>
      ) : null}

      {step === 1 ? (
        <>
          <h2 className="fit-question">Tell us about you</h2>
          <Muted className="fit-help">Used only to estimate your resting metabolism (Mifflin-St Jeor equation).</Muted>
          <span className="fit-label">Sex</span>
          <ChipGroup value={form.sex} onChange={set('sex')} options={[{ label: 'Male', value: 'male', icon: 'gender-male' }, { label: 'Female', value: 'female', icon: 'gender-female' }, { label: 'Prefer not to say', value: 'other' }]} />
          <div style={{ height: 16 }} />
          <Field label="Age" value={form.age} onChange={setNumber('age')} inputMode="numeric" placeholder="e.g. 28" suffix="years" />
        </>
      ) : null}

      {step === 2 ? (
        <>
          <h2 className="fit-question">Your body measurements</h2>
          <Muted className="fit-help">Weigh yourself in the morning for the most consistent readings.</Muted>
          <div className="fit-row">
            <Field label="Height" value={form.heightCm} onChange={setNumber('heightCm')} inputMode="decimal" placeholder="170" suffix="cm" />
            <Field label="Current weight" value={form.weightKg} onChange={setNumber('weightKg')} inputMode="decimal" placeholder="70" suffix="kg" />
          </div>
          {form.goal !== 'maintain' ? (
            <>
              <Field label="Target weight (recommended)" value={form.targetWeightKg} onChange={setNumber('targetWeightKg')} inputMode="decimal" placeholder={form.goal === 'lose' ? '65' : '75'} suffix="kg" />
              <span className="fit-label" style={{ marginTop: 6 }}>How fast?</span>
              <OptionCards
                value={form.pace}
                onChange={set('pace')}
                options={form.goal === 'lose' ? [
                  { value: 'relaxed', label: 'Relaxed · ~0.25 kg/week', hint: 'Easiest to sustain, minimal hunger.', icon: 'tortoise' },
                  { value: 'standard', label: 'Recommended · ~0.5 kg/week', hint: 'The best balance of speed and sustainability.', icon: 'check-decagram-outline' },
                  { value: 'aggressive', label: 'Fast · ~0.7 kg/week', hint: 'Harder to stick to. Best for short phases.', icon: 'rabbit' },
                ] : [
                  { value: 'relaxed', label: 'Lean · ~0.15 kg/week', hint: 'Minimises fat gain.', icon: 'tortoise' },
                  { value: 'standard', label: 'Recommended · ~0.3 kg/week', hint: 'Steady muscle gain with training.', icon: 'check-decagram-outline' },
                  { value: 'aggressive', label: 'Fast · ~0.4 kg/week', hint: 'For hard gainers; expect some fat gain.', icon: 'rabbit' },
                ]}
              />
            </>
          ) : null}
        </>
      ) : null}

      {step === 3 ? (
        <>
          <h2 className="fit-question">How active are you?</h2>
          <Muted className="fit-help">Think about a typical week, not your best one. This also sets your step and workout targets.</Muted>
          <OptionCards
            value={form.activityLevel}
            onChange={set('activityLevel')}
            options={[
              { value: 'sedentary', label: 'Mostly sitting', hint: 'Desk job, little exercise.', icon: 'sofa-outline' },
              { value: 'light', label: 'Lightly active', hint: 'Light exercise 1–3 days/week or on your feet sometimes.', icon: 'walk' },
              { value: 'moderate', label: 'Moderately active', hint: 'Exercise 3–5 days/week.', icon: 'run' },
              { value: 'very_active', label: 'Very active', hint: 'Hard training 6–7 days/week.', icon: 'run-fast' },
              { value: 'extra_active', label: 'Athlete / physical job', hint: 'Twice-a-day training or heavy manual work.', icon: 'weight-lifter' },
            ]}
          />
        </>
      ) : null}

      {step === 4 && plan ? (
        <>
          <h2 className="fit-question">Your personalised plan</h2>
          <Muted className="fit-help">Based on your details. Targets update automatically as you log new weigh-ins.</Muted>
          <Card style={{ textAlign: 'center' }}>
            <div className="fit-big-number">{fmt(plan.calories)}</div>
            <div className="fit-big-label">calories per day</div>
            <Muted style={{ fontSize: 13, marginTop: 6 }}>
              Maintenance is about {fmt(plan.tdee)} kcal{form.goal !== 'maintain' ? ` · expected change ~${weeklyKg} kg/week` : ''}
            </Muted>
            {plan.floorApplied ? <Muted style={{ fontSize: 12, marginTop: 6, color: 'var(--fit-warning)' }}>We applied a safe minimum intake. Consider a slower pace.</Muted> : null}
          </Card>
          <div className="fit-row">
            <MacroTile label="Protein" value={plan.protein} color={FIT.protein} />
            <MacroTile label="Carbs" value={plan.carbs} color={FIT.carbs} />
            <MacroTile label="Fat" value={plan.fat} color={FIT.fat} />
          </div>
          <Card>
            <PlanLine label="BMI" value={`${plan.bmi}`} />
            <PlanLine label="Daily water" value={`${(plan.water / 1000).toFixed(1)} L`} />
            <PlanLine label="Daily steps" value={fmt(STEP_TARGETS[form.activityLevel] || 8000)} />
            <PlanLine label="Workouts per week" value={String(WORKOUT_TARGETS[form.activityLevel] || 3)} />
            <PlanLine label="Sleep" value={'7–9 hours'} />
          </Card>
          <Muted style={{ fontSize: 12 }}>Saving also creates helpful meal, water and movement reminders. These are general wellness estimates, not medical advice. If you are pregnant, have a medical condition or a history of disordered eating, please consult a professional.</Muted>
        </>
      ) : null}
    </FitnessPage>
  );
};

const MacroTile = ({ label, value, color }) => (
  <Card style={{ textAlign: 'center', padding: '14px 8px' }}>
    <span className="fit-swatch" style={{ background: color, width: 10, height: 10, borderRadius: 5 }} />
    <div style={{ fontSize: 20, fontWeight: 800, marginTop: 6 }}>{value}g</div>
    <div className="fit-big-label">{label}</div>
  </Card>
);

const PlanLine = ({ label, value }) => <div className="fit-plan-line"><span>{label}</span><strong>{value}</strong></div>;

export default FitnessOnboarding;

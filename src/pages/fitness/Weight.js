import React, { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { toast } from 'react-toastify';
import { fitnessApi } from './fitnessApi';
import { Button, Card, EmptyState, FIT, Field, FitnessPage, Icon, LineChart, Muted, SectionHeader, Stepper, errorMessage, onlyDecimal, shortDate } from './ui';

const FitnessWeight = () => {
  const navigate = useNavigate();
  const [weight, setWeight] = useState(70);
  const [bodyFat, setBodyFat] = useState('');
  const [note, setNote] = useState('');
  const [history, setHistory] = useState([]);
  const [profile, setProfile] = useState(null);

  const load = useCallback(async () => {
    try {
      const [weights, profileResponse] = await Promise.all([fitnessApi.getWeights(), fitnessApi.getProfile()]);
      const list = weights.data.weights || [];
      const nextProfile = profileResponse.data.profile;
      setHistory(list);
      setProfile(nextProfile);
      setWeight(Number(list[0]?.weightKg || nextProfile?.weightKg || 70));
    } catch (_) {
      // Keep the entry form usable offline.
    }
  }, []);

  useEffect(() => { load(); }, [load]);

  const save = async () => {
    const fat = bodyFat ? Number(bodyFat) : undefined;
    if (fat !== undefined && (fat < 1 || fat > 80)) { toast.warn('Body fat should be between 1% and 80%.'); return; }
    try {
      await fitnessApi.addWeight(weight, new Date().toISOString(), note.trim() || undefined, fat);
      toast.success('Weigh-in saved');
      navigate(-1);
    } catch (error) {
      toast.error(errorMessage(error, 'Enter a valid weight.'));
    }
  };

  const remove = async (entry) => {
    if (!window.confirm(`Delete ${entry.weightKg} kg from ${shortDate(entry.date)}?`)) return;
    try { await fitnessApi.deleteWeight(entry._id); load(); } catch (e) { toast.error(errorMessage(e, 'Could not delete this entry')); }
  };

  const chronological = [...history].reverse().slice(-30);
  const last = history[0]?.weightKg;
  const delta = last ? Math.round((weight - last) * 10) / 10 : 0;
  const bmi = profile?.heightCm ? Math.round((weight / ((profile.heightCm / 100) ** 2)) * 10) / 10 : null;

  return (
    <FitnessPage
      title="Log weight"
      subtitle={new Date().toLocaleDateString(undefined, { weekday: 'long', month: 'short', day: 'numeric' })}
      footer={<Button label="Save weigh-in" loadingLabel="Saving..." icon="check" variant="primary" onClick={save} style={{ marginTop: 0 }} />}
    >
      <Card style={{ padding: '24px 16px' }}>
        <Stepper value={weight} onChange={setWeight} step={0.1} min={25} max={350} decimals={1} suffix="kg" />
        <div style={{ display: 'flex', justifyContent: 'center', gap: 16, marginTop: 12, color: 'var(--fit-text-2)', fontSize: 13 }}>
          {last ? (
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
              <Icon name={delta > 0 ? 'arrow-up' : delta < 0 ? 'arrow-down' : 'minus'} size={16} />
              {delta === 0 ? 'Same as last entry' : `${Math.abs(delta)} kg vs last entry`}
            </span>
          ) : null}
          {bmi ? <span>BMI {bmi}</span> : null}
        </div>
        <div className="fit-water-buttons" style={{ marginTop: 16, gap: 8 }}>
          {[-1, -0.5, 0.5, 1].map((step) => (
            <button key={step} type="button" className="fit-small-btn" style={{ padding: '10px 0' }} onClick={() => setWeight((value) => Math.round((value + step) * 10) / 10)}>
              {step > 0 ? '+' : ''}{step}
            </button>
          ))}
        </div>
      </Card>

      <div className="fit-row">
        <Field label="Body fat (optional)" value={bodyFat} onChange={(value) => setBodyFat(onlyDecimal(value))} inputMode="decimal" suffix="%" />
        <Field label="Note (optional)" value={note} onChange={setNote} placeholder="e.g. after workout" style={{ flex: 1.4 }} />
      </div>
      <Muted style={{ fontSize: 12, marginBottom: 6 }}>Tip: weigh in first thing in the morning, after the bathroom and before eating. Daily weight fluctuates by 1–2 kg; watch the weekly trend.</Muted>

      <SectionHeader title="Trend" />
      <Card>
        {chronological.length >= 2 ? (
          <LineChart
            data={chronological.map((entry) => ({ label: shortDate(entry.date), value: entry.weightKg, detail: shortDate(entry.date) }))}
            target={profile?.goal !== 'maintain' ? profile?.targetWeightKg : undefined}
            color={FIT.weight}
            unit=" kg"
          />
        ) : <EmptyState icon="chart-line" title="Your trend appears here" message="Log at least two weigh-ins to see your weight trend." />}
      </Card>

      {history.length ? (
        <>
          <SectionHeader title="History" />
          <Card style={{ padding: '4px 16px' }}>
            {history.slice(0, 30).map((entry, index) => {
              const previous = history[index + 1];
              const change = previous ? Math.round((entry.weightKg - previous.weightKg) * 10) / 10 : null;
              return (
                <div key={entry._id} className="fit-list-row" style={{ padding: '12px 0' }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="fit-item-name">{new Date(entry.date).toLocaleDateString(undefined, { weekday: 'short', month: 'short', day: 'numeric' })}</div>
                    {entry.note || entry.bodyFatPercent ? <div className="fit-item-sub">{[entry.bodyFatPercent ? `${entry.bodyFatPercent}% body fat` : '', entry.note].filter(Boolean).join(' · ')}</div> : null}
                  </div>
                  {change !== null && change !== 0 ? <span className="fit-muted" style={{ fontSize: 12 }}>{change > 0 ? '+' : ''}{change}</span> : null}
                  <span className="fit-item-kcal" style={{ fontSize: 15, fontWeight: 800 }}>{entry.weightKg} kg</span>
                  <button type="button" className="fit-trash" aria-label="Delete entry" onClick={() => remove(entry)}><Icon name="trash-can-outline" size={18} /></button>
                </div>
              );
            })}
          </Card>
        </>
      ) : null}
    </FitnessPage>
  );
};

export default FitnessWeight;

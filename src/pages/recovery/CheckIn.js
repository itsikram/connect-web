import React, { useEffect, useState } from 'react';
import { recoveryApi } from './recoveryApi';
import { OFFLINE_TRIGGERS } from './content';
import { redFlagsIn, toggleIn } from './helpers';
import { useRecoveryContent, useRecoveryDashboard } from './hooks';
import { useRecoveryI18n } from './i18n';
import { useRecoveryNavigation } from './paths';
import { Banner, Button, Card, CrisisCard, EmergencyStrip, Icon, InfoCard, MoodScale, MultiChips, Muted, NumberScale, Question, REC, RecoveryPage, Segmented, Stepper, VoiceTextArea, errorMessage } from './ui';

// Web port of expo-connect-app/src/screens/recovery/CheckIn.tsx.
const HALT_FALLBACK = {
  en: [
    { key: 'hungry', label: 'Hungry' },
    { key: 'angry', label: 'Angry' },
    { key: 'lonely', label: 'Lonely' },
    { key: 'tired', label: 'Tired' },
  ],
  bn: [
    { key: 'hungry', label: 'ক্ষুধার্ত' },
    { key: 'angry', label: 'রাগান্বিত' },
    { key: 'lonely', label: 'একা' },
    { key: 'tired', label: 'ক্লান্ত' },
  ],
};

const RecoveryCheckIn = () => {
  const navigation = useRecoveryNavigation();
  const { lang, s, f, num } = useRecoveryI18n();
  const { content } = useRecoveryContent(lang);
  const { data } = useRecoveryDashboard(lang);
  const substances = (data?.substances || []).filter((item) => item.status === 'clean');
  const existing = data?.today?.checkin || null;

  const [used, setUsed] = useState({});
  const [mood, setMood] = useState(null);
  const [craving, setCraving] = useState(null);
  const [stress, setStress] = useState(null);
  const [sleep, setSleep] = useState(7);
  const [halt, setHalt] = useState([]);
  const [triggers, setTriggers] = useState([]);
  const [symptoms, setSymptoms] = useState([]);
  const [note, setNote] = useState('');
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [prefilled, setPrefilled] = useState(false);

  // Editing today's check-in: start from what was saved (the note is never sent back).
  useEffect(() => {
    if (!existing || prefilled) return;
    setPrefilled(true);
    setMood(existing.mood);
    setCraving(existing.craving);
    setStress(existing.stress);
    if (existing.sleepHours !== null) setSleep(existing.sleepHours);
    setHalt(existing.halt || []);
    setTriggers(existing.triggers || []);
    setSymptoms(existing.symptoms || []);
    setUsed(Object.fromEntries((existing.used || []).map((item) => [item.substance, item.amount])));
  }, [existing, prefilled]);

  const submit = async () => {
    if (mood === null || craving === null) {
      setError(s.onboarding.answerAll);
      return;
    }
    setError('');
    try {
      const response = await recoveryApi.saveCheckin(
        {
          used: Object.entries(used)
            .filter(([, amount]) => amount !== null && amount > 0)
            .map(([substance, amount]) => ({ substance, amount })),
          mood,
          craving,
          stress: stress ?? undefined,
          sleepHours: sleep,
          halt,
          triggers,
          symptoms,
          note: note.trim() || undefined,
        },
        lang,
      );
      setResult(response.data);
      window.scrollTo({ top: 0 });
    } catch (saveError) {
      setError(errorMessage(saveError, s.common.saveError));
    }
  };

  if (result) {
    const { checkin } = result;
    return (
      <RecoveryPage title={s.checkin.title} navigation={navigation} footer={<Button label={s.lapse.home} icon="home-outline" variant="primary" onClick={() => navigation.replace('RecoveryHome')} />}>
        {result.crisis ? <CrisisCard crisis={result.crisis} contacts={data?.profile?.supportContacts} lang={lang} onMoreHelp={() => navigation.navigate('RecoveryHelp')} /> : null}
        <Card>
          <div className="rec-row-head">
            <Icon name="check-circle" size={24} color="var(--fit-success)" />
            <h2 className="rec-card-title" style={{ fontSize: 18 }}>{existing ? s.checkin.updated : s.checkin.resultTitle}</h2>
          </div>
          {checkin.reflection ? <p className="rec-reflection">{checkin.reflection}</p> : null}
          {checkin.microGoal ? (
            <div className="rec-goal">
              <Icon name="flag-checkered" size={18} />
              <div style={{ flex: 1 }}>
                <div className="rec-mission-label">{s.checkin.tomorrow}</div>
                <div className="rec-mission-text" style={{ fontSize: 15 }}>{checkin.microGoal}</div>
              </div>
            </div>
          ) : null}
          {result.pointsEarned ? <div className="rec-strong" style={{ color: REC.warm, marginTop: 12 }}>{f(s.common.points, { n: num(result.pointsEarned) })}</div> : null}
          {result.newBadges.map((badge) => (
            <Banner key={badge.key} icon="medal-outline" tone="good" text={f(s.common.newBadge, { label: badge.label })} />
          ))}
        </Card>
        {result.lapsesCreated.length ? <Banner icon="restart" text={s.checkin.slipRecorded} /> : null}
        {result.lapsesCreated.length || checkin.craving >= 7 || checkin.mood <= 2 ? (
          <Button label={s.checkin.talkIt} icon="robot-happy-outline" onClick={() => navigation.replace('RecoveryCoach', { mode: result.lapsesCreated.length ? 'lapse' : 'coach' })} />
        ) : null}
      </RecoveryPage>
    );
  }

  const haltOptions = content?.halt?.length ? content.halt : HALT_FALLBACK[lang];
  const triggerOptions = content?.triggers?.length ? content.triggers : OFFLINE_TRIGGERS[lang];
  const symptomOptions = content?.symptoms || [];
  const redFlags = redFlagsIn(symptoms, symptomOptions);

  return (
    <RecoveryPage title={s.checkin.title} navigation={navigation} footer={<Button label={s.checkin.submit} loadingLabel={s.common.saving} icon="check" variant="primary" onClick={submit} />}>
      {error ? <Banner icon="alert-circle-outline" tone="warn" text={error} /> : null}
      <Card>
        {substances.map((substance) => {
          const amount = used[substance.key];
          const didUse = amount !== undefined && amount !== null && amount > 0;
          return (
            <Question key={substance.key} title={substances.length > 1 ? `${s.checkin.usedQ} · ${substance.name}` : s.checkin.usedQ}>
              <Segmented
                options={[
                  { label: s.common.no, value: 'no' },
                  { label: s.common.yes, value: 'yes' },
                ]}
                value={didUse ? 'yes' : 'no'}
                onChange={(value) => setUsed((old) => ({ ...old, [substance.key]: value === 'yes' ? Math.max(1, old[substance.key] || 1) : 0 }))}
              />
              {didUse ? (
                <div style={{ marginTop: 10 }}>
                  <Muted style={{ fontSize: 13, marginBottom: 6 }}>{f(s.checkin.howMuch, { unit: substance.unit })}</Muted>
                  <Stepper value={amount} min={1} max={200} onChange={(value) => setUsed((old) => ({ ...old, [substance.key]: value }))} />
                </div>
              ) : null}
            </Question>
          );
        })}
        <Question title={s.checkin.moodQ}>
          <MoodScale value={mood} onChange={setMood} labels={s.checkin.moods} />
        </Question>
        <Question title={s.checkin.cravingQ}>
          <NumberScale min={0} max={10} value={craving} onChange={setCraving} lang={lang} danger />
        </Question>
        <Question title={s.checkin.stressQ} hint={s.common.optional}>
          <NumberScale min={1} max={5} value={stress} onChange={setStress} lang={lang} lowLabel={s.checkin.stressLabels[0]} highLabel={s.checkin.stressLabels[1]} />
        </Question>
        <Question title={s.checkin.sleepQ}>
          <Stepper value={sleep} min={0} max={24} step={0.5} decimals={1} suffix={s.common.hours} onChange={setSleep} />
        </Question>
        <Question title={s.checkin.haltQ} hint={s.common.optional}>
          <MultiChips options={haltOptions} values={halt} onToggle={(key) => setHalt((old) => toggleIn(old, key))} />
        </Question>
        <Question title={s.checkin.triggersQ} hint={s.common.optional}>
          <MultiChips options={triggerOptions} values={triggers} onToggle={(key) => setTriggers((old) => toggleIn(old, key))} />
        </Question>
        {symptomOptions.length ? (
          <Question title={s.checkin.symptomsQ} hint={s.common.optional}>
            <MultiChips options={symptomOptions} values={symptoms} onToggle={(key) => setSymptoms((old) => toggleIn(old, key))} />
          </Question>
        ) : null}
        {redFlags.length ? (
          <InfoCard icon="alarm-light-outline" title={s.checkin.redFlagTitle} tone={REC.sos}>
            <p className="rec-body" style={{ marginBottom: 10 }}>{s.checkin.redFlagBody}</p>
            <EmergencyStrip lang={lang} />
          </InfoCard>
        ) : null}
        <Question title={s.checkin.noteQ}>
          <VoiceTextArea value={note} onChange={setNote} maxLength={1000} lang={lang} />
        </Question>
      </Card>
    </RecoveryPage>
  );
};

export default RecoveryCheckIn;

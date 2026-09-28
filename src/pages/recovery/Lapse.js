import React, { useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { recoveryApi } from './recoveryApi';
import { FEELING_KEYS, OFFLINE_TRIGGERS } from './content';
import { lapseTime, quitDateFor, withIfThen } from './helpers';
import { useRecoveryContent, useRecoveryDashboard } from './hooks';
import { useRecoveryI18n } from './i18n';
import { useRecoveryNavigation } from './paths';
import { Banner, Button, Card, ChipGroup, CrisisCard, EmptyState, Icon, InfoCard, MultiChips, Muted, OptionCards, Question, REC, RecoveryPage, Stepper, VoiceTextArea, callPhone, errorMessage } from './ui';

// Web port of expo-connect-app/src/screens/recovery/Lapse.tsx.
const RecoveryLapse = () => {
  const navigation = useRecoveryNavigation();
  const params = useLocation().state || {};
  const { lang, s, f, num, date } = useRecoveryI18n();
  const { content } = useRecoveryContent(lang);
  const { data, loading } = useRecoveryDashboard(lang);
  // Only substances whose quit date has passed can have a slip.
  const substances = (data?.substances || []).filter((item) => item.status === 'clean');
  const [key, setKey] = useState(params.substance || '');
  const [when, setWhen] = useState('now');
  const [amount, setAmount] = useState(1);
  const [trigger, setTrigger] = useState('');
  const [feeling, setFeeling] = useState('');
  const [context, setContext] = useState('');
  const [restart, setRestart] = useState('continue');
  const [daysAhead, setDaysAhead] = useState(1);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [added, setAdded] = useState(false);

  const current = substances.find((item) => item.key === key) || substances.find((item) => item.primary) || substances[0];
  const safetyText = current ? content?.safetyClasses?.[current.safetyClass]?.lapseSafety : '';
  const triggers = content?.triggers?.length ? content.triggers : OFFLINE_TRIGGERS[lang];
  const dayOptions = useMemo(
    () =>
      Array.from({ length: 14 }, (_, index) => {
        const days = index + 1;
        return { label: days === 1 ? s.onboarding.tomorrow : date(quitDateFor('date', { daysAhead: days }), { day: 'numeric', month: 'short' }), value: String(days) };
      }),
    [date, s.onboarding.tomorrow],
  );

  const submit = async () => {
    if (!current) return;
    setError('');
    try {
      const response = await recoveryApi.logLapse(
        {
          substance: current.key,
          at: lapseTime(when, current.quitDate),
          amount,
          trigger: trigger || undefined,
          feelingBefore: feeling || undefined,
          context: context.trim() || undefined,
          restart,
          newQuitDate: restart === 'new_date' ? quitDateFor('date', { daysAhead }) : undefined,
        },
        lang,
      );
      setResult(response.data);
      window.scrollTo({ top: 0 });
    } catch (saveError) {
      setError(errorMessage(saveError, s.common.saveError));
    }
  };

  const addToPlan = async () => {
    if (!result?.debrief.newIfThen?.action) return;
    try {
      await recoveryApi.updatePlan(withIfThen(data?.profile?.plan, result.debrief.newIfThen), lang);
      setAdded(true);
    } catch (saveError) {
      setError(errorMessage(saveError, s.common.saveError));
    }
  };

  if (result) {
    const { debrief, substance } = result;
    return (
      <RecoveryPage title={s.lapse.debriefTitle} navigation={navigation} footer={<Button label={s.lapse.home} icon="home-outline" variant="primary" onClick={() => navigation.replace('RecoveryHome')} />}>
        {result.crisis ? <CrisisCard crisis={result.crisis} contacts={data?.profile?.supportContacts} lang={lang} onMoreHelp={() => navigation.navigate('RecoveryHelp')} /> : null}
        {result.safety?.text ? (
          <InfoCard icon="shield-alert-outline" title={s.onboarding.safetyTitle} tone={REC.sos}>
            <p className="rec-body">{result.safety.text}</p>
          </InfoCard>
        ) : null}
        <Card>
          <p className="rec-reflection">{debrief.reflection}</p>
        </Card>
        {debrief.chain?.length ? (
          <InfoCard icon="link-variant" title={s.lapse.chainTitle}>
            {debrief.chain.map((item, index) => (
              <div key={`${index}-${item}`} className="rec-chain-row">
                <span className="rec-chain-dot">{num(index + 1)}</span>
                <span style={{ flex: 1 }}>{item}</span>
              </div>
            ))}
          </InfoCard>
        ) : null}
        {debrief.lesson ? (
          <InfoCard icon="lightbulb-on-outline" title={s.lapse.lessonTitle} tone={REC.warm}>
            <p className="rec-body">{debrief.lesson}</p>
          </InfoCard>
        ) : null}
        {debrief.newIfThen?.action ? (
          <InfoCard icon="map-marker-path" title={s.lapse.newPlanTitle}>
            <p className="rec-body">
              <strong>{`${s.plan.ifLabel} `}</strong>
              {debrief.newIfThen.trigger}
            </p>
            <p className="rec-body" style={{ marginTop: 4 }}>
              <strong>{`${s.plan.thenLabel} `}</strong>
              {debrief.newIfThen.action}
            </p>
            {added ? <Banner icon="check" tone="good" text={s.lapse.added} /> : <Button label={s.lapse.addToPlan} icon="plus" onClick={addToPlan} />}
          </InfoCard>
        ) : null}
        <InfoCard icon="trophy-outline" title={s.lapse.keptTitle} tone={REC.warm}>
          <p className="rec-body">{f(s.lapse.kept, { longest: num(substance.longestStreakDays), total: num(substance.totalCleanDays) })}</p>
        </InfoCard>
        {error ? <Banner icon="alert-circle-outline" tone="warn" text={error} /> : null}
        <Button label={s.lapse.talk} icon="robot-happy-outline" onClick={() => navigation.navigate('RecoveryCoach', { mode: 'lapse' })} />
      </RecoveryPage>
    );
  }

  if (!loading && !substances.length) {
    return (
      <RecoveryPage title={s.lapse.title} navigation={navigation}>
        <EmptyState icon="calendar-clock" title={s.lapse.title} message={s.lapse.nothingToLog} action={s.lapse.home} onAction={() => navigation.goBack()} />
      </RecoveryPage>
    );
  }

  return (
    <RecoveryPage title={s.lapse.title} navigation={navigation} footer={<Button label={s.lapse.submit} loadingLabel={s.lapse.thinking} icon="arrow-right" variant="primary" disabled={!current} onClick={submit} />}>
      <Card>
        <p className="rec-reflection">{s.lapse.intro}</p>
      </Card>

      <InfoCard icon="shield-alert-outline" title={s.lapse.safeQ} tone={REC.sos}>
        {safetyText ? <p className="rec-body" style={{ marginBottom: 6 }}>{safetyText}</p> : null}
        <Button label={s.crisis.call999} icon="phone" variant="danger" onClick={() => callPhone('999')} />
        <Button label={s.lapse.unwell} icon="lifebuoy" onClick={() => navigation.navigate('RecoveryHelp')} />
      </InfoCard>

      {error ? <Banner icon="alert-circle-outline" tone="warn" text={error} /> : null}

      <Card>
        {substances.length > 1 ? (
          <Question title={s.lapse.whatQ}>
            <ChipGroup options={substances.map((item) => ({ label: item.name, value: item.key }))} value={current?.key || ''} onChange={setKey} />
          </Question>
        ) : null}
        <Question title={s.lapse.whenQ}>
          <ChipGroup options={['now', 'today', 'yesterday'].map((value) => ({ label: s.lapse.when[value], value }))} value={when} onChange={setWhen} />
        </Question>
        {current ? (
          <Question title={f(s.lapse.amountQ, { unit: current.unit })}>
            <Stepper value={amount} min={0} max={200} onChange={setAmount} />
          </Question>
        ) : null}
        <Question title={s.lapse.triggerQ} hint={s.common.optional}>
          <MultiChips options={triggers} values={trigger ? [trigger] : []} onToggle={(value) => setTrigger(trigger === value ? '' : value)} />
        </Question>
        <Question title={s.lapse.feelingQ} hint={s.common.optional}>
          <MultiChips options={FEELING_KEYS.map((value) => ({ key: value, label: s.lapse.feelings[value] }))} values={feeling ? [feeling] : []} onToggle={(value) => setFeeling(feeling === value ? '' : value)} />
        </Question>
        <Question title={s.lapse.contextQ}>
          <VoiceTextArea value={context} onChange={setContext} maxLength={1500} lang={lang} />
        </Question>
        <Question title={s.lapse.restartQ}>
          <OptionCards
            value={restart}
            onChange={setRestart}
            options={[
              { value: 'continue', label: s.lapse.continue, icon: 'play-circle-outline' },
              { value: 'new_date', label: s.lapse.newDate, icon: 'calendar-refresh-outline' },
            ]}
          />
          {restart === 'new_date' ? (
            <div style={{ marginTop: 12 }}>
              <Muted style={{ fontSize: 13, marginBottom: 6 }}>{s.onboarding.quitDate}</Muted>
              <ChipGroup options={dayOptions} value={String(daysAhead)} onChange={(value) => setDaysAhead(Number(value))} />
            </div>
          ) : null}
        </Question>
      </Card>
      <div className="rec-keep">
        <Icon name="information-outline" size={16} />
        <span>{s.lapse.keptNote}</span>
      </div>
    </RecoveryPage>
  );
};

export default RecoveryLapse;

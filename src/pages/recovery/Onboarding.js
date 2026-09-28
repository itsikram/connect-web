import React, { useEffect, useMemo, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { recoveryApi } from './recoveryApi';
import { cleanPhone, daysSince, daysUntil, parseNumber, quitDateFor, redFlagsIn, toggleExclusive, toggleIn } from './helpers';
import { useRecoveryContent } from './hooks';
import { useRecoveryI18n } from './i18n';
import { useRecoveryNavigation } from './paths';
import {
  Banner,
  Button,
  Card,
  ChipGroup,
  EmptyState,
  Field,
  Icon,
  InfoCard,
  MultiChips,
  Muted,
  NumberScale,
  OptionCards,
  ProgressBar,
  Question,
  RecoveryPage,
  Spinner,
  Stepper,
  errorMessage,
  timezone,
} from './ui';

// Web port of expo-connect-app/src/screens/recovery/Onboarding.tsx.
const WAKE_KEYS = ['5min', '30min', '60min', 'later'];
const APPROACH_ICONS = { now: 'flag-outline', date: 'calendar-outline', taper: 'chart-line-variant', doctor: 'doctor' };

const RecoveryOnboarding = () => {
  const navigation = useRecoveryNavigation();
  const params = useLocation().state || {};
  const { lang, s, f, date } = useRecoveryI18n();
  const { content, error: contentError, reload } = useRecoveryContent(lang);
  const editing = !!params.edit;
  const resuming = !!params.resume;
  const [loading, setLoading] = useState(editing || resuming);
  const [mode, setMode] = useState('full');
  const [step, setStep] = useState(0);
  const [error, setError] = useState('');
  const [building, setBuilding] = useState(false);

  const [selected, setSelected] = useState([]);
  const [primary, setPrimary] = useState('');
  const [customName, setCustomName] = useState('');
  const [usage, setUsage] = useState({});
  const [answers, setAnswers] = useState({});
  const [importance, setImportance] = useState(null);
  const [confidence, setConfidence] = useState(null);
  const [reasonKeys, setReasonKeys] = useState([]);
  const [reasons, setReasons] = useState('');
  const [letter, setLetter] = useState('');
  const [triggers, setTriggers] = useState([]);
  const [quit, setQuit] = useState({});
  const [contacts, setContacts] = useState([{ name: '', phone: '', relation: '' }]);
  const [background, setBackground] = useState({});

  const meta = (key) => content?.substances.find((item) => item.key === key);
  const safetyOf = (key) => {
    const substance = meta(key);
    return substance ? content?.safetyClasses?.[substance.safetyClass] : undefined;
  };

  // Editing or finishing setup: start from what is already saved.
  useEffect(() => {
    if (!editing && !resuming) return;
    recoveryApi
      .getProfile()
      .then((response) => {
        const profile = response.data.profile;
        if (!profile) return;
        setSelected(profile.substances.map((item) => item.key));
        setPrimary((profile.substances.find((item) => item.primary) || profile.substances[0])?.key || '');
        setCustomName(profile.substances.find((item) => item.key === 'other')?.customName || '');
        setUsage(
          Object.fromEntries(
            profile.substances.map((item) => [
              item.key,
              {
                amountPerDay: String(item.amountPerDay ?? ''),
                daysPerWeek: item.daysPerWeek ?? 7,
                costPerUnit: item.costPerUnit ? String(item.costPerUnit) : '',
                yearsUsing: item.yearsUsing ? String(item.yearsUsing) : '',
                wakeUse: item.wakeUse || '',
              },
            ]),
          ),
        );
        setQuit(
          Object.fromEntries(
            profile.substances.map((item) => {
              const future = Date.parse(item.quitDate) > Date.now();
              return [item.key, { approach: item.approach, daysAhead: future ? daysUntil(item.quitDate) : 1, daysAgo: future ? 0 : daysSince(item.quitDate), original: item.quitDate, touched: false }];
            }),
          ),
        );
        setImportance(profile.readiness?.importance ?? null);
        setConfidence(profile.readiness?.confidence ?? null);
        setReasonKeys(profile.reasonKeys || []);
        setReasons(profile.reasons || '');
        setLetter(profile.letter || '');
        setTriggers(profile.triggers || []);
        if (profile.supportContacts?.length) setContacts(profile.supportContacts.map((contact) => ({ relation: '', ...contact })));
        if (profile.background) setBackground(profile.background);
      })
      .catch((loadError) => setError(errorMessage(loadError, s.common.saveError)))
      .finally(() => setLoading(false));
  }, [editing, resuming]); // eslint-disable-line react-hooks/exhaustive-deps

  const steps = useMemo(() => {
    const intro = editing || resuming ? [] : ['welcome'];
    if (mode === 'quick') return [...intro, 'substances', 'quit'];
    const screeners = selected.filter((key) => {
      const tool = meta(key)?.screener;
      return !!tool && !!content?.screeners?.[tool];
    });
    return [...intro, 'substances', 'usage', ...screeners.map((key) => `screener:${key}`), 'history', 'readiness', 'reasons', 'triggers', 'about', 'health', 'quit', 'support', 'review'];
  }, [mode, selected, content, editing, resuming]); // eslint-disable-line react-hooks/exhaustive-deps

  const current = steps[Math.min(step, steps.length - 1)];
  const last = step >= steps.length - 1;

  useEffect(() => {
    window.scrollTo({ top: 0 });
  }, [step]);

  const toggleSubstance = (key) => {
    const next = selected.includes(key) ? selected.filter((item) => item !== key) : [...selected, key].slice(0, 6);
    setSelected(next);
    if (!primary || !next.includes(primary)) setPrimary(next[0] || '');
    const substance = meta(key);
    setUsage((old) => (old[key] ? old : { ...old, [key]: { amountPerDay: String(substance?.defaultAmount ?? ''), daysPerWeek: 7, costPerUnit: '', yearsUsing: '', wakeUse: '' } }));
    setQuit((old) => (old[key] ? old : { ...old, [key]: { approach: safetyOf(key)?.defaultApproach || 'now', daysAhead: 1, daysAgo: 0, touched: true } }));
  };

  const setUsageField = (key, field, value) => setUsage((old) => ({ ...old, [key]: { ...old[key], [field]: value } }));
  const setQuitField = (key, patch) => setQuit((old) => ({ ...old, [key]: { ...old[key], ...patch, touched: true } }));
  const setSingle = (field, value) => setBackground((old) => ({ ...old, [field]: old[field] === value ? undefined : value }));
  const toggleMulti = (field, key) => setBackground((old) => ({ ...old, [field]: toggleExclusive(old[field] || [], key) }));

  const validate = () => {
    if (current === 'substances') {
      if (!selected.length) return s.onboarding.pickOne;
      if (selected.includes('other') && !customName.trim()) return s.onboarding.otherName;
    }
    if (current.startsWith('screener:')) {
      const key = current.slice('screener:'.length);
      const tool = meta(key)?.screener;
      const total = content?.screeners?.[tool]?.questions.length || 0;
      const given = (answers[key] || []).filter((value) => value !== undefined).length;
      // Answer all or none; a partial screener cannot be scored.
      if (given && given < total) return s.onboarding.answerAll;
    }
    if (current === 'readiness' && (importance === null || confidence === null)) return s.onboarding.answerAll;
    return null;
  };

  const next = () => {
    const problem = validate();
    setError(problem || '');
    if (!problem) setStep((value) => Math.min(steps.length - 1, value + 1));
  };
  const back = () => {
    setError('');
    if (step === 0) navigation.goBack();
    else setStep((value) => value - 1);
  };

  const buildInput = () => {
    const quitFor = (key) => {
      const item = quit[key] || { approach: 'now', daysAhead: 1, daysAgo: 0, touched: true };
      const approach = safetyOf(key)?.approaches?.includes(item.approach) ? item.approach : safetyOf(key)?.defaultApproach || item.approach;
      // Keep the saved date unless it was changed, so editing never resets a streak.
      const quitDate = !item.touched && item.original ? item.original : quitDateFor(approach, { daysAhead: item.daysAhead, daysAgo: item.daysAgo });
      return { approach, quitDate };
    };
    const input = {
      substances: selected.map((key) => {
        const use = usage[key];
        return {
          key,
          primary: key === primary,
          customName: key === 'other' ? customName.trim() : undefined,
          ...(use
            ? {
                amountPerDay: parseNumber(use.amountPerDay),
                daysPerWeek: use.daysPerWeek,
                costPerUnit: parseNumber(use.costPerUnit),
                yearsUsing: use.yearsUsing ? parseNumber(use.yearsUsing) : undefined,
                wakeUse: use.wakeUse || undefined,
              }
            : {}),
          ...quitFor(key),
        };
      }),
      timezone: timezone(),
    };
    if (mode === 'full') {
      const complete = Object.fromEntries(
        Object.entries(answers).filter(([key, list]) => {
          const tool = meta(key)?.screener;
          const total = content?.screeners?.[tool]?.questions.length || 0;
          return total > 0 && list.filter((value) => value !== undefined).length === total;
        }),
      );
      Object.assign(input, {
        screenerAnswers: complete,
        readiness: { importance: importance ?? 8, confidence: confidence ?? 5 },
        reasonKeys,
        reasons: reasons.trim(),
        letter: letter.trim(),
        triggers,
        background: { ...background, whatHelped: background.whatHelped?.trim() || undefined, notes: background.notes?.trim() || undefined },
        supportContacts: contacts.map((contact) => ({ ...contact, phone: cleanPhone(contact.phone) })).filter((contact) => contact.name.trim() || contact.phone.trim()),
        onboardingCompleted: true,
      });
    } else if (!editing && !resuming) {
      input.onboardingCompleted = false;
    }
    return input;
  };

  const save = async () => {
    setError('');
    try {
      await recoveryApi.saveProfile(buildInput(), lang);
    } catch (saveError) {
      setError(errorMessage(saveError, s.common.saveError));
      return;
    }
    if (editing || mode === 'quick') {
      if (editing) navigation.goBack();
      else navigation.replace('RecoveryHome');
      return;
    }
    setBuilding(true);
    try {
      await recoveryApi.generatePlan(lang);
      navigation.replace('RecoveryPlan', { fromOnboarding: true });
    } catch (_) {
      // The plan screen offers "Build my plan" again; the profile is already saved.
      navigation.replace('RecoveryPlan', { fromOnboarding: true, planFailed: true });
    }
  };

  const title = editing ? s.onboarding.editTitle : s.onboarding.title;

  if (building) {
    return (
      <RecoveryPage title={title} navigation={navigation} showSos={false}>
        <div className="rec-center">
          <Spinner large />
          <strong>{s.onboarding.building}</strong>
        </div>
      </RecoveryPage>
    );
  }

  if (loading || (!content && !contentError)) {
    return (
      <RecoveryPage title={title} navigation={navigation}>
        <div className="rec-center">
          <Spinner large />
        </div>
      </RecoveryPage>
    );
  }

  if (!content) {
    return (
      <RecoveryPage title={title} navigation={navigation}>
        <EmptyState icon="wifi-off" title={s.onboarding.contentError} action={s.common.tryAgain} onAction={reload} />
        <Button label={s.home.helpNow} icon="lifebuoy" onClick={() => navigation.navigate('RecoveryHelp')} />
      </RecoveryPage>
    );
  }

  const nameOf = (key) => (key === 'other' && customName ? customName : meta(key)?.name);

  const renderWelcome = () => (
    <>
      <Card className="rec-hero-card">
        <div className="rec-hero-icon">
          <Icon name="sprout" size={32} />
        </div>
        <h2 className="rec-heading">{s.onboarding.welcomeTitle}</h2>
        <Muted style={{ textAlign: 'center', marginTop: 6 }}>{s.onboarding.welcomeBody}</Muted>
      </Card>
      <InfoCard icon="shield-lock-outline" title={s.onboarding.privacyTitle}>
        <Muted>{s.onboarding.privacyBody}</Muted>
      </InfoCard>
      <Banner icon="alarm-light-outline" tone="warn" text={s.onboarding.notMedical} />
      <OptionCards
        value={mode}
        onChange={setMode}
        options={[
          { value: 'full', label: s.onboarding.fullSetup, hint: s.onboarding.fullSetupHint, icon: 'clipboard-text-outline' },
          { value: 'quick', label: s.onboarding.quickStart, hint: s.onboarding.quickStartHint, icon: 'lightning-bolt-outline' },
        ]}
      />
    </>
  );

  const renderSubstances = () => (
    <>
      <h2 className="rec-heading">{s.onboarding.substancesTitle}</h2>
      <p className="rec-hint">{s.onboarding.substancesHint}</p>
      {content.substances.map((item) => {
        const on = selected.includes(item.key);
        const isPrimary = on && primary === item.key;
        return (
          <div
            key={item.key}
            role="checkbox"
            aria-checked={on}
            tabIndex={0}
            className={`rec-substance${on ? ' is-selected' : ''}`}
            onClick={() => toggleSubstance(item.key)}
            onKeyDown={(event) => {
              if (event.target === event.currentTarget && (event.key === 'Enter' || event.key === ' ')) {
                event.preventDefault();
                toggleSubstance(item.key);
              }
            }}
          >
            <Icon name={item.icon || 'circle-outline'} size={24} />
            <span className="rec-substance-name">{item.name}</span>
            {on && selected.length > 1 ? (
              <button
                type="button"
                className={`rec-star${isPrimary ? ' is-main' : ''}`}
                aria-label={isPrimary ? s.onboarding.main : s.onboarding.makeMain}
                onClick={(event) => {
                  event.stopPropagation();
                  setPrimary(item.key);
                }}
              >
                <Icon name={isPrimary ? 'star' : 'star-outline'} size={22} />
                {isPrimary ? s.onboarding.main : null}
              </button>
            ) : null}
            <Icon name={on ? 'checkbox-marked-circle' : 'checkbox-blank-circle-outline'} size={22} color={on ? 'var(--fit-primary)' : 'var(--fit-text-3)'} />
          </div>
        );
      })}
      {selected.includes('other') ? <Field label={s.onboarding.otherName} value={customName} onChange={setCustomName} /> : null}
    </>
  );

  const renderUsage = () => (
    <>
      <h2 className="rec-heading">{s.onboarding.usageTitle}</h2>
      <p className="rec-hint">{s.onboarding.usageHint}</p>
      {selected.map((key) => {
        const item = meta(key);
        const use = usage[key];
        if (!item || !use) return null;
        return (
          <Card key={key}>
            <h3 className="fit-card-title" style={{ marginBottom: 10 }}>{nameOf(key)}</h3>
            <Field label={f(s.onboarding.perDay, { unit: item.unit })} value={use.amountPerDay} inputMode="decimal" onChange={(value) => setUsageField(key, 'amountPerDay', value)} />
            <Muted style={{ fontSize: 13, marginBottom: 6 }}>{s.onboarding.daysPerWeek}</Muted>
            <Stepper value={use.daysPerWeek} min={1} max={7} onChange={(value) => setUsageField(key, 'daysPerWeek', value)} />
            <div style={{ height: 12 }} />
            <Field label={f(s.onboarding.pricePer, { unit: item.unitOne || item.unit })} value={use.costPerUnit} inputMode="decimal" onChange={(value) => setUsageField(key, 'costPerUnit', value)} />
            <Field label={s.onboarding.yearsUsing} value={use.yearsUsing} inputMode="decimal" suffix={s.common.optional} onChange={(value) => setUsageField(key, 'yearsUsing', value)} />
            <Question title={s.onboarding.wakeQ}>
              <ChipGroup options={WAKE_KEYS.map((value) => ({ label: s.onboarding.wake[value], value }))} value={use.wakeUse} onChange={(value) => setUsageField(key, 'wakeUse', value)} />
            </Question>
          </Card>
        );
      })}
    </>
  );

  const renderScreener = (key) => {
    const item = meta(key);
    const screener = item ? content.screeners[item.screener] : null;
    if (!item || !screener) return null;
    const list = answers[key] || [];
    return (
      <>
        <h2 className="rec-heading">{f(s.onboarding.screenerTitle, { substance: nameOf(key) })}</h2>
        <p className="rec-hint">{s.onboarding.screenerHint}</p>
        <Card>
          {screener.questions.map((question, index) => (
            <Question key={question.text} title={`${index + 1}. ${question.text}`}>
              <ChipGroup
                options={question.options.map((label, option) => ({ label, value: String(option) }))}
                value={list[index] === undefined ? '' : String(list[index])}
                onChange={(value) =>
                  setAnswers((old) => {
                    const nextList = [...(old[key] || [])];
                    nextList[index] = Number(value);
                    return { ...old, [key]: nextList };
                  })
                }
              />
            </Question>
          ))}
        </Card>
      </>
    );
  };

  const options = (field) => content.background?.[field] || [];
  const single = (field, questionTitle) =>
    options(field).length ? (
      <Question title={questionTitle}>
        <ChipGroup options={options(field).map((item) => ({ label: item.label, value: item.key }))} value={background[field] || ''} onChange={(value) => setSingle(field, value)} />
      </Question>
    ) : null;
  const multi = (field, questionTitle, hint, filter) =>
    options(field).length ? (
      <Question title={questionTitle} hint={hint}>
        <MultiChips options={options(field).filter((item) => !filter || filter(item.key))} values={background[field] || []} onToggle={(key) => toggleMulti(field, key)} />
      </Question>
    ) : null;
  const safetyBanner = (key) => (content.backgroundSafety?.[key] ? <Banner key={key} icon="shield-alert-outline" tone="warn" text={content.backgroundSafety[key]} /> : null);

  const renderHistory = () => {
    const flags = redFlagsIn(background.pastWithdrawal, options('pastWithdrawal'));
    return (
      <>
        <h2 className="rec-heading">{s.onboarding.historyTitle}</h2>
        <p className="rec-hint">{`${s.onboarding.historyHint} ${s.onboarding.optionalNote}`}</p>
        <Card>
          {multi('functions', s.onboarding.functionsQ, s.onboarding.functionsHint)}
          {multi('routes', s.onboarding.routesQ)}
          {single('usePattern', s.onboarding.patternQ)}
          <Question title={s.onboarding.attemptsQ}>
            <Stepper value={background.quitAttempts || 0} min={0} max={100} onChange={(value) => setBackground((old) => ({ ...old, quitAttempts: value }))} />
          </Question>
          {single('longestQuit', s.onboarding.longestQ)}
          {(background.quitAttempts || 0) > 0 || (background.longestQuit && background.longestQuit !== 'never') ? (
            <>
              {multi('relapseReasons', s.onboarding.returnedQ)}
              <Field label={s.onboarding.helpedLabel} value={background.whatHelped || ''} onChange={(value) => setBackground((old) => ({ ...old, whatHelped: value }))} multiline maxLength={300} />
            </>
          ) : null}
          {multi('pastWithdrawal', s.onboarding.withdrawalQ)}
        </Card>
        {flags.includes('suicidal') ? safetyBanner('self_harm') : null}
        {flags.some((key) => key !== 'suicidal') ? safetyBanner('seizure_history') : null}
        {background.routes?.includes('inject') ? safetyBanner('inject') : null}
      </>
    );
  };

  const renderAbout = () => (
    <>
      <h2 className="rec-heading">{s.onboarding.aboutTitle}</h2>
      <p className="rec-hint">{`${s.onboarding.aboutHint} ${s.onboarding.optionalNote}`}</p>
      <Card>
        {single('ageGroup', s.onboarding.ageQ)}
        {single('gender', s.onboarding.genderQ)}
        {multi('living', s.onboarding.livingQ)}
        {single('familyKnows', s.onboarding.familyKnowsQ)}
        {single('occupation', s.onboarding.occupationQ)}
        {single('access', s.onboarding.accessQ)}
      </Card>
      {background.ageGroup === 'under18' ? safetyBanner('under18') : null}
    </>
  );

  const renderHealth = () => (
    <>
      <h2 className="rec-heading">{s.onboarding.healthTitle}</h2>
      <p className="rec-hint">{`${s.onboarding.healthHint} ${s.onboarding.optionalNote}`}</p>
      <Card>
        {multi('mentalHealth', s.onboarding.mentalQ)}
        {multi('physicalHealth', s.onboarding.physicalQ, undefined, (key) => key !== 'pregnant' || background.gender !== 'male')}
        {multi('treatment', s.onboarding.treatmentQ)}
        {multi('interests', s.onboarding.interestsQ, s.onboarding.interestsHint)}
        <Field label={s.onboarding.notesLabel} value={background.notes || ''} placeholder={s.onboarding.notesPlaceholder} onChange={(value) => setBackground((old) => ({ ...old, notes: value }))} multiline maxLength={600} />
      </Card>
      {background.physicalHealth?.includes('pregnant') ? safetyBanner('pregnant') : null}
      {background.mentalHealth?.includes('self_harm') ? safetyBanner('self_harm') : null}
    </>
  );

  const renderReadiness = () => (
    <>
      <h2 className="rec-heading">{s.onboarding.readinessTitle}</h2>
      <Card>
        <Question title={s.onboarding.importance}>
          <NumberScale min={0} max={10} value={importance} onChange={setImportance} lang={lang} />
        </Question>
        <Question title={s.onboarding.confidence}>
          <NumberScale min={0} max={10} value={confidence} onChange={setConfidence} lang={lang} />
        </Question>
        <Muted style={{ fontSize: 13 }}>{s.onboarding.readinessNote}</Muted>
      </Card>
    </>
  );

  const renderReasons = () => (
    <>
      <h2 className="rec-heading">{s.onboarding.reasonsTitle}</h2>
      <p className="rec-hint">{s.onboarding.reasonsHint}</p>
      <Card>
        <MultiChips options={content.reasons} values={reasonKeys} onToggle={(key) => setReasonKeys((old) => toggleIn(old, key))} />
        <div style={{ height: 14 }} />
        <Field label={s.onboarding.ownWords} value={reasons} onChange={setReasons} multiline maxLength={1000} />
        <Field label={s.onboarding.letterLabel} value={letter} onChange={setLetter} placeholder={s.onboarding.letterPlaceholder} multiline maxLength={2000} />
      </Card>
    </>
  );

  const renderTriggers = () => (
    <>
      <h2 className="rec-heading">{s.onboarding.triggersTitle}</h2>
      <p className="rec-hint">{s.onboarding.triggersHint}</p>
      <Card>
        <MultiChips options={content.triggers} values={triggers} onToggle={(key) => setTriggers((old) => toggleIn(old, key))} />
      </Card>
    </>
  );

  const renderQuit = () => (
    <>
      <h2 className="rec-heading">{s.onboarding.quitTitle}</h2>
      {selected.map((key) => {
        const item = meta(key);
        const safety = safetyOf(key);
        const plan = quit[key];
        if (!item || !safety || !plan) return null;
        const approach = safety.approaches.includes(plan.approach) ? plan.approach : safety.defaultApproach;
        const dayOptions = Array.from({ length: 14 }, (_, index) => {
          const days = index + 1;
          return { label: days === 1 ? s.onboarding.tomorrow : date(quitDateFor('date', { daysAhead: days }), { weekday: 'short', day: 'numeric', month: 'short' }), value: String(days) };
        });
        const stoppedEarlier = approach === 'now' && plan.daysAgo > 0;
        return (
          <Card key={key}>
            <h3 className="fit-card-title" style={{ marginBottom: 10 }}>{nameOf(key)}</h3>
            {safety.safety ? (
              <div className="rec-safety">
                <Icon name="shield-alert-outline" size={18} />
                <span>{safety.safety}</span>
              </div>
            ) : null}
            {safety.quitAdvice ? <Muted style={{ fontSize: 13, marginBottom: 8 }}>{safety.quitAdvice}</Muted> : null}
            <OptionCards
              value={approach}
              onChange={(value) => setQuitField(key, { approach: value })}
              options={safety.approaches.map((value) => ({ value, label: s.onboarding.approach[value][0], hint: s.onboarding.approach[value][1], icon: APPROACH_ICONS[value] }))}
            />
            {approach === 'now' ? (
              <div style={{ marginTop: 12 }}>
                <ChipGroup
                  options={[
                    { label: s.onboarding.today, value: 'today' },
                    { label: s.onboarding.stoppedEarlier, value: 'earlier' },
                  ]}
                  value={stoppedEarlier ? 'earlier' : 'today'}
                  onChange={(value) => setQuitField(key, { daysAgo: value === 'earlier' ? Math.max(1, plan.daysAgo) : 0 })}
                />
                {stoppedEarlier ? (
                  <div style={{ marginTop: 10 }}>
                    <Muted style={{ fontSize: 13, marginBottom: 6 }}>{s.onboarding.daysAgo}</Muted>
                    <Stepper value={plan.daysAgo} min={1} max={3650} onChange={(value) => setQuitField(key, { daysAgo: value })} suffix={s.common.days} />
                  </div>
                ) : null}
              </div>
            ) : (
              <div style={{ marginTop: 12 }}>
                <Muted style={{ fontSize: 13, marginBottom: 6 }}>{s.onboarding.quitDate}</Muted>
                <ChipGroup options={dayOptions} value={String(plan.daysAhead)} onChange={(value) => setQuitField(key, { daysAhead: Number(value) })} />
              </div>
            )}
            {!plan.touched && plan.original ? <Muted style={{ fontSize: 12, marginTop: 8 }}>{`${s.onboarding.quitDate}: ${date(plan.original)}`}</Muted> : null}
          </Card>
        );
      })}
    </>
  );

  const renderSupport = () => (
    <>
      <h2 className="rec-heading">{s.onboarding.supportTitle}</h2>
      <p className="rec-hint">{s.onboarding.supportHint}</p>
      <ContactsEditor contacts={contacts} onChange={setContacts} />
    </>
  );

  const renderReview = () => (
    <Card className="rec-hero-card">
      <div className="rec-hero-icon">
        <Icon name="map-marker-path" size={30} />
      </div>
      <h2 className="rec-heading">{editing ? s.onboarding.editTitle : s.onboarding.reviewTitle}</h2>
      {!editing ? <Muted style={{ textAlign: 'center', marginTop: 6 }}>{s.onboarding.reviewBody}</Muted> : null}
      <Muted style={{ textAlign: 'center', marginTop: 12, fontSize: 12 }}>{s.onboarding.notMedical}</Muted>
    </Card>
  );

  const body = (() => {
    if (current === 'welcome') return renderWelcome();
    if (current === 'substances') return renderSubstances();
    if (current === 'usage') return renderUsage();
    if (current.startsWith('screener:')) return renderScreener(current.slice('screener:'.length));
    if (current === 'history') return renderHistory();
    if (current === 'about') return renderAbout();
    if (current === 'health') return renderHealth();
    if (current === 'readiness') return renderReadiness();
    if (current === 'reasons') return renderReasons();
    if (current === 'triggers') return renderTriggers();
    if (current === 'quit') return renderQuit();
    if (current === 'support') return renderSupport();
    return renderReview();
  })();

  return (
    <RecoveryPage
      title={title}
      subtitle={f(s.onboarding.stepOf, { n: step + 1, total: steps.length })}
      navigation={{ ...navigation, goBack: back }}
      footer={
        <div className="rec-row" style={{ width: '100%' }}>
          {step > 0 ? <Button label={s.common.back} onClick={back} /> : null}
          {last ? (
            <Button label={editing ? s.onboarding.saveChanges : s.onboarding.start} loadingLabel={s.common.saving} icon="check" variant="primary" onClick={save} style={{ flex: 2 }} />
          ) : (
            <Button label={s.common.continue} icon="arrow-right" variant="primary" onClick={next} style={{ flex: 2 }} />
          )}
        </div>
      }
    >
      <ProgressBar value={step + 1} target={steps.length} height={5} />
      <div style={{ height: 16 }} />
      {error ? <Banner icon="alert-circle-outline" tone="warn" text={error} /> : null}
      {body}
    </RecoveryPage>
  );
};

/** Up to five trusted people (name, phone, relation). Shared with Settings. */
export const ContactsEditor = ({ contacts, onChange }) => {
  const { s } = useRecoveryI18n();
  const update = (index, patch) => onChange(contacts.map((contact, position) => (position === index ? { ...contact, ...patch } : contact)));
  return (
    <>
      {contacts.map((contact, index) => (
        <Card key={index}>
          <div className="rec-contact-head">
            <Icon name="account-heart-outline" size={20} />
            <div style={{ flex: 1 }} />
            {contacts.length > 1 || contact.name || contact.phone ? (
              <button
                type="button"
                className="rec-icon-plain"
                aria-label={s.plan.remove}
                onClick={() => onChange(contacts.length > 1 ? contacts.filter((_, position) => position !== index) : [{ name: '', phone: '', relation: '' }])}
              >
                <Icon name="close" size={20} />
              </button>
            ) : null}
          </div>
          <Field label={s.onboarding.contactName} value={contact.name} onChange={(value) => update(index, { name: value })} />
          <Field label={s.onboarding.contactPhone} value={contact.phone} type="tel" inputMode="tel" onChange={(value) => update(index, { phone: cleanPhone(value) })} />
          <Field label={s.onboarding.contactRelation} value={contact.relation || ''} onChange={(value) => update(index, { relation: value })} />
        </Card>
      ))}
      {contacts.length < 5 ? <Button label={s.onboarding.addPerson} icon="account-plus-outline" variant="ghost" onClick={() => onChange([...contacts, { name: '', phone: '', relation: '' }])} /> : null}
    </>
  );
};

export default RecoveryOnboarding;

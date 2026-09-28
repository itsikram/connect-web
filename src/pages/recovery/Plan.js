import React, { useEffect, useState } from 'react';
import { useLocation } from 'react-router-dom';
import { recoveryApi } from './recoveryApi';
import { TOOL_ICONS } from './content';
import { emptyPlan, parseNumber } from './helpers';
import { useRecoveryContent, useRecoveryDashboard } from './hooks';
import { useRecoveryI18n } from './i18n';
import { useRecoveryNavigation } from './paths';
import { Banner, Button, Card, EmptyState, Field, Icon, InfoCard, Muted, ProgressBar, REC, RecoveryPage, SectionHeader, Spinner, errorMessage } from './ui';

// Web port of expo-connect-app/src/screens/recovery/Plan.tsx.
const RecoveryPlan = () => {
  const navigation = useRecoveryNavigation();
  const params = useLocation().state || {};
  const { lang, s, f, num } = useRecoveryI18n();
  const { content } = useRecoveryContent(lang);
  const { data, loading, refresh } = useRecoveryDashboard(lang);
  const fromOnboarding = !!params.fromOnboarding;
  const [plan, setPlan] = useState(null);
  const [dirty, setDirty] = useState(false);
  const [building, setBuilding] = useState(false);
  const [message, setMessage] = useState(params.planFailed ? s.onboarding.planFailed : '');
  const [newIf, setNewIf] = useState('');
  const [newThen, setNewThen] = useState('');
  const [newStep, setNewStep] = useState('');
  const [newWarning, setNewWarning] = useState('');

  // Load the saved plan once; later dashboard refreshes must not wipe unsaved edits.
  useEffect(() => {
    if (!dirty && data?.profile) setPlan(data.profile.plan);
  }, [data?.profile, dirty]);

  const edit = (patch) => {
    setPlan((old) => ({ ...(old || emptyPlan()), ...patch }));
    setDirty(true);
    setMessage('');
  };

  const build = async () => {
    setBuilding(true);
    setMessage('');
    try {
      const response = await recoveryApi.generatePlan(lang);
      setPlan(response.data.plan);
      setDirty(false);
      refresh();
    } catch (buildError) {
      setMessage(errorMessage(buildError, s.onboarding.planFailed));
    } finally {
      setBuilding(false);
    }
  };

  const confirmRebuild = () => {
    if (window.confirm(`${s.plan.regenerate}\n\n${s.plan.regenerateConfirm}`)) build();
  };

  const save = async () => {
    if (!plan) return;
    try {
      const response = await recoveryApi.updatePlan(plan, lang);
      setPlan(response.data.plan);
      setDirty(false);
      setMessage(s.plan.saved);
      refresh();
    } catch (saveError) {
      setMessage(errorMessage(saveError, s.common.saveError));
    }
  };

  const footer = dirty ? (
    <Button label={s.plan.save} loadingLabel={s.common.saving} icon="content-save-outline" variant="primary" onClick={save} />
  ) : fromOnboarding ? (
    <Button label={s.plan.goHome} icon="home-outline" variant="primary" onClick={() => navigation.replace('RecoveryHome')} />
  ) : undefined;

  if (building || (loading && !data)) {
    return (
      <RecoveryPage title={s.plan.title} navigation={navigation}>
        <div className="rec-center">
          <Spinner large />
          {building ? <strong>{s.plan.building}</strong> : null}
        </div>
      </RecoveryPage>
    );
  }

  const profile = data?.profile;
  const saved = data?.totals?.moneySaved || 0;
  const reasonLabels = (profile?.reasonKeys || []).map((key) => content?.reasons?.find((reason) => reason.key === key)?.label).filter(Boolean);
  const goal = plan?.rewardGoal;
  const removeButton = (onRemove, size = 18) => (
    <button type="button" className="rec-icon-plain" aria-label={s.plan.remove} onClick={onRemove}>
      <Icon name="close" size={size} />
    </button>
  );

  return (
    <RecoveryPage title={s.plan.title} navigation={navigation} footer={footer}>
      {message ? <Banner icon={message === s.plan.saved ? 'check' : 'information-outline'} tone={message === s.plan.saved ? 'good' : 'warn'} text={message} /> : null}

      {!plan ? (
        <EmptyState icon="map-marker-path" title={s.plan.emptyTitle} message={s.plan.emptyBody} action={s.plan.generate} onAction={build} />
      ) : (
        <>
          {plan.summary ? (
            <Card>
              <p className="rec-summary">{plan.summary}</p>
              <Muted style={{ fontSize: 12, marginTop: 8 }}>{plan.source === 'gemini' ? s.plan.madeByAi : s.plan.madeCurated}</Muted>
            </Card>
          ) : null}
          {plan.safetyNote ? (
            <InfoCard icon="shield-alert-outline" title={s.plan.safetyTitle} tone={REC.sos}>
              <p className="rec-body">{plan.safetyNote}</p>
            </InfoCard>
          ) : null}

          <SectionHeader title={s.plan.ifThenTitle} />
          <Muted style={{ fontSize: 13, marginBottom: 10, marginTop: -4 }}>{s.plan.ifThenHint}</Muted>
          {plan.ifThen.map((item, index) => (
            <Card key={`${index}-${item.action}`}>
              <div className="rec-row-top">
                <div style={{ flex: 1 }}>
                  <p className="rec-body">
                    <strong>{`${s.plan.ifLabel} `}</strong>
                    {item.trigger}
                  </p>
                  <p className="rec-body" style={{ marginTop: 4 }}>
                    <strong style={{ color: 'var(--fit-primary)' }}>{`${s.plan.thenLabel} `}</strong>
                    {item.action}
                  </p>
                </div>
                {removeButton(() => edit({ ifThen: plan.ifThen.filter((_, position) => position !== index) }), 20)}
              </div>
            </Card>
          ))}
          {plan.ifThen.length < 10 ? (
            <Card>
              <Field label={s.plan.ifLabel} value={newIf} onChange={setNewIf} />
              <Field label={s.plan.thenLabel} value={newThen} onChange={setNewThen} />
              <Button
                label={s.plan.addIfThen}
                icon="plus"
                disabled={!newThen.trim()}
                onClick={() => {
                  edit({ ifThen: [...plan.ifThen, { trigger: newIf.trim(), action: newThen.trim() }] });
                  setNewIf('');
                  setNewThen('');
                }}
              />
            </Card>
          ) : null}

          <SectionHeader title={s.plan.checklistTitle} />
          <Muted style={{ fontSize: 13, marginBottom: 10, marginTop: -4 }}>{s.plan.checklistHint}</Muted>
          <Card>
            {plan.checklist.map((item, index) => (
              <div key={`${index}-${item.text}`} className="rec-check-row">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={item.done}
                  className={`rec-check-press${item.done ? ' is-done' : ''}`}
                  onClick={() => edit({ checklist: plan.checklist.map((entry, position) => (position === index ? { ...entry, done: !entry.done } : entry)) })}
                >
                  <Icon name={item.done ? 'checkbox-marked' : 'checkbox-blank-outline'} size={22} color={item.done ? 'var(--fit-success)' : 'var(--fit-text-2)'} />
                  <span>{item.text}</span>
                </button>
                {removeButton(() => edit({ checklist: plan.checklist.filter((_, position) => position !== index) }))}
              </div>
            ))}
            {plan.checklist.length < 15 ? (
              <>
                <Field label={s.plan.addStep} value={newStep} placeholder={s.plan.stepPlaceholder} onChange={setNewStep} style={{ marginTop: 10 }} />
                <Button
                  label={s.plan.addStep}
                  icon="plus"
                  disabled={!newStep.trim()}
                  onClick={() => {
                    edit({ checklist: [...plan.checklist, { text: newStep.trim(), done: false }] });
                    setNewStep('');
                  }}
                />
              </>
            ) : null}
          </Card>

          {plan.replacements?.length ? (
            <>
              <SectionHeader title={s.plan.replacementsTitle} />
              <Muted style={{ fontSize: 13, marginBottom: 10, marginTop: -4 }}>{s.plan.replacementsHint}</Muted>
              {plan.replacements.map((item, index) => (
                <Card key={`${index}-${item.need}`}>
                  <div className="rec-row-top">
                    <Icon name="swap-horizontal" size={20} color="var(--fit-primary)" />
                    <div style={{ flex: 1 }}>
                      <p className="rec-body" style={{ fontWeight: 800 }}>{item.need}</p>
                      <p className="rec-body" style={{ marginTop: 4 }}>
                        <strong style={{ color: 'var(--fit-primary)' }}>{`${s.plan.instead} `}</strong>
                        {item.activity}
                      </p>
                    </div>
                    {removeButton(() => edit({ replacements: plan.replacements.filter((_, position) => position !== index) }))}
                  </div>
                </Card>
              ))}
            </>
          ) : null}

          <SectionHeader title={s.plan.warningTitle} />
          <Muted style={{ fontSize: 13, marginBottom: 10, marginTop: -4 }}>{s.plan.warningHint}</Muted>
          <Card>
            {(plan.warningSigns || []).map((item, index) => (
              <div key={`${index}-${item}`} className="rec-check-row">
                <Icon name="alert-outline" size={20} color={REC.warm} />
                <span className="rec-body" style={{ flex: 1 }}>{item}</span>
                {removeButton(() => edit({ warningSigns: plan.warningSigns.filter((_, position) => position !== index) }))}
              </div>
            ))}
            {(plan.warningSigns || []).length < 8 ? (
              <>
                <Field label={s.plan.addWarning} value={newWarning} placeholder={s.plan.warningPlaceholder} onChange={setNewWarning} style={{ marginTop: 10 }} />
                <Button
                  label={s.plan.addWarning}
                  icon="plus"
                  disabled={!newWarning.trim()}
                  onClick={() => {
                    edit({ warningSigns: [...(plan.warningSigns || []), newWarning.trim()] });
                    setNewWarning('');
                  }}
                />
              </>
            ) : null}
          </Card>

          {plan.tools.length ? (
            <>
              <SectionHeader title={s.plan.toolsTitle} />
              <div className="rec-plan-tools">
                {plan.tools.map((tool) => (
                  <button key={tool} type="button" className="fit-chip" onClick={() => navigation.navigate('RecoverySos', { tool })}>
                    <Icon name={TOOL_ICONS[tool]} size={18} color="var(--fit-primary)" />
                    {s.sos.tools[tool][0]}
                  </button>
                ))}
              </div>
            </>
          ) : null}

          {plan.weeklyGoals.length ? (
            <>
              <SectionHeader title={s.plan.weeksTitle} />
              {plan.weeklyGoals.map((item, index) => (
                <Card key={`${item.week}-${index}`}>
                  <button
                    type="button"
                    role="checkbox"
                    aria-checked={!!item.done}
                    className="rec-check-press"
                    onClick={() => edit({ weeklyGoals: plan.weeklyGoals.map((entry, position) => (position === index ? { ...entry, done: !entry.done } : entry)) })}
                  >
                    <Icon name={item.done ? 'check-circle' : `numeric-${Math.min(9, Math.max(1, item.week))}-circle-outline`} size={24} color={item.done ? 'var(--fit-success)' : 'var(--fit-primary)'} />
                    <span style={{ flex: 1 }}>
                      <span className="rec-week-label" style={{ display: 'block' }}>{f(s.plan.week, { n: num(item.week) })}</span>
                      <span className="rec-body" style={{ display: 'block', fontWeight: 700 }}>{item.goal}</span>
                      {item.expect ? <span className="fit-muted" style={{ display: 'block', fontSize: 13, marginTop: 4 }}>{f(s.plan.expect, { text: item.expect })}</span> : null}
                    </span>
                  </button>
                </Card>
              ))}
            </>
          ) : null}

          <SectionHeader title={s.plan.rewardTitle} />
          <Card>
            {plan.rewardIdea ? <Muted style={{ marginBottom: 10 }}>{plan.rewardIdea}</Muted> : null}
            <Field label={s.plan.rewardName} value={goal?.title || ''} onChange={(value) => edit({ rewardGoal: { title: value, amount: goal?.amount || 0 } })} />
            <Field label={s.plan.rewardAmount} value={goal?.amount ? String(goal.amount) : ''} inputMode="numeric" onChange={(value) => edit({ rewardGoal: { title: goal?.title || '', amount: parseNumber(value) } })} />
            {goal?.amount ? (
              <>
                <ProgressBar value={saved} target={goal.amount} color={REC.money} height={10} />
                <div className="rec-reward" style={{ color: saved >= goal.amount ? REC.money : 'var(--fit-text-2)' }}>
                  {saved >= goal.amount ? s.plan.rewardReached : f(s.plan.rewardProgress, { saved: num(saved), goal: num(goal.amount) })}
                </div>
              </>
            ) : null}
          </Card>
        </>
      )}

      {profile ? (
        <>
          <SectionHeader title={s.plan.reasonsTitle} action={s.plan.editReasons} onAction={() => navigation.navigate('RecoveryOnboarding', { edit: true })} />
          <Card>
            {reasonLabels.map((label) => (
              <div key={label} className="rec-reason-row">
                <Icon name="heart" size={16} color={REC.sos} />
                <span style={{ flex: 1 }}>{label}</span>
              </div>
            ))}
            {profile.reasons ? <p className="rec-quote">{profile.reasons}</p> : null}
            {!reasonLabels.length && !profile.reasons ? <Muted>{s.sos.noReasons}</Muted> : null}
          </Card>
        </>
      ) : null}

      {plan ? <Button label={s.plan.regenerate} icon="refresh" variant="ghost" onClick={confirmRebuild} /> : null}
    </RecoveryPage>
  );
};

export default RecoveryPlan;

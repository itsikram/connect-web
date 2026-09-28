import React, { useCallback, useMemo, useRef, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { newClientId, recoveryApi } from './recoveryApi';
import { OFFLINE_HELPLINES, OFFLINE_TRIGGERS, TOOL_ICONS } from './content';
import { hasPersonalOrder, orderTools } from './helpers';
import { useCachedDashboard, useRecoveryContent } from './hooks';
import { useRecoveryI18n } from './i18n';
import { useRecoveryNavigation } from './paths';
import { Banner, BreathingCircle, Button, Card, ChipGroup, EmergencyStrip, Icon, InfoCard, MultiChips, Muted, NumberScale, Question, REC, RecoveryPage, UrgeTimer, callPhone, sendSms } from './ui';

// Web port of expo-connect-app/src/screens/recovery/Sos.tsx.
// Every step works offline; the session is queued and synced later if needed.
const RecoverySos = () => {
  const navigation = useRecoveryNavigation();
  const routerNavigate = useNavigate();
  const params = useLocation().state || {};
  const { lang, s, f, num, money } = useRecoveryI18n();
  const { content } = useRecoveryContent(lang);
  const dashboard = useCachedDashboard();
  const initialTool = params.tool;

  const [phase, setPhase] = useState(initialTool ? 'tool' : 'rate');
  const [tool, setTool] = useState(initialTool || null);
  const [intensity, setIntensity] = useState(null);
  const [intensityEnd, setIntensityEnd] = useState(null);
  const [trigger, setTrigger] = useState('');
  const [substance, setSubstance] = useState('');
  const [step, setStep] = useState(0);
  const [result, setResult] = useState(null);
  const [saveError, setSaveError] = useState('');
  const toolsUsed = useRef(new Set(initialTool ? [initialTool] : []));
  const startedAt = useRef(Date.now());
  const clientId = useRef(newClientId());
  const logged = useRef(false);

  const profile = dashboard?.profile;
  const substances = dashboard?.substances || [];
  const primary = substances.find((item) => item.primary) || substances[0];
  const tools = useMemo(() => orderTools(dashboard?.toolOrder), [dashboard?.toolOrder]);
  const personal = hasPersonalOrder(dashboard?.toolOrder);
  const triggers = content?.triggers?.length ? content.triggers : OFFLINE_TRIGGERS[lang];
  const helplines = (content?.helplines?.length ? content.helplines : OFFLINE_HELPLINES[lang]).filter((line) => line.crisis && line.key !== 'emergency');
  const contacts = (profile?.supportContacts || []).filter((contact) => contact.phone);
  const reasonLabels = (profile?.reasonKeys || []).map((key) => content?.reasons?.find((reason) => reason.key === key)?.label).filter(Boolean);

  const waveDone = useCallback(() => setPhase('outcome'), []);

  const openTool = (key) => {
    toolsUsed.current.add(key);
    if (key === 'coach') {
      navigation.navigate('RecoveryCoach', { mode: 'sos' });
      return;
    }
    setTool(key);
    setStep(0);
    setPhase('tool');
  };

  const log = async (outcome) => {
    if (logged.current || !profile) return null;
    logged.current = true;
    const start = intensity ?? intensityEnd ?? 5;
    try {
      return await recoveryApi.logCraving(
        {
          clientId: clientId.current,
          at: new Date(startedAt.current).toISOString(),
          substance: substance || primary?.key,
          intensityStart: Math.max(1, start),
          intensityEnd: intensityEnd ?? undefined,
          trigger: trigger || undefined,
          tools: [...toolsUsed.current],
          durationSec: Math.round((Date.now() - startedAt.current) / 1000),
          outcome,
        },
        lang,
      );
    } catch (_) {
      // The server rejected it (not a network problem). The person still got through; do not block them.
      setSaveError(s.common.saveError);
      return null;
    }
  };

  const finish = async (outcome) => {
    const saved = await log(outcome);
    if (outcome === 'used') {
      navigation.replace('RecoveryLapse', { substance: substance || primary?.key });
      return;
    }
    setResult(saved);
    setPhase('done');
  };

  const playGame = async (game) => {
    toolsUsed.current.add('distract');
    await log('unsure');
    routerNavigate(game === 'ludo' ? '/ludo-game' : '/chess-game');
  };

  const renderTool = () => {
    switch (tool) {
      case 'urge_surf':
        return (
          <InfoCard icon="waves" title={s.sos.urgeTitle}>
            <Muted style={{ marginBottom: 10 }}>{s.sos.urgeBody}</Muted>
            <UrgeTimer lang={lang} onComplete={waveDone} />
          </InfoCard>
        );
      case 'breathing':
        return (
          <Card>
            <BreathingCircle lang={lang} autoStart />
          </Card>
        );
      case 'reasons':
        return (
          <InfoCard icon="heart-outline" title={s.sos.reasonsTitle}>
            {reasonLabels.map((label) => (
              <div key={label} className="rec-bullet">
                <Icon name="heart" size={16} color={REC.sos} />
                <span>{label}</span>
              </div>
            ))}
            {profile?.reasons ? <p className="rec-quote">{profile.reasons}</p> : null}
            {!reasonLabels.length && !profile?.reasons ? <Muted>{s.sos.noReasons}</Muted> : null}
            {profile?.letter ? (
              <div className="rec-letter">
                <div className="rec-letter-title">{s.sos.letterTitle}</div>
                <p className="rec-quote">{profile.letter}</p>
              </div>
            ) : null}
            {dashboard?.totals?.moneySaved ? <div className="rec-strong" style={{ color: REC.money }}>{f(s.sos.moneyLine, { amount: num(dashboard.totals.moneySaved) })}</div> : null}
            {primary?.currentStreakDays ? <div className="rec-strong">{f(s.sos.daysLine, { days: num(primary.currentStreakDays) })}</div> : null}
          </InfoCard>
        );
      case 'tape_forward':
      case 'grounding':
      case 'four_ds': {
        const items = tool === 'tape_forward' ? s.sos.tapeQuestions.map((text) => [text, '']) : tool === 'grounding' ? s.sos.groundingSteps.map((text) => [text, '']) : s.sos.fourDs;
        const [title, detail] = items[Math.min(step, items.length - 1)];
        const last = step >= items.length - 1;
        return (
          <InfoCard icon={TOOL_ICONS[tool]} title={s.sos.tools[tool][0]}>
            <Muted style={{ fontSize: 13 }}>{`${num(step + 1)} / ${num(items.length)}`}</Muted>
            <div className="rec-big-step" aria-live="polite">{title}</div>
            {detail ? <Muted style={{ marginBottom: 10 }}>{detail}</Muted> : null}
            <Button label={last ? s.common.done : s.sos.nextStep} icon={last ? 'check' : 'arrow-right'} variant="primary" onClick={() => (last ? setPhase('tools') : setStep(step + 1))} />
          </InfoCard>
        );
      }
      case 'distract':
        return (
          <>
            <InfoCard icon="gamepad-variant-outline" title={s.sos.gamesTitle}>
              <Muted style={{ marginBottom: 10 }}>{s.sos.gamesBody}</Muted>
              <div className="rec-row">
                <Button label={s.sos.playLudo} icon="dice-5-outline" onClick={() => playGame('ludo')} />
                <Button label={s.sos.playChess} icon="chess-knight" onClick={() => playGame('chess')} />
              </div>
            </InfoCard>
            <InfoCard icon="walk" title={s.sos.tools.distract[0]}>
              {s.sos.distractIdeas.map((idea) => (
                <div key={idea} className="rec-bullet">
                  <Icon name="circle-small" size={8} color="var(--fit-primary)" />
                  <span>{idea}</span>
                </div>
              ))}
            </InfoCard>
          </>
        );
      case 'call_support':
        return (
          <InfoCard icon="phone-outline" title={s.sos.tools.call_support[0]}>
            {contacts.length ? (
              contacts.map((contact) => (
                <div key={`${contact.name}-${contact.phone}`} className="rec-row">
                  <Button label={f(s.sos.callPerson, { name: contact.name || contact.phone })} icon="phone" variant="primary" onClick={() => callPhone(contact.phone)} />
                  <Button label={s.help.message} icon="message-text-outline" onClick={() => sendSms(contact.phone, s.sos.smsText)} />
                </div>
              ))
            ) : (
              <Muted>{s.sos.noContact}</Muted>
            )}
            <div className="rec-subhead">{s.sos.orHelpline}</div>
            {helplines.map((line) => (
              <Button key={line.key} label={`${line.name} · ${line.display}`} icon="phone-outline" onClick={() => callPhone(line.phone)} />
            ))}
          </InfoCard>
        );
      default:
        return null;
    }
  };

  const footer =
    phase === 'rate' ? (
      <Button label={s.sos.start} icon="arrow-right" variant="primary" disabled={intensity === null} onClick={() => setPhase('tools')} />
    ) : phase === 'tools' || phase === 'tool' ? (
      <div className="rec-row" style={{ width: '100%' }}>
        {phase === 'tool' ? <Button label={s.common.back} icon="view-grid-outline" onClick={() => setPhase('tools')} /> : null}
        <Button label={s.sos.finish} icon="flag-checkered" variant="primary" onClick={() => setPhase('outcome')} style={{ flex: 2 }} />
      </div>
    ) : phase === 'done' ? (
      <Button label={s.sos.backHome} icon="home-outline" variant="primary" onClick={() => navigation.replace('RecoveryHome')} />
    ) : undefined;

  return (
    <RecoveryPage title={s.sos.title} subtitle={s.sos.subtitle} navigation={navigation} showSos={false} footer={footer}>
      <EmergencyStrip lang={lang} />

      {phase === 'rate' ? (
        <Card>
          <Question title={s.sos.rateTitle}>
            <NumberScale min={1} max={10} value={intensity} onChange={setIntensity} lang={lang} lowLabel={s.sos.mild} highLabel={s.sos.overwhelming} danger />
          </Question>
          {substances.length > 1 ? (
            <Question title={s.sos.cravingFor}>
              <ChipGroup options={substances.map((item) => ({ label: item.name, value: item.key }))} value={substance || primary?.key || ''} onChange={setSubstance} />
            </Question>
          ) : null}
          <Question title={s.sos.triggerQ} hint={s.common.optional}>
            <MultiChips options={triggers} values={trigger ? [trigger] : []} onToggle={(key) => setTrigger(trigger === key ? '' : key)} />
          </Question>
        </Card>
      ) : null}

      {phase === 'tools' ? (
        <>
          <h2 className="rec-title">{s.sos.toolsTitle}</h2>
          {tools.map((key, index) => (
            <button key={key} type="button" className={`rec-tool${index === 0 && personal ? ' is-personal' : ''}`} onClick={() => openTool(key)}>
              <span className="rec-tool-icon">
                <Icon name={TOOL_ICONS[key]} size={24} />
              </span>
              <span style={{ flex: 1 }}>
                <span className="rec-tool-title" style={{ display: 'block' }}>{s.sos.tools[key][0]}</span>
                <span className="rec-tool-sub" style={{ display: 'block' }}>{s.sos.tools[key][1]}</span>
                {index === 0 && personal ? <span className="rec-worked" style={{ display: 'block' }}>{s.sos.workedBefore}</span> : null}
              </span>
              {toolsUsed.current.has(key) ? <Icon name="check-circle" size={20} color="var(--fit-success)" /> : <Icon name="chevron-right" size={22} color="var(--fit-text-3)" />}
            </button>
          ))}
        </>
      ) : null}

      {phase === 'tool' ? renderTool() : null}

      {phase === 'outcome' ? (
        <Card>
          {intensity === null ? (
            <Question title={s.sos.startWas}>
              <NumberScale min={1} max={10} value={intensity} onChange={setIntensity} lang={lang} lowLabel={s.sos.mild} highLabel={s.sos.overwhelming} danger />
            </Question>
          ) : null}
          <Question title={s.sos.outcomeTitle}>
            <NumberScale min={0} max={10} value={intensityEnd} onChange={setIntensityEnd} lang={lang} lowLabel={s.sos.mild} highLabel={s.sos.overwhelming} danger />
          </Question>
          <Question title={s.sos.outcomeQ}>
            <Button label={s.sos.resisted} icon="shield-check" variant="primary" onClick={() => finish('resisted')} />
            <Button label={s.sos.used} icon="restart" onClick={() => finish('used')} />
          </Question>
        </Card>
      ) : null}

      {phase === 'done' ? (
        <Card className="rec-hero-card">
          <div className="rec-party" aria-hidden="true">🎉</div>
          <h2 className="rec-title">{s.sos.celebrateTitle}</h2>
          <Muted style={{ textAlign: 'center', marginTop: 6 }}>{s.sos.celebrateBody}</Muted>
          {result?.pointsEarned ? <div className="rec-strong" style={{ color: REC.warm }}>{f(s.common.points, { n: num(result.pointsEarned) })}</div> : null}
          {(result?.newBadges || []).map((badge) => (
            <div key={badge.key} className="rec-strong">{f(s.common.newBadge, { label: badge.label })}</div>
          ))}
          {dashboard?.totals?.moneySaved ? <Muted style={{ marginTop: 8 }}>{`${s.home.moneySaved}: ${money(dashboard.totals.moneySaved)}`}</Muted> : null}
          {result?.queued ? <Banner icon="cloud-upload-outline" text={s.sos.savedOffline} /> : null}
          {saveError ? <Banner icon="alert-circle-outline" tone="warn" text={saveError} /> : null}
        </Card>
      ) : null}

      {phase !== 'done' && phase !== 'rate' ? <Button label={s.sos.talkNow} icon="robot-happy-outline" variant="ghost" onClick={() => openTool('coach')} /> : null}
    </RecoveryPage>
  );
};

export default RecoverySos;

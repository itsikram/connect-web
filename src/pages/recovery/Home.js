import React, { useEffect, useRef, useState } from 'react';
import { recoveryApi } from './recoveryApi';
import { useRecoveryI18n } from './i18n';
import { useRecoveryDashboard } from './hooks';
import { REMINDER_PATHS, useRecoveryNavigation } from './paths';
import { syncRecoveryReminders } from './reminders';
import {
  Banner,
  Button,
  Card,
  CleanTimeCounter,
  EmergencyStrip,
  EmptyState,
  HeaderIconButton,
  Icon,
  Muted,
  REC,
  RecoveryPage,
  Ring,
  SectionHeader,
  Segmented,
  SosButton,
  Spinner,
  StatTile,
} from './ui';

// Web port of expo-connect-app/src/screens/recovery/Home.tsx.
const RecoveryHome = () => {
  const navigation = useRecoveryNavigation();
  const { lang, s, f, num, money, duration } = useRecoveryI18n();
  const { data, loading, refreshing, error, offsetMs, refresh, pullToRefresh } = useRecoveryDashboard(lang);
  const [selectedKey, setSelectedKey] = useState(null);
  const [daily, setDaily] = useState(null);
  const [pending, setPending] = useState(0);
  const dailyRequested = useRef('');

  // Upload SOS sessions that were saved while offline.
  useEffect(() => {
    const sync = async () => {
      const sent = await recoveryApi.flushOutbox(lang).catch(() => 0);
      if (sent) refresh();
      setPending(recoveryApi.pendingCount());
    };
    sync();
    window.addEventListener('online', sync);
    return () => window.removeEventListener('online', sync);
  }, [lang, refresh]);

  // Keep in-browser reminders (check-in, risky times, next milestone) in step with fresh data.
  useEffect(() => {
    if (data && !error) syncRecoveryReminders(data, lang, REMINDER_PATHS);
  }, [data, error, lang]);

  // The AI note is generated once per day, after the dashboard is on screen.
  useEffect(() => {
    if (!data?.profile) return;
    if (data.daily) {
      setDaily(data.daily);
      return;
    }
    const key = `${data.todayKey}-${lang}`;
    if (dailyRequested.current === key) return;
    dailyRequested.current = key;
    recoveryApi
      .getDaily(lang)
      .then((response) => setDaily(response.data))
      .catch(() => {});
  }, [data?.profile, data?.daily, data?.todayKey, lang]); // eslint-disable-line react-hooks/exhaustive-deps

  const sosFooter = <SosButton label={s.common.sos} onPress={() => navigation.navigate('RecoverySos')} />;

  if (loading && !data) {
    return (
      <RecoveryPage title={s.home.title} navigation={navigation} showSos={false} footer={sosFooter}>
        <div className="rec-center">
          <Spinner large />
          <Muted>{s.common.loading}</Muted>
        </div>
      </RecoveryPage>
    );
  }

  if (error && !data) {
    return (
      <RecoveryPage title={s.home.title} navigation={navigation} showSos={false} footer={sosFooter}>
        <EmergencyStrip lang={lang} />
        <EmptyState icon="wifi-off" title={s.common.offline} message={error} action={s.common.tryAgain} onAction={refresh} />
        <Button label={s.home.helpNow} icon="lifebuoy" onClick={() => navigation.navigate('RecoveryHelp')} />
      </RecoveryPage>
    );
  }

  if (!data?.profile) {
    return (
      <RecoveryPage title={s.home.title} navigation={navigation} showSos={false} footer={sosFooter}>
        <Card className="rec-hero-card">
          <div className="rec-hero-icon">
            <Icon name="sprout" size={34} />
          </div>
          <h2 className="fit-welcome-title">{s.home.welcomeTitle}</h2>
          <Muted style={{ textAlign: 'center', marginTop: 6 }}>{s.home.welcomeBody}</Muted>
          {s.home.features.map((feature, index) => (
            <div key={feature} className="fit-feature" style={{ textAlign: 'left' }}>
              <Icon name={['lifebuoy', 'robot-happy-outline', 'chart-line', 'shield-lock-outline'][index]} size={20} />
              <span>{feature}</span>
            </div>
          ))}
          <Button label={s.home.start} icon="arrow-right" variant="primary" onClick={() => navigation.navigate('RecoveryOnboarding')} style={{ marginTop: 18 }} />
          <Button label={s.home.helpNow} variant="ghost" icon="phone-outline" onClick={() => navigation.navigate('RecoveryHelp')} />
        </Card>
        <Muted style={{ fontSize: 12, textAlign: 'center', marginTop: 14 }}>{s.onboarding.notMedical}</Muted>
      </RecoveryPage>
    );
  }

  const { profile } = data;
  const substances = data.substances || [];
  const current = substances.find((item) => item.key === selectedKey) || substances.find((item) => item.primary) || substances[0];
  const preparing = current?.status === 'preparing';
  const totals = data.totals;
  const tiles = [
    { key: 'coach', icon: 'robot-happy-outline', route: 'RecoveryCoach' },
    { key: 'checkin', icon: 'calendar-check-outline', route: 'RecoveryCheckIn' },
    { key: 'plan', icon: 'map-marker-path', route: 'RecoveryPlan' },
    { key: 'progress', icon: 'chart-timeline-variant', route: 'RecoveryProgress' },
    { key: 'slip', icon: 'restart', route: 'RecoveryLapse' },
    { key: 'help', icon: 'lifebuoy', route: 'RecoveryHelp' },
  ];
  const celebrations = (data.newBadges || []).filter((badge) => badge.key.startsWith('clean_'));
  const otherNewBadges = (data.newBadges || []).filter((badge) => !badge.key.startsWith('clean_'));

  return (
    <RecoveryPage
      title={s.home.title}
      navigation={navigation}
      showSos={false}
      refreshing={refreshing}
      onRefresh={pullToRefresh}
      right={<HeaderIconButton icon="cog-outline" label={s.home.settings} onClick={() => navigation.navigate('RecoverySettings')} />}
      footer={sosFooter}
    >
      {error ? <Banner icon="cloud-off-outline" text={s.common.offline} /> : null}
      {pending ? <Banner icon="cloud-upload-outline" text={f(s.home.pendingSync, { n: num(pending) })} /> : null}
      {celebrations.map((badge) => (
        <Banner key={badge.key} icon="party-popper" tone="good" text={f(s.home.celebrate, { label: badge.label.replace(/ free$| মুক্ত$/, '') })} />
      ))}
      {otherNewBadges.map((badge) => (
        <Banner key={badge.key} icon="medal-outline" tone="good" text={f(s.common.newBadge, { label: badge.label })} />
      ))}

      {substances.length > 1 ? <Segmented options={substances.map((item) => ({ label: item.name, value: item.key }))} value={current?.key || ''} onChange={setSelectedKey} /> : null}

      {current ? (
        <Card className="rec-hero">
          <div className="rec-hero-label">{preparing ? s.home.quitIn : `${s.home.cleanFor} · ${current.name}`}</div>
          <Ring size={214} stroke={14} progress={preparing ? 0 : current.milestone.progress} color="var(--fit-primary)">
            <CleanTimeCounter since={current.streakStart} until={preparing ? Date.parse(current.quitDate) : null} lang={lang} offsetMs={offsetMs} />
          </Ring>
          {!preparing ? <div className="rec-milestone">{current.milestone.nextLabel ? f(s.home.nextMilestone, { label: current.milestone.nextLabel }) : s.home.allMilestones}</div> : null}
          {!preparing && current.milestone.nextLabel ? <Muted style={{ fontSize: 13 }}>{duration(current.milestone.msToNext)}</Muted> : null}
        </Card>
      ) : null}

      {current ? (
        <div className="rec-fit-grid">
          <StatTile icon="cash-multiple" color={REC.money} label={s.home.moneySaved} value={money(preparing ? 0 : totals?.moneySaved)} />
          <StatTile icon="close-circle-outline" color={REC.calm} label={f(s.home.unitsAvoided, { unit: current.unit })} value={num(current.unitsAvoided)} />
          <StatTile icon="shield-check-outline" color="var(--fit-success)" label={s.home.cravingsBeaten} value={num(totals?.cravingsResisted)} />
          {current.lifeRegainedMinutes ? (
            <StatTile icon="heart-pulse" color={REC.sos} label={s.home.lifeRegained} value={duration(current.lifeRegainedMinutes * 60000)} />
          ) : (
            <StatTile icon="trophy-outline" color={REC.warm} label={s.home.longest} value={`${num(current.longestStreakDays)} ${s.common.days}`} />
          )}
        </div>
      ) : null}

      {!profile.onboardingCompleted ? (
        <Card>
          <div className="rec-row-head">
            <Icon name="clipboard-text-outline" size={22} color="var(--fit-primary)" />
            <h3 className="rec-card-title">{s.home.completePlanTitle}</h3>
          </div>
          <Muted style={{ fontSize: 13 }}>{s.home.completePlanBody}</Muted>
          <Button label={s.home.completePlanCta} icon="arrow-right" variant="primary" onClick={() => navigation.navigate('RecoveryOnboarding', { resume: true })} />
        </Card>
      ) : null}

      {data.proHelp?.length ? (
        <Card>
          <div className="rec-row-head">
            <Icon name="doctor" size={22} color={REC.warm} />
            <h3 className="rec-card-title">{s.home.proHelpTitle}</h3>
          </div>
          <Muted style={{ fontSize: 13 }}>{s.home.proHelp[data.proHelp[0]]}</Muted>
          <Button label={s.home.proHelpCta} icon="lifebuoy" onClick={() => navigation.navigate('RecoveryHelp')} />
        </Card>
      ) : null}

      <SectionHeader title={s.home.todayTitle} />
      <Card onClick={() => navigation.navigate('RecoveryCheckIn')}>
        <div className="rec-row-head">
          <Icon name={data.today?.checkin ? 'check-circle' : 'calendar-check-outline'} size={22} color={data.today?.checkin ? 'var(--fit-success)' : 'var(--fit-primary)'} />
          <h3 className="rec-card-title">{data.today?.checkin ? s.home.checkinDone : s.home.checkinTitle}</h3>
          {totals?.checkinStreak ? <span className="rec-pill">{f(s.home.checkinStreak, { n: num(totals.checkinStreak) })}</span> : null}
        </div>
        <Muted style={{ fontSize: 13 }}>{data.today?.checkin?.microGoal || data.today?.checkin?.reflection || s.home.checkinPrompt}</Muted>
      </Card>
      {daily ? (
        <Card>
          <div className="rec-row-head">
            <Icon name="white-balance-sunny" size={22} color={REC.warm} />
            <p className="rec-daily-note">{daily.note}</p>
          </div>
          <div className="rec-mission">
            <Icon name="flag-checkered" size={18} />
            <div style={{ flex: 1 }}>
              <div className="rec-mission-label">{s.home.mission}</div>
              <div className="rec-mission-text">{daily.mission}</div>
            </div>
          </div>
        </Card>
      ) : null}

      {current && !preparing && (current.health.last || current.health.next) ? (
        <Card>
          <div className="rec-row-head">
            <Icon name="heart-plus-outline" size={22} color={REC.sos} />
            <h3 className="rec-card-title">{s.home.healthTitle}</h3>
          </div>
          {current.health.last ? (
            <div className="rec-health-row">
              <Icon name="check-circle" size={18} color="var(--fit-success)" />
              <span>
                <strong>{f(s.home.healthNow, { at: current.health.last.at })}. </strong>
                {current.health.last.text}
              </span>
            </div>
          ) : null}
          {current.health.next ? (
            <div className="rec-health-row" style={{ color: 'var(--fit-text-2)' }}>
              <Icon name="progress-clock" size={18} color="var(--fit-primary)" />
              <span>
                <strong style={{ color: 'var(--fit-text)' }}>{f(s.home.healthNext, { at: current.health.next.at })}. </strong>
                {current.health.next.text} ({duration(current.health.msToNext)})
              </span>
            </div>
          ) : null}
        </Card>
      ) : null}

      <SectionHeader title={s.home.toolsTitle} />
      <div className="rec-tools">
        {tiles.map((tile) => {
          const [label, hint] = s.home.tools[tile.key];
          return (
            <Card key={tile.key} onClick={() => navigation.navigate(tile.route)}>
              <Icon name={tile.icon} size={24} color={tile.key === 'help' || tile.key === 'slip' ? REC.sos : 'var(--fit-primary)'} />
              <span className="rec-tool-label">{label}</span>
              <span className="rec-tool-hint">{hint}</span>
            </Card>
          );
        })}
      </div>

      {data.badges?.length ? (
        <>
          <SectionHeader title={s.home.badgesTitle} action={f(s.home.pointsLabel, { n: num(data.points) })} onAction={() => navigation.navigate('RecoveryProgress')} />
          <div className="rec-hscroll">
            {data.badges.map((badge) => (
              <div key={badge.key} className="rec-badge">
                <Icon name={badge.icon} size={26} color={REC.warm} />
                <span>{badge.label}</span>
              </div>
            ))}
          </div>
        </>
      ) : null}

      <button type="button" className="rec-disclaimer" onClick={() => navigation.navigate('RecoveryHelp')}>
        {s.common.aiDisclaimer}
      </button>
    </RecoveryPage>
  );
};

export default RecoveryHome;

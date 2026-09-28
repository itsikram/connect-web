import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { recoveryApi } from './recoveryApi';
import { buildCalendar, cravingsByHourBin, localDayKey, startOfLocalDay, topTriggers } from './helpers';
import { useRecoveryContent, useRecoveryDashboard } from './hooks';
import { useRecoveryI18n } from './i18n';
import { useRecoveryNavigation } from './paths';
import { Banner, BarChart, Card, EmptyState, Icon, LineChart, Muted, REC, RecoveryPage, SectionHeader, Segmented, Spinner, StatTile, errorMessage } from './ui';

// Web port of expo-connect-app/src/screens/recovery/Progress.tsx.
const RecoveryProgress = () => {
  const navigation = useRecoveryNavigation();
  const { lang, s, f, num, date } = useRecoveryI18n();
  const { content } = useRecoveryContent(lang);
  const { data } = useRecoveryDashboard(lang);
  const [range, setRange] = useState('7');
  const [activity, setActivity] = useState(null);
  const [error, setError] = useState('');
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async () => {
    setRefreshing(true);
    try {
      const [checkins, cravings, lapses] = await Promise.all([recoveryApi.getCheckins(30), recoveryApi.getCravings(30), recoveryApi.getLapses(30)]);
      setActivity({ checkins: checkins.data.checkins, cravings: cravings.data.cravings, lapseDays: lapses.data.lapses.map((lapse) => lapse.day).filter(Boolean) });
      setError('');
    } catch (loadError) {
      setError(errorMessage(loadError, s.progress.loadError));
    } finally {
      setRefreshing(false);
    }
  }, [s.progress.loadError]);

  useEffect(() => {
    load();
  }, [load]);

  const days = Number(range);
  const view = useMemo(() => {
    if (!activity) return null;
    const since = startOfLocalDay(-(days - 1)).getTime();
    const sinceKey = localDayKey(since);
    const checkins = activity.checkins.filter((checkin) => checkin.day >= sinceKey).sort((a, b) => a.day.localeCompare(b.day));
    const cravings = activity.cravings.filter((craving) => Date.parse(craving.at) >= since);
    const shortDay = (day) => date(`${day}T12:00:00`, days <= 7 ? { weekday: 'short' } : { day: 'numeric' });
    const triggerLabel = (key) => content?.triggers?.find((item) => item.key === key)?.label || key;
    return {
      checkins,
      cravings,
      resisted: cravings.filter((craving) => craving.outcome === 'resisted').length,
      cravingTrend: checkins.map((checkin) => ({ label: shortDay(checkin.day), detail: date(`${checkin.day}T12:00:00`, { weekday: 'short', day: 'numeric', month: 'short' }), value: checkin.craving })),
      moodTrend: checkins.map((checkin) => ({ label: shortDay(checkin.day), detail: date(`${checkin.day}T12:00:00`, { weekday: 'short', day: 'numeric', month: 'short' }), value: checkin.mood })),
      byHour: cravingsByHourBin(cravings).map((value, index) => ({ label: s.progress.hourBins[index], value })),
      byTrigger: topTriggers([...cravings, ...checkins]).map(([key, value]) => ({ label: triggerLabel(key), value })),
    };
  }, [activity, days, content?.triggers, date, s.progress.hourBins]);

  const calendar = useMemo(() => (activity ? buildCalendar(30, activity.checkins, activity.lapseDays) : []), [activity]);
  const substances = data?.substances || [];
  const current = substances.find((item) => item.primary) || substances[0];
  const earned = new Set((data?.badges || []).map((badge) => badge.key));
  const allBadges = Object.entries(content?.badges || {});
  const empty = view && !view.checkins.length && !view.cravings.length;
  const legendLabel = { clean: s.progress.legendClean, slip: s.progress.legendSlip, none: s.progress.legendNone };

  return (
    <RecoveryPage title={s.progress.title} navigation={navigation} onRefresh={load} refreshing={refreshing}>
      {error ? <Banner icon="cloud-off-outline" tone="warn" text={error} /> : null}
      <Segmented
        options={[
          { label: s.progress.range7, value: '7' },
          { label: s.progress.range30, value: '30' },
        ]}
        value={range}
        onChange={setRange}
      />

      {!view && !error ? (
        <div className="rec-center">
          <Spinner large />
        </div>
      ) : null}

      {view ? (
        <div className="rec-fit-grid is-3">
          <StatTile icon="lightning-bolt-outline" color={REC.calm} label={s.progress.summaryCravings} value={num(view.cravings.length)} />
          <StatTile icon="shield-check-outline" color="var(--fit-success)" label={s.progress.summaryResisted} value={num(view.resisted)} />
          <StatTile icon="calendar-check-outline" color={REC.warm} label={s.progress.summaryCheckins} value={num(view.checkins.length)} />
        </div>
      ) : null}

      {empty ? <EmptyState icon="chart-timeline-variant" title={s.progress.title} message={s.progress.noData} /> : null}

      {view && view.cravingTrend.length ? (
        <>
          <SectionHeader title={s.progress.cravingTrend} />
          <Card>
            <LineChart data={view.cravingTrend} color={REC.sos} decimals={0} />
          </Card>
          <SectionHeader title={s.progress.moodTrend} />
          <Card>
            <LineChart data={view.moodTrend} color="var(--fit-primary)" decimals={0} />
          </Card>
        </>
      ) : null}

      {view && view.cravings.length ? (
        <>
          <SectionHeader title={s.progress.byHour} />
          <Card>
            <BarChart data={view.byHour} color={REC.calm} emptyLabel={s.progress.noData} />
          </Card>
        </>
      ) : null}

      {view && view.byTrigger.length ? (
        <>
          <SectionHeader title={s.progress.byTrigger} />
          <Card>
            {view.byTrigger.map((item) => (
              <div key={item.label} className="rec-trigger-row">
                <span className="rec-trigger-label">{item.label}</span>
                <span className="rec-trigger-track">
                  <span className="rec-trigger-fill" style={{ display: 'block', width: `${Math.max(8, (item.value / view.byTrigger[0].value) * 100)}%` }} />
                </span>
                <span className="rec-trigger-value">{num(item.value)}</span>
              </div>
            ))}
          </Card>
        </>
      ) : null}

      {calendar.length ? (
        <>
          <SectionHeader title={s.progress.calendarTitle} />
          <Card>
            <div className="rec-calendar">
              {calendar.map((cell) => (
                <div key={cell.day} className={`rec-cell is-${cell.state}`} title={`${date(`${cell.day}T12:00:00`)}: ${legendLabel[cell.state]}`} aria-label={`${cell.day}: ${legendLabel[cell.state]}`}>
                  {num(Number(cell.day.slice(8)))}
                </div>
              ))}
            </div>
            <div className="rec-legend">
              {['clean', 'slip', 'none'].map((state) => (
                <span key={state}>
                  <span className={`rec-swatch rec-cell is-${state}`} style={{ width: 12, height: 12, borderRadius: 3 }} />
                  {legendLabel[state]}
                </span>
              ))}
            </div>
          </Card>
        </>
      ) : null}

      {current && content?.milestones?.length ? (
        <>
          <SectionHeader title={f(s.progress.milestonesTitle, { name: current.name })} />
          <div className="rec-hscroll">
            {content.milestones.map((milestone) => {
              const reached = current.status === 'clean' && current.currentStreakDays >= milestone.days;
              return (
                <div key={milestone.days} className={`rec-milestone-chip${reached ? ' is-reached' : ''}`}>
                  <Icon name={reached ? 'check-decagram' : 'flag-outline'} size={22} color={reached ? 'var(--fit-success)' : 'var(--fit-text-3)'} />
                  <span>{milestone.label}</span>
                </div>
              );
            })}
          </div>
        </>
      ) : null}

      {allBadges.length ? (
        <>
          <SectionHeader title={s.progress.badgesTitle} />
          <Muted style={{ fontSize: 13, marginTop: -6, marginBottom: 10 }}>{f(s.progress.points, { n: num(data?.points) })}</Muted>
          <div className="rec-badge-grid">
            {allBadges.map(([key, badge]) => {
              const has = earned.has(key);
              return (
                <div key={key} className={`rec-badge${has ? '' : ' is-locked'}`}>
                  <Icon name={has ? badge.icon : 'lock-outline'} size={26} color={has ? REC.warm : 'var(--fit-text-3)'} />
                  <span>{badge.label}</span>
                  {!has ? <span className="fit-muted fit-xs">{s.progress.locked}</span> : null}
                </div>
              );
            })}
          </div>
        </>
      ) : null}
    </RecoveryPage>
  );
};

export default RecoveryProgress;

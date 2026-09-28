/* eslint-disable testing-library/no-unnecessary-act -- the shared fitness Button settles each click asynchronously, so clicks and renders must be flushed with act() before the next step. */
import React from 'react';
import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { MemoryRouter, Route, Routes } from 'react-router-dom';
import { Provider } from 'react-redux';
import { configureStore } from '@reduxjs/toolkit';
import api from '../../api/api';
import RecoveryRoutes from './RecoveryRoutes';
import { STRINGS } from './strings';
import { redFlagsIn, toggleExclusive } from './helpers';

jest.mock('../../api/api', () => ({ __esModule: true, default: { get: jest.fn(), post: jest.fn(), put: jest.fn(), delete: jest.fn() } }));
jest.mock('../../hooks/useSpeechToText', () => () => ({ listening: false, supported: false, toggle: () => {} }));

const en = STRINGS.en;

const content = {
  lang: 'en',
  substances: [
    { key: 'yaba', safetyClass: 'stimulant', screener: 'SDS', icon: 'pill', name: 'Yaba', unit: 'pills', unitOne: 'pill', defaultAmount: 2 },
    { key: 'tramadol', safetyClass: 'opioid', screener: 'SDS', icon: 'pill', name: 'Tramadol / painkillers', unit: 'tablets', unitOne: 'tablet', defaultAmount: 2 },
  ],
  safetyClasses: {
    stimulant: { approaches: ['now', 'date'], defaultApproach: 'now', title: 'Stimulant', quitAdvice: 'Stop completely.', withdrawal: 'Crash.', safety: 'Low mood can be severe.', lapseSafety: 'Watch for chest pain.' },
    opioid: { approaches: ['doctor', 'now', 'date'], defaultApproach: 'doctor', title: 'Opioid', quitAdvice: 'See a doctor.', withdrawal: 'Aches.', safety: 'Tolerance drops.', lapseSafety: 'Never use alone.' },
  },
  screeners: { SDS: { title: 'SDS', questions: [{ text: 'Out of control?', options: ['Never', 'Often'] }] } },
  triggers: [{ key: 'stress', label: 'Stress' }],
  reasons: [{ key: 'family', label: 'My family' }],
  halt: [{ key: 'tired', label: 'Tired' }],
  background: {
    ageGroup: [{ key: 'under18', label: 'Under 18' }],
    gender: [{ key: 'female', label: 'Woman' }],
    living: [{ key: 'alone', label: 'Alone' }],
    familyKnows: [{ key: 'no', label: 'No one knows' }],
    occupation: [{ key: 'student', label: 'Student' }],
    access: [{ key: 'hard', label: 'Hard to get' }],
    routes: [{ key: 'inject', label: 'Inject' }],
    usePattern: [{ key: 'alone', label: 'Mostly alone' }],
    functions: [{ key: 'sleep', label: 'Helps me sleep' }],
    longestQuit: [{ key: 'weeks', label: 'A few weeks' }],
    relapseReasons: [{ key: 'cravings', label: 'Cravings' }],
    pastWithdrawal: [{ key: 'seizure', label: 'Seizure / fits', redFlag: true }, { key: 'none', label: 'None' }],
    mentalHealth: [{ key: 'anxiety', label: 'Anxiety / panic' }],
    physicalHealth: [{ key: 'pregnant', label: 'Pregnant or breastfeeding' }],
    treatment: [{ key: 'none', label: 'No support yet' }],
    interests: [{ key: 'sport', label: 'Cricket / football / sport' }],
  },
  backgroundSafety: { seizure_history: 'SEIZURE SAFETY NOTE', inject: 'INJECT SAFETY NOTE', pregnant: 'PREGNANT SAFETY NOTE', under18: 'UNDER 18 NOTE', self_harm: 'SELF HARM NOTE' },
  symptoms: [{ key: 'headache', label: 'Headache' }, { key: 'seizure', label: 'Seizure / fits', redFlag: 'medical' }],
  milestones: [{ days: 1, label: '24 hours' }],
  badges: {},
  timelines: {},
  helplines: [{ key: 'kaan_pete_roi', phone: '09612119911', display: '09612-119911', kind: 'mental_health', crisis: true, name: 'Kaan Pete Roi', description: 'Support', hours: '3 pm – 3 am' }],
  crisisMessages: {},
};

const substance = {
  key: 'yaba', name: 'Yaba', unit: 'pills', icon: 'pill', safetyClass: 'stimulant', approach: 'now', primary: true, quitDate: '2026-09-20T00:00:00.000Z', streakStart: '2026-09-20T00:00:00.000Z',
  status: 'clean', currentStreakDays: 9, longestStreakDays: 9, totalCleanDays: 9, unitsAvoided: 18, moneySaved: 5400, lifeRegainedMinutes: 0,
  milestone: { reachedDays: 7, nextDays: 14, progress: 0.3, msToNext: 86400000, reachedLabel: '1 week', nextLabel: '2 weeks' },
  health: { reachedIndex: 0, nextIndex: 1, msToNext: 3600000, last: { at: 'Days 4–10', text: 'Hardest stretch.' }, next: { at: 'Weeks 2–4', text: 'Sleep settles.' } },
};

const profile = {
  substances: [{ key: 'yaba', primary: true, amountPerDay: 2, daysPerWeek: 7, costPerUnit: 300, approach: 'now', quitDate: substance.quitDate }],
  readiness: { importance: 9, confidence: 5 }, reasonKeys: ['family'], reasons: 'For my mother', letter: '', background: null, triggers: ['stress'], riskHours: [],
  supportContacts: [], plan: null, planSource: '', planGeneratedAt: null, points: 20, badges: [],
  settings: { aiEnabled: true, discreet: true, riskNudges: false }, language: 'auto', timezone: 'Asia/Dhaka', currency: 'BDT', onboardingCompleted: true,
};

const dashboard = (withProfile) =>
  withProfile
    ? { profile, serverTime: new Date().toISOString(), todayKey: '2026-09-29', substances: [substance], totals: { moneySaved: 5400, cravingsResisted: 3, cravingsLogged: 4, checkinCount: 5, checkinStreak: 2, longestStreakDays: 9, totalCleanDays: 9 }, today: { checkin: null }, daily: { note: 'Keep going.', mission: 'Drink water.' }, toolOrder: [], proHelp: ['pregnancy'], badges: [], newBadges: [], points: 20 }
    : { profile: null };

const setupApi = ({ withProfile = true } = {}) => {
  api.get.mockImplementation((url) => {
    if (url === '/recovery/content') return Promise.resolve({ data: content });
    if (url === '/recovery/dashboard') return Promise.resolve({ data: dashboard(withProfile) });
    if (url === '/recovery/profile') return Promise.resolve({ data: { profile: withProfile ? profile : null } });
    if (url === '/recovery/coach/history') return Promise.resolve({ data: { messages: [] } });
    if (url === '/recovery/checkins') return Promise.resolve({ data: { checkins: [] } });
    if (url === '/recovery/cravings') return Promise.resolve({ data: { cravings: [] } });
    if (url === '/recovery/lapses') return Promise.resolve({ data: { lapses: [] } });
    return Promise.resolve({ data: {} });
  });
  api.post.mockResolvedValue({ data: { duplicate: false, pointsEarned: 30, newBadges: [], checkin: { day: '2026-09-29', used: [], mood: 3, craving: 2, symptoms: [], reflection: 'Well done.', microGoal: 'Walk.' }, crisis: null, lapsesCreated: [] } });
  api.put.mockResolvedValue({ data: { profile } });
};

const store = configureStore({ reducer: { setting: () => ({ language: 'eng' }) } });

const renderAt = async (path, cachedDashboard) => {
  window.localStorage.clear();
  if (cachedDashboard) window.localStorage.setItem('connect:recovery-dashboard', JSON.stringify(cachedDashboard));
  let utils;
  await act(async () => {
    utils = render(
      <Provider store={store}>
        <MemoryRouter initialEntries={[path]}>
          <Routes>
            <Route path="/rehab/*" element={<RecoveryRoutes />} />
          </Routes>
        </MemoryRouter>
      </Provider>,
    );
  });
  return utils;
};

beforeEach(() => {
  jest.clearAllMocks();
  window.scrollTo = jest.fn();
});

test('home shows the welcome screen before setup', async () => {
  setupApi({ withProfile: false });
  await renderAt('/rehab');
  expect(await screen.findByText(en.home.welcomeTitle)).toBeInTheDocument();
  expect(screen.getAllByText(en.common.sos).length).toBeGreaterThan(0);
});

test('home dashboard shows clean time, money saved and the first help reason', async () => {
  setupApi();
  await renderAt('/rehab');
  expect(await screen.findByText(/Clean for · Yaba/)).toBeInTheDocument();
  expect(screen.getByText('৳5,400')).toBeInTheDocument();
  expect(screen.getByText(en.home.proHelp.pregnancy)).toBeInTheDocument();
  expect(screen.getByText('Drink water.')).toBeInTheDocument();
});

test('onboarding walks through the new background steps and shows curated safety notes', async () => {
  setupApi({ withProfile: false });
  await renderAt('/rehab/setup');
  await screen.findByText(en.onboarding.welcomeTitle);
  fireEvent.click(screen.getByText(en.common.continue));
  fireEvent.click(await screen.findByText('Tramadol / painkillers'));
  // The shared Button ignores clicks while its previous click is settling, so await each one.
  const next = () => act(async () => {
    fireEvent.click(screen.getByText(en.common.continue));
  });
  await next(); // usage
  expect(await screen.findByText(en.onboarding.usageTitle)).toBeInTheDocument();
  await next(); // screener
  await next(); // history
  expect(await screen.findByText(en.onboarding.historyTitle)).toBeInTheDocument();
  fireEvent.click(screen.getByText('Seizure / fits'));
  fireEvent.click(screen.getByText('Inject'));
  expect(screen.getByText('SEIZURE SAFETY NOTE')).toBeInTheDocument();
  expect(screen.getByText('INJECT SAFETY NOTE')).toBeInTheDocument();
  await next(); // readiness requires answers
  await screen.findByText(en.onboarding.readinessTitle);
  fireEvent.click(screen.getAllByRole('radio', { name: '8' })[0]);
  fireEvent.click(screen.getAllByRole('radio', { name: '5' })[1]);
  await next(); // reasons
  await next(); // triggers
  await next(); // about
  expect(await screen.findByText(en.onboarding.aboutTitle)).toBeInTheDocument();
  fireEvent.click(screen.getByText('Under 18'));
  expect(screen.getByText('UNDER 18 NOTE')).toBeInTheDocument();
  await next(); // health
  expect(await screen.findByText(en.onboarding.healthTitle)).toBeInTheDocument();
  fireEvent.click(screen.getByText('Pregnant or breastfeeding'));
  expect(screen.getByText('PREGNANT SAFETY NOTE')).toBeInTheDocument();
  await next(); // quit
  expect(await screen.findByText(en.onboarding.quitTitle)).toBeInTheDocument();
  expect(screen.getByText('Tolerance drops.')).toBeInTheDocument();
  await next(); // support
  await next(); // review
  api.post.mockRejectedValueOnce({ response: { status: 500 } });
  await act(async () => {
    fireEvent.click(screen.getByText(en.onboarding.start));
  });
  await waitFor(() => expect(api.put).toHaveBeenCalled());
  const [, body] = api.put.mock.calls[0];
  expect(body.background).toMatchObject({ pastWithdrawal: ['seizure'], routes: ['inject'], ageGroup: 'under18', physicalHealth: ['pregnant'] });
  expect(body.substances[0]).toMatchObject({ key: 'tramadol', approach: 'doctor' });
});

test('check-in shows the emergency card for red-flag symptoms and sends symptoms', async () => {
  setupApi();
  await renderAt('/rehab/checkin');
  await screen.findByText(en.checkin.symptomsQ);
  fireEvent.click(screen.getByText('Seizure / fits'));
  expect(screen.getByText(en.checkin.redFlagTitle)).toBeInTheDocument();
  fireEvent.click(screen.getByRole('radio', { name: en.checkin.moods[2] }));
  fireEvent.click(screen.getAllByRole('radio', { name: '2' })[0]);
  await act(async () => {
    fireEvent.click(screen.getByText(en.checkin.submit));
  });
  expect(api.post).toHaveBeenCalledWith('/recovery/checkins', expect.objectContaining({ symptoms: ['seizure'], mood: 3, craving: 2 }), expect.anything());
  expect(await screen.findByText('Well done.')).toBeInTheDocument();
});

test('SOS works from the cached dashboard and logs the session', async () => {
  setupApi();
  await renderAt('/rehab/sos', dashboard(true));
  fireEvent.click(await screen.findByRole('radio', { name: '8' }));
  fireEvent.click(screen.getByText(en.sos.start));
  fireEvent.click(screen.getByText(en.sos.tools.four_ds[0]));
  expect(screen.getByText(en.sos.fourDs[0][0])).toBeInTheDocument();
  fireEvent.click(screen.getByText(en.sos.finish));
  await act(async () => {
    fireEvent.click(screen.getByText(en.sos.resisted));
  });
  expect(api.post).toHaveBeenCalledWith('/recovery/cravings', expect.objectContaining({ intensityStart: 8, outcome: 'resisted', tools: ['four_ds'] }), expect.anything());
  expect(await screen.findByText(en.sos.celebrateTitle)).toBeInTheDocument();
});

test('coach, plan, help, progress, slip and settings render', async () => {
  setupApi();
  for (const [path, text] of [
    ['/rehab/coach', en.coach.intro],
    ['/rehab/plan', en.plan.emptyTitle],
    ['/rehab/help', en.help.emergencyTitle],
    ['/rehab/progress', en.progress.summaryCravings],
    ['/rehab/slip', en.lapse.intro],
    ['/rehab/settings', en.settings.aiTitle],
  ]) {
    const { unmount } = await renderAt(path, dashboard(true));
    expect(await screen.findByText(text)).toBeInTheDocument();
    unmount();
  }
});

test('background chips keep "none" exclusive and find red flags', () => {
  expect(toggleExclusive(['anxiety'], 'none')).toEqual(['none']);
  expect(toggleExclusive(['none'], 'sleep')).toEqual(['sleep']);
  expect(redFlagsIn(['headache', 'seizure'], content.symptoms)).toEqual(['seizure']);
});

test('web strings match the Expo app in both languages', () => {
  const keys = (value, path = '') => (value && typeof value === 'object' ? Object.entries(value).flatMap(([key, child]) => keys(child, path ? `${path}.${key}` : key)) : [path]);
  expect(keys(STRINGS.bn).sort()).toEqual(keys(STRINGS.en).sort());
});

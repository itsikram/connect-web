import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import RecoveryHome from './Home';
import RecoveryOnboarding from './Onboarding';
import RecoverySos from './Sos';
import RecoveryCoach from './Coach';
import RecoveryCheckIn from './CheckIn';
import RecoveryLapse from './Lapse';
import RecoveryHelp from './Help';
import RecoveryPlan from './Plan';
import RecoveryProgress from './Progress';
import RecoverySettings from './Settings';
import '../fitness/Fitness.css';
import './Recovery.css';

/** Web port of the Expo Recovery stack. Mounted at /rehab/* in Main.js; segments match paths.js. */
const RecoveryRoutes = () => (
  <Routes>
    <Route index element={<RecoveryHome />} />
    <Route path="setup" element={<RecoveryOnboarding />} />
    <Route path="sos" element={<RecoverySos />} />
    <Route path="coach" element={<RecoveryCoach />} />
    <Route path="checkin" element={<RecoveryCheckIn />} />
    <Route path="slip" element={<RecoveryLapse />} />
    <Route path="help" element={<RecoveryHelp />} />
    <Route path="plan" element={<RecoveryPlan />} />
    <Route path="progress" element={<RecoveryProgress />} />
    <Route path="settings" element={<RecoverySettings />} />
    <Route path="*" element={<Navigate to="." replace />} />
  </Routes>
);

export default RecoveryRoutes;

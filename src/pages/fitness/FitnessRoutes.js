import React from 'react';
import { Navigate, Route, Routes } from 'react-router-dom';
import FitnessDashboard from './Dashboard';
import FitnessOnboarding from './Onboarding';
import FitnessMeal from './Meal';
import FitnessWorkout from './Workout';
import FitnessWeight from './Weight';
import FitnessProgress from './Progress';
import FitnessReminders from './Reminders';
import { FitnessCoach, FitnessRecommendations } from './Coach';
import './Fitness.css';

/** Web port of the Expo fitness stack. Mounted at /health/* in Main.js. */
const FitnessRoutes = () => (
  <Routes>
    <Route index element={<FitnessDashboard />} />
    <Route path="setup" element={<FitnessOnboarding />} />
    <Route path="meal" element={<FitnessMeal />} />
    <Route path="workout" element={<FitnessWorkout />} />
    <Route path="weight" element={<FitnessWeight />} />
    <Route path="progress" element={<FitnessProgress />} />
    <Route path="reminders" element={<FitnessReminders />} />
    <Route path="coach" element={<FitnessCoach />} />
    <Route path="ideas" element={<FitnessRecommendations />} />
    <Route path="*" element={<Navigate to="." replace />} />
  </Routes>
);

export default FitnessRoutes;

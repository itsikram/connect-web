import React, { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../api/api';
import './Health.css';

const EMPTY_PROFILE = {
    sex: 'other',
    age: '',
    heightCm: '',
    weightKg: '',
    targetWeightKg: '',
    activityLevel: 'moderate',
    goal: 'maintain',
};

const EMPTY_MEAL = {
    name: '',
    calories: '',
    proteinG: '',
    carbsG: '',
    fatG: '',
    fiberG: '',
    mealType: 'snack',
};

const EMPTY_REMINDER = { title: 'Drink water', time: '12:00', type: 'water', message: '' };

const Health = () => {
    const [fitnessData, setFitnessData] = useState(null);
    const [fitnessProfile, setFitnessProfile] = useState(EMPTY_PROFILE);
    const [fitnessPeriod, setFitnessPeriod] = useState('daily');
    const [fitnessProgress, setFitnessProgress] = useState(null);
    const [fitnessRecommendations, setFitnessRecommendations] = useState(null);
    const [fitnessReminders, setFitnessReminders] = useState([]);
    const [fitnessCoachQuestion, setFitnessCoachQuestion] = useState('');
    const [fitnessCoachReply, setFitnessCoachReply] = useState('');
    const [fitnessMeal, setFitnessMeal] = useState(EMPTY_MEAL);
    const [fitnessMealImage, setFitnessMealImage] = useState(null);
    const [fitnessWeight, setFitnessWeight] = useState('');
    const [fitnessWeightNote, setFitnessWeightNote] = useState('');
    const [fitnessReminder, setFitnessReminder] = useState(EMPTY_REMINDER);
    const [fitnessLoading, setFitnessLoading] = useState(false);
    const [fitnessError, setFitnessError] = useState('');

    const loadFitness = useCallback(async () => {
        try {
            const [dashboard, reminders] = await Promise.all([
                api.get('/fitness/dashboard'),
                api.get('/fitness/reminders'),
            ]);
            setFitnessData(dashboard.data);
            setFitnessReminders(reminders.data?.reminders || reminders.data || []);
            if (dashboard.data?.profile) setFitnessProfile(dashboard.data.profile);
        } catch (error) {
            if (error?.response?.status !== 404) setFitnessError('Could not load Fitness data.');
        }
    }, []);

    useEffect(() => { loadFitness(); }, [loadFitness]);

    const runFitness = async (operation) => {
        setFitnessLoading(true);
        setFitnessError('');
        try {
            await operation();
        } catch (error) {
            setFitnessError(error?.response?.data?.message || 'Fitness request failed.');
        } finally {
            setFitnessLoading(false);
        }
    };

    const saveFitnessProfile = () => runFitness(async () => {
        await api.put('/fitness/profile', {
            ...fitnessProfile,
            age: Number(fitnessProfile.age),
            heightCm: Number(fitnessProfile.heightCm),
            weightKg: Number(fitnessProfile.weightKg),
            targetWeightKg: fitnessProfile.targetWeightKg ? Number(fitnessProfile.targetWeightKg) : undefined,
        });
        await loadFitness();
    });

    const analyzeFitnessMeal = () => runFitness(async () => {
        let payload = { name: fitnessMeal.name, mealType: fitnessMeal.mealType };
        if (fitnessMealImage) {
            payload = new FormData();
            payload.append('name', fitnessMeal.name || 'meal');
            payload.append('mealType', fitnessMeal.mealType);
            payload.append('image', fitnessMealImage);
        }
        const response = await api.post('/fitness/analyze-food', payload);
        setFitnessMeal((old) => ({
            ...old,
            ...(response.data.analysis || {}),
            source: response.data.provider || 'gemini',
        }));
    });

    const saveFitnessMeal = () => runFitness(async () => {
        await api.post('/fitness/meals', {
            ...fitnessMeal,
            source: fitnessMeal.source || 'manual',
            date: new Date().toISOString(),
        });
        setFitnessMeal(EMPTY_MEAL);
        setFitnessMealImage(null);
        await loadFitness();
    });

    const loadFitnessProgress = (period) => runFitness(async () => {
        setFitnessPeriod(period);
        const response = await api.get('/fitness/progress', { params: { period } });
        setFitnessProgress(response.data);
    });

    const loadFitnessRecommendations = () => runFitness(async () => {
        const response = await api.get('/fitness/recommendations');
        setFitnessRecommendations(response.data);
    });

    const logFitnessWeight = () => runFitness(async () => {
        await api.post('/fitness/weight', {
            weightKg: Number(fitnessWeight),
            date: new Date().toISOString(),
            note: fitnessWeightNote,
        });
        setFitnessWeight('');
        setFitnessWeightNote('');
        await loadFitness();
    });

    const askFitnessCoach = () => runFitness(async () => {
        const response = await api.post('/fitness/coach', { question: fitnessCoachQuestion });
        setFitnessCoachReply(response.data.reply || response.data.answer || '');
    });

    const createFitnessReminder = () => runFitness(async () => {
        await api.post('/fitness/reminders', {
            ...fitnessReminder,
            days: [0, 1, 2, 3, 4, 5, 6],
            enabled: true,
        });
        setFitnessReminder(EMPTY_REMINDER);
        await loadFitness();
    });

    const deleteFitnessReminder = (id) => runFitness(async () => {
        await api.delete(`/fitness/reminders/${id}`);
        await loadFitness();
    });

    const resetFitness = () => {
        if (!window.confirm('Reset Fitness details? This permanently deletes your Fitness profile, meals, weights, and reminders.')) return;
        runFitness(async () => {
            await api.delete('/fitness/reset');
            setFitnessData(null);
            setFitnessProfile(EMPTY_PROFILE);
            setFitnessProgress(null);
            setFitnessRecommendations(null);
            setFitnessReminders([]);
            setFitnessCoachReply('');
        });
    };

    const updateProfile = (key, value) => setFitnessProfile((old) => ({ ...old, [key]: value }));
    const updateMeal = (key, value) => setFitnessMeal((old) => ({ ...old, [key]: value }));

    return (
        <div className="health-page">
            <div className="health-container">
                <header className="health-header">
                    <Link to="/" className="health-back-link" aria-label="Back to home">
                        <i className="fas fa-arrow-left" aria-hidden="true" /> Home
                    </Link>
                    <div className="health-header-content">
                        <span className="health-badge"><i className="fas fa-heartbeat" aria-hidden="true" /> Fitness</span>
                        <h1 className="health-title">Today&apos;s fitness</h1>
                        <p className="health-subtitle">Track your nutrition, weight, progress, reminders, and wellness guidance.</p>
                    </div>
                </header>

                <section className="health-calorie-section" aria-label="Fitness tracker">
                    <div className="health-calorie-card">
                        <h2 className="health-panel-title"><i className="fas fa-heartbeat" aria-hidden="true" /> Fitness</h2>
                        {fitnessError && <p className="health-disclaimer">{fitnessError}</p>}
                        {!fitnessData?.profile ? (
                            <div className="fitness-setup-shell">
                                <p className="health-calorie-description">Your targets are calculated privately on the server using Mifflin-St Jeor.</p>
                                <div className="health-form-grid">
                                    {[
                                        ['age', 'Age'], ['heightCm', 'Height (cm)'], ['weightKg', 'Current weight (kg)'], ['targetWeightKg', 'Target weight (kg, optional)'],
                                    ].map(([key, label]) => (
                                        <input key={key} type="number" placeholder={label} value={fitnessProfile[key]} onChange={(e) => updateProfile(key, e.target.value)} />
                                    ))}
                                    <select value={fitnessProfile.sex} onChange={(e) => updateProfile('sex', e.target.value)}>
                                        <option value="male">Male</option><option value="female">Female</option><option value="other">Other</option>
                                    </select>
                                    <select value={fitnessProfile.activityLevel} onChange={(e) => updateProfile('activityLevel', e.target.value)}>
                                        <option value="sedentary">Sedentary</option><option value="light">Light</option><option value="moderate">Moderate</option><option value="very_active">Very active</option><option value="extra_active">Extra active</option>
                                    </select>
                                    <select value={fitnessProfile.goal} onChange={(e) => updateProfile('goal', e.target.value)}>
                                        <option value="lose">Lose weight</option><option value="maintain">Maintain</option><option value="gain">Gain weight</option>
                                    </select>
                                    <button type="button" disabled={fitnessLoading} className="health-form-submit" onClick={saveFitnessProfile}>{fitnessLoading ? 'Saving…' : 'Calculate my targets'}</button>
                                </div>
                            </div>
                        ) : (
                            <div className="fitness-shell">
                                <div className="fitness-hero-card">
                                    <div>
                                        <span className="fitness-eyebrow">Today&apos;s fitness</span>
                                        <strong>{fitnessData.totals?.calories || 0} / {fitnessData.profile.targetCalories} kcal</strong>
                                        <span>BMR {Math.round(fitnessData.profile.bmr || 0)} · TDEE {Math.round(fitnessData.profile.tdee || 0)}</span>
                                    </div>
                                    <div className="fitness-target-summary">
                                        <span>Goal</span><strong>{fitnessData.profile.goal}</strong>
                                        {fitnessData.latestWeight?.weightKg && <small>{fitnessData.latestWeight.weightKg} kg latest</small>}
                                    </div>
                                </div>

                                <div className="fitness-macro-grid">
                                    {[['Protein', 'proteinG'], ['Carbs', 'carbsG'], ['Fat', 'fatG']].map(([label, key]) => (
                                        <div className="fitness-macro-card" key={key}>
                                            <strong>{Math.round(fitnessData.totals?.[key] || 0)} / {Math.round(fitnessData.profile.macros?.[key] || 0)}g</strong><span>{label}</span>
                                        </div>
                                    ))}
                                </div>

                                <div className="fitness-section-heading"><h3>Today&apos;s meals</h3><span>{fitnessData.meals?.length || 0} logged</span></div>
                                {fitnessData.meals?.length ? fitnessData.meals.map((meal) => (
                                    <div className="health-meal-item fitness-meal-row" key={meal._id}>
                                        <div><strong>{meal.name}</strong><small>{meal.mealType} · {new Date(meal.date).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' })}</small></div>
                                        <span>{Math.round(meal.calories || 0)} kcal · P {Math.round(meal.proteinG || 0)}g · C {Math.round(meal.carbsG || 0)}g · F {Math.round(meal.fatG || 0)}g</span>
                                    </div>
                                )) : <p className="fitness-empty-state">No meals logged today. Scan a food photo or add one manually.</p>}

                                <div className="fitness-section-heading"><h3>Add meal</h3><span>AI + manual</span></div>
                                <div className="health-form-grid">
                                    <input placeholder="Food name" value={fitnessMeal.name} onChange={(e) => updateMeal('name', e.target.value)} />
                                    <select value={fitnessMeal.mealType} onChange={(e) => updateMeal('mealType', e.target.value)}>
                                        <option value="breakfast">Breakfast</option><option value="lunch">Lunch</option><option value="dinner">Dinner</option><option value="snack">Snack</option>
                                    </select>
                                    {['calories', 'proteinG', 'carbsG', 'fatG', 'fiberG'].map((key) => <input key={key} type="number" placeholder={key} value={fitnessMeal[key]} onChange={(e) => updateMeal(key, e.target.value)} />)}
                                    <input type="file" accept="image/jpeg,image/png,image/webp" capture="environment" onChange={(e) => setFitnessMealImage(e.target.files?.[0] || null)} />
                                    <div className="fitness-actions-row">
                                        <button type="button" disabled={fitnessLoading} className="health-calorie-add-btn" onClick={analyzeFitnessMeal}>{fitnessLoading ? 'Analyzing meal…' : 'Analyze food with AI'}</button>
                                        <button type="button" disabled={fitnessLoading} className="health-form-submit" onClick={saveFitnessMeal}>{fitnessLoading ? 'Saving…' : 'Save meal'}</button>
                                    </div>
                                </div>
                                {fitnessMealImage && <p className="fitness-estimate-note">Photo selected: {fitnessMealImage.name}. Review all AI estimates before saving.</p>}
                                {fitnessMeal.name && fitnessMeal.source === 'gemini' && <p className="fitness-estimate-note">AI filled these values as estimates. Review and edit them before saving.</p>}

                                <div className="fitness-section-heading"><h3>Log weight</h3><span>Track today&apos;s weight</span></div>
                                <div className="health-form-grid">
                                    <input type="number" min="0" step="0.1" placeholder="Weight (kg)" value={fitnessWeight} onChange={(e) => setFitnessWeight(e.target.value)} />
                                    <input placeholder="Note (optional)" value={fitnessWeightNote} onChange={(e) => setFitnessWeightNote(e.target.value)} />
                                    <button type="button" disabled={fitnessLoading || !fitnessWeight || Number(fitnessWeight) <= 0} className="health-form-submit" onClick={logFitnessWeight}>{fitnessLoading ? 'Saving…' : 'Save weight'}</button>
                                </div>

                                <div className="fitness-section-heading"><h3>Progress</h3><span>{fitnessPeriod}</span></div>
                                <div className="fitness-actions-row">
                                    {['daily', 'weekly', 'monthly'].map((period) => <button type="button" disabled={fitnessLoading} key={period} className={`health-weight-edit-btn ${fitnessPeriod === period ? 'is-selected' : ''}`} onClick={() => loadFitnessProgress(period)}>{period}</button>)}
                                    <button type="button" disabled={fitnessLoading} className="health-weight-edit-btn" onClick={() => loadFitnessProgress(fitnessPeriod)}>Refresh</button>
                                </div>
                                {fitnessProgress && <div className="fitness-progress-summary">
                                    <strong>{fitnessPeriod === 'daily' ? "Today's details" : fitnessPeriod === 'weekly' ? 'This week' : 'This month'}</strong>
                                    <span>Average calories: {fitnessProgress.summary?.averageCalories || 0} kcal/day</span>
                                    <span>Protein: {Math.round(fitnessProgress.summary?.totalProteinG || 0)}g · Carbs: {Math.round(fitnessProgress.summary?.totalCarbsG || 0)}g · Fat: {Math.round(fitnessProgress.summary?.totalFatG || 0)}g</span>
                                    <span>Logged days: {fitnessProgress.summary?.loggedDays || 0}</span>
                                </div>}

                                <div className="fitness-section-heading"><h3>Food recommendations</h3><span>{fitnessRecommendations?.source === 'gemini' ? 'Gemini AI' : 'Wellness suggestions'}</span></div>
                                <div className="fitness-actions-row"><button type="button" disabled={fitnessLoading} className="health-calorie-add-btn" onClick={loadFitnessRecommendations}>{fitnessLoading ? 'Loading…' : 'Get food recommendations'}</button></div>
                                {fitnessRecommendations?.recommendations?.map((item) => <div className="health-meal-item" key={item.name}><span className="health-meal-name">{item.name}</span><span>{item.calories} kcal · P {item.proteinG}g · C {item.carbsG}g · F {item.fatG}g</span><small>{item.why}</small></div>)}
                                {fitnessRecommendations?.healthNotes?.length ? <div className="fitness-health-notes"><strong>Health details</strong>{fitnessRecommendations.healthNotes.map((note) => <span key={note}>• {note}</span>)}</div> : null}

                                <div className="fitness-section-heading"><h3>Fitness coach</h3><span>General guidance</span></div>
                                <div className="health-form-grid">
                                    <input placeholder="Ask Fitness coach" value={fitnessCoachQuestion} onChange={(e) => setFitnessCoachQuestion(e.target.value)} />
                                    <button type="button" disabled={fitnessLoading || !fitnessCoachQuestion.trim()} className="health-form-submit" onClick={askFitnessCoach}>Ask coach</button>
                                </div>
                                {fitnessCoachReply && <p className="health-disclaimer">{fitnessCoachReply}</p>}

                                <div className="fitness-section-heading"><h3>Reminders</h3><span>Daily habit prompts</span></div>
                                <div className="health-form-grid">
                                    <input placeholder="Reminder title" value={fitnessReminder.title} onChange={(e) => setFitnessReminder((old) => ({ ...old, title: e.target.value }))} />
                                    <input type="time" value={fitnessReminder.time} onChange={(e) => setFitnessReminder((old) => ({ ...old, time: e.target.value }))} />
                                    <button type="button" disabled={fitnessLoading} className="health-form-submit" onClick={createFitnessReminder}>Add reminder</button>
                                </div>
                                {fitnessReminders.map((item) => <div className="health-meal-item" key={item._id}><span>{item.time} · {item.title}</span><button type="button" onClick={() => deleteFitnessReminder(item._id)}>Delete</button></div>)}

                                <button type="button" disabled={fitnessLoading} className="health-weight-edit-btn" onClick={resetFitness}>{fitnessLoading ? 'Resetting…' : 'Reset Fitness details'}</button>
                            </div>
                        )}
                    </div>
                </section>
            </div>
        </div>
    );
};

export default Health;

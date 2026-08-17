import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    DAILY_WELLNESS_ITEMS,
    FITNESS_ARTICLES,
    FITNESS_CATEGORIES,
    HEALTH_DISCLAIMER,
    QUICK_TIPS,
} from '../constants/healthContent';
import { getSuggestedMeals, getCalorieAnalysis, calculateTDEE } from '../utils/geminiApi';
import './Health.css';

const STORAGE_KEY = 'connectHealthWellness';
const WEIGHT_TARGET_KEY = 'connectWeightTarget';
const WEIGHT_LOG_KEY = 'connectWeightLog';
const NOTIFICATIONS_KEY = 'connectNotifications';
const CALORIE_TARGET_KEY = 'connectCalorieTarget';
const MEAL_LOG_KEY = 'connectMealLog';
const USER_PROFILE_KEY = 'connectUserProfile';

const getTodayKey = () => new Date().toISOString().split('T')[0];

const Health = () => {
    const [activeCategory, setActiveCategory] = useState('basics');
    const [expandedArticle, setExpandedArticle] = useState(null);
    const [checkedItems, setCheckedItems] = useState({});
    const [tipIndex, setTipIndex] = useState(0);
    const [weightTarget, setWeightTarget] = useState(null);
    const [currentWeight, setCurrentWeight] = useState('');
    const [showWeightForm, setShowWeightForm] = useState(false);
    const [goalWeight, setGoalWeight] = useState('');
    const [weightGoalType, setWeightGoalType] = useState('lose'); // 'lose' or 'gain'
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);
    const [weightLog, setWeightLog] = useState([]);
    // Calorie tracking states
    const [userProfile, setUserProfile] = useState(null);
    const [calorieTarget, setCalorieTarget] = useState(null);
    const [mealLog, setMealLog] = useState([]);
    const [showCalorieForm, setShowCalorieForm] = useState(false);
    const [showMealInput, setShowMealInput] = useState(false);
    const [mealName, setMealName] = useState('');
    const [mealCalories, setMealCalories] = useState('');
    const [mealProtein, setMealProtein] = useState('');
    const [mealCarbs, setMealCarbs] = useState('');
    const [mealFat, setMealFat] = useState('');
    const [mealType, setMealType] = useState('snack');
    const [suggestedMeals, setSuggestedMeals] = useState(null);
    const [loadingSuggestions, setLoadingSuggestions] = useState(false);
    const [suggestionError, setSuggestionError] = useState(null);
    const [userAge, setUserAge] = useState('');
    const [userHeight, setUserHeight] = useState('');
    const [userGender, setUserGender] = useState('male');
    const [activityLevel, setActivityLevel] = useState('moderately-active');
    const [healthGoal, setHealthGoal] = useState('weight-loss');
    const [dietaryPreferences, setDietaryPreferences] = useState('');

    const todayKey = getTodayKey();

    useEffect(() => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            if (raw) {
                const parsed = JSON.parse(raw);
                setCheckedItems(parsed[todayKey] || {});
            }
        } catch (_) {
            /* ignore */
        }
    }, [todayKey]);

    useEffect(() => {
        try {
            const targetData = localStorage.getItem(WEIGHT_TARGET_KEY);
            if (targetData) {
                setWeightTarget(JSON.parse(targetData));
            }
            const logData = localStorage.getItem(WEIGHT_LOG_KEY);
            if (logData) {
                setWeightLog(JSON.parse(logData));
            }
            const notifEnabled = localStorage.getItem(NOTIFICATIONS_KEY);
            if (notifEnabled) {
                setNotificationsEnabled(JSON.parse(notifEnabled));
            }
            // Load calorie data
            const profileData = localStorage.getItem(USER_PROFILE_KEY);
            if (profileData) {
                setUserProfile(JSON.parse(profileData));
            }
            const calTargetData = localStorage.getItem(CALORIE_TARGET_KEY);
            if (calTargetData) {
                setCalorieTarget(JSON.parse(calTargetData));
            }
            const mealData = localStorage.getItem(MEAL_LOG_KEY);
            if (mealData) {
                const allMeals = JSON.parse(mealData);
                // Filter meals for today
                setMealLog(allMeals[todayKey] || []);
            }
        } catch (_) {
            /* ignore */
        }
    }, [todayKey]);

    useEffect(() => {
        const dayIndex = new Date().getDate() % QUICK_TIPS.length;
        setTipIndex(dayIndex);
    }, []);

    const persistChecklist = useCallback((nextDayItems) => {
        try {
            const raw = localStorage.getItem(STORAGE_KEY);
            const all = raw ? JSON.parse(raw) : {};
            all[todayKey] = nextDayItems;
            localStorage.setItem(STORAGE_KEY, JSON.stringify(all));
        } catch (_) {
            /* ignore */
        }
    }, [todayKey]);

    const toggleChecklistItem = (id) => {
        setCheckedItems((prev) => {
            const next = { ...prev, [id]: !prev[id] };
            persistChecklist(next);
            return next;
        });
    };

    const articles = FITNESS_ARTICLES[activeCategory] || [];
    const completedCount = DAILY_WELLNESS_ITEMS.filter((item) => checkedItems[item.id]).length;
    const progressPercent = Math.round((completedCount / DAILY_WELLNESS_ITEMS.length) * 100);

    const activeCategoryMeta = useMemo(
        () => FITNESS_CATEGORIES.find((c) => c.id === activeCategory),
        [activeCategory]
    );

    const nextTip = () => setTipIndex((i) => (i + 1) % QUICK_TIPS.length);
    const prevTip = () => setTipIndex((i) => (i - 1 + QUICK_TIPS.length) % QUICK_TIPS.length);

    const saveWeightTarget = () => {
        if (!currentWeight || !goalWeight) {
            alert('Please fill in both current and goal weight');
            return;
        }
        const target = {
            currentWeight: parseFloat(currentWeight),
            goalWeight: parseFloat(goalWeight),
            goalType: weightGoalType,
            createdAt: new Date().toISOString(),
        };
        setWeightTarget(target);
        localStorage.setItem(WEIGHT_TARGET_KEY, JSON.stringify(target));
        setShowWeightForm(false);
        // Log initial weight
        logWeight(parseFloat(currentWeight));
    };

    const logWeight = (weight) => {
        const entry = {
            weight,
            date: todayKey,
            timestamp: new Date().toISOString(),
        };
        const newLog = [entry, ...weightLog].filter((item, idx, arr) => idx === 0 || item.date !== arr[0].date);
        setWeightLog(newLog);
        localStorage.setItem(WEIGHT_LOG_KEY, JSON.stringify(newLog));
    };

    const handleWeightLogInput = (e) => {
        const weight = parseFloat(e.target.value);
        if (!isNaN(weight)) {
            logWeight(weight);
            e.target.value = '';
        }
    };

    // Get today's meals from localStorage
    const getTodayMeals = () => {
        const today = new Date().toISOString().split('T')[0];
        try {
            const raw = localStorage.getItem(MEAL_LOG_KEY);
            if (raw) {
                const allMeals = JSON.parse(raw);
                return allMeals[today] || [];
            }
        } catch (_) {
            /* ignore */
        }
        return [];
    };

    // Calculate total calories consumed today
    const calculateCaloriesConsumed = () => {
        const meals = getTodayMeals();
        return meals.reduce((sum, meal) => sum + meal.calories, 0);
    };

    const calculateProgress = () => {
        if (!weightTarget || weightLog.length === 0) return null;
        const latest = weightLog[0]?.weight || weightTarget.currentWeight;
        const { goalWeight: gw, currentWeight: start, goalType } = weightTarget;
        const totalChange = goalType === 'lose' ? start - gw : gw - start;
        const currentChange = goalType === 'lose' ? start - latest : latest - start;
        if (totalChange === 0) return 0;
        return Math.min(100, Math.max(0, (currentChange / totalChange) * 100));
    };

    const weightProgress = calculateProgress();
    const caloriesConsumed = calculateCaloriesConsumed();
    const calorieRemaining = calorieTarget ? calorieTarget.dailyTarget - caloriesConsumed : 0;
    const caloriePercent = calorieTarget ? Math.min(100, (caloriesConsumed / calorieTarget.dailyTarget) * 100) : 0;

    // Send notification handler
    const handleSendNotification = useCallback(() => {
        const progress = weightProgress || 0;
        const remaining = 100 - progress;
        const messages = [
            `You're ${progress.toFixed(1)}% toward your weight goal! Keep going!`,
            `Complete your daily habits to reach your target. Current progress: ${progress.toFixed(1)}%`,
            `${remaining.toFixed(1)}% to go! Track your weight and stay consistent.`,
        ];
        const message = messages[Math.floor(Math.random() * messages.length)];
        if ('Notification' in window && Notification.permission === 'granted') {
            new Notification('Health & Fitness Reminder', {
                body: message,
                icon: '💪',
                tag: 'health-reminder',
            });
        }
    }, [weightProgress]);

    const toggleNotifications = () => {
        if (!('Notification' in window)) {
            alert('Your browser does not support notifications');
            return;
        }
        if (Notification.permission === 'granted') {
            const newState = !notificationsEnabled;
            setNotificationsEnabled(newState);
            localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(newState));
            if (newState) {
                handleSendNotification();
            }
        } else {
            Notification.requestPermission().then((permission) => {
                if (permission === 'granted') {
                    setNotificationsEnabled(true);
                    localStorage.setItem(NOTIFICATIONS_KEY, JSON.stringify(true));
                    handleSendNotification();
                }
            });
        }
    };

    // Calorie tracking functions
    const saveUserProfile = () => {
        if (!userAge || !userHeight) {
            alert('Please fill in age and height');
            return;
        }
        const profile = {
            age: parseInt(userAge),
            height: parseInt(userHeight),
            weight: weightTarget?.currentWeight || 75,
            gender: userGender,
            activityLevel,
            healthGoal,
            dietaryPreferences,
        };
        setUserProfile(profile);
        localStorage.setItem(USER_PROFILE_KEY, JSON.stringify(profile));
        
        // Calculate TDEE
        const tdee = calculateTDEE(
            profile.weight,
            profile.height,
            profile.age,
            profile.gender,
            profile.activityLevel
        );
        
        const target = {
            dailyTarget: tdee,
            createdAt: new Date().toISOString(),
            profile,
        };
        setCalorieTarget(target);
        localStorage.setItem(CALORIE_TARGET_KEY, JSON.stringify(target));
        setShowCalorieForm(false);
    };

    const logMeal = () => {
        if (!mealName || !mealCalories) {
            alert('Please fill in meal name and calories');
            return;
        }
        const meal = {
            name: mealName,
            calories: parseInt(mealCalories),
            protein: mealProtein ? parseInt(mealProtein) : 0,
            carbs: mealCarbs ? parseInt(mealCarbs) : 0,
            fat: mealFat ? parseInt(mealFat) : 0,
            type: mealType,
            timestamp: new Date().toISOString(),
        };
        
        const newMealLog = [...mealLog, meal];
        setMealLog(newMealLog);
        
        // Save to localStorage
        try {
            const raw = localStorage.getItem(MEAL_LOG_KEY);
            const allMeals = raw ? JSON.parse(raw) : {};
            allMeals[todayKey] = newMealLog;
            localStorage.setItem(MEAL_LOG_KEY, JSON.stringify(allMeals));
        } catch (_) {
            /* ignore */
        }
        
        // Reset form
        setMealName('');
        setMealCalories('');
        setMealProtein('');
        setMealCarbs('');
        setMealFat('');
        setMealType('snack');
        setShowMealInput(false);
        setSuggestedMeals(null);
        setSuggestionError(null);
    };



    const getMealSuggestions = async () => {
        if (!calorieTarget) {
            alert('Please set up your calorie target first');
            return;
        }

        setLoadingSuggestions(true);
        setSuggestionError(null);

        try {
            const meals = getTodayMeals();
            const consumed = calculateCaloriesConsumed();
            const remaining = calorieTarget.dailyTarget - consumed;

            const suggestions = await getSuggestedMeals({
                remainingCalories: Math.max(0, remaining),
                targetCalories: calorieTarget.dailyTarget,
                mealsToday: meals.length,
                dietaryPreferences,
                mealType,
                healthGoal,
            });

            setSuggestedMeals(suggestions);
        } catch (error) {
            setSuggestionError(error.message);
            console.error('Error getting suggestions:', error);
        } finally {
            setLoadingSuggestions(false);
        }
    };

    const removeMeal = (index) => {
        const newMealLog = mealLog.filter((_, i) => i !== index);
        setMealLog(newMealLog);
        try {
            const raw = localStorage.getItem(MEAL_LOG_KEY);
            const allMeals = raw ? JSON.parse(raw) : {};
            allMeals[todayKey] = newMealLog;
            localStorage.setItem(MEAL_LOG_KEY, JSON.stringify(allMeals));
        } catch (_) {
            /* ignore */
        }
    };



    const sendCalorieNotification = useCallback(() => {
        if (!calorieTarget || !('Notification' in window) || Notification.permission !== 'granted') return;
        
        const consumed = caloriesConsumed;
        const remaining = calorieTarget.dailyTarget - consumed;
        const percentageConsumed = Math.round((consumed / calorieTarget.dailyTarget) * 100);
        
        let message = '';
        if (remaining <= 0) {
            message = `You've reached your daily calorie goal (${consumed}/${calorieTarget.dailyTarget} kcal)! Great job!`;
        } else if (remaining < 500) {
            message = `${remaining} calories remaining. Consider a light snack!`;
        } else if (percentageConsumed === 0) {
            message = `Don't forget to log your meals! ${calorieTarget.dailyTarget} kcal daily goal.`;
        } else {
            message = `You've consumed ${consumed}/${calorieTarget.dailyTarget} kcal. Keep track of your remaining meals!`;
        }
        
        new Notification('Calorie Reminder', {
            body: message,
            icon: '🍎',
            tag: 'calorie-reminder',
        });
    }, [calorieTarget, caloriesConsumed]);

    // Set up daily notifications for weight and calories
    useEffect(() => {
        if (notificationsEnabled && (weightTarget || calorieTarget) && 'Notification' in window && Notification.permission === 'granted') {
            // Send weight notification
            if (weightTarget) handleSendNotification();
            // Send calorie notification
            if (calorieTarget) sendCalorieNotification();
            
            // Schedule daily notifications at 9 AM
            const now = new Date();
            const target = new Date();
            target.setHours(9, 0, 0, 0);
            if (now > target) {
                target.setDate(target.getDate() + 1);
            }
            const timeUntilNotification = target.getTime() - now.getTime();
            const timeoutId = setTimeout(() => {
                if (weightTarget) handleSendNotification();
                if (calorieTarget) sendCalorieNotification();
                // Then set up recurring daily notification
                const intervalId = setInterval(() => {
                    if (weightTarget) handleSendNotification();
                    if (calorieTarget) sendCalorieNotification();
                }, 24 * 60 * 60 * 1000);
                return () => clearInterval(intervalId);
            }, timeUntilNotification);
            return () => clearTimeout(timeoutId);
        }
    }, [notificationsEnabled, weightTarget, calorieTarget, handleSendNotification, sendCalorieNotification, caloriesConsumed]);

    return (
        <div className="health-page">
            <div className="health-container">
                <header className="health-header">
                    <Link to="/" className="health-back-link" aria-label="Back to home">
                        <i className="fas fa-arrow-left" aria-hidden="true" />
                        Home
                    </Link>
                    <div className="health-header-content">
                        <span className="health-badge">
                            <i className="fas fa-heartbeat" aria-hidden="true" />
                            Wellness Hub
                        </span>
                        <h1 className="health-title">Health & Fitness</h1>
                        <p className="health-subtitle">
                            Practical knowledge and daily advice to help you train smarter, eat better, and recover well.
                        </p>
                    </div>
                </header>

                <p className="health-disclaimer" role="note">
                    <i className="fas fa-info-circle" aria-hidden="true" />
                    {HEALTH_DISCLAIMER}
                </p>

                <section className="health-stats-row" aria-label="Daily wellness progress">
                    <div className="health-stat-card">
                        <span className="health-stat-value">{completedCount}/{DAILY_WELLNESS_ITEMS.length}</span>
                        <span className="health-stat-label">Today&apos;s habits</span>
                    </div>
                    <div className="health-stat-card">
                        <span className="health-stat-value">{progressPercent}%</span>
                        <span className="health-stat-label">Daily score</span>
                    </div>
                    {weightTarget && weightProgress !== null && (
                        <div className="health-stat-card">
                            <span className="health-stat-value">{weightProgress.toFixed(0)}%</span>
                            <span className="health-stat-label">Weight goal</span>
                        </div>
                    )}
                    {calorieTarget && (
                        <div className="health-stat-card">
                            <span className="health-stat-value">{caloriesConsumed}/{calorieTarget.dailyTarget}</span>
                            <span className="health-stat-label">Calories</span>
                        </div>
                    )}
                    <div className="health-stat-card">
                        <span className="health-stat-value">{FITNESS_CATEGORIES.length}</span>
                        <span className="health-stat-label">Knowledge areas</span>
                    </div>
                </section>

                {weightTarget && (
                    <section className="health-weight-section">
                        <div className="health-weight-card">
                            <h2 className="health-panel-title">
                                <i className="fas fa-weight" aria-hidden="true" />
                                Weight Goal
                            </h2>
                            <div className="health-weight-info">
                                <div className="health-weight-row">
                                    <span>Current:</span>
                                    <strong>{weightLog[0]?.weight || weightTarget.currentWeight}kg</strong>
                                </div>
                                <div className="health-weight-row">
                                    <span>Target:</span>
                                    <strong>{weightTarget.goalWeight}kg</strong>
                                </div>
                                <div className="health-weight-row">
                                    <span>Goal:</span>
                                    <strong>{weightTarget.goalType === 'lose' ? 'Lose' : 'Gain'} {Math.abs(weightTarget.goalWeight - weightTarget.currentWeight).toFixed(1)}kg</strong>
                                </div>
                            </div>
                            <div className="health-progress-bar" role="progressbar" aria-valuenow={weightProgress?.toFixed(0) || 0} aria-valuemin={0} aria-valuemax={100}>
                                <div className="health-progress-fill" style={{ width: `${weightProgress || 0}%` }} />
                            </div>
                            <p className="health-weight-progress">{weightProgress?.toFixed(1) || 0}% Complete</p>
                            <div className="health-weight-actions">
                                <input
                                    type="number"
                                    placeholder="Log weight today (kg)"
                                    step="0.1"
                                    min="0"
                                    onBlur={handleWeightLogInput}
                                    onKeyPress={(e) => e.key === 'Enter' && handleWeightLogInput(e)}
                                    className="health-weight-input"
                                />
                                <button
                                    type="button"
                                    className={`health-notif-btn ${notificationsEnabled ? 'is-active' : ''}`}
                                    onClick={toggleNotifications}
                                    title="Enable daily notifications"
                                >
                                    <i className={`fas fa-${notificationsEnabled ? 'bell' : 'bell-slash'}`} aria-hidden="true" />
                                    {notificationsEnabled ? 'Notifications On' : 'Enable Notifications'}
                                </button>
                                <button
                                    type="button"
                                    className="health-weight-edit-btn"
                                    onClick={() => setShowWeightForm(true)}
                                >
                                    <i className="fas fa-edit" aria-hidden="true" />
                                    Edit Goal
                                </button>
                            </div>
                        </div>
                    </section>
                )}

                {!weightTarget && (
                    <section className="health-weight-section">
                        <div className="health-weight-card health-weight-setup">
                            <h2 className="health-panel-title">
                                <i className="fas fa-weight" aria-hidden="true" />
                                Set Your Weight Goal
                            </h2>
                            <p className="health-weight-description">Track your weight progress and get daily notifications to help achieve your goal.</p>
                            <button
                                type="button"
                                className="health-weight-start-btn"
                                onClick={() => setShowWeightForm(true)}
                            >
                                <i className="fas fa-plus" aria-hidden="true" />
                                Start Tracking
                            </button>
                        </div>
                    </section>
                )}

                {calorieTarget && (
                    <section className="health-calorie-section">
                        <div className="health-calorie-card">
                            <h2 className="health-panel-title">
                                <i className="fas fa-fire" aria-hidden="true" />
                                Daily Calories
                            </h2>
                            <div className="health-calorie-info">
                                <div className="health-calorie-row">
                                    <span>Consumed:</span>
                                    <strong>{caloriesConsumed} kcal</strong>
                                </div>
                                <div className="health-calorie-row">
                                    <span>Target:</span>
                                    <strong>{calorieTarget.dailyTarget} kcal</strong>
                                </div>
                                <div className="health-calorie-row">
                                    <span>Remaining:</span>
                                    <strong className={calorieRemaining < 0 ? 'over-limit' : ''}>{calorieRemaining} kcal</strong>
                                </div>
                            </div>
                            <div className="health-progress-bar" role="progressbar" aria-valuenow={Math.min(100, Math.round(caloriePercent))} aria-valuemin={0} aria-valuemax={100}>
                                <div className="health-progress-fill" style={{ width: `${Math.min(100, caloriePercent)}%` }} />
                            </div>
                            <p className="health-calorie-progress">{Math.round(caloriePercent)}% of daily target</p>
                            
                            {mealLog.length > 0 && (
                                <div className="health-meal-list">
                                    <h3>Today's Meals</h3>
                                    {mealLog.map((meal, idx) => (
                                        <div key={idx} className="health-meal-item">
                                            <div className="health-meal-info">
                                                <span className="health-meal-name">{meal.name}</span>
                                                <span className="health-meal-type">{meal.type}</span>
                                            </div>
                                            <div className="health-meal-details">
                                                <span className="health-meal-calories">{meal.calories} kcal</span>
                                                {meal.protein > 0 && <span className="health-meal-macro">P: {meal.protein}g</span>}
                                                {meal.carbs > 0 && <span className="health-meal-macro">C: {meal.carbs}g</span>}
                                                {meal.fat > 0 && <span className="health-meal-macro">F: {meal.fat}g</span>}
                                                <button
                                                    type="button"
                                                    className="health-meal-remove"
                                                    onClick={() => removeMeal(idx)}
                                                    title="Remove meal"
                                                >
                                                    <i className="fas fa-trash" aria-hidden="true" />
                                                </button>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                            
                            <div className="health-calorie-actions">
                                {!showMealInput ? (
                                    <button
                                        type="button"
                                        className="health-calorie-add-btn"
                                        onClick={() => setShowMealInput(true)}
                                    >
                                        <i className="fas fa-plus" aria-hidden="true" />
                                        Log Meal
                                    </button>
                                ) : (
                                    <div className="health-meal-input-form">
                                        <input
                                            type="text"
                                            placeholder="Meal name (e.g., Chicken Salad)"
                                            value={mealName}
                                            onChange={(e) => setMealName(e.target.value)}
                                            className="health-meal-text-input"
                                        />
                                        <div className="health-meal-input-row">
                                            <input
                                                type="number"
                                                placeholder="Calories"
                                                min="0"
                                                value={mealCalories}
                                                onChange={(e) => setMealCalories(e.target.value)}
                                                className="health-meal-number-input"
                                            />
                                            <select
                                                value={mealType}
                                                onChange={(e) => setMealType(e.target.value)}
                                                className="health-meal-type-select"
                                            >
                                                <option value="breakfast">Breakfast</option>
                                                <option value="lunch">Lunch</option>
                                                <option value="dinner">Dinner</option>
                                                <option value="snack">Snack</option>
                                            </select>
                                        </div>
                                        <details className="health-meal-macros-detail">
                                            <summary>Add Macros (Optional)</summary>
                                            <div className="health-meal-macro-inputs">
                                                <input
                                                    type="number"
                                                    placeholder="Protein (g)"
                                                    min="0"
                                                    value={mealProtein}
                                                    onChange={(e) => setMealProtein(e.target.value)}
                                                    className="health-meal-macro-input"
                                                />
                                                <input
                                                    type="number"
                                                    placeholder="Carbs (g)"
                                                    min="0"
                                                    value={mealCarbs}
                                                    onChange={(e) => setMealCarbs(e.target.value)}
                                                    className="health-meal-macro-input"
                                                />
                                                <input
                                                    type="number"
                                                    placeholder="Fat (g)"
                                                    min="0"
                                                    value={mealFat}
                                                    onChange={(e) => setMealFat(e.target.value)}
                                                    className="health-meal-macro-input"
                                                />
                                            </div>
                                        </details>
                                        <div className="health-meal-input-buttons">
                                            <button
                                                type="button"
                                                className="health-meal-save-btn"
                                                onClick={logMeal}
                                            >
                                                <i className="fas fa-check" aria-hidden="true" />
                                                Log
                                            </button>
                                            <button
                                                type="button"
                                                className="health-meal-suggest-btn"
                                                onClick={getMealSuggestions}
                                                disabled={loadingSuggestions}
                                            >
                                                <i className={`fas fa-${loadingSuggestions ? 'spinner fa-spin' : 'lightbulb'}`} aria-hidden="true" />
                                                {loadingSuggestions ? 'Loading...' : 'Get AI Suggestions'}
                                            </button>
                                            <button
                                                type="button"
                                                className="health-meal-cancel-btn"
                                                onClick={() => {
                                                    setShowMealInput(false);
                                                    setSuggestedMeals(null);
                                                    setSuggestionError(null);
                                                }}
                                            >
                                                <i className="fas fa-times" aria-hidden="true" />
                                                Cancel
                                            </button>
                                        </div>

                                        {suggestionError && (
                                            <div className="health-error-message">
                                                <i className="fas fa-exclamation-circle" aria-hidden="true" />
                                                {suggestionError}
                                            </div>
                                        )}

                                        {suggestedMeals && (
                                            <div className="health-suggestions-panel">
                                                <h4>AI-Suggested Meals</h4>
                                                <div className="health-suggestion-list">
                                                    {suggestedMeals.suggestions?.map((suggestion, idx) => (
                                                        <div key={idx} className="health-suggestion-item">
                                                            <div className="health-suggestion-header">
                                                                <h5>{suggestion.name}</h5>
                                                                <span className="health-suggestion-calories">{suggestion.calories} kcal</span>
                                                            </div>
                                                            <p className="health-suggestion-desc">{suggestion.description}</p>
                                                            <div className="health-suggestion-macros">
                                                                <span>P: {suggestion.protein_grams}g</span>
                                                                <span>C: {suggestion.carbs_grams}g</span>
                                                                <span>F: {suggestion.fat_grams}g</span>
                                                            </div>
                                                            <button
                                                                type="button"
                                                                className="health-use-suggestion-btn"
                                                                onClick={() => {
                                                                    setMealName(suggestion.name);
                                                                    setMealCalories(suggestion.calories.toString());
                                                                    setMealProtein(suggestion.protein_grams.toString());
                                                                    setMealCarbs(suggestion.carbs_grams.toString());
                                                                    setMealFat(suggestion.fat_grams.toString());
                                                                }}
                                                            >
                                                                Use This
                                                            </button>
                                                        </div>
                                                    ))}
                                                </div>
                                                {suggestedMeals.tips && (
                                                    <div className="health-suggestions-tips">
                                                        <h5>💡 Tips</h5>
                                                        <ul>
                                                            {suggestedMeals.tips.map((tip, idx) => (
                                                                <li key={idx}>{tip}</li>
                                                            ))}
                                                        </ul>
                                                    </div>
                                                )}
                                            </div>
                                        )}
                                    </div>
                                )}
                            </div>
                            <button
                                type="button"
                                className="health-calorie-edit-btn"
                                onClick={() => setShowCalorieForm(true)}
                            >
                                <i className="fas fa-edit" aria-hidden="true" />
                                Edit Profile
                            </button>
                        </div>
                    </section>
                )}

                {!calorieTarget && (
                    <section className="health-calorie-section">
                        <div className="health-calorie-card health-calorie-setup">
                            <h2 className="health-panel-title">
                                <i className="fas fa-fire" aria-hidden="true" />
                                Set Your Calorie Goal
                            </h2>
                            <p className="health-calorie-description">Track daily calories and get AI-powered meal suggestions to reach your health goals.</p>
                            <button
                                type="button"
                                className="health-calorie-start-btn"
                                onClick={() => setShowCalorieForm(true)}
                            >
                                <i className="fas fa-plus" aria-hidden="true" />
                                Start Tracking
                            </button>
                        </div>
                    </section>
                )}

                {showCalorieForm && (
                    <div className="health-modal-overlay" onClick={() => setShowCalorieForm(false)}>
                        <div className="health-modal" onClick={(e) => e.stopPropagation()}>
                            <button
                                type="button"
                                className="health-modal-close"
                                onClick={() => setShowCalorieForm(false)}
                                aria-label="Close form"
                            >
                                <i className="fas fa-times" aria-hidden="true" />
                            </button>
                            <h2>Calorie & Health Profile Setup</h2>
                            <div className="health-form-group">
                                <label htmlFor="user-age">Age (years)</label>
                                <input
                                    id="user-age"
                                    type="number"
                                    placeholder="e.g., 25"
                                    min="13"
                                    max="120"
                                    value={userAge}
                                    onChange={(e) => setUserAge(e.target.value)}
                                />
                            </div>
                            <div className="health-form-group">
                                <label htmlFor="user-height">Height (cm)</label>
                                <input
                                    id="user-height"
                                    type="number"
                                    placeholder="e.g., 175"
                                    min="50"
                                    max="250"
                                    value={userHeight}
                                    onChange={(e) => setUserHeight(e.target.value)}
                                />
                            </div>
                            <div className="health-form-group">
                                <label htmlFor="user-gender">Gender</label>
                                <select
                                    id="user-gender"
                                    value={userGender}
                                    onChange={(e) => setUserGender(e.target.value)}
                                    className="health-form-select"
                                >
                                    <option value="male">Male</option>
                                    <option value="female">Female</option>
                                </select>
                            </div>
                            <div className="health-form-group">
                                <label htmlFor="activity-level">Activity Level</label>
                                <select
                                    id="activity-level"
                                    value={activityLevel}
                                    onChange={(e) => setActivityLevel(e.target.value)}
                                    className="health-form-select"
                                >
                                    <option value="sedentary">Sedentary (little exercise)</option>
                                    <option value="lightly-active">Lightly Active (1-3 days/week)</option>
                                    <option value="moderately-active">Moderately Active (3-5 days/week)</option>
                                    <option value="very-active">Very Active (6-7 days/week)</option>
                                    <option value="extremely-active">Extremely Active (physical job)</option>
                                </select>
                            </div>
                            <div className="health-form-group">
                                <label htmlFor="health-goal">Health Goal</label>
                                <select
                                    id="health-goal"
                                    value={healthGoal}
                                    onChange={(e) => setHealthGoal(e.target.value)}
                                    className="health-form-select"
                                >
                                    <option value="weight-loss">Weight Loss</option>
                                    <option value="maintenance">Maintenance</option>
                                    <option value="weight-gain">Weight Gain (Muscle)</option>
                                </select>
                            </div>
                            <div className="health-form-group">
                                <label htmlFor="dietary-preferences">Dietary Preferences (optional)</label>
                                <input
                                    id="dietary-preferences"
                                    type="text"
                                    placeholder="e.g., Vegetarian, Gluten-free, Vegan"
                                    value={dietaryPreferences}
                                    onChange={(e) => setDietaryPreferences(e.target.value)}
                                />
                            </div>
                            <button
                                type="button"
                                className="health-form-submit"
                                onClick={saveUserProfile}
                            >
                                Save Profile
                            </button>
                        </div>
                    </div>
                )}

                {showWeightForm && (
                    <div className="health-modal-overlay" onClick={() => setShowWeightForm(false)}>
                        <div className="health-modal" onClick={(e) => e.stopPropagation()}>
                            <button
                                type="button"
                                className="health-modal-close"
                                onClick={() => setShowWeightForm(false)}
                                aria-label="Close form"
                            >
                                <i className="fas fa-times" aria-hidden="true" />
                            </button>
                            <h2>Weight Goal Setup</h2>
                            <div className="health-form-group">
                                <label htmlFor="current-weight">Current Weight (kg)</label>
                                <input
                                    id="current-weight"
                                    type="number"
                                    placeholder="e.g., 75"
                                    step="0.1"
                                    min="0"
                                    value={currentWeight}
                                    onChange={(e) => setCurrentWeight(e.target.value)}
                                />
                            </div>
                            <div className="health-form-group">
                                <label htmlFor="goal-weight">Target Weight (kg)</label>
                                <input
                                    id="goal-weight"
                                    type="number"
                                    placeholder="e.g., 70"
                                    step="0.1"
                                    min="0"
                                    value={goalWeight}
                                    onChange={(e) => setGoalWeight(e.target.value)}
                                />
                            </div>
                            <div className="health-form-group">
                                <label>Goal Type</label>
                                <div className="health-radio-group">
                                    <label className="health-radio-item">
                                        <input
                                            type="radio"
                                            value="lose"
                                            checked={weightGoalType === 'lose'}
                                            onChange={(e) => setWeightGoalType(e.target.value)}
                                        />
                                        <span>Lose Weight</span>
                                    </label>
                                    <label className="health-radio-item">
                                        <input
                                            type="radio"
                                            value="gain"
                                            checked={weightGoalType === 'gain'}
                                            onChange={(e) => setWeightGoalType(e.target.value)}
                                        />
                                        <span>Gain Weight</span>
                                    </label>
                                </div>
                            </div>
                            <button
                                type="button"
                                className="health-form-submit"
                                onClick={saveWeightTarget}
                            >
                                Save Goal
                            </button>
                        </div>
                    </div>
                )}

                <div className="health-grid">
                    <aside className="health-sidebar">
                        <section className="health-panel health-checklist-panel">
                            <h2 className="health-panel-title">
                                <i className="fas fa-check-circle" aria-hidden="true" />
                                Daily Wellness Checklist
                            </h2>
                            <p className="health-panel-desc">Track simple habits that support your fitness goals.</p>
                            <div className="health-progress-bar" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100}>
                                <div className="health-progress-fill" style={{ width: `${progressPercent}%` }} />
                            </div>
                            <ul className="health-checklist">
                                {DAILY_WELLNESS_ITEMS.map((item) => (
                                    <li key={item.id}>
                                        <label className={`health-check-item ${checkedItems[item.id] ? 'is-done' : ''}`}>
                                            <input
                                                type="checkbox"
                                                checked={Boolean(checkedItems[item.id])}
                                                onChange={() => toggleChecklistItem(item.id)}
                                            />
                                            <span className="health-check-icon">
                                                <i className={`fas ${item.icon}`} aria-hidden="true" />
                                            </span>
                                            <span>{item.label}</span>
                                        </label>
                                    </li>
                                ))}
                            </ul>
                        </section>

                        <section className="health-panel health-tip-panel">
                            <h2 className="health-panel-title">
                                <i className="fas fa-lightbulb" aria-hidden="true" />
                                Tip of the Day
                            </h2>
                            <blockquote className="health-tip-quote">{QUICK_TIPS[tipIndex]}</blockquote>
                            <div className="health-tip-nav">
                                <button type="button" onClick={prevTip} aria-label="Previous tip">
                                    <i className="fas fa-chevron-left" aria-hidden="true" />
                                </button>
                                <span>{tipIndex + 1} / {QUICK_TIPS.length}</span>
                                <button type="button" onClick={nextTip} aria-label="Next tip">
                                    <i className="fas fa-chevron-right" aria-hidden="true" />
                                </button>
                            </div>
                        </section>
                    </aside>

                    <main className="health-main">
                        <div className="health-category-nav-wrap">
                            <nav className="health-category-nav" aria-label="Fitness topics">
                                {FITNESS_CATEGORIES.map((cat) => (
                                    <button
                                        key={cat.id}
                                        type="button"
                                        className={`health-category-btn ${activeCategory === cat.id ? 'is-active' : ''}`}
                                        onClick={() => {
                                            setActiveCategory(cat.id);
                                            setExpandedArticle(null);
                                        }}
                                    >
                                        <i className={`fas ${cat.icon}`} aria-hidden="true" />
                                        {cat.label}
                                    </button>
                                ))}
                            </nav>
                        </div>

                        <section className="health-panel health-articles-panel">
                            <div className="health-articles-head">
                                <h2 className="health-panel-title">
                                    {activeCategoryMeta && (
                                        <i className={`fas ${activeCategoryMeta.icon}`} aria-hidden="true" />
                                    )}
                                    {activeCategoryMeta?.label || 'Articles'}
                                </h2>
                                <p className="health-panel-desc">
                                    Expert-style guidance you can apply this week — no fluff, just actionable advice.
                                </p>
                            </div>

                            <div className="health-articles">
                                {articles.map((article, index) => {
                                    const isOpen = expandedArticle === index;
                                    return (
                                        <article
                                            key={article.title}
                                            className={`health-article ${isOpen ? 'is-open' : ''}`}
                                        >
                                            <button
                                                type="button"
                                                className="health-article-toggle"
                                                onClick={() => setExpandedArticle(isOpen ? null : index)}
                                                aria-expanded={isOpen}
                                            >
                                                <div>
                                                    <h3>{article.title}</h3>
                                                    <p>{article.summary}</p>
                                                </div>
                                                <i className={`fas fa-chevron-${isOpen ? 'up' : 'down'}`} aria-hidden="true" />
                                            </button>
                                            {isOpen && (
                                                <ul className="health-article-points">
                                                    {article.points.map((point) => (
                                                        <li key={point}>{point}</li>
                                                    ))}
                                                </ul>
                                            )}
                                        </article>
                                    );
                                })}
                            </div>
                        </section>
                    </main>
                </div>
            </div>
        </div>
    );
};

export default Health;

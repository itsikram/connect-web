import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
    ADDICTION_TYPES,
    COPING_STRATEGIES,
    WITHDRAWAL_SYMPTOMS,
    MOTIVATIONAL_QUOTES,
    RESOURCES,
    RECOVERY_MILESTONES,
    HEALTH_BENEFITS,
    RELAPSE_WARNING_SIGNS,
    RELAPSE_PREVENTION,
    COMMON_TRIGGERS,
    THERAPY_TYPES,
    REHAB_DISCLAIMER,
} from '../constants/rehabContent';
import {
    getRecoverySupportMessage,
    getRelapsePrevention,
    getCopingStrategies,
    analyzeCraving,
} from '../utils/rehabApi';
import './Rehab.css';

const REHAB_STORAGE_KEY = 'connectRecovery';
const REHAB_PROFILE_KEY = 'connectRehabProfile';
const CRAVING_LOG_KEY = 'connectCravingLog';
const SUPPORT_CHAT_KEY = 'connectSupportChat';

const getTodayKey = () => new Date().toISOString().split('T')[0];

const Rehab = () => {
    // UI State
    const [activeTab, setActiveTab] = useState('overview');
    const [showProfileSetup, setShowProfileSetup] = useState(false);
    const [showCravingForm, setShowCravingForm] = useState(false);
    const [showSupportChat, setShowSupportChat] = useState(false);
    const [selectedStrategy, setSelectedStrategy] = useState(null);
    const [quoteIndex, setQuoteIndex] = useState(0);

    // Profile State
    const [profile, setProfile] = useState(null);
    const [substanceType, setSubstanceType] = useState('cigarettes');
    const [startDate, setStartDate] = useState('');
    const [emergencyContact, setEmergencyContact] = useState('');
    const [supportSystem, setSupportSystem] = useState('');

    // Recovery State
    const [cravingLog, setCravingLog] = useState([]);
    const [chatMessages, setChatMessages] = useState([]);
    const [userMessage, setUserMessage] = useState('');
    const [sendingMessage, setSendingMessage] = useState(false);

    // Craving Form State
    const [cravingIntensity, setCravingIntensity] = useState(5);
    const [cravingTrigger, setCravingTrigger] = useState('');
    const [cravingMood, setCravingMood] = useState('stressed');
    const [cravingNotes, setCravingNotes] = useState('');

    // Suggestions State
    const [suggestedStrategies, setSuggestedStrategies] = useState(null);
    const [loadingStrategies, setLoadingStrategies] = useState(false);
    const [strategyError, setStrategyError] = useState(null);

    // Notifications
    const [notificationsEnabled, setNotificationsEnabled] = useState(false);

    const todayKey = getTodayKey();

    // Load profile and data on mount
    useEffect(() => {
        try {
            const profileData = localStorage.getItem(REHAB_PROFILE_KEY);
            if (profileData) {
                setProfile(JSON.parse(profileData));
            }
            const cravingData = localStorage.getItem(CRAVING_LOG_KEY);
            if (cravingData) {
                const allCravings = JSON.parse(cravingData);
                setCravingLog(allCravings[todayKey] || []);
            }
            const chatData = localStorage.getItem(SUPPORT_CHAT_KEY);
            if (chatData) {
                setChatMessages(JSON.parse(chatData) || []);
            }
            const notifEnabled = localStorage.getItem(`${REHAB_STORAGE_KEY}:notif`);
            if (notifEnabled) {
                setNotificationsEnabled(JSON.parse(notifEnabled));
            }
            const qIndex = new Date().getDate() % MOTIVATIONAL_QUOTES.length;
            setQuoteIndex(qIndex);
        } catch (_) {
            /* ignore */
        }
    }, [todayKey]);

    // Setup profile
    const setupProfile = () => {
        if (!startDate) {
            alert('Please select your start date');
            return;
        }
        const newProfile = {
            substanceType,
            startDate,
            emergencyContact,
            supportSystem,
            createdAt: new Date().toISOString(),
        };
        setProfile(newProfile);
        localStorage.setItem(REHAB_PROFILE_KEY, JSON.stringify(newProfile));
        setShowProfileSetup(false);
    };

    // Calculate days clean
    const calculateDaysClean = () => {
        if (!profile?.startDate) return 0;
        const start = new Date(profile.startDate);
        const today = new Date();
        const diffTime = Math.abs(today - start);
        return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    };

    const daysClean = calculateDaysClean();

    // Get health benefits
    const getHealthBenefitsForSubstance = () => {
        if (!profile) return [];
        const benefits = HEALTH_BENEFITS[profile.substanceType] || [];
        return benefits;
    };

    // Get withdrawal symptoms
    const getWithdrawalSymptoms = () => {
        if (!profile) return [];
        return WITHDRAWAL_SYMPTOMS[profile.substanceType] || [];
    };

    // Get next milestone
    const getNextMilestone = () => {
        const upcoming = RECOVERY_MILESTONES.find((m) => m.days > daysClean);
        return upcoming || RECOVERY_MILESTONES[RECOVERY_MILESTONES.length - 1];
    };

    // Log craving
    const logCraving = async () => {
        if (!cravingIntensity || !cravingTrigger) {
            alert('Please fill in intensity and trigger');
            return;
        }

        const craving = {
            intensity: parseInt(cravingIntensity),
            trigger: cravingTrigger,
            mood: cravingMood,
            notes: cravingNotes,
            timestamp: new Date().toISOString(),
        };

        const newCravingLog = [...cravingLog, craving];
        setCravingLog(newCravingLog);

        // Save to localStorage
        try {
            const raw = localStorage.getItem(CRAVING_LOG_KEY);
            const allCravings = raw ? JSON.parse(raw) : {};
            allCravings[todayKey] = newCravingLog;
            localStorage.setItem(CRAVING_LOG_KEY, JSON.stringify(allCravings));
        } catch (_) {
            /* ignore */
        }

        // Reset form
        setCravingIntensity(5);
        setCravingTrigger('');
        setCravingMood('stressed');
        setCravingNotes('');
        setShowCravingForm(false);
    };

    // Get AI coping strategies
    const getStrategies = async () => {
        if (!profile) {
            alert('Please set up your profile first');
            return;
        }

        setLoadingStrategies(true);
        setStrategyError(null);

        try {
            const strategies = await getCopingStrategies({
                substanceType: profile.substanceType,
                craving: cravingIntensity,
                location: 'current location',
                timeAvailable: 30,
                previousSuccesses: [],
            });
            setSuggestedStrategies(strategies);
        } catch (error) {
            setStrategyError(error.message);
            console.error('Error getting strategies:', error);
        } finally {
            setLoadingStrategies(false);
        }
    };

    // Send support chat message
    const sendSupportMessage = async () => {
        if (!userMessage.trim() || !profile) return;

        // Add user message to chat
        const userMsg = {
            type: 'user',
            content: userMessage,
            timestamp: new Date().toISOString(),
        };
        const newMessages = [...chatMessages, userMsg];
        setChatMessages(newMessages);
        setUserMessage('');
        setSendingMessage(true);

        try {
            const response = await getRecoverySupportMessage({
                substanceType: profile.substanceType,
                daysClean,
                currentMood: cravingMood,
                craving: cravingIntensity,
                message: userMessage,
                triggers: cravingLog.map((c) => c.trigger),
            });

            const aiMsg = {
                type: 'ai',
                content: response.message,
                timestamp: new Date().toISOString(),
            };
            const updatedMessages = [...newMessages, aiMsg];
            setChatMessages(updatedMessages);

            // Save chat
            try {
                localStorage.setItem(SUPPORT_CHAT_KEY, JSON.stringify(updatedMessages));
            } catch (_) {
                /* ignore */
            }
        } catch (error) {
            console.error('Error getting support:', error);
            const errorMsg = {
                type: 'ai',
                content: `I'm having trouble connecting right now. Please reach out to a helpline: SAMHSA 1-800-662-4357`,
                timestamp: new Date().toISOString(),
            };
            const updatedMessages = [...newMessages, errorMsg];
            setChatMessages(updatedMessages);
        } finally {
            setSendingMessage(false);
        }
    };

    // Toggle notifications
    const toggleNotifications = () => {
        if (!('Notification' in window)) {
            alert('Your browser does not support notifications');
            return;
        }
        if (Notification.permission === 'granted') {
            const newState = !notificationsEnabled;
            setNotificationsEnabled(newState);
            localStorage.setItem(`${REHAB_STORAGE_KEY}:notif`, JSON.stringify(newState));
            if (newState) {
                new Notification('Recovery Reminder', {
                    body: 'You\'ve got this! One day at a time.',
                    icon: '💪',
                });
            }
        } else {
            Notification.requestPermission().then((permission) => {
                if (permission === 'granted') {
                    setNotificationsEnabled(true);
                    localStorage.setItem(`${REHAB_STORAGE_KEY}:notif`, JSON.stringify(true));
                    new Notification('Recovery Reminder', {
                        body: 'You\'ve got this! One day at a time.',
                        icon: '💪',
                    });
                }
            });
        }
    };

    // Daily notification effect
    useEffect(() => {
        if (notificationsEnabled && profile && 'Notification' in window && Notification.permission === 'granted') {
            const now = new Date();
            const target = new Date();
            target.setHours(9, 0, 0, 0);
            if (now > target) {
                target.setDate(target.getDate() + 1);
            }
            const timeUntilNotification = target.getTime() - now.getTime();
            const timeoutId = setTimeout(() => {
                new Notification('Recovery Check-in', {
                    body: MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)],
                    icon: '💪',
                    tag: 'recovery-reminder',
                });
                const intervalId = setInterval(() => {
                    new Notification('Recovery Check-in', {
                        body: MOTIVATIONAL_QUOTES[Math.floor(Math.random() * MOTIVATIONAL_QUOTES.length)],
                        icon: '💪',
                        tag: 'recovery-reminder',
                    });
                }, 24 * 60 * 60 * 1000);
                return () => clearInterval(intervalId);
            }, timeUntilNotification);
            return () => clearTimeout(timeoutId);
        }
    }, [notificationsEnabled, profile]);

    return (
        <div className="rehab-page">
            <div className="rehab-container">
                {/* Header */}
                <header className="rehab-header">
                    <Link to="/" className="rehab-back-link" aria-label="Back to home">
                        <i className="fas fa-arrow-left" aria-hidden="true" />
                        Home
                    </Link>
                    <div className="rehab-header-content">
                        <span className="rehab-badge">
                            <i className="fas fa-heart" aria-hidden="true" />
                            Recovery Support
                        </span>
                        <h1 className="rehab-title">Quit Smoking & Drugs</h1>
                        <p className="rehab-subtitle">
                            AI-powered support for your journey to recovery. You are not alone.
                        </p>
                    </div>
                </header>

                {/* Disclaimer */}
                <p className="rehab-disclaimer" role="note">
                    <i className="fas fa-exclamation-triangle" aria-hidden="true" />
                    {REHAB_DISCLAIMER}
                </p>

                {/* If no profile, show setup */}
                {!profile ? (
                    <section className="rehab-setup-section">
                        <div className="rehab-setup-card">
                            <h2>Start Your Recovery Journey</h2>
                            <p>Create your recovery profile to get personalized support and tracking</p>
                            <button
                                type="button"
                                className="rehab-setup-btn"
                                onClick={() => setShowProfileSetup(true)}
                            >
                                <i className="fas fa-plus" aria-hidden="true" />
                                Start Now
                            </button>
                        </div>
                    </section>
                ) : (
                    <>
                        {/* Stats */}
                        <section className="rehab-stats">
                            <div className="rehab-stat">
                                <span className="rehab-stat-value">{daysClean}</span>
                                <span className="rehab-stat-label">Days Clean</span>
                            </div>
                            <div className="rehab-stat">
                                <span className="rehab-stat-value">{cravingLog.length}</span>
                                <span className="rehab-stat-label">Cravings Logged</span>
                            </div>
                            <div className="rehab-stat">
                                <span className="rehab-stat-value">{chatMessages.length}</span>
                                <span className="rehab-stat-label">Support Messages</span>
                            </div>
                            <div className="rehab-stat">
                                <span className="rehab-stat-value">{getNextMilestone().days}</span>
                                <span className="rehab-stat-label">Next Milestone</span>
                            </div>
                        </section>

                        {/* Motivational Quote */}
                        <section className="rehab-quote-section">
                            <blockquote className="rehab-quote">
                                {MOTIVATIONAL_QUOTES[quoteIndex]}
                            </blockquote>
                        </section>

                        {/* Tabs */}
                        <nav className="rehab-tabs">
                            <button
                                className={`rehab-tab ${activeTab === 'overview' ? 'is-active' : ''}`}
                                onClick={() => setActiveTab('overview')}
                            >
                                <i className="fas fa-chart-pie" aria-hidden="true" />
                                Overview
                            </button>
                            <button
                                className={`rehab-tab ${activeTab === 'cravings' ? 'is-active' : ''}`}
                                onClick={() => setActiveTab('cravings')}
                            >
                                <i className="fas fa-wave-square" aria-hidden="true" />
                                Cravings
                            </button>
                            <button
                                className={`rehab-tab ${activeTab === 'strategies' ? 'is-active' : ''}`}
                                onClick={() => setActiveTab('strategies')}
                            >
                                <i className="fas fa-lightbulb" aria-hidden="true" />
                                Coping
                            </button>
                            <button
                                className={`rehab-tab ${activeTab === 'chat' ? 'is-active' : ''}`}
                                onClick={() => setActiveTab('chat')}
                            >
                                <i className="fas fa-comments" aria-hidden="true" />
                                Support
                            </button>
                            <button
                                className={`rehab-tab ${activeTab === 'resources' ? 'is-active' : ''}`}
                                onClick={() => setActiveTab('resources')}
                            >
                                <i className="fas fa-link" aria-hidden="true" />
                                Resources
                            </button>
                        </nav>

                        {/* Content */}
                        <div className="rehab-content">
                            {/* Overview Tab */}
                            {activeTab === 'overview' && (
                                <section className="rehab-panel">
                                    <h2>Your Recovery Overview</h2>

                                    {/* Health Benefits */}
                                    <div className="rehab-benefits">
                                        <h3>Health Benefits Timeline</h3>
                                        <div className="rehab-timeline">
                                            {getHealthBenefitsForSubstance().map((benefit, idx) => (
                                                <div key={idx} className="rehab-timeline-item">
                                                    <span className="rehab-timeline-time">{benefit.time}</span>
                                                    <span className="rehab-timeline-benefit">{benefit.benefit}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Milestones */}
                                    <div className="rehab-milestones">
                                        <h3>Recovery Milestones</h3>
                                        <div className="rehab-milestone-grid">
                                            {RECOVERY_MILESTONES.map((milestone) => (
                                                <div
                                                    key={milestone.days}
                                                    className={`rehab-milestone ${
                                                        daysClean >= milestone.days ? 'completed' : ''
                                                    }`}
                                                >
                                                    <div className="rehab-milestone-check">
                                                        {daysClean >= milestone.days ? (
                                                            <i className="fas fa-check-circle" aria-hidden="true" />
                                                        ) : (
                                                            <span>{milestone.days}</span>
                                                        )}
                                                    </div>
                                                    <span className="rehab-milestone-title">{milestone.title}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Withdrawal Symptoms */}
                                    {daysClean < 14 && (
                                        <div className="rehab-withdrawal">
                                            <h3>Common Withdrawal Symptoms (Early Recovery)</h3>
                                            <ul className="rehab-symptom-list">
                                                {getWithdrawalSymptoms().map((symptom, idx) => (
                                                    <li key={idx}>
                                                        <i className="fas fa-circle-check" aria-hidden="true" />
                                                        {symptom}
                                                    </li>
                                                ))}
                                            </ul>
                                            <p className="rehab-note">
                                                These symptoms are temporary and indicate your body is healing.
                                                {getWithdrawalSymptoms().some((s) => s.toLowerCase().includes('seek'))
                                                    ? ' Seek medical help if needed.'
                                                    : ''}
                                            </p>
                                        </div>
                                    )}
                                </section>
                            )}

                            {/* Cravings Tab */}
                            {activeTab === 'cravings' && (
                                <section className="rehab-panel">
                                    <h2>Craving Tracker</h2>

                                    {/* Log Craving Button */}
                                    {!showCravingForm && (
                                        <button
                                            type="button"
                                            className="rehab-btn-primary"
                                            onClick={() => setShowCravingForm(true)}
                                        >
                                            <i className="fas fa-plus" aria-hidden="true" />
                                            Log a Craving
                                        </button>
                                    )}

                                    {/* Craving Form */}
                                    {showCravingForm && (
                                        <div className="rehab-form-card">
                                            <h3>Log Craving</h3>
                                            <div className="rehab-form-group">
                                                <label>Craving Intensity</label>
                                                <div className="rehab-slider-container">
                                                    <input
                                                        type="range"
                                                        min="1"
                                                        max="10"
                                                        value={cravingIntensity}
                                                        onChange={(e) => setCravingIntensity(e.target.value)}
                                                        className="rehab-slider"
                                                    />
                                                    <span className="rehab-slider-value">{cravingIntensity}/10</span>
                                                </div>
                                            </div>
                                            <div className="rehab-form-group">
                                                <label htmlFor="trigger">What triggered it?</label>
                                                <input
                                                    id="trigger"
                                                    type="text"
                                                    placeholder="e.g., stress, social situation, boredom"
                                                    value={cravingTrigger}
                                                    onChange={(e) => setCravingTrigger(e.target.value)}
                                                    className="rehab-input"
                                                />
                                            </div>
                                            <div className="rehab-form-group">
                                                <label htmlFor="mood">Current mood</label>
                                                <select
                                                    id="mood"
                                                    value={cravingMood}
                                                    onChange={(e) => setCravingMood(e.target.value)}
                                                    className="rehab-select"
                                                >
                                                    <option value="stressed">Stressed</option>
                                                    <option value="sad">Sad</option>
                                                    <option value="anxious">Anxious</option>
                                                    <option value="bored">Bored</option>
                                                    <option value="happy">Happy</option>
                                                    <option value="social">Social Pressure</option>
                                                    <option value="physical">Physical Discomfort</option>
                                                </select>
                                            </div>
                                            <div className="rehab-form-group">
                                                <label htmlFor="notes">Additional notes</label>
                                                <textarea
                                                    id="notes"
                                                    placeholder="How are you feeling? What's on your mind?"
                                                    value={cravingNotes}
                                                    onChange={(e) => setCravingNotes(e.target.value)}
                                                    className="rehab-textarea"
                                                />
                                            </div>
                                            <div className="rehab-form-buttons">
                                                <button
                                                    type="button"
                                                    className="rehab-btn-primary"
                                                    onClick={logCraving}
                                                >
                                                    Log Craving
                                                </button>
                                                <button
                                                    type="button"
                                                    className="rehab-btn-secondary"
                                                    onClick={() => setShowCravingForm(false)}
                                                >
                                                    Cancel
                                                </button>
                                                <button
                                                    type="button"
                                                    className="rehab-btn-success"
                                                    onClick={() => {
                                                        logCraving();
                                                        getStrategies();
                                                    }}
                                                >
                                                    Log & Get Help
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {/* Craving History */}
                                    {cravingLog.length > 0 && (
                                        <div className="rehab-craving-history">
                                            <h3>Today's Cravings</h3>
                                            {cravingLog.map((craving, idx) => (
                                                <div key={idx} className="rehab-craving-item">
                                                    <div className="rehab-craving-header">
                                                        <span className={`rehab-intensity intensity-${craving.intensity}`}>
                                                            Intensity: {craving.intensity}/10
                                                        </span>
                                                        <span className="rehab-mood">{craving.mood}</span>
                                                        <span className="rehab-time">
                                                            {new Date(craving.timestamp).toLocaleTimeString()}
                                                        </span>
                                                    </div>
                                                    <p className="rehab-trigger">
                                                        <strong>Trigger:</strong> {craving.trigger}
                                                    </p>
                                                    {craving.notes && (
                                                        <p className="rehab-notes">
                                                            <strong>Notes:</strong> {craving.notes}
                                                        </p>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    )}
                                </section>
                            )}

                            {/* Strategies Tab */}
                            {activeTab === 'strategies' && (
                                <section className="rehab-panel">
                                    <h2>Coping Strategies</h2>

                                    {/* Get Strategies Button */}
                                    <button
                                        type="button"
                                        className="rehab-btn-primary"
                                        onClick={getStrategies}
                                        disabled={loadingStrategies}
                                    >
                                        <i
                                            className={`fas fa-${loadingStrategies ? 'spinner fa-spin' : 'magic'}`}
                                            aria-hidden="true"
                                        />
                                        {loadingStrategies ? 'Getting Strategies...' : 'Get AI Strategies'}
                                    </button>

                                    {strategyError && (
                                        <div className="rehab-error">
                                            <i className="fas fa-exclamation-circle" aria-hidden="true" />
                                            {strategyError}
                                        </div>
                                    )}

                                    {/* Suggested Strategies */}
                                    {suggestedStrategies && (
                                        <div className="rehab-suggestions">
                                            <h3>Recommended for You Right Now</h3>
                                            {suggestedStrategies.encouragement && (
                                                <p className="rehab-encouragement">{suggestedStrategies.encouragement}</p>
                                            )}
                                            <div className="rehab-strategies-grid">
                                                {suggestedStrategies.strategies?.map((strategy, idx) => (
                                                    <div key={idx} className="rehab-strategy-card">
                                                        <h4>{strategy.name}</h4>
                                                        <p className="rehab-duration">{strategy.duration}</p>
                                                        <ol className="rehab-steps">
                                                            {strategy.steps?.map((step, sidx) => (
                                                                <li key={sidx}>{step}</li>
                                                            ))}
                                                        </ol>
                                                        <p className="rehab-why">{strategy.effectiveness}</p>
                                                    </div>
                                                ))}
                                            </div>
                                            {suggestedStrategies.emergencyAction && (
                                                <div className="rehab-emergency">
                                                    <h4>If it gets worse:</h4>
                                                    <p>{suggestedStrategies.emergencyAction}</p>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Built-in Strategies */}
                                    <div className="rehab-builtin-strategies">
                                        <h3>Quick Coping Strategies</h3>
                                        <div className="rehab-strategies-grid">
                                            {COPING_STRATEGIES.map((strategy) => (
                                                <div
                                                    key={strategy.id}
                                                    className={`rehab-strategy-card ${
                                                        selectedStrategy?.id === strategy.id ? 'selected' : ''
                                                    }`}
                                                    onClick={() =>
                                                        setSelectedStrategy(
                                                            selectedStrategy?.id === strategy.id ? null : strategy
                                                        )
                                                    }
                                                >
                                                    <div className="rehab-strategy-header">
                                                        <i className={`fas ${strategy.icon}`} aria-hidden="true" />
                                                        <h4>{strategy.title}</h4>
                                                    </div>
                                                    <p>{strategy.description}</p>
                                                    <span className="rehab-duration">{strategy.duration}</span>

                                                    {selectedStrategy?.id === strategy.id && (
                                                        <div className="rehab-strategy-details">
                                                            <h5>How to do it:</h5>
                                                            <ol>
                                                                {strategy.instructions.map((instr, idx) => (
                                                                    <li key={idx}>{instr}</li>
                                                                ))}
                                                            </ol>
                                                        </div>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    {/* Triggers */}
                                    <div className="rehab-triggers">
                                        <h3>Common Triggers & Coping Plans</h3>
                                        {COMMON_TRIGGERS.map((item, idx) => (
                                            <div key={idx} className="rehab-trigger-card">
                                                <h4>{item.trigger}</h4>
                                                <p>{item.strategy}</p>
                                            </div>
                                        ))}
                                    </div>
                                </section>
                            )}

                            {/* Chat Tab */}
                            {activeTab === 'chat' && (
                                <section className="rehab-panel">
                                    <h2>AI Support Chat</h2>
                                    <p className="rehab-chat-intro">
                                        Talk to your AI recovery coach. It's confidential and available 24/7.
                                    </p>

                                    <div className="rehab-chat-box">
                                        <div className="rehab-messages">
                                            {chatMessages.length === 0 && (
                                                <div className="rehab-empty-chat">
                                                    <p>Start a conversation. Share what's on your mind.</p>
                                                </div>
                                            )}
                                            {chatMessages.map((msg, idx) => (
                                                <div
                                                    key={idx}
                                                    className={`rehab-message ${msg.type === 'user' ? 'user-msg' : 'ai-msg'}`}
                                                >
                                                    <div className="rehab-message-content">{msg.content}</div>
                                                    <span className="rehab-message-time">
                                                        {new Date(msg.timestamp).toLocaleTimeString()}
                                                    </span>
                                                </div>
                                            ))}
                                        </div>

                                        <div className="rehab-input-area">
                                            <textarea
                                                value={userMessage}
                                                onChange={(e) => setUserMessage(e.target.value)}
                                                onKeyPress={(e) => {
                                                    if (e.key === 'Enter' && !e.shiftKey) {
                                                        e.preventDefault();
                                                        sendSupportMessage();
                                                    }
                                                }}
                                                placeholder="How are you feeling? What do you need help with?"
                                                className="rehab-chat-input"
                                                disabled={sendingMessage}
                                            />
                                            <button
                                                type="button"
                                                className="rehab-btn-send"
                                                onClick={sendSupportMessage}
                                                disabled={sendingMessage || !userMessage.trim()}
                                            >
                                                <i
                                                    className={`fas fa-${sendingMessage ? 'spinner fa-spin' : 'paper-plane'}`}
                                                    aria-hidden="true"
                                                />
                                            </button>
                                        </div>
                                    </div>

                                    {/* Therapy Types */}
                                    <div className="rehab-therapy">
                                        <h3>Professional Therapy Options</h3>
                                        <div className="rehab-therapy-grid">
                                            {THERAPY_TYPES.map((therapy, idx) => (
                                                <div key={idx} className="rehab-therapy-card">
                                                    <h4>{therapy.name}</h4>
                                                    <p>{therapy.description}</p>
                                                    <p className="rehab-effectiveness">
                                                        <strong>Effectiveness:</strong> {therapy.effectiveness}
                                                    </p>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                </section>
                            )}

                            {/* Resources Tab */}
                            {activeTab === 'resources' && (
                                <section className="rehab-panel">
                                    <h2>Resources & Support</h2>

                                    <div className="rehab-resources-grid">
                                        {RESOURCES.map((resource, idx) => (
                                            <div key={idx} className={`rehab-resource-card resource-${resource.type}`}>
                                                <h3>{resource.name}</h3>
                                                <p className="rehab-resource-desc">{resource.description}</p>
                                                {resource.phone && (
                                                    <p className="rehab-resource-phone">
                                                        <i className="fas fa-phone" aria-hidden="true" />
                                                        <a href={`tel:${resource.phone}`}>{resource.phone}</a>
                                                    </p>
                                                )}
                                                {resource.website && (
                                                    <p className="rehab-resource-website">
                                                        <i className="fas fa-globe" aria-hidden="true" />
                                                        <a href={resource.website} target="_blank" rel="noopener noreferrer">
                                                            {resource.website}
                                                        </a>
                                                    </p>
                                                )}
                                                <p className="rehab-resource-available">
                                                    <i className="fas fa-clock" aria-hidden="true" />
                                                    {resource.available}
                                                </p>
                                            </div>
                                        ))}
                                    </div>

                                    {/* Relapse Prevention */}
                                    <div className="rehab-relapse-prevention">
                                        <h3>Relapse Prevention Strategies</h3>
                                        <div className="rehab-prevention-grid">
                                            <div className="rehab-prevention-card">
                                                <h4>Warning Signs to Watch For</h4>
                                                <ul>
                                                    {RELAPSE_WARNING_SIGNS.map((sign, idx) => (
                                                        <li key={idx}>{sign}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                            <div className="rehab-prevention-card">
                                                <h4>Prevention Strategies</h4>
                                                <ul>
                                                    {RELAPSE_PREVENTION.map((strategy, idx) => (
                                                        <li key={idx}>{strategy}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        </div>
                                    </div>
                                </section>
                            )}
                        </div>
                    </>
                )}

                {/* Profile Setup Modal */}
                {showProfileSetup && (
                    <div className="rehab-modal-overlay" onClick={() => setShowProfileSetup(false)}>
                        <div className="rehab-modal" onClick={(e) => e.stopPropagation()}>
                            <button
                                type="button"
                                className="rehab-modal-close"
                                onClick={() => setShowProfileSetup(false)}
                            >
                                <i className="fas fa-times" aria-hidden="true" />
                            </button>
                            <h2>Create Recovery Profile</h2>

                            <div className="rehab-form-group">
                                <label htmlFor="substance">What are you quitting?</label>
                                <select
                                    id="substance"
                                    value={substanceType}
                                    onChange={(e) => setSubstanceType(e.target.value)}
                                    className="rehab-select-large"
                                >
                                    {ADDICTION_TYPES.map((type) => (
                                        <option key={type.id} value={type.id}>
                                            {type.label}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div className="rehab-form-group">
                                <label htmlFor="startDate">When did you start quitting?</label>
                                <input
                                    id="startDate"
                                    type="date"
                                    value={startDate}
                                    onChange={(e) => setStartDate(e.target.value)}
                                    className="rehab-input-large"
                                />
                            </div>

                            <div className="rehab-form-group">
                                <label htmlFor="emergencyContact">Emergency Contact (Phone/Email)</label>
                                <input
                                    id="emergencyContact"
                                    type="text"
                                    placeholder="Someone you can call in crisis"
                                    value={emergencyContact}
                                    onChange={(e) => setEmergencyContact(e.target.value)}
                                    className="rehab-input-large"
                                />
                            </div>

                            <div className="rehab-form-group">
                                <label htmlFor="supportSystem">Who is supporting you?</label>
                                <input
                                    id="supportSystem"
                                    type="text"
                                    placeholder="e.g., Family, AA sponsor, therapist"
                                    value={supportSystem}
                                    onChange={(e) => setSupportSystem(e.target.value)}
                                    className="rehab-input-large"
                                />
                            </div>

                            <div className="rehab-form-buttons">
                                <button
                                    type="button"
                                    className="rehab-btn-primary rehab-btn-large"
                                    onClick={setupProfile}
                                >
                                    Start Recovery
                                </button>
                                <button
                                    type="button"
                                    className="rehab-btn-secondary rehab-btn-large"
                                    onClick={() => setShowProfileSetup(false)}
                                >
                                    Cancel
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Bottom Actions */}
                {profile && (
                    <div className="rehab-bottom-actions">
                        <button
                            type="button"
                            className={`rehab-action-btn ${notificationsEnabled ? 'active' : ''}`}
                            onClick={toggleNotifications}
                        >
                            <i className={`fas fa-${notificationsEnabled ? 'bell' : 'bell-slash'}`} aria-hidden="true" />
                            {notificationsEnabled ? 'Notifications On' : 'Enable Notifications'}
                        </button>
                        <button
                            type="button"
                            className="rehab-action-btn"
                            onClick={() => setShowCravingForm(true)}
                        >
                            <i className="fas fa-plus-circle" aria-hidden="true" />
                            Log Craving
                        </button>
                        <button
                            type="button"
                            className="rehab-action-btn"
                            onClick={() => setShowSupportChat(true)}
                        >
                            <i className="fas fa-comment-dots" aria-hidden="true" />
                            Chat Now
                        </button>
                        <button
                            type="button"
                            className="rehab-action-btn"
                            onClick={() => setShowProfileSetup(true)}
                        >
                            <i className="fas fa-edit" aria-hidden="true" />
                            Edit Profile
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

export default Rehab;

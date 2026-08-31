import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { openCreatePost } from '../utils/openComposer';

const Habits = () => {
    const navigate = useNavigate();
    const [habits, setHabits] = useState([]);
    const [newHabitName, setNewHabitName] = useState('');
    const [newHabitColor, setNewHabitColor] = useState('#22C55E');
    const [showForm, setShowForm] = useState(false);
    const [isMobile, setIsMobile] = useState(window.innerWidth < 768);

    // Handle responsive layout
    useEffect(() => {
        const handleResize = () => {
            setIsMobile(window.innerWidth < 768);
        };
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    // Load habits from localStorage
    useEffect(() => {
        const savedHabits = localStorage.getItem('habitsApp');
        if (savedHabits) {
            try {
                setHabits(JSON.parse(savedHabits));
            } catch (e) {
                console.error('Error loading habits:', e);
            }
        }
        const reload = () => {
            try {
                const raw = localStorage.getItem('habitsApp');
                if (raw) setHabits(JSON.parse(raw));
            } catch (_) {}
        };
        window.addEventListener('connect:habits-changed', reload);
        return () => window.removeEventListener('connect:habits-changed', reload);
    }, []);

    // Save habits to localStorage
    useEffect(() => {
        if (habits.length >= 0) {
            localStorage.setItem('habitsApp', JSON.stringify(habits));
        }
    }, [habits]);

    const handleCreateHabit = () => {
        if (newHabitName.trim()) {
            const habit = {
                id: Date.now(),
                name: newHabitName.trim(),
                color: newHabitColor,
                streak: 0,
                longestStreak: 0,
                records: {},
                createdAt: new Date().toISOString()
            };
            setHabits([...habits, habit]);
            setNewHabitName('');
            setShowForm(false);
        }
    };

    const handleToggleHabit = (habitId) => {
        const today = new Date().toISOString().split('T')[0];
        setHabits(habits.map(habit => {
            if (habit.id !== habitId) return habit;

            const records = { ...habit.records };
            const isTodayCompleted = records[today] === true;

            if (isTodayCompleted) {
                // Uncheck - remove today's record
                delete records[today];
                // Recalculate streak
                let newStreak = 0;
                const dates = Object.keys(records).filter(date => records[date] === true).sort().reverse();
                let currentDate = new Date();
                currentDate.setHours(0, 0, 0, 0);

                for (let i = 0; i < dates.length; i++) {
                    const recordDate = new Date(dates[i]);
                    recordDate.setHours(0, 0, 0, 0);
                    const diffDays = Math.floor((currentDate - recordDate) / (1000 * 60 * 60 * 24));
                    
                    if (diffDays === i + 1) {
                        newStreak = i + 1;
                    } else {
                        break;
                    }
                }

                return {
                    ...habit,
                    records,
                    streak: newStreak
                };
            } else {
                // Check - add today's record
                records[today] = true;
                // Calculate streak
                let newStreak = 1;
                const dates = Object.keys(records).filter(date => records[date] === true).sort().reverse();
                let currentDate = new Date();
                currentDate.setHours(0, 0, 0, 0);

                for (let i = 1; i < dates.length; i++) {
                    const recordDate = new Date(dates[i]);
                    recordDate.setHours(0, 0, 0, 0);
                    const diffDays = Math.floor((currentDate - recordDate) / (1000 * 60 * 60 * 24));
                    
                    if (diffDays === i) {
                        newStreak = i + 1;
                    } else {
                        break;
                    }
                }

                const longestStreak = Math.max(habit.longestStreak, newStreak);

                return {
                    ...habit,
                    records,
                    streak: newStreak,
                    longestStreak
                };
            }
        }));
    };

    const handleDeleteHabit = (habitId) => {
        if (window.confirm('Are you sure you want to delete this habit?')) {
            setHabits(habits.filter(habit => habit.id !== habitId));
        }
    };

    const getCompletionRate = (habit) => {
        const records = Object.values(habit.records).filter(r => r === true);
        // Last 30 days
        const thirtyDaysAgo = new Date();
        thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
        const recentRecords = Object.keys(habit.records)
            .filter(date => {
                const recordDate = new Date(date);
                return recordDate >= thirtyDaysAgo && habit.records[date] === true;
            }).length;
        return Math.round((recentRecords / 30) * 100);
    };

    const today = new Date().toISOString().split('T')[0];

    const pageStyle = {
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0B1220 0%, #0F172A 100%)',
        color: '#E5E7EB',
        padding: 'clamp(12px, 3vw, 24px)'
    };

    const headerStyle = {
        display: 'flex',
        flexDirection: isMobile ? 'column' : 'row',
        alignItems: isMobile ? 'stretch' : 'center',
        justifyContent: 'space-between',
        marginBottom: 'clamp(20px, 5vw, 32px)',
        gap: 'clamp(12px, 3vw, 16px)',
        flexWrap: 'wrap'
    };

    const headerLeftStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: 'clamp(12px, 3vw, 16px)',
        flexWrap: 'wrap'
    };

    const backButtonStyle = {
        padding: 'clamp(6px, 1.5vw, 8px) clamp(12px, 3vw, 16px)',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        color: '#E5E7EB',
        textDecoration: 'none',
        fontSize: 'clamp(12px, 3vw, 14px)',
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.2s'
    };

    const titleStyle = {
        margin: 0,
        fontSize: 'clamp(24px, 6vw, 32px)',
        fontWeight: 700
    };

    const buttonStyle = {
        padding: 'clamp(8px, 2vw, 10px) clamp(16px, 4vw, 20px)',
        background: 'linear-gradient(135deg, #22C55E, #84CC16)',
        border: 'none',
        borderRadius: '8px',
        color: '#ffffff',
        fontSize: 'clamp(12px, 3vw, 14px)',
        fontWeight: 600,
        cursor: 'pointer',
        transition: 'transform 0.2s',
        whiteSpace: 'nowrap'
    };

    const habitsListStyle = {
        display: 'grid',
        gridTemplateColumns: 'repeat(auto-fill, minmax(clamp(280px, 70vw, 320px), 1fr))',
        gap: 'clamp(12px, 3vw, 20px)',
        marginBottom: 'clamp(20px, 5vw, 32px)'
    };

    const habitCardStyle = {
        padding: 'clamp(16px, 4vw, 24px)',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        transition: 'all 0.2s'
    };

    const habitHeaderStyle = {
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'flex-start',
        marginBottom: 'clamp(12px, 3vw, 16px)'
    };

    const habitNameStyle = {
        margin: 0,
        fontSize: 'clamp(16px, 4vw, 20px)',
        fontWeight: 600,
        flex: 1
    };

    const deleteButtonStyle = {
        padding: 'clamp(4px, 1vw, 6px) clamp(8px, 2vw, 12px)',
        background: 'rgba(239,68,68,0.2)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: '6px',
        color: '#EF4444',
        fontSize: 'clamp(10px, 2.5vw, 12px)',
        cursor: 'pointer'
    };

    const checkboxStyle = {
        width: 'clamp(24px, 6vw, 32px)',
        height: 'clamp(24px, 6vw, 32px)',
        borderRadius: '8px',
        border: '3px solid rgba(255,255,255,0.3)',
        background: 'transparent',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        transition: 'all 0.2s',
        marginBottom: 'clamp(12px, 3vw, 16px)'
    };

    const checkboxCheckedStyle = {
        ...checkboxStyle,
        background: '#22C55E',
        borderColor: '#22C55E'
    };

    const statsStyle = {
        display: 'flex',
        gap: 'clamp(8px, 2vw, 16px)',
        marginTop: 'clamp(12px, 3vw, 16px)',
        flexWrap: 'wrap'
    };

    const statItemStyle = {
        flex: 1,
        textAlign: 'center',
        padding: 'clamp(8px, 2vw, 12px)',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '8px',
        minWidth: 'clamp(80px, 20vw, 120px)'
    };

    const statValueStyle = {
        fontSize: 'clamp(18px, 4.5vw, 24px)',
        fontWeight: 700,
        marginBottom: '4px'
    };

    const statLabelStyle = {
        fontSize: 'clamp(10px, 2.5vw, 12px)',
        opacity: 0.7
    };

    const completionBarStyle = {
        width: '100%',
        height: 'clamp(4px, 1vw, 6px)',
        background: 'rgba(255,255,255,0.1)',
        borderRadius: '3px',
        overflow: 'hidden',
        marginTop: 'clamp(8px, 2vw, 12px)'
    };

    const completionFillStyle = {
        height: '100%',
        background: 'linear-gradient(90deg, #22C55E, #84CC16)',
        transition: 'width 0.3s'
    };

    const formStyle = {
        padding: 'clamp(16px, 4vw, 24px)',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        marginBottom: 'clamp(20px, 5vw, 32px)'
    };

    const inputStyle = {
        width: '100%',
        padding: 'clamp(8px, 2vw, 12px)',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        color: '#E5E7EB',
        fontSize: 'clamp(12px, 3vw, 14px)',
        marginBottom: 'clamp(12px, 3vw, 16px)',
        outline: 'none'
    };

    const colorInputStyle = {
        width: 'clamp(48px, 12vw, 60px)',
        height: 'clamp(32px, 8vw, 40px)',
        border: 'none',
        borderRadius: '8px',
        cursor: 'pointer',
        marginBottom: 'clamp(12px, 3vw, 16px)'
    };

    const emptyStateStyle = {
        textAlign: 'center',
        padding: 'clamp(24px, 6vw, 48px)',
        opacity: 0.6
    };

    const emptyIconStyle = {
        fontSize: 'clamp(40px, 8vw, 64px)',
        marginBottom: '16px'
    };

    const colorOptions = [
        '#22C55E', '#84CC16', '#10B981', '#34D399',
        '#3B82F6', '#6366F1', '#8B5CF6', '#A855F7',
        '#F59E0B', '#F97316', '#EF4444', '#F43F5E'
    ];

    return (
        <div style={pageStyle}>
            <div style={headerStyle}>
                <div style={headerLeftStyle}>
                    <Link to="/menu" style={backButtonStyle}>
                        ← Back
                    </Link>
                    <h1 style={titleStyle}>Habits</h1>
                </div>
                <button onClick={() => setShowForm(!showForm)} style={buttonStyle}>
                    {showForm ? 'Cancel' : '+ New Habit'}
                </button>
            </div>

            {showForm && (
                <div style={formStyle}>
                    <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 600 }}>
                        Create New Habit
                    </h2>
                    <input
                        type="text"
                        placeholder="Habit name..."
                        value={newHabitName}
                        onChange={(e) => setNewHabitName(e.target.value)}
                        style={inputStyle}
                        onKeyPress={(e) => e.key === 'Enter' && handleCreateHabit()}
                    />
                    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '16px' }}>
                        {colorOptions.map(color => (
                            <div
                                key={color}
                                onClick={() => setNewHabitColor(color)}
                                style={{
                                    width: '40px',
                                    height: '40px',
                                    borderRadius: '8px',
                                    background: color,
                                    cursor: 'pointer',
                                    border: newHabitColor === color ? '3px solid #ffffff' : 'none',
                                    transition: 'all 0.2s'
                                }}
                            />
                        ))}
                    </div>
                    <button onClick={handleCreateHabit} style={buttonStyle}>
                        Create Habit
                    </button>
                </div>
            )}

            {habits.length === 0 ? (
                <div style={emptyStateStyle}>
                    <div style={emptyIconStyle}>📈</div>
                    <h2 style={{ margin: '0 0 8px 0', fontSize: '24px' }}>No habits yet</h2>
                    <p style={{ margin: 0 }}>Create your first habit to start building consistency!</p>
                </div>
            ) : (
                <div style={habitsListStyle}>
                    {habits.map(habit => {
                        const isTodayCompleted = habit.records[today] === true;
                        const completionRate = getCompletionRate(habit);

                        return (
                            <div
                                key={habit.id}
                                style={habitCardStyle}
                                onMouseEnter={(e) => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                }}
                                onMouseLeave={(e) => {
                                    e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                }}
                            >
                                <div style={habitHeaderStyle}>
                                    <h3 style={{ ...habitNameStyle, color: habit.color }}>
                                        {habit.name}
                                    </h3>
                                    <button
                                        onClick={() => handleDeleteHabit(habit.id)}
                                        style={deleteButtonStyle}
                                    >
                                        Delete
                                    </button>
                                </div>

                                <div
                                    onClick={() => handleToggleHabit(habit.id)}
                                    style={isTodayCompleted ? checkboxCheckedStyle : checkboxStyle}
                                >
                                    {isTodayCompleted && (
                                        <span style={{ color: '#ffffff', fontSize: '18px' }}>✓</span>
                                    )}
                                </div>

                                <div style={{ fontSize: '13px', opacity: 0.7, marginBottom: '8px' }}>
                                    Click to {isTodayCompleted ? 'uncheck' : 'check'} for today
                                </div>

                                <div style={completionBarStyle}>
                                    <div style={{ ...completionFillStyle, width: `${completionRate}%` }}></div>
                                </div>
                                <div style={{ fontSize: '12px', opacity: 0.7, marginTop: '4px', textAlign: 'right' }}>
                                    {completionRate}% completion (30 days)
                                </div>

                                <button
                                    type="button"
                                    onClick={() =>
                                        openCreatePost({
                                            caption: isTodayCompleted
                                                ? `Checked off ${habit.name} today${habit.streak ? ` — ${habit.streak}-day streak` : ''}.`
                                                : `Working on my ${habit.name} habit.`,
                                            audience: 2,
                                            navigate,
                                        })
                                    }
                                    style={{
                                        ...deleteButtonStyle,
                                        background: 'rgba(0, 212, 255, 0.12)',
                                        border: '1px solid rgba(0, 212, 255, 0.3)',
                                        color: '#7ce7ff',
                                        marginBottom: '10px',
                                    }}
                                >
                                    Share
                                </button>
                                <div style={statsStyle}>
                                    <div style={statItemStyle}>
                                        <div style={{ ...statValueStyle, color: '#22C55E' }}>
                                            {habit.streak}
                                        </div>
                                        <div style={statLabelStyle}>Current Streak</div>
                                    </div>
                                    <div style={statItemStyle}>
                                        <div style={{ ...statValueStyle, color: '#F59E0B' }}>
                                            {habit.longestStreak}
                                        </div>
                                        <div style={statLabelStyle}>Longest Streak</div>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}
        </div>
    );
};

export default Habits;
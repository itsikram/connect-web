import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';

const Calendar = () => {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [events, setEvents] = useState([]);
    const [selectedDate, setSelectedDate] = useState(null);
    const [showEventForm, setShowEventForm] = useState(false);
    const [newEventTitle, setNewEventTitle] = useState('');
    const [newEventTime, setNewEventTime] = useState('');

    // Load events from localStorage
    useEffect(() => {
        const savedEvents = localStorage.getItem('calendarApp');
        if (savedEvents) {
            try {
                setEvents(JSON.parse(savedEvents));
            } catch (e) {
                console.error('Error loading calendar events:', e);
            }
        }
    }, []);

    // Save events to localStorage
    useEffect(() => {
        if (events.length >= 0) {
            localStorage.setItem('calendarApp', JSON.stringify(events));
        }
    }, [events]);

    const getDaysInMonth = (date) => {
        const year = date.getFullYear();
        const month = date.getMonth();
        const firstDay = new Date(year, month, 1);
        const lastDay = new Date(year, month + 1, 0);
        const daysInMonth = lastDay.getDate();
        const startingDayOfWeek = firstDay.getDay();

        const days = [];
        // Empty cells for days before month starts
        for (let i = 0; i < startingDayOfWeek; i++) {
            days.push(null);
        }
        // Days of the month
        for (let i = 1; i <= daysInMonth; i++) {
            days.push(i);
        }
        return days;
    };

    const monthNames = ['January', 'February', 'March', 'April', 'May', 'June',
        'July', 'August', 'September', 'October', 'November', 'December'];
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

    const handlePrevMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() - 1, 1));
    };

    const handleNextMonth = () => {
        setCurrentDate(new Date(currentDate.getFullYear(), currentDate.getMonth() + 1, 1));
    };

    const handleDateClick = (day) => {
        if (day === null) return;
        const clickedDate = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        setSelectedDate(clickedDate);
        setShowEventForm(true);
        setNewEventTitle('');
        setNewEventTime('');
    };

    const handleAddEvent = () => {
        if (!selectedDate || !newEventTitle.trim()) return;

        const event = {
            id: Date.now(),
            title: newEventTitle.trim(),
            time: newEventTime || '',
            date: selectedDate.toISOString(),
            createdAt: new Date().toISOString()
        };

        setEvents([...events, event]);
        setNewEventTitle('');
        setNewEventTime('');
        setShowEventForm(false);
    };

    const handleDeleteEvent = (eventId) => {
        setEvents(events.filter(event => event.id !== eventId));
    };

    const getEventsForDate = (day) => {
        if (day === null) return [];
        const date = new Date(currentDate.getFullYear(), currentDate.getMonth(), day);
        return events.filter(event => {
            const eventDate = new Date(event.date);
            return eventDate.toDateString() === date.toDateString();
        });
    };

    const isToday = (day) => {
        if (day === null) return false;
        const today = new Date();
        return today.getDate() === day &&
            today.getMonth() === currentDate.getMonth() &&
            today.getFullYear() === currentDate.getFullYear();
    };

    const isSelected = (day) => {
        if (day === null || !selectedDate) return false;
        return selectedDate.getDate() === day &&
            selectedDate.getMonth() === currentDate.getMonth() &&
            selectedDate.getFullYear() === currentDate.getFullYear();
    };

    const pageStyle = {
        minHeight: '100vh',
        background: 'linear-gradient(180deg, #0B1220 0%, #0F172A 100%)',
        color: '#E5E7EB',
        padding: '24px'
    };

    const headerStyle = {
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: '32px',
        gap: '16px',
        flexWrap: 'wrap'
    };

    const headerLeftStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
    };

    const backButtonStyle = {
        padding: '8px 16px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        color: '#E5E7EB',
        textDecoration: 'none',
        fontSize: '14px',
        fontWeight: 500,
        display: 'inline-flex',
        alignItems: 'center',
        gap: '8px',
        transition: 'all 0.2s'
    };

    const titleStyle = {
        margin: 0,
        fontSize: '32px',
        fontWeight: 700
    };

    const monthNavStyle = {
        display: 'flex',
        alignItems: 'center',
        gap: '16px'
    };

    const navButtonStyle = {
        padding: '8px 16px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        color: '#E5E7EB',
        fontSize: '14px',
        fontWeight: 500,
        cursor: 'pointer',
        transition: 'all 0.2s'
    };

    const monthYearStyle = {
        fontSize: '20px',
        fontWeight: 600,
        minWidth: '200px',
        textAlign: 'center'
    };

    const calendarStyle = {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        padding: '24px',
        marginBottom: '32px'
    };

    const calendarHeaderStyle = {
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '8px',
        marginBottom: '16px'
    };

    const dayHeaderStyle = {
        padding: '12px',
        textAlign: 'center',
        fontSize: '14px',
        fontWeight: 600,
        opacity: 0.7
    };

    const calendarGridStyle = {
        display: 'grid',
        gridTemplateColumns: 'repeat(7, 1fr)',
        gap: '8px'
    };

    const dayCellStyle = {
        aspectRatio: '1',
        padding: '8px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '8px',
        cursor: 'pointer',
        transition: 'all 0.2s',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'flex-start',
        gap: '4px'
    };

    const dayCellEmptyStyle = {
        ...dayCellStyle,
        cursor: 'default',
        opacity: 0.3
    };

    const dayCellTodayStyle = {
        ...dayCellStyle,
        background: 'linear-gradient(135deg, #EF4444, #F97316)',
        borderColor: 'transparent',
        fontWeight: 700
    };

    const dayCellSelectedStyle = {
        ...dayCellStyle,
        background: 'rgba(239,68,68,0.3)',
        borderColor: 'rgba(239,68,68,0.5)'
    };

    const dayNumberStyle = {
        fontSize: '16px',
        fontWeight: 600
    };

    const eventDotStyle = {
        width: '6px',
        height: '6px',
        borderRadius: '50%',
        background: '#EF4444'
    };

    const eventsPanelStyle = {
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '16px',
        padding: '24px'
    };

    const eventFormStyle = {
        marginBottom: '24px',
        padding: '16px',
        background: 'rgba(255,255,255,0.05)',
        borderRadius: '12px'
    };

    const inputStyle = {
        width: '100%',
        padding: '12px',
        background: 'rgba(255,255,255,0.05)',
        border: '1px solid rgba(255,255,255,0.1)',
        borderRadius: '8px',
        color: '#E5E7EB',
        fontSize: '14px',
        marginBottom: '12px',
        outline: 'none'
    };

    const buttonStyle = {
        padding: '10px 20px',
        background: 'linear-gradient(135deg, #EF4444, #F97316)',
        border: 'none',
        borderRadius: '8px',
        color: '#ffffff',
        fontSize: '14px',
        fontWeight: 600,
        cursor: 'pointer',
        marginRight: '8px'
    };

    const eventItemStyle = {
        padding: '16px',
        background: 'rgba(255,255,255,0.04)',
        border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: '8px',
        marginBottom: '12px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center'
    };

    const deleteButtonStyle = {
        padding: '6px 12px',
        background: 'rgba(239,68,68,0.2)',
        border: '1px solid rgba(239,68,68,0.3)',
        borderRadius: '6px',
        color: '#EF4444',
        fontSize: '12px',
        cursor: 'pointer'
    };

    const todayEvents = events.filter(event => {
        const eventDate = new Date(event.date);
        const today = new Date();
        return eventDate.toDateString() === today.toDateString();
    });

    return (
        <div style={pageStyle}>
            <div style={headerStyle}>
                <div style={headerLeftStyle}>
                    <Link to="/menu" style={backButtonStyle}>
                        ← Back
                    </Link>
                    <h1 style={titleStyle}>Calendar</h1>
                </div>
                <div style={monthNavStyle}>
                    <button onClick={handlePrevMonth} style={navButtonStyle}>
                        ← Prev
                    </button>
                    <div style={monthYearStyle}>
                        {monthNames[currentDate.getMonth()]} {currentDate.getFullYear()}
                    </div>
                    <button onClick={handleNextMonth} style={navButtonStyle}>
                        Next →
                    </button>
                </div>
            </div>

            <div style={calendarStyle}>
                <div style={calendarHeaderStyle}>
                    {dayNames.map(day => (
                        <div key={day} style={dayHeaderStyle}>{day}</div>
                    ))}
                </div>
                <div style={calendarGridStyle}>
                    {getDaysInMonth(currentDate).map((day, index) => {
                        if (day === null) {
                            return <div key={`empty-${index}`} style={dayCellEmptyStyle}></div>;
                        }
                        const dayEvents = getEventsForDate(day);
                        const cellStyle = isToday(day)
                            ? dayCellTodayStyle
                            : isSelected(day)
                                ? dayCellSelectedStyle
                                : dayCellStyle;

                        return (
                            <div
                                key={day}
                                onClick={() => handleDateClick(day)}
                                style={cellStyle}
                                onMouseEnter={(e) => {
                                    if (!isToday(day) && !isSelected(day)) {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.08)';
                                    }
                                }}
                                onMouseLeave={(e) => {
                                    if (!isToday(day) && !isSelected(day)) {
                                        e.currentTarget.style.background = 'rgba(255,255,255,0.04)';
                                    }
                                }}
                            >
                                <div style={dayNumberStyle}>{day}</div>
                                {dayEvents.length > 0 && (
                                    <div style={eventDotStyle}></div>
                                )}
                            </div>
                        );
                    })}
                </div>
            </div>

            <div style={eventsPanelStyle}>
                <h2 style={{ margin: '0 0 16px 0', fontSize: '20px', fontWeight: 600 }}>
                    Today's Events ({todayEvents.length})
                </h2>
                
                {showEventForm && selectedDate && (
                    <div style={eventFormStyle}>
                        <div style={{ marginBottom: '12px', fontSize: '14px', opacity: 0.7 }}>
                            Add event for {selectedDate.toLocaleDateString()}
                        </div>
                        <input
                            type="text"
                            placeholder="Event title..."
                            value={newEventTitle}
                            onChange={(e) => setNewEventTitle(e.target.value)}
                            style={inputStyle}
                        />
                        <input
                            type="time"
                            placeholder="Time (optional)"
                            value={newEventTime}
                            onChange={(e) => setNewEventTime(e.target.value)}
                            style={inputStyle}
                        />
                        <button onClick={handleAddEvent} style={buttonStyle}>
                            Add Event
                        </button>
                        <button
                            onClick={() => {
                                setShowEventForm(false);
                                setSelectedDate(null);
                            }}
                            style={{ ...buttonStyle, background: 'rgba(255,255,255,0.1)', color: '#E5E7EB' }}
                        >
                            Cancel
                        </button>
                    </div>
                )}

                {todayEvents.length === 0 ? (
                    <div style={{ textAlign: 'center', padding: '24px', opacity: 0.6 }}>
                        No events scheduled for today
                    </div>
                ) : (
                    todayEvents
                        .sort((a, b) => {
                            if (a.time && b.time) return a.time.localeCompare(b.time);
                            if (a.time) return -1;
                            if (b.time) return 1;
                            return 0;
                        })
                        .map(event => (
                            <div key={event.id} style={eventItemStyle}>
                                <div>
                                    <div style={{ fontWeight: 600, marginBottom: '4px' }}>{event.title}</div>
                                    {event.time && (
                                        <div style={{ fontSize: '13px', opacity: 0.7 }}>{event.time}</div>
                                    )}
                                </div>
                                <button
                                    onClick={() => handleDeleteEvent(event.id)}
                                    style={deleteButtonStyle}
                                >
                                    Delete
                                </button>
                            </div>
                        ))
                )}
            </div>
        </div>
    );
};

export default Calendar;
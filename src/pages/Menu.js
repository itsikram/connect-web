import React from 'react'
import { Link } from 'react-router-dom'

const APPS = [
    { key: 'ludo', name: 'Ludo Game', desc: 'Play the classic board game', icon: '🎲', colorA: '#F43F5E', colorB: '#F59E0B', href: '/ludo-game' },
    { key: 'youtube', name: 'YouTube', desc: 'Open YouTube full screen', icon: '▶️', colorA: '#DC2626', colorB: '#F59E0B', href: '/youtube' },
    { key: 'notes', name: 'Notes', desc: 'Quickly capture ideas and thoughts', icon: '📝', colorA: '#6366F1', colorB: '#8B5CF6' },
    { key: 'tasks', name: 'Tasks', desc: 'Plan your day and track progress', icon: '✅', colorA: '#10B981', colorB: '#34D399' },
    { key: 'timer', name: 'Focus Timer', desc: 'Stay in flow with timed sessions', icon: '⏱️', colorA: '#F59E0B', colorB: '#F97316' },
    { key: 'flashcards', name: 'Flashcards', desc: 'Memorize faster with spaced repetition', icon: '🧠', colorA: '#3B82F6', colorB: '#06B6D4' },
    { key: 'calendar', name: 'Calendar', desc: 'See what’s ahead at a glance', icon: '📅', colorA: '#EF4444', colorB: '#F97316' },
    { key: 'habits', name: 'Habits', desc: 'Build consistent study routines', icon: '📈', colorA: '#22C55E', colorB: '#84CC16' }
]

const pageStyle = {
    minHeight: '100vh',
    background: 'linear-gradient(180deg, #0B1220 0%, #0F172A 100%)',
    padding: '48px 24px',
    color: '#E5E7EB'
}

const containerStyle = {
    maxWidth: 1200,
    margin: '0 auto'
}

const headerStyle = {
    textAlign: 'center',
    marginBottom: 28
}

const titleStyle = {
    margin: 0,
    fontSize: 32,
    fontWeight: 700,
    letterSpacing: 0.2
}

const subtitleStyle = {
    marginTop: 8,
    opacity: 0.8
}

const gridStyle = {
    display: 'grid',
    gap: 20,
    gridTemplateColumns: 'repeat(auto-fill, minmax(220px, 1fr))'
}

const cardStyle = {
    display: 'block',
    background: 'rgba(255,255,255,0.04)',
    border: '1px solid rgba(255,255,255,0.08)',
    borderRadius: 16,
    padding: 16,
    textDecoration: 'none',
    color: 'inherit',
    boxShadow: '0 2px 10px rgba(0,0,0,0.25)',
    transition: 'transform 160ms ease, box-shadow 160ms ease'
}

const iconBadgeStyle = {
    width: 48,
    height: 48,
    borderRadius: 12,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    fontSize: 24,
    color: '#ffffff',
    marginBottom: 12
}

const cardContentStyle = {
    display: 'flex',
    flexDirection: 'column',
    gap: 6
}

const cardTitleRow = {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between'
}

const cardTitle = {
    margin: 0,
    fontSize: 18,
    fontWeight: 700
}

const cardDesc = {
    margin: 0,
    opacity: 0.85,
    fontSize: 14
}

const Menu = () => {
    return (
        <div style={pageStyle}>
            <div style={containerStyle}>
                <div style={headerStyle}>
                    <h1 style={titleStyle}>Apps</h1>
                    <p style={subtitleStyle}>A clean, focused menu of tools to supercharge your studying</p>
                </div>

                <div style={gridStyle}>
                    {APPS.map((app) => (
                        <Link
                            key={app.key}
                            to={app.href || '#'}
                            style={cardStyle}
                            onMouseEnter={(e) => {
                                e.currentTarget.style.transform = 'translateY(-4px)'
                                e.currentTarget.style.boxShadow = '0 8px 24px rgba(0,0,0,0.35)'
                            }}
                            onMouseLeave={(e) => {
                                e.currentTarget.style.transform = 'translateY(0)'
                                e.currentTarget.style.boxShadow = '0 2px 10px rgba(0,0,0,0.25)'
                            }}
                        >
                            <div
                                style={{
                                    ...iconBadgeStyle,
                                    background: `linear-gradient(135deg, ${app.colorA}, ${app.colorB})`
                                }}
                                aria-hidden="true"
                            >
                                {app.icon}
                            </div>

                            <div style={cardContentStyle}>
                                <div style={cardTitleRow}>
                                    <h3 style={cardTitle}>{app.name}</h3>
                                </div>
                                <p style={cardDesc}>{app.desc}</p>
                            </div>
                        </Link>
                    ))}
                </div>
            </div>
        </div>
    )
}

export default Menu
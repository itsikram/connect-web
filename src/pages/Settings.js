import React, { useMemo } from 'react';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import './Settings.css';

const SETTINGS_NAV = [
    { to: '/settings', end: true, label: 'Profile', icon: 'fa-user' },
    { to: '/settings/privacy', label: 'Privacy', icon: 'fa-shield-alt' },
    { to: '/settings/notification', label: 'Notifications', icon: 'fa-bell' },
    { to: '/settings/account', label: 'Account', icon: 'fa-id-card' },
    { to: '/settings/preference', label: 'Preferences', icon: 'fa-sliders-h' },
    { to: '/settings/message', label: 'Messaging', icon: 'fa-comments' },
    { to: '/settings/sound', label: 'Sounds', icon: 'fa-volume-up' },
    { to: '/settings/cache', label: 'Cache', icon: 'fa-database' },
];

const Settings = () => {
    const location = useLocation();

    const activeLabel = useMemo(() => {
        const match = SETTINGS_NAV.find((item) => {
            if (item.end) return location.pathname === '/settings' || location.pathname === '/settings/';
            return location.pathname.startsWith(item.to);
        });
        return match?.label || 'Settings';
    }, [location.pathname]);

    return (
        <div className="setting-page">
            <div className="settings-shell">
                <header className="settings-header">
                    <h1>Settings</h1>
                    <p>Manage your profile, privacy, notifications, and app preferences.</p>
                </header>

                <div className="settings-layout">
                    <nav className="settings-nav-panel" aria-label="Settings sections">
                        <ul className="setting-groups">
                            {SETTINGS_NAV.map((item) => (
                                <li key={item.to} className="setting-groups-item">
                                    <NavLink
                                        to={item.to}
                                        end={Boolean(item.end)}
                                        className={({ isActive }) => (isActive ? 'active' : undefined)}
                                    >
                                        <span className="setting-nav-icon" aria-hidden="true">
                                            <i className={`fas ${item.icon}`}></i>
                                        </span>
                                        <span className="setting-nav-label">{item.label}</span>
                                        <span className="setting-nav-chevron" aria-hidden="true">
                                            <i className="fa fa-chevron-right"></i>
                                        </span>
                                    </NavLink>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <main className="settings-content-panel" aria-label={activeLabel}>
                        <Outlet />
                    </main>
                </div>
            </div>
        </div>
    );
};

export default Settings;

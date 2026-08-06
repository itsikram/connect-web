import React, { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import "./Friends.css";

const FRIENDS_NAV = [
    { to: "/friends/", end: true, label: "Home", icon: "fa-user-friends", short: "Home" },
    { to: "/friends/requests", label: "Friend Requests", icon: "fa-user-edit", short: "Requests" },
    { to: "/friends/suggestions", label: "Suggestions", icon: "fa-user-plus", short: "Suggest" },
    { to: "/friends/places", label: "Places Near You", icon: "fa-map-marker-alt", short: "Places" },
];

const Friends = () => {
    const profile = useSelector((state) => state.profile);
    const location = useLocation();
    const [navOpen, setNavOpen] = useState(false);

    const allFriendsTo = profile?._id ? `/${profile._id}/friends` : "/friends/";

    const activeLabel = useMemo(() => {
        if (location.pathname.includes("/friends/places")) return "Places Near You";
        if (location.pathname.includes("/friends/requests")) return "Friend Requests";
        if (location.pathname.includes("/friends/suggestions")) return "Suggestions";
        return "Friends";
    }, [location.pathname]);

    const closeNav = () => setNavOpen(false);

    return (
        <div className="friends-page">
            <div className="friends-shell">
                <header className="friends-header">
                    <div className="friends-header-text">
                        <h1>Friends</h1>
                        <p>Manage requests, discover people, and find places nearby.</p>
                    </div>
                    <button
                        type="button"
                        className="friends-nav-toggle"
                        aria-expanded={navOpen}
                        aria-controls="friends-nav-panel"
                        onClick={() => setNavOpen((open) => !open)}
                    >
                        <i className={`fas ${navOpen ? "fa-times" : "fa-bars"}`} aria-hidden="true"></i>
                        <span>{activeLabel}</span>
                    </button>
                </header>

                <div className={`friends-layout${navOpen ? " nav-open" : ""}`}>
                    <nav
                        id="friends-nav-panel"
                        className="friends-nav-panel"
                        aria-label="Friends sections"
                    >
                        <ul className="friends-nav-list">
                            {FRIENDS_NAV.map((item) => (
                                <li key={item.to}>
                                    <NavLink
                                        to={item.to}
                                        end={Boolean(item.end)}
                                        className={({ isActive }) =>
                                            `friends-nav-item${isActive ? " active" : ""}`
                                        }
                                        onClick={closeNav}
                                    >
                                        <span className="friends-nav-icon" aria-hidden="true">
                                            <i className={`fas ${item.icon}`}></i>
                                        </span>
                                        <span className="friends-nav-label">{item.label}</span>
                                        <span className="friends-nav-short">{item.short}</span>
                                    </NavLink>
                                </li>
                            ))}
                            <li>
                                <NavLink
                                    to={allFriendsTo}
                                    className="friends-nav-item"
                                    onClick={closeNav}
                                >
                                    <span className="friends-nav-icon" aria-hidden="true">
                                        <i className="fas fa-users"></i>
                                    </span>
                                    <span className="friends-nav-label">All Friends</span>
                                    <span className="friends-nav-short">All</span>
                                </NavLink>
                            </li>
                        </ul>
                    </nav>

                    {navOpen && (
                        <button
                            type="button"
                            className="friends-nav-backdrop"
                            aria-label="Close friends menu"
                            onClick={closeNav}
                        />
                    )}

                    <main className="friends-content-panel" aria-label={activeLabel}>
                        <Outlet />
                    </main>
                </div>
            </div>
        </div>
    );
};

export default Friends;

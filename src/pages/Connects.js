import React, { useMemo, useState } from "react";
import { NavLink, Outlet, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import "./Connects.css";

const CONNECTS_NAV = [
    { to: "/connects/", end: true, label: "Home", icon: "fa-user-connects", short: "Home" },
    { to: "/connects/requests", label: "Connect Requests", icon: "fa-user-edit", short: "Requests" },
    { to: "/connects/suggestions", label: "Suggestions", icon: "fa-user-plus", short: "Suggest" },
    { to: "/connects/places", label: "Places Near You", icon: "fa-map-marker-alt", short: "Places" },
];

const Connects = () => {
    const profile = useSelector((state) => state.profile);
    const location = useLocation();
    const [navOpen, setNavOpen] = useState(false);

    const allConnectsTo = profile?._id ? `/${profile._id}/connects` : "/connects/";

    const activeLabel = useMemo(() => {
        if (location.pathname.includes("/connects/places")) return "Places Near You";
        if (location.pathname.includes("/connects/requests")) return "Connect Requests";
        if (location.pathname.includes("/connects/suggestions")) return "Suggestions";
        return "Connects";
    }, [location.pathname]);

    const closeNav = () => setNavOpen(false);

    return (
        <div className="connects-page">
            <div className="connects-shell">
                <header className="connects-header">
                    <div className="connects-header-text">
                        <h1>Connects</h1>
                        <p>Manage requests, discover people, and find places nearby.</p>
                    </div>
                    <button
                        type="button"
                        className="connects-nav-toggle"
                        aria-expanded={navOpen}
                        aria-controls="connects-nav-panel"
                        onClick={() => setNavOpen((open) => !open)}
                    >
                        <i className={`fas ${navOpen ? "fa-times" : "fa-bars"}`} aria-hidden="true"></i>
                        <span>{activeLabel}</span>
                    </button>
                </header>

                <div className={`connects-layout${navOpen ? " nav-open" : ""}`}>
                    <nav
                        id="connects-nav-panel"
                        className="connects-nav-panel"
                        aria-label="Connects sections"
                    >
                        <ul className="connects-nav-list">
                            {CONNECTS_NAV.map((item) => (
                                <li key={item.to}>
                                    <NavLink
                                        to={item.to}
                                        end={Boolean(item.end)}
                                        className={({ isActive }) =>
                                            `connects-nav-item${isActive ? " active" : ""}`
                                        }
                                        onClick={closeNav}
                                    >
                                        <span className="connects-nav-icon" aria-hidden="true">
                                            <i className={`fas ${item.icon}`}></i>
                                        </span>
                                        <span className="connects-nav-label">{item.label}</span>
                                        <span className="connects-nav-short">{item.short}</span>
                                    </NavLink>
                                </li>
                            ))}
                            <li>
                                <NavLink
                                    to={allConnectsTo}
                                    className="connects-nav-item"
                                    onClick={closeNav}
                                >
                                    <span className="connects-nav-icon" aria-hidden="true">
                                        <i className="fas fa-users"></i>
                                    </span>
                                    <span className="connects-nav-label">All Connects</span>
                                    <span className="connects-nav-short">All</span>
                                </NavLink>
                            </li>
                        </ul>
                    </nav>

                    {navOpen && (
                        <button
                            type="button"
                            className="connects-nav-backdrop"
                            aria-label="Close connects menu"
                            onClick={closeNav}
                        />
                    )}

                    <main className="connects-content-panel" aria-label={activeLabel}>
                        <Outlet />
                    </main>
                </div>
            </div>
        </div>
    );
};

export default Connects;

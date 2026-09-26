import React from "react";
import { Link } from "react-router-dom";
import { MENU_APPS } from "../constants/menuApps";
import "./Menu.css";

const WALLET_APP = {
  key: "wallet",
  name: "My Wallet",
  desc: "View your coins and Connect+ subscription",
  faIcon: "fa-coins",
  colorA: "#F59E0B",
  href: "/wallet",
};

const Menu = () => {
  return (
    <div className="apps-menu-page">
      <div className="apps-menu-container">
        <header className="apps-menu-header">
          <h1>Apps</h1>
          <p>Games, tools and utilities — everything in one place.</p>
        </header>

        <nav className="apps-menu-grid" aria-label="Apps">
          {[...MENU_APPS, WALLET_APP].map((app) => (
            <Link
              key={app.key}
              to={app.href || "#"}
              className="apps-menu-card"
              style={{ "--app-accent": app.colorA }}
            >
              <span className="apps-menu-icon" aria-hidden="true">
                <i className={`fas ${app.faIcon}`} />
              </span>
              <span className="apps-menu-text">
                <span className="apps-menu-name">{app.name}</span>
                <span className="apps-menu-desc">{app.desc}</span>
              </span>
              <i className="fas fa-chevron-right apps-menu-chevron" aria-hidden="true" />
            </Link>
          ))}
        </nav>
      </div>
    </div>
  );
};

export default Menu;

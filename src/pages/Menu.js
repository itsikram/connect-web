import React from "react";
import { Link } from "react-router-dom";
import { MENU_APPS } from "../constants/menuApps";

const pageStyle = {
  minHeight: "100vh",
  background: "linear-gradient(180deg, #0B1220 0%, #0F172A 100%)",
  padding: "clamp(24px, 6vw, 48px) clamp(16px, 4vw, 24px)",
  color: "#E5E7EB",
};

const containerStyle = {
  width: "90%",
  maxWidth: "90%",
  margin: "0 auto",
};

const headerStyle = {
  textAlign: "center",
  marginBottom: "clamp(20px, 5vw, 28px)",
};

const titleStyle = {
  margin: 0,
  fontSize: "clamp(24px, 5vw, 32px)",
  fontWeight: 700,
  letterSpacing: 0.2,
};

const subtitleStyle = {
  marginTop: 8,
  opacity: 0.8,
  fontSize: "clamp(14px, 3vw, 16px)",
};

const gridStyle = {
  display: "grid",
  gap: "clamp(12px, 3vw, 20px)",
  gridTemplateColumns: "repeat(auto-fill, minmax(min(280px, 100%), 1fr))",
};

const cardStyle = {
  display: "block",
  background: "rgba(255,255,255,0.04)",
  border: "1px solid rgba(255,255,255,0.08)",
  borderRadius: 16,
  padding: "clamp(12px, 3vw, 16px)",
  textDecoration: "none",
  color: "inherit",
  boxShadow: "0 2px 10px rgba(0,0,0,0.25)",
  transition: "transform 160ms ease, box-shadow 160ms ease",
};

const iconBadgeStyle = {
  width: "clamp(40px, 10vw, 48px)",
  height: "clamp(40px, 10vw, 48px)",
  borderRadius: 12,
  display: "inline-flex",
  alignItems: "center",
  justifyContent: "center",
  fontSize: "clamp(20px, 5vw, 24px)",
  color: "#ffffff",
  marginBottom: 12,
};

const cardContentStyle = {
  display: "flex",
  flexDirection: "column",
  gap: 6,
};

const cardTitleRow = {
  display: "flex",
  alignItems: "center",
  justifyContent: "space-between",
};

const cardTitle = {
  margin: 0,
  fontSize: "clamp(16px, 4vw, 18px)",
  fontWeight: 700,
};

const cardDesc = {
  margin: 0,
  opacity: 0.85,
  fontSize: "clamp(12px, 3vw, 14px)",
};

const Menu = () => {
  return (
    <div style={pageStyle}>
      <div style={containerStyle}>
        <div style={headerStyle}>
          <h1 style={titleStyle}>Apps</h1>
          <p style={subtitleStyle}>
            A clean, focused menu of tools to supercharge your studying
          </p>
        </div>

        <div style={gridStyle}>
          {MENU_APPS.map((app) => (
            <Link
              key={app.key}
              to={app.href || "#"}
              style={cardStyle}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = "translateY(-4px)";
                e.currentTarget.style.boxShadow = "0 8px 24px rgba(0,0,0,0.35)";
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = "translateY(0)";
                e.currentTarget.style.boxShadow = "0 2px 10px rgba(0,0,0,0.25)";
              }}
            >
              <div
                style={{
                  ...iconBadgeStyle,
                  background: "rgba(255,255,255,0.04)",
                  boxShadow: `inset 0 0 0 1px ${app.colorA}22`,
                }}
                aria-hidden="true"
              >
                <i
                  className={`fas ${app.faIcon}`}
                  style={{ color: app.colorA }}
                  aria-hidden="true"
                />
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
  );
};

export default Menu;

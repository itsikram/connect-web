import React, { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { selectUnreadMessageCount } from "../header/HeaderRight";
import "./MobileBottomNav.css";

// Same tabs as the Connect mobile app's bottom bar.
const TABS = [
  { to: "/", label: "Home", icon: "fa-home-alt", end: true },
  { to: "/connects", label: "Connects", icon: "fa-users" },
  { to: "/watch", label: "Videos", icon: "fa-play-circle", end: true },
  { to: "/message", label: "Message", icon: "fa-comment-alt-lines", end: true, badge: "messages" },
  { to: "/menu", label: "Menu", icon: "fa-bars" },
];

// Only the top-level browsing screens get the bar; chats, games, calls and
// editors keep the full screen (like the app hides it in a chat thread).
const isTabRoute = (pathname) => {
  const path = pathname.replace(/\/+$/, "") || "/";
  return (
    path === "/" ||
    path === "/connects" ||
    path.startsWith("/connects/") ||
    path === "/watch" ||
    path === "/message" ||
    path === "/menu"
  );
};

const MobileBottomNav = () => {
  const { pathname } = useLocation();
  const unreadMessages = useSelector(selectUnreadMessageCount);
  const visible = isTabRoute(pathname);

  useEffect(() => {
    document.body.classList.toggle("has-mobile-bottom-nav", visible);
    return () => document.body.classList.remove("has-mobile-bottom-nav");
  }, [visible]);

  if (!visible) return null;

  return (
    <nav className="mobile-bottom-nav" aria-label="Main">
      {TABS.map((tab) => (
        <NavLink
          key={tab.to}
          to={tab.to}
          end={tab.end}
          className={({ isActive }) =>
            `mobile-bottom-nav-item${isActive ? " is-active" : ""}`
          }
        >
          {({ isActive }) => (
            <>
              <span className="mobile-bottom-nav-icon">
                <i className={`${isActive ? "fas" : "fal"} ${tab.icon}`} aria-hidden="true" />
                {tab.badge === "messages" && unreadMessages > 0 && (
                  <span className="mobile-bottom-nav-badge">
                    {unreadMessages > 99 ? "99+" : unreadMessages}
                  </span>
                )}
              </span>
              <span className="mobile-bottom-nav-label">{tab.label}</span>
            </>
          )}
        </NavLink>
      ))}
    </nav>
  );
};

export default MobileBottomNav;

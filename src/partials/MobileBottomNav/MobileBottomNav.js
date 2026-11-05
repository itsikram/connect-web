import React, { useEffect } from "react";
import { NavLink, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import { formatBadgeCount, selectUnreadMessageCount } from "../header/HeaderRight";
import { MOBILE_TABS, isTabRoute } from "./mobileTabs";
import "./MobileBottomNav.css";

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
      {MOBILE_TABS.map((tab) => {
        const count = tab.badge === "messages" ? unreadMessages : 0;
        return (
          <NavLink
            key={tab.to}
            to={tab.to}
            end={tab.end}
            className={({ isActive }) =>
              `mobile-bottom-nav-item${isActive ? " is-active" : ""}`
            }
            data-speak={tab.say}
            data-speak-bn={tab.sayBn}
          >
            <span className="mobile-bottom-nav-icon">
              <i className={`fas ${tab.icon}`} aria-hidden="true" />
              {count > 0 && (
                <span className="mobile-bottom-nav-badge" aria-hidden="true">
                  {formatBadgeCount(count)}
                </span>
              )}
            </span>
            <span className="mobile-bottom-nav-label">{tab.label}</span>
            {count > 0 && <span className="visually-hidden">, {count} unread</span>}
          </NavLink>
        );
      })}
    </nav>
  );
};

export default MobileBottomNav;

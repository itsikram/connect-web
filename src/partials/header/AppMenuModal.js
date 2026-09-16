import React, { Fragment, useCallback, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import ModalContainer from "../../components/modal/ModalContainer";
import UserPP from "../../components/UserPP";
import useIsMobile from "../../utils/useIsMobile";
import { SIDEBAR_MENU_ITEMS } from "../sidebar/sidebarMenuItems";
import api from "../../api/api";
import { getProfileSuccess } from "../../services/actions/profileActions";
import "./AppMenuModal.css";

const APP_MENU_ORDER_KEY = "appMenuOrder";

function getProfileDisplayName(profileData) {
  if (!profileData) return "Your profile";
  if (profileData.fullName) return profileData.fullName;
  const user = profileData.user;
  if (user) {
    const name = [user.firstName, user.surname]
      .filter(Boolean)
      .join(" ")
      .trim();
    if (name) return name;
  }
  return "Your profile";
}

const AppMenuModal = ({ isOpen, onRequestClose, onAIAgentOpen }) => {
  const isMobile = useIsMobile();
  const profileData = useSelector((state) => state.profile);
  const dispatch = useDispatch();
  const [appOrder, setAppOrder] = useState([]);
  const [draggedId, setDraggedId] = useState(null);

  useEffect(() => {
    const stored = localStorage.getItem(APP_MENU_ORDER_KEY);
    if (stored) {
      try {
        const parsed = JSON.parse(stored);
        if (Array.isArray(parsed)) setAppOrder(parsed.filter((id) => typeof id === "string"));
      } catch (error) {
        console.warn("Unable to restore app menu order:", error);
      }
    }
  }, []);

  useEffect(() => {
    if (Array.isArray(profileData?.appMenuOrder) && profileData.appMenuOrder.length > 0) {
      setAppOrder(profileData.appMenuOrder);
    }
  }, [profileData?.appMenuOrder]);

  const sortedItems = useMemo(() => {
    const orderIndex = new Map(appOrder.map((id, index) => [id, index]));
    return [...SIDEBAR_MENU_ITEMS].sort(
      (a, b) =>
        (orderIndex.get(a.id) ?? Number.MAX_SAFE_INTEGER) -
        (orderIndex.get(b.id) ?? Number.MAX_SAFE_INTEGER),
    );
  }, [appOrder]);

  const persistOrder = useCallback(
    async (nextOrder) => {
      setAppOrder(nextOrder);
      localStorage.setItem(APP_MENU_ORDER_KEY, JSON.stringify(nextOrder));
      try {
        const response = await api.post("/profile/update", { appMenuOrder: nextOrder });
        if (response.data) dispatch(getProfileSuccess(response.data));
      } catch (error) {
        console.error("Unable to save app menu order to the server:", error);
      }
    },
    [dispatch],
  );

  const handleDrop = useCallback(
    (targetId) => {
      if (!draggedId || draggedId === targetId) {
        setDraggedId(null);
        return;
      }
      const next = [...sortedItems];
      const fromIndex = next.findIndex((item) => item.id === draggedId);
      const toIndex = next.findIndex((item) => item.id === targetId);
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      void persistOrder(next.map((item) => item.id));
      setDraggedId(null);
    },
    [draggedId, persistOrder, sortedItems],
  );

  const userInfo = (() => {
    try {
      return JSON.parse(localStorage.getItem("user") || "{}");
    } catch {
      return {};
    }
  })();

  const profilePath = userInfo.profile ? `/${userInfo.profile}/` : "/";
  const profileName = getProfileDisplayName(profileData);

  const handleItemClick = useCallback(() => {
    onRequestClose();
  }, [onRequestClose]);

  const handleAIAgentClick = useCallback(() => {
    onRequestClose();
    onAIAgentOpen?.();
  }, [onRequestClose, onAIAgentOpen]);

  return (
    <ModalContainer
      isOpen={isOpen}
      onRequestClose={onRequestClose}
      isFullscreen={isMobile}
      id="app-menu-modal"
      style={
        isMobile
          ? {
              display: "flex",
              flexDirection: "column",
              height: "100dvh",
              maxHeight: "100dvh",
              overflow: "hidden",
            }
          : {
              display: "flex",
              flexDirection: "column",
              maxHeight: "min(85dvh, 85vh)",
              overflow: "hidden",
            }
      }
    >
      <div className="app-menu-modal">
        <div className="app-menu-modal-header">
          <div>
            <h2 className="app-menu-modal-title">Connect Apps</h2>
            <p className="app-menu-modal-subtitle">
              Shortcuts to features & pages
            </p>
          </div>
          <button
            type="button"
            className="app-menu-modal-close"
            onClick={onRequestClose}
            aria-label="Close menu"
          >
            <i className="far fa-times" aria-hidden="true" />
          </button>
        </div>

        <div className="app-menu-modal-body">
          <Link
            to={profilePath}
            className="app-menu-profile-card"
            onClick={handleItemClick}
          >
            <div className="app-menu-profile-avatar">
              <UserPP
                profilePic={profileData?.profilePic}
                size="full"
                profile={profileData?._id}
              />
            </div>
            <div className="app-menu-profile-meta">
              <p className="app-menu-profile-name">{profileName}</p>
              <p className="app-menu-profile-hint">View your profile</p>
            </div>
            <i
              className="fas fa-chevron-right"
              style={{ opacity: 0.4, fontSize: "0.85rem" }}
              aria-hidden="true"
            />
          </Link>

          <div className="app-menu-grid" role="list">
            <button
              type="button"
              className="app-menu-grid-item"
              role="listitem"
              onClick={handleAIAgentClick}
            >
              <span
                className="app-menu-icon-wrap"
                style={{ boxShadow: "inset 0 0 0 1px #00D4FF22" }}
              >
                <i
                  className="fas fa-robot"
                  style={{ color: "#00D4FF" }}
                  aria-hidden="true"
                />
              </span>
              <span className="app-menu-grid-label">AI Agent</span>
            </button>

            {sortedItems.map((item) => {
              const iconStyle = { color: item.accent || "#29B1A9" };
              const content = (
                <Fragment>
                  <span
                    className="app-menu-icon-wrap"
                    style={{ boxShadow: `inset 0 0 0 1px ${item.accent}22` }}
                  >
                    <i
                      className={`fas ${item.icon}`}
                      style={iconStyle}
                      aria-hidden="true"
                    />
                  </span>
                  <span className="app-menu-grid-label">{item.label}</span>
                </Fragment>
              );

              if (item.disabled || !item.to) {
                return (
                  <div
                    key={item.id}
                    className="app-menu-grid-item is-disabled"
                    role="listitem"
                    aria-disabled="true"
                    title="Coming soon"
                    draggable="true"
                    onDragStart={() => setDraggedId(item.id)}
                    onDragOver={(event) => event.preventDefault()}
                    onDrop={() => handleDrop(item.id)}
                  >
                    {content}
                  </div>
                );
              }

              return (
                <Link
                  key={item.id}
                  to={item.to}
                  className="app-menu-grid-item"
                  role="listitem"
                  draggable="true"
                  onDragStart={() => setDraggedId(item.id)}
                  onDragOver={(event) => event.preventDefault()}
                  onDrop={() => handleDrop(item.id)}
                  aria-grabbed={draggedId === item.id}
                  onClick={handleItemClick}
                >
                  {content}
                </Link>
              );
            })}
          </div>
        </div>
      </div>
    </ModalContainer>
  );
};

export default AppMenuModal;

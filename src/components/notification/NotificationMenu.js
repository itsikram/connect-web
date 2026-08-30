import React, {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Link, useNavigate } from "react-router-dom";
import moment from "moment";
import api from "../../api/api";
import {
  getNotificationDisplayParts,
  getNotificationLink,
} from "../../utils/notificationUtils";
import {
  viewNotification,
  viewNotifications,
  deleteNotifications,
  deleteNotification,
} from "../../services/actions/notificationActions";
import { shouldShowLudoInviteAlert } from "../../utils/ludoInviteUtils";
import { shouldShowChessInviteAlert } from "../../utils/chessInviteUtils";
import "./NotificationMenu.css";

function getShortTimeAgo(timestamp) {
  if (!timestamp) return "";
  const now = moment();
  const time = moment(timestamp);
  const seconds = Math.floor(now.diff(time) / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);
  const weeks = Math.floor(days / 7);
  const months = Math.floor(days / 30);
  const years = Math.floor(days / 365);
  if (seconds < 60) return "Just now";
  if (minutes < 60) return `${minutes}m`;
  if (hours < 24) return `${hours}h`;
  if (days < 7) return `${days}d`;
  if (weeks < 4) return `${weeks}w`;
  if (months < 12) return `${months}mo`;
  return `${years}y`;
}

function isNewNotification(notification) {
  if (!notification?.isSeen) return true;
  if (!notification?.timestamp) return false;
  return moment().diff(moment(notification.timestamp), "hours") < 24;
}

const NotificationMenu = ({
  notifications = [],
  menuStyle = {},
  profileId,
  dispatch,
  onClose,
  pendingLudoInvites = [],
  pendingChessInvites = [],
}) => {
  const navigate = useNavigate();
  const [filter, setFilter] = useState("all"); // all | unread
  const [optionsOpen, setOptionsOpen] = useState(false);
  const [itemMenuId, setItemMenuId] = useState(null);
  const [busy, setBusy] = useState(false);
  const optionsRef = useRef(null);
  const itemMenuRef = useRef(null);

  const feed = useMemo(
    () =>
      Array.isArray(notifications)
        ? notifications.filter((n) => n?.type !== "message")
        : [],
    [notifications],
  );

  const ludoInviteFeed = useMemo(() => {
    if (!Array.isArray(pendingLudoInvites)) return [];
    return pendingLudoInvites
      .filter((inv) => shouldShowLudoInviteAlert(inv.gameId, inv.from, inv))
      .map((inv) => ({
        _id: `ludo-invite-${inv.gameId}-${inv.from}`,
        isSeen: false,
        isLudoInvite: true,
        type: "ludo_invite",
        timestamp: inv.ts || Date.now(),
        title: "Ludo Invitation",
        text: `${inv.name || "A friend"} invited you to play Ludo`,
        icon: inv.avatar,
        inviterName: inv.name,
        inviterAvatar: inv.avatar,
        invitePayload: inv,
      }));
  }, [pendingLudoInvites]);

  const chessInviteFeed = useMemo(() => {
    if (!Array.isArray(pendingChessInvites)) return [];
    return pendingChessInvites
      .filter((inv) => shouldShowChessInviteAlert(inv.gameId, inv.from, inv))
      .map((inv) => ({
        _id: `chess-invite-${inv.gameId}-${inv.from}`,
        isSeen: false,
        isChessInvite: true,
        type: "chess_invite",
        timestamp: inv.ts || Date.now(),
        title: "Chess Invitation",
        text: `${inv.name || "A friend"} invited you to play Chess`,
        icon: inv.avatar,
        inviterName: inv.name,
        inviterAvatar: inv.avatar,
        invitePayload: inv,
      }));
  }, [pendingChessInvites]);

  const combinedFeed = useMemo(() => {
    const ludoInviteKeys = new Set(
      ludoInviteFeed.map((item) => {
        const payload = item.invitePayload || {};
        return `ludo:${payload.gameId || ""}:${payload.from || ""}`;
      }),
    );
    const chessInviteKeys = new Set(
      chessInviteFeed.map((item) => {
        const payload = item.invitePayload || {};
        return `chess:${payload.gameId || ""}:${payload.from || ""}`;
      }),
    );

    const filteredBaseFeed = feed.filter((item) => {
      const isPlainLudoInvite = item?.type === "ludo_invite";
      const isPlainChessInvite = item?.type === "chess_invite";
      if (!isPlainLudoInvite && !isPlainChessInvite) return true;

      const gameId =
        item?.gameId || item?.data?.gameId || item?.linkData?.gameId;
      const from =
        item?.from ||
        item?.by ||
        item?.inviterId ||
        item?.data?.inviterId ||
        item?.data?.from ||
        item?.linkData?.inviterId;

      const inviteMeta = item?.data || item?.linkData || item;
      if (isPlainLudoInvite) {
        if (gameId && !shouldShowLudoInviteAlert(gameId, from, inviteMeta)) {
          return false;
        }
        return !ludoInviteKeys.has(`ludo:${gameId || ""}:${from || ""}`);
      }

      if (gameId && !shouldShowChessInviteAlert(gameId, from, inviteMeta)) {
        return false;
      }
      return !chessInviteKeys.has(`chess:${gameId || ""}:${from || ""}`);
    });

    const existingIds = new Set(
      filteredBaseFeed.map((item) => String(item._id)),
    );
    const extra = [...ludoInviteFeed, ...chessInviteFeed].filter(
      (item) => !existingIds.has(String(item._id)),
    );
    return [...extra, ...filteredBaseFeed];
  }, [feed, ludoInviteFeed, chessInviteFeed]);

  const filtered = useMemo(() => {
    const list =
      filter === "unread"
        ? combinedFeed.filter((n) => !n.isSeen)
        : combinedFeed;
    return [...list].sort((a, b) => {
      const ta = new Date(a.timestamp || 0).getTime();
      const tb = new Date(b.timestamp || 0).getTime();
      return tb - ta;
    });
  }, [combinedFeed, filter]);

  const { newItems, earlierItems } = useMemo(() => {
    const newer = [];
    const earlier = [];
    filtered.forEach((n) => {
      if (isNewNotification(n)) newer.push(n);
      else earlier.push(n);
    });
    return { newItems: newer, earlierItems: earlier };
  }, [filtered]);

  const unreadCount = useMemo(
    () => combinedFeed.filter((n) => !n.isSeen).length,
    [combinedFeed],
  );

  useEffect(() => {
    const onDocClick = (e) => {
      if (optionsRef.current && !optionsRef.current.contains(e.target)) {
        setOptionsOpen(false);
      }
      if (itemMenuRef.current && !itemMenuRef.current.contains(e.target)) {
        setItemMenuId(null);
      }
    };
    document.addEventListener("mousedown", onDocClick);
    return () => document.removeEventListener("mousedown", onDocClick);
  }, []);

  const markOneRead = useCallback(
    async (notificationId) => {
      if (!notificationId) return;
      try {
        const res = await api.post("/notification/view", { notificationId });
        if (res.status === 200) {
          dispatch(viewNotification(notificationId));
        }
      } catch (err) {
        console.error("Failed to mark notification read:", err);
      }
    },
    [dispatch],
  );

  const handleOpen = useCallback(
    async (notification) => {
      if (notification?.isLudoInvite) {
        if (typeof window.acceptLudoInviteFromHeader === "function") {
          window.acceptLudoInviteFromHeader(notification.invitePayload);
          onClose?.();
        }
        return;
      }
      if (notification?.isChessInvite) {
        if (typeof window.acceptChessInviteFromHeader === "function") {
          window.acceptChessInviteFromHeader(notification.invitePayload);
          onClose?.();
        }
        return;
      }
      const id = notification?._id;
      const link = getNotificationLink(notification);
      if (id && !notification.isSeen) {
        await markOneRead(id);
      }
      onClose?.();
      if (link && link !== "#") {
        navigate(link);
      }
    },
    [markOneRead, navigate, onClose],
  );

  const markAllAsRead = useCallback(async () => {
    if (!profileId || unreadCount === 0 || busy) return;
    setBusy(true);
    setOptionsOpen(false);
    try {
      const res = await api.post("/notification/viewall", {
        profile: profileId,
      });
      if (res.status === 200) {
        dispatch(viewNotifications());
      }
    } catch (err) {
      console.error("Failed to mark all notifications read:", err);
    } finally {
      setBusy(false);
    }
  }, [profileId, unreadCount, busy, dispatch]);

  const deleteAll = useCallback(async () => {
    if (!profileId || feed.length === 0 || busy) return;
    if (!window.confirm("Delete all notifications?")) return;
    setBusy(true);
    setOptionsOpen(false);
    try {
      const res = await api.post("/notification/deleteall", {
        profile: profileId,
      });
      if (res.status === 200) {
        dispatch(deleteNotifications());
      }
    } catch (err) {
      console.error("Failed to delete notifications:", err);
    } finally {
      setBusy(false);
    }
  }, [profileId, feed.length, busy, dispatch]);

  const deleteOne = useCallback(
    async (notificationId) => {
      if (!notificationId || busy) return;
      setBusy(true);
      setItemMenuId(null);
      try {
        const res = await api.post("/notification/delete", { notificationId });
        if (res.status === 200) {
          dispatch(deleteNotification(notificationId));
        }
      } catch (err) {
        console.error("Failed to delete notification:", err);
      } finally {
        setBusy(false);
      }
    },
    [busy, dispatch],
  );

  const renderItem = (notification) => {
    const derivedInvitePayload =
      notification?.invitePayload ||
      (notification?.type === "ludo_invite" || notification?.type === "chess_invite"
        ? {
            gameId:
              notification?.gameId ||
              notification?.data?.gameId ||
              notification?.linkData?.gameId,
            from:
              notification?.from ||
              notification?.by ||
              notification?.inviterId ||
              notification?.data?.inviterId ||
              notification?.data?.from ||
              notification?.linkData?.inviterId,
            name:
              notification?.inviterName ||
              notification?.senderName ||
              notification?.name,
            avatar:
              notification?.inviterAvatar ||
              notification?.icon ||
              notification?.avatar,
            slotIndex:
              notification?.slotIndex ||
              notification?.data?.slotIndex ||
              notification?.linkData?.slotIndex,
            playerCount:
              notification?.playerCount ||
              notification?.data?.playerCount ||
              notification?.linkData?.playerCount,
            reinvite:
              notification?.reinvite === true ||
              notification?.data?.reinvite === true ||
              notification?.linkData?.reinvite === true,
            inviteId:
              notification?.inviteId ||
              notification?.data?.inviteId ||
              notification?.linkData?.inviteId,
            ts: notification?.timestamp,
          }
        : null);
    const isLudoInvite = Boolean(
      notification?.isLudoInvite ||
      (notification?.type === "ludo_invite" &&
        derivedInvitePayload?.gameId &&
        derivedInvitePayload?.from &&
        shouldShowLudoInviteAlert(
          derivedInvitePayload.gameId,
          derivedInvitePayload.from,
          derivedInvitePayload,
        )),
    );
    const isChessInvite = Boolean(
      notification?.isChessInvite ||
      (notification?.type === "chess_invite" &&
        derivedInvitePayload?.gameId &&
        derivedInvitePayload?.from &&
        shouldShowChessInviteAlert(
          derivedInvitePayload.gameId,
          derivedInvitePayload.from,
          derivedInvitePayload,
        )),
    );
    const isGameInvite = isLudoInvite || isChessInvite;
    const parts = isLudoInvite
      ? {
          avatar:
            notification.inviterAvatar ||
            notification.icon ||
            derivedInvitePayload?.avatar,
          actorName:
            notification.inviterName ||
            derivedInvitePayload?.name ||
            "A friend",
          headline: `${notification.inviterName || derivedInvitePayload?.name || "A friend"} invited you to play Ludo`,
          description: "",
          typeMeta: {
            label: "Ludo Invite",
            color: "#8B5CF6",
            icon: "fas fa-dice",
          },
        }
      : isChessInvite
      ? {
          avatar:
            notification.inviterAvatar ||
            notification.icon ||
            derivedInvitePayload?.avatar,
          actorName:
            notification.inviterName ||
            derivedInvitePayload?.name ||
            "A friend",
          headline: `${notification.inviterName || derivedInvitePayload?.name || "A friend"} invited you to play Chess`,
          description: "",
          typeMeta: {
            label: "Chess Invite",
            color: "#2E7D32",
            icon: "fas fa-chess",
          },
        }
      : getNotificationDisplayParts(notification);
    const unread = notification.isSeen === false;
    const isMenuOpen =
      !isGameInvite && String(itemMenuId) === String(notification._id);

    return (
      <li
        key={notification._id}
        className={`notif-item ${unread ? "unread" : ""}`}
      >
        <button
          type="button"
          className="notif-item-main"
          onClick={() => handleOpen(notification)}
        >
          <div className="notif-avatar-wrap">
            <img
              className="notif-avatar"
              src={parts.avatar || notification.icon || "/logo192.png"}
              alt=""
            />
            <span
              className="notif-type-badge"
              style={{ backgroundColor: parts.typeMeta?.color || "#2078F4" }}
              title={parts.typeMeta?.label || ""}
            >
              <i className={parts.typeMeta?.icon || "fas fa-bell"} />
            </span>
          </div>

          <div className="notif-body">
            <p className="notif-headline">
              {parts.actorName ? (
                <>
                  <strong>{parts.actorName}</strong>
                  {parts.headline.replace(parts.actorName, "")}
                </>
              ) : (
                parts.headline
              )}
            </p>

            {parts.description ? (
              <p className="notif-preview">“{parts.description}”</p>
            ) : null}

            {isGameInvite ? (
              <div className="notif-ludo-actions">
                <button
                  type="button"
                  className="notif-ludo-btn accept"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isChessInvite) {
                      if (typeof window.acceptChessInviteFromHeader === "function") {
                        window.acceptChessInviteFromHeader(derivedInvitePayload);
                      }
                    } else if (
                      typeof window.acceptLudoInviteFromHeader === "function"
                    ) {
                      window.acceptLudoInviteFromHeader(derivedInvitePayload);
                    }
                    onClose?.();
                  }}
                >
                  Accept
                </button>
                <button
                  type="button"
                  className="notif-ludo-btn decline"
                  onClick={(e) => {
                    e.stopPropagation();
                    if (isChessInvite) {
                      if (typeof window.declineChessInviteFromHeader === "function") {
                        window.declineChessInviteFromHeader(derivedInvitePayload);
                      }
                    } else if (
                      typeof window.declineLudoInviteFromHeader === "function"
                    ) {
                      window.declineLudoInviteFromHeader(derivedInvitePayload);
                    }
                  }}
                >
                  Decline
                </button>
              </div>
            ) : null}

            <div className="notif-meta">
              <span
                className="notif-time"
                title={
                  notification.timestamp
                    ? moment(notification.timestamp).format("LT, ll")
                    : ""
                }
              >
                {getShortTimeAgo(notification.timestamp)}
              </span>
              {parts.typeMeta?.label ? (
                <>
                  <span className="notif-dot-sep">·</span>
                  <span className="notif-type-label">
                    {parts.typeMeta.label}
                  </span>
                </>
              ) : null}
            </div>
          </div>

          {unread ? <span className="notif-unread-dot" aria-hidden /> : null}
        </button>

        {!isGameInvite && (
          <div
            className="notif-item-actions"
            ref={isMenuOpen ? itemMenuRef : null}
          >
            <button
              type="button"
              className="notif-more-btn"
              aria-label="Notification options"
              onClick={(e) => {
                e.stopPropagation();
                setItemMenuId(isMenuOpen ? null : notification._id);
                setOptionsOpen(false);
              }}
            >
              <i className="fas fa-ellipsis-h" />
            </button>
            {isMenuOpen && (
              <ul className="notif-item-menu">
                {unread && (
                  <li
                    onClick={(e) => {
                      e.stopPropagation();
                      markOneRead(notification._id);
                      setItemMenuId(null);
                    }}
                  >
                    <i className="fas fa-check" /> Mark as read
                  </li>
                )}
                <li
                  onClick={(e) => {
                    e.stopPropagation();
                    deleteOne(notification._id);
                  }}
                >
                  <i className="fas fa-trash-alt" /> Remove this notification
                </li>
              </ul>
            )}
          </div>
        )}
      </li>
    );
  };

  const renderSection = (title, items) => {
    if (!items.length) return null;
    return (
      <div className="notif-section">
        <h3 className="notif-section-title">{title}</h3>
        <ul className="notif-list">{items.map(renderItem)}</ul>
      </div>
    );
  };

  return (
    <div className="hr-notification-menu-container notif-menu">
      <div className="notification-leftside-header notif-menu-header">
        <h2 className="notification-leftside-title">Notifications</h2>
        <div className="notification-sidebar-header-menu" ref={optionsRef}>
          <div
            className="header-menu-icons"
            onClick={(e) => {
              e.stopPropagation();
              setOptionsOpen((v) => !v);
              setItemMenuId(null);
            }}
            role="button"
            tabIndex={0}
            aria-label="Notification options"
            aria-expanded={optionsOpen}
            aria-haspopup="true"
          >
            <i className="far fa-ellipsis-h" />
          </div>
          {optionsOpen && (
            <ul className="notification-option-menu notif-options-dropdown">
              <li
                onClick={markAllAsRead}
                className={unreadCount === 0 ? "disabled" : ""}
              >
                Mark all as read
              </li>
              <li
                onClick={deleteAll}
                className={feed.length === 0 ? "disabled" : ""}
              >
                Delete all
              </li>
              <li>
                <Link to="/settings/notification" onClick={() => onClose?.()}>
                  Notification settings
                </Link>
              </li>
            </ul>
          )}
        </div>
      </div>

      <div className="notif-filter-tabs">
        <button
          type="button"
          className={`notif-filter-tab ${filter === "all" ? "active" : ""}`}
          onClick={() => setFilter("all")}
        >
          All
        </button>
        <button
          type="button"
          className={`notif-filter-tab ${filter === "unread" ? "active" : ""}`}
          onClick={() => setFilter("unread")}
        >
          Unread{unreadCount > 0 ? ` (${unreadCount})` : ""}
        </button>
      </div>

      <div className="notif-scroll" style={menuStyle}>
        {filtered.length === 0 ? (
          <div className="notif-empty">
            <i className="far fa-bell-slash" />
            <p>
              {filter === "unread"
                ? "No unread notifications"
                : "No notifications yet"}
            </p>
          </div>
        ) : (
          <>
            {renderSection("New", newItems)}
            {renderSection("Earlier", earlierItems)}
          </>
        )}
      </div>
    </div>
  );
};

export default NotificationMenu;

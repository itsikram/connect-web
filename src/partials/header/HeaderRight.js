import React, {
  Fragment,
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
  lazy,
  Suspense,
  memo,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import MegaMC from "../../components/MegaMC";
import UserPP from "../../components/UserPP";
import NotificationMenu from "../../components/notification/NotificationMenu";
import { useAuth } from "../../hooks/useAuth";
import { shallowEqual, useDispatch, useSelector } from "react-redux";
import config from "../../config/config.json";
import { sanitizeProfileImageUrl } from "../../utils/profileImage";

const HeaderMessageMenu = lazy(() => import("./HeaderMessageMenu"));

const EMPTY_LIST = [];

const selectUnreadMessageCount = (state) => {
  const myId = state.profile?._id;
  const list = state.message;
  if (!myId || !Array.isArray(list)) return 0;
  const me = String(myId);
  let count = 0;
  for (let i = 0; i < list.length; i += 1) {
    const messages = list[i]?.messages;
    if (!messages) continue;
    for (let j = 0; j < messages.length; j += 1) {
      const msg = messages[j];
      if (msg && String(msg.receiverId) === me && msg.isSeen !== true) {
        count += 1;
      }
    }
  }
  return count;
};

const selectNotifications = (state) =>
  Array.isArray(state.notification) ? state.notification : EMPTY_LIST;

const selectUnseenNotificationCount = (state) => {
  const list = state.notification;
  if (!Array.isArray(list)) return 0;
  let count = 0;
  for (let i = 0; i < list.length; i += 1) {
    const item = list[i];
    if (item && item.type !== "message" && item.isSeen === false) count += 1;
  }
  return count;
};

const selectMenuMaxHeight = (state) => {
  const option = state.option || {};
  return Math.max((option.bodyHeight || 0) - (option.headerHeight || 0) - 100, 280);
};

const selectProfileHeader = (state) => {
  const profile = state.profile;
  if (!profile) return null;
  return {
    _id: profile._id,
    profilePic: profile.profilePic,
    fullName: profile.fullName,
    firstName: profile.user?.firstName,
    surname: profile.user?.surname,
  };
};

const HeaderNotificationPanel = memo(function HeaderNotificationPanel({
  menuStyle,
  profileId,
  dispatch,
  onClose,
  pendingLudoInvites,
  pendingChessInvites,
}) {
  const notificationData = useSelector(selectNotifications);
  const headerNotifications = useMemo(
    () => notificationData.filter((n) => n?.type !== "message"),
    [notificationData],
  );

  return (
    <NotificationMenu
      notifications={headerNotifications}
      menuStyle={menuStyle}
      profileId={profileId}
      dispatch={dispatch}
      onClose={onClose}
      pendingLudoInvites={pendingLudoInvites}
      pendingChessInvites={pendingChessInvites}
    />
  );
});

let HeaderRight = ({ pendingLudoInvites = [], pendingChessInvites = [] }) => {
  const dispatch = useDispatch();
  const { user, logout, isAuthenticated } = useAuth();
  const profileData = useSelector(selectProfileHeader, shallowEqual);
  const totalNotifications = useSelector(selectUnseenNotificationCount);
  const totalMessages = useSelector(selectUnreadMessageCount);
  const menuMaxHeight = useSelector(selectMenuMaxHeight);
  const [isMsgMenu, setIsMsgMenu] = useState(false);
  const [isProfileMenu, setIsProfileMenu] = useState(false);
  const [isNotificationMenu, setIsNotificationMenu] = useState(false);
  const location = useLocation();
  const [ppUrl, setPpUrl] = useState(config?.defaultProfile);
  const navigate = useNavigate();
  const profilePath = user?.profile ? `/${user.profile}/` : "/";

  const [messageOption, setMessageOption] = useState(false);
  const messageOptionMenuRef = useRef(null);
  const headerMenusRef = useRef(null);

  const notificationMenuStyle = useMemo(
    () => ({ maxHeight: menuMaxHeight + "px" }),
    [menuMaxHeight],
  );

  useEffect(() => {
    if (!profileData?.profilePic) {
      setPpUrl(config?.defaultProfile);
    } else {
      setPpUrl(
        sanitizeProfileImageUrl(profileData.profilePic, 96) ||
          profileData.profilePic,
      );
    }
  }, [profileData]);

  useEffect(() => {
    setIsMsgMenu(false);
    setIsProfileMenu(false);
    setIsNotificationMenu(false);
    setMessageOption(false);
  }, [location]);

  const closeMenus = useCallback(() => {
    setIsMsgMenu(false);
    setIsProfileMenu(false);
    setIsNotificationMenu(false);
    setMessageOption(false);
  }, []);

  const showMsgList = useCallback(() => {
    setIsProfileMenu(false);
    setIsNotificationMenu(false);
    setMessageOption(false);
    setIsMsgMenu((prev) => !prev);
  }, []);

  const clickProfileBtn = useCallback(() => {
    setIsProfileMenu((prev) => !prev);
    setIsMsgMenu(false);
    setIsNotificationMenu(false);
    setMessageOption(false);
  }, []);

  const showNotificationList = useCallback(() => {
    setIsNotificationMenu((prev) => !prev);
    setIsProfileMenu(false);
    setIsMsgMenu(false);
    setMessageOption(false);
  }, []);

  const preloadMessageMenu = useCallback(() => {
    import("./HeaderMessageMenu");
  }, []);

  useEffect(() => {
    const openMenu = () => {
      setIsNotificationMenu(true);
      setIsProfileMenu(false);
      setIsMsgMenu(false);
    };
    window.addEventListener("openNotificationMenu", openMenu);
    return () => window.removeEventListener("openNotificationMenu", openMenu);
  }, []);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (
        headerMenusRef.current &&
        !headerMenusRef.current.contains(event.target)
      ) {
        closeMenus();
      }
      if (
        messageOptionMenuRef.current &&
        !messageOptionMenuRef.current.contains(event.target)
      ) {
        setMessageOption(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [closeMenus]);

  const handleMessageToggleClick = useCallback((e) => {
    e.stopPropagation();
    setMessageOption((prev) => !prev);
  }, []);

  const goToProfilePath = useCallback(() => {
    navigate(profilePath);
  }, [navigate, profilePath]);

  const logOutBtn = useCallback(
    (e) => {
      e.preventDefault();
      logout();
      navigate("/login");
    },
    [logout, navigate],
  );

  if (!isAuthenticated) {
    return null;
  }

  return (
    <Fragment>
      <div className="header-quick-menu-container" ref={headerMenusRef}>
        <ul className="header-quick-menu">
          <li
            onClick={showMsgList}
            onMouseEnter={preloadMessageMenu}
            className={`header-quick-menu-item ${isMsgMenu ? "active" : ""}`}
            title="Message"
            aria-expanded={isMsgMenu}
            aria-haspopup="true"
          >
            <div className="header-quick-menu-icon">
              <i className="far fa-comment-alt-lines"></i>
              {totalMessages > 0 && (
                <span className="hr-counter-badge">
                  <span className="counter">{totalMessages}</span>
                </span>
              )}
            </div>
          </li>

          {isMsgMenu && (
            <MegaMC
              style={{
                right: "50%",
                zIndex: 1002,
                transform: "translateX(50%)",
                top: "101%",
                width: "340px",
                backgroundColor: "#242526",
                borderRadius: "8px",
                display: "block",
                boxShadow: "0px 0px 2px 0px rgba(255,255,255,0.3)",
              }}
              className="hr-mega-menu"
            >
              <div className="hr-mm-container">
                <div className="hr-notification-menu-container">
                  <div className="notification-leftside-header">
                    <h2 className="notification-leftside-title">Messages</h2>
                    <div className="notification-sidebar-header-menu">
                      <div
                        className="header-menu-icons"
                        style={{ position: "relative" }}
                        ref={messageOptionMenuRef}
                      >
                        <div
                          onClick={handleMessageToggleClick}
                          onKeyDown={(e) => {
                            if (e.key === "Enter" || e.key === " ") {
                              e.preventDefault();
                              handleMessageToggleClick(e);
                            }
                          }}
                          role="button"
                          tabIndex={0}
                          aria-label="Message options"
                          aria-expanded={messageOption}
                          aria-haspopup="true"
                        >
                          <i className="far fa-ellipsis-h"></i>
                        </div>
                        {messageOption && (
                          <div
                            className="header-message-option-menu"
                            style={{
                              position: "absolute",
                              top: "20px",
                              right: "0",
                              boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
                              zIndex: 1003,
                              width: "200px",
                            }}
                          >
                            <ul
                              className="notification-option-menu"
                              style={{
                                listStyle: "none",
                                margin: 0,
                                padding: "8px 0",
                              }}
                            >
                              <li
                                style={{
                                  padding: "8px 16px",
                                  cursor: "pointer",
                                }}
                              >
                                <Link to={"/settings/message"}>
                                  Message Settings
                                </Link>
                              </li>
                            </ul>
                          </div>
                        )}
                      </div>
                    </div>
                  </div>
                  <Suspense
                    fallback={
                      <div
                        style={{
                          minHeight: 160,
                          color: "#b0b3b8",
                          display: "flex",
                          alignItems: "center",
                          justifyContent: "center",
                          fontSize: 13,
                        }}
                      >
                        Loading…
                      </div>
                    }
                  >
                    <HeaderMessageMenu
                      menuStyle={notificationMenuStyle}
                      onChatSelect={closeMenus}
                    />
                  </Suspense>
                </div>
              </div>
            </MegaMC>
          )}
          <li
            onClick={showNotificationList}
            className={`header-quick-menu-item ${isNotificationMenu ? "active" : ""}`}
            title="Notifications"
            aria-expanded={isNotificationMenu}
            aria-haspopup="true"
          >
            <div className="header-quick-menu-icon">
              <i className="far fa-bell"></i>
              {totalNotifications > 0 && (
                <span className="hr-counter-badge">
                  <span className="counter">{totalNotifications}</span>
                </span>
              )}
            </div>
          </li>
          {isNotificationMenu && (
            <MegaMC
              style={{
                right: "50%",
                zIndex: 1002,
                transform: "translateX(50%)",
                top: "101%",
                width: "360px",
                maxWidth: "95vw",
                backgroundColor: "#242526",
                borderRadius: "8px",
                display: "block",
                boxShadow: "0px 0px 2px 0px rgba(255,255,255,0.3)",
              }}
              className="hr-mega-menu hr-notification-mega"
            >
              <div className="hr-mm-container">
                <HeaderNotificationPanel
                  menuStyle={notificationMenuStyle}
                  profileId={profileData?._id}
                  dispatch={dispatch}
                  onClose={closeMenus}
                  pendingLudoInvites={pendingLudoInvites}
                  pendingChessInvites={pendingChessInvites}
                />
              </div>
            </MegaMC>
          )}
          <li
            onClick={clickProfileBtn}
            className="header-quick-menu-item item-profile"
            title=""
            aria-expanded={isProfileMenu}
            aria-haspopup="true"
          >
            <div className="profile-pic">
              <img src={ppUrl} alt="" referrerPolicy="no-referrer" />
            </div>
          </li>
          {isProfileMenu && (
            <MegaMC
              style={{
                right: "50%",
                transform: "translateX(50%)",
                top: "101%",
                width: "300px",
                backgroundColor: "#242526",
                borderRadius: "5px",
                display: "block",
                boxShadow: "0px 0px 2px 0px rgba(255,255,255,0.3)",
              }}
              className="hr-mega-menu"
            >
              <div className="hr-mm-container">
                <div onClick={goToProfilePath}>
                  <div className="all-profiles">
                    {profileData && <UserPP profilePic={ppUrl} />}
                    <span className="text-capitalize">
                      {" "}
                      {profileData.fullName
                        ? profileData.fullName
                        : [profileData.firstName, profileData.surname]
                            .filter(Boolean)
                            .join(" ")}{" "}
                    </span>
                  </div>
                </div>
                <div className="profile-menus">
                  <Link to="/settings" className="profile-menu-item">
                    <div className="menu-item-icon">
                      <i className="fa fa-cog"></i>
                    </div>
                    <span className="menu-item-name">Settings</span>
                  </Link>
                  <Link
                    onClick={logOutBtn}
                    to={"#"}
                    className="profile-menu-item"
                  >
                    <div className="menu-item-icon">
                      <i className="fa fa-sign-out-alt"></i>
                    </div>
                    <span className="menu-item-name">LogOut</span>
                  </Link>
                </div>
              </div>
            </MegaMC>
          )}
        </ul>
      </div>
    </Fragment>
  );
};

export default memo(HeaderRight);

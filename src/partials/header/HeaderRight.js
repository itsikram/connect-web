import React, {
  Fragment,
  useEffect,
  useState,
  useRef,
  useCallback,
  useMemo,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import MegaMC from "../../components/MegaMC";
import UserPP from "../../components/UserPP";
import MessageList from "../../components/Message/MessageList";
import NotificationMenu from "../../components/notification/NotificationMenu";
import { useAuth } from "../../hooks/useAuth";
import config from "../../config/config.json";
import "../../pages/Message.css";

let HeaderRight = ({ dispatch, useSelector, pendingLudoInvites = [] }) => {
  const { user, logout, isAuthenticated } = useAuth();
  let profileData = useSelector((state) => state.profile);
  let optionData = useSelector((state) => state.option);
  let notificaitonData = useSelector((state) => state.notification);
  let messageData = useSelector((state) => state.message);
  let [isMsgMenu, setIsMsgMenu] = useState(false);
  let [isProfileMenu, setIsProfileMenu] = useState(false);
  let [isNotificationMenu, setIsNotificationMenu] = useState(false);
  let [totalNotifications, setTotalNotifications] = useState(0);
  let [totalMessages, setTotalMessages] = useState(0);
  let location = useLocation();
  let [ppUrl, setPpUrl] = useState(config?.defaultProfile);
  let navigate = useNavigate();
  const profilePath = user?.profile ? `/${user.profile}/` : "/";

  const [messageOption, setMessageOption] = useState(false);
  const messageOptionMenuRef = useRef(null);

  let notificationMenuHeight =
    optionData.bodyHeight - optionData.headerHeight - 100;
  let notificationMenuStyle = {
    maxHeight: Math.max(notificationMenuHeight, 280) + "px",
  };

  const headerNotifications = useMemo(
    () =>
      Array.isArray(notificaitonData)
        ? notificaitonData.filter((n) => n.type !== "message")
        : [],
    [notificaitonData],
  );

  useEffect(() => {
    // Reset to default profile pic when profile data is cleared (after logout)
    if (!profileData?.profilePic) {
      setPpUrl(config?.defaultProfile);
    } else if (profileData?.profilePic) {
      setPpUrl(profileData.profilePic);
    }
  }, [profileData]);

  useEffect(() => {
    setIsMsgMenu(false);
    setIsProfileMenu(false);
    setIsNotificationMenu(false);
  }, [location]);

  useEffect(() => {
    let unseenNotifications = headerNotifications.filter(
      (data) => data.isSeen === false,
    );
    setTotalNotifications(unseenNotifications.length);
  }, [headerNotifications]);
  useEffect(() => {
    if (!messageData || !profileData._id) return;

    let unseenMessages = messageData.filter((data) => {
      if (data && data.messages && data.messages.length > 0) {
        if (data.messages[0].isSeen === false) {
          if (data.messages[0].receiverId === profileData._id) {
            return true;
          }
        }
      }
      return false;
    });
    setTotalMessages(unseenMessages.length);
  }, [messageData, profileData._id]);

  let showMsgList = () => {
    setIsMsgMenu(!isMsgMenu);
    setIsProfileMenu(false);
    setIsNotificationMenu(false);
  };

  let clickProfileBtn = () => {
    setIsProfileMenu(!isProfileMenu);
    setIsMsgMenu(false);
    setIsNotificationMenu(false);
  };

  let showNotificationList = () => {
    setIsNotificationMenu(!isNotificationMenu);
    setIsProfileMenu(false);
    setIsMsgMenu(false);
  };

  useEffect(() => {
    const handleClickOutside = (event) => {
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
  }, []);

  let handleMessageToggleClick = useCallback(() => {
    setMessageOption((prev) => !prev);
  }, []);

  let MessageOptionMenu = () => (
    <div
      className="header-message-option-menu"
      style={{ position: "relative", display: "inline-block" }}
      ref={messageOptionMenuRef}
    >
      {messageOption && (
        <div
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
            style={{ listStyle: "none", margin: 0, padding: "8px 0" }}
          >
            <li style={{ padding: "8px 16px", cursor: "pointer" }}>
              <Link to={"/settings/message"}>Message Settings</Link>
            </li>
          </ul>
        </div>
      )}
    </div>
  );

  let goToProfilePath = useCallback(
    (e) => {
      navigate(profilePath);
    },
    [navigate, profilePath],
  );

  let logOutBtn = useCallback(
    (e) => {
      e.preventDefault();

      // Call the logout function from AuthContext
      logout();

      // Navigate to login page
      navigate("/login");
    },
    [logout, navigate],
  );

  // Early return if not authenticated
  if (!isAuthenticated) {
    return null;
  }

  return (
    <Fragment>
      <div className="header-quick-menu-container">
        <ul className="header-quick-menu">
          <li
            onClick={showMsgList}
            className={`header-quick-menu-item ${isMsgMenu ? "active" : ""}`}
            title="Message"
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
                width: "300px",
                backgroundColor: "#242526",
                borderRadius: "5px",
                display: isMsgMenu ? "block" : "none",
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
                        onClick={handleMessageToggleClick}
                        className="header-menu-icons"
                      >
                        <i className="far fa-ellipsis-h"></i>
                        {messageOption && <MessageOptionMenu />}
                      </div>
                    </div>
                  </div>
                  <MessageList
                    compact
                    menuStyle={notificationMenuStyle}
                    onChatSelect={() => setIsMsgMenu(false)}
                  />
                </div>
              </div>
            </MegaMC>
          )}
          <li
            onClick={showNotificationList}
            className={`header-quick-menu-item ${isNotificationMenu ? "active" : ""}`}
            title="Notifications"
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
                <NotificationMenu
                  notifications={headerNotifications}
                  menuStyle={notificationMenuStyle}
                  profileId={profileData._id}
                  dispatch={dispatch}
                  onClose={() => setIsNotificationMenu(false)}
                  pendingLudoInvites={pendingLudoInvites}
                />
              </div>
            </MegaMC>
          )}
          <li
            onClick={clickProfileBtn}
            className="header-quick-menu-item item-profile"
            title=""
          >
            <div className="profile-pic">
              <img src={ppUrl} alt="" />
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
                        : profileData.user &&
                          profileData.user.firstName +
                            " " +
                            profileData.user.surname}{" "}
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

export default HeaderRight;

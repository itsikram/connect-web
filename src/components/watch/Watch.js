import React, { useState, useEffect, useRef, useCallback } from "react";
import $ from "jquery";
import { useSelector } from "react-redux";
import UserPP from "../UserPP";
import { Link } from "react-router-dom";

import Momemt from "react-moment";
import api from "../../api/api";
import WatchComment from "./WatchComment";
import { confirmAlert } from "react-confirm-alert";
import "react-confirm-alert/src/react-confirm-alert.css"; // Import CSS
import socket from "../../common/socket";
import WatchSkeleton from "../../skletons/watch/WatchSkeleton";
import ImageSkleton from "../../skletons/ImageSkleton";
import { saveVideoFromUrl } from "../../utils/useSavedVideos";
import Rlike from "../../assets/images/reacts/reactLike.svg";
import Rlove from "../../assets/images/reacts/reactLove.svg";
import Rhaha from "../../assets/images/reacts/reactHaha.svg";
import config from "../../config/config.json";
import { useWatchPipOptional } from "../../contexts/WatchPipContext";
import {
  buildPipPayloadFromVideo,
  shouldAutoWatchPip,
} from "../../utils/watchPipHelpers";
import ModalContainer from "../modal/ModalContainer";
import useIsMobile from "../../utils/useIsMobile";
import WatchVideoPlayer from "./WatchVideoPlayer";
import WatchCacheManager from "../../utils/watchCacheManager";
import OptionsDropdown from "../post/OptionsDropdown";
const default_pp_src = config?.defaultProfile;
const APP_PRIMARY_COLOR = "#29B1A9";
const APP_PRIMARY_TINT = "rgba(41, 177, 169, 0.12)";

const Watch = ({ watch, onDelete = null, onUpdate = null, pipPlaylist = [] }) => {
  let myProfile = useSelector((state) => state.profile);
  let myProfileId = myProfile._id;
  let watchAuthorProfileId = watch.author?._id || "";
  let [totalReacts, setTotalReacts] = useState(watch.reacts.length);
  let [totalShares, setTotalShares] = useState(watch.shares.length);
  let [totalComments, setTotalComments] = useState(watch.comments.length);
  let [isActive, setIsActive] = useState(false);
  let [reactType, setReactType] = useState(false);
  let [placedReacts, setPlacedReacts] = useState([]);
  const [imageExists, setImageExists] = useState(false);
  const [watchUrl, setWatchUrl] = useState(watch.videoUrl);
  const [isWatchOption, setIsWatchOption] = useState(false);
  const [isEditCaption, setIsEditCaption] = useState(false);
  const [caption, setCaption] = useState(watch.caption || "");
  const [captionDraft, setCaptionDraft] = useState(watch.caption || "");
  const [isSavingCaption, setIsSavingCaption] = useState(false);
  const [isEditAudienceModal, setIsEditAudienceModal] = useState(false);
  const [selectedAudience, setSelectedAudience] = useState(watch.audience || 1);
  const [isUpdatingAudience, setIsUpdatingAudience] = useState(false);
  const displayedWatch = useRef(null); // document.getElementById(`watch-${watch._id}`)
  const nfwatch = useRef(null); // document.getElementById(`watch-${watch._id}`)
  const watchPip = useWatchPipOptional();
  const skipPipOnUnmount = useRef(false);
  const isMobile = useIsMobile();

  useEffect(() => {
    socket.emit("is_active", {
      profileId: watchAuthorProfileId,
      myId: myProfileId,
    });
    socket.on("is_active", (isUserActive, lastLogin, activeProfileId) => {
      if (activeProfileId === myProfileId) {
        setIsActive(isUserActive);
      }
    });

    return () => socket.off("is_active");
  }, [myProfile, watchAuthorProfileId]);

  useEffect(() => {
    setWatchUrl(watch.videoUrl);
    setCaption(watch.caption || "");
    setCaptionDraft(watch.caption || "");
    setSelectedAudience(watch.audience || 1);
  }, [watch]);

  var isAuth = myProfileId === watchAuthorProfileId;
  var pp_url = "";
  const checkImage = (url) => {
    const img = new Image();
    img.src = url;

    img.onload = () => setImageExists(true);
    img.onerror = () => setImageExists(false);
  };

  const closeWatchOption = useCallback(() => {
    setIsWatchOption(false);
  }, []);

  const watchOptionClick = useCallback((e) => {
    e?.stopPropagation?.();
    setIsWatchOption((prev) => !prev);
  }, []);

  let startEditCaption = useCallback(() => {
    setCaptionDraft(caption);
    setIsEditCaption(true);
    setIsWatchOption(false);
  }, [caption]);

  let cancelEditCaption = useCallback(() => {
    setCaptionDraft(caption);
    setIsEditCaption(false);
  }, [caption]);

  let saveCaption = useCallback(async () => {
    if (!watch?._id) return;
    setIsSavingCaption(true);
    try {
      let res = await api.post("/watch/update", {
        watchId: watch._id,
        caption: captionDraft,
      });
      if (res.status === 200) {
        setCaption(captionDraft);
        setIsEditCaption(false);
        if (typeof onUpdate === "function") {
          onUpdate(watch._id, { caption: captionDraft });
        }
        WatchCacheManager.updateWatch(myProfileId, watch._id, {
          caption: captionDraft,
        });
      } else {
        alert("Failed to update caption");
      }
    } catch (err) {
      console.error("Update caption failed:", err);
      alert("Failed to update caption");
    } finally {
      setIsSavingCaption(false);
    }
  }, [watch._id, captionDraft, onUpdate, myProfileId]);

  let editAudienceClick = useCallback(() => {
    setSelectedAudience(watch.audience || 1);
    setIsEditAudienceModal(true);
    setIsWatchOption(false);
  }, [watch.audience]);

  let onCloseEditAudience = useCallback(() => {
    setIsEditAudienceModal(false);
  }, []);

  let onSaveAudience = useCallback(async () => {
    if (!watch?._id) return;
    setIsUpdatingAudience(true);
    try {
      let res = await api.post("/watch/update", {
        watchId: watch._id,
        audience: selectedAudience,
      });
      if (res.status === 200) {
        setIsEditAudienceModal(false);
        if (typeof onUpdate === "function") {
          onUpdate(watch._id, { audience: selectedAudience });
        }
        WatchCacheManager.updateWatch(myProfileId, watch._id, {
          audience: selectedAudience,
        });
      } else {
        alert("Failed to update audience");
      }
    } catch (error) {
      console.error("Error updating audience:", error);
      alert("Failed to update audience");
    } finally {
      setIsUpdatingAudience(false);
    }
  }, [watch._id, selectedAudience, onUpdate, myProfileId]);

  useEffect(() => {
    let storedReacts = [];
    watch.reacts.map((react) => {
      if (react.profile) {
        switch (react.type) {
          case "like":
            if (!storedReacts.includes("like")) {
              storedReacts.push("like");
            }
            break;
          case "love":
            if (!storedReacts.includes("love")) {
              storedReacts.push("love");
            }
            break;
          case "haha":
            if (!storedReacts.includes("haha")) {
              storedReacts.push("haha");
            }
            break;
        }
        if (react.profile === myProfileId) {
          setReactType(react.type);
        }
      }
    });

    setPlacedReacts(storedReacts);
  }, []);

  // let watchPhoto = watch.photos
  // const checkThumbImage = (url) => {
  //     const img = new Image();
  //     img.src = url;

  //     img.onload = () => setThumbExists(true);
  //     img.onerror = () => setThumbExists(false);
  // };

  // checkThumbImage(watchPhoto)
  // checkImage(pp_url);

  // if (!imageExists) {
  //     pp_url = default_pp_src;
  // }
  let type = watch.type || "watch";

  let hideThisWatch = async (e) => {
    let target = e?.currentTarget;

    if (isAuth) {
      confirmAlert({
        title: "Confirm Action",
        message: "Are you sure you want to delete this watch?",
        buttons: [
          {
            label: "Yes",
            onClick: async () => {
              try {
                const authorId = watch.author?._id || watch.author;
                let deleteRes = await api.post("/watch/delete", {
                  watchId: watch._id,
                  authorId,
                });
                if (deleteRes.status === 200) {
                  WatchCacheManager.removeWatch(myProfileId, watch._id);
                  if (typeof onDelete === "function") {
                    onDelete(watch._id);
                  } else if (target) {
                    $(target).parents(".nf-watch").css({
                      "min-height": "0px",
                      padding: "10px",
                    });
                    $(target)
                      .parents(".nf-watch")
                      .html(
                        '<p class="fs-6 mb-0 text-center text-danger">' +
                          deleteRes.data.message +
                          "</p>",
                      );
                  }
                } else {
                  alert(deleteRes.data?.message || "Failed to delete watch");
                }
              } catch (err) {
                console.error("Delete watch failed:", err);
                const msg =
                  err.response?.data?.message ||
                  err.message ||
                  "Failed to delete watch";
                alert(msg);
              }
            },
          },
          {
            label: "No",
            onClick: () => {},
          },
        ],
      });
    } else if (target) {
      $(target).parents(".nf-watch").hide();
    }
  };

  let deleteFromMenu = (e) => {
    setIsWatchOption(false);
    hideThisWatch(e);
  };

  let removeReact = async (watchType = "watch", target = null) => {
    setTotalReacts((state) => state - 1);

    let res = await api.post("/react/removeReact", {
      id: watch._id,
      watchType: "watch",
    });
    if (res.status === 200) {
      setTotalReacts(res.data.reacts.length);

      setReactType("");
      return true;
    } else {
      return false;
    }
  };
  let placeReact = async (reactType, watchType = "watch", target = null) => {
    setTotalReacts((state) => state + 1);

    let placeRes = await api.post("/react/addReact", {
      id: watch._id,
      watchType,
      reactType,
    });
    if (placeRes.status === 200) {
      setTotalReacts(placeRes.data.reacts.length);
      setPlacedReacts([...placedReacts, reactType]);
      setReactType(reactType);

      return true;
    } else {
      return false;
    }
  };

  let likeBtnOnClick = async (e) => {
    let target = e.currentTarget;
    if ($(target).parent().hasClass("reacted")) {
      removeReact("watch");
      $(target).parent().removeClass("reacted");
    } else {
      placeReact("like", "watch", target);
      $(target).parent().addClass("reacted");
    }
  };

  let likeOnClick = async (e) => {
    let target = e.currentTarget;
    $(target).parents(".watch-react-container").css("visibility", "hidden");
    if ($(target).hasClass("reacted")) {
      removeReact("watch");
      $(target).removeClass("reacted");
    } else {
      placeReact("like", "watch", target);
      $(target).addClass("reacted");
      $(e.currentTarget).siblings().removeClass("reacted");
    }
    setTimeout(() => {
      $(target).parents(".watch-react-container").css("visibility", "visible");
    }, 500);
  };

  let loveOnClick = (e) => {
    let target = e.currentTarget;
    $(target).parents(".watch-react-container").css("visibility", "hidden");
    if ($(e.currentTarget).hasClass("reacted")) {
      removeReact("watch");
      $(e.currentTarget).removeClass("reacted");
    } else {
      placeReact("love", "watch");
      $(e.currentTarget).siblings().removeClass("reacted");
      $(e.currentTarget).addClass("reacted");
    }
    setTimeout(() => {
      $(target).parents(".watch-react-container").css("visibility", "visible");
    }, 500);
  };

  let hahaOnClick = (e) => {
    let target = e.currentTarget;
    $(target).parents(".watch-react-container").css("visibility", "hidden");

    if ($(e.currentTarget).hasClass("reacted")) {
      removeReact();
      $(e.currentTarget).removeClass("reacted");
    } else {
      placeReact("haha", "watch", target);
      $(e.currentTarget).siblings().removeClass("reacted");

      $(e.currentTarget).addClass("reacted");
    }
    setTimeout(() => {
      $(target).parents(".watch-react-container").css("visibility", "visible");
    }, 500);
  };

  let likeMouseOver = (e) => {
    let target = e.currentTarget;
    $(target).children(".watch-react-container").css("visibility", "visible");
  };
  let commentOnClick = (e) => {
    let target = e.currentTarget;

    $(target).parents(".footer").find(".field-comment-text").focus();
  };
  let shareOnClick = (e) => {};

  let authProfilePicture = useSelector((state) => state.profile.profilePic);
  let authProfileId = useSelector((state) => state.profile._id);

  let watchAuthorPP = `${watch?.author.profilePic}`;

  const getPipMeta = useCallback(
    () => ({
      watchId: watch._id,
      videoUrl: watchUrl || watch.videoUrl,
      title: caption || `${watch?.author?.user?.firstName || "Watch"}`,
      thumbnail: watch.thumbnail || "",
      playlist: (() => {
        const current = {
          id: String(watch._id),
          watchId: String(watch._id),
          url: watchUrl || watch.videoUrl,
          title: caption || `${watch?.author?.user?.firstName || "Watch"}`,
          thumbnail: watch.thumbnail || "",
          playCount: 1,
        };
        const feed = Array.isArray(pipPlaylist) ? pipPlaylist.filter((item) => item?.url) : [];
        if (!current.url) return feed;
        if (feed.some((item) => String(item.id) === current.id || String(item.watchId) === current.id)) {
          return feed;
        }
        return [current, ...feed];
      })(),
    }),
    [watch, watchUrl, caption, pipPlaylist],
  );

  const minimizeToPip = useCallback(() => {
    if (!watchPip?.startPip || !displayedWatch.current) return;
    const payload = buildPipPayloadFromVideo(
      displayedWatch.current,
      getPipMeta(),
    );
    if (!payload) return;
    skipPipOnUnmount.current = true;
    displayedWatch.current.pause();
    watchPip.startPip({ ...payload, playing: true });
  }, [watchPip, getPipMeta]);

  // Auto PiP only on route unmount. Lock / Home Screen uses background audio.
  useEffect(() => {
    return () => {
      if (
        !skipPipOnUnmount.current &&
        shouldAutoWatchPip() &&
        watchPip?.startPip
      ) {
        const video = displayedWatch.current;
        if (video && !video.paused && !video.ended) {
          const payload = buildPipPayloadFromVideo(video, getPipMeta());
          if (payload) watchPip.startPip(payload);
        }
      }
    };
  }, [watchPip, getPipMeta]);

  let handleDownloadVideoClick = useCallback(
    (e) => {
      e?.preventDefault?.();
      e?.stopPropagation?.();
      if (!watch?.videoUrl) return;
      saveVideoFromUrl(watch._id, watch.videoUrl, watch);
    },
    [watch],
  );

  const isThisPip = watchPip?.pip?.watchId === watch._id;

  return (
    <>
      <div ref={nfwatch} className={`nf-watch ${type}`}>
        <div className="header">
          {type === "profilePic" && (
            <div className="reason">
              <span className="d-none">
                <b>A bitch</b> commented.
              </span>

              <span>Updated Profile Picture</span>
            </div>
          )}
          <div className="author-info">
            <div className="left">
              <div className="author-pp">
                <UserPP
                  profilePic={watchAuthorPP}
                  profile={watch.author._id}
                  active={watch.author.isActive}
                ></UserPP>
              </div>
              <div className="watch-nd-container">
                <Link to={"/" + watch.author._id}>
                  <h4 className="author-name">
                    {watch.author.user.firstName +
                      " " +
                      watch.author.user.surname}
                  </h4>
                </Link>
                <span className="watch-time">
                  <Momemt fromNow>{watch.createdAt}</Momemt>
                </span>
              </div>
            </div>
            <div className="right">
              <button
                onClick={handleDownloadVideoClick}
                className="watch-three-dot"
                title="Download"
              >
                <i className="fas fa-download"></i>
              </button>
              <OptionsDropdown
                open={isWatchOption}
                onToggle={watchOptionClick}
                onClose={closeWatchOption}
                buttonClassName="watch-three-dot"
                menuClassName="watch-option-menu"
                ariaLabel="Video options"
              >
                <ul>
                  {isAuth && (
                    <>
                      <li onClick={startEditCaption}>Edit Video</li>
                      <li onClick={editAudienceClick}>Edit Audience</li>
                      <li onClick={deleteFromMenu}>Delete Video</li>
                    </>
                  )}
                  {!isAuth && (
                    <li onClick={closeWatchOption}>Report This Video</li>
                  )}
                </ul>
              </OptionsDropdown>

              <button
                onClick={hideThisWatch.bind(this)}
                className="watch-close"
              >
                {" "}
                <i className="far fa-times"></i>
              </button>
            </div>
          </div>
        </div>
        <div className="body">
          {isEditCaption && isAuth ? (
            <div className="watch-caption-editor">
              <textarea
                className="form-control caption-editor mb-2"
                value={captionDraft}
                onChange={(e) => setCaptionDraft(e.target.value)}
                rows={3}
                maxLength={500}
                placeholder="Write a caption..."
              />
              <div className="watch-caption-editor-actions">
                <button
                  type="button"
                  className="btn btn-secondary btn-sm me-2"
                  onClick={cancelEditCaption}
                  disabled={isSavingCaption}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={saveCaption}
                  disabled={isSavingCaption}
                >
                  {isSavingCaption ? "Saving..." : "Save"}
                </button>
              </div>
            </div>
          ) : (
            <p className="caption">{caption}</p>
          )}
          {watchUrl ? (
            <WatchVideoPlayer
              watchId={watch._id}
              videoUrl={watchUrl}
              thumbnail={watch?.thumbnail}
              videoRef={displayedWatch}
              isPipActive={isThisPip}
              onRestorePip={() => watchPip?.closePip?.()}
              showPipButton={!!watchPip}
              onMinimizePip={minimizeToPip}
            />
          ) : (
            <ImageSkleton />
          )}
        </div>
        <div className="footer">
          <div className="react-count">
            <div className="reacts">
              {placedReacts.includes("like") ? (
                <div className="react">
                  {" "}
                  <img src={Rlike} alt="like" />{" "}
                </div>
              ) : (
                <span></span>
              )}
              {placedReacts.includes("love") ? (
                <div className="react">
                  {" "}
                  <img src={Rlove} alt="love" />{" "}
                </div>
              ) : (
                <span></span>
              )}
              {placedReacts.includes("haha") ? (
                <div className="react">
                  {" "}
                  <img src={Rhaha} alt="love" />{" "}
                </div>
              ) : (
                <span></span>
              )}

              <span className="text">
                {watch.reacts && totalReacts}{" "}
                {totalReacts > 1 ? "Reacts" : "React"}
              </span>
            </div>
            <div className="comment-share">
              <div className="comment">
                <div className="text">{watch.comments && totalComments}</div>
                <div className="icon">
                  <i className="far fa-comment-alt"></i>
                </div>
              </div>
              <div className="shares">
                <div className="text">{watch.shares && totalShares}</div>
                <div className="icon">
                  <i className="fa fa-share"></i>
                </div>
              </div>
            </div>
          </div>
          <div className="like-comment-share">
            <div className="buttons-container">
              <div
                className={`react-buttons button ${reactType ? "reacted" : ""}`}
              >
                <div
                  onClick={likeBtnOnClick}
                  onMouseOver={likeMouseOver}
                  className={`react-like ${reactType == true ? "reacted" : ""}`}
                >
                  <span className="react-icon" datatype={reactType || ""}>
                    {reactType == "haha" ? (
                      <img src={Rhaha} alt="haha" />
                    ) : (
                      <span></span>
                    )}
                    {reactType == "love" ? (
                      <img src={Rlove} alt="love" />
                    ) : (
                      <span></span>
                    )}
                    {reactType == false || reactType == "like" ? (
                      <img src={Rlike} alt="like" />
                    ) : (
                      <span></span>
                    )}
                  </span>
                  <span className="text text-capitalize">
                    {reactType ? reactType : "like"}
                  </span>
                </div>
                <div className="watch-react-container">
                  <div
                    className={`react react-like ${reactType == "like" ? "reacted" : ""}`}
                    onClick={likeOnClick}
                    id="watchReactLike"
                    title="Like"
                  >
                    <img src={Rlike} alt="love" />
                  </div>
                  <div
                    className={`react react-love ${reactType == "love" ? "reacted" : ""}`}
                    onClick={loveOnClick}
                    id="watchReactLove"
                    title="Love"
                  >
                    <img src={Rlove} alt="love" />
                  </div>
                  <div
                    className={`react react-haha ${reactType == "haha" ? "reacted" : ""}`}
                    onClick={hahaOnClick}
                    id="watchReactHaha"
                    title="Haha"
                  >
                    <img src={Rhaha} alt="haha" />
                  </div>
                </div>
              </div>
              <div onClick={commentOnClick} className="comment button">
                <span className="icon">
                  <i className="far fa-comment-alt"></i>
                </span>
                <span className="text">Comment</span>
              </div>
              <div onClick={shareOnClick} className="share button">
                <span className="icon">
                  <i className="far fa-share"></i>
                </span>
                <span className="text">Share</span>
              </div>
            </div>
          </div>
          <WatchComment
            watch={watch}
            commentState={setTotalComments}
            myProfile={myProfile}
            authProfile={authProfileId}
            authProfilePicture={authProfilePicture}
          ></WatchComment>
        </div>
      </div>

      <ModalContainer
        title="Edit Audience"
        style={{ width: isMobile ? "95%" : "500px", top: "50%" }}
        isOpen={isEditAudienceModal}
        onRequestClose={onCloseEditAudience}
        id="edit-watch-audience-modal"
      >
        <div className="modal-header">
          <h3 className="modal-title">Edit Audience</h3>
          <div
            onClick={onCloseEditAudience}
            className="modal-close-btn text-danger"
          >
            <i className="far fa-times"></i>
          </div>
        </div>
        <div className="modal-body">
          <div className="edit-audience-container">
            <p className="mb-3">Who can see this video?</p>
            <div className="audience-options">
              <div
                className={`audience-option ${selectedAudience === 1 ? "selected" : ""}`}
                onClick={() => setSelectedAudience(1)}
                style={{
                  padding: "12px",
                  margin: "8px 0",
                  border:
                    selectedAudience === 1
                      ? `2px solid ${APP_PRIMARY_COLOR}`
                      : "1px solid #ddd",
                  borderRadius: "8px",
                  cursor: "pointer",
                  backgroundColor:
                    selectedAudience === 1 ? APP_PRIMARY_TINT : "#fff",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <i
                    className="far fa-globe"
                    style={{ fontSize: "20px", color: APP_PRIMARY_COLOR }}
                  ></i>
                  <div>
                    <strong>Public</strong>
                    <p className="mb-0 text-muted" style={{ fontSize: "14px" }}>
                      Anyone can see this video
                    </p>
                  </div>
                  {selectedAudience === 1 && (
                    <i
                      className="far fa-check-circle"
                      style={{
                        marginLeft: "auto",
                        color: APP_PRIMARY_COLOR,
                        fontSize: "20px",
                      }}
                    ></i>
                  )}
                </div>
              </div>
              <div
                className={`audience-option ${selectedAudience === 2 ? "selected" : ""}`}
                onClick={() => setSelectedAudience(2)}
                style={{
                  padding: "12px",
                  margin: "8px 0",
                  border:
                    selectedAudience === 2
                      ? `2px solid ${APP_PRIMARY_COLOR}`
                      : "1px solid #ddd",
                  borderRadius: "8px",
                  cursor: "pointer",
                  backgroundColor:
                    selectedAudience === 2 ? APP_PRIMARY_TINT : "#fff",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <i
                    className="far fa-user-friends"
                    style={{ fontSize: "20px", color: APP_PRIMARY_COLOR }}
                  ></i>
                  <div>
                    <strong>Friends</strong>
                    <p className="mb-0 text-muted" style={{ fontSize: "14px" }}>
                      Only your friends can see this video
                    </p>
                  </div>
                  {selectedAudience === 2 && (
                    <i
                      className="far fa-check-circle"
                      style={{
                        marginLeft: "auto",
                        color: APP_PRIMARY_COLOR,
                        fontSize: "20px",
                      }}
                    ></i>
                  )}
                </div>
              </div>
              <div
                className={`audience-option ${selectedAudience === 3 ? "selected" : ""}`}
                onClick={() => setSelectedAudience(3)}
                style={{
                  padding: "12px",
                  margin: "8px 0",
                  border:
                    selectedAudience === 3
                      ? `2px solid ${APP_PRIMARY_COLOR}`
                      : "1px solid #ddd",
                  borderRadius: "8px",
                  cursor: "pointer",
                  backgroundColor:
                    selectedAudience === 3 ? APP_PRIMARY_TINT : "#fff",
                }}
              >
                <div
                  style={{ display: "flex", alignItems: "center", gap: "12px" }}
                >
                  <i
                    className="far fa-lock"
                    style={{ fontSize: "20px", color: APP_PRIMARY_COLOR }}
                  ></i>
                  <div>
                    <strong>Only Me</strong>
                    <p className="mb-0 text-muted" style={{ fontSize: "14px" }}>
                      Only you can see this video
                    </p>
                  </div>
                  {selectedAudience === 3 && (
                    <i
                      className="far fa-check-circle"
                      style={{
                        marginLeft: "auto",
                        color: APP_PRIMARY_COLOR,
                        fontSize: "20px",
                      }}
                    ></i>
                  )}
                </div>
              </div>
            </div>
            <div className="edit-audience-button text-end mt-3">
              <button
                className="btn btn-secondary me-2"
                onClick={onCloseEditAudience}
                disabled={isUpdatingAudience}
              >
                Cancel
              </button>
              <button
                className="btn btn-primary"
                onClick={onSaveAudience}
                disabled={isUpdatingAudience}
              >
                {isUpdatingAudience ? "Saving..." : "Save"}
              </button>
            </div>
          </div>
        </div>
      </ModalContainer>
    </>
  );
};

export default React.memo(Watch, (prev, next) => {
  const a = prev.watch;
  const b = next.watch;
  return (
    prev.type === next.type &&
    a?._id === b?._id &&
    a?.videoUrl === b?.videoUrl &&
    a?.caption === b?.caption &&
    a?.thumbnail === b?.thumbnail &&
    a?.audience === b?.audience &&
    (a?.reacts?.length || 0) === (b?.reacts?.length || 0) &&
    (a?.comments?.length || 0) === (b?.comments?.length || 0) &&
    (a?.shares?.length || 0) === (b?.shares?.length || 0)
  );
});

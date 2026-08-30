import React, { useEffect, useState, useCallback, useMemo } from "react";

import { useParams, useLocation, useNavigate } from "react-router-dom";
import api from "../../api/api";
import $ from "jquery";
import { useSelector } from "react-redux";
import UserPP from "../UserPP";
import { Link } from "react-router-dom";
import { Container } from "react-bootstrap";
import ImageSkleton from "../../skletons/post/ImageSkleton";
import SinglePostSkeleton from "../../skletons/post/SinglePostSkeleton";
import ModalContainer from "../modal/ModalContainer";
import useIsMobile from "../../utils/useIsMobile";
import isValidUrl from "../../utils/isValiUrl";
import Momemt from "react-moment";
import PostComment from "./PostComment";
import SingleReactor from "./SingleReactor";
import { confirmAlert } from "react-confirm-alert";
import "react-confirm-alert/src/react-confirm-alert.css";
import checkImgLoading from "../../utils/checkImgLoading";
import { showSuccessToast, showErrorToast } from "../../utils/toastUtils";
import Rlike from "../../assets/images/reacts/reactLike.svg";
import Rlove from "../../assets/images/reacts/reactLove.svg";
import Rhaha from "../../assets/images/reacts/reactHaha.svg";
import config from "../../config/config.json";
import "./PostCard.css";
import "./SharePostModal.css";
import "./CommentStyles.css";
import "./SinglePost.css";
import OptionsDropdown from "./OptionsDropdown";
const default_pp_src = config?.defaultProfile;

const SinglePost = () => {
  let { postId } = useParams();
  let [postData, setPostData] = useState(false);
  let [isShareModal, setIsShareModal] = useState(false);
  let [shareCap, setShareCap] = useState(false);
  let [isLoaded, setIsloaded] = useState(false);
  let isMobile = useIsMobile();
  let navigate = useNavigate();
  const location = useLocation();
  const isEditMode = location.pathname.includes("edit");

  let loadData = async () => {
    let res = await api.get("post/single", { params: { postId } });
    if (res.status == 200) {
      const comments = Array.isArray(res.data?.comments)
        ? res.data.comments
        : [];
      setPostData(res.data);
      setAllComments(comments);
      setTotalComments(comments.length);
    }
  };

  useEffect(() => {
    setPostData(false);
    loadData();
  }, [postId]);

  let myProfile = useSelector((state) => state.profile);
  let myProfileId = myProfile._id;
  let postAuthorProfileId = postData && postData?.author._id;
  let [totalReacts, setTotalReacts] = useState(
    postData && postData.reacts.length,
  );
  let [totalShares, setTotalShares] = useState(
    postData && postData.shares.length,
  );
  let [totalComments, setTotalComments] = useState(
    postData && postData.comments.length,
  );
  let [allComments, setAllComments] = useState(postData?.comments || []);
  let [reactType, setReactType] = useState(false);
  let [placedReacts, setPlacedReacts] = useState([]);

  useEffect(() => {
    setTotalReacts(postData && postData.reacts.length);
    setTotalShares(postData && postData.shares.length);
    setTotalComments(postData && postData.comments.length);
    setAllComments(postData?.comments || []);
  }, [postData]);

  var isAuth = myProfileId === postAuthorProfileId ? true : false;
  let [ppUrl, setPpUrl] = useState(
    (postData && postData?.author.profilePic) || default_pp_src,
  );

  let postPhoto = postData && postData.photos;
  useEffect(() => {
    checkImgLoading(postPhoto, setIsloaded);
    // checkImgLoading(postPhoto, setIsloaded)
  }, [postPhoto]);

  useEffect(() => {
    let storedReacts = [];
    postData &&
      postData.reacts.map((react) => {
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
  let type = postData && (postData.type || "post");

  let hideThisPost = async (e) => {
    let target = e.currentTarget;

    if (isAuth) {
      confirmAlert({
        title: "Confirm Action",
        message: "Are you sure you want to delete this post?",
        buttons: [
          {
            label: "Yes",
            onClick: async () => {
              let deleteRes = await api.post("/post/delete", {
                postId: postData._id,
                authorId: postData.author._id,
              });
              if (deleteRes.status === 200) {
                $(target).parents(".nf-post").css({
                  "min-height": "0px",
                  padding: "10px",
                });
                $(target)
                  .parents(".nf-post")
                  .html(
                    '<p class="fs-6 mb-0 text-center text-danger">' +
                      deleteRes.data.message +
                      "</p>",
                  );
              } else {
                alert("Failed to delete post");
              }
            },
          },
          {
            label: "No",
            onClick: () => {},
          },
        ],
      });
    } else {
      $(target).parents(".nf-post").hide();
    }
  };

  let removeReact = async (postType = "post", target = null) => {
    setTotalReacts((state) => state - 1);

    let res = await api.post("/react/removeReact", {
      id: postData._id,
      postType: "post",
    });
    if (res.status === 200) {
      setTotalReacts(res.data.reacts.length);

      setReactType("");
      return true;
    } else {
      return false;
    }
  };
  let placeReact = async (reactType, postType = "post", target = null) => {
    setTotalReacts((state) => state + 1);

    let placeRes = await api.post("/react/addReact", {
      id: postData._id,
      postType,
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
      removeReact("post");
      $(target).parent().removeClass("reacted");
    } else {
      placeReact("like", "post", target);
      $(target).parent().addClass("reacted");
    }
  };

  let likeOnClick = async (e) => {
    let target = e.currentTarget;
    $(target).parents(".post-react-container").css("visibility", "hidden");
    if ($(target).hasClass("reacted")) {
      removeReact("post");
      $(target).removeClass("reacted");
    } else {
      placeReact("like", "post", target);
      $(target).addClass("reacted");
      $(e.currentTarget).siblings().removeClass("reacted");
    }
    setTimeout(() => {
      $(target).parents(".post-react-container").css("visibility", "visible");
    }, 500);
  };

  let loveOnClick = (e) => {
    let target = e.currentTarget;
    $(target).parents(".post-react-container").css("visibility", "hidden");
    if ($(e.currentTarget).hasClass("reacted")) {
      removeReact("post");
      $(e.currentTarget).removeClass("reacted");
    } else {
      placeReact("love", "post");
      $(e.currentTarget).siblings().removeClass("reacted");
      $(e.currentTarget).addClass("reacted");
    }
    setTimeout(() => {
      $(target).parents(".post-react-container").css("visibility", "visible");
    }, 500);
  };

  let hahaOnClick = (e) => {
    let target = e.currentTarget;
    $(target).parents(".post-react-container").css("visibility", "hidden");

    if ($(e.currentTarget).hasClass("reacted")) {
      removeReact();
      $(e.currentTarget).removeClass("reacted");
    } else {
      placeReact("haha", "post", target);
      $(e.currentTarget).siblings().removeClass("reacted");

      $(e.currentTarget).addClass("reacted");
    }
    setTimeout(() => {
      $(target).parents(".post-react-container").css("visibility", "visible");
    }, 500);
  };

  let likeMouseOver = (e) => {
    let target = e.currentTarget;
    $(target).children(".post-react-container").css("visibility", "visible");
  };
  let commentOnClick = (e) => {
    let target = e.currentTarget;
    $(target).parents(".footer").find(".field-comment-text").focus();
  };

  let shareOnClick = (e) => {
    setIsShareModal(true);
  };

  let onCloseShareReq = () => {
    setIsShareModal(false);
  };
  let handleShareCapChange = (e) => {
    let newCaption = e.currentTarget.value;
    setShareCap(newCaption);
  };
  let onClickShareNow = async (e) => {
    e.preventDefault();
    let res = await api.post("post/share", {
      postId: postData._id,
      caption: shareCap,
    });
    setTotalShares((state) => state + 1);
    if (res.status == 200) {
      setIsShareModal(false);
    } else {
      setTotalShares(postData && postData.shares.length);
    }
  };

  let gotoEdit = () => {
    navigate("edit");
  };
  let gotoBack = () => {
    navigate(`/post/${postId}`);
  };

  const [isPostOption, setIsPostOption] = useState(false);
  const closePostOption = useCallback(() => {
    setIsPostOption(false);
  }, []);
  const postOptionClick = useCallback(() => {
    setIsPostOption((prev) => !prev);
  }, []);

  let authProfilePicture = useSelector((state) => state.profile.profilePic);
  let authProfileId = useSelector((state) => state.profile._id);

  let postAuthorPP = `${postData && postData?.author.profilePic}`;
  let [match, setMatch] = useState(
    window.matchMedia("(max-width: 768px)").matches,
  );

  useEffect(() => {
    // window width
    window.matchMedia("(max-width:768px)").addEventListener("change", (e) => {
      setMatch(e.matches);
    });
  }, []);

  let [newCaption, setNewCaption] = useState("");
  const [isSavingCaption, setIsSavingCaption] = useState(false);
  const originalCaption = postData?.caption || "";
  const hasCaptionChanges = newCaption !== originalCaption;

  useEffect(() => {
    if (postData && postData.caption !== undefined) {
      setNewCaption(postData.caption || "");
    }
  }, [postData?._id]);

  const handleEditCaption = useCallback((e) => {
    setNewCaption(e.target.value);
  }, []);

  const cancelEditCaption = useCallback(() => {
    setNewCaption(originalCaption);
  }, [originalCaption]);

  const updateCaption = useCallback(async () => {
    if (!hasCaptionChanges || isSavingCaption) return;

    setIsSavingCaption(true);
    try {
      const res = await api.post("/post/update", {
        postId,
        caption: newCaption,
      });

      if (res.status === 200) {
        setPostData((prev) => ({ ...prev, caption: newCaption }));
        showSuccessToast("Caption updated");
      }
    } catch (error) {
      showErrorToast("Could not update caption. Please try again.");
    } finally {
      setIsSavingCaption(false);
    }
  }, [postId, newCaption, hasCaptionChanges, isSavingCaption]);

  const handleCaptionKeyDown = useCallback(
    (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        updateCaption();
      }
    },
    [updateCaption],
  );
  let PostContent = () => {
    switch (postData.type) {
      case "share":
        return (
          <div className="share-nf-post nf-post">
            <div className="header">
              <div className="reason">
                <span className="fs-5">
                  <b>
                    <Link to={`/${postData.author._id}`}>
                      {postData.author.fullName}
                    </Link>
                  </b>{" "}
                  Shared{" "}
                  <b>
                    <Link to={`/${postData.parentPost?.author?._id}`}>
                      {postData.parentPost?.author?.fullName}'s
                    </Link>{" "}
                  </b>
                  <span className="text-capitalize">
                    {postData.parentPost?.type}
                  </span>
                </span>
              </div>
              <div className="author-info">
                <div className="left">
                  <div className="author-pp">
                    <UserPP
                      profilePic={postData.author.profilePic}
                      profile={postData.author._id}
                      active={postData.author.isActive}
                    ></UserPP>
                  </div>
                  <div className="post-nd-container">
                    <Link to={"/" + postData.author._id}>
                      <h4 className="author-name">
                        {postData.author.fullName}
                      </h4>

                      {postData.feelings && (
                        <span className="post-feelings">
                          {" "}
                          <small className="feelings-label">
                            is feeling
                          </small>{" "}
                          <strong className="feelings-value">
                            {postData.feelings}
                          </strong>
                        </span>
                      )}

                      {postData.location && (
                        <span className="post-location">
                          {" "}
                          <small className="text-lowercase text-secondary">
                            {" "}
                            at
                          </small>{" "}
                          {postData.location || ""}
                        </span>
                      )}
                    </Link>
                    <span className="post-time">
                      <Momemt fromNow>{postData.createdAt}</Momemt>
                    </span>
                  </div>
                </div>
                <div className="right">
                  <OptionsDropdown
                    open={isPostOption}
                    onToggle={postOptionClick}
                    onClose={closePostOption}
                    ariaLabel="Post options"
                  >
                    <ul>
                      {isAuth && (
                        <li
                          onClick={() => {
                            closePostOption();
                            gotoEdit();
                          }}
                        >
                          Edit Post
                        </li>
                      )}
                      <li onClick={closePostOption}>Report This Post</li>
                    </ul>
                  </OptionsDropdown>

                  <button
                    onClick={hideThisPost.bind(this)}
                    className="post-close"
                  >
                    {" "}
                    <i className="far fa-times"></i>
                  </button>
                </div>
              </div>
            </div>

            <div className={`nf-post ${type} m-3 border body overflow-hidden`}>
              <div className="header">
                {type === "profilePic" && (
                  <div className="reason">
                    <span className="d-none">
                      <b>Shared a photos</b>
                    </span>

                    <span>
                      <span className="reason-badge">
                        <i className="fas fa-camera" aria-hidden="true"></i>{" "}
                        Updated profile picture
                      </span>
                    </span>
                  </div>
                )}
                <div className="author-info">
                  <div className="left">
                    <div className="author-pp">
                      <UserPP
                        profilePic={postData.parentPost?.author?.profilePic}
                        profile={postData.parentPost?.author?._id}
                      ></UserPP>
                    </div>
                    <div className="post-nd-container">
                      <Link to={"/" + postData.author._id}>
                        <h4 className="author-name">
                          {postData.parentPost?.author?.fullName}
                        </h4>
                        {postData.feelings && (
                          <span className="post-feelings">
                            {" "}
                            <small className="feelings-label">
                              is feeling
                            </small>{" "}
                            <strong className="feelings-value">
                              {postData.feelings}
                            </strong>
                          </span>
                        )}

                        {postData.location && (
                          <span className="post-location">
                            {" "}
                            <small className="text-lowercase text-secondary">
                              {" "}
                              at
                            </small>{" "}
                            {postData.location || ""}
                          </span>
                        )}
                      </Link>
                      <span className="post-time">
                        <Momemt fromNow>
                          {postData.parentPost?.createdAt}
                        </Momemt>
                      </span>
                    </div>
                  </div>
                  <div className="right"></div>
                </div>
              </div>
              <p className="caption">{postData.caption}</p>
              <div className="body">
                <p className="caption">{postData.parentPost?.caption}</p>
                {isLoaded ? (
                  <>
                    <div className="attachment">
                      <Link to={`/post/${postData._id}`}>
                        <img src={postPhoto} alt="post" />
                      </Link>
                    </div>
                  </>
                ) : (
                  <>{isValidUrl(postPhoto) && <ImageSkleton />}</>
                )}
              </div>
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
                    {postData.reacts && totalReacts}{" "}
                    {totalReacts > 1 ? "Reacts" : "React"}
                  </span>
                </div>
                <div className="comment-share">
                  <div className="comment">
                    <div className="text">
                      {postData.comments && totalComments}
                    </div>
                    <div className="icon">
                      <i className="far fa-comment-alt"></i>
                    </div>
                  </div>
                  <div className="shares">
                    <div className="text">{postData.shares && totalShares}</div>
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
                    <div className="post-react-container">
                      <div
                        className={`react react-like ${reactType == "like" ? "reacted" : ""}`}
                        onClick={likeOnClick}
                        id="postReactLike"
                        title="Like"
                      >
                        <img src={Rlike} alt="love" />
                      </div>
                      <div
                        className={`react react-love ${reactType == "love" ? "reacted" : ""}`}
                        onClick={loveOnClick}
                        id="postReactLove"
                        title="Love"
                      >
                        <img src={Rlove} alt="love" />
                      </div>
                      <div
                        className={`react react-haha ${reactType == "haha" ? "reacted" : ""}`}
                        onClick={hahaOnClick}
                        id="postReactHaha"
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
                  <ModalContainer
                    title="View Cover Photo"
                    style={{ width: isMobile ? "95%" : "600px", top: "50%" }}
                    isOpen={isShareModal}
                    onRequestClose={onCloseShareReq}
                    id="cp-view-modal"
                  >
                    <div className="modal-header">
                      <div></div>
                      <div
                        onClick={onCloseShareReq}
                        className="modal-close-btn text-danger"
                      >
                        <i className="far fa-times"></i>
                      </div>
                    </div>

                    <div className="modal-body">
                      <div className="share-post-container">
                        <div className="share-post-header">
                          <div className="share-post-user">
                            <div className="share-post-avatar">
                              <UserPP
                                profilePic={myProfile.profilePic}
                                profile={myProfile._id}
                              />
                            </div>
                            <div className="share-post-user-meta">
                              <h3
                                className="share-post-name"
                                title={myProfile.fullName}
                              >
                                {myProfile.fullName}
                              </h3>
                              <p className="share-post-context">
                                You're sharing{" "}
                                {postData.author.fullName || "Someone"}'s post
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="share-post-body">
                          <textarea
                            className="form-control"
                            rows="3"
                            onChange={handleShareCapChange.bind(this)}
                            placeholder="What's on your mind?"
                          ></textarea>
                          <div className="share-post-button">
                            <button
                              className="btn btn-primary"
                              onClick={onClickShareNow}
                            >
                              Share Now
                            </button>
                          </div>
                        </div>
                      </div>
                    </div>
                  </ModalContainer>
                </div>
              </div>
              {/* <PostComment post={postData} commentState={setTotalComments} myProfile={myProfile} authProfile={authProfileId} authProfilePicture={authProfilePicture}></PostComment> */}
            </div>
          </div>
        );
        break;

      default:
        return (
          <div className={`nf-post ${type}`}>
            <div className="header">
              {type === "profilePic" && (
                <div className="reason">
                  <span className="d-none">
                    <b>A bitch</b> commented.
                  </span>

                  <span>
                    <span className="reason-badge">
                      <i className="fas fa-camera" aria-hidden="true"></i>{" "}
                      Updated profile picture
                    </span>
                  </span>
                </div>
              )}
              <div className="author-info">
                <div className="left">
                  <div className="author-pp">
                    <UserPP
                      profilePic={postAuthorPP}
                      profile={postData.author._id}
                      active={postData.author.isActive}
                    ></UserPP>
                  </div>
                  <div className="post-nd-container">
                    <h4 className="author-name">
                      <Link to={"/" + postData.author._id}>
                        {postData.author.fullName}
                      </Link>

                      {(postData.feelings || postData.fellings) && (
                        <span className="post-feelings">
                          {" "}
                          <small className="feelings-label">
                            is feeling
                          </small>{" "}
                          <strong className="feelings-value">
                            {postData.feelings || postData.fellings}
                          </strong>
                        </span>
                      )}

                      {postData.location && (
                        <span className="post-location">
                          {" "}
                          <small className="text-lowercase text-secondary">
                            {" "}
                            at
                          </small>{" "}
                          {postData.location || ""}
                        </span>
                      )}
                    </h4>
                    <span className="post-time">
                      <Momemt fromNow>{postData.createdAt}</Momemt>
                    </span>
                  </div>
                </div>
                <div className="right">
                  {!isEditMode && (
                    <OptionsDropdown
                      open={isPostOption}
                      onToggle={postOptionClick}
                      onClose={closePostOption}
                      ariaLabel="Post options"
                    >
                      <ul>
                        {isAuth && (
                          <li
                            onClick={() => {
                              closePostOption();
                              gotoEdit();
                            }}
                          >
                            Edit Post
                          </li>
                        )}
                        <li onClick={closePostOption}>Report This Post</li>
                      </ul>
                    </OptionsDropdown>
                  )}
                  {isEditMode && (
                    <button
                      type="button"
                      onClick={gotoBack}
                      className="post-three-dot"
                      aria-label="Back to post"
                    >
                      <i className="fas fa-arrow-left"></i>
                    </button>
                  )}

                  <button
                    onClick={hideThisPost.bind(this)}
                    className="post-close"
                  >
                    {" "}
                    <i className="far fa-times"></i>
                  </button>
                </div>
              </div>
            </div>
            <div className="body">
              {isAuth && isEditMode ? (
                <div className="sp-caption-editor">
                  <div className="sp-caption-editor-head">
                    <label
                      className="sp-caption-editor-label"
                      htmlFor="sp-caption-input"
                    >
                      Caption
                    </label>
                    <span className="sp-caption-editor-hint">
                      Ctrl + Enter to save
                    </span>
                  </div>
                  <textarea
                    id="sp-caption-input"
                    className="sp-caption-editor-input"
                    onChange={handleEditCaption}
                    onKeyDown={handleCaptionKeyDown}
                    placeholder="Write a caption..."
                    value={newCaption}
                    rows={4}
                    maxLength={500}
                    disabled={isSavingCaption}
                  />
                  <div className="sp-caption-editor-footer">
                    <span
                      className={`sp-caption-editor-count${
                        newCaption.length >= 480
                          ? " sp-caption-editor-count--warn"
                          : ""
                      }`}
                    >
                      {newCaption.length}/500
                    </span>
                    <div className="sp-caption-editor-actions">
                      <button
                        type="button"
                        className="sp-caption-btn sp-caption-btn--ghost"
                        onClick={cancelEditCaption}
                        disabled={isSavingCaption || !hasCaptionChanges}
                      >
                        Reset
                      </button>
                      <button
                        type="button"
                        className="sp-caption-btn sp-caption-btn--primary"
                        onClick={updateCaption}
                        disabled={isSavingCaption || !hasCaptionChanges}
                      >
                        {isSavingCaption ? "Saving..." : "Update"}
                      </button>
                    </div>
                  </div>
                </div>
              ) : (
                <p className="caption">{postData.caption}</p>
              )}

              {isLoaded ? (
                <>
                  <div className="attachment">
                    <Link to={`/post/${postData._id}`}>
                      <img src={postPhoto} alt="post" />
                    </Link>
                  </div>
                </>
              ) : (
                <>{isValidUrl(postPhoto) && <ImageSkleton />}</>
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
                    {postData.reacts && totalReacts}{" "}
                    {totalReacts > 1 ? "Reacts" : "React"}
                  </span>
                </div>
                <div className="comment-share">
                  <div className="comment">
                    <div className="text">
                      {postData.comments && totalComments}
                    </div>
                    <div className="icon">
                      <i className="far fa-comment-alt"></i>
                    </div>
                  </div>
                  <div className="shares">
                    <div className="text">{postData.shares && totalShares}</div>
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
                    <div className="post-react-container">
                      <div
                        className={`react react-like ${reactType == "like" ? "reacted" : ""}`}
                        onClick={likeOnClick}
                        id="postReactLike"
                        title="Like"
                      >
                        <img src={Rlike} alt="love" />
                      </div>
                      <div
                        className={`react react-love ${reactType == "love" ? "reacted" : ""}`}
                        onClick={loveOnClick}
                        id="postReactLove"
                        title="Love"
                      >
                        <img src={Rlove} alt="love" />
                      </div>
                      <div
                        className={`react react-haha ${reactType == "haha" ? "reacted" : ""}`}
                        onClick={hahaOnClick}
                        id="postReactHaha"
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
                    <ModalContainer
                      title="Share Post"
                      style={{ width: isMobile ? "95%" : "600px", top: "50%" }}
                      isOpen={isShareModal}
                      onRequestClose={onCloseShareReq}
                      id="cp-view-modal"
                    >
                      <div className="modal-header">
                        <div></div>
                        <div
                          onClick={onCloseShareReq}
                          className="modal-close-btn text-danger"
                        >
                          <i className="far fa-times"></i>
                        </div>
                      </div>
                      <div className="modal-body">
                        <div className="share-post-container">
                          <div className="share-post-header">
                            <div className="share-post-user">
                              <div className="share-post-avatar">
                                <UserPP
                                  profilePic={myProfile.profilePic}
                                  profile={myProfile._id}
                                />
                              </div>
                              <div className="share-post-user-meta">
                                <h3
                                  className="share-post-name"
                                  title={myProfile.fullName}
                                >
                                  {myProfile.fullName}
                                </h3>
                                <p className="share-post-context">
                                  You're sharing{" "}
                                  {postData.author.fullName || "Someone"}'s post
                                </p>
                              </div>
                            </div>
                          </div>
                          <div className="share-post-body">
                            <textarea
                              className="form-control"
                              rows="3"
                              onChange={(e) => setShareCap(e.target.value)}
                              value={shareCap}
                              placeholder="What's on your mind?"
                            ></textarea>
                            <div className="share-post-button">
                              <button
                                className="btn btn-primary"
                                onClick={onClickShareNow}
                              >
                                Share Now
                              </button>
                            </div>
                          </div>
                        </div>
                      </div>
                    </ModalContainer>
                  </div>
                </div>
              </div>
            </div>
          </div>
        );
        break;
    }
  };

  const PAGE_SIZE = 25;
  const viewers = useMemo(
    () => (Array.isArray(postData?.viewers) ? postData.viewers : []),
    [postData?.viewers],
  );
  const [viewFilter, setViewFilter] = useState("all");
  const [visibleViewersCount, setVisibleViewersCount] = useState(PAGE_SIZE);
  const [isLoadingMoreViewers, setIsLoadingMoreViewers] = useState(false);
  const [isViewersLoading, setIsViewersLoading] = useState(true);
  const commentCount =
    typeof totalComments === "number"
      ? totalComments
      : postData?.comments?.length || 0;
  const reacts = useMemo(
    () => (Array.isArray(postData?.reacts) ? postData.reacts : []),
    [postData?.reacts],
  );

  const viewerReactMap = useMemo(() => {
    const map = new Map();

    reacts.forEach((react) => {
      const reactProfileId = react?.profile?._id || react?.profile || react;
      if (reactProfileId && react?.type) {
        map.set(reactProfileId, react.type);
      }
    });

    return map;
  }, [reacts]);

  const filterOptions = useMemo(() => {
    const reactedCount = viewers.filter((viewer) =>
      viewerReactMap.has(viewer?._id || viewer),
    ).length;
    const unreactedCount = viewers.length - reactedCount;
    const typeCounts = viewers.reduce(
      (counts, viewer) => {
        const reactType = viewerReactMap.get(viewer?._id || viewer);
        if (reactType && counts[reactType] !== undefined) {
          counts[reactType] += 1;
        }
        return counts;
      },
      { like: 0, love: 0, haha: 0 },
    );

    return [
      { key: "all", label: "All Views", count: viewers.length },
      { key: "reacted", label: "Reacted", count: reactedCount },
      { key: "unreacted", label: "No React", count: unreactedCount },
      { key: "like", label: "Like", count: typeCounts.like, icon: Rlike },
      { key: "love", label: "Love", count: typeCounts.love, icon: Rlove },
      { key: "haha", label: "Haha", count: typeCounts.haha, icon: Rhaha },
    ];
  }, [viewerReactMap, viewers]);

  const filteredViewers = useMemo(() => {
    if (viewFilter === "all") return viewers;

    return viewers.filter((viewer) => {
      const viewerId = viewer?._id || viewer;
      const reactType = viewerReactMap.get(viewerId);

      if (viewFilter === "reacted") return Boolean(reactType);
      if (viewFilter === "unreacted") return !reactType;
      if (["like", "love", "haha"].includes(viewFilter))
        return reactType === viewFilter;
      return true;
    });
  }, [viewFilter, viewerReactMap, viewers]);

  const visibleViewers = useMemo(
    () => filteredViewers.slice(0, visibleViewersCount),
    [filteredViewers, visibleViewersCount],
  );

  const canLoadMoreViewers = filteredViewers.length > visibleViewers.length;

  useEffect(() => {
    setVisibleViewersCount(PAGE_SIZE);
  }, [postId, viewFilter]);

  useEffect(() => {
    setIsViewersLoading(true);
    const timer = setTimeout(() => {
      setIsViewersLoading(false);
    }, 250);

    return () => clearTimeout(timer);
  }, [postId, viewFilter, filteredViewers.length]);

  const onLoadMoreViewers = useCallback(() => {
    if (isLoadingMoreViewers || !canLoadMoreViewers) return;

    setIsLoadingMoreViewers(true);
    setTimeout(() => {
      setVisibleViewersCount((prev) => prev + PAGE_SIZE);
      setIsLoadingMoreViewers(false);
    }, 350);
  }, [canLoadMoreViewers, isLoadingMoreViewers]);

  return (
    <div className="sp-page">
      <Container className="single-post-container" fluid="lg">
        <div className="sp-topbar">
          <button
            type="button"
            className="sp-back-btn"
            onClick={() =>
              window.history.length > 1 ? navigate(-1) : navigate("/")
            }
            aria-label="Go back"
          >
            <i className="fas fa-arrow-left" aria-hidden="true"></i>
            Back
          </button>
          <h1 className="sp-topbar-title">
            {isEditMode ? "Edit post" : "Post"}
          </h1>
        </div>

        {!postData ? (
          <SinglePostSkeleton />
        ) : (
          <div className="sp-layout">
            <div className="sp-main-col">
              <section className="sp-panel sp-post-panel" id="post-container">
                {PostContent()}
              </section>
            </div>

            <aside className="sp-side-col">
              <section
                className="sp-panel sp-comments-panel"
                aria-label="Comments"
              >
                <div className="sp-panel-head">
                  <h2 className="section-title">Comments</h2>
                  <span className="sp-panel-count">{commentCount}</span>
                </div>
                <div className="sp-comments-container">
                  <PostComment
                    post={postData}
                    commentState={setTotalComments}
                    allComments={allComments}
                    setAllComments={setAllComments}
                    myProfile={myProfile}
                    authProfile={authProfileId}
                    isEditMode={isEditMode}
                    initialVisibleCount={PAGE_SIZE}
                    authProfilePicture={authProfilePicture}
                  />
                </div>
              </section>

              <section
                className="sp-panel sp-views-panel"
                aria-label="People who viewed this post"
              >
                <div className="sp-panel-head">
                  <h2 className="section-title">Views</h2>
                  <span className="sp-panel-count">
                    {filteredViewers.length}
                  </span>
                </div>
                {viewers.length > 0 && (
                  <div className="sp-filter-wrap">
                    <div className="sp-filter-head">
                      <span className="sp-filter-label">Filter viewers</span>
                      <button
                        type="button"
                        className="sp-filter-reset"
                        onClick={() => setViewFilter("all")}
                        disabled={viewFilter === "all"}
                      >
                        Reset
                      </button>
                    </div>
                    <div className="sp-filter-grid">
                      {filterOptions.map((option) => (
                        <button
                          key={option.key}
                          type="button"
                          className={`sp-filter-chip ${viewFilter === option.key ? "is-active" : ""}`}
                          onClick={() => setViewFilter(option.key)}
                        >
                          <span className="sp-filter-chip-main">
                            {option.icon ? (
                              <span className="sp-filter-chip-icon">
                                <img src={option.icon} alt={option.label} />
                              </span>
                            ) : null}
                            <span className="sp-filter-chip-text">
                              {option.label}
                            </span>
                          </span>
                          <span className="sp-filter-chip-count">
                            {option.count}
                          </span>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {isViewersLoading ? (
                  <div className="sp-viewer-skeleton-wrap" aria-hidden="true">
                    {Array.from({ length: 6 }).map((_, idx) => (
                      <div
                        className="sp-viewer-skeleton"
                        key={`viewer-skeleton-${idx}`}
                      >
                        <span className="sp-viewer-skeleton-avatar" />
                        <span className="sp-viewer-skeleton-line" />
                      </div>
                    ))}
                  </div>
                ) : viewers.length > 0 ? (
                  filteredViewers.length > 0 ? (
                    <>
                      <ul className="sp-reacts">
                        {visibleViewers.map((item) => (
                          <SingleReactor
                            key={item._id || item}
                            reacts={postData.reacts}
                            viewer={item._id || item}
                            reactType={
                              viewerReactMap.get(item._id || item) || ""
                            }
                          />
                        ))}
                      </ul>

                      {isLoadingMoreViewers && (
                        <div
                          className="sp-viewer-skeleton-wrap"
                          aria-hidden="true"
                        >
                          {Array.from({ length: 3 }).map((_, idx) => (
                            <div
                              className="sp-viewer-skeleton"
                              key={`viewer-skeleton-more-${idx}`}
                            >
                              <span className="sp-viewer-skeleton-avatar" />
                              <span className="sp-viewer-skeleton-line" />
                            </div>
                          ))}
                        </div>
                      )}

                      {canLoadMoreViewers && !isLoadingMoreViewers && (
                        <div className="sp-load-more-wrap">
                          <button
                            type="button"
                            className="sp-load-more-btn"
                            onClick={onLoadMoreViewers}
                          >
                            Load more viewers
                          </button>
                        </div>
                      )}
                    </>
                  ) : (
                    <div className="sp-empty-state">
                      No viewers match this filter
                    </div>
                  )
                ) : (
                  <div className="sp-empty-state">No views yet</div>
                )}
              </section>
            </aside>
          </div>
        )}
      </Container>
    </div>
  );
};

export default SinglePost;

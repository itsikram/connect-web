import React, {
  useState,
  useEffect,
  useCallback,
  useRef,
  useMemo,
} from "react";
import $ from "jquery";
import { useDispatch, useSelector } from "react-redux";
import UserPP from "../UserPP";
import { Link, useNavigate } from "react-router-dom";
import Momemt from "react-moment";
import api from "../../api/api";
import PostComment from "./PostComment";
import { confirmAlert } from "react-confirm-alert";
import "react-confirm-alert/src/react-confirm-alert.css"; // Import CSS
import socket from "../../common/socket";
import ImageSkleton from "../../skletons/post/ImageSkleton";
import ModalContainer from "../modal/ModalContainer";
import useIsMobile from "../../utils/useIsMobile";
import checkImgLoading from "../../utils/checkImgLoading";
import isValidUrl from "../../utils/isValiUrl";
import { addPost, removePost } from "../../services/actions/postActions";
import CacheManager from "../../utils/cacheManager";
import {
  prependProfilePostCache,
  removeProfilePostCache,
  updateProfilePostCache,
} from "../../utils/requestCache";
import config from "../../config/config.json";
import OptionsDropdown from "./OptionsDropdown";
import ReportModal from "../modal/ReportModal";
import { AuthorDisplayName } from "../feed/OfficialBadge";
import "./CommentStyles.css";
import "./PostCard.css";
import "./SharePostModal.css";
import {
  uniquePlacedReacts,
  getReactLabel,
} from "../../utils/reactTypes";
import {
  ReactPicker,
  PlacedReactIcons,
  CurrentReactIcon,
} from "./ReactPicker";

const default_pp_src = config?.defaultProfile;
const REACT_LONG_PRESS_MS = 450;
const REACT_LONG_PRESS_MOVE_PX = 12;

let getLastPostId = () => {
  localStorage.getItem("lastPostId");
};
let setVisitedPost = (id) => {
  localStorage.setItem("lastPostId", id);
};

const Post = React.memo(
  ({ data, postContainer, index, onPostDeleted, onPostUpdated }) => {
    const buildCompletePost = useCallback(
      (incomingPost = {}) => ({
        ...(data || {}),
        ...incomingPost,
        author:
          incomingPost?.author && typeof incomingPost.author === "object"
            ? incomingPost.author
            : data?.author,
        parentPost:
          incomingPost?.parentPost &&
          typeof incomingPost.parentPost === "object"
            ? incomingPost.parentPost
            : data?.parentPost,
        comments:
          Array.isArray(incomingPost?.comments) &&
          incomingPost.comments.some(
            (comment) => comment && typeof comment === "object",
          )
            ? incomingPost.comments
            : data?.comments || [],
        reacts: Array.isArray(incomingPost?.reacts)
          ? incomingPost.reacts
          : data?.reacts || [],
        shares: Array.isArray(incomingPost?.shares)
          ? incomingPost.shares
          : data?.shares || [],
        viewers: Array.isArray(incomingPost?.viewers)
          ? incomingPost.viewers
          : data?.viewers || [],
      }),
      [data],
    );
    let post = data || {};
    let myProfile = useSelector((state) => state.profile);
    let myProfileId = myProfile._id;
    let postAuthorProfileId = post?.author._id;
    let [totalReacts, setTotalReacts] = useState(post.reacts.length);
    let [totalShares, setTotalShares] = useState(post.shares.length);

    let [totalComments, setTotalComments] = useState(post.comments.length);
    let [allComments, setAllComments] = useState(post.comments);

    useEffect(() => {
      setTotalComments(post?.comments?.length || 0);
      setAllComments(Array.isArray(post?.comments) ? post.comments : []);
    }, [post?._id, post?.comments]);

    let [isActive, setIsActive] = useState(false);
    let [reactType, setReactType] = useState(false);
    let [isReacted, setIsReacted] = useState(false);
    let [hideReactPicker, setHideReactPicker] = useState(false);
    let [showReactPicker, setShowReactPicker] = useState(false);
    let [shareCap, setShareCap] = useState("");
    let [placedReacts, setPlacedReacts] = useState([]);
    let [isShareModal, setIsShareModal] = useState(false);
    let [isSharing, setIsSharing] = useState(false);
    let [isPostOption, setIsPostOption] = useState(false);
    let [isEditAudienceModal, setIsEditAudienceModal] = useState(false);
    let [isReportModal, setIsReportModal] = useState(false);
    let [selectedAudience, setSelectedAudience] = useState(post.audience || 1);
    let [isUpdatingAudience, setIsUpdatingAudience] = useState(false);
    const [isLoaded, setIsloaded] = useState(false);
    let isMobile = useIsMobile();
    let navigate = useNavigate();
    let nfPosts = useRef([]);
    let displayedPost = useRef();
    let reactButtonsRef = useRef(null);
    let longPressTimerRef = useRef(null);
    let longPressTriggeredRef = useRef(false);
    let pressStartRef = useRef({ x: 0, y: 0 });

    let dispatch = useDispatch();

    // useEffect(() => {
    //     const observer = new IntersectionObserver(
    //         entries => {
    //             entries.forEach(entry => {
    //                 if (entry.isIntersecting) {
    //                     const id = entry.target.dataset.id;
    //                     props.handlePostEnter(id);
    //                 }
    //             });
    //         },
    //         { threshold: 0.5 } // Trigger when 50% of the element is visible
    //     );

    //     nfPosts?.current.forEach(el => {
    //         if (el) observer.observe(el);
    //     });

    //     return () => observer.disconnect();
    // }, [props.handlePostEnter]);

    useEffect(() => {
      socket.emit("is_active", {
        profileId: postAuthorProfileId,
        myId: myProfileId,
      });
      socket.on("is_active", (isUserActive, lastLogin, activeProfileId) => {
        if (activeProfileId === myProfileId) {
          setIsActive(isUserActive);
        }
      });

      return () => socket.off("is_active");
    }, [myProfile]);

    var isAuth = myProfileId === postAuthorProfileId ? true : false;
    var pp_url = post.author.profilePic;

    useEffect(() => {
      let storedReacts = uniquePlacedReacts(post.reacts || []);
      (post.reacts || []).forEach((react) => {
        if (react.profile === myProfileId) {
          setReactType(react.type);
          setIsReacted(true);
        }
      });
      setPlacedReacts(storedReacts);
    }, []);

    let postPhoto = post.photos;
    let type = post.type || "post";

    useEffect(() => {
      checkImgLoading(postPhoto, setIsloaded);
    }, [postPhoto]);

    let hideThisPost = useCallback(
      async (e) => {
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
                    postId: post._id,
                    authorId: post.author._id,
                  });
                  if (deleteRes.status === 200) {
                    dispatch(removePost(post._id));
                    CacheManager.removeCachedPost(post._id);
                    removeProfilePostCache(post.author._id, post._id);
                    onPostDeleted?.(post._id);
                    setIsPostOption(false);
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
      },
      [dispatch, isAuth, onPostDeleted, post._id, post.author._id],
    );

    let removeReact = useCallback(
      async (postType = "post", target = null) => {
        setTotalReacts((state) => state - 1);
        setReactType(false);

        let res = await api.post("/react/removeReact", {
          id: post._id,
          postType: "post",
          reactor: myProfileId,
        });
        if (res.status === 200) {
          setIsReacted(false);
          return true;
        } else {
          setTotalReacts((state) => state + 1);
        }
      },
      [post._id, myProfileId],
    );

    let placeReact = useCallback(
      async (reactType, postType = "post", target = null) => {
        if (!isReacted) {
          setTotalReacts((state) => state + 1);
        }
        // setTotalReacts(state => state + 1)

        setPlacedReacts((prev) => [...prev, reactType]);
        setReactType(reactType);

        let placeRes = await api.post("/react/addReact", {
          id: post._id,
          postType,
          reactType,
        });
        if (placeRes.status === 200) {
          setIsReacted(true);

          return true;
        } else {
          setTotalReacts(post.reacts.length);
          setPlacedReacts((prev) => prev);
          setReactType(false);
        }
      },
      [isReacted, post._id, post.reacts.length],
    );

    let hideReactContainer = useCallback(() => {
      setShowReactPicker(false);
      setHideReactPicker(true);
    }, []);

    let resetReactPickerVisibility = useCallback(() => {
      setHideReactPicker(false);
    }, []);

    let clearLikeLongPress = useCallback(() => {
      if (longPressTimerRef.current) {
        clearTimeout(longPressTimerRef.current);
        longPressTimerRef.current = null;
      }
    }, []);

    useEffect(() => {
      return () => clearLikeLongPress();
    }, [clearLikeLongPress]);

    useEffect(() => {
      if (!showReactPicker) return undefined;
      const closePicker = (event) => {
        if (reactButtonsRef.current?.contains(event.target)) return;
        setShowReactPicker(false);
      };
      document.addEventListener("pointerdown", closePicker);
      return () => document.removeEventListener("pointerdown", closePicker);
    }, [showReactPicker]);

    let onLikePointerDown = useCallback(
      (e) => {
        if (!isMobile && e.pointerType !== "touch") return;
        longPressTriggeredRef.current = false;
        pressStartRef.current = { x: e.clientX, y: e.clientY };
        clearLikeLongPress();
        longPressTimerRef.current = setTimeout(() => {
          longPressTriggeredRef.current = true;
          setHideReactPicker(false);
          setShowReactPicker(true);
          longPressTimerRef.current = null;
        }, REACT_LONG_PRESS_MS);
      },
      [isMobile, clearLikeLongPress],
    );

    let onLikePointerMove = useCallback(
      (e) => {
        if (!longPressTimerRef.current) return;
        const dx = Math.abs(e.clientX - pressStartRef.current.x);
        const dy = Math.abs(e.clientY - pressStartRef.current.y);
        if (dx > REACT_LONG_PRESS_MOVE_PX || dy > REACT_LONG_PRESS_MOVE_PX) {
          clearLikeLongPress();
        }
      },
      [clearLikeLongPress],
    );

    let onLikePointerUp = useCallback(() => {
      clearLikeLongPress();
      if (longPressTriggeredRef.current) {
        window.setTimeout(() => {
          longPressTriggeredRef.current = false;
        }, 400);
      }
    }, [clearLikeLongPress]);

    let onLikeContextMenu = useCallback(
      (e) => {
        if (isMobile || e.nativeEvent?.pointerType === "touch") {
          e.preventDefault();
        }
      },
      [isMobile],
    );

    let likeBtnOnClick = useCallback(
      async (e) => {
        if (longPressTriggeredRef.current) {
          e.preventDefault();
          e.stopPropagation();
          longPressTriggeredRef.current = false;
          return;
        }
        let target = e.currentTarget;
        hideReactContainer();
        if ($(target).parent().hasClass("reacted")) {
          removeReact("post");
          $(target).parent().removeClass("reacted");
        } else {
          placeReact("like", "post", target);
          $(target).parent().addClass("reacted");
        }
      },
      [removeReact, placeReact, hideReactContainer],
    );

    let pickerReactOnClick = useCallback(
      (type, e) => {
        const target = e.currentTarget;
        hideReactContainer();
        if ($(target).hasClass("reacted")) {
          removeReact("post");
          $(target).removeClass("reacted");
        } else {
          placeReact(type, "post", target);
          $(target).siblings().removeClass("reacted");
          $(target).addClass("reacted");
        }
      },
      [removeReact, placeReact, hideReactContainer],
    );

    let likeMouseOver = useCallback((e) => {
      // Let CSS handle the hover display - no need to set inline style
      // The CSS rule .react-buttons:hover .post-react-container will handle it
    }, []);

    let commentOnClick = useCallback((e) => {
      let target = e.currentTarget;

      $(target).parents(".footer").find(".field-comment-text").focus();
    }, []);

    let shareOnClick = useCallback((e) => {
      setIsShareModal(true);
    }, []);

    let onCloseShareReq = useCallback(() => {
      setIsShareModal(false);
    }, []);

    let onClickShareNow = useCallback(
      async (e) => {
        e.preventDefault();
        setIsSharing(true);
        try {
          let res = await api.post("post/share", {
            postId: post._id,
            caption: shareCap,
          });

          if (res.status == 200) {
            setTotalShares((state) => state + 1);
            dispatch(addPost(res.data.post));
            CacheManager.prependCachedPost(res.data.post);
            prependProfilePostCache(myProfileId, res.data.post);
            setIsShareModal(false);
            setShareCap(""); // Clear the caption after successful share
          }
        } catch (error) {
          console.error("Error sharing post:", error);
          alert("Failed to share post. Please try again.");
        } finally {
          setIsSharing(false);
        }
      },
      [dispatch, myProfileId, post._id, shareCap],
    );

    let authProfilePicture = useSelector((state) => state.profile.profilePic);
    let authProfileId = useSelector((state) => state.profile._id);

    const openSinglePost = useCallback(() => {
      navigate(`/post/${post._id}`);
    }, [navigate, post._id]);

    let postHeaderClick = useCallback(
      (e) => {
        openSinglePost();
      },
      [openSinglePost],
    );

    let gotoEdit = useCallback(
      (e) => {
        navigate(`/post/${post._id}/edit`);
      },
      [navigate, post._id],
    );

    let postAuthorPP = `${post.author.profilePic}`;

    const closePostOption = useCallback(() => {
      setIsPostOption(false);
    }, []);

    const openReportModal = useCallback(() => {
      setIsPostOption(false);
      setIsReportModal(true);
    }, []);

    const postOptionClick = useCallback(() => {
      setIsPostOption((prev) => !prev);
    }, []);

    let editAudienceClick = useCallback(
      (e) => {
        setIsEditAudienceModal(true);
        setIsPostOption(false);
        setSelectedAudience(post.audience || 1);
      },
      [post.audience],
    );

    let onCloseEditAudience = useCallback(() => {
      setIsEditAudienceModal(false);
    }, []);

    let onSaveAudience = useCallback(async () => {
      setIsUpdatingAudience(true);
      try {
        let res = await api.post("/post/update", {
          postId: post._id,
          audience: selectedAudience,
        });
        if (res.status === 200) {
          const updatedPost = buildCompletePost(
            res.data?.post || { ...(data || {}), audience: selectedAudience },
          );

          CacheManager.updateCachedPost(updatedPost);
          updateProfilePostCache(post.author._id, updatedPost);
          onPostUpdated?.(updatedPost);
          setSelectedAudience(updatedPost.audience || selectedAudience);
          setIsEditAudienceModal(false);
        }
      } catch (error) {
        console.error("Error updating audience:", error);
        alert("Failed to update audience");
      } finally {
        setIsUpdatingAudience(false);
      }
    }, [
      buildCompletePost,
      data,
      onPostUpdated,
      post._id,
      post.author._id,
      selectedAudience,
    ]);

    // useEffect(() => {

    //     window.addEventListener('scroll', () => {
    //         if (isElementNearTop(nfwatch?.current)) {
    //             document.querySelectorAll('.watch-video').forEach((element => {
    //                 element.pause();
    //             }))
    //             displayedWatch.current.play()
    //         }
    //     });
    // }, [])

    const triggeredSet = useRef(new Set()); // Keeps track of already-triggered items
    useEffect(() => {
      const handleVisible = (postId) => {
        socket.emit("viewPost", { visitorId: myProfileId, postId });
        // Place your custom logic here (e.g. animation, API call, etc.)
      };

      const observer = new IntersectionObserver(
        (entries, obs) => {
          entries.forEach((entry) => {
            const index = Number(entry.target.dataset.index);
            if (entry.isIntersecting && !triggeredSet.current.has(index)) {
              triggeredSet.current.add(index);
              handleVisible(entry.target.dataset.id);
              obs.unobserve(entry.target); // Stop observing this element
            }
          });
        },
        {
          root: postContainer.current,
          threshold: 0.5,
        },
      );

      nfPosts.current.forEach((el) => el && observer.observe(el));

      return () => {
        observer.disconnect();
      };
    }, []);

    const PostContent = useMemo(() => {
      switch (type) {
        case "share":
          return (
            <div
              data-id={post._id}
              ref={(el) => (nfPosts.current[index] = el)}
              data-index={index}
              className="share-nf-post nf-post"
            >
              <div className="header">
                <div className="reason">
                  <span className="">
                    <b>
                      <Link to={`/${post.author._id}`}>
                        {post.author.fullName}
                      </Link>
                    </b>{" "}
                    Shared{" "}
                    <b>
                      <Link to={`/${post?.parentPost?.author?._id}`}>
                        {post?.parentPost?.author?.fullName}'s
                      </Link>{" "}
                    </b>
                    <span className="text-capitalize">
                      {post?.parentPost?.type}
                    </span>
                  </span>
                </div>
                <div className="author-info">
                  <div className="left">
                    <div className="author-pp">
                      <UserPP
                        profilePic={post.author.profilePic}
                        profile={post.author._id}
                        active={post.author.isActive}
                      ></UserPP>
                    </div>
                    <div className="post-nd-container">
                      <Link to={"/" + post.author._id}>
                        <h4 className="author-name"><AuthorDisplayName author={post.author} /></h4>
                      </Link>
                      <span className="post-time">
                        <Momemt fromNow>{post.createdAt}</Momemt>
                      </span>
                    </div>
                  </div>
                  <div className="right">
                    <>
                      <OptionsDropdown
                        open={isPostOption}
                        onToggle={postOptionClick}
                        onClose={closePostOption}
                        ariaLabel="Post options"
                      >
                        <ul>
                          {isAuth && (
                            <>
                              <li onClick={gotoEdit}>Edit Post</li>
                              <li onClick={editAudienceClick}>
                                Edit Audience
                              </li>
                            </>
                          )}
                          {!isAuth && (
                            <li onClick={openReportModal}>Report This Post</li>
                          )}
                        </ul>
                      </OptionsDropdown>
                    </>

                    <button onClick={hideThisPost} className="post-close">
                      {" "}
                      <i className="far fa-times"></i>
                    </button>
                  </div>
                </div>
              </div>
              <div ref={displayedPost} data-id={post._id} className="body">
                <p className="caption">{post.caption}</p>
                <div className={`nf-post ${type} m-3 border overflow-hidden`}>
                  <div className="header">
                    {type === "profilePic" && (
                      <div className="reason">
                        <span className="d-none">
                          <b>Shared a photos</b>
                        </span>

                        <span>Updated Profile Picture</span>
                      </div>
                    )}
                    <div className="author-info">
                      <div className="left">
                        <div className="author-pp">
                          <UserPP
                            profilePic={post?.parentPost?.author?.profilePic}
                            profile={post?.parentPost?.author?._id}
                            active={post?.parentPost?.author?.isActive}
                          ></UserPP>
                        </div>
                        <div className="post-nd-container">
                          <Link to={"/" + post.author._id}>
                            <h4 className="author-name">
                              {post?.parentPost?.author?.fullName}
                            </h4>
                            {post.feelings && (
                              <span className="post-feelings">
                                {" "}
                                <small className="feelings-label">
                                  is feeling
                                </small>{" "}
                                <strong className="feelings-value">
                                  {post.feelings}
                                </strong>
                              </span>
                            )}

                            {post.location && (
                              <span className="post-location">
                                {" "}
                                <small className="feelings-label">
                                  at
                                </small>{" "}
                                <strong className="feelings-value">
                                  {post.location}
                                </strong>
                              </span>
                            )}
                          </Link>
                          <span className="post-time">
                            <Momemt fromNow>
                              {post?.parentPost?.createdAt}
                            </Momemt>
                          </span>
                        </div>
                      </div>
                      <div className="right"></div>
                    </div>
                  </div>

                  <div className="body">
                    <p className="caption">{post?.parentPost?.caption}</p>
                    {isLoaded && isValidUrl(postPhoto) ? (
                      <>
                        {" "}
                        <div className="attachment">
                          <Link to={`/post/${post._id}`}>
                            <img src={postPhoto} alt="post" />
                          </Link>
                        </div>
                      </>
                    ) : (
                      <>{isValidUrl(postPhoto) && <ImageSkleton />}</>
                    )}
                  </div>
                </div>
              </div>

              <div className="footer">
                <div className="react-count">
                  <div
                    className="reacts"
                    onClick={openSinglePost}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) =>
                      (e.key === "Enter" || e.key === " ") && openSinglePost()
                    }
                    style={{ cursor: "pointer" }}
                  >
                    <PlacedReactIcons placedReacts={placedReacts} />

                    <span className="text">
                      {post.reacts && totalReacts}{" "}
                      {totalReacts > 1 ? "Reacts" : "React"}
                    </span>
                  </div>
                  <div className="comment-share">
                    <div
                      className="comment"
                      onClick={openSinglePost}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) =>
                        (e.key === "Enter" || e.key === " ") && openSinglePost()
                      }
                      style={{ cursor: "pointer" }}
                    >
                      <div className="text">
                        {post.comments && totalComments}
                      </div>
                      <div className="icon">
                        <i className="far fa-comment-alt"></i>
                      </div>
                    </div>
                    <div
                      className="shares"
                      onClick={openSinglePost}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) =>
                        (e.key === "Enter" || e.key === " ") && openSinglePost()
                      }
                      style={{ cursor: "pointer" }}
                    >
                      <div className="text">{post.shares && totalShares}</div>
                      <div className="icon">
                        <i className="fa fa-share"></i>
                      </div>
                    </div>
                  </div>
                </div>
                <div className="like-comment-share">
                  <div className="buttons-container">
                    <div
                      ref={reactButtonsRef}
                      className={`react-buttons button ${reactType ? "reacted" : ""} ${hideReactPicker ? "hide-reacts" : ""} ${showReactPicker ? "show-reacts" : ""}`}
                      onMouseLeave={resetReactPickerVisibility}
                    >
                      <div
                        onClick={likeBtnOnClick}
                        onMouseOver={likeMouseOver}
                        onPointerDown={onLikePointerDown}
                        onPointerMove={onLikePointerMove}
                        onPointerUp={onLikePointerUp}
                        onPointerCancel={onLikePointerUp}
                        onPointerLeave={onLikePointerUp}
                        onContextMenu={onLikeContextMenu}
                        className={`react-like ${reactType == true ? "reacted" : ""}`}
                      >
                        <span className="react-icon" datatype={reactType || ""}>
                          <CurrentReactIcon reactType={reactType} />
                        </span>
                        <span className="text text-capitalize">
                          {getReactLabel(reactType)}
                        </span>
                      </div>
                      <ReactPicker
                        reactType={reactType}
                        onSelect={pickerReactOnClick}
                      />
                    </div>
                    <div onClick={commentOnClick} className="comment button">
                      <span className="icon">
                        <i className="far fa-comment-alt"></i>
                      </span>
                      <span className="text">Comment</span>
                    </div>

                    {!isAuth && (
                      <>
                        <div onClick={shareOnClick} className="share button">
                          <span className="icon">
                            <i className="far fa-share"></i>
                          </span>
                          <span className="text">Share</span>
                        </div>
                        {isShareModal && (
                        <ModalContainer
                          title="Share Post"
                          isOpen
                          onRequestClose={onCloseShareReq}
                          id="cp-view-modal"
                        >
                          <div className="modal-header">
                            <h3 className="modal-title">Share Post</h3>
                            <button
                              type="button"
                              onClick={onCloseShareReq}
                              className="modal-close-btn"
                              aria-label="Close"
                            >
                              <i className="far fa-times"></i>
                            </button>
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
                                      {post.author.fullName || "Someone"}'s post
                                    </p>
                                  </div>
                                </div>
                              </div>
                              <div className="share-post-body">
                                <textarea
                                  className="form-control"
                                  rows="3"
                                  placeholder={
                                    isSharing
                                      ? "Sharing..."
                                      : "What's on your mind?"
                                  }
                                  onChange={(e) => setShareCap(e.target.value)}
                                  value={shareCap}
                                  disabled={isSharing}
                                  style={{ opacity: isSharing ? 0.7 : 1 }}
                                ></textarea>
                                <div className="share-post-button">
                                  <button
                                    className="btn btn-primary"
                                    onClick={onClickShareNow}
                                    disabled={isSharing}
                                  >
                                    {isSharing ? (
                                      <>
                                        <span
                                          className="spinner-border spinner-border-sm me-2"
                                          role="status"
                                          aria-hidden="true"
                                        ></span>
                                        Sharing...
                                      </>
                                    ) : (
                                      "Share Now"
                                    )}
                                  </button>
                                </div>
                              </div>
                            </div>
                          </div>
                        </ModalContainer>
                        )}
                      </>
                    )}
                  </div>
                </div>
                <PostComment
                  post={post}
                  commentState={setTotalComments}
                  allComments={allComments}
                  setAllComments={setAllComments}
                  myProfile={myProfile}
                  authProfile={authProfileId}
                  authProfilePicture={authProfilePicture}
                ></PostComment>
              </div>
            </div>
          );
          break;

        default:
          return (
            <div
              data-id={post._id}
              ref={(el) => (nfPosts.current[index] = el)}
              data-index={index}
              className={`nf-post ${type}`}
            >
              <div className="header">
                {type === "profilePic" && (
                  <div className="reason">
                    <span className="reason-badge">
                      <i className="fas fa-camera" aria-hidden="true"></i>
                      Updated profile picture
                    </span>
                  </div>
                )}
                <div className="author-info">
                  <div className="left">
                    <div className="author-pp">
                      <UserPP
                        profilePic={postAuthorPP}
                        profile={post.author._id}
                        active={post.author.isActive}
                      ></UserPP>
                    </div>
                    <div className="post-nd-container">
                      <h4 className="author-name" onClick={postHeaderClick}>
                        <Link to={"/" + post.author._id}>
                          <AuthorDisplayName author={post.author} />
                        </Link>
                        {post.feelings && (
                          <span className="post-feelings">
                            {" "}
                            <small className="feelings-label">
                              is feeling
                            </small>{" "}
                            <strong className="feelings-value">
                              {post.feelings}
                            </strong>
                          </span>
                        )}
                        {post.location && (
                          <span className="post-location">
                            {" "}
                            <small className="feelings-label">at</small>{" "}
                            <strong className="feelings-value">
                              {post.location}
                            </strong>
                          </span>
                        )}
                      </h4>
                      <span className="post-time">
                        <Momemt fromNow>{post.createdAt}</Momemt>
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
                          <>
                            <li onClick={gotoEdit}>Edit Post</li>
                            <li onClick={editAudienceClick}>Edit Audience</li>
                          </>
                        )}
                        {!isAuth && (
                          <li onClick={openReportModal}>Report This Post</li>
                        )}
                      </ul>
                    </OptionsDropdown>

                    <button
                      type="button"
                      onClick={hideThisPost}
                      className="post-close"
                      aria-label="Hide post"
                    >
                      {" "}
                      <i className="far fa-times"></i>
                    </button>
                  </div>
                </div>
              </div>
              <div ref={displayedPost} data-id={post._id} className="body">
                {post.caption ? (
                  <p className="caption">{post.caption}</p>
                ) : null}
                {isLoaded && isValidUrl(postPhoto) ? (
                  <>
                    {" "}
                    <div className="attachment">
                      <Link to={`/post/${post._id}`}>
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
                  <div
                    className="reacts"
                    onClick={openSinglePost}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) =>
                      (e.key === "Enter" || e.key === " ") && openSinglePost()
                    }
                    style={{ cursor: "pointer" }}
                  >
                    <PlacedReactIcons placedReacts={placedReacts} />
                    <span className="text">
                      {totalReacts > 0
                        ? `${totalReacts} ${totalReacts > 1 ? "Reacts" : "React"}`
                        : "Be the first to react"}
                    </span>
                  </div>
                  <div className="comment-share">
                    <div
                      className="comment"
                      onClick={openSinglePost}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) =>
                        (e.key === "Enter" || e.key === " ") && openSinglePost()
                      }
                      style={{ cursor: "pointer" }}
                    >
                      <div className="icon">
                        <i className="far fa-comment-alt"></i>
                      </div>
                      <div className="text">{totalComments || 0}</div>
                    </div>
                    <div
                      className="shares"
                      onClick={openSinglePost}
                      role="button"
                      tabIndex={0}
                      onKeyDown={(e) =>
                        (e.key === "Enter" || e.key === " ") && openSinglePost()
                      }
                      style={{ cursor: "pointer" }}
                    >
                      <div className="icon">
                        <i className="fa fa-share"></i>
                      </div>
                      <div className="text">{totalShares || 0}</div>
                    </div>
                  </div>
                </div>
                <div className="like-comment-share">
                  <div className="buttons-container">
                    <div
                      ref={reactButtonsRef}
                      className={`react-buttons button ${reactType ? "reacted" : ""} ${hideReactPicker ? "hide-reacts" : ""} ${showReactPicker ? "show-reacts" : ""}`}
                      onMouseLeave={resetReactPickerVisibility}
                    >
                      <div
                        onClick={likeBtnOnClick}
                        onMouseOver={likeMouseOver}
                        onPointerDown={onLikePointerDown}
                        onPointerMove={onLikePointerMove}
                        onPointerUp={onLikePointerUp}
                        onPointerCancel={onLikePointerUp}
                        onPointerLeave={onLikePointerUp}
                        onContextMenu={onLikeContextMenu}
                        className={`react-like ${reactType == true ? "reacted" : ""}`}
                      >
                        <span className="react-icon" datatype={reactType || ""}>
                          <CurrentReactIcon reactType={reactType} />
                        </span>
                        <span className="text text-capitalize">
                          {getReactLabel(reactType)}
                        </span>
                      </div>
                      <ReactPicker
                        reactType={reactType}
                        onSelect={pickerReactOnClick}
                      />
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
                    {isShareModal && (
                    <ModalContainer
                      title="Share Post"
                      isOpen
                      onRequestClose={onCloseShareReq}
                      id="cp-view-modal"
                    >
                      <div className="modal-header">
                        <h3 className="modal-title">Share Post</h3>
                        <button
                          type="button"
                          onClick={onCloseShareReq}
                          className="modal-close-btn"
                          aria-label="Close"
                        >
                          <i className="far fa-times"></i>
                        </button>
                      </div>

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
                                {post.author.fullName || "Someone"}
                                's post
                              </p>
                            </div>
                          </div>
                        </div>
                        <div className="share-post-body">
                          <textarea
                            className="form-control"
                            placeholder={
                              isSharing ? "Sharing..." : "What's on your mind?"
                            }
                            onChange={(e) => setShareCap(e.target.value)}
                            value={shareCap}
                            disabled={isSharing}
                            style={{ opacity: isSharing ? 0.7 : 1 }}
                            rows="3"
                          ></textarea>
                          <div className="share-post-button">
                            <button
                              className="btn btn-primary"
                              onClick={onClickShareNow}
                              disabled={isSharing}
                            >
                              {isSharing ? (
                                <>
                                  <span
                                    className="spinner-border spinner-border-sm me-2"
                                    role="status"
                                    aria-hidden="true"
                                  ></span>
                                  Sharing...
                                </>
                              ) : (
                                "Share Now"
                              )}
                            </button>
                          </div>
                        </div>
                      </div>
                    </ModalContainer>
                    )}
                  </div>
                </div>
                <PostComment
                  post={post}
                  commentState={setTotalComments}
                  allComments={allComments}
                  setAllComments={setAllComments}
                  myProfile={myProfile}
                  authProfile={authProfileId}
                  authProfilePicture={authProfilePicture}
                ></PostComment>
              </div>
            </div>
          );
          break;
      }
    }, [
      type,
      post,
      index,
      postAuthorPP,
      isPostOption,
      isLoaded,
      postPhoto,
      placedReacts,
      totalReacts,
      totalComments,
      totalShares,
      reactType,
      isShareModal,
      isSharing,
      shareCap,
      myProfile,
      isAuth,
      hideThisPost,
      postOptionClick,
      closePostOption,
      openReportModal,
      gotoEdit,
      displayedPost,
      likeBtnOnClick,
      likeMouseOver,
      commentOnClick,
      shareOnClick,
      onCloseShareReq,
      onClickShareNow,
      isMobile,
      allComments,
      authProfileId,
      authProfilePicture,
      pickerReactOnClick,
      hideReactPicker,
      showReactPicker,
      resetReactPickerVisibility,
      onLikePointerDown,
      onLikePointerMove,
      onLikePointerUp,
      onLikeContextMenu,
      postHeaderClick,
      openSinglePost,
      editAudienceClick,
    ]);

    return (
      <>
        {PostContent}
        {isReportModal && post?._id && (
          <ReportModal
            isOpen={isReportModal}
            onRequestClose={() => setIsReportModal(false)}
            type="post"
            targetId={post._id}
            targetLabel="this post"
          />
        )}
        {isEditAudienceModal && (
        <ModalContainer
          title="Edit Audience"
          size="sm"
          isOpen
          onRequestClose={onCloseEditAudience}
          id="edit-audience-modal"
        >
          <div className="modal-header">
            <h3 className="modal-title">Edit Audience</h3>
            <button
              type="button"
              onClick={onCloseEditAudience}
              className="modal-close-btn"
              aria-label="Close"
            >
              <i className="far fa-times"></i>
            </button>
          </div>
          <div className="modal-body">
            <div className="edit-audience-container">
              <p className="mb-3">Who can see this post?</p>
              <div className="audience-options">
                <div
                  className={`audience-option ${selectedAudience === 1 ? "selected" : ""}`}
                  onClick={() => setSelectedAudience(1)}
                  style={{
                    padding: "12px",
                    margin: "8px 0",
                    border:
                      selectedAudience === 1
                        ? "2px solid var(--post-accent)"
                        : "1px solid #ddd",
                    borderRadius: "8px",
                    cursor: "pointer",
                    // backgroundColor: selectedAudience === 1 ? '#e7f3ff' : '#fff'
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <i
                      className="far fa-globe"
                      style={{
                        fontSize: "20px",
                        color: "var(--post-accent)",
                      }}
                    ></i>
                    <div>
                      <strong>Public</strong>
                      <p
                        className="mb-0 text-muted"
                        style={{ fontSize: "14px" }}
                      >
                        Anyone can see this post
                      </p>
                    </div>
                    {selectedAudience === 1 && (
                      <i
                        className="far fa-check-circle"
                        style={{
                          marginLeft: "auto",
                          color: "var(--post-accent)",
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
                        ? "2px solid var(--post-accent)"
                        : "1px solid #ddd",
                    borderRadius: "8px",
                    cursor: "pointer",
                    // backgroundColor: selectedAudience === 2 ? "#e7f3ff" : "#fff",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <i
                      className="far fa-user-friends"
                      style={{
                        fontSize: "20px",
                        color: "var(--post-accent)",
                      }}
                    ></i>
                    <div>
                      <strong>Friends</strong>
                      <p
                        className="mb-0 text-muted"
                        style={{ fontSize: "14px" }}
                      >
                        Only your friends can see this post
                      </p>
                    </div>
                    {selectedAudience === 2 && (
                      <i
                        className="far fa-check-circle"
                        style={{
                          marginLeft: "auto",
                          color: "var(--post-accent)",
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
                        ? "2px solid var(--post-accent)"
                        : "1px solid #ddd",
                    borderRadius: "8px",
                    cursor: "pointer",
                    // backgroundColor: selectedAudience === 3 ? "#e7f3ff" : "#fff",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                    }}
                  >
                    <i
                      className="far fa-lock"
                      style={{
                        fontSize: "20px",
                        color: "var(--post-accent)",
                      }}
                    ></i>
                    <div>
                      <strong>Only Me</strong>
                      <p
                        className="mb-0 text-muted"
                        style={{ fontSize: "14px" }}
                      >
                        Only you can see this post
                      </p>
                    </div>
                    {selectedAudience === 3 && (
                      <i
                        className="far fa-check-circle"
                        style={{
                          marginLeft: "auto",
                          color: "var(--post-accent)",
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
        )}
      </>
    );
  },
);

export default Post;

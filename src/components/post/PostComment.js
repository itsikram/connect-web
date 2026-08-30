import React, {
  useState,
  Fragment,
  useEffect,
  useRef,
  useCallback,
} from "react";
import $ from "jquery";
import UserPP from "../UserPP";
import api from "../../api/api";
import SingleComment from "./SingleComment";
import { Link, useLocation } from "react-router-dom";
import CommentSkeleton from "../loading/CommentSkeleton";
import LoadingSpinner, { TypingIndicator } from "../loading/LoadingSpinner";
import "./CommentStyles.css";
import config from "../../config/config.json";
import { generateSmartReplies, generateCaptionRoast } from "../../services/geminiService";

const loadingUrl = config?.loadingUrl;

const PostComment = ({
  post,
  authProfilePicture,
  authProfile,
  myProfile,
  setAllComments: setAllCommentsProp,
  allComments: allCommentsProp,
  commentState,
  isEditMode,
  initialVisibleCount = null,
}) => {
  const location = useLocation();
  const postId = post?._id ? String(post._id) : "";
  const [isSingle, setIsSingle] = useState(
    Boolean(postId) && location.pathname.includes(`/post/${postId}`),
  );
  const [isLoadingInitial, setIsLoadingInitial] = useState(false);
  const [isLoadingMoreComments, setIsLoadingMoreComments] = useState(false);

  const parsedInitialVisibleCount =
    Number.isFinite(initialVisibleCount) && initialVisibleCount > 0
      ? initialVisibleCount
      : null;

  // Always keep a local list so posting never depends on a parent setter existing.
  const [comments, setComments] = useState(() => {
    if (Array.isArray(allCommentsProp)) return allCommentsProp;
    if (Array.isArray(post?.comments)) return post.comments;
    return [];
  });

  const originalCommentsCount = useRef(
    post?.comments?.length ||
      (Array.isArray(allCommentsProp) ? allCommentsProp.length : 0) ||
      0,
  );
  const [visibleCommentsCount, setVisibleCommentsCount] = useState(() =>
    isSingle && parsedInitialVisibleCount
      ? parsedInitialVisibleCount
      : Number.POSITIVE_INFINITY,
  );

  const [uploadedImageUrl, setUploadedImageUrl] = useState(null);
  const [commentData, setCommentData] = useState({
    body: "",
    attachment: null,
  });
  const [isSubmittingComment, setIsSubmittingComment] = useState(false);
  const [isUploadingAttachment, setIsUploadingAttachment] = useState(false);
  const [smartReplies, setSmartReplies] = useState([
    "Love this",
    "So true",
    "Tell me more",
  ]);
  const [smartRepliesLoaded, setSmartRepliesLoaded] = useState(false);
  const [isLoadingReplies, setIsLoadingReplies] = useState(false);
  const [roastDraft, setRoastDraft] = useState("");
  const [isRoasting, setIsRoasting] = useState(false);

  const isOwnPost =
    String(myProfile?._id || "") ===
    String(post?.author?._id || post?.author || "");

  const syncParentComments = useCallback(
    (next) => {
      if (typeof setAllCommentsProp === "function") {
        setAllCommentsProp(next);
      }
    },
    [setAllCommentsProp],
  );

  const commitComments = useCallback((updater) => {
    setComments((prev) => {
      const current = Array.isArray(prev) ? prev : [];
      const next = typeof updater === "function" ? updater(current) : updater;
      return Array.isArray(next) ? next : current;
    });
  }, []);

  useEffect(() => {
    syncParentComments(comments);
  }, [comments, syncParentComments]);

  useEffect(() => {
    setIsSingle(
      Boolean(postId) && location.pathname.includes(`/post/${postId}`),
    );
  }, [location.pathname, postId]);

  useEffect(() => {
    if (isSingle && parsedInitialVisibleCount) {
      setVisibleCommentsCount(parsedInitialVisibleCount);
      return;
    }

    setVisibleCommentsCount(Number.POSITIVE_INFINITY);
  }, [postId, isSingle, parsedInitialVisibleCount]);

  useEffect(() => {
    originalCommentsCount.current = post?.comments?.length || 0;
  }, [postId, post?.comments?.length]);

  const prevPostIdRef = useRef(postId);

  const resolveIncomingComments = useCallback(() => {
    if (Array.isArray(allCommentsProp)) return allCommentsProp;
    if (Array.isArray(post?.comments)) return post.comments;
    return [];
  }, [allCommentsProp, post?.comments]);

  // Reset when switching posts; also sync when parent data arrives after first paint.
  useEffect(() => {
    const incoming = resolveIncomingComments();
    const postChanged = prevPostIdRef.current !== postId;
    prevPostIdRef.current = postId;

    setComments((prev) => {
      if (postChanged) return incoming;
      if (prev.length === 0) return incoming;
      if (incoming.length >= prev.length) return incoming;
      return prev;
    });
    originalCommentsCount.current =
      post?.comments?.length || incoming.length || 0;
  }, [postId, resolveIncomingComments, post?.comments?.length]);

  useEffect(() => {
    if ((comments?.length || 0) === 0 && (post?.comments?.length || 0) > 0) {
      setIsLoadingInitial(true);
      const t = setTimeout(() => setIsLoadingInitial(false), 400);
      return () => clearTimeout(t);
    }
    return undefined;
  }, [comments?.length, post?.comments?.length]);

  const handleAttachChange = useCallback(async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setIsUploadingAttachment(true);
    setCommentData((state) => ({ ...state, attachment: loadingUrl }));
    try {
      const imageFormData = new FormData();
      imageFormData.append("image", file);
      const uploadImageRes = await api.post("/upload/", imageFormData, {
        headers: { "content-type": "multipart/form-data" },
      });
      if (uploadImageRes?.data?.secure_url) {
        const uploadImgUrl = uploadImageRes.data.secure_url;
        setUploadedImageUrl(uploadImgUrl);
        setCommentData((state) => ({ ...state, attachment: uploadImgUrl }));
      }
    } catch (error) {
      console.log("Error uploading attachment:", error);
      setCommentData((state) => ({ ...state, attachment: null }));
    } finally {
      setIsUploadingAttachment(false);
      e.target.value = "";
    }
  }, []);

  const submitComment = useCallback(async () => {
    if (isSubmittingComment) return;
    const body = (commentData.body || "").trim();
    if (!body && !uploadedImageUrl) return;
    if (!postId) return;

    setIsSubmittingComment(true);
    try {
      const res = await api.post("/comment/addComment", {
        body: body || "",
        attachment: uploadedImageUrl,
        post: postId,
      });

      if (res.status === 200) {
        const data = res.data || {};
        if (!data.author) data.author = myProfile;
        if (!data.reacts) data.reacts = [];
        if (!data.replies) data.replies = [];

        commitComments((state) => {
          const list = Array.isArray(state) ? state : [];
          const exists = list.some((c) => c?._id === data._id);
          if (exists) {
            return list.map((c) => (c?._id === data._id ? data : c));
          }
          return [...list, data];
        });

        setCommentData({ body: "", attachment: null });
        setUploadedImageUrl(null);
        if (typeof commentState === "function") {
          commentState((state) => (typeof state === "number" ? state + 1 : 1));
        }
      }
    } catch (error) {
      console.log(error);
    } finally {
      setIsSubmittingComment(false);
    }
  }, [
    isSubmittingComment,
    commentData.body,
    uploadedImageUrl,
    postId,
    myProfile,
    commitComments,
    commentState,
  ]);

  const handleCommentKeyUp = useCallback(
    async (e) => {
      if (e.key === "Enter" || e.keyCode === 13) {
        e.preventDefault();
        await submitComment();
      }
    },
    [submitComment],
  );

  const clickCommentAttachBtn = useCallback((e) => {
    $(e.currentTarget).children("input").trigger("click");
  }, []);

  const commentsList = Array.isArray(comments)
    ? comments.filter((comment) => comment && typeof comment === "object")
    : [];

  const commentsToRender = (() => {
    if (isSingle && parsedInitialVisibleCount) {
      return commentsList.slice(0, visibleCommentsCount);
    }

    if (isSingle) return commentsList;

    const previous3 = commentsList
      .slice(0, originalCommentsCount.current)
      .slice(-3);
    const newer = commentsList.slice(originalCommentsCount.current);
    return [...previous3, ...newer];
  })();

  const canLoadMoreComments =
    isSingle &&
    Boolean(parsedInitialVisibleCount) &&
    commentsList.length > commentsToRender.length;

  const handleLoadMoreComments = useCallback(() => {
    if (!canLoadMoreComments || isLoadingMoreComments) return;

    setIsLoadingMoreComments(true);
    setTimeout(() => {
      setVisibleCommentsCount((prev) => prev + parsedInitialVisibleCount);
      setIsLoadingMoreComments(false);
    }, 350);
  }, [canLoadMoreComments, isLoadingMoreComments, parsedInitialVisibleCount]);

  const loadSmartReplies = useCallback(() => {
    if (smartRepliesLoaded || isLoadingReplies || !post?.caption) return;
    setIsLoadingReplies(true);
    const lastComment = comments[comments.length - 1]?.body || "";
    generateSmartReplies({
      postCaption: post.caption,
      lastComment,
    })
      .then((replies) => {
        if (replies?.length) setSmartReplies(replies);
        setSmartRepliesLoaded(true);
      })
      .catch(() => setSmartRepliesLoaded(true))
      .finally(() => setIsLoadingReplies(false));
  }, [comments, isLoadingReplies, post?.caption, smartRepliesLoaded]);

  useEffect(() => {
    if (isSingle && post?.caption) loadSmartReplies();
  }, [isSingle, loadSmartReplies, post?.caption]);

  const applySmartReply = (text) => {
    setCommentData((s) => ({ ...s, body: text }));
  };

  const handleRoastCaption = async () => {
    if (isRoasting || !post?.caption) return;
    setIsRoasting(true);
    try {
      const roast = await generateCaptionRoast(post.caption);
      setRoastDraft(roast);
      setCommentData((s) => ({ ...s, body: roast }));
    } catch (error) {
      console.warn("Roast failed:", error);
    } finally {
      setIsRoasting(false);
    }
  };

  return (
    <Fragment>
      <div className="comments">
        {isLoadingInitial && <CommentSkeleton count={isSingle ? 3 : 2} />}

        {!isLoadingInitial &&
          commentsToRender.map(
            (comment) =>
              comment && (
                <SingleComment
                  isEditMode={isEditMode}
                  comment={comment}
                  postData={post}
                  key={comment._id || comment.createdAt}
                  myProfile={myProfile}
                />
              ),
          )}

        {!isLoadingInitial && commentsToRender.length === 0 && (
          <div className="no-comments-yet">No comments yet</div>
        )}

        {isLoadingMoreComments && isSingle && (
          <div className="sp-comment-skeleton-wrap" aria-hidden="true">
            {Array.from({ length: 3 }).map((_, idx) => (
              <div
                className="sp-comment-skeleton"
                key={`comment-skeleton-${idx}`}
              >
                <span className="sp-comment-skeleton-avatar" />
                <span className="sp-comment-skeleton-line" />
              </div>
            ))}
          </div>
        )}

        {!isLoadingInitial &&
          originalCommentsCount.current > 3 &&
          !isSingle && (
            <div className="more-comment-button">
              <Link to={`/post/${postId}`}>View more comments</Link>
            </div>
          )}

        {isSingle && canLoadMoreComments && !isLoadingMoreComments && (
          <div className="sp-load-more-wrap">
            <button
              type="button"
              className="sp-load-more-btn"
              onClick={handleLoadMoreComments}
            >
              Load more comments
            </button>
          </div>
        )}
      </div>

      <div className="new-comment-assist">
        {smartReplies.length > 0 && (
          <div className="smart-replies" aria-label="Suggested replies">
            {smartReplies.map((reply) => (
              <button
                key={reply}
                type="button"
                className="smart-reply-chip"
                onClick={() => applySmartReply(reply)}
              >
                {reply}
              </button>
            ))}
          </div>
        )}
        {isOwnPost && post?.caption && (
          <button
            type="button"
            className="smart-reply-chip roast-chip"
            onClick={handleRoastCaption}
            disabled={isRoasting}
          >
            {isRoasting ? "Writing roast…" : roastDraft ? "Roast again" : "Roast my caption"}
          </button>
        )}
        {isLoadingReplies && !smartRepliesLoaded ? (
          <span className="smart-reply-hint">Suggestions loading…</span>
        ) : null}
      </div>

      <div className="new-comment">
        <div className="user-pp">
          <UserPP profilePic={authProfilePicture} profile={authProfile} />
        </div>
        <div
          className={`comment-field ${isSubmittingComment || isUploadingAttachment ? "loading-input" : ""}`}
        >
          <input
            onKeyDown={handleCommentKeyUp}
            onChange={(e) =>
              setCommentData((s) => ({ ...s, body: e.target.value }))
            }
            onFocus={loadSmartReplies}
            className="field-comment-text"
            type="text"
            value={commentData.body || ""}
            placeholder={
              isSubmittingComment
                ? "Posting comment..."
                : isUploadingAttachment
                  ? "Uploading image..."
                  : "Write a public comment…"
            }
            disabled={isSubmittingComment || isUploadingAttachment}
          />

          {!isSubmittingComment && (
            <div
              onClick={isUploadingAttachment ? null : clickCommentAttachBtn}
              className={`comment-attachment ${isUploadingAttachment ? "loading-button" : ""}`}
              style={{
                cursor: isUploadingAttachment ? "not-allowed" : "pointer",
              }}
              title={isUploadingAttachment ? "Uploading..." : "Add photo"}
              role="button"
              tabIndex={isUploadingAttachment ? -1 : 0}
            >
              <input
                onChange={handleAttachChange}
                className="attachment"
                type="file"
                accept="image/*"
                disabled={isUploadingAttachment}
              />
              <span className="icon">
                {isUploadingAttachment ? (
                  <LoadingSpinner size="small" variant="primary" />
                ) : (
                  <i className="far fa-camera"></i>
                )}
              </span>
            </div>
          )}
          {isSubmittingComment && (
            <div className="comment-loading-overlay" style={{ right: 10 }}>
              <TypingIndicator text="Posting..." />
            </div>
          )}
        </div>
      </div>

      {commentData.attachment && (
        <div className="comment-attachment-preview">
          <img alt="comment attachment" src={commentData.attachment} />
          <span className="comment-attachment-preview-label">Photo</span>
          <button
            type="button"
            className="remove-attachment-btn"
            onClick={() => {
              setCommentData((s) => ({ ...s, attachment: null }));
              setUploadedImageUrl(null);
            }}
            aria-label="Remove attachment"
          >
            <i className="fas fa-times"></i>
          </button>
        </div>
      )}
    </Fragment>
  );
};

export default React.memo(PostComment);

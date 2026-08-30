import React, { useState, Fragment, useEffect, useRef, useCallback } from 'react';
import UserPP from '../UserPP';
import api from '../../api/api';
import SingleComment from '../post/SingleComment';
import CommentSkeleton from '../loading/CommentSkeleton';
import LoadingSpinner, { TypingIndicator } from '../loading/LoadingSpinner';
import '../post/CommentStyles.css';

const StoryComment = ({
    story,
    authProfilePicture,
    authProfile,
    myProfile,
    setAllComments: setAllCommentsProp,
    allComments: allCommentsProp,
    commentState,
}) => {
    const storyId = story?._id ? String(story._id) : '';

    const [comments, setComments] = useState(() => {
        if (Array.isArray(allCommentsProp)) return allCommentsProp;
        if (Array.isArray(story?.comments)) return story.comments;
        return [];
    });

    const originalCommentsCount = useRef(
        story?.comments?.length || (Array.isArray(allCommentsProp) ? allCommentsProp.length : 0) || 0
    );
    const [commentData, setCommentData] = useState({ body: '' });
    const [isSubmittingComment, setIsSubmittingComment] = useState(false);
    const [isLoadingInitial, setIsLoadingInitial] = useState(false);

    const syncParentComments = useCallback((next) => {
        if (typeof setAllCommentsProp === 'function') {
            setAllCommentsProp(next);
        }
    }, [setAllCommentsProp]);

    const commitComments = useCallback((updater) => {
        setComments((prev) => {
            const current = Array.isArray(prev) ? prev : [];
            const next = typeof updater === 'function' ? updater(current) : updater;
            const safeNext = Array.isArray(next) ? next : current;
            syncParentComments(safeNext);
            return safeNext;
        });
    }, [syncParentComments]);

    const prevStoryIdRef = useRef(storyId);

    const resolveIncomingComments = useCallback(() => {
        if (Array.isArray(allCommentsProp)) return allCommentsProp;
        if (Array.isArray(story?.comments)) return story.comments;
        return [];
    }, [allCommentsProp, story?.comments]);

    useEffect(() => {
        originalCommentsCount.current = story?.comments?.length || 0;
    }, [storyId, story?.comments?.length]);

    useEffect(() => {
        const incoming = resolveIncomingComments();
        const storyChanged = prevStoryIdRef.current !== storyId;
        prevStoryIdRef.current = storyId;

        setComments((prev) => {
            if (storyChanged) return incoming;
            if (prev.length === 0) return incoming;
            if (incoming.length >= prev.length) return incoming;
            return prev;
        });
        originalCommentsCount.current = story?.comments?.length || incoming.length || 0;
    }, [storyId, resolveIncomingComments, story?.comments?.length]);

    useEffect(() => {
        const storyCommentCount = Array.isArray(story?.comments)
            ? story.comments.filter(Boolean).length
            : 0;
        const listCount = Array.isArray(comments) ? comments.filter(Boolean).length : 0;

        if (!storyId || storyCommentCount === 0) {
            setIsLoadingInitial(false);
            return undefined;
        }

        if (listCount === 0) {
            setIsLoadingInitial(true);
            const t = setTimeout(() => setIsLoadingInitial(false), 400);
            return () => clearTimeout(t);
        }

        setIsLoadingInitial(false);
        return undefined;
    }, [comments, story?.comments, storyId]);

    const submitComment = useCallback(async () => {
        if (isSubmittingComment) return;
        const body = (commentData.body || '').trim();
        if (!body || !storyId) return;

        setIsSubmittingComment(true);
        try {
            const res = await api.post('/comment/story/addComment', {
                body,
                storyId,
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

                setCommentData({ body: '' });
                if (typeof commentState === 'function') {
                    commentState((state) => (typeof state === 'number' ? state + 1 : 1));
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
        storyId,
        myProfile,
        commitComments,
        commentState,
    ]);

    const handleCommentKeyUp = useCallback(async (e) => {
        if (e.key === 'Enter' || e.keyCode === 13) {
            e.preventDefault();
            await submitComment();
        }
    }, [submitComment]);

    const handleCommentRemoved = useCallback((commentId) => {
        commitComments((state) => (Array.isArray(state) ? state.filter((c) => c?._id !== commentId) : state));
        if (typeof commentState === 'function') {
            commentState((count) => Math.max(0, (typeof count === 'number' ? count : 0) - 1));
        }
    }, [commitComments, commentState]);

    const commentsList = Array.isArray(comments)
        ? comments.filter((comment) => comment && (comment._id || comment.body || comment.author))
        : [];

    return (
        <Fragment>
            <div className="comments story-comments-list">
                {isLoadingInitial && <CommentSkeleton count={3} />}

                {!isLoadingInitial && commentsList.length === 0 && (
                    <div className="story-comments-empty">No comments yet</div>
                )}

                {!isLoadingInitial && commentsList.map((comment) => (
                    comment && (
                        <SingleComment
                            comment={comment}
                            postData={story}
                            key={comment._id || comment.createdAt}
                            myProfile={myProfile}
                            parentType="story"
                            onRemove={handleCommentRemoved}
                        />
                    )
                ))}
            </div>

            <div className="new-comment story-new-comment">
                <div className="user-pp">
                    <UserPP profilePic={authProfilePicture} profile={authProfile} />
                </div>
                <div className={`comment-field ${isSubmittingComment ? 'loading-input' : ''}`}>
                    <input
                        onKeyDown={handleCommentKeyUp}
                        onChange={(e) => setCommentData((s) => ({ ...s, body: e.target.value }))}
                        className="field-comment-text single-story-comment-input"
                        type="text"
                        value={commentData.body || ''}
                        placeholder={isSubmittingComment ? 'Posting comment...' : 'Write a public comment…'}
                        disabled={isSubmittingComment}
                    />
                    {isSubmittingComment && (
                        <div className="comment-loading-overlay" style={{ right: 10 }}>
                            <TypingIndicator text="Posting..." />
                        </div>
                    )}
                </div>
            </div>
        </Fragment>
    );
};

export default React.memo(StoryComment);

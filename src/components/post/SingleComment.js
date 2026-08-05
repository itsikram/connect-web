import React, { useState, useEffect, useCallback } from "react";
import Moment from 'react-moment';
import { Link } from 'react-router-dom';
import SingleReply from "./SingleReply";
import UserPP from "../UserPP";
import api from '../../api/api';
import { ReplySkeleton } from "../loading/CommentSkeleton";
import LoadingSpinner, { TypingIndicator } from "../loading/LoadingSpinner";
import { getProfileDisplayName, splitMentionBody } from './commentUtils';
import './CommentStyles.css';

const SingleComment = ({ comment, postData, myProfile, isEditMode }) => {
    const myId = myProfile?._id;
    const authorName = getProfileDisplayName(comment?.author);
    const [totalComment, setTotalComment] = useState(Array.isArray(comment?.reacts) ? comment.reacts.length : 0);
    const [isReacted, setIsReacted] = useState(
        Array.isArray(comment?.reacts) && comment.reacts.some((r) => String(r) === String(myId) || String(r?._id) === String(myId))
    );
    const [isReply, setIsReply] = useState(false);
    const [replies, setReplies] = useState(Array.isArray(comment?.replies) ? comment.replies : []);
    const [isEdit, setIsEdit] = useState(false);
    const [optionsOpen, setOptionsOpen] = useState(false);
    const [updatedComment, setUpdatedComment] = useState(comment?.body || '');
    const [replyData, setReplyData] = useState({ body: '', attachment: null });
    const [isLiking, setIsLiking] = useState(false);
    const [isSubmittingReply, setIsSubmittingReply] = useState(false);
    const [isUpdating, setIsUpdating] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [isLoadingReplies] = useState(false);
    const [removed, setRemoved] = useState(false);

    const post = postData;

    useEffect(() => {
        const reacts = Array.isArray(comment?.reacts) ? comment.reacts : [];
        setTotalComment(reacts.length);
        setIsReacted(reacts.some((r) => String(r) === String(myId) || String(r?._id) === String(myId)));
        setUpdatedComment(comment?.body || '');
        setReplies(Array.isArray(comment?.replies) ? comment.replies : []);
    }, [comment, myId]);

    useEffect(() => {
        if (!optionsOpen) return undefined;
        const close = (e) => {
            if (!e.target.closest?.(`.comment-id-${comment?._id} .options-icon`)) {
                setOptionsOpen(false);
            }
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [optionsOpen, comment?._id]);

    const deleteComment = async (e) => {
        e?.stopPropagation?.();
        if (isDeleting || !comment?._id) return;
        setIsDeleting(true);
        try {
            const dltRes = await api.post('/comment/deleteComment', {
                commentId: comment._id,
                postId: post?._id,
            });
            if (dltRes.status === 200) {
                setRemoved(true);
            }
        } catch (error) {
            console.log(error);
        } finally {
            setIsDeleting(false);
        }
    };

    const submitReply = useCallback(async () => {
        if (isSubmittingReply) return;
        const body = (replyData.body || '').trim();
        if (!body || !comment?._id) return;

        setIsSubmittingReply(true);
        try {
            const uploadReplyRes = await api.post('/comment/addReply', {
                replyMsg: body,
                authorId: myProfile._id,
                commentId: comment._id,
            });
            if (uploadReplyRes.status === 200 && uploadReplyRes.data) {
                const newReplyData = uploadReplyRes.data;
                if (!newReplyData.author) newReplyData.author = myProfile;
                if (!Array.isArray(newReplyData.reacts)) newReplyData.reacts = [];
                setIsReply(false);
                setReplyData({ body: '', attachment: null });
                setReplies((prev) => {
                    const list = Array.isArray(prev) ? prev : [];
                    if (list.some((r) => r?._id === newReplyData._id)) return list;
                    return [...list, newReplyData];
                });
            }
        } catch (error) {
            console.error('Error submitting reply:', error);
        } finally {
            setIsSubmittingReply(false);
        }
    }, [isSubmittingReply, replyData.body, comment?._id, myProfile]);

    const handleReplyKeyUp = async (e) => {
        if (e.key === 'Enter' || e.keyCode === 13) {
            e.preventDefault();
            await submitReply();
        }
    };

    const handleCommentLikeBtnClick = async () => {
        if (isLiking || !comment?._id) return;
        setIsLiking(true);
        try {
            if (isReacted) {
                const updated = await api.post('/comment/removeReact', { commentId: comment._id, reactorId: myId });
                if (updated.status === 200) {
                    setTotalComment((n) => Math.max(0, n - 1));
                    setIsReacted(false);
                }
            } else {
                const updated = await api.post('/comment/addReact', { commentId: comment._id, reactorId: myId });
                if (updated.status === 200) {
                    setTotalComment((n) => n + 1);
                    setIsReacted(true);
                }
            }
        } catch (error) {
            console.error('Error updating like:', error);
        } finally {
            setIsLiking(false);
        }
    };

    const handleUpdateComment = useCallback(async () => {
        if (isUpdating || !comment?._id) return;
        setIsUpdating(true);
        try {
            const res = await api.post('comment/updateComment', {
                commentId: comment._id,
                body: updatedComment,
            });
            if (res.status === 200) {
                setUpdatedComment(res.data.body);
                setIsEdit(false);
            }
        } catch (error) {
            console.error('Error updating comment:', error);
        } finally {
            setIsUpdating(false);
        }
    }, [isUpdating, comment?._id, updatedComment]);

    if (removed || !comment?.author) return null;

    const { mention, rest } = splitMentionBody(updatedComment);
    const visibleReplies = Array.isArray(replies) ? replies.filter(Boolean) : [];

    return (
        <div className={`comment-container comment-id-${comment._id}`}>
            <div className="author-pp">
                <UserPP profilePic={comment.author.profilePic} profile={comment.author._id} />
            </div>
            <div className="comment-info">
                <div className="comment-box">
                    <div className="name-comment">
                        <div className="author-name">
                            <Link to={`/${comment.author._id}`}>{authorName}</Link>
                        </div>
                        <div className="comment-text">
                            {isEdit ? (
                                <div className="comment-editor">
                                    <textarea
                                        onChange={(e) => setUpdatedComment(e.target.value)}
                                        className="form-control w-100"
                                        value={updatedComment}
                                        disabled={isUpdating}
                                    />
                                    <div className="comment-editor-actions">
                                        <button
                                            type="button"
                                            onClick={() => { setIsEdit(false); setUpdatedComment(comment.body || ''); }}
                                            className="btn btn-secondary"
                                            disabled={isUpdating}
                                        >
                                            Cancel
                                        </button>
                                        <button
                                            type="button"
                                            onClick={handleUpdateComment}
                                            className={`btn btn-primary ${isUpdating ? 'loading-button' : ''}`}
                                            disabled={isUpdating}
                                        >
                                            {isUpdating ? (
                                                <>
                                                    <LoadingSpinner size="small" inline={true} />
                                                    <span style={{ marginLeft: '4px' }}>Updating...</span>
                                                </>
                                            ) : (
                                                'Update'
                                            )}
                                        </button>
                                    </div>
                                </div>
                            ) : (
                                <p className="comment-text-body mb-0">
                                    {mention && <span className="comment-mention">{mention}</span>}
                                    {mention ? ` ${rest}` : rest}
                                </p>
                            )}
                        </div>
                        {comment.attachment && (
                            <div className="comment-attachment-container">
                                <img src={comment.attachment} alt="attachment" />
                            </div>
                        )}
                    </div>

                    {(String(comment.author._id) === String(myId) || isEditMode) && (
                        <div
                            onClick={(e) => { e.stopPropagation(); setOptionsOpen((v) => !v); }}
                            className="options-icon"
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setOptionsOpen((v) => !v);
                                }
                            }}
                            aria-label="Comment options"
                        >
                            <i className="far fa-ellipsis-h"></i>
                            <div className={`options-container ${optionsOpen ? 'open' : ''}`}>
                                <button
                                    type="button"
                                    onClick={(e) => { e.stopPropagation(); setIsEdit(true); setOptionsOpen(false); }}
                                    className="comment-option text-primary"
                                >
                                    Edit Comment
                                </button>
                                <button
                                    type="button"
                                    onClick={deleteComment}
                                    className={`comment-option text-danger ${isDeleting ? 'loading-button' : ''}`}
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? (
                                        <>
                                            <LoadingSpinner size="small" inline={true} />
                                            <span style={{ marginLeft: '4px' }}>Deleting...</span>
                                        </>
                                    ) : (
                                        'Delete Comment'
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="comment-react">
                    <div
                        className={`like button ${isReacted ? 'reacted' : ''} ${isLiking ? 'loading-button' : ''}`}
                        onClick={handleCommentLikeBtnClick}
                        data-id={comment._id}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleCommentLikeBtnClick(); } }}
                    >
                        {isLiking ? '…' : <>Like{totalComment > 0 ? ` · ${totalComment}` : ''}</>}
                    </div>
                    <div
                        className="reply button"
                        data-id={comment._id}
                        onClick={() => setIsReply((v) => !v)}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsReply((v) => !v); } }}
                    >
                        Reply
                    </div>
                    <time className="comment-time" dateTime={comment.createdAt} title={comment.createdAt ? new Date(comment.createdAt).toLocaleString() : undefined}>
                        <Moment fromNow>{comment.createdAt}</Moment>
                    </time>
                    {visibleReplies.length > 0 && (
                        <span className="reply-count">
                            · {visibleReplies.length} {visibleReplies.length === 1 ? 'reply' : 'replies'}
                        </span>
                    )}
                </div>

                {isReply && (
                    <div className="new-reply">
                        <div className="replying-to-label">
                            Replying to <strong>{authorName}</strong>
                            <button
                                type="button"
                                className="cancel-reply-btn"
                                onClick={() => { setIsReply(false); setReplyData({ body: '', attachment: null }); }}
                                aria-label="Cancel reply"
                            >
                                <i className="fas fa-times"></i>
                            </button>
                        </div>
                        <div className={`comment-field ${isSubmittingReply ? 'loading-input' : ''}`}>
                            <input
                                onKeyDown={handleReplyKeyUp}
                                onChange={(e) => setReplyData((s) => ({ ...s, body: e.target.value }))}
                                className="field-comment-text"
                                type="text"
                                value={replyData.body || ''}
                                data-comment={comment._id}
                                placeholder={isSubmittingReply ? 'Posting reply...' : `Reply to ${authorName}`}
                                disabled={isSubmittingReply}
                            />
                            {isSubmittingReply && (
                                <div className="reply-loading-overlay">
                                    <TypingIndicator text="Posting..." />
                                </div>
                            )}
                            <div
                                onClick={isSubmittingReply ? null : submitReply}
                                data-comment={comment._id}
                                className={`comment-attachment send-reply-btn ${isSubmittingReply ? 'loading-button' : ''}`}
                                role="button"
                                tabIndex={isSubmittingReply ? -1 : 0}
                                onKeyDown={(e) => {
                                    if (!isSubmittingReply && (e.key === 'Enter' || e.key === ' ')) {
                                        e.preventDefault();
                                        submitReply();
                                    }
                                }}
                                title={isSubmittingReply ? 'Posting...' : 'Send reply'}
                            >
                                <span className="icon">
                                    {isSubmittingReply ? (
                                        <LoadingSpinner size="small" variant="primary" />
                                    ) : (
                                        <i className="far fa-paper-plane"></i>
                                    )}
                                </span>
                            </div>
                        </div>
                    </div>
                )}

                {isLoadingReplies && <ReplySkeleton count={2} />}

                {!isLoadingReplies && visibleReplies.length > 0 && (
                    <div className="replies-thread">
                        {visibleReplies.map((item) => (
                            <SingleReply
                                isEditMode={isEditMode}
                                setReplies={setReplies}
                                replies={visibleReplies}
                                comment={comment}
                                item={item}
                                key={item._id || item.createdAt}
                                myProfile={myProfile}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default React.memo(SingleComment);

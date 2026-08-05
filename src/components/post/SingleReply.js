import React, { useEffect, useState, useCallback } from "react";
import UserPP from "../UserPP";
import Moment from 'react-moment';
import { Link } from 'react-router-dom';
import api from "../../api/api";
import LoadingSpinner, { TypingIndicator } from "../loading/LoadingSpinner";
import { getProfileDisplayName, splitMentionBody, buildReplyMessage } from './commentUtils';
import './CommentStyles.css';

const SingleReply = ({ item, myProfile, setReplies, comment, isEditMode }) => {
    const myId = myProfile?._id;
    const authorName = getProfileDisplayName(item?.author);
    const [isReplyOption, setIsReplyOption] = useState(false);
    const [totalReacts, setTotalReacts] = useState(Array.isArray(item?.reacts) ? item.reacts.length : 0);
    const [isReacted, setIsReacted] = useState(
        Array.isArray(item?.reacts) && item.reacts.some((r) => String(r) === String(myId) || String(r?._id) === String(myId))
    );
    const [isReply, setIsReply] = useState(false);
    const [isLiking, setIsLiking] = useState(false);
    const [isSubmittingReply, setIsSubmittingReply] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [replyData, setReplyData] = useState({ body: '', attachment: null });
    const [removed, setRemoved] = useState(false);

    useEffect(() => {
        const reacts = Array.isArray(item?.reacts) ? item.reacts : [];
        setTotalReacts(reacts.length);
        setIsReacted(reacts.some((r) => String(r) === String(myId) || String(r?._id) === String(myId)));
    }, [item, myId]);

    useEffect(() => {
        if (!isReplyOption) return undefined;
        const close = (e) => {
            if (!e.target.closest?.(`.reply-id-${item?._id} .options-icon`)) {
                setIsReplyOption(false);
            }
        };
        document.addEventListener('mousedown', close);
        return () => document.removeEventListener('mousedown', close);
    }, [isReplyOption, item?._id]);

    const submitNestedReply = useCallback(async () => {
        if (isSubmittingReply) return;
        const message = buildReplyMessage(replyData.body, authorName);
        if (!message || !comment?._id) return;

        setIsSubmittingReply(true);
        try {
            const uploadReplyRes = await api.post('/comment/addReply', {
                replyMsg: message,
                authorId: myProfile._id,
                commentId: comment._id,
            });
            if (uploadReplyRes.status === 200 && uploadReplyRes.data) {
                const newReplyData = uploadReplyRes.data;
                // Ensure author is populated for immediate render
                if (!newReplyData.author) {
                    newReplyData.author = myProfile;
                }
                if (!Array.isArray(newReplyData.reacts)) {
                    newReplyData.reacts = [];
                }
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
    }, [isSubmittingReply, replyData.body, authorName, comment?._id, myProfile, setReplies]);

    const handleDeleteReplyBtn = async (e) => {
        e.stopPropagation();
        if (isDeleting || !item?._id) return;
        setIsDeleting(true);
        try {
            const deleteReply = await api.post('/comment/deleteReply', { replyId: item._id });
            if (deleteReply.status === 200) {
                setRemoved(true);
                setReplies((prev) => (Array.isArray(prev) ? prev.filter((r) => r?._id !== item._id) : []));
            }
        } catch (error) {
            console.error('Error deleting reply:', error);
        } finally {
            setIsDeleting(false);
        }
    };

    const handleReplyKeyUp = async (e) => {
        if (e.key === 'Enter' || e.keyCode === 13) {
            e.preventDefault();
            await submitNestedReply();
        }
    };

    const handleReplyLikeBtnClick = async () => {
        if (isLiking || !item?._id) return;
        setIsLiking(true);
        try {
            if (isReacted) {
                const res = await api.post('/comment/reply/removeReact', { replyId: item._id, myId });
                if (res.status === 200) {
                    setTotalReacts((n) => Math.max(0, n - 1));
                    setIsReacted(false);
                }
            } else {
                const res = await api.post('/comment/reply/addReact', { replyId: item._id, myId });
                if (res.status === 200) {
                    setTotalReacts((n) => n + 1);
                    setIsReacted(true);
                }
            }
        } catch (error) {
            console.error('Error updating like:', error);
        } finally {
            setIsLiking(false);
        }
    };

    if (removed || !item?.author) return null;

    const { mention, rest } = splitMentionBody(item.body);

    return (
        <div className={`reply-container reply-id-${item._id}`}>
            <div className="author-pp">
                <UserPP profilePic={item.author.profilePic} profile={item.author._id} />
            </div>
            <div className="comment-info">
                <div className="comment-box">
                    <div className="name-comment">
                        <div className="author-name">
                            <Link to={`/${item.author._id}`}>{authorName}</Link>
                        </div>
                        <p className="comment-text">
                            {mention && <span className="comment-mention">{mention}</span>}
                            {mention ? ` ${rest}` : rest}
                        </p>
                    </div>

                    {(String(item.author._id) === String(myId) || isEditMode) && (
                        <div
                            className="options-icon"
                            onClick={(e) => { e.stopPropagation(); setIsReplyOption((v) => !v); }}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' || e.key === ' ') {
                                    e.preventDefault();
                                    setIsReplyOption((v) => !v);
                                }
                            }}
                            role="button"
                            tabIndex={0}
                            aria-label="Reply options"
                        >
                            <i className="far fa-ellipsis-h"></i>
                            <div className={`options-container ${isReplyOption ? 'open' : ''}`}>
                                <button
                                    type="button"
                                    data-id={item._id}
                                    onClick={handleDeleteReplyBtn}
                                    className={`comment-option text-danger ${isDeleting ? 'loading-button' : ''}`}
                                    disabled={isDeleting}
                                >
                                    {isDeleting ? (
                                        <>
                                            <LoadingSpinner size="small" inline={true} />
                                            <span style={{ marginLeft: '4px' }}>Deleting...</span>
                                        </>
                                    ) : (
                                        'Delete Reply'
                                    )}
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                <div className="comment-react">
                    <div
                        className={`like button ${isReacted ? 'reacted' : ''} ${isLiking ? 'loading-button' : ''}`}
                        onClick={handleReplyLikeBtnClick}
                        data-id={item._id}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleReplyLikeBtnClick(); } }}
                    >
                        {isLiking ? '…' : <>Like{totalReacts > 0 ? ` · ${totalReacts}` : ''}</>}
                    </div>
                    <div
                        className="reply button"
                        onClick={() => setIsReply((v) => !v)}
                        data-id={item._id}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsReply((v) => !v); } }}
                    >
                        Reply
                    </div>
                    <time className="comment-time" dateTime={item.createdAt} title={item.createdAt ? new Date(item.createdAt).toLocaleString() : undefined}>
                        <Moment fromNow>{item.createdAt}</Moment>
                    </time>
                </div>

                {isReply && (
                    <div className="new-reply nested-reply">
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
                                data-reply={item._id}
                                placeholder={isSubmittingReply ? 'Posting reply...' : `Reply to ${authorName}`}
                                disabled={isSubmittingReply}
                            />
                            {isSubmittingReply && (
                                <div className="reply-loading-overlay">
                                    <TypingIndicator text="Posting..." />
                                </div>
                            )}
                            <div
                                onClick={isSubmittingReply ? null : submitNestedReply}
                                data-reply={item._id}
                                className={`comment-attachment send-reply-btn ${isSubmittingReply ? 'loading-button' : ''}`}
                                role="button"
                                tabIndex={isSubmittingReply ? -1 : 0}
                                onKeyDown={(e) => {
                                    if (!isSubmittingReply && (e.key === 'Enter' || e.key === ' ')) {
                                        e.preventDefault();
                                        submitNestedReply();
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
            </div>
        </div>
    );
};

export default React.memo(SingleReply);

import React, { useEffect, useState, useCallback, useRef } from "react";
import UserPP from "../UserPP";
import Moment from 'react-moment';
import { Link } from 'react-router-dom';
import api from "../../api/api";
import LoadingSpinner, { TypingIndicator } from "../loading/LoadingSpinner";
import {
    getProfileDisplayName,
    buildReplyMessage,
    getReactProfileId,
    hasProfileReact,
    splitMentionTokens,
} from './commentUtils';
import './CommentStyles.css';
import ExpandableText from './ExpandableText';
import MentionInput from './MentionInput';
import { ReactPicker } from './ReactPicker';

const SingleReply = ({ item, myProfile, setReplies, comment, isEditMode, isPostAuthor }) => {
    const myId = myProfile?._id;
    const authorName = getProfileDisplayName(item?.author);
    const [isReplyOption, setIsReplyOption] = useState(false);
    const [reacts, setReacts] = useState(Array.isArray(item?.reacts) ? item.reacts : []);
    const [isReply, setIsReply] = useState(false);
    const [isLiking, setIsLiking] = useState(false);
    const [showReactPicker, setShowReactPicker] = useState(false);
    const reactTimerRef = useRef(null);
    const longPressRef = useRef(false);
    const [isSubmittingReply, setIsSubmittingReply] = useState(false);
    const [isDeleting, setIsDeleting] = useState(false);
    const [replyData, setReplyData] = useState({ body: '', attachment: null });
    const [removed, setRemoved] = useState(false);

    useEffect(() => {
        const reacts = Array.isArray(item?.reacts) ? item.reacts : [];
        setReacts(reacts);
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
        const message = buildReplyMessage(replyData.body, comment?.author);
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

    const handleReplyLikeBtnClick = async (reactionType = 'like') => {
        if (isLiking || !item?._id) return;
        const previousReacts = reacts;
        const currentReact = previousReacts.find(
            (react) => String(getReactProfileId(react)) === String(myId),
        );
        const alreadyReacted = Boolean(currentReact);
        const shouldRemove = alreadyReacted && (currentReact?.type || 'like') === reactionType;
        const optimisticReacts = [
            ...previousReacts.filter((react) => String(getReactProfileId(react)) !== String(myId)),
            ...(shouldRemove ? [] : [{ profile: myId, type: reactionType }]),
        ];

        setIsLiking(true);
        setReacts(optimisticReacts);
        try {
            if (shouldRemove) {
                const res = await api.post('/comment/reply/removeReact', { replyId: item._id, myId });
                if (res.status === 200) {
                    setReacts(
                        Array.isArray(res.data?.reacts)
                            ? res.data.reacts
                            : Array.isArray(res.data?.reply?.reacts)
                                ? res.data.reply.reacts
                                : optimisticReacts,
                    );
                } else {
                    setReacts(previousReacts);
                }
            } else {
                const res = await api.post('/comment/reply/addReact', {
                    replyId: item._id,
                    myId,
                    reactType: reactionType,
                });
                if (res.status === 200) {
                    setReacts(
                        Array.isArray(res.data?.reacts)
                            ? res.data.reacts
                            : Array.isArray(res.data?.reply?.reacts)
                                ? res.data.reply.reacts
                                : optimisticReacts,
                    );
                } else {
                    setReacts(previousReacts);
                }
            }
        } catch (error) {
            setReacts(previousReacts);
            console.error('Error updating like:', error);
        } finally {
            setIsLiking(false);
        }
    };

    const startReactLongPress = () => {
        longPressRef.current = false;
        reactTimerRef.current = window.setTimeout(() => {
            longPressRef.current = true;
            setShowReactPicker(true);
        }, 450);
    };

    const cancelReactLongPress = () => {
        if (reactTimerRef.current) {
            window.clearTimeout(reactTimerRef.current);
            reactTimerRef.current = null;
        }
    };

    const handleReactClick = () => {
        if (longPressRef.current) {
            longPressRef.current = false;
            return;
        }
        handleReplyLikeBtnClick();
    };

    if (removed || !item?.author) return null;

    const renderBody = (text) => splitMentionTokens(text).map((part, index) =>
        part.profileId
            ? <Link key={`${part.profileId}-${index}`} className="comment-mention" to={`/${part.profileId}`}>{part.text}</Link>
            : <React.Fragment key={`text-${index}`}>{part.text}</React.Fragment>
    );

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
                        <ExpandableText className="comment-text">
                            {renderBody(item.body)}
                        </ExpandableText>
                    </div>

                    {(String(item.author._id) === String(myId) || isPostAuthor || isEditMode) && (
                        <div className={`options-icon comment-options ${isReplyOption ? 'is-open' : ''}`}>
                            <button
                                type="button"
                                className="comment-options-btn"
                                onClick={(e) => { e.stopPropagation(); setIsReplyOption((v) => !v); }}
                                aria-label="Reply options"
                                aria-expanded={isReplyOption}
                            >
                                <i className="fas fa-ellipsis-h"></i>
                            </button>
                            <div className={`options-container ${isReplyOption ? 'open' : ''}`} role="menu">
                                <button
                                    type="button"
                                    data-id={item._id}
                                    onClick={handleDeleteReplyBtn}
                                    className={`comment-option text-danger ${isDeleting ? 'loading-button' : ''}`}
                                    disabled={isDeleting}
                                    role="menuitem"
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
                        className={`like button ${hasProfileReact(reacts, myId) ? 'reacted' : ''} ${isLiking ? 'loading-button' : ''}`}
                        onClick={handleReactClick}
                        onMouseDown={startReactLongPress}
                        onMouseUp={cancelReactLongPress}
                        onMouseLeave={cancelReactLongPress}
                        onTouchStart={startReactLongPress}
                        onTouchEnd={cancelReactLongPress}
                        data-id={item._id}
                        role="button"
                        tabIndex={0}
                        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); handleReplyLikeBtnClick(); } }}
                    >
                        {isLiking ? '…' : <>Like{reacts.length > 0 ? ` · ${reacts.length}` : ''}</>}
                    </div>
                    {showReactPicker && (
                        <ReactPicker
                            reactType={reacts.find((react) => String(getReactProfileId(react)) === String(myId))?.type}
                            onSelect={(type) => {
                                setShowReactPicker(false);
                                handleReplyLikeBtnClick(type);
                            }}
                            className="comment-react-picker"
                        />
                    )}
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
                            <MentionInput
                                myProfileId={myProfile?._id}
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

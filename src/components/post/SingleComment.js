import React, { useState, useEffect, useMemo, useCallback } from "react";
import Moment from 'react-moment';
import { Link } from 'react-router-dom';
import SingleReply from "./SingleReply";
import UserPP from "../UserPP";
import $ from 'jquery'
import api from '../../api/api';
import { ReplySkeleton } from "../loading/CommentSkeleton";
import LoadingSpinner, { TypingIndicator } from "../loading/LoadingSpinner";
import './CommentStyles.css';


const SingleComment = ({ comment, postData, myProfile, isEditMode }) => {

    // Move all hooks to the top level before any conditional returns
    let myId = myProfile._id
    let [totalComment, setTotalComment] = useState(0)
    let [isReacted, setIsReacted] = useState(false);
    let [isReply, setIsReply] = useState(false)
    let [replies, setReplies] = useState(comment?.replies)
    let [isEdit, setIsEdit] = useState(false)
    let [updatedComment, setUpdatedComment] = useState(comment.body)
    let [replyData, setReplyData] = useState({
        body: null,
        attachment: null
    })
    
    // Loading states
    let [isLiking, setIsLiking] = useState(false);
    let [isSubmittingReply, setIsSubmittingReply] = useState(false);
    let [isUpdating, setIsUpdating] = useState(false);
    let [isDeleting, setIsDeleting] = useState(false);
    let [isLoadingReplies, setIsLoadingReplies] = useState(false);
    
    const post = postData // useMemo((postData) => postData,[])

    // All hooks must be called before any conditional returns
    useEffect(() => {
        setTotalComment(comment.reacts.length || 0)
        setIsReacted(comment.reacts.includes(myId))
    }, [comment])

    let handleCommentReplyBtnClick = async (e) => {
        setIsReply(!isReply)
    }

    let deleteComment = async (e) => {
        if (isDeleting) return; // Prevent multiple clicks
        setIsDeleting(true);
        
        try {
            let commentId = $(e.currentTarget).attr('dataid');
            let postId = post._id;

            let dltRes = await api.post('/comment/deleteComment', { commentId, postId })
            if (dltRes.status === 200) {
                $(e.currentTarget).parents('.comment-container').remove();
                // let data = dltRes.data
                // data.author = myProfile
                // return commentState(state => state - 1)
            }
        } catch (error) {
            console.log(error)
        } finally {
            setIsDeleting(false);
        }
    }

    let handleReplyBodyChange = async (e) => {
        setReplyData(state => {
            return {
                ...state,
                body: e.target.value
            }
        })
    }

    let handleReplyKeyUp = async (e) => {
        e.preventDefault()
        if (e.keyCode === 13 && !isSubmittingReply) {
            setIsSubmittingReply(true);
            
            let commentId = e.currentTarget.dataset.comment
            try {
                if (replyData?.body?.trim()) {
                    let uploadReplyRes = await api.post('/comment/addReply', { replyMsg: replyData.body, authorId: myProfile._id, commentId })
                    if (uploadReplyRes.status == 200) {
                        setIsReply(false)
                        setReplyData({ body: null, attachment: null })
                        e.target.value = ''; // Clear input
                        let newReplyData = uploadReplyRes.data;
                        setReplies(replies => [...replies, newReplyData])
                    }
                }
            } catch (error) {
                console.error('Error submitting reply:', error);
            } finally {
                setIsSubmittingReply(false);
            }
        }
    }

    let clickReplySendBtn = async (e) => {
        if (isSubmittingReply) return; // Prevent multiple clicks
        setIsSubmittingReply(true);
        
        let commentId = e.currentTarget.dataset.comment
        try {
            if (replyData?.body?.trim()) {
                let uploadReplyRes = await api.post('/comment/addReply', { replyMsg: replyData.body, authorId: myProfile._id, commentId })
                if (uploadReplyRes.status == 200) {
                    setIsReply(false)
                    setReplyData({ body: null, attachment: null })
                    let newReplyData = uploadReplyRes.data;
                    setReplies(replies => [...replies, newReplyData])
                }
            }
        } catch (error) {
            console.error('Error submitting reply:', error);
        } finally {
            setIsSubmittingReply(false);
        }
    }

    // handle add attachmenent to comment on click
    let clickCommentOption = (e) => {
        if ($(e.currentTarget).children('.options-container').hasClass('open')) {
            $(e.currentTarget).children('.options-container').removeClass('open');
        } else {
            $(e.currentTarget).children('.options-container').addClass('open');
        }
    }
    // handle comment attachment change


    let handleCommentLikeBtnClick = async (e) => {
        if (isLiking) return; // Prevent multiple clicks while loading
        
        setIsLiking(true);
        let commentId = e.currentTarget.dataset.id
        
        try {
            if ($(e.currentTarget).hasClass('reacted')) {
                let updatedComment = await api.post('/comment/removeReact', { commentId, reactorId: myId })
                if (updatedComment.status == 200) {
                    $(e.target).removeClass('reacted')
                    setTotalComment(comment => comment - 1)
                }
            } else {
                let updatedComment = await api.post('/comment/addReact', { commentId, reactorId: myId })
                if (updatedComment.status == 200) {
                    setTotalComment(comment => comment + 1)
                    $(e.target).addClass('reacted')
                }
            }
        } catch (error) {
            console.error('Error updating like:', error);
        } finally {
            setIsLiking(false);
        }
    }

    let handleCommentChange = useCallback((e) => {
        setUpdatedComment(e.target.value)
    },[])

    let handleUpdateComment = useCallback(async (e) => {
        if (isUpdating) return; // Prevent multiple clicks
        setIsUpdating(true);
        
        try {
            let res = await api.post('comment/updateComment', { commentId: comment._id, body: updatedComment })
            if(res.status == 200) {
                setUpdatedComment(res.data.body)
                setIsEdit(false)
            }
        } catch (error) {
            console.error('Error updating comment:', error);
        } finally {
            setIsUpdating(false);
        }
    }, [isUpdating, comment._id, updatedComment])

    let editCommentClick = useCallback(e => {
        setIsEdit(!isEdit)
    },[])

    // Early return after all hooks are declared
    if(comment.author == null) return(<></>);


    return (
        <>
            <div className={`comment-container comment-id-${comment._id}`}>
                <div className="author-pp">
                    <UserPP profilePic={comment.author.profilePic} profile={comment.author._id}></UserPP>
                </div>
                <div className="comment-info">
                    <div className="comment-box">
                        <div className="name-comment">
                            <div className="author-name">
                                <Link to={`/${comment.author._id}`}>
                                    {comment.author.user.firstName + ' ' + comment.author.user.surname}
                                </Link>
                            </div>
                            <p className="comment-text">

                            {isEdit ? <>
                                            <div className="comment-editor">
                                                <textarea 
                                                    onChange={handleCommentChange.bind(this)} 
                                                    className="form-control w-100" 
                                                    value={updatedComment}
                                                    disabled={isUpdating}
                                                    style={{ opacity: isUpdating ? 0.7 : 1 }}
                                                />
                                                <button 
                                                    onClick={handleUpdateComment.bind(this)} 
                                                    className={`btn btn-primary mt-2 ${isUpdating ? 'loading-button' : ''}`}
                                                    disabled={isUpdating}
                                                    style={{ opacity: isUpdating ? 0.8 : 1 }}
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
                                        </>
                                        : 

                                        <>{updatedComment}</>
                                        
                                    
                                    
                                    }
                            </p>
                            {
                                comment.attachment &&
                                <div className='comment-attachment-container'>
                                    <img src={comment.attachment} alt='attachment' />
                                </div>

                            }

                        </div>

                        {

                            comment.author._id == myProfile._id || isEditMode ?
                                <div onClick={clickCommentOption} className="options-icon">
                                    <i className="far fa-ellipsis-h"></i>
                                    <div className='options-container'>
                                        <button dataid={comment._id} onClick={editCommentClick.bind(this)} className="comment-option text-primary">
                                            Edit Comment
                                        </button>
                                        
                                        <button 
                                            dataid={comment._id} 
                                            onClick={deleteComment.bind(this)} 
                                            className={`comment-option text-danger ${isDeleting ? 'loading-button' : ''}`}
                                            disabled={isDeleting}
                                            style={{ opacity: isDeleting ? 0.7 : 1 }}
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
                                : ''
                        }

                    </div>

                    <div className="comment-react">
                        <div 
                            className={`like button ${isReacted ? 'reacted' : ''} ${isLiking ? 'loading-button' : ''}`} 
                            onClick={handleCommentLikeBtnClick.bind(this)} 
                            data-id={comment._id}
                            style={{ pointerEvents: isLiking ? 'none' : 'auto', opacity: isLiking ? 0.7 : 1 }}
                        >
                            {isLiking ? (
                                <>
                                    <LoadingSpinner size="small" inline={true} />
                                    <span style={{ marginLeft: '4px' }}>Liking...</span>
                                </>
                            ) : (
                                <>Like {`${totalComment > 0 ? '(' + totalComment + ')' : ''}`}</>
                            )}
                        </div>
                        <div 
                            className="reply button" 
                            data-id={comment._id} 
                            onClick={handleCommentReplyBtnClick.bind(this)}
                            style={{ opacity: isSubmittingReply ? 0.7 : 1 }}
                        >
                            Reply
                        </div>

                        <div className="comment-time"><Moment fromNow>{comment.createdAt}</Moment></div>
                    </div>
                    {isReply &&
                        (
                            <div className="new-reply">
                                <div className={`comment-field ${isSubmittingReply ? 'loading-input' : ''}`}>
                                    <input 
                                        onKeyUp={handleReplyKeyUp} 
                                        onChange={handleReplyBodyChange.bind(this)} 
                                        className="field-comment-text" 
                                        type="text" 
                                        data-comment={comment._id} 
                                        placeholder={
                                            isSubmittingReply 
                                                ? "Posting reply..." 
                                                : `Reply to ${comment.author.displayName || comment.author.user.surname}`
                                        }
                                        disabled={isSubmittingReply}
                                        style={{ opacity: isSubmittingReply ? 0.7 : 1 }}
                                    />
                                    
                                    {/* Show typing indicator when submitting */}
                                    {isSubmittingReply && (
                                        <div className="reply-loading-overlay">
                                            <TypingIndicator text="Posting..." />
                                        </div>
                                    )}
                                    
                                    <div 
                                        onClick={isSubmittingReply ? null : clickReplySendBtn.bind(this)} 
                                        data-comment={comment._id} 
                                        className={`comment-attachment ${isSubmittingReply ? 'loading-button' : ''}`}
                                        style={{ 
                                            cursor: isSubmittingReply ? 'not-allowed' : 'pointer',
                                            opacity: isSubmittingReply ? 0.7 : 1 
                                        }}
                                        title={isSubmittingReply ? "Posting..." : "Send reply"}
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

                    {/* Loading skeleton for replies */}
                    {isLoadingReplies && (
                        <ReplySkeleton count={2} />
                    )}

                    {/* Display actual replies */}
                    {!isLoadingReplies && replies.map((item, index) => {
                        return (
                            <SingleReply 
                                isEditMode={isEditMode} 
                                setReplies={setReplies} 
                                replies={replies} 
                                comment={comment} 
                                item={item} 
                                key={index} 
                                myProfile={myProfile}
                            />
                        )
                    })}


                </div>
            </div>
        </>
    )

}

export default React.memo(SingleComment)
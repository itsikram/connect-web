import React, { useEffect, useState } from "react";
import UserPP from "../UserPP";
import Moment from 'react-moment';
import { Link } from 'react-router-dom';
import api from "../../api/api";
import $ from 'jquery'
import LoadingSpinner, { TypingIndicator } from "../loading/LoadingSpinner";
import './CommentStyles.css';
const SingleReply = ({item,myProfile,setReplies,comment,replies,isEditMode}) => {
    let myId = myProfile._id
    let [isReplyOption, setIsReplyOption] = useState(false)
    let [totalReacts, setTotalReacts] = useState(item?.reacts.length)
    let [isReply, setIsReply] = useState(false)
    
    // Loading states
    let [isLiking, setIsLiking] = useState(false);
    let [isSubmittingReply, setIsSubmittingReply] = useState(false);
    let [isDeleting, setIsDeleting] = useState(false);
    
    // let [replyList, setReplyList] = 
    let handleReplyOptionClick = e => {
        setIsReplyOption(!isReplyOption)
    }

    let handleDeleteReplyBtn = async(e) => {
        if (isDeleting) return; // Prevent multiple clicks
        setIsDeleting(true);
        
        let replyId = e.currentTarget.dataset.id 

        try {
            let deleteReply = await api.post('/comment/deleteReply',{replyId})

            if(deleteReply.status === 200) {
                $(e.target).parents('.reply-container').remove()
            }
        } catch (error) {
            console.error('Error deleting reply:', error);
        } finally {
            setIsDeleting(false);
        }
    }

    let handleReplyBtnClick = (e) => {
        setIsReply(!isReply)
    }

    let clickReplySendBtn = async (e) => {
        if (isSubmittingReply) return; // Prevent multiple clicks
        setIsSubmittingReply(true);
        
        let commentId = comment._id
        try {
            if (replyData?.body?.trim()) {
                let uploadReplyRes = await api.post('/comment/addReply', { replyMsg: replyData.body, authorId: myProfile._id, commentId })
                if(uploadReplyRes.status === 200) {
                    setIsReply(false)
                    setReplyData({ body: null, attachment: null })
                    let newReplyData = uploadReplyRes.data._id;
                    setReplies(replies => [...replies,newReplyData])
                }
            }
        } catch (error) {
            console.error('Error submitting reply:', error);
        } finally {
            setIsSubmittingReply(false);
        }
    }
    let [replyData, setReplyData] = useState({
        body: null,
        attachment: null
    })
    
    let handleReplyKeyUp = async (e) => {
        e.preventDefault()
        if (e.keyCode === 13 && !isSubmittingReply) {
            setIsSubmittingReply(true);

            let commentId = comment._id
            try {
                if (replyData?.body?.trim()) {
                    let uploadReplyRes = await api.post('/comment/addReply', { replyMsg: replyData.body, authorId: myProfile._id, commentId })
                    if(uploadReplyRes.status === 200) {
                        setIsReply(false)
                        setReplyData({ body: null, attachment: null })
                        e.target.value = ''; // Clear input
                        let newReplyData = uploadReplyRes.data;
                        setReplies(replies => [...replies,newReplyData])
                    }
                }
            } catch (error) {
                console.error('Error submitting reply:', error);
            } finally {
                setIsSubmittingReply(false);
            }
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

    let handleReplyLikeBtnClick = async(e) => {
        if (isLiking) return; // Prevent multiple clicks
        setIsLiking(true);
        
        let replyId = e.target.dataset.id
        
        try {
            if($(e.target).hasClass('reacted')) {
                let postReplyReact = await api.post('/comment/reply/removeReact',{replyId, myId})

                if(postReplyReact.status == 200) {
                    setTotalReacts( totalReacts - 1)
                    $(e.target).removeClass('reacted')
                }
            }else {
                let postReplyReact = await api.post('/comment/reply/addReact',{replyId, myId})

                if(postReplyReact.status === 200) {
                    setTotalReacts( totalReacts + 1)
                    $(e.target).addClass('reacted')
                }
            }
        } catch (error) {
            console.error('Error updating like:', error);
        } finally {
            setIsLiking(false);
        }
    }

    return (
        <div className="reply-container">
            <div className="author-pp">
                <UserPP profilePic={item.author.profilePic} profile={item.author._id}></UserPP>

            </div>
            <div className="comment-info">
                <div className="comment-box">
                    <div className="name-comment">
                        <div className="author-name"><Link to={`/${item.author._id}`}>{item.author.fullName}</Link></div>
                        <p className="comment-text">{item.body}</p>
                    </div>

                    {
                        (item.author._id == myId || isEditMode) && (
                            <div className="options-icon" onClick={handleReplyOptionClick.bind(this)}>
                                <i className="far fa-ellipsis-h"></i>
                                <div className={`options-container ${isReplyOption && 'open'}`}>
                                    <button 
                                        data-id={item._id} 
                                        onClick={handleDeleteReplyBtn.bind(this)} 
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
                                            'Delete Reply'
                                        )}
                                    </button>
                                </div>
                            </div>
                        )
                    }

                </div>
                <div className="comment-react">
                    <div 
                        className={`like button ${item.reacts.includes(myId) && 'reacted'} ${isLiking ? 'loading-button' : ''}`} 
                        onClick={handleReplyLikeBtnClick.bind(this)} 
                        data-id={item._id}
                        style={{ pointerEvents: isLiking ? 'none' : 'auto', opacity: isLiking ? 0.7 : 1 }}
                    >
                        {isLiking ? (
                            <>
                                <LoadingSpinner size="small" inline={true} />
                                <span style={{ marginLeft: '4px' }}>Liking...</span>
                            </>
                        ) : (
                            <>Like {`${totalReacts > 0 ? `(${totalReacts})` : ''}`}</>
                        )}
                    </div>
                    <div 
                        className="reply button" 
                        onClick={handleReplyBtnClick.bind(this)} 
                        data-id={item._id}
                        style={{ opacity: isSubmittingReply ? 0.7 : 1 }}
                    >
                        Reply
                    </div>
                    <div className="comment-time"><Moment fromNow>{item.createdAt}</Moment></div>
                </div>

                {
                    isReply && (<div className="new-reply">
                        <div className={`comment-field ${isSubmittingReply ? 'loading-input' : ''}`}>
                            <input 
                                onKeyUp={handleReplyKeyUp} 
                                onChange={handleReplyBodyChange.bind(this)} 
                                className="field-comment-text" 
                                type="text" 
                                data-reply={item._id} 
                                placeholder={
                                    isSubmittingReply 
                                        ? "Posting reply..." 
                                        : `Reply to ${item.author.fullName}`
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
                                data-reply={item._id} 
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
                    </div>)
                }
            </div>

        </div>
    )
}

export default SingleReply;
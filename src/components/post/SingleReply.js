import React, { useEffect, useState } from "react";
import UserPP from "../UserPP";
import Moment from 'react-moment';
import { Link } from 'react-router-dom';
import api from "../../api/api";
import $ from 'jquery'
const SingleReply = ({item,myProfile,setReplies,comment,replies,isEditMode}) => {
    let myId = myProfile._id
    let [isReplyOption, setIsReplyOption] = useState(false)
    let [totalReacts, setTotalReacts] = useState(item?.reacts.length)
    let [isReply, setIsReply] = useState(false)
    // let [replyList, setReplyList] = 
    let handleReplyOptionClick = e => {
        setIsReplyOption(!isReplyOption)
    }

    let handleDeleteReplyBtn = async(e) => {
        let replyId = e.currentTarget.dataset.id 


        let deleteReply = await api.post('/comment/deleteReply',{replyId})

        if(deleteReply.status === 200) {
            $(e.target).parents('.reply-container').remove()
        }
    }

    let handleReplyBtnClick = (e) => {
        setIsReply(!isReply)
    }

    let clickReplySendBtn = async (e) => {
        let commentId = comment._id // e.currentTarget.dataset.reply
        if (replyData) {
            let uploadReplyRes = await api.post('/comment/addReply', { replyMsg: replyData.body, authorId: myProfile._id, commentId })
            if(uploadReplyRes.status === 200) {
                setIsReply(false)
                let newReplyData = uploadReplyRes.data._id;
                setReplies(replies => [...replies,newReplyData])
            }
        }
        // $(target).children('input').trigger('click')
    }
    let [replyData, setReplyData] = useState({
        body: null,
        attachment: null
    })
    
    let handleReplyKeyUp = async (e) => {
        e.preventDefault()
        if (e.keyCode === 13) {

            let commentId = comment._id // e.currentTarget.dataset.comment
            if (replyData) {
                let uploadReplyRes = await api.post('/comment/addReply', { replyMsg: replyData.body, authorId: myProfile._id, commentId })
                if(uploadReplyRes.status === 200) {
                    setIsReply(false)
                    let newReplyData = uploadReplyRes.data;
                    setReplies(replies => [...replies,newReplyData])
                }
                
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
        let replyId = e.target.dataset.id
        
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
                                <div className={`options-container ${isReplyOption && 'open'}`}><button data-id={item._id} onClick={handleDeleteReplyBtn.bind(this)} className="comment-option text-danger">Delete Reply</button></div>
                            </div>
                        )
                    }

                </div>
                <div className="comment-react">
                    <div className={`like button ${item.reacts.includes(myId) && 'reacted'}`} onClick={handleReplyLikeBtnClick.bind(this)} data-id={item._id}>Like {`${totalReacts > 0 ? `(${totalReacts})` : ''}`}</div>
                    <div className="reply button" onClick={handleReplyBtnClick.bind(this)} data-id={item._id}>Reply</div>
                    <div className="comment-time"><Moment fromNow>{item.createdAt}</Moment></div>
                </div>

                {
                    isReply && (<div className="new-reply">
                        <div className="comment-field">
                            <input onKeyUp={handleReplyKeyUp} onChange={handleReplyBodyChange.bind(this)} className="field-comment-text" type="text" data-reply={item._id} placeholder={`Reply to ${item.author.fullName}`} />
                            <div onClick={clickReplySendBtn.bind(this)} data-reply={item._id} className="comment-attachment">
                                {/* <input onChange={handleReplyAttachChange} className="attachment" type="file" /> */}
                                <span className="icon">
                                    <i className="far fa-paper-plane"></i>
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
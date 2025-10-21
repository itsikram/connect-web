import React, { useState } from "react";
import UserPP from "../UserPP";
import Moment from 'react-moment';
import { Link } from 'react-router-dom';
import api from "../../api/api";
import $ from 'jquery'
const SingleReply = ({item,myProfile,setReplies,comment}) => {
    const myId = myProfile._id
    const [isReplyOption, setIsReplyOption] = useState(false)
    const [totalReacts, setTotalReacts] = useState(item.reacts.length)
    const [isReply, setIsReply] = useState(false)
    // let [replyList, setReplyList] = 
    const handleReplyOptionClick = () => {
        setIsReplyOption(!isReplyOption)
    }

    const handleDeleteReplyBtn = async(e) => {
        const replyId = e.currentTarget.dataset.id 


        const deleteReply = await api.post('/comment/deleteReply',{replyId})

        if(deleteReply.status == 200) {
            $(e.target).parents('.reply-container').remove()
        }
    }

    const handleReplyBtnClick = () => {
        setIsReply(!isReply)
    }

    const clickReplySendBtn = async () => {
        const commentId = comment._id // e.currentTarget.dataset.reply
        if (replyData) {
            const uploadReplyRes = await api.post('/comment/addReply', { replyMsg: replyData.body, authorId: myProfile._id, commentId })
            if(uploadReplyRes.status == 200) {
                setIsReply(false)
                const newReplyData = uploadReplyRes.data._id;
                setReplies(replies => [...replies,newReplyData])
            }
        }
        // $(target).children('input').trigger('click')
    }
    const [replyData, setReplyData] = useState({
        body: null,
        attachment: null
    })
    
    const handleReplyKeyUp = async (e) => {
        e.preventDefault()
        if (e.keyCode === 13) {

            const commentId = comment._id // e.currentTarget.dataset.comment
            if (replyData) {
                const uploadReplyRes = await api.post('/comment/addReply', { replyMsg: replyData.body, authorId: myProfile._id, commentId })
                if(uploadReplyRes.status == 200) {
                    setIsReply(false)
                    const newReplyData = uploadReplyRes.data;
                    setReplies(replies => [...replies,newReplyData])
                }
                
            }
        }
    }

    const handleReplyBodyChange = async (e) => {
        setReplyData(state => {
            return {
                ...state,
                body: e.target.value
            }
        })
    }

    const handleReplyLikeBtnClick = async(e) => {
        const replyId = e.target.dataset.id
        
        if($(e.target).hasClass('reacted')) {
            const postReplyReact = await api.post('/comment/reply/removeReact',{replyId, myId})

            if(postReplyReact.status == 200) {
                setTotalReacts( totalReacts - 1)
                $(e.target).removeClass('reacted')
            }
        }else {
            const postReplyReact = await api.post('/comment/reply/addReact',{replyId, myId})

            if(postReplyReact.status == 200) {
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
                        item.author._id == myId && (
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
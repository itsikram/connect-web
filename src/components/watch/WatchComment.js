import React, { useState, Fragment, useEffect } from 'react';
import $ from 'jquery'
import UserPP from '../UserPP';
import api from '../../api/api';
import SingleComment from './SingleComment';
import config from '../../config/config.json';
const loadingUrl = config?.loadingUrl;

const populatedComments = (comments) =>
    Array.isArray(comments)
        ? comments.filter((comment) => comment && typeof comment === 'object')
        : []

const WatchComment = (props) => {
    const watch = props.watch || {}
    const authProfilePicture = props.authProfilePicture
    const authProfileId = props.authProfile;
    const myProfile = props.myProfile ? props.myProfile : {}

    const [allComments, setAllComments] = useState(() => populatedComments(watch.comments))
    const [uploadedImageUrl, setUploadedImageUrl] = useState(null);

    let [commentData, setCommentData] = useState({
        body: null,
        attachment: null
    })

    useEffect(() => {
        setAllComments(populatedComments(watch.comments))
    }, [watch._id, watch.comments])

    const handleAttachChange = async (e) => {
        setCommentData(state => {
            return {
                ...state,
                attachment: loadingUrl
            }
        })
        const imageFormData = new FormData();
        imageFormData.append('image', e.target.files[0]);
        const uploadImageRes = await api.post('/upload/', imageFormData, {
            headers: {
                'content-type': 'multipart/form-data'
            }
        })
        if (uploadImageRes) {
            setTimeout(() => {
                const uploadImgUrl = uploadImageRes.data.secure_url
                setUploadedImageUrl(uploadImgUrl)
                setCommentData(state => {
                    return {
                        ...state,
                        attachment: uploadImgUrl
                    }
                })
            }, 1000);
        }
    }
    const handleCommentBodyChange = async (e) => {
        setCommentData(state => {
            return {
                ...state,
                body: e.target.value
            }
        })
    }

    const handleCommentKeyUp = async (e) => {
        e.preventDefault()
        if (e.keyCode === 13) {
            try {
                e.target.value = ''
                const res = await api.post('/comment/addComment', {
                    body: commentData.body,
                    attachment: uploadedImageUrl,
                    watch: (watch._id).toString()
                })
                if (res.status === 200) {
                    const newComment = {
                        ...res.data,
                        author: res.data?.author || myProfile,
                        reacts: Array.isArray(res.data?.reacts) ? res.data.reacts : [],
                        replies: Array.isArray(res.data?.replies) ? res.data.replies : [],
                    }
                    setAllComments(state => [...(Array.isArray(state) ? state : []), newComment])
                    setCommentData({ body: null, attachment: null })
                    setUploadedImageUrl(null)
                    if (typeof props.commentState === 'function') {
                        props.commentState(state => Number(state || 0) + 1);
                    }
                }
            } catch (error) {
                console.log(error)
            }
        }
    }

    const clickCommentAttachBtn = async (e) => {
        const target = e.currentTarget
        $(target).children('input').trigger('click')
    }

    const commentCount = Array.isArray(watch.comments) ? watch.comments.length : 0

    return (
        <Fragment>
            <div className="comments">

                {
                   allComments && allComments.map((comment) => {
                        return comment && <SingleComment comment={comment} watch={watch} key={comment._id || comment.id} myProfile={myProfile}></SingleComment>
                    })
                }

                {
                    commentCount > (allComments?.length || 0) && <div className="more-comment-button"> View more comments</div>

                }
            </div>
            <div className="new-comment">
                <div className="user-pp">
                    <UserPP profilePic={authProfilePicture} profile={authProfileId}></UserPP>
                </div>
                <div className="comment-field">
                    <input onKeyUp={handleCommentKeyUp} onChange={handleCommentBodyChange} className="field-comment-text" type="text" placeholder="Write a Public Comment" />
                    <div onClick={clickCommentAttachBtn} className="comment-attachment">
                        <input onChange={handleAttachChange} className="attachment" type="file" />
                        <span className="icon">
                            <i className="far fa-camera"></i>
                        </span>

                    </div>

                </div>
            </div>
            <div className="comment-attachment-preview">
                {
                    commentData.attachment &&
                    <img alt='comment attachment' src={commentData.attachment}></img>
                }
            </div>
        </Fragment>
    );
}

export default WatchComment;

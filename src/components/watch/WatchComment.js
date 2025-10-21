import React, { useState, Fragment } from 'react';
import $ from 'jquery'
import UserPP from '../UserPP';
import api from '../../api/api';
import SingleComment from './SingleComment';
const loadingUrl = 'https://programmerikram.com/wp-content/uploads/2025/03/loading.gif'

const WatchComment = (props) => {
    const watch = props.watch || {}
    const authProfilePicture = props.authProfilePicture
    const authProfileId = props.authProfile;
    const myProfile = props.myProfile ? props.myProfile : {}
    const isAuth = myProfile._id === authProfileId

    // handle all comment state 

    const [allComments, setAllComments] = useState(watch.comments)
    const [uploadedImageUrl, setUploadedImageUrl] = useState(null);

    
    let [commentData, setCommentData] = useState({
        body: null,
        attachment: null
    })


    // // handle add attachmenent to comment on click
    // let clickCommentOption = (e) => {
    //     if($(e.currentTarget).children('.options-container').hasClass('open')) {
    //         $(e.currentTarget).children('.options-container').removeClass('open');
    //     }else {
    //         $(e.currentTarget).children('.options-container').addClass('open');
    //     }
    // }
    // let clickCommentAttachBtn = async (e) => {
    //     let target = e.currentTarget
    //     $(target).children('input').trigger('click')
    // }

    // handle comment attachment change
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
                const commentFormData = new FormData()
                commentFormData.append('body', commentData.body == null ? '' : commentData.body)
                commentFormData.append('attachment', uploadedImageUrl == null ? '' : uploadedImageUrl)
                commentFormData.append('watch', watch._id)

                const res = await api.post('/comment/addComment', {
                    body: commentData.body,
                    attachment: uploadedImageUrl,
                    watch: (watch._id).toString()
                })
                if (res.status === 200) {
                    const data = res.data
                    data.author = myProfile
                    const newComment = data
                    setAllComments(state => {
                        const oldComments = [...state].slice(-3)
                        const cr = [
                            ...state,
                            ...[newComment]
                        ]

                        setCommentData([])
                        props.commentState(state => state + 1);
                        return cr;

                    })
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


    return (
        <Fragment>
            <div className="comments">

                {
                   allComments && allComments.map((comment, index) => {
                        
                        return comment && <SingleComment comment={comment} watch={watch} key={index} myProfile={myProfile}></SingleComment>
                    })
                }

                {
                    watch.comments.length > allComments.length && <div className="more-comment-button"> View more comments</div>

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

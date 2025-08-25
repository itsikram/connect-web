import React, { useState, Fragment } from 'react';
import $ from 'jquery'
import UserPP from '../UserPP';
import api from '../../api/api';
import SingleComment from './SingleComment';
const loadingUrl = 'https://programmerikram.com/wp-content/uploads/2025/03/loading.gif'
function isValidUrl(str) {
    return true;
    var pattern = new RegExp('^(https?:\\/\\/)?' + // protocol
        '((([a-z\\d]([a-z\\d-]*[a-z\\d])*)\\.)+[a-z]{2,}|' + // domain name
        '((\\d{1,3}\\.){3}\\d{1,3}))' + // OR ip (v4) address
        '(\\:\\d+)?(\\/[-a-z\\d%_.~+]*)*' + // port and path
        '(\\?[;&a-z\\d%_.~+=-]*)?' + // query string
        '(\\#[-a-z\\d_]*)?$', 'i'); // fragment locator
    return !!pattern.test(str);
}

const WatchComment = (props) => {
    let watch = props.watch || {}
    let authProfilePicture = props.authProfilePicture
    let authProfileId = props.authProfile;
    let myProfile = props.myProfile ? props.myProfile : {}
    let isAuth = myProfile._id === authProfileId

    // handle all comment state 

    let [allComments, setAllComments] = useState(watch.comments)
    let [uploadedImageUrl, setUploadedImageUrl] = useState(null);

    
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
    let handleAttachChange = async (e) => {
        setCommentData(state => {
            return {
                ...state,
                attachment: loadingUrl
            }
        })
        let imageFormData = new FormData();
        imageFormData.append('image', e.target.files[0]);
        let uploadImageRes = await api.post('/upload/', imageFormData, {
            headers: {
                'content-type': 'multipart/form-data'
            }
        })
        if (uploadImageRes) {
            setTimeout(() => {
                let uploadImgUrl = uploadImageRes.data.secure_url
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
    let handleCommentBodyChange = async (e) => {
        setCommentData(state => {
            return {
                ...state,
                body: e.target.value
            }
        })
    }

    let handleCommentKeyUp = async (e) => {
        e.preventDefault()
        if (e.keyCode === 13) {
            try {
                e.target.value = ''
                let commentFormData = new FormData()
                commentFormData.append('body', commentData.body == null ? '' : commentData.body)
                commentFormData.append('attachment', uploadedImageUrl == null ? '' : uploadedImageUrl)
                commentFormData.append('watch', watch._id)

                let res = await api.post('/comment/addComment', {
                    body: commentData.body,
                    attachment: uploadedImageUrl,
                    watch: (watch._id).toString()
                })
                if (res.status === 200) {
                    let data = res.data
                    data.author = myProfile
                    let newComment = data
                    setAllComments(state => {
                        let oldComments = [...state].slice(-3)
                        let cr = [
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

    let clickCommentAttachBtn = async (e) => {
        let target = e.currentTarget
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

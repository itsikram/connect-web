import React, { useState, Fragment, useEffect , useRef, useCallback } from 'react';
import $ from 'jquery'
import UserPP from '../UserPP';
import api from '../../api/api';
import SingleComment from './SingleComment';
import { Link, useLocation } from 'react-router-dom';
import CommentSkeleton from '../loading/CommentSkeleton';
import LoadingSpinner, { TypingIndicator } from '../loading/LoadingSpinner';
import './CommentStyles.css';
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

const PostComment = ({ post, authProfilePicture, authProfile, myProfile, setAllComments, allComments = [], commentState,isEditMode }) => {
    let isAuth = myProfile._id === authProfile
    const location = useLocation();
    let [isSingle, setIsSingle] = useState(location.pathname.includes(`/${(post?._id || '').toString()}`));
    let [isLoadingInitial, setIsLoadingInitial] = useState(false);
    let [isLoadingMoreComments, setIsLoadingMoreComments] = useState(false);

    useEffect(() => {
        setIsSingle(location.pathname.includes(`/${(post?._id || '').toString()}`))
    }, [[], location])

    // Simulate initial loading state for comments (you can replace with actual API call)
    useEffect(() => {
        if (allComments.length === 0 && post?.comments?.length > 0) {
            setIsLoadingInitial(true);
            setTimeout(() => {
                setIsLoadingInitial(false);
            }, 800); // Simulate loading time
        }
    }, [allComments.length, post?.comments?.length]);

    // let [post, setPost] = useState({})
    // let [allComments, setAllComments] = useState([])
    let [uploadedImageUrl, setUploadedImageUrl] = useState(null);

    // handle all comment state 


    // useEffect(() => {
    //     setAllComments(props.post.comments)
    //     // setAllComments(props.post.comments && props.post.comments.reverse())
    // }, [props])


    // useEffect(() => {
    //     setAllComments(props.post.comments)
    // }, [post])




    let [commentData, setCommentData] = useState({
        body: null,
        attachment: null
    })
    let [isSubmittingComment, setIsSubmittingComment] = useState(false)
    let [isUploadingAttachment, setIsUploadingAttachment] = useState(false)


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
    let handleAttachChange = useCallback(async (e) => {
        setIsUploadingAttachment(true)
        setCommentData(state => {
            return {
                ...state,
                attachment: loadingUrl
            }
        })
        try {
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
        } catch (error) {
            console.log('Error uploading attachment:', error)
        } finally {
            setIsUploadingAttachment(false)
        }
    }, [])
    
    let handleCommentBodyChange = useCallback(async (e) => {
        setCommentData(state => {
            return {
                ...state,
                body: e.target.value
            }
        })
    }, [])

    let handleCommentKeyUp = useCallback(async (e) => {
        e.preventDefault()
        if (e.keyCode === 13) {
            setIsSubmittingComment(true)
            try {
                e.target.value = ''
                let commentFormData = new FormData()
                commentFormData.append('body', commentData.body == null ? '' : commentData.body)
                commentFormData.append('attachment', uploadedImageUrl == null ? '' : uploadedImageUrl)
                commentFormData.append('post', post._id)
                let res = await api.post('/comment/addComment', {
                    body: commentData.body,
                    attachment: uploadedImageUrl,
                    post: (post._id).toString()
                })

                let newComment = {
                    body: commentData.body,
                    author: myProfile,
                    post: post._id,
                    reacts: [],
                    replies: []
                }

                setAllComments(state => {
                    let cr = [
                        ...state,
                        ...[newComment],

                    ]
                    return cr;

                })

                if (res.status === 200) {
                    let data = res.data
                    data.author = myProfile


                    setCommentData([])
                    commentState(state => state + 1);
                }
            } catch (error) {
                console.log(error)
            } finally {
                setIsSubmittingComment(false)
            }


        }

    }, [commentData.body, uploadedImageUrl, post._id, myProfile, setAllComments, commentState])

    let clickCommentAttachBtn = useCallback(async (e) => {
        let target = e.currentTarget
        $(target).children('input').trigger('click')
    }, [])


    return (
        <Fragment>
            <div className="comments">
                {/* Loading skeleton for initial comments */}
                {isLoadingInitial && (
                    <CommentSkeleton count={isSingle ? 3 : 2} />
                )}

                {/* Display actual comments when not loading */}
                {!isLoadingInitial && (
                    (allComments).slice(isSingle ? -allComments.length -1 : -3).map((comment, index) => {
                        return comment && <SingleComment 
                            isEditMode={isEditMode} 
                            comment={comment} 
                            postData={post} 
                            key={index} 
                            myProfile={myProfile}
                        />
                    })
                )}

                {/* Loading more comments indicator */}
                {isLoadingMoreComments && (
                    <div className="loading-more-comments">
                        <LoadingSpinner size="small" inline={true} text="Loading more comments..." />
                    </div>
                )}

                {/* View more comments link */}
                {!isLoadingInitial && (post?.comments.length > 3 && !isSingle) && (
                    <div className="more-comment-button"> 
                        <Link to={`/post/${post._id}`}>View more comments</Link>
                    </div>
                )}
            </div>
            <div className="new-comment">
                <div className="user-pp">
                    <UserPP profilePic={authProfilePicture} profile={authProfile}></UserPP>
                </div>
                <div className={`comment-field ${isSubmittingComment || isUploadingAttachment ? 'loading-input' : ''}`}>
                    <input 
                        onKeyUp={handleCommentKeyUp} 
                        onChange={handleCommentBodyChange} 
                        className="field-comment-text" 
                        type="text" 
                        placeholder={
                            isSubmittingComment ? "Posting comment..." : 
                            isUploadingAttachment ? "Uploading image..." : 
                            "Write a Public Comment"
                        }
                        disabled={isSubmittingComment || isUploadingAttachment}
                        style={{ opacity: isSubmittingComment || isUploadingAttachment ? 0.7 : 1 }}
                    />
                    
                    {/* Show typing indicator when submitting */}
                    {isSubmittingComment && (
                        <div className="comment-loading-overlay">
                            <TypingIndicator text="Posting..." />
                        </div>
                    )}
                    
                    <div 
                        onClick={isUploadingAttachment ? null : clickCommentAttachBtn} 
                        className={`comment-attachment ${isUploadingAttachment ? 'loading-button' : ''}`}
                        style={{ cursor: isUploadingAttachment ? 'not-allowed' : 'pointer' }}
                        title={isUploadingAttachment ? "Uploading..." : "Add photo"}
                    >
                        <input onChange={handleAttachChange} className="attachment" type="file" disabled={isUploadingAttachment} />
                        <span className="icon">
                            {isUploadingAttachment ? (
                                <LoadingSpinner size="small" variant="primary" />
                            ) : (
                                <i className="far fa-camera"></i>
                            )}
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

export default React.memo(PostComment);

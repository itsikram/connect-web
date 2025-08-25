import React, { useEffect, useState, useCallback } from 'react';

import { useParams, useLocation, useNavigate } from 'react-router-dom';
import api from '../../api/api';
import $ from 'jquery'
import { useSelector } from 'react-redux'
import UserPP from "../UserPP";
import { Link } from "react-router-dom";
import { Container, Row, Col } from 'react-bootstrap';
import ImageSkleton from '../../skletons/post/ImageSkleton';
import ModalContainer from '../modal/ModalContainer';
import useIsMobile from '../../utils/useIsMobile';
import isValidUrl from '../../utils/isValiUrl';
import Momemt from 'react-moment'
import PostComment from "./PostComment";
import SingleReactor from './SingleReactor';
import { confirmAlert } from "react-confirm-alert";
import "react-confirm-alert/src/react-confirm-alert.css";
import checkImgLoading from '../../utils/checkImgLoading'
import { toast } from 'react-toastify';
const Rlike = 'https://programmerikram.com/wp-content/uploads/2025/03/like-icon.svg';
const Rlove = 'https://programmerikram.com/wp-content/uploads/2025/03/love-icon.svg';
const Rhaha = 'https://programmerikram.com/wp-content/uploads/2025/03/haha-icon.svg';
const default_pp_src = 'https://programmerikram.com/wp-content/uploads/2025/03/default-profilePic.png';


const SinglePost = () => {
    let { postId } = useParams()
    let [postData, setPostData] = useState(false)
    let [isShareModal, setIsShareModal] = useState(false)
    let [shareCap, setShareCap] = useState(false)
    let [isLoaded, setIsloaded] = useState(false)
    let isMobile = useIsMobile();
    let navigate = useNavigate();
    const location = useLocation();
    const isEditMode = location.pathname.includes('edit');

    let loadData = async () => {

        let res = await api.get('post/single', { params: { postId } })
        if (res.status == 200) {
            setPostData(res.data)
        }
    }

    useEffect(() => {
        loadData()
    }, [postId])



    let myProfile = useSelector(state => state.profile)
    let myProfileId = myProfile._id;
    let postAuthorProfileId = postData && postData?.author._id
    let [totalReacts, setTotalReacts] = useState(postData && postData.reacts.length)
    let [totalShares, setTotalShares] = useState(postData && postData.shares.length)
    let [totalComments, setTotalComments] = useState(postData && postData.comments.length)
    let [reactType, setReactType] = useState(false);
    let [placedReacts, setPlacedReacts] = useState([]);

    useEffect(() => {
        setTotalReacts(postData && postData.reacts.length)
        setTotalShares(postData && postData.shares.length)
        setTotalComments(postData && postData.comments.length)
    }, [postData])


    var isAuth = myProfileId === postAuthorProfileId ? true : false;
    let [ppUrl, setPpUrl] = useState(postData && postData?.author.profilePic || default_pp_src);





    let postPhoto = postData && postData.photos
    useEffect(() => {
        checkImgLoading(postPhoto, setIsloaded)
        // checkImgLoading(postPhoto, setIsloaded)
    }, [postPhoto])


    useEffect(() => {
        let storedReacts = [];
        postData && postData.reacts.map(react => {
            if (react.profile) {

                switch (react.type) {
                    case 'like':

                        if (!storedReacts.includes('like')) {
                            storedReacts.push('like')
                        }
                        break;
                    case 'love':
                        if (!storedReacts.includes('love')) {
                            storedReacts.push('love')
                        }
                        break;
                    case 'haha':
                        if (!storedReacts.includes('haha')) {
                            storedReacts.push('haha')
                        }
                        break;
                }
                if (react.profile === myProfileId) {
                    setReactType(react.type)
                }
            }

        })

        setPlacedReacts(storedReacts);

    }, [])
    let type = postData && (postData.type || 'post')


    let hideThisPost = async (e) => {
        let target = e.currentTarget;

        if (isAuth) {
            confirmAlert({
                title: "Confirm Action",
                message: "Are you sure you want to delete this post?",
                buttons: [
                    {
                        label: "Yes",
                        onClick: async () => {
                            let deleteRes = await api.post('/post/delete', { postId: postData._id, authorId: postData.author._id })
                            if (deleteRes.status === 200) {
                                $(target).parents('.nf-post').css({
                                    'min-height': '0px',
                                    'padding': '10px'
                                });
                                $(target).parents('.nf-post').html('<p class="fs-6 mb-0 text-center text-danger">' + deleteRes.data.message + '</p>');
                            } else {
                                alert('Failed to delete post')
                            }
                        },
                    },
                    {
                        label: "No",
                        onClick: () => { },
                    },
                ],
            });

        } else {
            $(target).parents('.nf-post').hide();
        }
    }

    let removeReact = async (postType = 'post', target = null) => {
        setTotalReacts(state => state - 1)

        let res = await api.post('/react/removeReact', { id: postData._id, postType: 'post' })
        if (res.status === 200) {
            setTotalReacts(res.data.reacts.length)

            setReactType('')
            return true;
        } else {
            return false;
        }
    }
    let placeReact = async (reactType, postType = 'post', target = null) => {
        setTotalReacts(state => state + 1)

        let placeRes = await api.post('/react/addReact', { id: postData._id, postType, reactType })
        if (placeRes.status === 200) {
            setTotalReacts(placeRes.data.reacts.length)
            setPlacedReacts([...placedReacts, reactType])
            setReactType(reactType)

            return true;
        } else {
            return false;
        }

    }

    let likeBtnOnClick = async (e) => {
        let target = e.currentTarget;
        if ($(target).parent().hasClass('reacted')) {
            removeReact('post');
            $(target).parent().removeClass('reacted')

        } else {
            placeReact('like', 'post', target)
            $(target).parent().addClass('reacted')
        }

    }

    let likeOnClick = async (e) => {
        let target = e.currentTarget;
        $(target).parents('.post-react-container').css('visibility', 'hidden');
        if ($(target).hasClass('reacted')) {
            removeReact('post');
            $(target).removeClass('reacted')


        } else {
            placeReact('like', 'post', target)
            $(target).addClass('reacted')
            $(e.currentTarget).siblings().removeClass('reacted')
        }
        setTimeout(() => {
            $(target).parents('.post-react-container').css('visibility', 'visible');

        }, 500)


    }

    let loveOnClick = (e) => {
        let target = e.currentTarget;
        $(target).parents('.post-react-container').css('visibility', 'hidden');
        if ($(e.currentTarget).hasClass('reacted')) {
            removeReact('post');
            $(e.currentTarget).removeClass('reacted')

        } else {
            placeReact('love', 'post')
            $(e.currentTarget).siblings().removeClass('reacted')
            $(e.currentTarget).addClass('reacted')
        }
        setTimeout(() => {
            $(target).parents('.post-react-container').css('visibility', 'visible');

        }, 500)

    }

    let hahaOnClick = (e) => {
        let target = e.currentTarget;
        $(target).parents('.post-react-container').css('visibility', 'hidden');

        if ($(e.currentTarget).hasClass('reacted')) {
            removeReact();
            $(e.currentTarget).removeClass('reacted')
        } else {
            placeReact('haha', 'post', target)
            $(e.currentTarget).siblings().removeClass('reacted')

            $(e.currentTarget).addClass('reacted')
        }
        setTimeout(() => {
            $(target).parents('.post-react-container').css('visibility', 'visible');

        }, 500)
    }

    let likeMouseOver = e => {
        let target = e.currentTarget
        $(target).children('.post-react-container').css('visibility', 'visible');

    }
    let commentOnClick = (e) => {
        let target = e.currentTarget;
        $(target).parents('.footer').find('.field-comment-text').focus();
    }

    let shareOnClick = (e) => {
        setIsShareModal(true)
    }

    let onCloseShareReq = () => {
        setIsShareModal(false)
    }
    let handleShareCapChange = (e) => {
        let newCaption = e.currentTarget.value
        setShareCap(newCaption)
    }
    let onClickShareNow = async (e) => {
        e.preventDefault();
        let res = await api.post('post/share', { postId: postData._id, caption: shareCap })
        setTotalShares(state => state + 1)
        if (res.status == 200) {
            setIsShareModal(false)
        } else {
            setTotalShares(postData && postData.shares.length)
        }
    }

    let gotoEdit = () => {
        navigate('edit')
    }
    let gotoBack = () => {
        navigate(`/post/${postId}`)
    }

    let authProfilePicture = useSelector(state => state.profile.profilePic)
    let authProfileId = useSelector(state => state.profile._id)

    let postAuthorPP = `${postData && postData?.author.profilePic}`
    let [match, setMatch] = useState(window.matchMedia('(max-width: 768px)').matches)

    useEffect(() => {
        // window width 
        window.matchMedia("(max-width:768px)").addEventListener('change', (e) => {
            setMatch(e.matches)
        })
    }, [])

    let [newCaption, setNewCaption] = useState('')

    useEffect(() => {
        if (postData.caption) {
            setNewCaption(postData.caption)
        }
    }, [postData.caption])

    let handleEditCaption = useCallback(async (e) => {
        e.preventDefault();
        setNewCaption(e.target.value)
        return setPostData(postData => {
            return {
                ...postData,
                caption: e.target.value
            }
        })
    },[])

    let updateCaption = useCallback(async (e) => {
        let res = await api.post('/post/update', { postId, caption: postData.caption })

        if (res.status == 200) {
            toast('Caption Updated')
        }

    },[])
    let PostContent = () => {
        switch (postData.type) {
            case 'share':
                return (
                    <div className="share-nf-post nf-post">
                        <div className="header">
                            <div className="reason">
                                <span className="fs-5">
                                    <b><Link to={`/${postData.author._id}`}>{postData.author.fullName}</Link></b> Shared <b><Link to={`/${postData.parentPost.author._id}`}>{postData.parentPost.author.fullName}'s</Link> </b>
                                    <span className='text-capitalize'>{postData.parentPost.type}</span>
                                </span>
                            </div>
                            <div className="author-info">
                                <div className="left">
                                    <div className="author-pp">
                                        <UserPP profilePic={postData.author.profilePic} profile={postData.author._id} active={false}></UserPP>
                                    </div>
                                    <div className="post-nd-container">
                                        <Link to={'/' + postData.author._id}>
                                            <h4 className="author-name">
                                                {postData.author.fullName}
                                            </h4>

                                            {
                                                postData.feelings && <span className="post-feelings"> <small className="text-lowercase text-secondary">is felling</small> {postData.feelings || ''}</span>

                                            }

                                            {
                                                postData.location && <span className="post-location"> <small className="text-lowercase text-secondary"> at</small> {postData.location || ''}</span>
                                            }
                                        </Link>
                                        <span className="post-time">
                                            <Momemt fromNow >{postData.createdAt}</Momemt>
                                        </span>
                                    </div>

                                </div>
                                <div className="right">
                                    {
                                        isAuth && <button className="post-three-dot"><i className="far fa-ellipsis-h"></i></button>
                                    }

                                    <button onClick={hideThisPost.bind(this)} className="post-close"> <i className="far fa-times"></i></button>
                                </div>
                            </div>
                        </div>

                        <div className={`nf-post ${type} m-3 border body overflow-hidden`}>
                            <div className="header">
                                {
                                    type === 'profilePic' &&
                                    <div className="reason">
                                        <span className="d-none">
                                            <b>Shared a photos</b>
                                        </span>

                                        <span>
                                            Updated Profile Picture
                                        </span>
                                    </div>
                                }
                                <div className="author-info">
                                    <div className="left">
                                        <div className="author-pp">
                                            <UserPP profilePic={postData.parentPost.author.profilePic} profile={postData.parentPost.author._id}></UserPP>
                                        </div>
                                        <div className="post-nd-container">
                                            <Link to={'/' + postData.author._id}>
                                                <h4 className="author-name">
                                                    {postData.parentPost.author.fullName}
                                                </h4>
                                                {
                                                postData.feelings && <span className="post-feelings"> <small className="text-lowercase text-secondary">is felling</small> {postData.feelings || ''}</span>

                                            }

                                            {
                                                postData.location && <span className="post-location"> <small className="text-lowercase text-secondary"> at</small> {postData.location || ''}</span>
                                            }
                                            </Link>
                                            <span className="post-time">
                                                <Momemt fromNow >{postData.parentPost.createdAt}</Momemt>
                                            </span>
                                        </div>

                                    </div>
                                    <div className="right">

                                    </div>
                                </div>

                            </div>
                            <p className="caption">
                                {postData.caption}
                            </p>
                            <div className="body">
                                <p className="caption">
                                    {postData.parentPost.caption}
                                </p>
                                {
                                    isLoaded ? <>
                                        <div className="attachment">
                                            <Link to={`/post/${postData._id}`}>
                                                <img src={postPhoto} alt="post" />

                                            </Link>
                                        </div>
                                    </> :
                                        <>
                                            {
                                                isValidUrl(postPhoto) && <ImageSkleton />
                                            }
                                        </>


                                }
                            </div>

                        </div>

                        <div className="footer">
                            <div className="react-count">
                                <div className="reacts">


                                    {
                                        placedReacts.includes('like') ? <div className="react"> <img src={Rlike} alt="like" />  </div> : <span></span>

                                    }
                                    {
                                        placedReacts.includes('love') ? <div className="react"> <img src={Rlove} alt="love" /> </div> : <span></span>

                                    }
                                    {
                                        placedReacts.includes('haha') ? <div className="react"> <img src={Rhaha} alt="love" /> </div> : <span></span>

                                    }


                                    <span className="text">
                                        {postData.reacts && totalReacts} {totalReacts > 1 ? 'Reacts' : 'React'}
                                    </span>
                                </div>
                                <div className="comment-share">
                                    <div className="comment">
                                        <div className="text">{postData.comments && totalComments}

                                        </div>
                                        <div className="icon">
                                            <i className="far fa-comment-alt"></i>
                                        </div>

                                    </div>
                                    <div className="shares">
                                        <div className="text">
                                            {postData.shares && totalShares}
                                        </div>
                                        <div className="icon">
                                            <i className="fa fa-share"></i>
                                        </div>

                                    </div>
                                </div>


                            </div>
                            <div className="like-comment-share">
                                <div className="buttons-container">
                                    <div className={`react-buttons button ${reactType ? 'reacted' : ''}`}>
                                        <div onClick={likeBtnOnClick} onMouseOver={likeMouseOver} className={`react-like ${reactType == true ? 'reacted' : ''}`}>
                                            <span className="react-icon" datatype={reactType || ''}>
                                                {
                                                    reactType == 'haha' ? <img src={Rhaha} alt="haha" /> : <span></span>
                                                }
                                                {
                                                    reactType == 'love' ? <img src={Rlove} alt="love" /> : <span></span>
                                                }
                                                {
                                                    reactType == false || reactType == 'like' ? <img src={Rlike} alt="like" /> : <span></span>
                                                }
                                            </span>
                                            <span className="text text-capitalize">{reactType ? reactType : 'like'}</span>
                                        </div>
                                        <div className="post-react-container">
                                            <div className={`react react-like ${reactType == 'like' ? 'reacted' : ''}`} onClick={likeOnClick} id="postReactLike" title="Like">
                                                <img src={Rlike} alt="love" />
                                            </div>
                                            <div className={`react react-love ${reactType == 'love' ? 'reacted' : ''}`} onClick={loveOnClick} id="postReactLove" title="Love">
                                                <img src={Rlove} alt="love" />
                                            </div>
                                            <div className={`react react-haha ${reactType == 'haha' ? 'reacted' : ''}`} onClick={hahaOnClick} id="postReactHaha" title="Haha">
                                                <img src={Rhaha} alt="haha" />
                                            </div>
                                        </div>
                                    </div>
                                    <div onClick={commentOnClick} className="comment button">
                                        <span className="icon">
                                            <i className="far fa-comment-alt"></i>
                                        </span>
                                        <span className="text">Comment</span>
                                    </div>
                                    <div onClick={shareOnClick} className="share button">
                                        <span className="icon">
                                            <i className="far fa-share"></i>
                                        </span>
                                        <span className="text">Share</span>

                                    </div>
                                    <ModalContainer
                                        title="View Cover Photo"
                                        style={{ width: isMobile ? '95%' : "600px", top: "50%" }}
                                        isOpen={isShareModal}
                                        onRequestClose={onCloseShareReq}
                                        id="cp-view-modal"
                                    >

                                        <div className="modal-header">
                                            <div></div>
                                            <div onClick={onCloseShareReq} className="modal-close-btn text-danger"><i className="far fa-times"></i></div>
                                        </div>

                                        <div className='modal-body'>
                                            <div className="share-post-container">
                                                <div className="share-post-header">
                                                    <div className="row">
                                                        <div className="col-1">
                                                            <UserPP profilePic={myProfile.profilePic}></UserPP>

                                                        </div>
                                                        <div className="col-3">
                                                            <h3>{myProfile.fullName}</h3>
                                                        </div>
                                                    </div>
                                                    <div className="row">
                                                        <div className="col">
                                                            Your Sharing {postData.author.fullName || 'Someone'}'s Post
                                                        </div>
                                                    </div>
                                                </div>
                                                <div className="share-post-body my-3">
                                                    <textarea className="form-control" rows="3" onChange={handleShareCapChange.bind(this)} placeholder="What's On Your Mind?"></textarea>
                                                    <div className="share-post-button text-end mt-2">
                                                        <button className="btn btn-primary" onClick={onClickShareNow}>Share Now</button>
                                                    </div>
                                                </div>

                                                <div className="share-post-footer">
                                                    {/* <button className="btn btn-primary">Share Now</button> */}
                                                </div>

                                            </div>
                                        </div>


                                    </ModalContainer>
                                </div>
                            </div>
                            {/* <PostComment post={postData} commentState={setTotalComments} myProfile={myProfile} authProfile={authProfileId} authProfilePicture={authProfilePicture}></PostComment> */}



                        </div>

                    </div>

                )
                break;

            default:
                return (
                    <div className={`nf-post ${type}`}>
                        <div className="header">
                            {
                                type === 'profilePic' &&
                                <div className="reason">
                                    <span className="d-none">
                                        <b>A bitch</b> commented.
                                    </span>

                                    <span>
                                        Updated Profile Picture
                                    </span>
                                </div>
                            }
                            <div className="author-info">
                                <div className="left">
                                    <div className="author-pp">
                                        <UserPP profilePic={postAuthorPP} profile={postData.author._id} active={true}></UserPP>
                                    </div>
                                    <div className="post-nd-container">
                                        <h4 className="author-name">
                                            <Link to={'/' + postData.author._id}>
                                                {postData.author.fullName}
                                            </Link>



                                            {
                                                postData.fellings && <span className="post-feelings"> <small className="text-lowercase text-secondary">is felling</small> {postData.fellings || ''}</span>

                                            }

                                            {
                                                postData.location && <span className="post-location"> <small className="text-lowercase text-secondary"> at</small> {postData.location || ''}</span>
                                            }
                                        </h4>
                                        <span className="post-time">
                                            <Momemt fromNow >{postData.createdAt}</Momemt>
                                        </span>
                                    </div>

                                </div>
                                <div className="right">
                                    {
                                        isAuth && !isEditMode && <>

                                            {/* <button className="post-three-dot"><i className="far fa-ellipsis-h"></i></button> */}
                                            <button onClick={gotoEdit} className="post-three-dot"><i className="far fs-6 fa-pen"></i></button>
                                        </>
                                    }
                                    {
                                isEditMode && <button onClick={gotoBack} className="post-three-dot"><i className="fas fa-arrow-left"></i></button>

}


                                    <button onClick={hideThisPost.bind(this)} className="post-close"> <i className="far fa-times"></i></button>
                                </div>
                            </div>

                        </div>
                        <div className="body">

                            {
                                isAuth && isEditMode ? <>
                                    <div className='input-group'>
                                        <input
                                            onChange={handleEditCaption.bind(this)}
                                            className='caption-editor form-control mb-2'
                                            placeholder='Enter Your Caption'
                                            value={newCaption}
                                        />
                                        <div className='input-group-prepend'>
                                            <button onClick={updateCaption} className='btn btn-primary'>Update</button>
                                        </div>
                                    </div>

                                </> : <p className="caption">
                                    {postData.caption}
                                </p>
                            }

                            {
                                isLoaded ? <>
                                    <div className="attachment">
                                        <Link to={`/post/${postData._id}`}>
                                            <img src={postPhoto} alt="post" />

                                        </Link>
                                    </div>
                                </> :
                                    <>
                                        {
                                            isValidUrl(postPhoto) && <ImageSkleton />
                                        }
                                    </>


                            }

                        </div>
                        <div className="footer">
                            <div className="react-count">
                                <div className="reacts">


                                    {
                                        placedReacts.includes('like') ? <div className="react"> <img src={Rlike} alt="like" />  </div> : <span></span>

                                    }
                                    {
                                        placedReacts.includes('love') ? <div className="react"> <img src={Rlove} alt="love" /> </div> : <span></span>

                                    }
                                    {
                                        placedReacts.includes('haha') ? <div className="react"> <img src={Rhaha} alt="love" /> </div> : <span></span>

                                    }


                                    <span className="text">
                                        {postData.reacts && totalReacts} {totalReacts > 1 ? 'Reacts' : 'React'}
                                    </span>
                                </div>
                                <div className="comment-share">
                                    <div className="comment">
                                        <div className="text">{postData.comments && totalComments}

                                        </div>
                                        <div className="icon">
                                            <i className="far fa-comment-alt"></i>
                                        </div>

                                    </div>
                                    <div className="shares">
                                        <div className="text">
                                            {postData.shares && totalShares}
                                        </div>
                                        <div className="icon">
                                            <i className="fa fa-share"></i>
                                        </div>

                                    </div>
                                </div>


                            </div>
                            <div className="like-comment-share">
                                <div className="buttons-container">
                                    <div className={`react-buttons button ${reactType ? 'reacted' : ''}`}>
                                        <div onClick={likeBtnOnClick} onMouseOver={likeMouseOver} className={`react-like ${reactType == true ? 'reacted' : ''}`}>
                                            <span className="react-icon" datatype={reactType || ''}>
                                                {
                                                    reactType == 'haha' ? <img src={Rhaha} alt="haha" /> : <span></span>
                                                }
                                                {
                                                    reactType == 'love' ? <img src={Rlove} alt="love" /> : <span></span>
                                                }
                                                {
                                                    reactType == false || reactType == 'like' ? <img src={Rlike} alt="like" /> : <span></span>
                                                }
                                            </span>
                                            <span className="text text-capitalize">{reactType ? reactType : 'like'}</span>
                                        </div>
                                        <div className="post-react-container">
                                            <div className={`react react-like ${reactType == 'like' ? 'reacted' : ''}`} onClick={likeOnClick} id="postReactLike" title="Like">
                                                <img src={Rlike} alt="love" />
                                            </div>
                                            <div className={`react react-love ${reactType == 'love' ? 'reacted' : ''}`} onClick={loveOnClick} id="postReactLove" title="Love">
                                                <img src={Rlove} alt="love" />
                                            </div>
                                            <div className={`react react-haha ${reactType == 'haha' ? 'reacted' : ''}`} onClick={hahaOnClick} id="postReactHaha" title="Haha">
                                                <img src={Rhaha} alt="haha" />
                                            </div>
                                        </div>
                                    </div>
                                    <div onClick={commentOnClick} className="comment button">
                                        <span className="icon">
                                            <i className="far fa-comment-alt"></i>
                                        </span>
                                        <span className="text">Comment</span>
                                    </div>
                                    <div onClick={shareOnClick} className="share button">
                                        <span className="icon">
                                            <i className="far fa-share"></i>
                                        </span>
                                        <span className="text">Share</span>
                                        <ModalContainer
                                            title="Share Post"
                                            style={{ width: isMobile ? '95%' : "600px", top: "50%" }}
                                            isOpen={isShareModal}
                                            onRequestClose={onCloseShareReq}
                                            id="cp-view-modal"
                                        >

                                            <div className="modal-header">
                                                <div></div>
                                                <div onClick={onCloseShareReq} className="modal-close-btn text-danger"><i className="far fa-times"></i></div>
                                            </div>
                                            <div className='modal-body'>
                                                <div className="share-post-container">
                                                    <div className="share-post-header">
                                                        <div className="row">
                                                            <div className="col-1">
                                                                <UserPP profilePic={myProfile.profilePic}></UserPP>

                                                            </div>
                                                            <div className="col-3">
                                                                <h3>{myProfile.fullName}</h3>
                                                            </div>
                                                        </div>
                                                        <div className="row">
                                                            <div className="col">
                                                                Your Sharing {postData.author.fullName || 'Someone'}'s Post
                                                            </div>
                                                        </div>
                                                    </div>
                                                    <div className="share-post-body my-3">
                                                        <textarea className="form-control" onChange={(e) => setShareCap(e.target.value)} value={shareCap} ></textarea>
                                                        <div className="share-post-button text-end mt-2">
                                                            <button className="btn btn-primary" onClick={onClickShareNow}>Share Now</button>
                                                        </div>
                                                    </div>

                                                    <div className="share-post-footer">
                                                        {/* <button className="btn btn-primary">Share Now</button> */}
                                                    </div>

                                                </div>
                                            </div>


                                        </ModalContainer>
                                    </div>
                                </div>
                            </div>

                        </div>

                    </div>
                )
                break;
        }
    }




    return (
        <div>

            <Container className='single-post-container' >
                <Row>
                    <Col md="6" className='br'>
                        <div id="post-container">
                            <div>
                                {postData && (<PostContent />)}

                            </div>

                        </div>

                    </Col>

                    <Col md="3" className='br'>
                        <div className='sp-reacts-container'>
                            <h4 className='section-title'>Views {postData.viewers && `(${postData.viewers.length})`}</h4>

                            <ul className='sp-reacts'>

                                {postData.viewers && postData.viewers.map((item, index) => {

                                    return (

                                        <SingleReactor key={index} reacts={postData.reacts} viewer={item._id} />

                                    )

                                })}


                            </ul>
                        </div>
                    </Col>
                    <Col md="3">
                        <div className='sp-comments-container'>
                            <h4 className='section-title'>Comments {postData?.comments && `(${postData?.comments.length})`}</h4>
                            {postData?.comments && (<PostComment post={postData} commentState={setTotalComments} allComments={postData.comments || []} myProfile={myProfile} authProfile={authProfileId} isEditMode={isEditMode} authProfilePicture={authProfilePicture}></PostComment>)}
                        </div>


                    </Col>

                </Row>

            </Container>


        </div>
    );
}

export default SinglePost;

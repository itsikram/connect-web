import React, { useCallback, useEffect, useRef, useState } from 'react';
import ImageSkleton from '../../skletons/post/ImageSkleton';
import { useParams } from 'react-router-dom';
import api from '../../api/api';
import $ from 'jquery'
import { useSelector } from 'react-redux'
import UserPP from "../UserPP";
import { Link } from "react-router-dom";
import { Container, Row, Col } from 'react-bootstrap';
import Momemt from 'react-moment'
import SingleReactor from './SingleReactor';
import { confirmAlert } from "react-confirm-alert";
import "react-confirm-alert/src/react-confirm-alert.css"; // Import CSS
import { saveVideoFromUrl } from '../../utils/useSavedVideos';

const Rlike = 'https://programmerikram.com/wp-content/uploads/2025/03/like-icon.svg';
const Rlove = 'https://programmerikram.com/wp-content/uploads/2025/03/love-icon.svg';
const Rhaha = 'https://programmerikram.com/wp-content/uploads/2025/03/haha-icon.svg';
const default_pp_src = 'https://programmerikram.com/wp-content/uploads/2025/03/default-profilePic.png';


const SinglePost = (watch) => {
    let { postId } = useParams()
    let [watchData, setWatchData] = useState(false)
    const [watchUrl, setWatchUrl] = useState(watch.videoUrl)
    let displayedWatch = useRef(null)
    let captionTextarea = useRef(null)
    const { watchId } = useParams()
    let loadData = async () => {

        let res = await api.get('watch/single', { params: { watchId } })
        if (res.status == 200) {
            setWatchData(res.data)
            setWatchUrl(res.data.videoUrl)
        }
    }

    useEffect(() => {
        loadData()
    }, [postId])



    let myProfile = useSelector(state => state.profile)
    let myProfileId = myProfile._id;
    let postAuthorProfileId = watchData && watchData?.author._id
    let [totalReacts, setTotalReacts] = useState(watchData && watchData.reacts.length)
    let [totalShares, setTotalShares] = useState(watchData && watchData.shares.length)
    let [totalComments, setTotalComments] = useState(watchData && watchData.comments.length)
    let [reactType, setReactType] = useState(false);
    let [isAuthor, setIsAuthor] = useState(watchData?.author?._id === myProfile?._id)
    let [isEditCaption, setIsEditCaption] = useState(false)
    let [placedReacts, setPlacedReacts] = useState([]);
    const [imageExists, setImageExists] = useState(null);
    const [thumbExists, setThumbExists] = useState(null);


    var isAuth = myProfileId === postAuthorProfileId ? true : false;
    var pp_url = watchData && watchData?.author.profilePic
    const checkImage = (url) => {
        const img = new Image();
        img.src = url;

        img.onload = () => setImageExists(true);
        img.onerror = () => setImageExists(false);
    };



    useEffect(() => {
        let storedReacts = [];
        watchData && watchData.reacts.map(react => {
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

    let postPhoto = watchData && watchData.photos
    const checkThumbImage = (url) => {
        const img = new Image();
        img.src = url;

        img.onload = () => setThumbExists(true);
        img.onerror = () => setThumbExists(false);
    };

    checkThumbImage(postPhoto)
    checkImage(pp_url);

    if (!imageExists) {
        pp_url = default_pp_src;
    }
    let type = watchData && (watchData.type || 'post')


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
                            let deleteRes = await api.post('/post/delete', { postId: watchData._id, authorId: watchData.author._id })
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

        let res = await api.post('/react/removeReact', { id: watchData._id, postType: 'post' })
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

        let placeRes = await api.post('/react/addReact', { id: watchData._id, postType, reactType })
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

    }

    let authProfilePicture = useSelector(state => state.profile.profilePic)
    let authProfileId = useSelector(state => state.profile._id)

    let postAuthorPP = `${watchData && watchData?.author.profilePic}`
    let [match, setMatch] = useState(window.matchMedia('(max-width: 768px)').matches)

    useEffect(() => {
        // window width 
        window.matchMedia("(max-width:768px)").addEventListener('change', (e) => {
            setMatch(e.matches)
        })
    }, [])

    useEffect(() => {
        if (myProfile?.id && watchData?.author && watchData?.author._id) {
            setIsAuthor(myProfile._id === watchData.author._id)
        }
    }, [myProfile, watchData])


    let handleUpdateCaption = useCallback(async (e) => {
        if (captionTextarea?.current && watchData?._id) {
            let newCaption = captionTextarea.current.value
            let response = await api.post('/watch/update', { caption: newCaption, watchId: watchData._id })
            if (response.status === 200) {
                setWatchData({ ...watchData, caption: newCaption })
                // window.location.reload();
            }

        }
    }, [captionTextarea, watchData])

    let handleCaptionEditBtnClick = () => {

    }

    let handleDownloadVideoClick = useCallback((e) => {

        if (!watch?.videoUrl) return;
        saveVideoFromUrl(watchData._id, watchData.videoUrl, watchData)
    }, [watch])



    return (
        <div>

            <Container className='single-post-container' >
                <Row>


                    <Col md="6" className='offset-md-3'>
                        <div id="post-container">
                            <div>
                                {watchData && (
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
                                                        <UserPP profilePic={postAuthorPP} profile={watchData.author._id} active={true}></UserPP>
                                                    </div>
                                                    <div className="post-nd-container">
                                                        <Link to={'/' + watchData.author._id}>
                                                            <h4 className="author-name">
                                                                {watchData.author.user.firstName + ' ' + watchData.author.user.surname}
                                                            </h4>
                                                        </Link>
                                                        <span className="post-time">
                                                            <Momemt fromNow >{watchData.createdAt}</Momemt>
                                                        </span>
                                                    </div>

                                                </div>
                                                <div className="right">
                                                    <button onClick={handleDownloadVideoClick} className="watch-three-dot"><i className="fas fa-download"></i></button>

                                                    {
                                                        isAuth && <button className="post-three-dot"><i className="far fa-ellipsis-h"></i></button>
                                                    }

                                                    <button onClick={hideThisPost.bind(this)} className="post-close"> <i className="far fa-times"></i></button>
                                                </div>
                                            </div>

                                        </div>
                                        <div className="body">
                                            <div className="caption" style={{ display: 'flex', alignItems: 'center', justifyContent: 'start' }}>
                                                {isAuthor && isEditCaption && <>
                                                    <textarea style={{ width: '90%' }} ref={captionTextarea} />

                                                </>}
                                                {!isEditCaption && <p style={{ margin: 0, marginRight: 20 }}>{watchData.caption}</p>}
                                                {
                                                    isAuthor && <button style={{}} className={`btn ${isEditCaption ? 'btn-primary' : 'btn-danger'}`} onClick={(e) => { setIsEditCaption(!isEditCaption) }}>
                                                        {
                                                            isEditCaption ? <><i onClick={handleUpdateCaption} className='fas fa-check'></i></> : <>
                                                                <i onClick={handleCaptionEditBtnClick} className='fas fa-pen'></i>

                                                            </>
                                                        }
                                                    </button>
                                                }
                                            </div>
                                            {
                                                (watchUrl &&
                                                    <div className="attachment">
                                                        <Link to={`/watch/${watch._id}`}>
                                                            <video id={`watch-${watch._id}`} ref={displayedWatch} className="w-100 watch-video" controls src={`${watchUrl}`}></video>
                                                            {/* <img src={watchPhoto} alt="watch" /> */}

                                                        </Link>
                                                    </div>

                                                    ||

                                                    <>
                                                        <ImageSkleton />
                                                    </>

                                                )
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
                                                        {watchData.reacts && totalReacts} {totalReacts > 1 ? 'Reacts' : 'React'}
                                                    </span>
                                                </div>
                                                <div className="comment-share">
                                                    <div className="comment">
                                                        <div className="text">{watchData.comments && totalComments}

                                                        </div>
                                                        <div className="icon">
                                                            <i className="far fa-comment-alt"></i>
                                                        </div>

                                                    </div>
                                                    <div className="shares">
                                                        <div className="text">
                                                            {watchData.shares && totalShares}
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
                                                </div>
                                            </div>

                                        </div>

                                    </div>
                                )}
                            </div>

                        </div>

                    </Col>

                    {/* <Col md="3" className='br'>
                        <div className='sp-reacts-container'>
                            <h4 className='section-title'>Reactors {watchData.reacts && `(${watchData.reacts.length})`}</h4>

                            <ul className='sp-reacts'>

                                {watchData.reacts && watchData.reacts.map((item, index) => {

                                    return (

                                        <SingleReactor key={index} reactor={item} />

                                    )

                                })}


                            </ul>
                        </div>
                    </Col>
                    <Col md="3">
                        <div className='sp-comments-container'>
                            <h4 className='section-title'>Comments {watchData?.comments && `(${watchData?.comments.length})`}</h4>
                            { {watchData?.comments && (<PostComment post={watchData} commentState={setTotalComments} myProfile={myProfile} authProfile={authProfileId} authProfilePicture={authProfilePicture}></PostComment>)} }
                        </div>


                    </Col> */}

                </Row>

            </Container>


        </div>
    );
}

export default SinglePost;

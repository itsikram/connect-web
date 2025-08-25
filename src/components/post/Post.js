import React, { useState, useEffect, useCallback, useRef } from "react";
import $ from 'jquery'
import { useDispatch, useSelector } from 'react-redux'
import UserPP from "../UserPP";
import { Link, useNavigate } from "react-router-dom";
import Momemt from 'react-moment'
import api from "../../api/api";
import PostComment from "./PostComment";
import { confirmAlert } from "react-confirm-alert";
import "react-confirm-alert/src/react-confirm-alert.css"; // Import CSS
import socket from "../../common/socket";
import ImageSkleton from "../../skletons/post/ImageSkleton";
import ModalContainer from "../modal/ModalContainer";
import useIsMobile from "../../utils/useIsMobile"
import checkImgLoading from "../../utils/checkImgLoading";
import isValidUrl from "../../utils/isValiUrl";
import { addPost } from "../../services/actions/postActions";
const Rlike = 'https://programmerikram.com/wp-content/uploads/2025/03/like-icon.svg';
const Rlove = 'https://programmerikram.com/wp-content/uploads/2025/03/love-icon.svg';
const Rhaha = 'https://programmerikram.com/wp-content/uploads/2025/03/haha-icon.svg';

const default_pp_src = 'https://programmerikram.com/wp-content/uploads/2025/03/default-profilePic.png';

let getLastPostId = () => {
    localStorage.getItem('lastPostId')
}
let setVisitedPost = (id) => {
    localStorage.setItem('lastPostId', id)
}


let Post = ({ data, postContainer, index }) => {
    let post = data || {}
    let myProfile = useSelector(state => state.profile)
    let myProfileId = myProfile._id;
    let postAuthorProfileId = post?.author._id
    let [totalReacts, setTotalReacts] = useState(post.reacts.length)
    let [totalShares, setTotalShares] = useState(post.shares.length)

    let [totalComments, setTotalComments] = useState(post.comments.length)
    let [allComments, setAllComments] = useState(post.comments)

    let [isActive, setIsActive] = useState(false)
    let [reactType, setReactType] = useState(false);
    let [isReacted, setIsReacted] = useState(false)
    let [shareCap, setShareCap] = useState('');
    let [placedReacts, setPlacedReacts] = useState([]);
    let [isShareModal, setIsShareModal] = useState(false);
    let [isPostOption, setIsPostOption] = useState(false);
    const [isLoaded, setIsloaded] = useState(false);
    let isMobile = useIsMobile();
    let navigate = useNavigate()
    let nfPosts = useRef([]);
    let displayedPost = useRef();

    let dispatch = useDispatch()

    // useEffect(() => {
    //     const observer = new IntersectionObserver(
    //         entries => {
    //             entries.forEach(entry => {
    //                 if (entry.isIntersecting) {
    //                     const id = entry.target.dataset.id;
    //                     props.handlePostEnter(id);
    //                 }
    //             });
    //         },
    //         { threshold: 0.5 } // Trigger when 50% of the element is visible
    //     );

    //     nfPosts?.current.forEach(el => {
    //         if (el) observer.observe(el);
    //     });

    //     return () => observer.disconnect();
    // }, [props.handlePostEnter]);


    useEffect(() => {

        socket.emit('is_active', { profileId: postAuthorProfileId, myId: myProfileId })
        socket.on('is_active', (isUserActive, lastLogin, activeProfileId) => {
            if (activeProfileId === myProfileId) {
                setIsActive(isUserActive)
            }

        })

        return () => socket.off('is_active');

    }, [myProfile])



    var isAuth = myProfileId === postAuthorProfileId ? true : false;
    var pp_url = post.author.profilePic;



    useEffect(() => {
        let storedReacts = [];
        post.reacts.map(react => {
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
                    setIsReacted(true)
                }
            }

        })

        setPlacedReacts(storedReacts);

    }, [])

    let postPhoto = post.photos
    let type = post.type || 'post'


    useEffect(() => {
        checkImgLoading(postPhoto, setIsloaded)
    }, [postPhoto])



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
                            let deleteRes = await api.post('/post/delete', { postId: post._id, authorId: post.author._id })
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
        setReactType(false)

        let res = await api.post('/react/removeReact', { id: post._id, postType: 'post', reactor: myProfileId })
        if (res.status === 200) {
            setIsReacted(false)
            return true;
        } else {
            setTotalReacts(state => state + 1)
        }
    }
    let placeReact = async (reactType, postType = 'post', target = null) => {

        if (!isReacted) {
            setTotalReacts(state => state + 1)

        }
        // setTotalReacts(state => state + 1)


        setPlacedReacts([...placedReacts, reactType])
        setReactType(reactType)

        let placeRes = await api.post('/react/addReact', { id: post._id, postType, reactType })
        if (placeRes.status === 200) {
            setIsReacted(true)

            return true;
        } else {
            setTotalReacts(post.reacts)
            setPlacedReacts([...placedReacts])
            setReactType(false)
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

    let onClickShareNow = useCallback(async (e) => {
        e.preventDefault();
        let res = await api.post('post/share', { postId: post._id, caption: shareCap })

        if (res.status == 200) {
            setTotalShares(state => state + 1)
            dispatch(addPost(res.data.post))
            setIsShareModal(false)
        }
    },[dispatch])

    let authProfilePicture = useSelector(state => state.profile.profilePic)
    let authProfileId = useSelector(state => state.profile._id)


    let postHeaderClick = (e) => {
        navigate(`/post/${post._id}`)
    }
    let gotoEdit = useCallback(e => {
        navigate(`/post/${post._id}/edit`)
    },[])


    let postAuthorPP = `${post.author.profilePic}`


    let postOptionMenu = useRef(null)
    useEffect(() => {
        const handleClickOutside = (event) => {
            if (postOptionMenu.current && !postOptionMenu.current.contains(event.target)) {
                setIsPostOption(false);
            }
        };
        document.addEventListener('mousedown', handleClickOutside);
        return () => {
            document.removeEventListener('mousedown', handleClickOutside);
        };
    }, []);

    let postOptionClick = useCallback(e => {
        setIsPostOption(!isPostOption)
    },[])


    // useEffect(() => {


    //     window.addEventListener('scroll', () => {
    //         if (isElementNearTop(nfwatch?.current)) {
    //             document.querySelectorAll('.watch-video').forEach((element => {
    //                 element.pause();
    //             }))
    //             displayedWatch.current.play()
    //         }
    //     });
    // }, [])


    const triggeredSet = useRef(new Set()); // Keeps track of already-triggered items
    useEffect(() => {
        const handleVisible = (postId) => {
            socket.emit('viewPost', { visitorId: myProfileId, postId })
            // Place your custom logic here (e.g. animation, API call, etc.)
        };

        const observer = new IntersectionObserver(
            (entries, obs) => {
                entries.forEach((entry) => {
                    const index = Number(entry.target.dataset.index);
                    if (entry.isIntersecting && !triggeredSet.current.has(index)) {
                        triggeredSet.current.add(index);
                        handleVisible(entry.target.dataset.id);
                        obs.unobserve(entry.target); // Stop observing this element
                    }
                });
            },
            {
                root: postContainer.current,
                threshold: 0.5,
            }
        );

        nfPosts.current.forEach((el) => el && observer.observe(el));

        return () => {
            observer.disconnect();
        };
    }, []);






    let PostContent = () => {
        switch (type) {
            case 'share':
                return (
                    <div data-id={post._id} ref={(el) => (nfPosts.current[index] = el)} data-index={index} className="share-nf-post nf-post">
                        <div className="header">
                            <div className="reason">
                                <span className="">
                                    <b><Link to={`/${post.author._id}`}>{post.author.fullName}</Link></b> Shared <b><Link to={`/${post?.parentPost.author._id}`}>{post?.parentPost.author.fullName}'s</Link> </b>
                                    <span className='text-capitalize'>{post?.parentPost.type}</span>
                                </span>
                            </div>
                            <div className="author-info">
                                <div className="left">
                                    <div className="author-pp">
                                        <UserPP profilePic={post.author.profilePic} profile={post.author._id} active={false}></UserPP>
                                    </div>
                                    <div className="post-nd-container">
                                        <Link to={'/' + post.author._id}>
                                            <h4 className="author-name">
                                                {post.author.fullName}
                                            </h4>
                                        </Link>
                                        <span className="post-time">
                                            <Momemt fromNow >{post.createdAt}</Momemt>
                                        </span>
                                    </div>

                                </div>
                                <div className="right">
                                    <>
                                        <button onClick={postOptionClick.bind(this)} className="post-three-dot"><i className="far fa-ellipsis-h"></i></button>
                                        {isPostOption && (
                                            <div className="post-option-menu" ref={postOptionMenu} >
                                                <ul>
                                                    {isAuth && (<><li onClick={gotoEdit}>Edit Post</li><li>Edit Audience</li></>)}
                                                    <li>Report This Post</li>
                                                </ul>
                                            </div>
                                        )}
                                    </>


                                    <button onClick={hideThisPost.bind(this)} className="post-close"> <i className="far fa-times"></i></button>
                                </div>
                            </div>
                        </div>
                        <div ref={displayedPost} data-id={post._id} className="body">
                            <p className="caption">
                                {post.caption}
                            </p>
                            <div className={`nf-post ${type} m-3 border overflow-hidden`}>
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
                                                <UserPP profilePic={post?.parentPost.author.profilePic} profile={post?.parentPost.author._id} active={isActive}></UserPP>
                                            </div>
                                            <div className="post-nd-container">
                                                <Link to={'/' + post.author._id}>
                                                    <h4 className="author-name">
                                                        {post?.parentPost.author.fullName}
                                                    </h4>
                                                    {
                                                        post.feelings && <span className="post-feelings"> <small className="text-lowercase text-secondary">is felling</small> {post.feelings || ''}</span>

                                                    }

                                                    {
                                                        post.location && <span className="post-location"> <small className="text-lowercase text-secondary"> at</small> {post.location || ''}</span>
                                                    }
                                                </Link>
                                                <span className="post-time">
                                                    <Momemt fromNow >{post?.parentPost.createdAt}</Momemt>
                                                </span>
                                            </div>

                                        </div>
                                        <div className="right">

                                        </div>
                                    </div>

                                </div>

                                <div className="body">
                                    <p className="caption">
                                        {post?.parentPost.caption}
                                    </p>
                                    {
                                        isLoaded && isValidUrl(postPhoto) ? <> <div className="attachment">
                                            <Link to={`/post/${post._id}`}>
                                                <img src={postPhoto} alt="post" />

                                            </Link>
                                        </div></> :
                                            <>
                                                {
                                                    isValidUrl(postPhoto) && <ImageSkleton />
                                                }
                                            </>


                                    }
                                </div>

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
                                        {post.reacts && totalReacts} {totalReacts > 1 ? 'Reacts' : 'React'}
                                    </span>
                                </div>
                                <div className="comment-share">
                                    <div className="comment">
                                        <div className="text">{post.comments && totalComments}

                                        </div>
                                        <div className="icon">
                                            <i className="far fa-comment-alt"></i>
                                        </div>

                                    </div>
                                    <div className="shares">
                                        <div className="text">
                                            {post.shares && totalShares}
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

                                    {
                                        !isAuth && <>
                                            <div onClick={shareOnClick} className="share button">
                                                <span className="icon">
                                                    <i className="far fa-share"></i>
                                                </span>
                                                <span className="text">Share</span>

                                            </div>
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
                                                <div className="modal-body">
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
                                                                    You're Sharing {post.author.fullName || 'Someone'}'s Post
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <div className="share-post-body my-3">
                                                            <textarea className="form-control" rows="3" placeholder="What's On Your Mind?" onChange={(e) => setShareCap(e.target.value)} value={shareCap}></textarea>
                                                            <div className="share-post-button text-end mt-2">
                                                                <button className="btn btn-primary" onClick={onClickShareNow.bind(this)}>Share Now</button>
                                                            </div>
                                                        </div>

                                                        <div className="share-post-footer">
                                                            {/* <button className="btn btn-primary">Share Now</button> */}
                                                        </div>

                                                    </div>
                                                </div>


                                            </ModalContainer>
                                        </>
                                    }


                                </div>
                            </div>
                            <PostComment post={post} commentState={setTotalComments} allComments={allComments} setAllComments={setAllComments} myProfile={myProfile} authProfile={authProfileId} authProfilePicture={authProfilePicture}></PostComment>



                        </div>

                    </div>
                )
                break;

            default:
                return (
                    <div data-id={post._id} ref={(el) => (nfPosts.current[index] = el)} data-index={index} className={`nf-post ${type}`}>
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
                                        <UserPP profilePic={postAuthorPP} profile={post.author._id} active={isActive}></UserPP>
                                    </div>
                                    <div className="post-nd-container">
                                        <h4 className="author-name" onClick={postHeaderClick.bind(this)}>
                                            <Link to={'/' + post.author._id}>
                                                {post.author.fullName}
                                            </Link>


                                            {
                                                post.feelings && <span className="post-feelings"> <small className="text-lowercase text-secondary">is felling</small> {post.feelings || ''}</span>

                                            }

                                            {
                                                post.location && <span className="post-location"> <small className="text-lowercase text-secondary"> at</small> {post.location || ''}</span>
                                            }
                                        </h4>
                                        <span className="post-time">
                                            <Momemt fromNow >{post.createdAt}</Momemt>
                                        </span>
                                    </div>

                                </div>
                                <div className="right">
                                    <button onClick={postOptionClick.bind(this)} className="post-three-dot"><i className="far fa-ellipsis-h"></i></button>
                                    {isPostOption && (
                                        <div className="post-option-menu" ref={postOptionMenu} >
                                            <ul>
                                                {isAuth && (<><li onClick={gotoEdit}>Edit Post</li><li>Edit Audience</li></>)}
                                                <li>Report This Post</li>
                                            </ul>
                                        </div>
                                    )}

                                    <button onClick={hideThisPost.bind(this)} className="post-close"> <i className="far fa-times"></i></button>
                                </div>
                            </div>

                        </div>
                        <div ref={displayedPost} data-id={post._id} className="body">
                            <p className="caption">
                                {post.caption}
                            </p>
                            {
                                isLoaded && isValidUrl(postPhoto) ? <> <div className="attachment">
                                    <Link to={`/post/${post._id}`}>
                                        <img src={postPhoto} alt="post" />

                                    </Link>
                                </div></> :
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
                                        {post.reacts && totalReacts} {totalReacts > 1 ? 'Reacts' : 'React'}
                                    </span>
                                </div>
                                <div className="comment-share">
                                    <div className="comment">
                                        <div className="text">{post.comments && totalComments}

                                        </div>
                                        <div className="icon">
                                            <i className="far fa-comment-alt"></i>
                                        </div>

                                    </div>
                                    <div className="shares">
                                        <div className="text">
                                            {post.shares && totalShares}
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
                                        title="Share Post"
                                        style={{ width: isMobile ? '95%' : "600px", top: "50%" }}
                                        isOpen={isShareModal}
                                        onRequestClose={onCloseShareReq}
                                        id="cp-view-modal"
                                    >
                                        <div className="modal">
                                            <div className="modal-header">
                                                <h3 className="modal-title"></h3>
                                                <div className="modal-close-btn"><i className="far fa-times"></i></div>
                                            </div>
                                        </div>

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
                                                        Your Sharing {post.author.fullName || 'Someone'}'s Post
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

                                    </ModalContainer>
                                </div>
                            </div>
                            <PostComment post={post} commentState={setTotalComments} allComments={allComments} setAllComments={setAllComments} myProfile={myProfile} authProfile={authProfileId} authProfilePicture={authProfilePicture}></PostComment>



                        </div>

                    </div>
                )
                break;
        }
    }


    return (
        <>
            <PostContent />
        </>

    )
}

export default Post;
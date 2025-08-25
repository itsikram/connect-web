import React, { useState, useEffect, useRef, useCallback } from "react";
import $ from 'jquery'
import { useSelector } from 'react-redux'
import UserPP from "../UserPP";
import { Link } from "react-router-dom";

import Momemt from 'react-moment'
import api from "../../api/api";
import WatchComment from "./WatchComment";
import { confirmAlert } from "react-confirm-alert";
import "react-confirm-alert/src/react-confirm-alert.css"; // Import CSS
import socket from "../../common/socket";
import WatchSkeleton from "../../skletons/watch/WatchSkeleton";
import ImageSkleton from "../../skletons/ImageSkleton";
import { saveVideoFromUrl } from "../../utils/useSavedVideos";
import checkImgLoading from "../../utils/checkImgLoading";

const Rlike = 'https://programmerikram.com/wp-content/uploads/2025/03/like-icon.svg';
const Rlove = 'https://programmerikram.com/wp-content/uploads/2025/03/love-icon.svg';
const Rhaha = 'https://programmerikram.com/wp-content/uploads/2025/03/haha-icon.svg';
const default_pp_src = 'https://programmerikram.com/wp-content/uploads/2025/03/default-profilePic.png';

const Watch = ({ watch }) => {


    let myProfile = useSelector(state => state.profile)
    let myProfileId = myProfile._id;
    let watchAuthorProfileId = ''
    let [totalReacts, setTotalReacts] = useState(watch.reacts.length)
    let [totalShares, setTotalShares] = useState(watch.shares.length)
    let [totalComments, setTotalComments] = useState(watch.comments.length)
    let [isActive, setIsActive] = useState(false)
    let [playWatch, setPlayWatch] = useState(false)
    let [reactType, setReactType] = useState(false);
    let [thumbnailLoaded, setThumbnailLoaded] = useState(false)
    let [placedReacts, setPlacedReacts] = useState([]);
    const [imageExists, setImageExists] = useState(false);
    const [watchUrl, setWatchUrl] = useState(watch.videoUrl)
    const displayedWatch = useRef(null) // document.getElementById(`watch-${watch._id}`)
    const nfwatch = useRef(null) // document.getElementById(`watch-${watch._id}`)

    useEffect(() => {

        if (watch?.thumbnail) {
            checkImgLoading(watch.thumbnail, setThumbnailLoaded)
        }




    }, [watch])

    useEffect(() => {

        socket.emit('is_active', { profileId: watchAuthorProfileId, myId: myProfileId })
        socket.on('is_active', (isUserActive, lastLogin, activeProfileId) => {
            if (activeProfileId === myProfileId) {
                setIsActive(isUserActive)
            }

        })

        return () => socket.off('is_active');

    }, [myProfile])

    useEffect(() => {

        setWatchUrl(watch.videoUrl)
    }, [watch])


    var isAuth = myProfileId === watchAuthorProfileId ? true : false;
    var pp_url = '';
    const checkImage = (url) => {
        const img = new Image();
        img.src = url;

        img.onload = () => setImageExists(true);
        img.onerror = () => setImageExists(false);
    };

    useEffect(() => {
        let storedReacts = [];
        watch.reacts.map(react => {
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

    // let watchPhoto = watch.photos
    // const checkThumbImage = (url) => {
    //     const img = new Image();
    //     img.src = url;

    //     img.onload = () => setThumbExists(true);
    //     img.onerror = () => setThumbExists(false);
    // };

    // checkThumbImage(watchPhoto)
    // checkImage(pp_url);

    // if (!imageExists) {
    //     pp_url = default_pp_src;
    // }
    let type = watch.type || 'watch'


    let hideThisWatch = async (e) => {
        let target = e.currentTarget;

        if (isAuth) {
            confirmAlert({
                title: "Confirm Action",
                message: "Are you sure you want to delete this watch?",
                buttons: [
                    {
                        label: "Yes",
                        onClick: async () => {
                            let deleteRes = await api.watch('/watch/delete', { watchId: watch._id, authorId: watch.author._id })
                            if (deleteRes.status === 200) {
                                $(target).parents('.nf-watch').css({
                                    'min-height': '0px',
                                    'padding': '10px'
                                });
                                $(target).parents('.nf-watch').html('<p class="fs-6 mb-0 text-center text-danger">' + deleteRes.data.message + '</p>');
                            } else {
                                alert('Failed to delete watch')
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
            $(target).parents('.nf-watch').hide();
        }
    }

    let removeReact = async (watchType = 'watch', target = null) => {
        setTotalReacts(state => state - 1)

        let res = await api.post('/react/removeReact', { id: watch._id, watchType: 'watch' })
        if (res.status === 200) {
            setTotalReacts(res.data.reacts.length)

            setReactType('')
            return true;
        } else {
            return false;
        }
    }
    let placeReact = async (reactType, watchType = 'watch', target = null) => {
        setTotalReacts(state => state + 1)

        let placeRes = await api.post('/react/addReact', { id: watch._id, watchType, reactType })
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
            removeReact('watch');
            $(target).parent().removeClass('reacted')

        } else {
            placeReact('like', 'watch', target)
            $(target).parent().addClass('reacted')
        }

    }

    let likeOnClick = async (e) => {
        let target = e.currentTarget;
        $(target).parents('.watch-react-container').css('visibility', 'hidden');
        if ($(target).hasClass('reacted')) {
            removeReact('watch');
            $(target).removeClass('reacted')


        } else {
            placeReact('like', 'watch', target)
            $(target).addClass('reacted')
            $(e.currentTarget).siblings().removeClass('reacted')
        }
        setTimeout(() => {
            $(target).parents('.watch-react-container').css('visibility', 'visible');

        }, 500)


    }

    let loveOnClick = (e) => {
        let target = e.currentTarget;
        $(target).parents('.watch-react-container').css('visibility', 'hidden');
        if ($(e.currentTarget).hasClass('reacted')) {
            removeReact('watch');
            $(e.currentTarget).removeClass('reacted')

        } else {
            placeReact('love', 'watch')
            $(e.currentTarget).siblings().removeClass('reacted')
            $(e.currentTarget).addClass('reacted')
        }
        setTimeout(() => {
            $(target).parents('.watch-react-container').css('visibility', 'visible');

        }, 500)

    }

    let hahaOnClick = (e) => {
        let target = e.currentTarget;
        $(target).parents('.watch-react-container').css('visibility', 'hidden');

        if ($(e.currentTarget).hasClass('reacted')) {
            removeReact();
            $(e.currentTarget).removeClass('reacted')
        } else {
            placeReact('haha', 'watch', target)
            $(e.currentTarget).siblings().removeClass('reacted')

            $(e.currentTarget).addClass('reacted')
        }
        setTimeout(() => {
            $(target).parents('.watch-react-container').css('visibility', 'visible');

        }, 500)
    }

    let likeMouseOver = e => {
        let target = e.currentTarget
        $(target).children('.watch-react-container').css('visibility', 'visible');

    }
    let commentOnClick = (e) => {

        let target = e.currentTarget;

        $(target).parents('.footer').find('.field-comment-text').focus();


    }
    let shareOnClick = (e) => {

    }

    let authProfilePicture = useSelector(state => state.profile.profilePic)
    let authProfileId = useSelector(state => state.profile._id)

    let watchAuthorPP = `${watch?.author.profilePic}`

    function isElementNearTop(el, offset = 10) {
        if (el == null) return;
        const rect = el.getBoundingClientRect();
        return rect.top <= offset;
    }


    useEffect(() => {


        window.addEventListener('scroll', () => {
            if (isElementNearTop(nfwatch?.current)) {
                document.querySelectorAll('.watch-video').forEach((element => {
                    element.pause();
                }))

                displayedWatch.current !== null && displayedWatch.current.play()
            }
        });
    }, [])

    let handleDownloadVideoClick = useCallback((e) => {

        if (!watch?.videoUrl) return;
        saveVideoFromUrl(watch._id, watch.videoUrl, watch)
    }, [watch])

    return (
        <>
            <div ref={nfwatch} className={`nf-watch ${type}`}>
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
                                <UserPP profilePic={watchAuthorPP} profile={watch.author._id} active={isActive}></UserPP>
                            </div>
                            <div className="watch-nd-container">
                                <Link to={'/' + watch.author._id}>
                                    <h4 className="author-name">
                                        {watch.author.user.firstName + ' ' + watch.author.user.surname}
                                    </h4>
                                </Link>
                                <span className="watch-time">
                                    <Momemt fromNow >{watch.createdAt}</Momemt>
                                </span>
                            </div>

                        </div>
                        <div className="right">
                            <button onClick={handleDownloadVideoClick} className="watch-three-dot"><i className="fas fa-download"></i></button>
                            {
                                isAuth && <button className="watch-three-dot"><i className="far fa-ellipsis-h"></i></button>
                            }

                            <button onClick={hideThisWatch.bind(this)} className="watch-close"> <i className="far fa-times"></i></button>
                        </div>
                    </div>

                </div>
                <div className="body">
                    <p className="caption">
                        {watch.caption}
                    </p>
                    {
                        (!watch?.thumbnail && watchUrl &&
                            <div className="attachment">
                                <Link to={`/watch/${watch._id}`}>
                                    <video id={`watch-${watch._id}`} ref={displayedWatch} className="w-100 watch-video" controls src={`${watchUrl}`}></video>
                                    {/* <img src={watchPhoto} alt="watch" /> */}

                                </Link>
                            </div>

                            ||

                            <>
                                {!watch?.thumbnail && !watchUrl && <ImageSkleton />}
                            </>

                        )


                    }
                    {
                        watch?.thumbnail && thumbnailLoaded && !playWatch ? <>

                            <div className="attachment">
                                <Link to={`/watch/${watch._id}`}>
                                    <img className="w-100" onClick={() => {setPlayWatch(true)}} src={watch.thumbnail} alt="" />

                                </Link>
                            </div> </> : <>
                            {!watch?.thumbnail && !watchUrl && <ImageSkleton />}

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
                                {watch.reacts && totalReacts} {totalReacts > 1 ? 'Reacts' : 'React'}
                            </span>
                        </div>
                        <div className="comment-share">
                            <div className="comment">
                                <div className="text">{watch.comments && totalComments}

                                </div>
                                <div className="icon">
                                    <i className="far fa-comment-alt"></i>
                                </div>

                            </div>
                            <div className="shares">
                                <div className="text">
                                    {watch.shares && totalShares}
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
                                <div className="watch-react-container">
                                    <div className={`react react-like ${reactType == 'like' ? 'reacted' : ''}`} onClick={likeOnClick} id="watchReactLike" title="Like">
                                        <img src={Rlike} alt="love" />
                                    </div>
                                    <div className={`react react-love ${reactType == 'love' ? 'reacted' : ''}`} onClick={loveOnClick} id="watchReactLove" title="Love">
                                        <img src={Rlove} alt="love" />
                                    </div>
                                    <div className={`react react-haha ${reactType == 'haha' ? 'reacted' : ''}`} onClick={hahaOnClick} id="watchReactHaha" title="Haha">
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
                    <WatchComment watch={watch} commentState={setTotalComments} myProfile={myProfile} authProfile={authProfileId} authProfilePicture={authProfilePicture}></WatchComment>


                </div>

            </div>
        </>
    );
}

export default Watch;

import React, { useCallback, useEffect, useRef, useState } from 'react';
import ImageSkleton from '../../skletons/post/ImageSkleton';
import { useParams, useLocation } from 'react-router-dom';
import api from '../../api/api';
import $ from 'jquery'
import { useDispatch, useSelector } from 'react-redux'
import UserPP from "../UserPP";
import { Link } from "react-router-dom";
import { Container, Row, Col } from 'react-bootstrap';
import Momemt from 'react-moment'
import SingleReactor from './SingleReactor';
import { confirmAlert } from "react-confirm-alert";
import "react-confirm-alert/src/react-confirm-alert.css"; // Import CSS
import { saveVideoFromUrl } from '../../utils/useSavedVideos';
import {
  uniquePlacedReacts,
  getReactLabel,
} from "../../utils/reactTypes";
import {
  ReactPicker,
  PlacedReactIcons,
  CurrentReactIcon,
} from "../post/ReactPicker";
import config from "../../config/config.json";
import { useWatchPipOptional } from "../../contexts/WatchPipContext";
import { buildPipPayloadFromVideo, shouldAutoWatchPip, watchesToPipPlaylist } from "../../utils/watchPipHelpers";
import WatchVideoPlayer from "./WatchVideoPlayer";
import WatchSkeleton from "../../skletons/watch/WatchSkeleton";
import WatchCacheManager, {
    WATCH_CACHE_EVENT,
} from "../../utils/watchCacheManager";
import OptionsDropdown from "../post/OptionsDropdown";
import WatchComment from "./WatchComment";
import ModalContainer from "../modal/ModalContainer";
import { addPost } from "../../services/actions/postActions";
import "../post/SharePostModal.css";
const default_pp_src = config?.defaultProfile;


const SinglePost = (watch) => {
    let { postId } = useParams()
    let location = useLocation()
    const { watchId } = useParams()
    let myProfile = useSelector(state => state.profile)
    let myProfileId = myProfile._id;
    const dispatch = useDispatch();
    const cachedWatch = WatchCacheManager.findWatch(myProfileId, watchId)
    const cachedFeed = myProfileId ? WatchCacheManager.getCachedFeed(myProfileId) : null
    let [watchData, setWatchData] = useState(cachedWatch || false)
    const [watchUrl, setWatchUrl] = useState(cachedWatch?.videoUrl || watch.videoUrl)
    let displayedWatch = useRef(null)
    let captionTextarea = useRef(null)
    const skipPipOnUnmount = useRef(false)
    const watchPip = useWatchPipOptional()
    const [relatedWatches, setRelatedWatches] = useState(
        Array.isArray(cachedFeed) ? cachedFeed : []
    )

    useEffect(() => {
        if (!watchId) return undefined;

        const cached = WatchCacheManager.findWatch(myProfileId, watchId);
        if (cached) {
            setWatchData(cached);
            setWatchUrl(cached.videoUrl);
        } else {
            setWatchData(false);
            setWatchUrl(watch.videoUrl);
        }

        let cancelled = false;
        WatchCacheManager.fetchWithCache({
            key: `item:${watchId}`,
            setCached: (item) => {
                if (item && typeof item === "object") {
                    WatchCacheManager.setCachedWatch(item);
                }
            },
            fetcher: async () => {
                const res = await api.get("watch/single", { params: { watchId } });
                return res.status === 200 ? res.data : null;
            },
        })
            .then((item) => {
                if (!cancelled && item) {
                    setWatchData(item);
                    setWatchUrl(item.videoUrl);
                }
            })
            .catch(() => {});

        return () => {
            cancelled = true;
        };
    }, [postId, watchId, myProfileId, watch.videoUrl])

    // Resume picture-in-picture playback or autoplay AI-selected videos.
    useEffect(() => {
        const resumeAt = location.state?.resumeAt;
        const shouldAutoplay =
            location.state?.autoplay === true ||
            (resumeAt != null && location.state?.autoplay !== false);
        if ((!shouldAutoplay && resumeAt == null) || !displayedWatch.current || !watchUrl) return;

        const video = displayedWatch.current;
        const apply = async () => {
            try {
                if (resumeAt != null) video.currentTime = resumeAt;
                if (shouldAutoplay) {
                    try {
                        await video.play();
                    } catch (error) {
                        if (error?.name === "NotAllowedError") {
                            video.muted = true;
                            await video.play().catch(() => {});
                        }
                    }
                }
            } catch (_) {}
        };

        if (video.readyState >= 1) apply();
        else video.addEventListener("loadedmetadata", apply, { once: true });
        watchPip?.closePip?.();

        return () => video.removeEventListener("loadedmetadata", apply);
    }, [watchUrl, location.state, watchPip]);

    const getPipMeta = useCallback(() => {
        const currentId = watchData?._id || watchId;
        const current = currentId && (watchUrl || watchData?.videoUrl)
            ? {
                id: String(currentId),
                watchId: String(currentId),
                url: watchUrl || watchData?.videoUrl,
                title: watchData?.caption || "Watch",
                thumbnail: watchData?.thumbnail || "",
                playCount: 1,
            }
            : null;
        const related = watchesToPipPlaylist(relatedWatches);
        const playlist = current
            ? related.some((item) => item.id === current.id)
                ? related
                : [current, ...related.filter((item) => item.id !== current.id)]
            : related;
        return {
            watchId: currentId,
            videoUrl: watchUrl || watchData?.videoUrl,
            title: watchData?.caption || "Watch",
            thumbnail: watchData?.thumbnail || "",
            playlist,
        };
    }, [watchData, watchId, watchUrl, relatedWatches]);

    const minimizeToPip = useCallback(() => {
        if (!watchPip?.startPip || !displayedWatch.current) return;
        const payload = buildPipPayloadFromVideo(displayedWatch.current, getPipMeta());
        if (!payload) return;
        skipPipOnUnmount.current = true;
        displayedWatch.current.pause();
        watchPip.startPip({ ...payload, playing: true });
    }, [watchPip, getPipMeta]);

    useEffect(() => {
        return () => {
            if (!skipPipOnUnmount.current && shouldAutoWatchPip() && watchPip?.startPip) {
                const video = displayedWatch.current;
                if (video && !video.paused && !video.ended) {
                    const payload = buildPipPayloadFromVideo(video, getPipMeta());
                    if (payload) watchPip.startPip(payload);
                }
            }
        };
    }, [watchPip, getPipMeta]);

    useEffect(() => {
        if (!myProfileId) return undefined;

        const cached = WatchCacheManager.getCachedFeed(myProfileId);
        if (Array.isArray(cached)) {
            setRelatedWatches(cached);
        }

        let cancelled = false;
        WatchCacheManager.refreshFeed(myProfileId)
            .then((list) => {
                if (!cancelled && Array.isArray(list)) {
                    setRelatedWatches(list);
                }
            })
            .catch(() => {});

        return () => {
            cancelled = true;
        };
    }, [myProfileId]);

    useEffect(() => {
        const onCacheUpdate = (event) => {
            if (event.detail?.list === "feed" && event.detail?.profileId === myProfileId) {
                setRelatedWatches(
                    Array.isArray(event.detail.items) ? event.detail.items : [],
                );
            }
            if (event.detail?.list === "item" && event.detail?.watchId === watchId && event.detail?.item) {
                setWatchData(event.detail.item);
                if (event.detail.item.videoUrl) setWatchUrl(event.detail.item.videoUrl);
            }
        };

        window.addEventListener(WATCH_CACHE_EVENT, onCacheUpdate);
        return () => window.removeEventListener(WATCH_CACHE_EVENT, onCacheUpdate);
    }, [myProfileId, watchId]);
    let postAuthorProfileId = watchData && watchData?.author._id
    let [totalReacts, setTotalReacts] = useState(watchData && watchData.reacts.length)
    let [totalShares, setTotalShares] = useState(watchData && watchData.shares.length)
    let [totalComments, setTotalComments] = useState(watchData && watchData.comments.length)
    let [reactType, setReactType] = useState(false);
    let [isAuthor, setIsAuthor] = useState(watchData?.author?._id === myProfile?._id)
    let [isEditCaption, setIsEditCaption] = useState(false)
    const [isWatchOption, setIsWatchOption] = useState(false)
    let [placedReacts, setPlacedReacts] = useState([]);
    const [imageExists, setImageExists] = useState(null);
    const [thumbExists, setThumbExists] = useState(null);
    const [shareCap, setShareCap] = useState("");
    const [isShareModal, setIsShareModal] = useState(false);
    const [isSharing, setIsSharing] = useState(false);


    var isAuth = myProfileId === postAuthorProfileId ? true : false;
    var pp_url = watchData && watchData?.author.profilePic
    const checkImage = (url) => {
        const img = new Image();
        img.src = url;

        img.onload = () => setImageExists(true);
        img.onerror = () => setImageExists(false);
    };



    useEffect(() => {
        let storedReacts = uniquePlacedReacts(watchData?.reacts || []);
        (watchData?.reacts || []).forEach((react) => {
            if (react.profile === myProfileId) {
                setReactType(react.type)
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

    let removeReact = async (postType = 'watch', target = null) => {
        setTotalReacts(state => state - 1)

        let res = await api.post('/react/removeReact', { id: watchData._id, postType: 'watch', reactor: myProfileId })
        if (res.status === 200) {
            setTotalReacts(res.data.reacts.length)

            setReactType('')
            return true;
        } else {
            return false;
        }
    }
    let placeReact = async (reactType, postType = 'watch', target = null) => {
        setTotalReacts(state => state + 1)

        let placeRes = await api.post('/react/addReact', { id: watchData._id, postType: 'watch', reactType })
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

    let pickerReactOnClick = (type, e) => {
        const target = e.currentTarget;
        $(target).parents('.post-react-container').css('visibility', 'hidden');
        if ($(target).hasClass('reacted')) {
            removeReact('watch');
            $(target).removeClass('reacted')
        } else {
            placeReact(type, 'watch', target)
            $(target).siblings().removeClass('reacted')
            $(target).addClass('reacted')
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
    let shareOnClick = () => {
        setIsShareModal(true)
    }
    let onCloseShareReq = () => {
        setIsShareModal(false)
    }
    let onClickShareNow = async (e) => {
        e.preventDefault()
        if (!watchData?._id) return
        setIsSharing(true)
        try {
            const res = await api.post('/watch/share', {
                watchId: watchData._id,
                caption: shareCap,
            })
            if (res.status === 200) {
                setTotalShares((state) => Number(state || 0) + 1)
                if (res.data?.post) {
                    dispatch(addPost(res.data.post))
                }
                setIsShareModal(false)
                setShareCap('')
            }
        } catch (error) {
            console.error('Error sharing watch:', error)
            alert('Failed to share video. Please try again.')
        } finally {
            setIsSharing(false)
        }
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
                WatchCacheManager.updateWatch(myProfileId, watchData._id, {
                    caption: newCaption,
                })
            }

        }
    }, [captionTextarea, watchData, myProfileId])

    const closeWatchOption = useCallback(() => {
        setIsWatchOption(false);
    }, []);

    const watchOptionClick = useCallback(() => {
        setIsWatchOption((prev) => !prev);
    }, []);

    let handleCaptionEditBtnClick = () => {
        setIsEditCaption(true);
        setIsWatchOption(false);
    }

    let handleDownloadVideoClick = useCallback((e) => {
        e?.preventDefault?.();
        e?.stopPropagation?.();
        if (!watchData?.videoUrl) return;
        saveVideoFromUrl(watchData._id, watchData.videoUrl, watchData);
    }, [watchData])



    return (
        <div>

            <Container className='single-post-container' >
                <Row>


                    <Col md="6" className='offset-md-3'>
                        <div id="post-container">
                            <div>
                                {!watchData && <WatchSkeleton count={1} variant="single" />}
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
                                                        <UserPP profilePic={postAuthorPP} profile={watchData.author._id} active={watchData.author.isActive}></UserPP>
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

                                                    <OptionsDropdown
                                                        open={isWatchOption}
                                                        onToggle={watchOptionClick}
                                                        onClose={closeWatchOption}
                                                        ariaLabel="Video options"
                                                    >
                                                        <ul>
                                                            {isAuth && (
                                                                <li onClick={handleCaptionEditBtnClick}>Edit Video</li>
                                                            )}
                                                            <li onClick={closeWatchOption}>Report This Video</li>
                                                        </ul>
                                                    </OptionsDropdown>

                                                    <button onClick={hideThisPost.bind(this)} className="post-close"> <i className="far fa-times"></i></button>
                                                </div>
                                            </div>

                                        </div>
                                        <div className="body">
                                            <div className="caption" style={{ display: 'flex', flexDirection:'column', alignItems: 'center', justifyContent: 'start' }}>
                                                {isAuthor && isEditCaption && <>
                                                    <textarea style={{ width: '100%', marginBottom: 10, borderRadius: 10 }} value={watchData?.caption} onChange={(e) => { setWatchData({ ...watchData, caption: e.target.value }) }} ref={captionTextarea} />

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
                                                    <WatchVideoPlayer
                                                        watchId={watchData?._id || watchId}
                                                        videoUrl={watchUrl}
                                                        thumbnail={watchData?.thumbnail}
                                                        videoRef={displayedWatch}
                                                        eager
                                                        isPipActive={watchPip?.pip?.watchId === (watchData?._id || watchId)}
                                                        onRestorePip={() => watchPip?.closePip?.()}
                                                        showPipButton={!!watchPip}
                                                        onMinimizePip={minimizeToPip}
                                                    />

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
                                                    <PlacedReactIcons placedReacts={placedReacts} />


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
                                                                <CurrentReactIcon reactType={reactType} />
                                                            </span>
                                                            <span className="text text-capitalize">{getReactLabel(reactType)}</span>
                                                        </div>
                                                        <ReactPicker
                                                            reactType={reactType}
                                                            onSelect={pickerReactOnClick}
                                                        />
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
                                                    {isShareModal && (
                                                        <ModalContainer
                                                            title="Share Video"
                                                            isOpen
                                                            onRequestClose={onCloseShareReq}
                                                            id="cp-view-modal"
                                                        >
                                                            <div className="modal-header">
                                                                <h3 className="modal-title">Share Video</h3>
                                                                <button
                                                                    type="button"
                                                                    onClick={onCloseShareReq}
                                                                    className="modal-close-btn"
                                                                    aria-label="Close"
                                                                >
                                                                    <i className="far fa-times"></i>
                                                                </button>
                                                            </div>
                                                            <div className="modal-body">
                                                                <div className="share-post-container">
                                                                    <div className="share-post-header">
                                                                        <div className="share-post-user">
                                                                            <div className="share-post-avatar">
                                                                                <UserPP
                                                                                    profilePic={myProfile.profilePic}
                                                                                    profile={myProfile._id}
                                                                                />
                                                                            </div>
                                                                            <div className="share-post-user-meta">
                                                                                <h3 className="share-post-name" title={myProfile.fullName}>
                                                                                    {myProfile.fullName}
                                                                                </h3>
                                                                                <p className="share-post-context">
                                                                                    You're sharing{" "}
                                                                                    {watchData.author?.fullName || "Someone"}'s video
                                                                                </p>
                                                                            </div>
                                                                        </div>
                                                                    </div>
                                                                    <div className="share-post-body">
                                                                        <textarea
                                                                            className="form-control"
                                                                            rows="3"
                                                                            placeholder={isSharing ? "Sharing..." : "What's on your mind?"}
                                                                            onChange={(e) => setShareCap(e.target.value)}
                                                                            value={shareCap}
                                                                            disabled={isSharing}
                                                                            style={{ opacity: isSharing ? 0.7 : 1 }}
                                                                        ></textarea>
                                                                        <div className="share-post-button">
                                                                            <button
                                                                                className="btn btn-primary"
                                                                                onClick={onClickShareNow}
                                                                                disabled={isSharing}
                                                                            >
                                                                                {isSharing ? (
                                                                                    <>
                                                                                        <span
                                                                                            className="spinner-border spinner-border-sm me-2"
                                                                                            role="status"
                                                                                            aria-hidden="true"
                                                                                        ></span>
                                                                                        Sharing...
                                                                                    </>
                                                                                ) : (
                                                                                    "Share Now"
                                                                                )}
                                                                            </button>
                                                                        </div>
                                                                    </div>
                                                                </div>
                                                            </div>
                                                        </ModalContainer>
                                                    )}
                                                </div>
                                            </div>
                                            <WatchComment
                                                watch={watchData}
                                                commentState={setTotalComments}
                                                myProfile={myProfile}
                                                authProfile={authProfileId}
                                                authProfilePicture={authProfilePicture}
                                            />

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

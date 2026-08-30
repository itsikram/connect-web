import React, { useEffect, useState, useRef, useCallback } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import UserPP from '../UserPP';
import api from '../../api/api';
import { useSelector } from 'react-redux';
import StoryContainer from './StoryContainer';
import StoryEngagementPanel, { StoryEngagementSkeleton } from './StoryEngagementPanel';
import SingleStorySkeleton from '../../skletons/story/SingleStorySkeleton';
import { confirmAlert } from 'react-confirm-alert';
import $ from 'jquery';
import Rlike from "../../assets/images/reacts/reactLike.svg";
import Rlove from "../../assets/images/reacts/reactLove.svg";
import Rhaha from "../../assets/images/reacts/reactHaha.svg";
import '../post/CommentStyles.css';
import './StoryComments.css';

const isSameProfile = (value, myId) => {
    if (!myId) return false;
    const id = value && typeof value === 'object' ? value._id : value;
    return String(id) === String(myId);
};

const panelFromHash = (hash) => {
    if (!hash) return 'comments';
    if (hash.includes('react')) return 'reacts';
    return 'comments';
};

const SingleStory = () => {
    const { storyId } = useParams();
    const location = useLocation();
    const [story, setStory] = useState(false);
    const [storyBg, setStoryBg] = useState('');
    const [reactType, setReactType] = useState(false);
    const [allComments, setAllComments] = useState([]);
    const [totalComments, setTotalComments] = useState(0);
    const [activePanel, setActivePanel] = useState(() => panelFromHash(window.location.hash));
    const myProfile = useSelector((state) => state.profile);
    const myId = myProfile?._id;
    const [isAuth, setIsAuth] = useState(false);
    const navigate = useNavigate();
    const panelRef = useRef(null);

    useEffect(() => {
        setStory(false);
        setStoryBg('');
        setReactType('');
        setAllComments([]);
        setTotalComments(0);

        api.get('/story/single', { params: { storyId } }).then((res) => {
            if (res.status === 200) {
                const comments = Array.isArray(res.data?.comments) ? res.data.comments : [];
                setStory(res.data);
                setAllComments(comments);
                setTotalComments(comments.length);
                setIsAuth(res.data.author?._id === myId);
                setStoryBg(res.data.bgColor);
            }
        }).catch((e) => {
            console.log(e);
        });
    }, [storyId, myId]);

    useEffect(() => {
        setActivePanel(panelFromHash(location.hash));
    }, [location.hash, storyId]);

    useEffect(() => {
        if (story) {
            story.reacts?.forEach((react) => {
                if (isSameProfile(react.profile, myId)) {
                    setReactType((react.type).toLowerCase());
                }
            });
        }

        setIsAuth(story?.author && story.author._id === myId);
    }, [story, myId]);

    const openPanel = useCallback((panel) => {
        setActivePanel(panel);
        if (window.matchMedia('(max-width: 991px)').matches) {
            panelRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
        }
    }, []);

    const removeReact = async (id, postType = 'story') => {
        const placeRes = await api.post('/react/removeReact', { id, postType });
        if (placeRes.status === 200) {
            setReactType(false);
            setStory((prev) => {
                if (!prev) return prev;
                const reacts = Array.isArray(prev.reacts)
                    ? prev.reacts.filter((react) => !isSameProfile(react.profile, myId))
                    : [];
                return { ...prev, reacts };
            });
            return true;
        }
        return false;
    };

    const placeReact = async (id, type, postType = 'story') => {
        const placeRes = await api.post('/react/addReact', { id, reactType: type, postType });
        if (placeRes.status === 200) {
            setReactType(type);
            setStory((prev) => {
                if (!prev) return prev;
                const reacts = Array.isArray(prev.reacts) ? [...prev.reacts] : [];
                const idx = reacts.findIndex((react) => isSameProfile(react.profile, myId));
                if (idx >= 0) {
                    reacts[idx] = { ...reacts[idx], type };
                } else {
                    reacts.push({ profile: myId, type });
                }
                return { ...prev, reacts };
            });
            return true;
        }
        return false;
    };

    const clickLikeBtn = async (e) => {
        const currentTarget = e.currentTarget;
        if (!currentTarget.classList.contains('reacted')) {
            if (await placeReact(storyId, 'like', 'story')) {
                currentTarget.classList.add('reacted');
            }
        } else if (await removeReact(storyId)) {
            currentTarget.classList.remove('reacted');
        }
    };

    const clickLoveBtn = async (e) => {
        const currentTarget = e.currentTarget;
        if (!currentTarget.classList.contains('reacted')) {
            if (await placeReact(storyId, 'love', 'story')) {
                currentTarget.classList.add('reacted');
            }
        } else if (await removeReact(storyId)) {
            currentTarget.classList.remove('reacted');
        }
    };

    const clickHahaBtn = async (e) => {
        const currentTarget = e.currentTarget;
        if (!currentTarget.classList.contains('reacted')) {
            if (await placeReact(storyId, 'haha', 'story')) {
                currentTarget.classList.add('reacted');
            }
        } else if (await removeReact(storyId)) {
            currentTarget.classList.remove('reacted');
        }
    };

    const handleDeletePost = async (e) => {
        confirmAlert({
            title: "Confirm Action",
            message: "Are you sure you want to delete this story?",
            buttons: [
                {
                    label: "Yes",
                    onClick: async () => {
                        $(e.currentTarget).parents('.single-story-container').remove();
                        const res = await api.post('/story/delete', { storyId });
                        if (res.status === 200) {
                            navigate('/story');
                        }
                    },
                },
                {
                    label: "No",
                    onClick: () => { },
                },
            ],
        });
    };

    const commentCount = typeof totalComments === 'number'
        ? totalComments
        : (story?.comments?.length || 0);

    const sidebar = !story ? (
        <StoryEngagementSkeleton />
    ) : (
        <StoryEngagementPanel
            story={story}
            activePanel={activePanel}
            onPanelChange={openPanel}
            commentCount={commentCount}
            allComments={allComments}
            setAllComments={setAllComments}
            setTotalComments={setTotalComments}
            myProfile={myProfile}
            myId={myId}
            panelRef={panelRef}
        />
    );

    return (
        <StoryContainer sidebar={sidebar}>
            {!story ? (<SingleStorySkeleton />) : (
                <div className="single-story-container">
                    <div className="single-story" style={{ background: storyBg }}>
                        <div className="story-top">
                            <div className="story-author-details">
                                <div className="author-pp-container">
                                    {story.author && (
                                        <UserPP
                                            profilePic={story.author.profilePic}
                                            profile={story.author._id}
                                            hasStory={false}
                                        />
                                    )}
                                </div>
                                <div className="author-name">
                                    <h3>{story.author && story.author.fullName}</h3>
                                </div>
                            </div>
                            <div className="story-options">
                                <span
                                    className={`option-button reacts ${activePanel === 'reacts' ? 'is-active' : ''}`}
                                    onClick={() => openPanel('reacts')}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openPanel('reacts'); }}
                                    title="View reacts"
                                >
                                    <i className="fa fa-heart" />
                                </span>
                                <span
                                    className={`option-button comments ${activePanel === 'comments' ? 'is-active' : ''}`}
                                    onClick={() => openPanel('comments')}
                                    role="button"
                                    tabIndex={0}
                                    onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') openPanel('comments'); }}
                                    title="View comments"
                                >
                                    <i className="fa fa-comments" />
                                </span>
                                {isAuth && (
                                    <span className="option-button delete text-danger" onClick={handleDeletePost}>
                                        <i className="fa fa-trash" />
                                    </span>
                                )}
                            </div>
                        </div>
                        <div
                            className="single-story-image-container"
                            style={{ background: `url(${story.image})` }}
                        />
                    </div>

                    <div className="single-story-meta-container">
                        <div className="single-story-reacts-buttons">
                            <div
                                className={`single-story-react-button ${reactType === 'like' ? 'reacted' : ''}`}
                                onClick={clickLikeBtn}
                            >
                                <img src={Rlike} alt="Like" />
                            </div>
                            <div
                                className={`single-story-react-button ${reactType === 'love' ? 'reacted' : ''}`}
                                onClick={clickLoveBtn}
                            >
                                <img src={Rlove} alt="Love" />
                            </div>
                            <div
                                className={`single-story-react-button ${reactType === 'haha' ? 'reacted' : ''}`}
                                onClick={clickHahaBtn}
                            >
                                <img src={Rhaha} alt="Haha" />
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </StoryContainer>
    );
};

export default SingleStory;

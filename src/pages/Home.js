import React, { Fragment, useState, useEffect, useRef, useMemo, useCallback } from "react";
import { Container, Col, Row } from 'react-bootstrap';
import { useDispatch, useSelector } from "react-redux";
import Ls from '../partials/sidebar/Ls';
import Rs from '../partials/sidebar/Rs';
import CreatePost from "../components/post/CreatePost";
import Post from '../components/post/Post'
import StoryCard from "../components/story/StoryCard";
import api from "../api/api";
import { setLoading } from "../services/actions/optionAction";
import PostSkeleton from "../skletons/post/PostSkeleton";
import StoryListSkleton from "../skletons/story/StoryListSkleton";
import { loadPosts } from "../services/actions/postActions"
import { getCachedProfile, getProfileSuccess } from "../services/actions/profileActions"
import CacheManager from "../utils/cacheManager"

const Home = () => {

    const dispatch = useDispatch()
    const myProfile = useSelector(state => state.profile)
    const userInfo = JSON.parse(localStorage.getItem('user') || '{}')
    const effectiveProfileId = myProfile._id || userInfo.profile || 'guest'
    const storiesCacheKey = `homeStories_${effectiveProfileId}`
    const storyContainer = useRef()
    const postContainer = useRef()
    function scrollLeft() {
        storyContainer.current.scrollBy({ left: -300, behavior: 'smooth' })

    }

    function scrollRight() {
        storyContainer.current.scrollBy({ left: 300, behavior: 'smooth' })
    }
    const [match, setMatch] = useState(window.matchMedia('(max-width: 768px)').matches)
    const [loadNewPosts, setLoadNewPosts] = useState(false);
    const [hasNewPosts, setHasNewPosts] = useState(true);
    const [showNewPostsNotification, setShowNewPostsNotification] = useState(false);
    const [newPostsCount, setNewPostsCount] = useState(0);
    const [isFirstLoad, setIsFirstLoad] = useState(true);

    // setting state to store posts data

    const [newsFeeds, setNewsFeed] = useState([])
    const [stories, setStories] = useState(() => {
        try {
            const cachedStories = localStorage.getItem(storiesCacheKey)
            if (!cachedStories) return []

            const parsedStories = JSON.parse(cachedStories)
            return Array.isArray(parsedStories) ? parsedStories : []
        } catch (error) {
            console.error('Error reading cached stories:', error)
            return []
        }
    })
    const [lastVisitPost, setLastVisitPost] = useState(false)
    const [feedLoaded, setFeedLoaded] = useState(false)
    const [pageNumber, setPageNumber] = useState(0)
    const newsFeedPosts = useSelector(state => state.post)

    const writeStoriesCache = useCallback((storyList) => {
        try {
            localStorage.setItem(storiesCacheKey, JSON.stringify(storyList))
        } catch (error) {
            console.error('Error caching stories:', error)
        }
    }, [storiesCacheKey])

    const fetchProfileWithFallback = useCallback(async () => {
        try {
            const user = JSON.parse(localStorage.getItem('user') || '{}')
            const profileId = user?.profile

            if (!profileId) return

            const profileRes = await api.post('/profile', { profile: profileId })
            if (profileRes.status === 200 && profileRes.data) {
                dispatch(getProfileSuccess(profileRes.data))
                return
            }
        } catch (error) {
            console.error('Error fetching live profile:', error)
        }

        const cachedProfile = getCachedProfile()
        if (cachedProfile) {
            dispatch(getProfileSuccess(cachedProfile))
        }
    }, [dispatch])

    const loadData = useCallback(async () => {

        if (hasNewPosts === false) return;

        const nextPage = pageNumber + 1;
        try {
            const nfRes = await api.get('/post/newsFeed/', {
                params: {
                    pageNumber: nextPage
                }
            })
            if (nfRes.status === 200) {
                const newPosts = [...nfRes.data.posts] || [];
                
                // Only cache page 1 data
                if (nextPage === 1) {
                    CacheManager.setCachedPosts(newPosts);
                    console.log('📦 Updated cache with fresh posts');
                }
                
                dispatch(loadPosts(newPosts))
                setPageNumber(nextPage)
                setHasNewPosts(nfRes.data.hasNewPost ?? false)
            }
        } catch (error) {
            console.error('Error loading news feed:', error);
        } finally {
            setLoadNewPosts(false)
            setFeedLoaded(true)
            dispatch(setLoading(false))
            setIsFirstLoad(false);
        }
    }, [dispatch, hasNewPosts, pageNumber])

    const fetchStories = useCallback(async () => {
        try {
            const strRes = await api.get('/story/')
            if (strRes.status === 200) {
                const nextStories = Array.isArray(strRes.data) ? strRes.data : []
                setStories(nextStories)
                writeStoriesCache(nextStories)
            }
        } catch (error) {
            console.error('Error fetching stories:', error)
        }
    }, [writeStoriesCache])

    const memoizedStories = useMemo(() => {
        return stories.map((story, index) => {
            return <StoryCard key={index} data={story}></StoryCard>
        })
    }, [stories])


    useEffect(() => {
        // setHasNewPosts(true)
        const handleScroll = () => {
            const scrollTop = window.scrollY;
            const windowHeight = window.innerHeight;
            const fullHeight = document.body.scrollHeight;

            const scrolled = (scrollTop + windowHeight) / fullHeight;

            if (scrolled >= 0.8) {
                if (!loadNewPosts) {
                    setLoadNewPosts(true)
                }
            }
        };
        window.addEventListener("scroll", handleScroll);
        return () => window.removeEventListener("scroll", handleScroll);
    }, [loadNewPosts]);



    useEffect(() => {

        if (loadNewPosts) {

            if (hasNewPosts) {
                loadData()
            }

        }
    }, [hasNewPosts, loadData, loadNewPosts])

    useEffect(() => {
        dispatch(setLoading(false))

        const mediaQuery = window.matchMedia("(max-width:768px)")
        const handleMediaChange = (e) => {
            setMatch(e.matches)
        }

        mediaQuery.addEventListener('change', handleMediaChange)
        
        // Load cached posts if available
        const cachedPosts = CacheManager.getCachedPosts();
        if (cachedPosts && cachedPosts.length > 0) {
            dispatch(loadPosts(cachedPosts));
            console.log('📦 Loaded posts from cache:', cachedPosts.length);
        }
        
        setHasNewPosts(true)
        setLoadNewPosts(true)
        fetchStories()
        fetchProfileWithFallback()

        return () => {
            mediaQuery.removeEventListener('change', handleMediaChange)
        }
    }, [dispatch, fetchProfileWithFallback, fetchStories])

    useEffect(() => {
        const handleStoryCreated = () => {
            fetchStories()
        }
        window.addEventListener('story:created', handleStoryCreated)
        return () => window.removeEventListener('story:created', handleStoryCreated)
    }, [fetchStories])

    useEffect(() => {
        if (newsFeedPosts.length > 0) {
            const pageNumber = Math.ceil(newsFeedPosts.length / 10)
            setPageNumber(pageNumber)
            // alert(pageNumber)
        }
    }, [newsFeedPosts])

    // Detect new posts from fresh API fetch and show notification
    useEffect(() => {
        if (!isFirstLoad && feedLoaded && pageNumber === 1 && newsFeedPosts.length > 0) {
            // Get cached posts to compare
            const cachedPosts = CacheManager.getCachedPosts();
            if (cachedPosts && cachedPosts.length > 0) {
                const cachedPostIds = new Set(cachedPosts.map(p => p._id));
                const newPostsInFetch = newsFeedPosts.filter(p => !cachedPostIds.has(p._id));
                
                if (newPostsInFetch.length > 0) {
                    setNewPostsCount(newPostsInFetch.length);
                    setShowNewPostsNotification(true);
                    console.log('🆕 New posts detected:', newPostsInFetch.length);
                    
                    // Auto-hide notification after 5 seconds
                    const timeout = setTimeout(() => {
                        setShowNewPostsNotification(false);
                    }, 5000);
                    
                    return () => clearTimeout(timeout);
                }
            }
        }
    }, [feedLoaded, newsFeedPosts, isFirstLoad, pageNumber])

    return (
        <Fragment>
            <div id="home" className="home-page">
                <Container fluid>
                    <Row>
                        <Col md="3">
                            {!match && <Ls />}
                        </Col>

                        <Col md="6">

                            <CreatePost setNewsFeed={setNewsFeed}></CreatePost>

                            <div id="newsfeed-container" className="newsfeed-container">
                                {showNewPostsNotification && (
                                    <div className="alert alert-info alert-dismissible fade show" role="alert">
                                        <strong>🆕 New Posts!</strong> {newPostsCount} new {newPostsCount === 1 ? 'post' : 'posts'} available
                                        <button type="button" className="btn-close" onClick={() => setShowNewPostsNotification(false)}></button>
                                    </div>
                                )}

                                {
                                    stories.length > 0 ? (
                                        <div id="nf-story-container" >
                                            <div ref={storyContainer} className="nf-story-overflow-container">

                                                {memoizedStories}
                                            </div>

                                            <div className="nf-story-arrow-left" onClick={scrollLeft.bind(this)} >
                                                <i className="fa fa-chevron-left"></i>
                                            </div>
                                            <div className="nf-story-arrow-right" onClick={scrollRight.bind(this)} >
                                                <i className="fa fa-chevron-right"></i>
                                            </div>

                                        </div>
                                    ) :

                                        (
                                            <div id="nf-story-container" >
                                                <div ref={storyContainer} className="nf-story-overflow-container">

                                                    <StoryListSkleton count={7} />

                                                </div>
                                                <div className="nf-story-arrow-left" onClick={scrollLeft.bind(this)} >
                                                    <i className="fa fa-chevron-left"></i>
                                                </div>
                                                <div className="nf-story-arrow-right" onClick={scrollRight.bind(this)} >
                                                    <i className="fa fa-chevron-right"></i>
                                                </div>


                                            </div>
                                        )
                                }



                                <div id="nf-post-container" ref={postContainer}>

                                    {
                                        newsFeedPosts.length > 0 ?
                                            newsFeedPosts.map((newsFeed, index) => {
                                                return <Post key={newsFeed._id} index={index} postContainer={postContainer} data={newsFeed}></Post>
                                            })
                                        : feedLoaded ? (
                                            <div className="no-posts-message text-center py-4">
                                                <h4>No posts yet</h4>
                                                <p>There are no more posts to show right now.</p>
                                            </div>
                                        ) : (
                                            <PostSkeleton count={3} />
                                        )
                                    }
                                    {
                                        hasNewPosts && newsFeedPosts.length > 0 && <PostSkeleton count={1} />
                                    }

                                </div>

                            </div>

                        </Col>


                        <Col md="3">
                            {!match && <Rs></Rs>}
                        </Col>

                    </Row>

                </Container>
            </div>


        </Fragment>
    )

}

export default Home;
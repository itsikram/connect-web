import React, { Fragment, useState, useEffect, useRef, useMemo } from "react";
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

const Home = () => {

    const dispatch = useDispatch()
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

    // setting state to store posts data

    const [newsFeeds, setNewsFeed] = useState([])
    const [stories, setStories] = useState([])
    const [lastVisitPost, setLastVisitPost] = useState(false)
    const [feedLoaded, setFeedLoaded] = useState(false)
    const [pageNumber, setPageNumber] = useState(0)
    const myProfile = useSelector(state => state.profile)
    const newsFeedPosts = useSelector(state => state.post)

    const loadData = async () => {

        if (hasNewPosts === false) return;

        const nextPage = pageNumber + 1;
        try {
            const nfRes = await api.get('/post/newsFeed/', {
                params: {
                    pageNumber: nextPage
                }
            })
            if (nfRes.status === 200) {
                dispatch(loadPosts([...nfRes.data.posts] || []))
                setPageNumber(nextPage)
                setHasNewPosts(nfRes.data.hasNewPost ?? false)
            }
        } catch (error) {
            console.error('Error loading news feed:', error);
        } finally {
            setLoadNewPosts(false)
            setFeedLoaded(true)
            dispatch(setLoading(false))
        }
    }

    const fetchStories = async () => {
        const strRes = await api.get('/story/')
        if (strRes.status === 200) {
            setStories(strRes.data)
        }
    }

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
    }, [loadNewPosts])

    useEffect(() => {
        dispatch(setLoading(false))

        // window width 
        window.matchMedia("(max-width:768px)").addEventListener('change', (e) => {
            setMatch(e.matches)
        })
        setHasNewPosts(true)
        setLoadNewPosts(true)
        fetchStories()
    }, [])

    useEffect(() => {
        if (newsFeedPosts.length > 0) {
            const pageNumber = Math.floor(newsFeedPosts.length / 3)
            setPageNumber(pageNumber)
            // alert(pageNumber)
        }
    }, [newsFeedPosts])

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
                                                return <Post key={index} index={newsFeedPosts.indexOf(newsFeed)} postContainer={postContainer} data={newsFeed}></Post>
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
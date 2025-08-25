import React, { Fragment, useState, useEffect, useRef } from "react";
import { Container, Col, Row } from 'react-bootstrap';
import { useDispatch, useSelector } from "react-redux";
import Ls from '../partials/sidebar/Ls';
import Rs from '../partials/sidebar/Rs';
import CreatePost from "../components/post/CreatePost";
import Post from '../components/post/Post'
import StoryCard from "../components/story/StoryCard";
import api from "../api/api";
import $ from 'jquery'
import { setLoading } from "../services/actions/optionAction";
import PostSkeleton from "../skletons/post/PostSkeleton";
import StoryListSkleton from "../skletons/story/StoryListSkleton";
import socket from "../common/socket";
import {loadPosts} from "../services/actions/postActions"

let Home = () => {

    let dispatch = useDispatch()
    let storyContainer = useRef()
    let postContainer = useRef()
    function scrollLeft(e) {
        storyContainer.current.scrollBy({ left: -300, behavior: 'smooth' })

    }

    function scrollRight(e) {
        storyContainer.current.scrollBy({ left: 300, behavior: 'smooth' })
    }
    let [match, setMatch] = useState(window.matchMedia('(max-width: 768px)').matches)
    const [loadNewPosts, setLoadNewPosts] = useState(false);
    const [hasNewPosts, setHasNewPosts] = useState(true);

    // setting state to store posts data

    let [newsFeeds, setNewsFeed] = useState([])
    let [stories, setStories] = useState([])
    let [lastVisitPost, setLastVisitPost] = useState(false)
    let [pageNumber, setPageNumber] = useState(0)
    let myProfile = useSelector(state => state.profile)
    let newsFeedPosts = useSelector(state => state.post)

    let loadData = async () => {

        if (hasNewPosts === false) return;

        let nfRes = await api.get('/post/newsFeed/', {
            params: {
                pageNumber: pageNumber + 1
            }
        })
        if (nfRes.status === 200) {

            // let loaded
            dispatch(loadPosts([...nfRes.data.posts] || []))
            setPageNumber(pageNumber + 1)
            // setNewsFeed(state => [...state, ...nfRes.data.posts])
            let hasPosts = nfRes.data.hasNewPost
            setHasNewPosts(hasPosts)
            setLoadNewPosts(false)
        }
        let strRes = await api.get('/story/')
        if (strRes.status === 200) {
            setStories(strRes.data)
        }
        dispatch(setLoading(false))
    }


    useEffect(() => {
        // setHasNewPosts(true)
        const handleScroll = () => {
            const scrollTop = window.scrollY;
            const windowHeight = window.innerHeight;
            const fullHeight = document.body.scrollHeight;

            const scrolled = (scrollTop + windowHeight) / fullHeight;

            if (scrolled >= 0.8) {

                if (loadNewPosts == false) {
                    setLoadNewPosts(true)
                }
            }
        };
        window.addEventListener("scroll", handleScroll);
        //   return () => window.removeEventListener("scroll", handleScroll);
    }, []);



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
    }, [])

    useEffect(() => {
        if(newsFeedPosts.length > 0) {
            let pageNumber = Math.floor(newsFeedPosts.length / 3)
            setPageNumber(pageNumber)
            // alert(pageNumber)
        }
    },[newsFeedPosts])

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

                                                {
                                                    stories.map((story, index) => {
                                                        return <StoryCard key={index} data={story}></StoryCard>
                                                    })
                                                }
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

                                            : <PostSkeleton count={3} />
                                    }
                                    <PostSkeleton count={1} />

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
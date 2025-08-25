import React, { useEffect, useState, Fragment, useRef } from 'react';
import { Outlet, useParams, Link, useNavigate } from 'react-router-dom';
import { Container, Row, Col } from 'react-bootstrap';
import UserPP from '../UserPP';
import api from '../../api/api';
import { useSelector } from 'react-redux';
import { confirmAlert } from 'react-confirm-alert';
import $ from 'jquery'
import SingleReactor from './SingleReactor';
import StoryLists from './StoryLists';
const Rlike = 'https://programmerikram.com/wp-content/uploads/2025/03/like-icon.svg';
const Rlove = 'https://programmerikram.com/wp-content/uploads/2025/03/love-icon.svg';
const Rhaha = 'https://programmerikram.com/wp-content/uploads/2025/03/haha-icon.svg';


const StoryReacts = (props) => {
    let { storyId } = useParams();
    let [story, setStory] = useState(false)
    let [storyBg, setStoryBg] = useState('')
    let [reactType, setReactType] = useState(false)
    let [commentText, setCommentText] = useState('')
    let myId = useSelector(state => state.profile._id)
    let [isAuth, setIsAuth] = useState(false)
    let navigate = useNavigate()
    let [stories, setStories] = useState([])
    let storyContainer = useRef()
    let [match, setMatch] = useState(window.matchMedia('(max-width: 768px)').matches)
    useEffect(() => {
        setReactType('')
        api.get('/story/single', { params: { storyId: storyId } }).then(res => {
            if (res.status == 200) {
                setStory(res.data)
                setIsAuth(res.data.author._id == myId)
                setStoryBg(res.data.bgColor)
            }
        }).catch(e => {
            console.log(e)
        })
    }, [storyId])

    // setting state to store posts data

    useEffect(() => {
        // window width 
        window.matchMedia("(max-width:768px)").addEventListener('change', (e) => {
            setMatch(e.matches)
        })

        api.get('/story/').then(res => {
            if (res.status === 200) {
                setStories(res.data)
            }
        })


    }, [storyId])

    function handleNextClick(e) {
        const currentIndex = stories.findIndex(story => story?._id === storyId)
        const nextStoryId = stories[currentIndex + 1]?._id || stories[currentIndex]._id;
        navigate('/story/' + nextStoryId)

    }

    function handlePrevClick(e) {
        const currentIndex = stories.findIndex(story => story?._id === storyId)
        const prevStoryId = stories[currentIndex - 1]?._id || stories[currentIndex]._id;
        navigate('/story/' + prevStoryId)
        storyContainer.current.scrollBy({ left: 300, behavior: 'smooth' })
    }


    useEffect(() => {
        if (story) {
            story.reacts.map(react => {
                if (react.profile === myId) {
                    setReactType((react.type).toLowerCase())
                }
            })
        }

        setIsAuth(story?.author && story.author._id == myId)


    }, [story])


    let removeReact = async (storyId, postType = 'story') => {
        let placeRes = await api.post('/react/removeReact', { id: storyId, postType })
        if (placeRes.status === 200) {
            setReactType(false)
            return true;
        } else {
            return false;
        }

    }

    let placeReact = async (storyId, reactType, postType = 'story', target = null) => {

        let placeRes = await api.post('/react/addReact', { id: storyId, reactType, postType })
        if (placeRes.status === 200) {
            // setTotalReacts(placeRes.data.reacts.length)
            // setPlacedReacts([...placedReacts, type])
            setReactType(reactType)

            return true;
        } else {
            return false;
        }

    }

    let handleStoryKeyUp = async (e) => {
        if (e.keyCode === 13) {
            let res = await api.post('/comment/story/addComment', { body: commentText, storyId })
            if (res.status == 200) {

            }

            setCommentText('')
        }
    }

    let handleCommentChange = async (e) => {
        let value = e.target.value;
        setCommentText(value)



    }

    let clickLikeBtn = async (e) => {
        let currentTarget = e.currentTarget
        if (!currentTarget.classList.contains('reacted')) {
            if (placeReact(storyId, 'like', 'story')) {
                currentTarget.classList.add('reacted')
            }
        } else {
            if (removeReact(storyId)) {
                currentTarget.classList.remove('reacted')
            }

        }
    }
    let clickLoveBtn = async (e) => {
        let currentTarget = e.currentTarget
        if (!currentTarget.classList.contains('reacted')) {
            if (placeReact(storyId, 'love', 'story')) {
                currentTarget.classList.add('reacted')
            }
        } else {
            if (removeReact(storyId)) {
                currentTarget.classList.remove('reacted')
            }
        }

    }
    let clickHahaBtn = async (e) => {

        let currentTarget = e.currentTarget
        if (!currentTarget.classList.contains('reacted')) {
            if (placeReact(storyId, 'haha', 'story')) {
                currentTarget.classList.add('reacted')
            }
        } else {
            if (removeReact(storyId)) {
                currentTarget.classList.remove('reacted')
            }
        }

    }

    let handleDeletePost = async (e) => {

        confirmAlert({
            title: "Confirm Action",
            message: "Are you sure you want to delete this post?",
            buttons: [
                {
                    label: "Yes",
                    onClick: async () => {

                        $(e.currentTarget).parents('.single-story-container').remove();
                        let res = await api.post('/story/delete', { storyId })
                        if (res.status == 200) {
                            navigate('/story')
                        }
                    },
                },
                {
                    label: "No",
                    onClick: () => { },
                },
            ],
        });

    }

    return (
        <>
            <Container fluid className="story-container py-3">
                <Row>
                    <Col md="3">
                        {!match && <StoryLists stories={stories}></StoryLists>}
                    </Col>

                    <Col md="6">

                        <div ref={storyContainer} className="story-content-container">


                            {storyId ?
                                (
                                    <>
                                        (
                                        {story == null ? (<p></p>) : (
                                            <div className='single-story-container'>

                                                <div className='single-story' style={{ background: storyBg }}>
                                                    <div className='story-top'>
                                                        <div className='story-author-details'>
                                                            <div className='author-pp-container'>
                                                                {story.author && (<UserPP profilePic={story.author.profilePic} profile={story.author._id} hasStory={false} ></UserPP>)
                                                                }
                                                            </div>
                                                            <div className='author-name'>
                                                                <h3>{story.author && story.author.fullName}</h3>
                                                            </div>
                                                        </div>
                                                        <div className='story-options'>

                                                            <span className='option-button reacts'>
                                                                <Link to='reacts'>
                                                                    <i class="fa fa-heart"></i>

                                                                </Link>
                                                            </span>
                                                            <span className='option-button comments'>
                                                                <Link to='comments'>
                                                                    <i class="fa fa-comments"></i>

                                                                </Link>
                                                            </span>
                                                            {
                                                                isAuth && (<span className='option-button delete text-danger' onClick={handleDeletePost.bind(this)}>
                                                                    <i className="fa fa-trash"></i>
                                                                </span>)
                                                            }
                                                        </div>

                                                    </div>
                                                    <div className='single-story-image-container' style={{ background: `url(${story.image})` }} >
                                                        {/* <img src={story.image} alt='Story Image' className='single-story-image' />  */}
                                                    </div>
                                                </div>
                                                <div className='single-story-meta-container'>


                                                </div>

                                                <Outlet></Outlet>

                                            </div>
                                        )}
                                        )
                                        <div className="nf-story-arrow-left" onClick={handlePrevClick.bind(this)} >
                                            <i className="fa fa-chevron-left"></i>
                                        </div>
                                        <div className="nf-story-arrow-right" onClick={handleNextClick.bind(this)} >
                                            <i className="fa fa-chevron-right"></i>
                                        </div>
                                    </>
                                )
                                : (<p className="text-center fs-4">Select a story owner from left</p>)}

                        </div>


                    </Col>
                    <Col md="3">
                        <div className='single-story-meta-container'>
                            <ul className='story-reacts-list'>
                                {
                                    story.reacts && story.reacts.map((item, index) => {
                                        return (<SingleReactor reactor={item} key={index}></SingleReactor>)
                                    })
                                }
                            </ul>
                        </div>
                    </Col>

                </Row>
                {/* <Outlet></Outlet> */}
            </Container>


        </>
    )
}



export default StoryReacts;

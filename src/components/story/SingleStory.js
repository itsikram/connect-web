import React, { useEffect, useState } from 'react';
import { Outlet, useParams, Link,useNavigate} from 'react-router-dom';
import UserPP from '../UserPP';
import api from '../../api/api';
import { useSelector } from 'react-redux';
import StoryContainer from './StoryContainer';
import { confirmAlert } from 'react-confirm-alert';
import $ from 'jquery'
const Rlike = 'https://programmerikram.com/wp-content/uploads/2025/03/like-icon.svg';
const Rlove = 'https://programmerikram.com/wp-content/uploads/2025/03/love-icon.svg';
const Rhaha = 'https://programmerikram.com/wp-content/uploads/2025/03/haha-icon.svg';


const SingleStory = (props) => {
    let { storyId } = useParams();
    let [story, setStory] = useState(false)
    let [storyBg, setStoryBg] = useState('')
    let [reactType, setReactType] = useState(false)
    let [commentText, setCommentText] = useState('')
    let myId = useSelector(state => state.profile._id)
    let [isAuth,setIsAuth] = useState(false)
    let navigate = useNavigate()
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
            setCommentText('')

            }

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

    let handleDeletePost = async(e) => {

        confirmAlert({
            title: "Confirm Action",
            message: "Are you sure you want to delete this post?",
            buttons: [
                {
                    label: "Yes",
                    onClick: async () => {

                        $(e.currentTarget).parents('.single-story-container').remove();
                        let res = await api.post('/story/delete',{storyId})
                        if(res.status == 200) {
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
            <StoryContainer>
                {story == null ? (<p></p>) : 
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
                                        <i className="fa fa-heart"></i>

                                        </Link>
                                    </span>
                                    <span className='option-button comments'>
                                        <Link to='comments'>
                                        <i className="fa fa-comments"></i>

                                        </Link>
                                    </span>
                                    {
                                        isAuth &&  (<span className='option-button delete text-danger' onClick={handleDeletePost.bind(this)}>
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
                            <div className={`single-story-reacts-buttons`}>
                                <div className={`single-story-react-button ${reactType == 'like' ? 'reacted' : ''}`} onClick={clickLikeBtn.bind(this)}>
                                    <img src={Rlike} alt="Like" />
                                </div>
                                <div className={`single-story-react-button ${reactType == 'love' ? 'reacted' : ''}`} onClick={clickLoveBtn.bind(this)}>
                                    <img src={Rlove} alt="Love" />
                                </div>
                                <div className={`single-story-react-button ${reactType == 'haha' ? 'reacted' : ''}`} onClick={clickHahaBtn.bind(this)}>
                                    <img src={Rhaha} alt="Haha" />
                                </div>
                            </div>
                            <div className={`single-story-comment-container`}>
                                <input type='text' className={`single-story-comment-input`} onChange={handleCommentChange.bind(this)} placeholder='Post a comment to this story' value={commentText} onKeyUp={handleStoryKeyUp.bind(this)} />
                            </div>
                        </div>

                        <Outlet></Outlet>

                    </div>
                }
            </StoryContainer>
        </>
    )
}


export default SingleStory;
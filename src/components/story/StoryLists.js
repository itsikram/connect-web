import React, { useState, useEffect,useCallback } from 'react';
import { useParams, Link, useNavigate } from 'react-router-dom';
import UserPP from '../UserPP';
import moment from 'moment';

const StoryLists = (props) => {

    let navigate = useNavigate()

    let [stories, setStories] = useState(props.stories);
    useEffect(() => {
        setStories(props.stories);
    })
    let { storyId } = useParams();
    let getMessageTime = (timestamp) => {
        const inputDate = moment(timestamp);
        const now = moment();
        // Format based on condition
        const formattedTime = inputDate.format("dddd, hh:mm A")
        return formattedTime;
    }

    let goToProfilePath = useCallback(e => {
        navigate('/story/' + e.currentTarget.dataset.id)
    }, [])
    return (
        <>
            <div className="story-list-container">

                {stories.map((singleStory, index) => {
                    return <div data-id={singleStory._id} onClick={goToProfilePath} key={index} className='text-decoration-none story-link'>
                        <div className={`story-list-item mb-2 ${storyId == singleStory._id ? 'active' : ''}`}>
                            <div className='d-flex justify-content-center align-items-center'>
                                <div className='story-pp-container text-end'>
                                    <UserPP profilePic={singleStory?.author?.profilePic} hasStory={true} profile={singleStory?.author._id}></UserPP>
                                </div>
                                <div className='story-info-container px-2'>
                                    <h2 className='author-name fs-5 mb-0'>{singleStory.author.user.firstName + ' ' + singleStory.author.user.surname} </h2>
                                    <span className='story-time text-mute text-small' >{getMessageTime(singleStory.createdAt)}</span>
                                </div>
                            </div>
                        </div>

                    </div>
                })}
            </div>

        </>
    )
}


export default StoryLists;
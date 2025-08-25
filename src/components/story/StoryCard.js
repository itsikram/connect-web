import React, { useState, useEffect } from "react";
import UserPP from "../UserPP";
import { Link } from "react-router-dom";
import api from "../../api/api";

let StoryCard = (props) => {
    let story = props.data || {}
    let profileId = story?.author?._id || false;
    const [hasStory, setHasStory] = useState(true);
    useEffect(() => {
        setHasStory(true)

        // api.get('/profile/hasStory',{params: {
        //     profileId
        // }}).then(res => {
        //     if(res.status == 200) {
        //         if(res.data.hasStory == 'yes') {
        //         }else {
        //             setHasStory(false)

        //         }
        //     }
        // })
    }, [])
    return (
        <>
            {
                story == null ? (<p>No Story Found</p>) : (
                    <div className={`nf-story`} style={{backgroundImage: story.bgColor}}>
                        <Link to={`/story/${story._id}`}>
                            <div className="nf-story-pp-container">
                                <UserPP profile={story.author._id} hasStory={hasStory} checkStory={'no'} profilePic={story.author.profilePic} />
                            </div>
                            <div className="nf-story-image-container">
                                <img src={story.image} className="nf-story-image" alt="Story" />
                            </div>
                        </Link>

                    </div>
                )
            }


        </>

    )
}

export default StoryCard;
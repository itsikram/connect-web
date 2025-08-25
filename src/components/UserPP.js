import React, { Fragment, useState, useEffect, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import checkImgLoading from "../utils/checkImgLoading";

const default_pp_src = 'https://programmerikram.com/wp-content/uploads/2025/03/default-profilePic.png';


let UserPP = (props) => {
    const [hasStory, setHasStory] = useState(props.hasStory || false);
    const [isActive, setIsActive] = useState(false);
    const [ppLoaded, setPPLoaded] = useState(false);
    let navigate = useNavigate();

    var profileId = props.profile;


    useEffect(() => {
        // socket.emit('is_active', { profileId: profileId, myId: myProfileId })
        setIsActive( props?.active || props?.isActive || false)
        checkImgLoading(props.profilePic, setPPLoaded)

    }, [props])

    let goToProfile = useCallback(e => {
        navigate(`/${e.currentTarget.dataset.id}`)
    },[])



    return (
        <Fragment>
            <div className='user-profile-img-container'>
                {
                    isActive && <div className='active-icon active'></div>
                }

                <div className={`user-profile-img ${hasStory == true ? 'has-story' : ''}`}>
                    {
                        ppLoaded ?
                            <>
                                <div data-id={profileId} onClick={goToProfile}>
                                    <img src={props.profilePic} alt='' />

                                </div>
                            </>
                            :
                            <>
                                <div data-id={profileId} onClick={goToProfile}> <img src={default_pp_src} alt='' /></div>
                            </>
                    }
                </div>
            </div>
        </Fragment>
    )
}

export default UserPP;
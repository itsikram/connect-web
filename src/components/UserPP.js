import React, { Fragment, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import config from "../config/config.json";
import { PROFILE_IMG_REFERRER_POLICY, sanitizeProfileImageUrl } from "../utils/profileImage";
import { getProfilePath } from "../utils/profilePath";

const default_pp_src = config.defaultProfile;


let UserPP = ({profilePic, profile, username, active, hasStory,size = 40}) => {
    const displaySrc = sanitizeProfileImageUrl(profilePic) || default_pp_src;
    let navigate = useNavigate();

    var profileId = profile;

    let goToProfile = useCallback(e => {
        navigate(getProfilePath(e.currentTarget.dataset.id, "", username))
    },[navigate, username])

    const handleImgError = (e) => {
        if (e?.currentTarget && !String(e.currentTarget.src || '').includes('default-profile-pic')) {
            e.currentTarget.src = default_pp_src;
        }
    };


    return (
        <Fragment>
            <div className='user-profile-img-container'>
                {
                    active && <div className='active-icon active'></div>
                }

          <div style={{ height: size == 'full' ? '100%' : size, width: size == 'full' ? '100%' : size }} className={`user-profile-img ${hasStory == true ? 'has-story' : ''}`}>
                    <div data-id={profileId} onClick={goToProfile}>
                        <img
                            src={displaySrc}
                            alt=''
                            referrerPolicy={PROFILE_IMG_REFERRER_POLICY}
                            onError={handleImgError}
                        />
                    </div>
                </div>
            </div>
        </Fragment>
    )
}

export default UserPP;

import React, { Fragment } from "react";
import ProfileDetails from "./ProfileDetails";

const ProfileAbout = () => {
    return (
        <Fragment>
            <div id="profile-about-content">
                <div className="tab-content">
                    <ProfileDetails />
                </div>
            </div>
        </Fragment>
    );
};

export default ProfileAbout;

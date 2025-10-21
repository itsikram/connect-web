import React,{Fragment} from "react";
import { Link } from "react-router-dom";
import $ from 'jquery'
import ProfileDetails from "./ProfileDetails";


let ProfileAbout = () => {

    let aboutTabNavItemClick = (e) => {
        let target = e.currentTarget;
        $(target).addClass('active')
        $(target).siblings().removeClass('active')

    }

    return(
        <Fragment>
            <div id="profile-about-content">
                
                {/* <div className="tab-navigator">
                    <h4 className="section-title">
                        About
                    </h4>
                    <Link to="/profile/about" onClick={aboutTabNavItemClick}  className="tab-navigator-item active">Overview</Link>
                    <Link to="/profile/about" onClick={aboutTabNavItemClick}    className="tab-navigator-item">Work and Education</Link>
                    <Link to="/profile/about" onClick={aboutTabNavItemClick}  className="tab-navigator-item">OverView</Link>
                </div> */}
                <div className="tab-content">
                    <ProfileDetails></ProfileDetails>
                </div>
            </div>
        </Fragment>
    )
}

export default ProfileAbout
import React, {Fragment, useCallback, useEffect,useState} from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import CreatePost from "../post/CreatePost";
import Watch from "../watch/Watch";
import ProfileDetails from "./ProfileDetails";
import api from "../../api/api";
import $ from 'jquery'
import PostSkeleton from "../../skletons/post/PostSkeleton";
import { useRef } from "react";


let ProfileVideos = () => {
    let {profile} = useParams()
    let myProfileData = useSelector(state => state.profile) || {}
    let isAuth = myProfileData._id === profile || myProfileData.username === profile
    let [profileData, setProfileData] = useState(false)
    const [watches,setWatches] = useState([])
    const nfWatches = useRef();
    useEffect(() => {
        api.get('/watch/myWatchs',{
            params: {
                profile
            }
        }).then(res => {
            if(res.status === 200) {
                setWatches(res.data)
            }
        })

        
        api.get('/profile', {
            params: {
                profileId: profile
            }
        }).then((res) => {
            setProfileData(res.data)

        }).catch(e => console.log(e))

    },[profile])


    useEffect(() => {

        api.get('/profile', {
            params: {
                profileId: profile
            }
        }).then((res) => {
            setProfileData(res.data)
        }).catch(e => console.log(e))

    }, [])


    return(
        <Fragment>
            <div id="profile-post-content">
                <div className="intro">
                    <h4 className="section-title">Intro</h4>

                    <div className="details">
                        <ProfileDetails/>
                        {
                            // isAuth &&   <div onClick={handleEditProfileDetails} className="edit-button"> Edit Details</div>

                        }
                    </div>
                </div>
                <div className="posts-container" ref={nfWatches}>
                    {
                        // isAuth && <CreatePost setNewsFeed={setWatches}></CreatePost>
                    }
                    
                    {watches.length > 0 ? watches.map((data,index) => {
                        return <Watch key={index} myProfile={myProfileData} watch={data}></Watch>
                    })
                    :
                    <PostSkeleton  count={3}/>
                
                }
                    
                </div>
            </div>
        </Fragment>
    )
}

export default ProfileVideos;
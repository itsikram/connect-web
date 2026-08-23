import React, { Fragment, useCallback, useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import CreatePost from "../post/CreatePost";
import Post from "../post/Post";
import ProfileDetails from "./ProfileDetails";
import api from "../../api/api";
import $ from 'jquery'
import PostSkeleton from "../../skletons/post/PostSkeleton";
import { fetchProfileCached, fetchProfilePostsCached } from "../../utils/requestCache";


let PorfilePosts = () => {
    let { profile } = useParams()
    let myProfileData = useSelector(state => state.profile) || {}
    let isAuth = myProfileData._id === profile
    let [profileData, setProfileData] = useState(false)
    const [posts, setPosts] = useState([])
    const [bio, setBio] = useState(myProfileData.bio)
    let navigate = useNavigate()
    let postContainer = useRef(null)

    useEffect(() => {
        if (!profile) return;

        Promise.all([
            fetchProfilePostsCached(profile, { ttlMs: 60000, storageTtlMs: 180000 }),
            fetchProfileCached(profile, { ttlMs: 60000, storageTtlMs: 300000 }),
        ]).then(([postsResponse, profileResponse]) => {
            setPosts(Array.isArray(postsResponse) ? postsResponse : [])
            setProfileData(profileResponse)
            setBio(profileResponse?.bio || myProfileData.bio || '')
        }).catch(e => console.log(e))

    }, [profile, myProfileData.bio])



    // handle edit bio functions
    let updateBioData = (e) => {
        setBio(e.target.value)
    }
    let handleEditBio = async (e) => {
        try {
            let target = e.currentTarget

            if ($(target).hasClass('edit-button')) {
                $(target).siblings('.bio-text').hide()
                $(target).siblings('.bio-text-textarea').show()
                $(target).siblings('.bio-text-textarea').val(bio)
                $(target).removeClass('edit-button')
                $(target).addClass('save-button')
                $(target).text('Save Bio')
            } else {
                let res = await api.post('/profile/update/bio', { bio })
                $(target).text('Edit Bio')
                $(target).siblings('.bio-text').show()
                $(target).removeClass('save-button')
                $(target).siblings('.bio-text-textarea').hide()
                $(target).addClass('edit-button')

            }


        } catch (e) {
            console.log(e)
        }
    }

    let handleEditProfileDetails = useCallback(e => {
        navigate('/settings/')
    }, [navigate])



    return (
        <Fragment>
            <div id="profile-post-content">
                <div className="intro">
                    <h4 className="section-title">Intro</h4>
                    <div className="profile-bio">
                        <p className="bio-text">
                            {bio}
                        </p>
                        <textarea onChange={updateBioData} value={bio} className={"bio-text-textarea"}>

                        </textarea>
                        {
                            isAuth && <div onClick={handleEditBio} className="edit-button"> Edit bio</div>
                        }

                    </div>
                    <div className="details">
                        <ProfileDetails />
                        {
                            isAuth && <div onClick={handleEditProfileDetails} className="edit-button"> Edit Details</div>

                        }
                    </div>
                </div>
                <div ref={postContainer} className="posts-container">
                    {
                        isAuth && <CreatePost setPosts={setPosts} posts={posts}></CreatePost>
                    }

                    {posts.length > 0 ? posts.map((data, index) => {
                        return <Post key={data._id} myProfile={myProfileData} postContainer={postContainer} data={data} index={index}></Post>
                    })
                        :
                        <PostSkeleton count={3} />

                    }

                </div>
            </div>
        </Fragment>
    )
}

export default PorfilePosts;
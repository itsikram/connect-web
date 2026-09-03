import React, { Fragment, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api/api';
import { useSelector } from 'react-redux'
import PFI from './PFI';
import PfiSkleton from '../../skletons/profile/PfiSkleton';
const ProfileFriends = () => {

    let myProfile = useSelector(state => state.profile)
    let [friendsData, setFriendsData] = useState([])
    let [hasFriendsData, setHasFriendsData] = useState(true)
    let [isAuth, setIsAuth] = useState(false)

    let params = useParams()

    useEffect(() => {
        let isAuth = params.profile === myProfile._id ? true : false
        setIsAuth(isAuth)
        if (isAuth) {
            const seen = new Set()
            return setFriendsData((myProfile.friends || []).filter((friend) => {
                if (!friend?._id || seen.has(friend._id)) return false
                seen.add(friend._id)
                return true
            }))

        }

        api.get('/friend/getFriends', {
            params: {
                profile: params.profile
            }

        }).then(res => {
            setHasFriendsData(res.data.length > 0 ? true : false)
            const seen = new Set()
            setFriendsData((Array.isArray(res.data) ? res.data : []).filter((friend) => {
                if (!friend?._id || seen.has(friend._id)) return false
                seen.add(friend._id)
                return true
            }))
        }).catch(e => console.log(e))

    }, [params, myProfile])


    return (
        <Fragment>

            <div id='profile-friends-content'>
                <h4 className='section-title'>
                    Friends
                </h4>
                {
                    friendsData.length > 0 ?
                        <>
                            <div className='friend-items-container'>

                                {
                                    friendsData.map((friend, index) => {
                                        if (!isAuth) {
                                            return <PFI key={index} friend={friend}></PFI>

                                        } else if (friend._id !== myProfile._id) {
                                            return <PFI key={index} friend={friend}></PFI>

                                        }
                                    })
                                }
                            </div>
                        </>
                        :
                        <>
                            {
                                hasFriendsData && <div className='friend-items-container'>
                                    <PfiSkleton count={6} />
                                </div>
                            }

                        </>
                }


            </div>

        </Fragment>
    )
}

export default ProfileFriends;


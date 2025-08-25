import React, { Fragment, useEffect, useState } from 'react';
import { useSelector } from 'react-redux';
import { useNavigate, useParams } from 'react-router-dom';
import UserPP from '../../components/UserPP';
import socket from '../../common/socket';
import RsMenuItemSkleton from '../../skletons/rs/RsMenuItemSkleton';

let RightSidebar = () => {
    let params = useParams();
    let navigate = useNavigate();
    let userJson = localStorage.getItem('user') ? localStorage.getItem('user') : '{}'
    let { profile } = JSON.parse(userJson)
    let myProfile = useSelector(state => state.profile)
    let [friendsData, setFriendsData] = useState([])
    const [activeFriends, setActiveFriends] = useState([]);


    useEffect(() => {

        myProfile.friends && myProfile.friends.map((profile, index) => {

            socket.emit('is_active', { profileId: profile._id, myId: myProfile._id })
            socket.on('is_active', (isUserActive, lastLogin, activeProfileId) => {
                if (isUserActive == true) {
                    if (!activeFriends.includes(activeProfileId)) {
                        return setActiveFriends([...activeFriends, activeProfileId])
                    }
                }
            })
            return () => socket.off('is_active');

        })

        return () => socket.off('is_active');

    }, [myProfile, setTimeout(() => { return true }), [2000]])


    useEffect(() => {

        setFriendsData(myProfile.friends)

        // profile && api.get('/friend/getFriends',{
        //     params: {
        //         profile: profile
        //     }

        // }).then(res => {
        //     setFriendsData(res.data)
        // }).catch(e => {
        //     console.log(e)
        // })
    }, [myProfile])

    let redirectToMessage = (e) => {
        let profileId = e.currentTarget.dataset.profile
        navigate('/message/' + profileId)
    }

    return (
        <Fragment>
            <div id="right-sidebar" className='text-left'>
                <h3 className="rs-nav-title">Contacts</h3>
                <ul className="rs-nav-menu">
                    {
                        friendsData && friendsData.length > 1 ? friendsData.map((data, index) => {

                            let isFrndActive = activeFriends.includes(data._id)

                            return <li key={index}>
                                <div className='rs-nav-menu-item' data-profile={data._id} onClick={redirectToMessage.bind(this)}>
                                    <div className='rs-profile-img-container'>
                                        <div className='active-icon'></div>
                                        <div className='rs-profile-img'>
                                            <UserPP profilePic={`${data.profilePic}`} profile={data._id} active={isFrndActive}></UserPP>

                                        </div>
                                    </div>

                                    <div className='rs-text user-name'>{data.fullName ? data.fullName : data.user.firstName + ' ' + data.user.surname}</div>
                                </div>
                            </li>
                        }) :
                        <RsMenuItemSkleton count={10} />
                    }

                </ul>
            </div>
        </Fragment>
    )
}

export default RightSidebar;
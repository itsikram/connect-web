import React, { Fragment, useState,useEffect } from 'react';
import $ from 'jquery'
import { Link,useParams } from 'react-router-dom';
import api from '../../api/api';
import { useSelector } from 'react-redux';
import checkImgLoading from '../../utils/checkImgLoading';
import ImageSkleton from '../../skletons/friend/ImageSkleton';
const default_pp_src = 'https://programmerikram.com/wp-content/uploads/2025/03/default-profilePic.png';


const PFI = (props) => {
    let friend = props.friend
    let myProfile = useSelector(state => state.profile)
    let [isPpLoaded, setIsPpLoaded] = useState(false);
    let [profilePic, setProfilePic] = useState(friend.profilePic || default_pp_src);
    let params = useParams();

    let [isFriend, setIsFriend] = useState(false)

    useEffect(() => {
        myProfile.friends && myProfile.friends.filter(singleFrnd => {
            if (singleFrnd._id === friend._id) {
                setIsFriend(true)
            }
        })
        checkImgLoading(friend.profilePic, setIsPpLoaded)

                
    },[params])

    useEffect(() => {

        if(isPpLoaded) {
            setProfilePic(friend.profilePic)
        }

    }, [isPpLoaded])


    let friendFullName = friend.fullName ? friend.fullName : friend.user && friend.user.firstName + " " + friend.user.surname




    let handleFrndOptionClick = (e) => {
        let target = e.currentTarget

        $(target).children('.friend-options-menu').toggle()
    }

    let clickRemoveFrndOption = async (e) => {
        try {

            let res = await api.post('/friend/removeFriend', {
                profile: friend._id
            })
            if(res.status == 200) {
                $(e.currentTarget).parents('.friend-item').fadeOut()

            }

        } catch (error) {
            console.log(error)
        }

    }
    let clickAddFrndOption = async (e) => {
        try {

            let target = e.currentTarget
            let res = await api.post('/friend/sendRequest/', { profile: friend._id })
            if(res.status == 200) {
                $(target).parents('.friend-item').hide()

            }

        } catch (error) {
            console.log(error)
        }
    }
    return (
        <>
            <div className='friend-item'>

                <div className='friend-info'>
                    <Link to={'/' + friend._id}>
                        <div className='friend-profilePic'>
                            {
                                isPpLoaded ? <img src={profilePic} alt={friendFullName} ></img> : <ImageSkleton />
                            }
                            
                        </div>
                        <div className='friend-details'>
                            <h4 className='friend-name text-capitalize'>{friendFullName}</h4>
                            {
                                friend.mutual && <span className='friend-mutual'> 20 Mutual Friends</span>
                            }

                        </div>
                    </Link>


                </div>
                <div className='friend-options' onClick={handleFrndOptionClick}>
                    <i className='far fa-ellipsis-h'></i>

                    <div className='friend-options-menu'>
                        {
                            isFriend ?
                                <div onClick={clickRemoveFrndOption} className='friend-options-menu-item'>
                                    <div className='menu-item-icon'>
                                        <i className="fas fa-user-times"></i>
                                    </div>
                                    <div className='menu-item-text'>Remove Friend</div>
                                </div>

                                :
                                <div onClick={clickAddFrndOption} className='friend-options-menu-item'>
                                    <div className='menu-item-icon'>
                                        <i className="fas fa-user-plus"></i>
                                    </div>
                                    <div className='menu-item-text'>Add Friend</div>
                                </div>
                        }

                    </div>

                </div>
            </div>
        </>
    );
}

export default PFI;

import React, { Fragment, useState,useEffect } from 'react';
import $ from 'jquery'
import { Link,useParams } from 'react-router-dom';
import api from '../../api/api';
import { useSelector } from 'react-redux';
import checkImgLoading from '../../utils/checkImgLoading';
import ImageSkleton from '../../skletons/friend/ImageSkleton';
import config from "../../config/config.json";
import ReportModal from '../modal/ReportModal';
const default_pp_src = config?.defaultProfile;


const PFI = (props) => {
    let friend = props.friend
    let myProfile = useSelector(state => state.profile)
    let [isPpLoaded, setIsPpLoaded] = useState(false);
    let [profilePic, setProfilePic] = useState(friend.profilePic || default_pp_src);
    let params = useParams();

    let [isFriend, setIsFriend] = useState(false)
    let [isReportOpen, setIsReportOpen] = useState(false)

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
                        {friend._id !== myProfile._id && (
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsReportOpen(true);
                                }}
                                className='friend-options-menu-item'
                            >
                                <div className='menu-item-icon'>
                                    <i className="fas fa-flag"></i>
                                </div>
                                <div className='menu-item-text'>Report Profile</div>
                            </div>
                        )}

                    </div>

                </div>
            </div>
            {isReportOpen && friend?._id && (
                <ReportModal
                    isOpen={isReportOpen}
                    onRequestClose={() => setIsReportOpen(false)}
                    type="profile"
                    targetId={friend._id}
                    targetLabel={friendFullName || 'this profile'}
                />
            )}
        </>
    );
}

export default PFI;

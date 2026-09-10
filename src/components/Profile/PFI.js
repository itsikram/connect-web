import React, { Fragment, useState,useEffect } from 'react';
import $ from 'jquery'
import { Link,useParams } from 'react-router-dom';
import api from '../../api/api';
import { useSelector } from 'react-redux';
import checkImgLoading from '../../utils/checkImgLoading';
import ImageSkleton from '../../skletons/connect/ImageSkleton';
import config from "../../config/config.json";
import ReportModal from '../modal/ReportModal';
import VerifiedName from '../feed/VerifiedName';
const default_pp_src = config?.defaultProfile;


const PFI = (props) => {
    let connect = props.connect
    let myProfile = useSelector(state => state.profile)
    let [isPpLoaded, setIsPpLoaded] = useState(false);
    let [profilePic, setProfilePic] = useState(connect.profilePic || default_pp_src);
    let params = useParams();

    let [isConnect, setIsConnect] = useState(false)
    let [isReportOpen, setIsReportOpen] = useState(false)

    useEffect(() => {
        myProfile.connects && myProfile.connects.filter(singleConnect => {
            if (singleConnect._id === connect._id) {
                setIsConnect(true)
            }
        })
        checkImgLoading(connect.profilePic, setIsPpLoaded)

                
    },[params])

    useEffect(() => {

        if(isPpLoaded) {
            setProfilePic(connect.profilePic)
        }

    }, [isPpLoaded])


    let connectFullName = connect.fullName ? connect.fullName : connect.user && connect.user.firstName + " " + connect.user.surname




    let handleFrndOptionClick = (e) => {
        let target = e.currentTarget

        $(target).children('.connect-options-menu').toggle()
    }

    let clickRemoveFrndOption = async (e) => {
        try {

            let res = await api.post('/connects/removeConnect', {
                profile: connect._id
            })
            if(res.status == 200) {
                $(e.currentTarget).parents('.connect-item').fadeOut()

            }

        } catch (error) {
            console.log(error)
        }

    }
    let clickAddFrndOption = async (e) => {
        try {

            let target = e.currentTarget
            let res = await api.post('/connects/sendRequest/', { profile: connect._id })
            if(res.status == 200) {
                $(target).parents('.connect-item').hide()

            }

        } catch (error) {
            console.log(error)
        }
    }
    return (
        <>
            <div className='connect-item'>

                <div className='connect-info'>
                    <Link to={'/' + connect._id}>
                        <div className='connect-profilePic'>
                            {
                                isPpLoaded ? <img src={profilePic} alt={connectFullName} referrerPolicy="no-referrer" ></img> : <ImageSkleton />
                            }
                            
                        </div>
                        <div className='connect-details'>
                            <h4 className='connect-name text-capitalize'>
                                <VerifiedName profile={connect}>{connectFullName}</VerifiedName>
                            </h4>
                            {
                                connect.mutual && <span className='connect-mutual'> 20 Mutual Connects</span>
                            }

                        </div>
                    </Link>


                </div>
                <div className='connect-options' onClick={handleFrndOptionClick}>
                    <i className='far fa-ellipsis-h'></i>

                    <div className='connect-options-menu'>
                        {
                            isConnect ?
                                <div onClick={clickRemoveFrndOption} className='connect-options-menu-item'>
                                    <div className='menu-item-icon'>
                                        <i className="fas fa-user-times"></i>
                                    </div>
                                    <div className='menu-item-text'>Remove Connect</div>
                                </div>

                                :
                                <div onClick={clickAddFrndOption} className='connect-options-menu-item'>
                                    <div className='menu-item-icon'>
                                        <i className="fas fa-user-plus"></i>
                                    </div>
                                    <div className='menu-item-text'>Add Connect</div>
                                </div>
                        }
                        {connect._id !== myProfile._id && (
                            <div
                                onClick={(e) => {
                                    e.stopPropagation();
                                    setIsReportOpen(true);
                                }}
                                className='connect-options-menu-item'
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
            {isReportOpen && connect?._id && (
                <ReportModal
                    isOpen={isReportOpen}
                    onRequestClose={() => setIsReportOpen(false)}
                    type="profile"
                    targetId={connect._id}
                    targetLabel={connectFullName || 'this profile'}
                />
            )}
        </>
    );
}

export default PFI;

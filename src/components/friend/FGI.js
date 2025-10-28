import React, { Fragment, useState, useEffect } from 'react';
import { Link } from "react-router-dom";
import api from '../../api/api';
import $ from 'jquery'
import { useSelector } from 'react-redux';
import checkImgLoading from '../../utils/checkImgLoading';
import ImageSkleton from '../../skletons/friend/ImageSkleton';


let FGI = (props) => {

    let [isPpLoaded, setIsPpLoaded] = useState(false)
    let [profilePic, setProfilePic] = useState(props?.profilePic || config?.defaultProfile)
    let [isAccepting, setIsAccepting] = useState(false)
    let [isDeleting, setIsDeleting] = useState(false)
    let [isAdding, setIsAdding] = useState(false)
    let [isRemoving, setIsRemoving] = useState(false)
    let myProfile = useSelector(state => state.profile)
    let type = props.type;
    let fullName = props.fullName
    let profile = props.id ? props.id : ''

    let profileReqs = props.profileReqs ? props.profileReqs : false
    let isReq = profileReqs && profileReqs.includes(myProfile._id)


    useEffect(() => {
        if (props.profilePic) {
            checkImgLoading(profilePic, setIsPpLoaded)
        }
    }, [props])

    useEffect(() => {
        if (isPpLoaded) {
            setProfilePic(props.profilePic)
        }
    }, [isPpLoaded])

    // handle friend request button clicks
    let handleAcceptReq = async (e) => {
        setIsAccepting(true)
        try {
            let res = await api.post('/friend/reqAccept', { profile })

            if (res.status === 200) {
                $(e.target).text('Request Accepted')
                $(e.target).parents('.friend-grid-item').hide()
            }
        } catch (error) {
            console.log(error)
        } finally {
            setIsAccepting(false)
        }
    }

    let handleDeleteReq = async (e) => {
        setIsDeleting(true)
        try {
            let target = e.currentTarget
            let res = await api.post('/friend/reqDelete', { profile })

            $(target).parents('.friend-grid-item ').hide()

        } catch (error) {
            console.log(error)
        } finally {
            setIsDeleting(false)
        }
    }


    // handle friend suggetions button clicks 

    let handleAddFriend = async (e) => {
        setIsAdding(true)
        try {
            let target = e.target
            let res = await api.post('/friend/sendRequest', { profile })
            $(target).text('Request Sent')
            $(target).parents('.friend-grid-item').fadeOut()

        } catch (error) {
            console.log(error)
        } finally {
            setIsAdding(false)
        }
    }

    let handleRomoveFriend = async (e) => {
        setIsRemoving(true)
        let target = e.currentTarget

        try {
            let res = await api.post('/friend/removeRequest', { profile })

            $(target).siblings('.add-friend').text('Add Friend')
            !isReq && $(target).parents('.friend-grid-item').fadeOut()

        } catch (error) {
            console.log(error)
        } finally {
            setIsRemoving(false)
        }
    }



    if (type === "req") {

        return (
            <Fragment>
                {
                    (isPpLoaded == true) ? (
                        <>
                            <div className="friend-grid-item request">
                                <Link to={`/${profile}/`}>
                                    <div className="profile-picture" alt="profile pic" style={{ backgroundImage: `url(${profilePic})` }}></div>
                                </Link>

                                <div className="grid-body">
                                    <Link to={`/${profile}/`}>
                                        <h5 className="profile-name">{fullName}</h5>
                                    </Link>

                                    <div 
                                        onClick={isAccepting || isDeleting ? null : handleAcceptReq} 
                                        className={`primary-button button ${isAccepting || isDeleting ? 'disabled' : ''}`}
                                        style={{ opacity: isAccepting || isDeleting ? 0.6 : 1, cursor: isAccepting || isDeleting ? 'not-allowed' : 'pointer' }}
                                    >
                                        {isAccepting ? 'Accepting...' : 'Confirm'}
                                    </div>
                                    <div 
                                        onClick={isAccepting || isDeleting ? null : handleDeleteReq} 
                                        className={`button ${isAccepting || isDeleting ? 'disabled' : ''}`}
                                        style={{ opacity: isAccepting || isDeleting ? 0.6 : 1, cursor: isAccepting || isDeleting ? 'not-allowed' : 'pointer' }}
                                    >
                                        {isDeleting ? 'Deleting...' : 'Delete'}
                                    </div>

                                </div>
                            </div>
                        </>
                    ) : (<>
                        <div className="friend-grid-item request">
                            <Link to={`/${profile}/`}>
                                <ImageSkleton />
                            </Link>

                            <div className="grid-body">
                                <Link to={`/${profile}/`}>
                                    <h5 className="profile-name">{fullName}</h5>
                                </Link>

                                <div 
                                    onClick={isAccepting || isDeleting ? null : handleAcceptReq} 
                                    className={`primary-button button ${isAccepting || isDeleting ? 'disabled' : ''}`}
                                    style={{ opacity: isAccepting || isDeleting ? 0.6 : 1, cursor: isAccepting || isDeleting ? 'not-allowed' : 'pointer' }}
                                >
                                    {isAccepting ? 'Accepting...' : 'Confirm'}
                                </div>
                                <div 
                                    onClick={isAccepting || isDeleting ? null : handleDeleteReq} 
                                    className={`button ${isAccepting || isDeleting ? 'disabled' : ''}`}
                                    style={{ opacity: isAccepting || isDeleting ? 0.6 : 1, cursor: isAccepting || isDeleting ? 'not-allowed' : 'pointer' }}
                                >
                                    {isDeleting ? 'Deleting...' : 'Delete'}
                                </div>

                            </div>
                        </div>
                    </>)
                }

            </Fragment>
        )

    }


    return (
        <Fragment>

            {
                isPpLoaded ? (
                    <>
                        <div className="friend-grid-item suggest">
                            <Link to={`/${profile}/`}>
                                <div className="profile-picture" alt="profile pic" style={{ backgroundImage: `url(${profilePic})` }}></div>
                            </Link>

                            <div className="grid-body">
                                <Link to={`/${profile}/`}>
                                    <h5 className="profile-name">{fullName}</h5>
                                </Link>

                                <div 
                                    onClick={isAdding || isRemoving ? null : handleAddFriend} 
                                    className={`primary-button add-friend button ${isAdding || isRemoving ? 'disabled' : ''}`}
                                    style={{ opacity: isAdding || isRemoving ? 0.6 : 1, cursor: isAdding || isRemoving ? 'not-allowed' : 'pointer' }}
                                >
                                    {
                                        isAdding ? 'Adding...' : isReq ? 'Request Sent' : 'Add Friend'
                                    }
                                </div>
                                <div 
                                    onClick={isAdding || isRemoving ? null : handleRomoveFriend} 
                                    className={`button remove-friend ${isAdding || isRemoving ? 'disabled' : ''}`}
                                    style={{ opacity: isAdding || isRemoving ? 0.6 : 1, cursor: isAdding || isRemoving ? 'not-allowed' : 'pointer' }}
                                >
                                    {isRemoving ? 'Removing...' : 'Remove'}
                                </div>

                            </div>
                        </div>
                    </>
                ) :
                    (
                        <>
                            <div className="friend-grid-item suggest">
                                <Link to={`/${profile}/`}>
                                    <ImageSkleton />

                                </Link>

                                <div className="grid-body">
                                    <Link to={`/${profile}/`}>
                                        <h5 className="profile-name">{fullName}</h5>
                                    </Link>

                                    <div 
                                        onClick={isAdding || isRemoving ? null : handleAddFriend} 
                                        className={`primary-button add-friend button ${isAdding || isRemoving ? 'disabled' : ''}`}
                                        style={{ opacity: isAdding || isRemoving ? 0.6 : 1, cursor: isAdding || isRemoving ? 'not-allowed' : 'pointer' }}
                                    >
                                        {
                                            isAdding ? 'Adding...' : isReq ? 'Request Sent' : 'Add Friend'
                                        }
                                    </div>
                                    <div 
                                        onClick={isAdding || isRemoving ? null : handleRomoveFriend} 
                                        className={`button remove-friend ${isAdding || isRemoving ? 'disabled' : ''}`}
                                        style={{ opacity: isAdding || isRemoving ? 0.6 : 1, cursor: isAdding || isRemoving ? 'not-allowed' : 'pointer' }}
                                    >
                                        {isRemoving ? 'Removing...' : 'Remove'}
                                    </div>

                                </div>
                            </div>
                        </>
                    )

            }

        </Fragment>
    )
}

export default FGI; 
import React, { Fragment, useState, useEffect } from 'react';
import { Link } from "react-router-dom";
import api from '../../api/api';
import $ from 'jquery'
import { useDispatch, useSelector } from 'react-redux';
import checkImgLoading from '../../utils/checkImgLoading';
import ConnectCacheManager from '../../utils/connectCacheManager';
import RelationshipPickerModal from '../RelationshipPickerModal';
import config from "../../config/config.json";
import VerifiedName from "../feed/VerifiedName";
import { getProfileSuccess } from '../../services/actions/profileActions';

let CGI = (props) => {

    let [isPpLoaded, setIsPpLoaded] = useState(false)
    let [profilePic, setProfilePic] = useState(props?.profilePic || config?.defaultProfile)
    let [isAccepting, setIsAccepting] = useState(false)
    let [isDeleting, setIsDeleting] = useState(false)
    let [isAdding, setIsAdding] = useState(false)
    let [isRemoving, setIsRemoving] = useState(false)
    let [relationshipMode, setRelationshipMode] = useState(null)
    let [isCompleted, setIsCompleted] = useState(false)
    let myProfile = useSelector(state => state.profile)
    let dispatch = useDispatch()
    let type = props.type;
    let fullName = props.fullName
    let profile = props.id ? props.id : ''

    let profileReqs = props.profileReqs ? props.profileReqs : false
    let isReq = Array.isArray(profileReqs) && profileReqs.some((id) =>
        String(id?._id || id) === String(myProfile._id)
    )


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

    // handle connect request button clicks
    let handleAcceptReq = async (relationTypes) => {
        setIsAccepting(true)
        try {
            let res = await api.post('/connects/reqAccept', { profile, relationTypes })

            if (res.status === 200) {
                setIsCompleted(true)
                if (res.data?.myProfile) {
                    dispatch(getProfileSuccess({ ...myProfile, ...res.data.myProfile }))
                }
                ConnectCacheManager.removeProfile(myProfile._id, 'requests', profile)
                ConnectCacheManager.removeProfile(myProfile._id, 'suggestions', profile)
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
            let res = await api.post('/connects/reqDelete', { profile })

            $(target).parents('.connect-grid-item ').hide()
            ConnectCacheManager.removeProfile(myProfile._id, 'requests', profile)

        } catch (error) {
            console.log(error)
        } finally {
            setIsDeleting(false)
        }
    }


    // handle connect suggetions button clicks 

    let handleAddConnect = async (relationTypes) => {
        setIsAdding(true)
        try {
            let res = await api.post('/connects/sendRequest', { profile, relationTypes })
            if (res.status === 200) setIsCompleted(true)
            ConnectCacheManager.removeProfile(myProfile._id, 'suggestions', profile)
            window.dispatchEvent(new Event('connect-request-updated'))

        } catch (error) {
            console.log(error)
        } finally {
            setIsAdding(false)
        }
    }

    let handleRemoveRequest = async (e) => {
        setIsRemoving(true)
        let target = e.currentTarget

        try {
            let res = await api.post('/connects/removeRequest', { profile })

            $(target).siblings('.add-connect').text('Add Connect')
            !isReq && $(target).parents('.connect-grid-item').fadeOut()
            ConnectCacheManager.removeProfile(myProfile._id, 'suggestions', profile)
            window.dispatchEvent(new Event('connect-request-updated'))

        } catch (error) {
            console.log(error)
        } finally {
            setIsRemoving(false)
        }
    }



    if (isCompleted) return null

    if (type === "req") {

        return (
            <Fragment>
                {
                    (isPpLoaded == true) ? (
                        <>
                            <div className="connect-grid-item request">
                                <Link to={`/${profile}/`}>
                                    <div className="profile-picture" alt="profile pic" style={{ backgroundImage: `url(${profilePic})` }}></div>
                                </Link>

                                <div className="grid-body">
                                    <Link to={`/${profile}/`}>
                                        <h5 className="profile-name"><VerifiedName profile={props}>{fullName}</VerifiedName></h5>
                                    </Link>

                                    <div 
                                        onClick={isAccepting || isDeleting ? null : () => setRelationshipMode('accept')} 
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
                        <div className="connect-grid-item request">
                            <Link to={`/${profile}/`}>
                                <div className="profile-picture fgi-skeleton-photo" aria-hidden="true"></div>
                            </Link>

                            <div className="grid-body">
                                <Link to={`/${profile}/`}>
                                    <h5 className="profile-name"><VerifiedName profile={props}>{fullName}</VerifiedName></h5>
                                </Link>

                                <div 
                                    onClick={isAccepting || isDeleting ? null : () => setRelationshipMode('accept')} 
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

                <RelationshipPickerModal open={Boolean(relationshipMode)}
                    onClose={() => setRelationshipMode(null)}
                    onSubmit={(types) => {
                        setRelationshipMode(null);
                        handleAcceptReq(types);
                    }}
                    loading={isAccepting || isDeleting} />
            </Fragment>
        )

    }


    return (
        <Fragment>

            {
                isPpLoaded ? (
                    <>
                        <div className="connect-grid-item suggest">
                            <Link to={`/${profile}/`}>
                                <div className="profile-picture" alt="profile pic" style={{ backgroundImage: `url(${profilePic})` }}></div>
                            </Link>

                            <div className="grid-body">
                                <Link to={`/${profile}/`}>
                                    <h5 className="profile-name"><VerifiedName profile={props}>{fullName}</VerifiedName></h5>
                                </Link>

                                <div 
                                    onClick={isAdding || isRemoving ? null : () => setRelationshipMode('send')}
                                    className={`primary-button add-connect button ${isAdding || isRemoving ? 'disabled' : ''}`}
                                    style={{ opacity: isAdding || isRemoving ? 0.6 : 1, cursor: isAdding || isRemoving ? 'not-allowed' : 'pointer' }}
                                >
                                    {
                                        isAdding ? 'Adding...' : isReq ? 'Request Sent' : 'Add Connect'
                                    }
                                </div>
                                <div 
                                    onClick={isAdding || isRemoving ? null : handleRemoveRequest} 
                                    className={`button remove-request ${isAdding || isRemoving ? 'disabled' : ''}`}
                                    style={{ opacity: isAdding || isRemoving ? 0.6 : 1, cursor: isAdding || isRemoving ? 'not-allowed' : 'pointer' }}
                                >
                                    {isRemoving ? (isReq ? 'Canceling...' : 'Removing...') : (isReq ? 'Cancel Request' : 'Remove')}
                                </div>

                            </div>
                        </div>
                    </>
                ) :
                    (
                        <>
                            <div className="connect-grid-item suggest">
                                <Link to={`/${profile}/`}>
                                    <div className="profile-picture fgi-skeleton-photo" aria-hidden="true"></div>
                                </Link>

                                <div className="grid-body">
                                    <Link to={`/${profile}/`}>
                                        <h5 className="profile-name"><VerifiedName profile={props}>{fullName}</VerifiedName></h5>
                                    </Link>

                                    <div 
                                        onClick={isAdding || isRemoving ? null : () => setRelationshipMode('send')} 
                                        className={`primary-button add-connect button ${isAdding || isRemoving ? 'disabled' : ''}`}
                                        style={{ opacity: isAdding || isRemoving ? 0.6 : 1, cursor: isAdding || isRemoving ? 'not-allowed' : 'pointer' }}
                                    >
                                        {
                                            isAdding ? 'Adding...' : isReq ? 'Request Sent' : 'Add Connect'
                                        }
                                    </div>
                                    <div 
                                        onClick={isAdding || isRemoving ? null : handleRemoveRequest} 
                                        className={`button remove-request ${isAdding || isRemoving ? 'disabled' : ''}`}
                                        style={{ opacity: isAdding || isRemoving ? 0.6 : 1, cursor: isAdding || isRemoving ? 'not-allowed' : 'pointer' }}
                                    >
                                        {isRemoving ? (isReq ? 'Canceling...' : 'Removing...') : (isReq ? 'Cancel Request' : 'Remove')}
                                    </div>

                                </div>
                            </div>
                        </>
                    )

            }

            <RelationshipPickerModal open={Boolean(relationshipMode)}
                onClose={() => setRelationshipMode(null)}
                onSubmit={(types) => {
                    const mode = relationshipMode;
                    setRelationshipMode(null);
                    if (mode === 'send') handleAddConnect(types);
                    if (mode === 'accept') handleAcceptReq(types);
                }}
                loading={isAdding || isAccepting} />
        </Fragment>
    )
}

export default CGI; 
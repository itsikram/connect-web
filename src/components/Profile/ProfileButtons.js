import React, { Fragment, useState } from 'react';
import api from '../../api/api';
import $ from 'jquery';
import { useDispatch, useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import CreateStoryModal from '../story/CreateStoryModal';
import ReportModal from '../modal/ReportModal';
import RelationshipPickerModal from '../RelationshipPickerModal';
import { getProfileSuccess } from '../../services/actions/profileActions';

const ProfileButtons = (props) => {
    const navigate = useNavigate();
    const myProfile = useSelector(state => state.profile);
    const dispatch = useDispatch();
    const profileData = props.profileData;
    const isAuth = props.isAuth;
    const isConnect = props.isConnect;
    const [isStoryModal, setIsStoryModal] = useState(false);
    const [isAddingConnect, setIsAddingConnect] = useState(false);
    const [isCancelingReq, setIsCancelingReq] = useState(false);
    const [isConfirmingReq, setIsConfirmingReq] = useState(false);
    const [isRemovingConnect, setIsRemovingConnect] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);
    const [relationshipMode, setRelationshipMode] = useState(null);
    const [requestSent, setRequestSent] = useState(null);
    const [requestReceived, setRequestReceived] = useState(null);
    const containsProfileId = (list, id) =>
        Array.isArray(list) && list.some((item) => String(item?._id || item) === String(id));
    const isReqSent =
        requestSent === null
            ? containsProfileId(profileData.connectReqs, myProfile._id)
            : requestSent;
    const isReqRecived =
        requestReceived === null
            ? containsProfileId(myProfile.connectReqs, profileData._id)
            : requestReceived;
    const isReq = isReqSent || isReqRecived || requestSent;

    React.useEffect(() => {
        let active = true;
        api.get('/connects/request-status', { params: { profileId: profileData._id } })
            .then(({ data }) => {
                if (!active) return;
                if (data.connected) return;
                setRequestSent(Boolean(data.outgoing));
                setRequestReceived(Boolean(data.incoming));
            })
            .catch((error) => console.error('Failed to load connect request status:', error));
        return () => { active = false; };
    }, [profileData._id]);

    const submitRelationship = async (relationTypes) => {
        const mode = relationshipMode;
        setRelationshipMode(null);
        if (mode === 'send') {
            setIsAddingConnect(true);
            try { await api.post('/connects/sendRequest/', { profile: profileData._id, relationTypes }); setRequestSent(true); }
            catch (err) { console.error(err); } finally { setIsAddingConnect(false); }
        } else {
            setIsConfirmingReq(true);
            try {
                const response = await api.post('/connects/reqAccept', { profile: profileData._id, relationTypes });
                setRequestReceived(false);
                if (response.data?.myProfile) {
                    dispatch(getProfileSuccess({ ...myProfile, ...response.data.myProfile }));
                }
            }
            catch (err) { console.error(err); } finally { setIsConfirmingReq(false); }
        }
    };

    const clickAddConnectBtn = () => {
        if (!isAddingConnect) {
            setRelationshipMode('send');
        }
    };

    const clickConnectBtn = (e) => {
        const target = e.currentTarget;
        $(target).children('.connect-options-menu').toggleClass('hide');
    };

    const clickMessageBtn = () => {
        navigate(`/message/${profileData._id}`);
    };

    const handleCencleReq = async (e) => {
        const target = e.currentTarget;

        if (!$(target).hasClass('removed')) {
            setIsCancelingReq(true);
            try {
                await api.post('/connects/removeRequest', { profile: profileData._id });
                setRequestSent(false);
                $(target).addClass('removed');
                $(target).children('span').text('Request Canceled');
            } catch (error) {
                console.log(error);
            } finally {
                setIsCancelingReq(false);
            }
        }
    };

    const handleConfirmReq = () => {
        if (!isConfirmingReq) setRelationshipMode('accept');
    };

    const clickDisconnectBtn = async (e) => {
        const target = e.currentTarget;
        setIsRemovingConnect(true);
        try {
            const response = await api.post('/connects/disconnect', { profile: profileData._id });
            if (response.data?.myProfile) {
                dispatch(getProfileSuccess(response.data.myProfile));
            }
            setRequestSent(false);
            setRequestReceived(false);
            $(target).parents('.connect').hide();
        } catch (error) {
            console.log(error);
        } finally {
            setIsRemovingConnect(false);
        }
    };

    return (
        <Fragment>
            <RelationshipPickerModal open={Boolean(relationshipMode)} onClose={() => setRelationshipMode(null)}
                onSubmit={submitRelationship} loading={isAddingConnect || isConfirmingReq} />
            {
                isAuth ? (
                    <div className="profile-buttons">
                        <div className="highligh-btn button add-story" onClick={() => setIsStoryModal(true)}>
                            <i className="fas fa-plus-circle" />
                            <span>Add to story</span>
                        </div>
                        {isStoryModal && (
                        <CreateStoryModal
                            isOpen
                            onRequestClose={() => setIsStoryModal(false)}
                            profileData={profileData}
                        />
                        )}
                        <div onClick={() => navigate('/settings')} className="normal-btn button edit-profile">
                            <i className="fas fa-pen" />
                            <span>Edit Profile</span>
                        </div>
                    </div>
                ) : isConnect ? (
                    <div className="profile-buttons">
                        <div onClick={clickConnectBtn} className="button normal-btn connect">
                            <i className="fas fa-user-check" />
                            <span>Connect</span>
                            <div className="connect-options-menu hide">
                                <div
                                    onClick={isRemovingConnect ? null : clickDisconnectBtn}
                                    className={`connect-options-menu-item ${isRemovingConnect ? 'disabled' : ''}`}
                                    style={{ opacity: isRemovingConnect ? 0.6 : 1, cursor: isRemovingConnect ? 'not-allowed' : 'pointer' }}
                                >
                                    <div className="menu-item-icon">
                                        <i className="fas fa-user-times" />
                                    </div>
                                    <div className="menu-item-text">
                                        {isRemovingConnect ? 'Disconnecting...' : 'Disconnect'}
                                    </div>
                                </div>
                                <div
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        setIsReportOpen(true);
                                    }}
                                    className="connect-options-menu-item"
                                >
                                    <div className="menu-item-icon">
                                        <i className="fas fa-flag" />
                                    </div>
                                    <div className="menu-item-text">Report Profile</div>
                                </div>
                            </div>
                        </div>
                        <div onClick={clickMessageBtn} className="highligh-btn button message-button">
                            <i className="fas fa-comment-dots" />
                            <span>Message</span>
                        </div>
                    </div>
                ) : !isReq ? (
                    <div className="profile-buttons">
                        <div
                            onClick={isAddingConnect ? null : clickAddConnectBtn}
                            className={`highligh-btn button add-connect ${isAddingConnect ? 'disabled' : ''}`}
                            style={{ opacity: isAddingConnect ? 0.6 : 1, cursor: isAddingConnect ? 'not-allowed' : 'pointer' }}
                        >
                            <i className="fas fa-user-check" />
                            <span>{isAddingConnect ? 'Adding...' : 'Add Connect'}</span>
                        </div>
                        <div onClick={clickMessageBtn} className="normal-btn button message-button">
                            <i className="fas fa-comment-dots" />
                            <span>Message</span>
                        </div>
                    </div>
                ) : isReqSent ? (
                    <div className="profile-buttons">
                        <div
                            onClick={isCancelingReq ? null : handleCencleReq}
                            className={`normal-btn button cencel-connect ${isCancelingReq ? 'disabled' : ''}`}
                            style={{ opacity: isCancelingReq ? 0.6 : 1, cursor: isCancelingReq ? 'not-allowed' : 'pointer' }}
                        >
                            <i className="fas fa-user-check" />
                            <span>{isCancelingReq ? 'Canceling...' : 'Cancel Request'}</span>
                        </div>
                        <div onClick={clickMessageBtn} className="highligh-btn button message-button">
                            <i className="fas fa-comment-dots" />
                            <span>Message</span>
                        </div>
                    </div>
                ) : (
                    <div className="profile-buttons">
                        <div
                            onClick={isConfirmingReq ? null : handleConfirmReq}
                            className={`highligh-btn button confirm-connect ${isConfirmingReq ? 'disabled' : ''}`}
                            style={{ opacity: isConfirmingReq ? 0.6 : 1, cursor: isConfirmingReq ? 'not-allowed' : 'pointer' }}
                        >
                            <i className="fas fa-user-check" />
                            <span>{isConfirmingReq ? 'Confirming...' : 'Confirm Request'}</span>
                        </div>
                        <div onClick={clickMessageBtn} className="normal-btn button message-button">
                            <i className="fas fa-comment-dots" />
                            <span>Message</span>
                        </div>
                    </div>
                )
            }
            {isReportOpen && profileData?._id && (
                <ReportModal
                    isOpen={isReportOpen}
                    onRequestClose={() => setIsReportOpen(false)}
                    type="profile"
                    targetId={profileData._id}
                    targetLabel={
                        [profileData.user?.firstName, profileData.user?.surname].filter(Boolean).join(' ')
                        || profileData.displayName
                        || 'this profile'
                    }
                />
            )}
        </Fragment>
    );
};

export default ProfileButtons;

import React, { Fragment, useState } from 'react';
import api from '../../api/api';
import $ from 'jquery';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import CreateStoryModal from '../story/CreateStoryModal';
import ReportModal from '../modal/ReportModal';

const ProfileButtons = (props) => {
    const navigate = useNavigate();
    const myProfile = useSelector(state => state.profile);
    const profileData = props.profileData;
    const isAuth = props.isAuth;
    const isConnect = props.isConnect;
    const isReqSent = profileData.connectReqs && profileData.connectReqs.includes(myProfile._id);
    const isReqRecived = myProfile.connectReqs && myProfile.connectReqs.includes(profileData._id);
    const isReq = isReqSent || isReqRecived;
    const [isStoryModal, setIsStoryModal] = useState(false);
    const [isAddingConnect, setIsAddingConnect] = useState(false);
    const [isCancelingReq, setIsCancelingReq] = useState(false);
    const [isConfirmingReq, setIsConfirmingReq] = useState(false);
    const [isRemovingConnect, setIsRemovingConnect] = useState(false);
    const [isReportOpen, setIsReportOpen] = useState(false);

    const clickAddConnectBtn = async (e) => {
        const target = e.currentTarget;

        if (!$(target).hasClass('sent')) {
            setIsAddingConnect(true);
            try {
                await api.post('/connects/sendRequest/', {
                    profile: profileData._id,
                });
                $(target).children('span').text('Request Sent');
                $(target).addClass('sent');
            } catch (err) {
                console.log(err);
            } finally {
                setIsAddingConnect(false);
            }
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
                $(target).addClass('removed');
                $(target).children('span').text('Request Canceled');
            } catch (error) {
                console.log(error);
            } finally {
                setIsCancelingReq(false);
            }
        }
    };

    const handleConfirmReq = async (e) => {
        const target = e.currentTarget;
        if (!$(target).hasClass('accepted')) {
            setIsConfirmingReq(true);
            try {
                await api.post('/connects/reqAccept', { profile: profileData._id });
                $(target).children('span').text('Accepted');
                $(target).addClass('Connect Accepted');
            } catch (error) {
                console.log(error);
            } finally {
                setIsConfirmingReq(false);
            }
        }
    };

    const clickDisconnectBtn = async (e) => {
        const target = e.currentTarget;
        setIsRemovingConnect(true);
        try {
            await api.post('/connects/disconnect', { profile: profileData._id });
            $(target).parents('.connect').hide();
        } catch (error) {
            console.log(error);
        } finally {
            setIsRemovingConnect(false);
        }
    };

    return (
        <Fragment>
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

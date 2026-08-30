import React, { Fragment, useState } from 'react';
import api from '../../api/api';
import $ from 'jquery';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import CreateStoryModal from '../story/CreateStoryModal';

const ProfileButtons = (props) => {
    const navigate = useNavigate();
    const myProfile = useSelector(state => state.profile);
    const profileData = props.profileData;
    const isAuth = props.isAuth;
    const isFriend = props.isFriend;
    const isReqSent = profileData.friendReqs && profileData.friendReqs.includes(myProfile._id);
    const isReqRecived = myProfile.friendReqs && myProfile.friendReqs.includes(profileData._id);
    const isReq = isReqSent || isReqRecived;
    const [isStoryModal, setIsStoryModal] = useState(false);
    const [isAddingFriend, setIsAddingFriend] = useState(false);
    const [isCancelingReq, setIsCancelingReq] = useState(false);
    const [isConfirmingReq, setIsConfirmingReq] = useState(false);
    const [isUnfriending, setIsUnfriending] = useState(false);

    const clickAddFriendBtn = async (e) => {
        const target = e.currentTarget;

        if (!$(target).hasClass('sent')) {
            setIsAddingFriend(true);
            try {
                await api.post('/friend/sendRequest/', {
                    profile: profileData._id,
                });
                $(target).children('span').text('Request Sent');
                $(target).addClass('sent');
            } catch (err) {
                console.log(err);
            } finally {
                setIsAddingFriend(false);
            }
        }
    };

    const clickFriendBtn = (e) => {
        const target = e.currentTarget;
        $(target).children('.friend-options-menu').toggleClass('hide');
    };

    const clickMessageBtn = () => {
        navigate(`/message/${profileData._id}`);
    };

    const handleCencleReq = async (e) => {
        const target = e.currentTarget;

        if (!$(target).hasClass('removed')) {
            setIsCancelingReq(true);
            try {
                await api.post('/friend/removeRequest', { profile: profileData._id });
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
                await api.post('/friend/reqAccept', { profile: profileData._id });
                $(target).children('span').text('Accepted');
                $(target).addClass('Friend Accepted');
            } catch (error) {
                console.log(error);
            } finally {
                setIsConfirmingReq(false);
            }
        }
    };

    const clickUnFrndBtn = async (e) => {
        const target = e.currentTarget;
        setIsUnfriending(true);
        try {
            await api.post('/friend/removeFriend', { profile: profileData._id });
            $(target).parents('.friend').hide();
        } catch (error) {
            console.log(error);
        } finally {
            setIsUnfriending(false);
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
                ) : isFriend ? (
                    <div className="profile-buttons">
                        <div onClick={clickFriendBtn} className="button normal-btn friend">
                            <i className="fas fa-user-check" />
                            <span>Friend</span>
                            <div className="friend-options-menu hide">
                                <div
                                    onClick={isUnfriending ? null : clickUnFrndBtn}
                                    className={`friend-options-menu-item ${isUnfriending ? 'disabled' : ''}`}
                                    style={{ opacity: isUnfriending ? 0.6 : 1, cursor: isUnfriending ? 'not-allowed' : 'pointer' }}
                                >
                                    <div className="menu-item-icon">
                                        <i className="fas fa-user-times" />
                                    </div>
                                    <div className="menu-item-text">
                                        {isUnfriending ? 'Removing...' : 'Remove Friend'}
                                    </div>
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
                            onClick={isAddingFriend ? null : clickAddFriendBtn}
                            className={`highligh-btn button add-friend ${isAddingFriend ? 'disabled' : ''}`}
                            style={{ opacity: isAddingFriend ? 0.6 : 1, cursor: isAddingFriend ? 'not-allowed' : 'pointer' }}
                        >
                            <i className="fas fa-user-check" />
                            <span>{isAddingFriend ? 'Adding...' : 'Add Friend'}</span>
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
                            className={`normal-btn button cencel-friend ${isCancelingReq ? 'disabled' : ''}`}
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
                            className={`highligh-btn button confirm-friend ${isConfirmingReq ? 'disabled' : ''}`}
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
        </Fragment>
    );
};

export default ProfileButtons;

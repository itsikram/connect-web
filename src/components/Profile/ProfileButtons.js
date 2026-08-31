import React, { Fragment, useState } from 'react';
import api from '../../api/api';
import { useSelector } from 'react-redux';
import { useNavigate } from 'react-router-dom';
import CreateStoryModal from '../story/CreateStoryModal';

const ProfileButtons = (props) => {
    const navigate = useNavigate();
    const myProfile = useSelector(state => state.profile);
    const profileData = props.profileData;
    const isAuth = props.isAuth;
    const initiallyFriend = props.isFriend;
    const initiallySent = Boolean(profileData.friendReqs && profileData.friendReqs.includes(myProfile._id));
    const initiallyReceived = Boolean(myProfile.friendReqs && myProfile.friendReqs.includes(profileData._id));

    const [friendStatus, setFriendStatus] = useState(() => {
        if (initiallyFriend) return 'friends';
        if (initiallyReceived) return 'pending-received';
        if (initiallySent) return 'pending-sent';
        return 'none';
    });
    const [isStoryModal, setIsStoryModal] = useState(false);
    const [isBusy, setIsBusy] = useState(false);

    const clickMessageBtn = () => {
        navigate(`/message/${profileData._id}`);
    };

    const handleAddFriend = async () => {
        if (isBusy) return;
        setIsBusy(true);
        try {
            await api.post('/friend/sendRequest/', { profile: profileData._id });
            setFriendStatus('pending-sent');
        } catch (err) {
            console.log(err);
        } finally {
            setIsBusy(false);
        }
    };

    const handleCancelRequest = async () => {
        if (isBusy) return;
        setIsBusy(true);
        try {
            await api.post('/friend/removeRequest', { profile: profileData._id });
            setFriendStatus('none');
        } catch (error) {
            console.log(error);
        } finally {
            setIsBusy(false);
        }
    };

    const handleAcceptRequest = async () => {
        if (isBusy) return;
        setIsBusy(true);
        try {
            await api.post('/friend/reqAccept', { profile: profileData._id });
            setFriendStatus('friends');
        } catch (error) {
            console.log(error);
        } finally {
            setIsBusy(false);
        }
    };

    const handleRemoveFriend = async (e) => {
        e?.stopPropagation?.();
        if (isBusy) return;
        setIsBusy(true);
        try {
            await api.post('/friend/removeFriend', { profile: profileData._id });
            setFriendStatus('none');
        } catch (error) {
            console.log(error);
        } finally {
            setIsBusy(false);
        }
    };

    const busyClass = isBusy ? 'is-disabled' : '';

    const getFriendActionButton = () => {
        switch (friendStatus) {
            case 'friends':
                return (
                    <div
                        className={`button remove-btn friend ${busyClass}`}
                        onClick={handleRemoveFriend}
                    >
                        <i className="fas fa-user-times" />
                        <span>{isBusy ? 'Removing...' : 'Remove Friend'}</span>
                    </div>
                );
            case 'pending-received':
                return (
                    <div
                        className={`button primary-btn confirm-friend ${busyClass}`}
                        onClick={handleAcceptRequest}
                    >
                        <i className="fas fa-check" />
                        <span>{isBusy ? 'Accepting...' : 'Accept Request'}</span>
                    </div>
                );
            case 'pending-sent':
                return (
                    <div
                        className={`button secondary-btn cencel-friend ${busyClass}`}
                        onClick={handleCancelRequest}
                    >
                        <i className="fas fa-user-clock" />
                        <span>{isBusy ? 'Canceling...' : 'Cancel Request'}</span>
                    </div>
                );
            default:
                return (
                    <div
                        className={`button primary-btn add-friend ${busyClass}`}
                        onClick={handleAddFriend}
                    >
                        <i className="fas fa-user-plus" />
                        <span>{isBusy ? 'Adding...' : 'Add Friend'}</span>
                    </div>
                );
        }
    };

    return (
        <Fragment>
            {isAuth ? (
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
                    <div onClick={() => navigate('/settings')} className="secondary-btn button edit-profile">
                        <i className="fas fa-pen" />
                        <span>Edit profile</span>
                    </div>
                </div>
            ) : (
                <div className="profile-buttons">
                    {getFriendActionButton()}
                    <div onClick={clickMessageBtn} className="secondary-btn button message-button">
                        <i className="fas fa-comment-dots" />
                        <span>Message</span>
                    </div>
                </div>
            )}
        </Fragment>
    );
};

export default ProfileButtons;

import React, { Fragment, useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import api from '../../api/api';
import { useSelector } from 'react-redux';
import config from '../../config/config.json';
import { PROFILE_IMG_REFERRER_POLICY, sanitizeProfileImageUrl } from '../../utils/profileImage';
import { ProfileFriendsSkeleton } from '../../skletons/profile/ProfilePageSkeleton';

const defaultPpSrc = config?.defaultProfile;

const friendDisplayName = (friend) =>
    friend?.fullName ||
    (friend?.user ? `${friend.user.firstName || ''} ${friend.user.surname || ''}`.trim() : friend?.username) ||
    'Unknown';

const ProfileFriends = () => {
    const myProfile = useSelector((state) => state.profile);
    const [friendsData, setFriendsData] = useState([]);
    const [friendsLoading, setFriendsLoading] = useState(true);
    const params = useParams();

    useEffect(() => {
        if (!params.profile) return;
        let active = true;
        setFriendsLoading(true);

        api.get('/friend/getFriends', {
            params: { profile: params.profile },
        })
            .then((res) => {
                if (!active) return;
                const arr = Array.isArray(res.data) ? res.data : [];
                if (arr.length) {
                    setFriendsData(arr);
                    return;
                }
                const isOwn = params.profile === myProfile._id || params.profile === myProfile.username;
                setFriendsData(isOwn && Array.isArray(myProfile.friends) ? myProfile.friends : []);
            })
            .catch(() => {
                if (!active) return;
                const isOwn = params.profile === myProfile._id || params.profile === myProfile.username;
                setFriendsData(isOwn && Array.isArray(myProfile.friends) ? myProfile.friends : []);
            })
            .finally(() => {
                if (active) setFriendsLoading(false);
            });

        return () => {
            active = false;
        };
    }, [params.profile, myProfile._id, myProfile.username]);

    return (
        <Fragment>
            <div id="profile-friends-content">
                {friendsLoading && (
                    <ProfileFriendsSkeleton count={4} />
                )}
                {!friendsLoading && friendsData.length === 0 && (
                    <div className="profile-placeholder-card">No friends found.</div>
                )}
                {!friendsLoading && friendsData.length > 0 && (
                    <div className="friend-items-container">
                        {friendsData.map((friend) => {
                            const name = friendDisplayName(friend);
                            const pic = sanitizeProfileImageUrl(
                                friend.profilePic || friend.user?.profilePic || defaultPpSrc,
                                120
                            );
                            return (
                                <Link
                                    key={friend._id || name}
                                    to={`/${friend._id}`}
                                    className="friend-item"
                                >
                                    <div className="friend-info">
                                        <div className="friend-profilePic">
                                            {pic ? (
                                                <img src={pic} alt={name} referrerPolicy={PROFILE_IMG_REFERRER_POLICY} />
                                            ) : (
                                                <div className="friend-avatar-placeholder" />
                                            )}
                                        </div>
                                        <div className="friend-details">
                                            <h4 className="friend-name text-capitalize">{name}</h4>
                                        </div>
                                    </div>
                                </Link>
                            );
                        })}
                    </div>
                )}
            </div>
        </Fragment>
    );
};

export default ProfileFriends;

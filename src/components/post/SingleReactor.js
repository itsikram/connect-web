import React, { useEffect, useMemo, useState } from 'react';
import api from '../../api/api';
import UserPP from '../UserPP';
import { Link } from 'react-router-dom';

import Rlike from "../../assets/images/reacts/reactLike.svg";
import Rlove from "../../assets/images/reacts/reactLove.svg";
import Rhaha from "../../assets/images/reacts/reactHaha.svg";

const reactLabelMap = {
    like: 'Like',
    love: 'Love',
    haha: 'Haha',
};

const SingleReactor = ({ viewer, reacts, reactType = '' }) => {

    let [profileData, setProfileData] = useState(false);

    const resolvedReactType = useMemo(() => {
        if (reactType) return reactType;

        const matchedReact = reacts.find((react) => {
            const reactProfileId = react?.profile?._id || react?.profile;
            return reactProfileId === viewer;
        });

        return matchedReact?.type || '';
    }, [reactType, reacts, viewer]);

    const reactImg = useMemo(() => {
        switch (resolvedReactType) {
            case 'like':
                return Rlike;
            case 'love':
                return Rlove;
            case 'haha':
                return Rhaha;
            default:
                return '';
        }
    }, [resolvedReactType]);

    useEffect(() => {
        let isMounted = true;

        const loadProfileData = async () => {
            let res = await api.get('profile', { params: { profileId: viewer } })
            if (isMounted && res.status === 200) {
                setProfileData(res.data)
            }
        }

        loadProfileData()

        return () => {
            isMounted = false;
        }
    }, [viewer])
    return (
        <div>
            {profileData && (
                <li className='sp-reacts-item'>
                    <div className='reactor-pp'>
                        <UserPP profilePic={profileData.profilePic} profile={profileData._id}></UserPP>
                    </div>
                    <div className='react-details'>
                        <Link to={`/${profileData._id}`}>
                            <span className='reactor-name'>{profileData.fullName}</span>
                        </Link>
                        {resolvedReactType ? <span className='reactor-react-label'>{reactLabelMap[resolvedReactType] || resolvedReactType}</span> : null}
                    </div>
                    <span className='reactor-react'>
                        {reactImg ? (
                            <img src={reactImg} alt={resolvedReactType || 'reacted'} />
                        ) : (
                            <span className='reactor-view-badge'>Viewed</span>
                        )}
                    </span>

                </li>
            )}


        </div>
    );
}

export default SingleReactor;

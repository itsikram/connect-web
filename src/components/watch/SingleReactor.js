import React, { useEffect, useState } from 'react';
import api from '../../api/api';
import UserPP from '../UserPP';
import { Link } from 'react-router-dom';
import { getReactIcon, getReactLabel } from '../../utils/reactTypes';

const SingleReactor = ({ reactor }) => {

    let [profileData, setProfileData] = useState(false);
    let [reactImg, setReactImg] = useState('')

    let loadProfileData = async () => {

        let res = await api.get('profile', { params: { profileId: reactor.profile } })
        if (res.status == 200) {
            setProfileData(res.data)
            setReactImg(getReactIcon(reactor.type))
        }

    }

    useEffect(() => {
        loadProfileData()
    }, [reactor.profile, reactor.type])
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
                    </div>
                    <span className='reactor-react'>

                        <img src={reactImg} alt={getReactLabel(reactor.type)} />
                    </span>

                </li>
            )}



        </div>
    );
}

export default SingleReactor;

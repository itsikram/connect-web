import React, { useEffect, useState } from 'react';
import api from '../../api/api';
import UserPP from '../UserPP';
import { Link } from 'react-router-dom';

const Rlike = 'https://programmerikram.com/wp-content/uploads/2025/03/like-icon.svg';
const Rlove = 'https://programmerikram.com/wp-content/uploads/2025/03/love-icon.svg';
const Rhaha = 'https://programmerikram.com/wp-content/uploads/2025/03/haha-icon.svg';


const SingleReactor = ({ viewer,reacts }) => {

    let [profileData, setProfileData] = useState(false);
    let [reactImg, setReactImg] = useState('')

    let loadProfileData = async (id) => {

        let res = await api.get('profile', { params: { profileId: viewer } })
        if (res.status == 200) {
            setProfileData(res.data)

            let isReacted = reacts.filter(react => react.profile == viewer)
            if(isReacted.length == 0) return;
            
            switch (isReacted[0].type) {
                case 'like':
                    setReactImg(Rlike)
                    break;
                case 'love':
                    setReactImg(Rlove)

                    break;
                case 'haha':
                    setReactImg(Rhaha)

                    break;
                default:
                    setReactImg(Rlike)
                    break;
            }


        }

    }

    useEffect(() => {
        loadProfileData()
    }, [])
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

                        { reactImg ? <img src={reactImg} /> : <><img style={{visibility: 'hidden'}} src={''} /></>}

                    </span>

                </li>
            )}


        </div>
    );
}

export default SingleReactor;

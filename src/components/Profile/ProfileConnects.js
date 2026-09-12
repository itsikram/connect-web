import React, { Fragment, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../api/api';
import { useSelector } from 'react-redux'
import PFI from './PFI';
import PfiSkleton from '../../skletons/profile/PfiSkleton';
const ProfileConnects = () => {

    let myProfile = useSelector(state => state.profile)
    let [connectsData, setConnectsData] = useState([])
    let [hasConnectsData, setHasConnectsData] = useState(true)
    let [isAuth, setIsAuth] = useState(false)

    let params = useParams()

    useEffect(() => {
        let isAuth = params.profile === myProfile._id ? true : false
        setIsAuth(isAuth)
        api.get('/connects/getConnects', {
            params: {
                profile: params.profile,
                _t: Date.now()
            }

        }).then(res => {
            setHasConnectsData(res.data.length > 0 ? true : false)
            const seen = new Set()
            setConnectsData((Array.isArray(res.data) ? res.data : []).filter((connect) => {
                if (!connect?._id || seen.has(connect._id)) return false
                seen.add(connect._id)
                return true
            }))
        }).catch(e => console.log(e))

    }, [params, myProfile])


    return (
        <Fragment>

            <div id='profile-connects-content'>
                <h4 className='section-title'>
                    Connects
                </h4>
                {
                    connectsData.length > 0 ?
                        <>
                            <div className='connect-items-container'>

                                {
                                    connectsData.map((connect, index) => {
                                        if (!isAuth) {
                                            return <PFI key={index} connect={connect}></PFI>

                                        } else if (connect._id !== myProfile._id) {
                                            return <PFI key={index} connect={connect}></PFI>

                                        }
                                    })
                                }
                            </div>
                        </>
                        :
                        <>
                            {
                                hasConnectsData && <div className='connect-items-container'>
                                    <PfiSkleton count={6} />
                                </div>
                            }

                        </>
                }


            </div>

        </Fragment>
    )
}

export default ProfileConnects;

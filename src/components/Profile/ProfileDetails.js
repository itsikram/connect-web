import React, { Fragment, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import Moment from "react-moment";
import { useParams } from "react-router-dom";
import { fetchProfileCached } from "../../utils/requestCache";

let ProfileDetails = (props) => {
    let mySettings = useSelector(state => state.setting)
    let myProfile = useSelector(state => state.profile)
    let [settings, setSettings] = useState(false)
    let [friendProfile, setFriendProfile] = useState(false)
    let [workPlaces, setWorkPlaces] = useState([])
    let [schools, setSchools] = useState([])
    let [presentAddress, setPresentAddress] = useState('')
    let [permanentAddress, setPermanentAddress] = useState('')
    let params = useParams(); 
    let friendId = params.profile


    useEffect(() => {
        if (friendProfile?.presentAddress) {
            setPresentAddress(friendProfile.presentAddress)
        }
        if (friendProfile?.permanentAddress) {
            setPermanentAddress(friendProfile.permanentAddress)
        }
        if (friendProfile?.schools) {
            setSchools(friendProfile.schools)
        }
        if (friendProfile?.workPlaces) {
            setWorkPlaces(friendProfile.workPlaces)
        }
    }, [friendProfile])


    useEffect(() => {
        if (!friendId) return;

        fetchProfileCached(friendId, { ttlMs: 60000, storageTtlMs: 300000 })
            .then((profileResponse) => {
                setFriendProfile(profileResponse)
            }).catch(e => console.log(e))

    }, [friendId])





    return (
        <Fragment>
            <div id="profile-details-list" className="details-list">

                {
                    workPlaces.map((workplace, index) => {

                        return <div key={index} className="details-list-item">
                            <i className="fas fa-briefcase"></i>
                            <span>
                                {workplace?.designation} at <b>{workplace?.name}</b>
                            </span>
                        </div>
                    })
                }

                {
                    schools.map((school, index) => {

                        return (
                            <div className="details-list-item" key={index}>
                                <i className="fas fa-graduation-cap"></i>
                                <span>
                                    Studied at <b>{school?.name} ({school?.degree})</b>
                                </span>
                            </div>
                        )
                    })
                }



                {
                    presentAddress ? (
                        <div className="details-list-item">
                            <i className="fas fa-home"></i>
                            <span>
                                Lives in <b>{presentAddress}</b>
                            </span>
                        </div>) : <></>
                }
                {
                    permanentAddress ? (
                        <div className="details-list-item">
                            <i className="fas fa-globe"></i>
                            <span>
                                From <b>{permanentAddress}</b>
                            </span>
                        </div>) : <></>
                }

                <div className="details-list-item">
                    <i className="fas fa-clock"></i>
                    <span>
                        Joined  <b><Moment format="MMMM YYYY">{friendProfile?.user?.createdAt}</Moment></b>
                    </span>
                </div>

            </div>
        </Fragment>
    )
}


export default ProfileDetails;
import React, { Fragment, useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import Moment from "react-moment";
import { useParams } from "react-router-dom";
import api from "../../api/api";
import { setLoading } from "../../services/actions/optionAction";

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
    let dispatch= useDispatch
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


        // api.get('setting/',{
        //     params: {
        //         profileId: friendId
        //     }
        // }).then(res => {
        //     setSettings(res.data)
        // })
    }, [friendProfile])


    useEffect(() => {

        api.get('/profile', {
            params: {
                profileId: friendId
            }
        }).then((res) => {
            setFriendProfile(res.data)

        }).catch(e => console.log(e))

    }, [props])
    
    useEffect(() => {

        api.get('/profile', {
            params: {
                profileId: friendId
            }
        }).then((res) => {
            setFriendProfile(res.data)

        }).catch(e => console.log(e))

    }, [])





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
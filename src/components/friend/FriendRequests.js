import React, { Fragment, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import FGI from "./FGI";
import api from "../../api/api";
import FgiSkleton from "../../skletons/friend/FgiSkleton";

let FriendRequests = () => {

    let [reqData, setReqData] = useState([])
    let [hasFriends, setHasFriends] = useState(true)

    useEffect(() => {
        api.get('/friend/getRequest/').then((res) => {
            setReqData(res.data)
            setHasFriends(res.data.length > 0 ? true : false)
        }).catch(e => {
            console.log(e)
        })
    }, [])

    return (
        <Fragment>
            <div id="friends-container" >
                <div className="heading">
                    <h4 className="heading-title">Friend Requests</h4>
                    <Link to="/friends/requests" className="view-more-btn">See All</Link>
                </div>

                {
                    reqData.length > 0 ?
                        <>
                            <div className="friend-grid-container">

                                {

                                    reqData.map((req, index) => {
                                        return <FGI key={index} id={req._id} profilePic={req.profilePic} fullName={req.user.firstName + ' ' + req.user.surname} type="req"></FGI>
                                    })

                                }

                                {
                                    reqData.length === 0 && <h4 className="data-not-found text-center">You don't have any Friend Request to show</h4>
                                }



                            </div>
                        </>
                        :
                        <>
                            <div className="friend-grid-container">

                                {hasFriends ? <FgiSkleton count={4} /> : <h4 className="data-not-found text-center">You don't have any Friend Request to show</h4>}
                            </div>
                        </>
                }

            </div>
        </Fragment>
    )
}



export default FriendRequests;
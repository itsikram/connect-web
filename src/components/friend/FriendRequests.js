import React, { Fragment, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import FGI from "./FGI";
import api from "../../api/api";
import FgiSkleton from "../../skletons/friend/FgiSkleton";

let FriendRequests = () => {
    const location = useLocation();
    const isRequestsPage = location.pathname.includes("/friends/requests");

    let [reqData, setReqData] = useState([])
    let [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        setIsLoading(true)
        api.get('/friend/getRequest/').then((res) => {
            setReqData(Array.isArray(res.data) ? res.data : [])
        }).catch(e => {
            console.log(e)
            setReqData([])
        }).finally(() => {
            setIsLoading(false)
        })
    }, [])

    return (
        <Fragment>
            <div id="friends-container">
                <div className="heading">
                    <h4 className="heading-title">Friend Requests</h4>
                    {!isRequestsPage && (
                        <Link to="/friends/requests" className="view-more-btn">See All</Link>
                    )}
                </div>

                <div className="friend-grid-container">
                    {isLoading ? (
                        <FgiSkleton count={4} />
                    ) : reqData.length > 0 ? (
                        reqData.map((req) => (
                            <FGI
                                key={req._id}
                                id={req._id}
                                profilePic={req.profilePic}
                                fullName={`${req.user?.firstName || ""} ${req.user?.surname || ""}`.trim() || "User"}
                                type="req"
                            />
                        ))
                    ) : (
                        <h4 className="data-not-found text-center">
                            You don&apos;t have any friend requests right now
                        </h4>
                    )}
                </div>
            </div>
        </Fragment>
    )
}



export default FriendRequests;
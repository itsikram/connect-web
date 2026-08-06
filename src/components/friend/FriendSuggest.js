import React, { Fragment, useEffect, useState } from "react";
import FGI from "./FGI";
import { useSelector } from "react-redux";
import api from "../../api/api";
import FgiSkleton from "../../skletons/friend/FgiSkleton";


let FriendsSuggest = () => {
    let myProfile = useSelector(state => state.profile)

    let [friends, setFriends] = useState([])
    let [isLoading, setIsLoading] = useState(true)

    useEffect(() => {
        if (!myProfile?._id) return;

        setIsLoading(true)
        api.get('/friend/getSuggetions/', {
            params: {
                profile: myProfile._id
            }
        }).then(res => {
            if (res.status === 200) {
                setFriends(Array.isArray(res.data) ? res.data : [])
            }
        }).catch(e => {
            console.log(e)
            setFriends([])
        }).finally(() => {
            setIsLoading(false)
        })
    }, [myProfile?._id])

    return (
        <Fragment>
            <div id="friends-container" className="mb-5">
                <div className="heading">
                    <h4 className="heading-title">People You May Know</h4>
                </div>

                <div className="friend-grid-container">
                    {isLoading ? (
                        <FgiSkleton count={4} />
                    ) : friends.length > 0 ? (
                        friends.map((friend) => {
                            if (!friend.user) return null;

                            const fullName = `${friend.user.firstName || ""} ${friend.user.surname || ""}`.trim() || "User";
                            const isIncomingReq = myProfile.friendReqs?.includes(friend._id);

                            return (
                                <FGI
                                    key={friend._id}
                                    profileReqs={friend.friendReqs}
                                    type={isIncomingReq ? "req" : "sug"}
                                    id={friend._id}
                                    profilePic={friend.profilePic}
                                    fullName={fullName}
                                />
                            );
                        })
                    ) : (
                        <h4 className="data-not-found text-center">
                            No suggestions available right now
                        </h4>
                    )}
                </div>
            </div>
        </Fragment>
    )
}

export default FriendsSuggest;
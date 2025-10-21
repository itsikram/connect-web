import React, { Fragment, useEffect, useState } from "react";
import FGI from "./FGI";
// import { Link } from "react-router-dom";
import { useSelector } from "react-redux";
import api from "../../api/api";
import FgiSkleton from "../../skletons/friend/FgiSkleton";


let FriendsSuggest = () => {
    let myProfile = useSelector(state => state.profile)

    let [friends, setFriends] = useState([])
    let [hasFriends, setHasFriends] = useState(true)
    useEffect(() => {

        api.get('/friend/getSuggetions/', {
            params: {
                profile: myProfile._id
            }
        }).then(res => {
            if (res.status === 200) {
                setHasFriends(res.data.length == 0 ? false : true)
                setFriends(res.data)
            }

        }).catch(e => {
            console.log(e)
        })
    }, [myProfile._id])


    useEffect(() => { }, [])

    return (
        <Fragment>
            <div id="friends-container" className="mb-5" >
                <div className="heading">
                    <h4 className="heading-title">People You May Know</h4>
                </div>
                {
                    friends.length > 0 ?

                        <>
                            <div className="friend-grid-container">
                                {

                                    friends.map((friend, index) => {

                                        if(!friend.user) {
                                            return <></>
                                        }

                                        if (myProfile.friendReqs && myProfile.friendReqs.includes(friend._id)) {
                                            return <FGI key={index} profileReqs={friend.friendReqs} type="req" id={friend._id} profilePic={friend.profilePic} fullName={friend.user.firstName + ' ' + friend.user.surname}></FGI>
                                        }
                                        return <FGI key={index} profileReqs={friend.friendReqs} type="sug" id={friend._id} profilePic={friend.profilePic} fullName={friend.user.firstName + ' ' + friend.user.surname}></FGI>
                                    })


                                }

                                {
                                    friends.length === 0 && <h4 className="data-not-found text-center">You don't have any Friends to Suggest</h4>
                                }

                            </div>
                        </>
                        :
                        <>
                            <div className="friend-grid-container">

                                {
                                    hasFriends ? (
                                        <FgiSkleton count={4} />
                                    )

                                    : <h4 className="data-not-found text-center">You don't have any Friends to Suggest</h4>

                            }

                            </div>
                        </>
                }

            </div>
        </Fragment>
    )
}

export default FriendsSuggest;
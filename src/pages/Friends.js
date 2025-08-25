import React,{Fragment, useEffect} from "react";
import { NavLink,Outlet } from "react-router-dom";
import api from "../api/api";
import { useSelector } from "react-redux";

let Friends = () => {

    let profile = useSelector(state => state.profile)



    return (
        <Fragment>
            <div id="friends">
                <div className="friends-sidebar">
                    <h4 className="page-title">Friends</h4>
                    <div className="friends-sidebar-menu">
                        <NavLink to="/friends/" className="friends-sidebar-menu-item">
                           <span className="icon">
                                <i className="fas fa-user-friends"></i>
                           </span>
                           <span className="text">Home</span>
                        </NavLink>
                        <NavLink to="/friends/requests" className="friends-sidebar-menu-item">
                           <span className="icon">
                                <i className="fas fa-user-edit"></i>
                           </span>
                           <span className="text">Friend Requests</span>
                        </NavLink>
                        <NavLink to="/friends/suggestions" className="friends-sidebar-menu-item">
                           <span className="icon">
                                <i className="fas fa-user-plus"></i>
                           </span>
                           <span className="text">Suggestions</span>
                        </NavLink>
                        <NavLink to={`/${profile?profile._id:''}/friends`} className="friends-sidebar-menu-item">
                           <span className="icon">
                                <i className="fas fa-users"></i>
                           </span>
                           <span className="text">All Freinds</span>
                        </NavLink>
                    </div>
                </div>
                <div className="friends-content">
                    <Outlet/>
                </div>
            </div>
        </Fragment>
    )
}


export default Friends;
import React, { useCallback, useEffect , useState} from 'react';
import { Link, Outlet } from 'react-router-dom';
import $ from 'jquery'

import api from '../api/api';
const Settings = () => {

    useEffect(() => {

    },[])
    let handleClick = useCallback(async(e) => {
        $(e.currentTarget).addClass('active')
        $(e.currentTarget).siblings().removeClass('active')
    },[])

    return (
        <div className='setting-page'>
            <div className='container py-3'>
                <div className='row bb'>
                    <div className='col'>
                        <h1 className='primary-color mb-3 py-0'> Settings Page</h1>

                    </div>
                </div>
                <div className='row py-3'>
                    <div className='col-md-3 br'>
                        <div className='setting-groups-container'>
                            <ul className='setting-groups'>
                                <li onClick={handleClick.bind(this)} className='setting-groups-item active'>
                                    <Link to="/settings">
                                        <span>
                                            Profile
                                        </span>
                                        <span>
                                            <i className='fa fa-chevron-right'></i>
                                        </span>
                                    </Link>
                                </li>
                                <li onClick={handleClick.bind(this)} className='setting-groups-item'>
                                    <Link to="privacy">

                                        <span>
                                            Privacy
                                        </span>
                                        <span>
                                            <i className='fa fa-chevron-right'></i>
                                        </span>
                                    </Link>
                                </li>
                                <li onClick={handleClick.bind(this)} className='setting-groups-item'>
                                    <Link to="notification">

                                        <span>
                                            Notification
                                        </span>
                                        <span>
                                            <i className='fa fa-chevron-right'></i>
                                        </span>
                                    </Link>
                                </li>
                                <li onClick={handleClick.bind(this)} className='setting-groups-item'>
                                    <Link to="account">

                                        <span>
                                            Account
                                        </span>
                                        <span>
                                            <i className='fa fa-chevron-right'></i>
                                        </span>
                                    </Link>
                                </li>
                                <li onClick={handleClick.bind(this)} className='setting-groups-item'>
                                    <Link to="preference">
                                        <span>
                                            Preference
                                        </span>
                                        <span>
                                            <i className='fa fa-chevron-right'></i>
                                        </span>
                                    </Link>
                                </li>
                                <li onClick={handleClick.bind(this)} className='setting-groups-item'>
                                    <Link to="message">
                                        <span>
                                            Messaging
                                        </span>
                                        <span>
                                            <i className='fa fa-chevron-right'></i>
                                        </span>
                                    </Link>
                                </li>
                                <li onClick={handleClick.bind(this)} className='setting-groups-item'>
                                    <Link to="sound">
                                        <span>
                                            Sounds
                                        </span>
                                        <span>
                                            <i className='fa fa-chevron-right'></i>
                                        </span>
                                    </Link>
                                </li>
                            </ul>
                        </div>
                    </div>
                    <div className='col-md-6'>

                        <Outlet />


                    </div>
                </div>
            </div>
        </div>
    );
}

export default Settings;

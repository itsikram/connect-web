import React, { Fragment, useEffect } from "react";
import { Link, Outlet, NavLink, useLocation } from 'react-router-dom';
import $ from 'jquery';

let HeaderNav = () => {
    let location = useLocation();
    // add active class on click
    let addActiveClass = (e) => {
        let target = e.currentTarget
        $(target).siblings().removeClass('active')
        $(target).addClass('active')
        $('.header-nav-menu-item').children().children().removeClass('primary-color fas')
        $('.header-nav-menu-item').children().children().addClass('fal')
        $(e.currentTarget).children().children().addClass('primary-color fas')
        $(e.currentTarget).children().children().removeClass('fal')
    }

    useEffect(() => {

        $('.header-nav-menu-item.active').siblings().removeClass('active')
        $('.header-nav-menu-item.active').siblings().find('i').removeClass('primary-color')
        $('.header-nav-menu-item.active').siblings().find('i').removeClass('fas')
        $('.header-nav-menu-item.active').siblings().find('i').addClass('fal')

    }, [location])

    return (
        <Fragment>
            <div className="header-nav-menu-container">
                <ul className="header-nav-menu">
                    <NavLink to="/" exact="true" onClick={addActiveClass} className="header-nav-menu-item" title="Home">

                        <div className="header-nav-menu-icon">
                            <i className="fal fa-home-alt "></i>
                        </div>


                    </NavLink>
                    <NavLink to="/friends" onClick={addActiveClass} className="header-nav-menu-item" title="Friends">
                        <div className="header-nav-menu-icon">
                            <i className="fal fa-user-friends "></i>
                        </div>
                    </NavLink>
                    <NavLink to="/watch" onClick={addActiveClass} className="header-nav-menu-item" title="Videos">
                        <div className="header-nav-menu-icon">
                            <i className="fal fa-play-circle"></i>

                        </div>
                    </NavLink>

                    <NavLink to="/message" onClick={addActiveClass} className="header-nav-menu-item" title="Marketplace">
                        <div className="header-nav-menu-icon">
                            <i className="fal fa-envelope"></i>

                        </div>
                    </NavLink>
                    {/* <NavLink to="/story" onClick={addActiveClass} className="header-nav-menu-item" title="Story">
                        <div className="header-nav-menu-icon">
                            <i className="fal fa-images"></i>

                        </div>
                    </NavLink> */}
                    <NavLink to="/downloads" onClick={addActiveClass} className="header-nav-menu-item" title="Story">
                        <div className="header-nav-menu-icon">
                            <i className="fas fa-download"></i>

                        </div>
                    </NavLink>

                </ul>
            </div>
        </Fragment>
    )
}

export default HeaderNav
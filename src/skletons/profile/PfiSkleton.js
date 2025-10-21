import React, { Fragment, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ImageSkleton from '../ImageSkleton';
const PfiSkleton = ({ count = 1 }) => {


    return Array(count).fill(0).map((_, index) => (

        <div key={index} className='friend-item skeleton-card'>

            <div className='friend-info'>
                <Link to={'/'}>
                    <div className='friend-profilePic'>
                        <>
                            <ImageSkleton />
                        </>
                        {/* <div className="skeleton-avatar" /> */}

                    </div>
                    <div className='friend-details'>
                        <div className="skeleton-lines">
                            <div className="skeleton-line short" />
                            <div className="skeleton-line medium" />
                        </div>
                    </div>
                </Link>
            </div>
            <div className='friend-options'>
                <i className='far fa-ellipsis-h'></i>

                {/* <div className='friend-options-menu'>
                        {
                            isFriend ?
                                <div onClick={clickRemoveFrndOption} className='friend-options-menu-item'>
                                    <div className='menu-item-icon'>
                                        <i className="fas fa-user-times"></i>
                                    </div>
                                    <div className='menu-item-text'>Remove Friend</div>
                                </div>

                                :
                                <div onClick={clickAddFrndOption} className='friend-options-menu-item'>
                                    <div className='menu-item-icon'>
                                        <i className="fas fa-user-plus"></i>
                                    </div>
                                    <div className='menu-item-text'>Add Friend</div>
                                </div>
                        }

                    </div> */}

            </div>
        </div>
    ));
}

export default PfiSkleton;

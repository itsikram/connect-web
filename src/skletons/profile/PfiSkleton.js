import React, { Fragment, useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import ImageSkleton from '../ImageSkleton';
const PfiSkleton = ({ count = 1 }) => {


    return Array(count).fill(0).map((_, index) => (

        <div key={index} className='connect-item skeleton-card'>

            <div className='connect-info'>
                <Link to={'/'}>
                    <div className='connect-profilePic'>
                        <>
                            <ImageSkleton />
                        </>
                        {/* <div className="skeleton-avatar" /> */}

                    </div>
                    <div className='connect-details'>
                        <div className="skeleton-lines">
                            <div className="skeleton-line short" />
                            <div className="skeleton-line medium" />
                        </div>
                    </div>
                </Link>
            </div>
            <div className='connect-options'>
                <i className='far fa-ellipsis-h'></i>

                {/* <div className='connect-options-menu'>
                        {
                            isConnect ?
                                <div onClick={clickRemoveFrndOption} className='connect-options-menu-item'>
                                    <div className='menu-item-icon'>
                                        <i className="fas fa-user-times"></i>
                                    </div>
                                    <div className='menu-item-text'>Remove Connect</div>
                                </div>

                                :
                                <div onClick={clickAddFrndOption} className='connect-options-menu-item'>
                                    <div className='menu-item-icon'>
                                        <i className="fas fa-user-plus"></i>
                                    </div>
                                    <div className='menu-item-text'>Add Connect</div>
                                </div>
                        }

                    </div> */}

            </div>
        </div>
    ));
}

export default PfiSkleton;

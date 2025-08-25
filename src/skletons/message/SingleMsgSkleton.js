import React,{Fragment} from 'react';
import UserPP from '../../components/UserPP';

const SingleMsgSkleton = ({ count = 1 }) => {
    return Array(count).fill(0).map((_, index) => (

        <Fragment key={index}>
            <div  className={`chat-message-container message-receive skeleton-card border-0 p-1 my-2 w-75 sm-skleton px-3`} data-toggle="tooltip">
                <div className='chat-message-profilePic'>
                    <div className="skeleton-avatar" />

                </div>

                <div className="skeleton-lines">
                    <div className="skeleton-line large mb-0" />
                </div>

            </div>
            <div  className={`chat-message-container message-sent skeleton-card border-0 p-1 my-2 w-75 sm-skleton px-3`} data-toggle="tooltip">


                <div className="skeleton-lines">
                    <div className="skeleton-line large mb-0 ml-auto" />
                </div>
                <div className='chat-message-profilePic'>
                    <div className="skeleton-avatar" />
                </div>

            </div>
            {/* <li key={index} className='message-list-item'>
                <div className="skeleton-card mb-0 p-1 border-0">
                    <div className="skeleton-header mb-0">
                        <div className="skeleton-avatar" />
                        <div className="skeleton-lines">
                            <div className="skeleton-line short" />
                            <div className="skeleton-line medium" />
                        </div>
                    </div>

                </div>
            </li> */}
        </Fragment>


    ));
};

export default SingleMsgSkleton;
// export default CpSkleton;

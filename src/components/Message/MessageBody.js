import React, { Fragment } from 'react';
import { useParams } from 'react-router-dom';
import Chat from '../../pages/Chat';


const MessageBody = (props) => {

    const {profile} = useParams();
    return (
        <Fragment>
            {!profile ? (
                <div className='message-empty-state'>
                    <div className='message-empty-icon' aria-hidden='true'>
                        <i className='fas fa-comments'></i>
                    </div>
                    <h2>Your messages</h2>
                    <p>Pick a conversation to start chatting with your connects.</p>
                </div>
            ) : <Chat cameraVideoRef={props.cameraVideoRef}> </Chat>}
        </Fragment>

    );
}

export default MessageBody;

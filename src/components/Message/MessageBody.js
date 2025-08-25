import React, { useEffect, useState, Fragment } from 'react';
import { useParams } from 'react-router-dom';
import Chat from '../../pages/Chat';
import socket from '../../common/socket';


// const socket = io.connect(process.env.REACT_APP_SERVER_ADDR)


const MessageBody = (props) => {

    let {profile} = useParams();
    useEffect(() => {

    },[])
    return (
        <Fragment>
            {!profile? <h2 className='text-center mt-3'>Select an user to start conversation</h2> : <Chat socket={socket} cameraVideoRef={props.cameraVideoRef}> </Chat>}
            
        </Fragment>

    );
}

export default MessageBody;

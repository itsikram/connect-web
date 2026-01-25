import React, { useEffect, Fragment } from 'react';
import { useParams } from 'react-router-dom';
import Chat from '../../pages/Chat';


const MessageBody = (props) => {

    const {profile} = useParams();
    useEffect(() => {

    },[])
    return (
        <Fragment>
            {!profile? <h2 className='text-center mt-3'>Select an user to start conversation</h2> : <Chat cameraVideoRef={props.cameraVideoRef}> </Chat>}
            
        </Fragment>

    );
}

export default MessageBody;

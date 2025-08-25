import React, { useEffect, useRef, useState } from 'react';
import { io } from 'socket.io-client';
import Peer from 'simple-peer';
import { useSelector } from 'react-redux';

import socket from '../common/socket';
function App() {

    const myProfile = useSelector(state => state.profile)
    const [stream, setStream] = useState();
    const [me, setMe] = useState();
    const [receivingCall, setReceivingCall] = useState(false);
    const [caller, setCaller] = useState('');
    const [callerSignal, setCallerSignal] = useState();
    const [callAccepted, setCallAccepted] = useState(false);
    const [isVideoCalling,setIsVideoCalling] = useState(false)
    const myVideo = useRef();
    const userVideo = useRef();
    const connectionRef = useRef();

    useEffect(() => {
        navigator.mediaDevices.getUserMedia({ video: true, audio: true }).then((stream) => {
            setStream(stream);
            myVideo.current.srcObject = stream;
        });

        socket.on('receive-call', (data) => {
            setReceivingCall(true);
            setCaller(data.from);
            setCallerSignal(data.signal);
        });
    }, []);

    useEffect(() => {
        setMe(myProfile._id)
    }, [myProfile])

    const callUser = (id) => {
        const peer = new Peer({
            initiator: true,
            trickle: false,
            stream: stream,
        });

        peer.on('signal', (data) => {
            socket.emit('call-user', {
                userToCall: id,
                signalData: data,
                from: me,
                name: 'User',
            });
        });

        peer.on('stream', (currentStream) => {
            userVideo.current.srcObject = currentStream;
        });

        socket.on('call-accepted', (signal) => {
            setCallAccepted(true);
            peer.signal(signal);
        });

        connectionRef.current = peer;
    };

    const answerCall = () => {
        setCallAccepted(true);
        const peer = new Peer({
            initiator: false,
            trickle: false,
            stream: stream,
        });

        peer.on('signal', (data) => {
            socket.emit('answer-call', { signal: data, to: caller });
        });

        peer.on('stream', (currentStream) => {
            userVideo.current.srcObject = currentStream;
        });

        peer.signal(callerSignal);
        connectionRef.current = peer;
    };

    return (
        <div style={{ padding: 20 }}>
            <h2>Video Call App</h2>
            <p>{me}</p>
            <div>
                <video playsInline muted ref={myVideo} autoPlay style={{ width: '300px' }} />
                {callAccepted && <video playsInline ref={userVideo} autoPlay style={{ width: '300px' }} />}
            </div>
            <div>
                <input
                    placeholder="ID to call"
                    value={caller}
                    onChange={(e)=> {setCaller(e.target.value)}}
                />
                <button onClick={() => callUser(caller)}>Call</button>
            </div>
            {receivingCall && !callAccepted && (
                <div>
                    <h3>Incoming Call...</h3>
                    <button onClick={answerCall}>Answer</button>
                </div>
            )}
        </div>
    );
}

export default App;

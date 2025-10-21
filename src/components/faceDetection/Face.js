import React, { useRef, useState, useEffect } from 'react';
import Webcam from 'react-webcam';
import socket from '../../common/socket';
const Face = () => {

    const webcamRef = useRef(null);
    const [emotion, setEmotion] = useState('');
// (${(data.confidence * 100).toFixed(1)}%)
    useEffect(() => {
        socket.on('face_emotion', (data) => {
            setEmotion(`${data.emotion}`);
        });

        const interval = setInterval(() => {
            if (webcamRef.current) {
                const imageSrc = webcamRef.current.getScreenshot();
                if (imageSrc) {
                    socket.emit('webcam_frame', imageSrc);
                }
            }
        }, 1500); // send frame every 500ms

        return () => clearInterval(interval);
    }, []);
    return (
        <div style={{ textAlign: 'center' }}>
            {/* <h1>Real-time Emotion Detector</h1> */}
            <Webcam
                ref={webcamRef}
                screenshotFormat="image/jpeg"
                className='emotion-video'
                videoConstraints={{ facingMode: 'user' }}
            />
            {/* <h2>Detected Emotion: {emotion}</h2> */}
        </div>
    );
}

export default Face;

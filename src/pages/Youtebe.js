import React, { useEffect } from 'react';

const Youtebe = () => {
    useEffect(() => {
        // Redirect to YouTube since iframe embedding is blocked
        window.location.href = 'https://m.youtube.com';
    }, []);

    return (
        <div style={{ 
            position: 'fixed', 
            inset: 0, 
            width: '100vw', 
            height: '100vh', 
            margin: 0, 
            padding: 0, 
            backgroundColor: '#000',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: '#fff'
        }}>
            <div>Redirecting to YouTube...</div>
        </div>
    );
}

export default Youtebe;


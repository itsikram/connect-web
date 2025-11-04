import React from 'react';



const Youtebe = () => {
    return (
        <div style={{ position: 'fixed', inset: 0, width: '100vw', height: '100vh', margin: 0, padding: 0, backgroundColor: '#000' }}>
            <iframe 
                title="YouTube"
                src='https://www.youtube.com'
                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                allowFullScreen
                style={{ width: '100%', height: '100%', border: 0, display: 'block' }}
            ></iframe>
        </div>
    );
}

export default Youtebe;


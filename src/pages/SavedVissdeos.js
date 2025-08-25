import React, { useEffect, useState } from 'react';
import { getAllSavedVideos } from '../utils/useSavedVideos';
import SingleVideo from '../components/downloads/SingleVideo';


const SavedVideoss = () => {

    let [videos, setVideos] = useState([])

    useEffect(() => {

        getAllSavedVideos((data) => {
            setVideos(data)
        })

    }, [])
    return (
        <>

        <div className='saved-videos-container'>

            {videos && videos.map((video, index) => {

                return (<SingleVideo videoData={video} key={index} />)
            })}

        </div>
            
        </>
    );
}

export default SavedVideoss;

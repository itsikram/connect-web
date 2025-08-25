import React, { useEffect, useState } from 'react';
import { getAllSavedVideos } from '../utils/useSavedVideos';
import SingleVideo from '../components/downloads/SingleVideo';
import VideoCard from '../components/downloads/VideoCard';


const SavedVideos = () => {
    let [videos, setVideos] = useState([])

    useEffect(() => {

        getAllSavedVideos((data) => {
            console.log(data)
            setVideos(data)
        })

    }, [])
    return (
        <>
            <div className='download-page container'>

                <h1>Saved Videos</h1>


                <div className='saved-videos-container'>

                    <div className='row'>

                        {videos && videos.map((video, index) => {

                            return (<VideoCard videoData={video.metadata} videoUrl={video.videoURL} key={index} />)
                        })}

                    </div>



                </div>

            </div>



        </>
    );
}



export default SavedVideos;

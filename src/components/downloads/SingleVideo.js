import React, { useState, useEffect } from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteVideoById, loadVideoById } from '../../utils/useSavedVideos';

const SingleVideo = () => {

    let { videoId } = useParams()
    let [videoData, setVideoData] = useState({})
    let [videoUrl, setVideoUrl] = useState('')

    let navigate = useNavigate();


    useEffect(() => {

        if (videoId) {

            loadVideoById(videoId, (videoURL, videoData) => {
                setVideoData(videoData)
                setVideoUrl(videoURL)

            })

        }



    }, [videoId])

    let deleteVideo = () => {
        deleteVideoById(videoId)
        navigate('/downloads')

    }



    return (
        <div className='single-saved-video-page'>
            <div className='container py-3'>
                <div className='row'>
                    <div className='col-md-6 offset-md-3'>
                        <div className='saved-video-card card bg-dark text-white'>

                            {videoUrl && <video className="card-img-top" controls src={videoUrl} style={{ width: '100%' }} />}
                            <div className="card-body">
                                <h5 className="card-title fs-4 text-capitalize">{videoData.caption}</h5>
                                <button onClick={deleteVideo} className='btn btn-danger'>Delete</button>
                            </div>

                        </div>

                    </div>
                </div>
            </div>
        </div>


    );
}

export default SingleVideo;

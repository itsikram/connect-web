
import React from 'react';
import { Link, useNavigate, useParams } from 'react-router-dom';
import { deleteVideoById } from '../../utils/useSavedVideos';

const VideoCard = ({ videoData, videoUrl }) => {


    let navigate = useNavigate();
    

    let gotoSingleVideo = () => {
        if(!videoData) return;
        navigate(`/downloads/${videoData._id}`)
    }
    let deletVideo = (e) => {
        if(!videoData) return;
        deleteVideoById(videoData._id)
        window.location.reload()
    }
    if(!videoData) return;
    return (
        <div className='col-md-4'>
            
            <div className='saved-video-card card bg-dark text-white' onClick={gotoSingleVideo}>

                <video className="card-img-top" src={videoUrl} style={{width: '100%'}} />
                <div className="card-body">
                    <h5 className="card-title fs-4 text-capitalize mt-0">{videoData.caption}</h5>
                    <Link  className='btn btn-primary d-inline-block' style={{marginRight: '5px'}} to={`/downloads/${videoData._id}`}>View</Link>
                    <button className='btn btn-danger' onClick={deletVideo}>Delete</button>
                </div>

            </div>

        </div>

    );
}

export default VideoCard;


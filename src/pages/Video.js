import React, { Fragment, useState, useEffect, useCallback } from "react";
import Watch from "../components/watch/Watch";
import CreateWatch from "../components/watch/CreateWatch";
import api from "../api/api";
import { useSelector } from "react-redux";
import WatchSkeleton from "../skletons/watch/WatchSkeleton";
import Ls from "../partials/sidebar/Ls";
import Rs from "../partials/sidebar/Rs";
import useIsMobile from "../utils/useIsMobile";
const Video = () => {
    let myProfile = useSelector(state => state.profile)
    let myId = myProfile._id;
    let isMobile = useIsMobile();
    const [watches, setWatches] = useState([])
    let loadData = async () => {
        let response = await api.get('watch/related', { params: { profile_id: myId } })
        if (response.status === 200) {
            setWatches(response.data)
        }
    }
    useEffect(() => {
        loadData()
    }, [])

    const handleWatchUpdate = useCallback((watchId, updates) => {
        setWatches(prev => prev.map(item =>
            item._id === watchId ? { ...item, ...updates } : item
        ))
    }, [])

    return (
        <Fragment>
            <div className="container mb-3" style={ isMobile ? { maxWidth: '100%', width: '100%' } : { maxWidth: '90%', width: '90%' } }>
                <div className="row">
                    <div className="col-md-3">
                        { !isMobile && <Ls />}
                    </div>
                    <div className="col-md-6">
                        <CreateWatch setWatches={setWatches} />
                        {
                            watches.length > 0 ? watches.map((video, i) => (
                                <Watch
                                    key={video._id || i}
                                    watch={video}
                                    type="watch"
                                    onDelete={(deletedId) => setWatches(prev => prev.filter(item => item._id !== deletedId))}
                                    onUpdate={handleWatchUpdate}
                                />
                            ))
                                :
                                <>
                                    <WatchSkeleton count={3} />
                                </>
                        }
                    </div>
                    <div className="col-md-3">
                    
                    {!isMobile && <Rs />}

                    </div>
                </div>
            </div>
        </Fragment>
    )
}

export default Video;

import React, { Fragment, useState, useEffect, useCallback } from "react";
import { Link } from "react-router-dom";
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
    const [activeView, setActiveView] = useState('feed')

    const handleTabKeyDown = useCallback((e) => {
        // Left/Right arrow navigate between Feed and Album
        const views = ['feed', 'album'];
        const idx = views.indexOf(activeView);
        if (e.key === 'ArrowRight') {
            setActiveView(views[(idx + 1) % views.length]);
        } else if (e.key === 'ArrowLeft') {
            setActiveView(views[(idx - 1 + views.length) % views.length]);
        }
    }, [activeView]);

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

    const styles = `
        /* Shell and tab styles */
        .watch-view-shell {
            margin-top: 10px;
        }
        .watch-view-toggle {
            display: inline-flex;
            align-items: center;
            gap: 8px;
            padding: 6px;
            border-radius: 999px;
            background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(2,6,23,0.04));
            border: 1px solid rgba(148, 163, 184, 0.08);
            margin-bottom: 18px;
            box-shadow: 0 4px 18px rgba(2,6,23,0.06);
        }
        .watch-view-button {
            border: none;
            background: transparent;
            color: rgba(100, 116, 139, 0.95);
            font-size: 0.95rem;
            font-weight: 700;
            letter-spacing: 0.01em;
            padding: 10px 18px;
            border-radius: 12px;
            transition: all 0.18s cubic-bezier(.2,.9,.2,1);
            min-width: 100px;
            text-transform: capitalize;
            cursor: pointer;
            outline: none;
        }
        .watch-view-button[role="tab"]:focus {
            box-shadow: 0 6px 20px rgba(59,130,246,0.18);
        }
        .watch-view-button.active {
            background: linear-gradient(135deg, #2563eb 0%, #7c3aed 100%);
            color: #ffffff;
            box-shadow: 0 12px 30px rgba(59, 130, 246, 0.22);
            transform: translateY(-2px);
        }

        /* Album grid - polished card layout */
        .watch-album-grid {
            display: grid;
            grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
            gap: 20px;
            margin-top: 18px;
        }
        .watch-album-card {
            position: relative;
            display: flex;
            flex-direction: column;
            overflow: hidden;
            border-radius: 14px;
            background: linear-gradient(180deg, rgba(255,255,255,0.02), rgba(2,6,23,0.04));
            border: 1px solid rgba(148, 163, 184, 0.06);
            box-shadow: 0 8px 30px rgba(2,6,23,0.06);
            text-decoration: none;
            color: inherit;
            transition: transform 0.22s ease, box-shadow 0.22s ease, border-color 0.22s ease;
            min-height: 260px;
            overflow: hidden;
        }
        .watch-album-card:focus, .watch-album-card:hover {
            transform: translateY(-6px);
            box-shadow: 0 26px 48px rgba(2,6,23,0.16);
            border-color: rgba(96, 165, 250, 0.18);
            text-decoration: none;
        }
        .watch-album-thumb {
            position: relative;
            width: 100%;
            aspect-ratio: 16 / 10;
            background: #0f1724;
            overflow: hidden;
            display: flex;
            align-items: center;
            justify-content: center;
        }
        .watch-album-thumb img {
            display: block;
            width: 100%;
            height: 100%;
            object-fit: cover;
            transition: transform 0.6s ease;
        }
        .watch-album-card:hover .watch-album-thumb img {
            transform: scale(1.06);
        }
        .watch-album-play {
            position: absolute;
            left: 50%;
            top: 50%;
            transform: translate(-50%, -50%);
            z-index: 3;
            width: 56px;
            height: 56px;
            border-radius: 50%;
            background: linear-gradient(135deg, rgba(37,99,235,0.95), rgba(124,58,237,0.95));
            display: inline-flex;
            align-items: center;
            justify-content: center;
            color: #fff;
            box-shadow: 0 12px 30px rgba(37,99,235,0.24);
            opacity: 0.98;
            transition: transform 0.18s ease;
        }
        .watch-album-play i { font-size: 18px; }
        .watch-album-thumb::after {
            content: "";
            position: absolute;
            inset: 0;
            background: linear-gradient(180deg, rgba(0,0,0,0.0) 30%, rgba(0,0,0,0.42) 100%);
            pointer-events: none;
        }
        .watch-album-overlay {
            position: absolute;
            left: 12px;
            top: 12px;
            z-index: 2;
            display: flex;
            align-items: center;
            gap: 8px;
            background: rgba(0,0,0,0.35);
            border-radius: 999px;
            padding: 6px 10px;
            color: #f8fafc;
            font-size: 0.78rem;
            font-weight: 600;
            backdrop-filter: blur(6px);
        }
        .watch-album-content {
            display: flex;
            flex: 1;
            flex-direction: column;
            padding: 14px 16px 16px;
            background: transparent;
        }
        .watch-album-title {
            margin: 0 0 8px;
            font-size: 1rem;
            line-height: 1.35;
            font-weight: 700;
            color: #0f1724;
            display: -webkit-box;
            -webkit-line-clamp: 2;
            -webkit-box-orient: vertical;
            overflow: hidden;
        }
        .watch-album-author-row {
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 10px;
            color: rgba(100, 116, 139, 0.95);
            font-size: 0.82rem;
            margin-top: auto;
        }
        .watch-album-avatar {
            width: 32px;
            height: 32px;
            border-radius: 50%;
            display: inline-flex;
            align-items: center;
            justify-content: center;
            font-size: 0.79rem;
            font-weight: 700;
            color: #ffffff;
            background: linear-gradient(135deg, #60a5fa, #8b5cf6);
            box-shadow: 0 8px 18px rgba(96, 165, 250, 0.12);
        }
        .watch-album-author-name {
            white-space: nowrap;
            overflow: hidden;
            text-overflow: ellipsis;
        }
        @media (max-width: 992px) {
            .watch-album-grid { grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
        }
        @media (max-width: 768px) {
            .watch-view-toggle { width: 100%; justify-content: space-between; }
            .watch-view-button { flex: 1; min-width: 0; }
            .watch-album-grid { grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 14px; }
        }
    `;

    return (
        <Fragment>
            <style>{styles}</style>
            <div className="container mb-3" style={ isMobile ? { maxWidth: '100%', width: '100%' } : { maxWidth: '90%', width: '90%' } }>
                <div className="row">
                    <div className="col-md-3">
                        { !isMobile && <Ls />}
                    </div>
                    <div className="col-md-6">
                        <div className="watch-view-shell">
                            <div className="watch-view-toggle" role="tablist" aria-label="Watch view toggle">
                                    <button
                                    type="button"
                                        role="tab"
                                        tabIndex={activeView === 'feed' ? 0 : -1}
                                        className={`watch-view-button ${activeView === 'feed' ? 'active' : ''}`}
                                        onClick={() => setActiveView('feed')}
                                        onKeyDown={handleTabKeyDown}
                                        aria-selected={activeView === 'feed'}
                                    >
                                        Feed
                                    </button>
                                    <button
                                        type="button"
                                        role="tab"
                                        tabIndex={activeView === 'album' ? 0 : -1}
                                        className={`watch-view-button ${activeView === 'album' ? 'active' : ''}`}
                                        onClick={() => setActiveView('album')}
                                        onKeyDown={handleTabKeyDown}
                                        aria-selected={activeView === 'album'}
                                    >
                                        Album
                                    </button>
                            </div>

                            <CreateWatch setWatches={setWatches} />

                            {activeView === 'feed' ? (
                                watches.length > 0 ? watches.map((video, i) => (
                                    <Watch
                                        key={video._id || i}
                                        watch={video}
                                        type="watch"
                                        onDelete={(deletedId) => setWatches(prev => prev.filter(item => item._id !== deletedId))}
                                        onUpdate={handleWatchUpdate}
                                    />
                                )) : <WatchSkeleton count={3} />
                            ) : (
                                watches.length > 0 ? (
                                    <div className="watch-album-grid">
                                        {watches.map((video, i) => {
                                            const authorName = video?.author?.user ? `${video.author.user.firstName || ''} ${video.author.user.surname || ''}`.trim() : 'Creator';
                                            const initials = authorName.split(' ').filter(Boolean).slice(0, 2).map(part => part[0]?.toUpperCase()).join('') || 'C';
                                            const poster = video.thumbnail || video.author?.profilePic || 'https://images.unsplash.com/photo-1492691527719-9d1e07e534b4?auto=format&fit=crop&w=900&q=80';

                                            return (
                                                <Link key={video._id || i} to={`/watch/${video._id}`} className="watch-album-card" aria-label={video.caption || 'Watch video'}>
                                                    <div className="watch-album-thumb">
                                                        <img src={poster} alt={video.caption || 'Watch video'} loading="lazy" />
                                                        <div className="watch-album-play" aria-hidden="true"><i className="fas fa-play"></i></div>
                                                        <div className="watch-album-overlay">
                                                            <span><i className="fas fa-heart"></i> {video.reacts?.length || 0}</span>
                                                            <span><i className="fas fa-comment"></i> {video.comments?.length || 0}</span>
                                                        </div>
                                                    </div>
                                                    <div className="watch-album-content">
                                                        <h6 className="watch-album-title">{video.caption || 'Untitled video'}</h6>
                                                        <div className="watch-album-author-row">
                                                            <div className="watch-album-author">
                                                                <span className="watch-album-avatar">{initials}</span>
                                                                <span className="watch-album-author-name">{authorName}</span>
                                                            </div>
                                                            <span><i className="fas fa-play-circle"></i></span>
                                                        </div>
                                                    </div>
                                                </Link>
                                            )
                                        })}
                                    </div>
                                ) : <WatchSkeleton count={3} />
                            )}
                        </div>
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

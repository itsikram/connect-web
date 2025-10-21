import React, { useEffect, useState } from 'react';
import api from '../../api/api';
import Masonry, { ResponsiveMasonry } from 'react-responsive-masonry';
import { useParams } from 'react-router-dom';
import SingleMedia from './SingleMedia';
import Lightbox from './Lightbox';

const MessageOptions = () => {
    const [images, setImages] = useState([]);
    const [isLightBox, setIsLightbox] = useState(false);
    const [imageIndex, setImageIndex] = useState(0);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState(null);
    const [filter, setFilter] = useState('all'); // all, images, files, links
    const [searchTerm, setSearchTerm] = useState('');

    const params = useParams();

    useEffect(() => {
        if (!params.profile) return;
        
        setImages([]);
        setLoading(true);
        setError(null);

        api.get(`message/media/?profileId=${params.profile}`)
            .then((res) => {
                setImages([...res.data.map((media) => media.attachment)]);
            })
            .catch((err) => {
                setError('Failed to load media');
                console.error('Error loading media:', err);
            })
            .finally(() => {
                setLoading(false);
            });
    }, [params.profile]);

    const filteredImages = images.filter(image => {
        if (searchTerm) {
            return image.toLowerCase().includes(searchTerm.toLowerCase());
        }
        return true;
    });

    const handleFilterChange = (newFilter) => {
        setFilter(newFilter);
    };

    const handleSearchChange = (e) => {
        setSearchTerm(e.target.value);
    };

    return (
        <div className='modern-media-sidebar'>
            {isLightBox && (
                <Lightbox 
                    setIsLightbox={setIsLightbox} 
                    setImageIndex={setImageIndex} 
                    imageIndex={imageIndex} 
                    images={filteredImages} 
                    index={imageIndex} 
                />
            )}

            {/* Header Section */}
            <div className="media-sidebar-header">
                <div className="media-header-content">
                    <h2 className="media-title">
                        <i className="fas fa-photo-video"></i>
                        Shared Media
                    </h2>
                    <div className="media-count-badge">
                        {filteredImages.length}
                    </div>
                </div>
                
                {/* Search Bar */}
                <div className="search-section">
                    <div className="search-container">
                        <i className="fas fa-search search-icon"></i>
                        <input
                            type="text"
                            placeholder="Search media..."
                            value={searchTerm}
                            onChange={handleSearchChange}
                            className="search-input"
                        />
                    </div>
                </div>
            </div>

            {/* Filter Tabs */}
            <div className="media-filter-tabs">
                <button
                    className={`filter-tab ${filter === 'all' ? 'active' : ''}`}
                    onClick={() => handleFilterChange('all')}
                >
                    <i className="fas fa-th-large"></i>
                    All
                </button>
                <button
                    className={`filter-tab ${filter === 'images' ? 'active' : ''}`}
                    onClick={() => handleFilterChange('images')}
                >
                    <i className="fas fa-image"></i>
                    Photos
                </button>
                <button
                    className={`filter-tab ${filter === 'files' ? 'active' : ''}`}
                    onClick={() => handleFilterChange('files')}
                >
                    <i className="fas fa-file"></i>
                    Files
                </button>
                <button
                    className={`filter-tab ${filter === 'links' ? 'active' : ''}`}
                    onClick={() => handleFilterChange('links')}
                >
                    <i className="fas fa-link"></i>
                    Links
                </button>
            </div>

            {/* Content Area */}
            <div className="media-content-area">
                {loading ? (
                    <div className="media-loading-state">
                        <div className="loading-spinner">
                            <div className="spinner"></div>
                        </div>
                        <p className="loading-text">Loading media...</p>
                    </div>
                ) : error ? (
                    <div className="media-error-state">
                        <div className="error-icon">
                            <i className="fas fa-exclamation-triangle"></i>
                        </div>
                        <p className="error-text">{error}</p>
                        <button 
                            className="retry-btn"
                            onClick={() => {
                                setError(null);
                                setLoading(true);
                                api.get(`message/media/?profileId=${params.profile}`)
                                    .then((res) => {
                                        setImages([...res.data.map((media) => media.attachment)]);
                                    })
                                    .catch((err) => {
                                        setError('Failed to load media');
                                    })
                                    .finally(() => {
                                        setLoading(false);
                                    });
                            }}
                        >
                            <i className="fas fa-redo"></i>
                            Retry
                        </button>
                    </div>
                ) : filteredImages.length === 0 ? (
                    <div className="media-empty-state">
                        <div className="empty-icon">
                            <i className="fas fa-folder-open"></i>
                        </div>
                        <p className="empty-text">
                            {searchTerm 
                                ? `No media found for "${searchTerm}"` 
                                : 'No shared media yet'
                            }
                        </p>
                        <p className="empty-subtext">
                            {searchTerm 
                                ? 'Try searching with different keywords' 
                                : 'Media shared in this conversation will appear here'
                            }
                        </p>
                    </div>
                ) : (
                    <div className="modern-media-grid">
                        <ResponsiveMasonry 
                            columnsCountBreakPoints={{
                                240: 1,
                                280: 2
                            }}
                        >
                            <Masonry 
                                columnsCount={2} 
                                gutter="8px"
                                className="media-masonry"
                            >
                                {filteredImages.map((image, index) => (
                                    <div key={index} className="media-item-wrapper">
                                        <SingleMedia 
                                            setIsLightbox={setIsLightbox} 
                                            setImageIndex={setImageIndex} 
                                            images={filteredImages} 
                                            index={index} 
                                            src={image} 
                                        />
                                    </div>
                                ))}
                            </Masonry>
                        </ResponsiveMasonry>
                    </div>
                )}
            </div>

            {/* Quick Actions Footer */}
            <div className="media-sidebar-footer">
                <div className="quick-actions">
                    <button className="quick-action-btn export-btn" title="Export Media">
                        <i className="fas fa-download"></i>
                        <span>Export</span>
                    </button>
                    <button className="quick-action-btn clear-btn" title="Clear All">
                        <i className="fas fa-trash-alt"></i>
                        <span>Clear</span>
                    </button>
                </div>
            </div>
        </div>
    );
};

export default MessageOptions;

import React, { Fragment, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import api from "../../api/api";

const PlacesNearYou = () => {
    const mapRef = useRef(null);
    const [map, setMap] = useState(null);
    const [userLocation, setUserLocation] = useState(null);
    const [placesService, setPlacesService] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [friends, setFriends] = useState([]);
    const [friendMarkers, setFriendMarkers] = useState([]);
    const [nearbyProfiles, setNearbyProfiles] = useState([]);
    const [allProfiles, setAllProfiles] = useState([]);
    const profile = useSelector(state => state.profile);

    // Load Google Maps script
    useEffect(() => {
        const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
        
        if (!apiKey) {
            setError('Google Maps API key is not configured. Please add REACT_APP_GOOGLE_MAPS_API_KEY to your .env file.');
            setIsLoading(false);
            return;
        }

        // Check if script is already loaded
        if (window.google && window.google.maps) {
            return;
        }

        // Check if script tag already exists
        const existingScript = document.querySelector('script[src*="maps.googleapis.com"]');
        if (existingScript) {
            return;
        }

        // Create and load script with marker library for AdvancedMarkerElement
        const script = document.createElement('script');
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker`;
        script.async = true;
        script.defer = true;
        script.onerror = () => {
            setError('Failed to load Google Maps. Please check your API key and ensure billing is enabled in Google Cloud Console.');
            setIsLoading(false);
        };
        document.head.appendChild(script);
    }, []);

    // Get user's current location and save to database
    useEffect(() => {
        if (navigator.geolocation && profile?._id) {
            navigator.geolocation.getCurrentPosition(
                async (position) => {
                    const location = {
                        lat: position.coords.latitude,
                        lng: position.coords.longitude
                    };
                    setUserLocation(location);

                    // Save location to database
                    try {
                        await api.post('/profile/update', {
                            lastLocation: {
                                latitude: position.coords.latitude,
                                longitude: position.coords.longitude,
                                timestamp: Date.now(),
                                accuracy: position.coords.accuracy
                            }
                        });
                        console.log('✅ User location saved to database');
                    } catch (error) {
                        console.error('❌ Error saving location to database:', error);
                    }
                },
                (error) => {
                    console.error('Error getting location:', error);
                    // Default to a central location if geolocation fails
                    setUserLocation({ lat: 40.7128, lng: -74.0060 }); // New York City
                    setError('Could not get your location. Showing default location.');
                }
            );
        } else if (!navigator.geolocation) {
            setError('Geolocation is not supported by your browser.');
            setUserLocation({ lat: 40.7128, lng: -74.0060 }); // Default location
        }
    }, [profile?._id]);

    const initializeMap = () => {
        if (!window.google || !window.google.maps || !userLocation) {
            return;
        }

        const defaultLocation = userLocation || { lat: 40.7128, lng: -74.0060 };

        try {
            // Check if AdvancedMarkerElement is available (requires mapId)
            const useAdvancedMarker = window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement;
            const mapId = process.env.REACT_APP_GOOGLE_MAPS_MAP_ID; // Optional: Set in .env for AdvancedMarkerElement
            
            // Initialize map with satellite view
            const mapOptions = {
                center: defaultLocation,
                zoom: 15,
                mapTypeId: window.google.maps.MapTypeId.SATELLITE, // Set to satellite view
                mapTypeControl: true,
                mapTypeControlOptions: {
                    style: window.google.maps.MapTypeControlStyle.HORIZONTAL_BAR,
                    position: window.google.maps.ControlPosition.TOP_CENTER,
                    mapTypeIds: [
                        window.google.maps.MapTypeId.SATELLITE,
                        window.google.maps.MapTypeId.ROADMAP,
                        window.google.maps.MapTypeId.HYBRID,
                        window.google.maps.MapTypeId.TERRAIN
                    ]
                },
                streetViewControl: true,
                fullscreenControl: true
            };
            
            // Add mapId only if available and AdvancedMarkerElement is supported
            if (useAdvancedMarker && mapId) {
                mapOptions.mapId = mapId;
            }
            
            const mapInstance = new window.google.maps.Map(mapRef.current, mapOptions);

            setMap(mapInstance);

            // Add user location marker using AdvancedMarkerElement if available, fallback to Marker
            if (useAdvancedMarker && mapId) {
                try {
                    const userMarker = new window.google.maps.marker.AdvancedMarkerElement({
                        map: mapInstance,
                        position: defaultLocation,
                        title: 'Your Location'
                    });
                } catch (markerError) {
                    console.warn('AdvancedMarkerElement failed, using legacy Marker:', markerError);
                    // Fallback to legacy Marker
                    new window.google.maps.Marker({
                        position: defaultLocation,
                        map: mapInstance,
                        title: 'Your Location',
                        icon: {
                            url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
                        }
                    });
                }
            } else {
                // Use legacy Marker
                new window.google.maps.Marker({
                    position: defaultLocation,
                    map: mapInstance,
                    title: 'Your Location',
                    icon: {
                        url: 'http://maps.google.com/mapfiles/ms/icons/blue-dot.png'
                    }
                });
            }

            // Initialize Places Service (deprecated but still functional)
            // Note: For new projects, consider migrating to google.maps.places.Place API
            const service = new window.google.maps.places.PlacesService(mapInstance);
            setPlacesService(service);

            // Search for nearby places
            searchNearbyPlaces(mapInstance, defaultLocation, service);

            setIsLoading(false);
        } catch (error) {
            console.error('Error initializing map:', error);
            if (error.message && error.message.includes('BillingNotEnabled')) {
                setError('Google Maps billing is not enabled. Please enable billing in your Google Cloud Console to use this feature. See: https://developers.google.com/maps/documentation/javascript/error-messages#billing-not-enabled-map-error');
            } else {
                setError('Failed to initialize map. Please check your API key and billing settings.');
            }
            setIsLoading(false);
        }
    };

    const searchNearbyPlaces = (mapInstance, location, service) => {
        if (!service) return;

        const request = {
            location: location,
            radius: 2000, // 2km radius
            type: ['restaurant', 'cafe', 'bar', 'store', 'gas_station', 'hospital', 'pharmacy', 'bank', 'atm', 'park']
        };

        service.nearbySearch(request, (results, status) => {
            if (status === window.google.maps.places.PlacesServiceStatus.OK && results) {
                const useAdvancedMarker = window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement;
                const mapId = process.env.REACT_APP_GOOGLE_MAPS_MAP_ID;
                
                results.forEach((place) => {
                    if (place.geometry && place.geometry.location) {
                        let marker;
                        
                        // Use AdvancedMarkerElement if available and mapId is set, fallback to legacy Marker
                        if (useAdvancedMarker && mapId) {
                            try {
                                marker = new window.google.maps.marker.AdvancedMarkerElement({
                                    map: mapInstance,
                                    position: place.geometry.location,
                                    title: place.name
                                });
                            } catch (markerError) {
                                console.warn('AdvancedMarkerElement failed for place, using legacy Marker:', markerError);
                                marker = new window.google.maps.Marker({
                                    position: place.geometry.location,
                                    map: mapInstance,
                                    title: place.name
                                });
                            }
                        } else {
                            marker = new window.google.maps.Marker({
                                position: place.geometry.location,
                                map: mapInstance,
                                title: place.name
                            });
                        }

                        // Add info window
                        const infoWindow = new window.google.maps.InfoWindow({
                            content: `
                                <div style="padding: 10px;">
                                    <h3 style="margin: 0 0 5px 0; font-size: 16px;">${place.name}</h3>
                                    ${place.vicinity ? `<p style="margin: 0 0 5px 0; color: #666; font-size: 14px;">${place.vicinity}</p>` : ''}
                                    ${place.rating ? `<p style="margin: 0; color: #f39c12; font-size: 14px;">⭐ ${place.rating} (${place.user_ratings_total || 0} reviews)</p>` : ''}
                                    ${place.website ? `<a href="${place.website}" target="_blank" style="color: #007bff; text-decoration: none; font-size: 12px;">Visit Website</a>` : ''}
                                </div>
                            `
                        });

                        // Add click listener
                        // Check if marker is AdvancedMarkerElement by checking if it has the gmp prefix
                        const isAdvancedMarker = marker instanceof window.google.maps.marker?.AdvancedMarkerElement;
                        if (isAdvancedMarker) {
                            marker.addListener('click', () => {
                                infoWindow.open({
                                    anchor: marker,
                                    map: mapInstance
                                });
                            });
                        } else {
                            marker.addListener('click', () => {
                                infoWindow.open(mapInstance, marker);
                            });
                        }
                    }
                });
            } else if (status === window.google.maps.places.PlacesServiceStatus.ZERO_RESULTS) {
                console.info('No places found nearby');
            } else if (status === window.google.maps.places.PlacesServiceStatus.REQUEST_DENIED) {
                setError('Places API request denied. Please check your API key permissions and billing status.');
            } else {
                console.warn('Places search failed:', status);
                if (status === window.google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT) {
                    setError('Places API quota exceeded. Please check your billing and quota limits.');
                }
            }
        });
    };

    // Fetch all profiles with locations using the new backend endpoint
    useEffect(() => {
        const fetchNearbyProfiles = async () => {
            if (!profile?._id || !userLocation) return;

            try {
                console.log('🔍 Fetching nearby profiles from backend...');
                
                // Get current user's profile to access friends list for isFriend flag
                const profileRes = await api.get('/profile', {
                    params: { profileId: profile._id }
                });

                let friendIds = [];
                if (profileRes.status === 200 && profileRes.data?.friends) {
                    // Ensure friendIds are strings
                    friendIds = profileRes.data.friends.map(id => 
                        typeof id === 'object' && id?._id ? id._id.toString() : id?.toString() || id
                    );
                }

                // Use the new efficient backend endpoint
                const nearbyRes = await api.get('/profile/nearby', {
                    params: {
                        latitude: userLocation.lat,
                        longitude: userLocation.lng,
                        radius: 50, // 50km radius
                        profileId: profile._id
                    }
                });

                if (nearbyRes.status === 200 && nearbyRes.data?.success) {
                    const profiles = nearbyRes.data.profiles || [];
                    
                    // Map backend response to frontend format and add isFriend flag
                    const mappedProfiles = profiles.map(profileData => ({
                        _id: profileData._id,
                        fullName: profileData.fullName || profileData.displayName || 'User',
                        profilePic: profileData.profilePic,
                        username: profileData.username,
                        bio: profileData.bio,
                        location: {
                            lat: profileData.lastLocation.latitude,
                            lng: profileData.lastLocation.longitude,
                            timestamp: profileData.lastLocation.timestamp
                        },
                        distance: profileData.distance,
                        isFriend: friendIds.some(fid => {
                            const fidStr = typeof fid === 'object' && fid?._id 
                                ? fid._id.toString() 
                                : fid?.toString() || fid;
                            const profileIdStr = typeof profileData._id === 'object' && profileData._id?._id
                                ? profileData._id._id.toString()
                                : profileData._id?.toString() || profileData._id;
                            return fidStr === profileIdStr;
                        })
                    }));

                    console.log(`📍 Found ${mappedProfiles.length} nearby profiles:`, mappedProfiles);
                    console.log('📋 All profiles data:', mappedProfiles.map(p => ({
                        id: p._id,
                        name: p.fullName,
                        distance: `${p.distance.toFixed(2)} km`,
                        isFriend: p.isFriend,
                        location: p.location
                    })));
                    
                    setAllProfiles(mappedProfiles);
                    setNearbyProfiles(mappedProfiles);
                    
                    // Separate friends for backward compatibility
                    const friendsOnly = mappedProfiles.filter(p => p.isFriend);
                    setFriends(friendsOnly);
                } else {
                    console.warn('Unexpected response from nearby profiles endpoint:', nearbyRes.data);
                }
            } catch (error) {
                console.error('Error fetching nearby profiles:', error);
                // Fallback: try to show at least friends if the endpoint fails
                try {
                    const profileRes = await api.get('/profile', {
                        params: { profileId: profile._id }
                    });
                    if (profileRes.status === 200 && profileRes.data?.friends) {
                        console.warn('Using fallback: fetching friends individually');
                        // Could implement fallback logic here if needed
                    }
                } catch (fallbackError) {
                    console.error('Fallback also failed:', fallbackError);
                }
            }
        };

        if (profile?._id && userLocation) {
            fetchNearbyProfiles();
        }
    }, [profile?._id, userLocation]);

    // Load nearby profiles on map
    const loadFriendsOnMap = (mapInstance, userLocation) => {
        if (!mapInstance || !window.google || !window.google.maps) return;

        // Clear existing markers
        friendMarkers.forEach(marker => {
            if (marker.setMap) marker.setMap(null);
        });
        setFriendMarkers([]);

        // Use nearbyProfiles instead of just friends
        const profilesToShow = nearbyProfiles.length > 0 ? nearbyProfiles : friends;
        
        if (profilesToShow.length === 0) {
            console.log('📍 No nearby profiles to display');
            return;
        }
        
        console.log(`🗺️ Displaying ${profilesToShow.length} profiles on map`);

        const useAdvancedMarker = window.google.maps.marker && window.google.maps.marker.AdvancedMarkerElement;
        const mapId = process.env.REACT_APP_GOOGLE_MAPS_MAP_ID;
        const newMarkers = [];

        // Process profiles asynchronously to handle circular image creation
        const processProfiles = async () => {
            for (const profile of profilesToShow) {
                if (!profile.location || !profile.location.lat || !profile.location.lng) continue;

                const profilePosition = {
                    lat: profile.location.lat,
                    lng: profile.location.lng
                };

                // Distance is already calculated in profile object
                const distance = profile.distance || calculateDistance(
                    userLocation.lat,
                    userLocation.lng,
                    profile.location.lat,
                    profile.location.lng
                );

                let marker;

                // Use AdvancedMarkerElement if available, fallback to Marker
                if (useAdvancedMarker && mapId) {
                    try {
                        // For AdvancedMarkerElement, we can use a custom element with circular image
                        const circularImage = profile.profilePic 
                            ? await createCircularImage(profile.profilePic, 40)
                            : null;
                        
                        if (circularImage) {
                            // Create a custom element for AdvancedMarkerElement
                            const markerElement = document.createElement('div');
                            markerElement.style.width = '40px';
                            markerElement.style.height = '40px';
                            markerElement.style.borderRadius = '50%';
                            markerElement.style.overflow = 'hidden';
                            markerElement.style.border = '2px solid white';
                            markerElement.style.boxShadow = '0 2px 4px rgba(0,0,0,0.3)';
                            const img = document.createElement('img');
                            img.src = circularImage;
                            img.style.width = '100%';
                            img.style.height = '100%';
                            img.style.objectFit = 'cover';
                            markerElement.appendChild(img);
                            
                            marker = new window.google.maps.marker.AdvancedMarkerElement({
                                map: mapInstance,
                                position: profilePosition,
                                title: profile.fullName,
                                content: markerElement
                            });
                        } else {
                            marker = new window.google.maps.marker.AdvancedMarkerElement({
                                map: mapInstance,
                                position: profilePosition,
                                title: profile.fullName
                            });
                        }
                    } catch (markerError) {
                        console.warn('AdvancedMarkerElement failed for profile, using legacy Marker:', markerError);
                        marker = await createLegacyFriendMarker(mapInstance, profilePosition, profile);
                    }
                } else {
                    marker = await createLegacyFriendMarker(mapInstance, profilePosition, profile);
                }

                // Add info window for profile
                const infoWindow = new window.google.maps.InfoWindow({
                    content: `
                        <div style="padding: 10px; min-width: 200px;">
                            <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 8px;">
                                ${profile.profilePic ? `<img src="${profile.profilePic}" style="width: 40px; height: 40px; border-radius: 50%; object-fit: cover;" />` : ''}
                                <div>
                                    <h3 style="margin: 0; font-size: 16px; font-weight: 600;">${profile.fullName}</h3>
                                    ${profile.isFriend ? `<span style="color: #28a745; font-size: 12px;">👥 Friend</span>` : ''}
                                </div>
                            </div>
                            <p style="margin: 5px 0; color: #666; font-size: 14px;">
                                📍 ${distance.toFixed(1)} km away
                            </p>
                            ${profile.bio ? `<p style="margin: 5px 0; color: #999; font-size: 12px; max-width: 200px; overflow: hidden; text-overflow: ellipsis;">${profile.bio.substring(0, 50)}${profile.bio.length > 50 ? '...' : ''}</p>` : ''}
                            ${profile.location.timestamp ? `<p style="margin: 0; color: #999; font-size: 12px;">Last updated: ${new Date(profile.location.timestamp).toLocaleString()}</p>` : ''}
                            <a href="/${profile._id}" style="display: inline-block; margin-top: 8px; color: #007bff; text-decoration: none; font-size: 13px;">View Profile →</a>
                        </div>
                    `
                });

                // Add click listener
                const isAdvancedMarker = marker instanceof window.google.maps.marker?.AdvancedMarkerElement;
                if (isAdvancedMarker) {
                    marker.addListener('click', () => {
                        infoWindow.open({
                            anchor: marker,
                            map: mapInstance
                        });
                    });
                } else {
                    marker.addListener('click', () => {
                        infoWindow.open(mapInstance, marker);
                    });
                }

                newMarkers.push(marker);
            }

            setFriendMarkers(newMarkers);
        };

        processProfiles();
    };

    // Create circular image from profile picture URL
    const createCircularImage = (imageUrl, size = 40) => {
        return new Promise((resolve, reject) => {
            if (!imageUrl) {
                resolve(null);
                return;
            }

            const img = new Image();
            img.crossOrigin = 'anonymous';
            
            img.onload = () => {
                try {
                    const canvas = document.createElement('canvas');
                    canvas.width = size;
                    canvas.height = size;
                    const ctx = canvas.getContext('2d');

                    // Create circular clipping path
                    ctx.beginPath();
                    ctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
                    ctx.clip();

                    // Draw the image
                    ctx.drawImage(img, 0, 0, size, size);

                    // Convert to data URL
                    const dataUrl = canvas.toDataURL('image/png');
                    resolve(dataUrl);
                } catch (error) {
                    console.warn('Error creating circular image:', error);
                    resolve(null);
                }
            };

            img.onerror = () => {
                resolve(null);
            };

            img.src = imageUrl;
        });
    };

    // Create legacy marker for profile with circular image
    const createLegacyFriendMarker = async (mapInstance, position, profile) => {
        // Use different colors for friends vs others
        const defaultIcon = profile.isFriend 
            ? 'http://maps.google.com/mapfiles/ms/icons/green-dot.png'
            : 'http://maps.google.com/mapfiles/ms/icons/red-dot.png';
        
        let iconUrl = defaultIcon;
        
        // Create circular image if profile picture exists
        if (profile.profilePic) {
            const circularImage = await createCircularImage(profile.profilePic, 40);
            if (circularImage) {
                iconUrl = circularImage;
            }
        }
        
        return new window.google.maps.Marker({
            position: position,
            map: mapInstance,
            title: profile.fullName,
            icon: {
                url: iconUrl,
                scaledSize: new window.google.maps.Size(40, 40),
                anchor: new window.google.maps.Point(20, 20)
            }
        });
    };

    // Calculate distance between two coordinates (Haversine formula)
    const calculateDistance = (lat1, lon1, lat2, lon2) => {
        const R = 6371; // Radius of the Earth in km
        const dLat = (lat2 - lat1) * Math.PI / 180;
        const dLon = (lon2 - lon1) * Math.PI / 180;
        const a = 
            Math.sin(dLat / 2) * Math.sin(dLat / 2) +
            Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
            Math.sin(dLon / 2) * Math.sin(dLon / 2);
        const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
        return R * c;
    };

    // Update markers when nearby profiles or map changes
    useEffect(() => {
        if (map && userLocation) {
            loadFriendsOnMap(map, userLocation);
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nearbyProfiles, friends, map, userLocation]);

    // Initialize map when both Google Maps and user location are available
    useEffect(() => {
        if (window.google && window.google.maps && userLocation && !map && mapRef.current) {
            // Add error handler for map errors
            window.google.maps.event.addListenerOnce(window.google.maps, 'error', (error) => {
                console.error('Google Maps error:', error);
                if (error && error.message && error.message.includes('BillingNotEnabled')) {
                    setError('Google Maps billing is not enabled. Please enable billing in your Google Cloud Console. See: https://developers.google.com/maps/documentation/javascript/error-messages#billing-not-enabled-map-error');
                } else {
                    setError('An error occurred with Google Maps. Please check your API key and billing settings.');
                }
                setIsLoading(false);
            });
            
            initializeMap();
        }
    }, [userLocation]);

    return (
        <Fragment>
            <div className="places-near-you-container" style={{ padding: '20px', height: '100%' }}>
                <div style={{ marginBottom: '20px' }}>
                    <h3 style={{ margin: '0 0 10px 0', fontSize: '24px', fontWeight: '600' }}>
                        Places & Friends Near You
                    </h3>
                    <p style={{ margin: '0', color: '#666', fontSize: '14px' }}>
                        Discover restaurants, cafes, stores, and see where your friends are located
                    </p>
                    {nearbyProfiles.length > 0 && (
                        <div style={{ marginTop: '10px' }}>
                            <p style={{ margin: '5px 0', color: '#28a745', fontSize: '13px', fontWeight: '500' }}>
                                👥 {nearbyProfiles.length} {nearbyProfiles.length === 1 ? 'person' : 'people'} nearby
                            </p>
                            <p style={{ margin: '0', color: '#666', fontSize: '12px' }}>
                                {friends.length} friend{friends.length !== 1 ? 's' : ''} • {nearbyProfiles.length - friends.length} other{nearbyProfiles.length - friends.length !== 1 ? 's' : ''}
                            </p>
                        </div>
                    )}
                </div>

                {error && (
                    <div style={{ 
                        padding: '15px', 
                        backgroundColor: error.includes('billing') ? '#f8d7da' : '#fff3cd', 
                        border: `1px solid ${error.includes('billing') ? '#dc3545' : '#ffc107'}`, 
                        borderRadius: '4px', 
                        marginBottom: '15px',
                        color: error.includes('billing') ? '#721c24' : '#856404'
                    }}>
                        <strong style={{ display: 'block', marginBottom: '8px' }}>
                            {error.includes('billing') ? '⚠️ Billing Required' : '⚠️ Configuration Issue'}
                        </strong>
                        <div style={{ fontSize: '14px', lineHeight: '1.5' }}>
                            {error}
                        </div>
                        {error.includes('billing') && (
                            <div style={{ marginTop: '10px', fontSize: '13px' }}>
                                <a 
                                    href="https://developers.google.com/maps/documentation/javascript/error-messages#billing-not-enabled-map-error" 
                                    target="_blank" 
                                    rel="noopener noreferrer"
                                    style={{ color: '#007bff', textDecoration: 'underline' }}
                                >
                                    Learn how to enable billing →
                                </a>
                            </div>
                        )}
                    </div>
                )}

                {isLoading && (
                    <div style={{ 
                        display: 'flex', 
                        justifyContent: 'center', 
                        alignItems: 'center', 
                        height: '400px',
                        flexDirection: 'column',
                        gap: '10px'
                    }}>
                        <div className="spinner-border text-primary" role="status">
                            <span className="visually-hidden">Loading...</span>
                        </div>
                        <p style={{ color: '#666' }}>Loading map...</p>
                    </div>
                )}

                <div 
                    ref={mapRef} 
                    style={{ 
                        width: '100%', 
                        height: isLoading ? '0' : '600px',
                        borderRadius: '8px',
                        overflow: 'hidden',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.1)'
                    }}
                />
            </div>
        </Fragment>
    );
};

export default PlacesNearYou;


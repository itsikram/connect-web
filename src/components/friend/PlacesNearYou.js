import React, { Fragment, useCallback, useEffect, useRef, useState } from "react";
import { useSelector } from "react-redux";
import api from "../../api/api";

const DEFAULT_CENTER = { lat: 40.7128, lng: -74.0060 };
const MAPS_LOAD_TIMEOUT_MS = 12000;
const NEARBY_RADIUS_M = 2000;
const PLACE_TYPES = ["restaurant", "cafe", "park"];

const loadGoogleMapsScript = (apiKey) => {
    if (window.google?.maps) {
        return Promise.resolve();
    }

    const existing = document.querySelector('script[src*="maps.googleapis.com"]');
    if (existing) {
        return new Promise((resolve, reject) => {
            if (window.google?.maps) {
                resolve();
                return;
            }
            existing.addEventListener("load", () => resolve(), { once: true });
            existing.addEventListener("error", () => reject(new Error("script-error")), { once: true });

            const started = Date.now();
            const poll = setInterval(() => {
                if (window.google?.maps) {
                    clearInterval(poll);
                    resolve();
                } else if (Date.now() - started > MAPS_LOAD_TIMEOUT_MS) {
                    clearInterval(poll);
                    reject(new Error("timeout"));
                }
            }, 100);
        });
    }

    return new Promise((resolve, reject) => {
        const script = document.createElement("script");
        script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&libraries=places,marker&loading=async`;
        script.async = true;
        script.defer = true;
        script.onload = () => resolve();
        script.onerror = () => reject(new Error("script-error"));
        document.head.appendChild(script);
    });
};

const calculateDistance = (lat1, lon1, lat2, lon2) => {
    const R = 6371;
    const dLat = ((lat2 - lat1) * Math.PI) / 180;
    const dLon = ((lon2 - lon1) * Math.PI) / 180;
    const a =
        Math.sin(dLat / 2) * Math.sin(dLat / 2) +
        Math.cos((lat1 * Math.PI) / 180) *
            Math.cos((lat2 * Math.PI) / 180) *
            Math.sin(dLon / 2) *
            Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
};

const createCircularImage = (imageUrl, size = 40) =>
    new Promise((resolve) => {
        if (!imageUrl) {
            resolve(null);
            return;
        }

        const img = new Image();
        img.crossOrigin = "anonymous";
        img.onload = () => {
            try {
                const canvas = document.createElement("canvas");
                canvas.width = size;
                canvas.height = size;
                const ctx = canvas.getContext("2d");
                ctx.beginPath();
                ctx.arc(size / 2, size / 2, size / 2, 0, 2 * Math.PI);
                ctx.clip();
                ctx.drawImage(img, 0, 0, size, size);
                resolve(canvas.toDataURL("image/png"));
            } catch {
                resolve(null);
            }
        };
        img.onerror = () => resolve(null);
        img.src = imageUrl;
    });

const PlacesNearYou = () => {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const placeMarkersRef = useRef([]);
    const friendMarkersRef = useRef([]);
    const infoWindowRef = useRef(null);
    const initAttemptedRef = useRef(false);

    const [isLoading, setIsLoading] = useState(true);
    const [error, setError] = useState(null);
    const [userLocation, setUserLocation] = useState(null);
    const [friends, setFriends] = useState([]);
    const [nearbyProfiles, setNearbyProfiles] = useState([]);
    const [mapsReady, setMapsReady] = useState(false);

    const profile = useSelector((state) => state.profile);

    const clearMarkers = (markersRef) => {
        markersRef.current.forEach((marker) => {
            if (!marker) return;
            if (typeof marker.setMap === "function") {
                marker.setMap(null);
            } else {
                marker.map = null;
            }
        });
        markersRef.current = [];
    };

    const openInfoWindow = useCallback((mapInstance, marker, content) => {
        if (!infoWindowRef.current) {
            infoWindowRef.current = new window.google.maps.InfoWindow();
        }
        infoWindowRef.current.setContent(content);

        const isAdvanced =
            window.google.maps.marker?.AdvancedMarkerElement &&
            marker instanceof window.google.maps.marker.AdvancedMarkerElement;

        if (isAdvanced) {
            infoWindowRef.current.open({ anchor: marker, map: mapInstance });
        } else {
            infoWindowRef.current.open(mapInstance, marker);
        }
    }, []);

    const createLegacyFriendMarker = async (mapInstance, position, person) => {
        const defaultIcon = person.isFriend
            ? "https://maps.google.com/mapfiles/ms/icons/green-dot.png"
            : "https://maps.google.com/mapfiles/ms/icons/red-dot.png";

        let iconUrl = defaultIcon;
        if (person.profilePic) {
            const circularImage = await createCircularImage(person.profilePic, 40);
            if (circularImage) iconUrl = circularImage;
        }

        return new window.google.maps.Marker({
            position,
            map: mapInstance,
            title: person.fullName,
            icon: {
                url: iconUrl,
                scaledSize: new window.google.maps.Size(40, 40),
                anchor: new window.google.maps.Point(20, 20),
            },
        });
    };

    const searchNearbyPlaces = useCallback(
        (mapInstance, location) => {
            if (!mapInstance || !window.google?.maps?.places) return;

            const service = new window.google.maps.places.PlacesService(mapInstance);
            clearMarkers(placeMarkersRef);

            const useAdvancedMarker =
                Boolean(window.google.maps.marker?.AdvancedMarkerElement) &&
                Boolean(process.env.REACT_APP_GOOGLE_MAPS_MAP_ID);
            const mapId = process.env.REACT_APP_GOOGLE_MAPS_MAP_ID;
            const seenPlaceIds = new Set();

            const handleResults = (results, status) => {
                if (status === window.google.maps.places.PlacesServiceStatus.REQUEST_DENIED) {
                    setError((prev) =>
                        prev ||
                        "Places API request denied. Check API key permissions and billing."
                    );
                    return;
                }
                if (status === window.google.maps.places.PlacesServiceStatus.OVER_QUERY_LIMIT) {
                    setError((prev) =>
                        prev || "Places API quota exceeded. Check billing and quota limits."
                    );
                    return;
                }
                if (status !== window.google.maps.places.PlacesServiceStatus.OK || !results) {
                    return;
                }

                results.forEach((place) => {
                    if (!place.geometry?.location) return;
                    const placeKey = place.place_id || place.name;
                    if (seenPlaceIds.has(placeKey)) return;
                    seenPlaceIds.add(placeKey);

                    let marker;
                    if (useAdvancedMarker && mapId) {
                        try {
                            marker = new window.google.maps.marker.AdvancedMarkerElement({
                                map: mapInstance,
                                position: place.geometry.location,
                                title: place.name,
                            });
                        } catch {
                            marker = new window.google.maps.Marker({
                                position: place.geometry.location,
                                map: mapInstance,
                                title: place.name,
                            });
                        }
                    } else {
                        marker = new window.google.maps.Marker({
                            position: place.geometry.location,
                            map: mapInstance,
                            title: place.name,
                            icon: {
                                url: "https://maps.google.com/mapfiles/ms/icons/yellow-dot.png",
                            },
                        });
                    }

                    const content = `
                        <div style="padding:8px;max-width:220px;color:#111">
                            <strong style="font-size:14px">${place.name || "Place"}</strong>
                            ${place.vicinity ? `<p style="margin:6px 0 0;color:#555;font-size:12px">${place.vicinity}</p>` : ""}
                            ${place.rating ? `<p style="margin:6px 0 0;color:#b45309;font-size:12px">★ ${place.rating} (${place.user_ratings_total || 0})</p>` : ""}
                        </div>
                    `;

                    marker.addListener("click", () => {
                        openInfoWindow(mapInstance, marker, content);
                    });

                    placeMarkersRef.current.push(marker);
                });
            };

            // Places nearbySearch accepts only one `type` string — query a few types.
            PLACE_TYPES.forEach((type) => {
                service.nearbySearch(
                    {
                        location,
                        radius: NEARBY_RADIUS_M,
                        type,
                    },
                    handleResults
                );
            });
        },
        [openInfoWindow]
    );

    const loadFriendsOnMap = useCallback(
        async (mapInstance, location, profiles) => {
            if (!mapInstance || !window.google?.maps || !location) return;

            clearMarkers(friendMarkersRef);

            if (!profiles?.length) return;

            const useAdvancedMarker =
                Boolean(window.google.maps.marker?.AdvancedMarkerElement) &&
                Boolean(process.env.REACT_APP_GOOGLE_MAPS_MAP_ID);
            const mapId = process.env.REACT_APP_GOOGLE_MAPS_MAP_ID;
            const newMarkers = [];

            for (const person of profiles) {
                if (!person.location?.lat || !person.location?.lng) continue;

                const profilePosition = {
                    lat: person.location.lat,
                    lng: person.location.lng,
                };

                const distance =
                    person.distance ??
                    calculateDistance(
                        location.lat,
                        location.lng,
                        person.location.lat,
                        person.location.lng
                    );

                let marker;
                if (useAdvancedMarker && mapId) {
                    try {
                        const circularImage = person.profilePic
                            ? await createCircularImage(person.profilePic, 40)
                            : null;

                        if (circularImage) {
                            const markerElement = document.createElement("div");
                            markerElement.style.cssText =
                                "width:40px;height:40px;border-radius:50%;overflow:hidden;border:2px solid #fff;box-shadow:0 2px 6px rgba(0,0,0,.35)";
                            const img = document.createElement("img");
                            img.src = circularImage;
                            img.alt = person.fullName || "User";
                            img.style.cssText = "width:100%;height:100%;object-fit:cover";
                            markerElement.appendChild(img);

                            marker = new window.google.maps.marker.AdvancedMarkerElement({
                                map: mapInstance,
                                position: profilePosition,
                                title: person.fullName,
                                content: markerElement,
                            });
                        } else {
                            marker = new window.google.maps.marker.AdvancedMarkerElement({
                                map: mapInstance,
                                position: profilePosition,
                                title: person.fullName,
                            });
                        }
                    } catch {
                        marker = await createLegacyFriendMarker(
                            mapInstance,
                            profilePosition,
                            person
                        );
                    }
                } else {
                    marker = await createLegacyFriendMarker(
                        mapInstance,
                        profilePosition,
                        person
                    );
                }

                const content = `
                    <div style="padding:8px;min-width:180px;max-width:240px;color:#111">
                        <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                            ${
                                person.profilePic
                                    ? `<img src="${person.profilePic}" alt="" style="width:36px;height:36px;border-radius:50%;object-fit:cover" />`
                                    : ""
                            }
                            <div>
                                <strong style="font-size:14px">${person.fullName || "User"}</strong>
                                ${
                                    person.isFriend
                                        ? `<div style="color:#16a34a;font-size:11px">Friend</div>`
                                        : ""
                                }
                            </div>
                        </div>
                        <p style="margin:0;color:#555;font-size:12px">${Number(distance).toFixed(1)} km away</p>
                        <a href="/${person._id}" style="display:inline-block;margin-top:8px;color:#0284c7;font-size:12px;text-decoration:none">View profile</a>
                    </div>
                `;

                marker.addListener("click", () => {
                    openInfoWindow(mapInstance, marker, content);
                });

                newMarkers.push(marker);
            }

            friendMarkersRef.current = newMarkers;
        },
        [openInfoWindow]
    );

    const initializeMap = useCallback(
        (location) => {
            if (!window.google?.maps || !mapRef.current || !location) return false;
            if (mapInstanceRef.current) return true;

            try {
                const useAdvancedMarker =
                    Boolean(window.google.maps.marker?.AdvancedMarkerElement) &&
                    Boolean(process.env.REACT_APP_GOOGLE_MAPS_MAP_ID);
                const mapId = process.env.REACT_APP_GOOGLE_MAPS_MAP_ID;

                const mapOptions = {
                    center: location,
                    zoom: 14,
                    mapTypeId: window.google.maps.MapTypeId.ROADMAP,
                    mapTypeControl: true,
                    mapTypeControlOptions: {
                        style: window.google.maps.MapTypeControlStyle.DROPDOWN_MENU,
                        position: window.google.maps.ControlPosition.TOP_RIGHT,
                        mapTypeIds: [
                            window.google.maps.MapTypeId.ROADMAP,
                            window.google.maps.MapTypeId.SATELLITE,
                            window.google.maps.MapTypeId.HYBRID,
                            window.google.maps.MapTypeId.TERRAIN,
                        ],
                    },
                    streetViewControl: true,
                    fullscreenControl: true,
                    zoomControl: true,
                    gestureHandling: "greedy",
                };

                if (useAdvancedMarker && mapId) {
                    mapOptions.mapId = mapId;
                }

                const mapInstance = new window.google.maps.Map(mapRef.current, mapOptions);
                mapInstanceRef.current = mapInstance;

                // User location marker
                if (useAdvancedMarker && mapId) {
                    try {
                        new window.google.maps.marker.AdvancedMarkerElement({
                            map: mapInstance,
                            position: location,
                            title: "Your location",
                        });
                    } catch {
                        new window.google.maps.Marker({
                            position: location,
                            map: mapInstance,
                            title: "Your location",
                            icon: {
                                url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                            },
                        });
                    }
                } else {
                    new window.google.maps.Marker({
                        position: location,
                        map: mapInstance,
                        title: "Your location",
                        icon: {
                            url: "https://maps.google.com/mapfiles/ms/icons/blue-dot.png",
                        },
                    });
                }

                // Ensure tiles render after container layout
                window.google.maps.event.addListenerOnce(mapInstance, "idle", () => {
                    window.google.maps.event.trigger(mapInstance, "resize");
                    mapInstance.setCenter(location);
                });

                searchNearbyPlaces(mapInstance, location);
                setIsLoading(false);
                return true;
            } catch (err) {
                console.error("Error initializing map:", err);
                const message = err?.message || "";
                if (message.includes("BillingNotEnabled")) {
                    setError(
                        "Google Maps billing is not enabled. Enable billing in Google Cloud Console to use this feature."
                    );
                } else {
                    setError("Failed to initialize map. Check your API key and billing settings.");
                }
                setIsLoading(false);
                return false;
            }
        },
        [searchNearbyPlaces]
    );

    // Load Google Maps script
    useEffect(() => {
        const apiKey = process.env.REACT_APP_GOOGLE_MAPS_API_KEY;
        let cancelled = false;

        if (!apiKey) {
            setError(
                "Google Maps API key is not configured. Add REACT_APP_GOOGLE_MAPS_API_KEY to your .env file."
            );
            setIsLoading(false);
            return undefined;
        }

        loadGoogleMapsScript(apiKey)
            .then(() => {
                if (!cancelled) setMapsReady(true);
            })
            .catch((err) => {
                if (cancelled) return;
                if (err?.message === "timeout") {
                    setError("Google Maps took too long to load. Refresh and try again.");
                } else {
                    setError(
                        "Failed to load Google Maps. Check your API key and ensure Maps JavaScript API is enabled."
                    );
                }
                setIsLoading(false);
            });

        return () => {
            cancelled = true;
        };
    }, []);

    // Get user location
    useEffect(() => {
        if (!profile?._id) return undefined;

        if (!navigator.geolocation) {
            setError("Geolocation is not supported by your browser.");
            setUserLocation(DEFAULT_CENTER);
            return undefined;
        }

        navigator.geolocation.getCurrentPosition(
            async (position) => {
                const location = {
                    lat: position.coords.latitude,
                    lng: position.coords.longitude,
                };
                setUserLocation(location);

                try {
                    await api.post("/profile/update", {
                        lastLocation: {
                            latitude: position.coords.latitude,
                            longitude: position.coords.longitude,
                            timestamp: Date.now(),
                            accuracy: position.coords.accuracy,
                        },
                    });
                } catch (err) {
                    console.error("Error saving location:", err);
                }
            },
            (geoError) => {
                console.error("Error getting location:", geoError);
                setUserLocation(DEFAULT_CENTER);
                setError((prev) =>
                    prev || "Could not get your location. Showing a default map center."
                );
            },
            { enableHighAccuracy: true, timeout: 10000, maximumAge: 60000 }
        );

        return undefined;
    }, [profile?._id]);

    // Initialize map once maps + location + DOM are ready
    useEffect(() => {
        if (!mapsReady || !userLocation || !mapRef.current || initAttemptedRef.current) {
            return undefined;
        }

        // Wait a frame so the map container has real dimensions (avoids grey/blank map)
        let raf2 = 0;
        const raf1 = requestAnimationFrame(() => {
            raf2 = requestAnimationFrame(() => {
                if (initAttemptedRef.current) return;
                const ok = initializeMap(userLocation);
                if (ok) initAttemptedRef.current = true;
            });
        });

        return () => {
            cancelAnimationFrame(raf1);
            cancelAnimationFrame(raf2);
        };
    }, [mapsReady, userLocation, initializeMap]);

    // Fetch nearby profiles
    useEffect(() => {
        const fetchNearbyProfiles = async () => {
            if (!profile?._id || !userLocation) return;

            try {
                const profileRes = await api.get("/profile", {
                    params: { profileId: profile._id },
                });

                let friendIds = [];
                if (profileRes.status === 200 && profileRes.data?.friends) {
                    friendIds = profileRes.data.friends.map((id) =>
                        typeof id === "object" && id?._id
                            ? id._id.toString()
                            : id?.toString() || id
                    );
                }

                const nearbyRes = await api.get("/profile/nearby", {
                    params: {
                        latitude: userLocation.lat,
                        longitude: userLocation.lng,
                        radius: 50,
                        profileId: profile._id,
                    },
                });

                if (nearbyRes.status === 200 && nearbyRes.data?.success) {
                    const profiles = nearbyRes.data.profiles || [];
                    const mappedProfiles = profiles.map((profileData) => ({
                        _id: profileData._id,
                        fullName:
                            profileData.fullName || profileData.displayName || "User",
                        profilePic: profileData.profilePic,
                        username: profileData.username,
                        bio: profileData.bio,
                        location: {
                            lat: profileData.lastLocation.latitude,
                            lng: profileData.lastLocation.longitude,
                            timestamp: profileData.lastLocation.timestamp,
                        },
                        distance: profileData.distance,
                        isFriend: friendIds.some((fid) => {
                            const fidStr =
                                typeof fid === "object" && fid?._id
                                    ? fid._id.toString()
                                    : fid?.toString() || fid;
                            const profileIdStr =
                                typeof profileData._id === "object" && profileData._id?._id
                                    ? profileData._id._id.toString()
                                    : profileData._id?.toString() || profileData._id;
                            return fidStr === profileIdStr;
                        }),
                    }));

                    setNearbyProfiles(mappedProfiles);
                    setFriends(mappedProfiles.filter((p) => p.isFriend));
                }
            } catch (err) {
                console.error("Error fetching nearby profiles:", err);
            }
        };

        fetchNearbyProfiles();
    }, [profile?._id, userLocation]);

    // Update friend/people markers when data is ready
    useEffect(() => {
        if (!mapInstanceRef.current || !userLocation) return;
        loadFriendsOnMap(mapInstanceRef.current, userLocation, nearbyProfiles);
    }, [nearbyProfiles, userLocation, loadFriendsOnMap]);

    // Resize map when container size changes (responsive)
    useEffect(() => {
        if (!mapInstanceRef.current || !mapRef.current || !window.google?.maps) {
            return undefined;
        }

        const observer = new ResizeObserver(() => {
            const map = mapInstanceRef.current;
            if (!map) return;
            window.google.maps.event.trigger(map, "resize");
            if (userLocation) map.setCenter(userLocation);
        });

        observer.observe(mapRef.current);
        return () => observer.disconnect();
    }, [userLocation, mapsReady]);

    // Cleanup on unmount
    useEffect(() => {
        return () => {
            clearMarkers(placeMarkersRef);
            clearMarkers(friendMarkersRef);
            if (infoWindowRef.current) {
                infoWindowRef.current.close();
                infoWindowRef.current = null;
            }
            mapInstanceRef.current = null;
        };
    }, []);

    const alertClass = error?.toLowerCase().includes("billing")
        ? "places-alert places-alert--danger"
        : "places-alert places-alert--warning";

    return (
        <Fragment>
            <div className="places-near-you">
                <div className="places-near-you__header">
                    <h2>Places &amp; friends near you</h2>
                    <p>
                        Discover nearby spots and see people who have shared their location.
                    </p>
                    {nearbyProfiles.length > 0 && (
                        <div className="places-near-you__stats">
                            <span className="places-stat places-stat--people">
                                <i className="fas fa-users" aria-hidden="true"></i>
                                {nearbyProfiles.length} nearby
                            </span>
                            <span className="places-stat">
                                {friends.length} friend{friends.length !== 1 ? "s" : ""}
                            </span>
                            <span className="places-stat">
                                {Math.max(nearbyProfiles.length - friends.length, 0)} others
                            </span>
                        </div>
                    )}
                </div>

                {error && (
                    <div className={alertClass} role="alert">
                        <strong>
                            {error.toLowerCase().includes("billing")
                                ? "Billing required"
                                : "Map notice"}
                        </strong>
                        <div>{error}</div>
                        {error.toLowerCase().includes("billing") && (
                            <div style={{ marginTop: 8 }}>
                                <a
                                    href="https://developers.google.com/maps/documentation/javascript/error-messages#billing-not-enabled-map-error"
                                    target="_blank"
                                    rel="noopener noreferrer"
                                >
                                    Learn how to enable billing
                                </a>
                            </div>
                        )}
                    </div>
                )}

                <div className="places-map-wrap">
                    {isLoading && (
                        <div className="places-map-loading">
                            <div className="spinner-border text-primary" role="status">
                                <span className="visually-hidden">Loading...</span>
                            </div>
                            <p>Loading map…</p>
                        </div>
                    )}
                    <div ref={mapRef} className="places-map" aria-label="Nearby map" />
                </div>

                <div className="places-legend" aria-hidden="true">
                    <span>
                        <i className="places-dot places-dot--you" /> You
                    </span>
                    <span>
                        <i className="places-dot places-dot--friend" /> Friends
                    </span>
                    <span>
                        <i className="places-dot places-dot--other" /> Others
                    </span>
                    <span>
                        <i className="places-dot places-dot--place" /> Places
                    </span>
                </div>
            </div>
        </Fragment>
    );
};

export default PlacesNearYou;

import React, { Fragment, useCallback, useEffect, useRef, useState } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { useSelector } from "react-redux";
import api from "../../api/api";

const DEFAULT_CENTER = { lat: 40.7128, lng: -74.006 };
const NEARBY_RADIUS_M = 2000;

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

const escapeHtml = (value) =>
    String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;")
        .replace(/'/g, "&#39;");

const buildDivIcon = ({
    size = 40,
    borderColor = "#fff",
    imageUrl = null,
    background = "#ef4444",
    label = "",
}) => {
    const safeLabel = escapeHtml(label);
    const imageMarkup = imageUrl
        ? `<img src="${escapeHtml(imageUrl)}" alt="${safeLabel}" style="width:100%;height:100%;border-radius:50%;object-fit:cover;display:block" />`
        : `<div style="width:100%;height:100%;border-radius:50%;display:flex;align-items:center;justify-content:center;background:${background};color:#fff;font-weight:700;font-size:12px">${safeLabel.slice(0, 2).toUpperCase() || "U"}</div>`;

    return L.divIcon({
        html: `
            <div style="width:${size}px;height:${size}px;border-radius:50%;overflow:hidden;border:2px solid ${borderColor};box-shadow:0 2px 8px rgba(0,0,0,.35);background:#fff">
                ${imageMarkup}
            </div>
        `,
        className: "places-leaflet-marker",
        iconSize: [size, size],
        iconAnchor: [size / 2, size / 2],
        popupAnchor: [0, -size / 2],
    });
};


const PlacesNearYou = () => {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const placeMarkersRef = useRef([]);
    const friendMarkersRef = useRef([]);
    const userMarkerRef = useRef(null);
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
            if (typeof marker.remove === "function") {
                marker.remove();
            }
        });
        markersRef.current = [];
    };

    const searchNearbyPlaces = useCallback(async (mapInstance, location) => {
        if (!mapInstance || !location) return;

        clearMarkers(placeMarkersRef);

        try {
            const response = await api.get("/profile/nearby-places", {
                params: {
                    latitude: location.lat,
                    longitude: location.lng,
                    radius: NEARBY_RADIUS_M,
                },
            });

            if (!response.data.success) {
                throw new Error(response.data.message || "Failed to fetch nearby places");
            }

            const places = response.data.places || [];

            places.forEach((place) => {
                const marker = L.circleMarker([place.lat, place.lng], {
                    radius: 7,
                    color: "#a16207",
                    fillColor: "#facc15",
                    fillOpacity: 0.95,
                    weight: 2,
                }).addTo(mapInstance);

                marker.bindPopup(`
                    <div style="padding:8px;max-width:220px;color:#111">
                        <strong style="font-size:14px">${escapeHtml(place.name)}</strong>
                        ${place.category ? `<p style="margin:6px 0 0;color:#555;font-size:12px;text-transform:capitalize">${escapeHtml(place.category.replace(/_/g, " "))}</p>` : ""}
                        ${place.address ? `<p style="margin:6px 0 0;color:#555;font-size:12px">${escapeHtml(place.address)}</p>` : ""}
                    </div>
                `);

                placeMarkersRef.current.push(marker);
            });
        } catch (err) {
            console.error("Error loading nearby places:", err);
            setError((prev) =>
                prev ||
                "Map loaded, but nearby places could not be fetched right now from OpenStreetMap data."
            );
        }
    }, []);

    const loadFriendsOnMap = useCallback(async (mapInstance, location, profiles) => {
        if (!mapInstance || !location) return;

        clearMarkers(friendMarkersRef);

        if (!profiles?.length) return;

        const newMarkers = [];

        for (const person of profiles) {
            if (
                typeof person.location?.lat !== "number" ||
                typeof person.location?.lng !== "number"
            ) {
                continue;
            }

            const distance =
                person.distance ??
                calculateDistance(
                    location.lat,
                    location.lng,
                    person.location.lat,
                    person.location.lng
                );

            let icon = buildDivIcon({
                size: 40,
                borderColor: person.isFriend ? "#16a34a" : "#ef4444",
                imageUrl: null,
                background: person.isFriend ? "#16a34a" : "#ef4444",
                label: person.fullName || person.username || "U",
            });

            if (person.profilePic) {
                const circularImage = await createCircularImage(person.profilePic, 40);
                if (circularImage) {
                    icon = buildDivIcon({
                        size: 40,
                        borderColor: person.isFriend ? "#16a34a" : "#ef4444",
                        imageUrl: circularImage,
                        label: person.fullName || person.username || "U",
                    });
                }
            }

            const marker = L.marker([person.location.lat, person.location.lng], {
                icon,
                title: person.fullName,
            }).addTo(mapInstance);

            marker.bindPopup(`
                <div style="padding:8px;min-width:180px;max-width:240px;color:#111">
                    <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
                        ${
                            person.profilePic
                                ? `<img src="${escapeHtml(person.profilePic)}" alt="" style="width:36px;height:36px;border-radius:50%;object-fit:cover" />`
                                : ""
                        }
                        <div>
                            <strong style="font-size:14px">${escapeHtml(
                                person.fullName || "User"
                            )}</strong>
                            ${
                                person.isFriend
                                    ? `<div style="color:#16a34a;font-size:11px">Friend</div>`
                                    : ""
                            }
                        </div>
                    </div>
                    <p style="margin:0;color:#555;font-size:12px">${Number(distance).toFixed(
                        1
                    )} km away</p>
                    <a href="/${escapeHtml(
                        person._id
                    )}" style="display:inline-block;margin-top:8px;color:#0284c7;font-size:12px;text-decoration:none">View profile</a>
                </div>
            `);

            newMarkers.push(marker);
        }

        friendMarkersRef.current = newMarkers;
    }, []);

    const initializeMap = useCallback(
        async (location) => {
            if (!mapRef.current || !location) return false;
            if (mapInstanceRef.current) return true;

            try {
                const mapInstance = L.map(mapRef.current, {
                    center: [location.lat, location.lng],
                    zoom: 14,
                    zoomControl: true,
                    preferCanvas: true,
                });

                L.tileLayer(
                    "https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}",
                    {
                        attribution:
                            'Tiles &copy; Esri &mdash; Source: Esri, Maxar, Earthstar Geographics, and the GIS User Community',
                        maxZoom: 19,
                    }
                ).addTo(mapInstance);

                mapInstanceRef.current = mapInstance;

                userMarkerRef.current = L.marker([location.lat, location.lng], {
                    icon: buildDivIcon({
                        size: 42,
                        borderColor: "#2563eb",
                        background: "#2563eb",
                        label: "You",
                    }),
                    title: "Your location",
                })
                    .addTo(mapInstance)
                    .bindPopup(
                        '<div style="padding:8px;color:#111"><strong>Your location</strong></div>'
                    );

                await searchNearbyPlaces(mapInstance, location);
                setIsLoading(false);
                return true;
            } catch (err) {
                console.error("Error initializing map:", err);
                setError("Failed to initialize the map.");
                setIsLoading(false);
                return false;
            }
        },
        [searchNearbyPlaces]
    );

    useEffect(() => {
        setMapsReady(true);
    }, []);

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

    useEffect(() => {
        if (!mapsReady || !userLocation || !mapRef.current || initAttemptedRef.current) {
            return undefined;
        }

        let raf2 = 0;
        const raf1 = requestAnimationFrame(() => {
            raf2 = requestAnimationFrame(async () => {
                if (initAttemptedRef.current) return;
                const ok = await initializeMap(userLocation);
                if (ok) initAttemptedRef.current = true;
            });
        });

        return () => {
            cancelAnimationFrame(raf1);
            cancelAnimationFrame(raf2);
        };
    }, [mapsReady, userLocation, initializeMap]);

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
                        fullName: profileData.fullName || profileData.displayName || "User",
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

    useEffect(() => {
        if (!mapInstanceRef.current || !userLocation) return;

        mapInstanceRef.current.setView([userLocation.lat, userLocation.lng], mapInstanceRef.current.getZoom());

        if (userMarkerRef.current) {
            userMarkerRef.current.setLatLng([userLocation.lat, userLocation.lng]);
        }

        loadFriendsOnMap(mapInstanceRef.current, userLocation, nearbyProfiles);
        searchNearbyPlaces(mapInstanceRef.current, userLocation);
    }, [nearbyProfiles, userLocation, loadFriendsOnMap, searchNearbyPlaces]);

    useEffect(() => {
        if (!mapInstanceRef.current || !mapRef.current) {
            return undefined;
        }

        const observer = new ResizeObserver(() => {
            const map = mapInstanceRef.current;
            if (!map) return;
            map.invalidateSize();
            if (userLocation) {
                map.setView([userLocation.lat, userLocation.lng], map.getZoom());
            }
        });

        observer.observe(mapRef.current);
        return () => observer.disconnect();
    }, [userLocation, mapsReady]);

    useEffect(() => {
        return () => {
            clearMarkers(placeMarkersRef);
            clearMarkers(friendMarkersRef);
            if (userMarkerRef.current) {
                userMarkerRef.current.remove();
                userMarkerRef.current = null;
            }
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, []);

    const alertClass = "places-alert places-alert--warning";

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
                        <strong>Map notice</strong>
                        <div>{error}</div>
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

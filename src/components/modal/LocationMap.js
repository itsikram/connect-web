import React, { useEffect, useRef } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

const LocationMap = ({ latitude, longitude, userName = 'User Location', isLoading = false, className = '' }) => {
    const mapRef = useRef(null);
    const mapInstanceRef = useRef(null);
    const markerRef = useRef(null);

    useEffect(() => {
        // Only initialize if we have valid coordinates
        if (!latitude || !longitude || !mapRef.current) {
            return;
        }

        // Clean up previous map if it exists
        if (mapInstanceRef.current) {
            mapInstanceRef.current.remove();
            mapInstanceRef.current = null;
        }

        let resizeMap = null;
        try {
            const mapLocation = { lat: latitude, lng: longitude };

            const mapInstance = L.map(mapRef.current, {
                center: mapLocation,
                zoom: 15,
                scrollWheelZoom: true,
                dragging: true,
                touchZoom: true,
                doubleClickZoom: true,
                zoomControl: true,
                attributionControl: true,
            });

            L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
                attribution: '© OpenStreetMap contributors',
                maxZoom: 19,
                minZoom: 2,
            }).addTo(mapInstance);

            const marker = L.marker(mapLocation, {
                title: userName,
                riseOnHover: true,
            });

            const popupContent = `
                <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', sans-serif; padding: 8px;">
                    <strong>${escapeHtml(userName)}</strong><br/>
                    <small style="color: #666;">Lat: ${latitude.toFixed(4)}<br/>Lng: ${longitude.toFixed(4)}</small>
                </div>
            `;

            marker.bindPopup(popupContent).addTo(mapInstance);
            marker.openPopup();

            markerRef.current = marker;
            mapInstanceRef.current = mapInstance;

            resizeMap = () => {
                if (mapInstanceRef.current) {
                    mapInstanceRef.current.invalidateSize();
                }
            };
            setTimeout(resizeMap, 80);
            setTimeout(resizeMap, 320);
            window.addEventListener('resize', resizeMap);
            window.visualViewport?.addEventListener('resize', resizeMap);
        } catch (error) {
            console.error('Error initializing Leaflet map:', error);
        }

        return () => {
            if (resizeMap) {
                window.removeEventListener('resize', resizeMap);
                window.visualViewport?.removeEventListener('resize', resizeMap);
            }
            if (mapInstanceRef.current) {
                mapInstanceRef.current.remove();
                mapInstanceRef.current = null;
            }
        };
    }, [latitude, longitude, userName]);

    return (
        <div
            ref={mapRef}
            className={`user-info-map ${className}`.trim()}
        >
            {isLoading && (
                <div
                    style={{
                        position: 'absolute',
                        top: 0,
                        left: 0,
                        right: 0,
                        bottom: 0,
                        display: 'flex',
                        justifyContent: 'center',
                        alignItems: 'center',
                        backgroundColor: 'rgba(255, 255, 255, 0.9)',
                        zIndex: 1000,
                    }}
                >
                    <div style={{ textAlign: 'center' }}>
                        <div
                            className="spinner-border text-primary"
                            role="status"
                            style={{ marginBottom: '10px' }}
                        >
                            <span className="visually-hidden">Loading...</span>
                        </div>
                        <p style={{ color: '#666', margin: 0 }}>Loading map...</p>
                    </div>
                </div>
            )}
        </div>
    );
};

// Helper function to escape HTML characters
const escapeHtml = (text) => {
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;',
    };
    return text.replace(/[&<>"']/g, (m) => map[m]);
};

export default LocationMap;

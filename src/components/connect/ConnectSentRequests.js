import React, { useCallback, useEffect, useState } from "react";
import { useSelector } from "react-redux";
import CGI from "./CGI";
import api from "../../api/api";
import CgiSkleton from "../../skletons/connect/CgiSkleton";
import ConnectCacheManager, { CONNECT_CACHE_EVENT } from "../../utils/connectCacheManager";

const ConnectSentRequests = () => {
    const profileId = useSelector((state) => state.profile?._id);
    const cached = profileId ? ConnectCacheManager.getCachedSentRequests(profileId) : null;
    const [requests, setRequests] = useState(Array.isArray(cached) ? cached : []);
    const [loading, setLoading] = useState(true);

    const load = useCallback(async () => {
        if (!profileId) return;
        const cachedRequests = ConnectCacheManager.getCachedSentRequests(profileId);
        if (Array.isArray(cachedRequests)) setRequests(cachedRequests);
        setLoading(!Array.isArray(cachedRequests));
        try {
            const response = await api.get("/connects/getSentRequest", {
                params: { profileId, _t: Date.now() },
            });
            const items = Array.isArray(response.data) ? response.data : [];
            setRequests(items);
            ConnectCacheManager.setCachedSentRequests(profileId, items);
        } catch (error) {
            console.error("Unable to load sent connect requests", error);
            setRequests([]);
        } finally {
            setLoading(false);
        }
    }, [profileId]);

    useEffect(() => {
        load();
        const onCacheUpdate = (event) => {
            if (event.detail?.profileId !== profileId) return;
            if (event.detail?.list === "sentRequests") {
                setRequests(Array.isArray(event.detail.items) ? event.detail.items : []);
            }
        };
        window.addEventListener(CONNECT_CACHE_EVENT, onCacheUpdate);
        window.addEventListener("connect-request-updated", load);
        return () => {
            window.removeEventListener(CONNECT_CACHE_EVENT, onCacheUpdate);
            window.removeEventListener("connect-request-updated", load);
        };
    }, [load, profileId]);

    return (
        <div id="connects-container">
            <div className="heading">
                <h4 className="heading-title">Sent Requests</h4>
            </div>
            <div className="connect-grid-container">
                {loading ? <CgiSkleton count={4} /> : requests.length ? requests.map((request) => (
                    <CGI
                        key={request._id}
                        id={request._id}
                        profilePic={request.profilePic}
                        isVerified={request.isVerified}
                        fullName={`${request.user?.firstName || ""} ${request.user?.surname || ""}`.trim() || "User"}
                        profileReqs={request.connectReqs}
                        type="sug"
                    />
                )) : (
                    <h4 className="data-not-found text-center">You haven&apos;t sent any connect requests</h4>
                )}
            </div>
        </div>
    );
};

export default ConnectSentRequests;

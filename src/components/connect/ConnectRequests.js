import React, { Fragment, useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import CGI from "./CGI";
import api from "../../api/api";
import CgiSkleton from "../../skletons/connect/CgiSkleton";
import ConnectCacheManager, {
    CONNECT_CACHE_EVENT,
} from "../../utils/connectCacheManager";

let ConnectRequests = () => {
    const location = useLocation();
    const isRequestsPage = location.pathname.includes("/connects/requests");
    const myProfileId = useSelector((state) => state.profile?._id);

    const cachedRequests = myProfileId
        ? ConnectCacheManager.getCachedRequests(myProfileId)
        : null;
    const [reqData, setReqData] = useState(
        Array.isArray(cachedRequests) ? cachedRequests : [],
    );
    const [isLoading, setIsLoading] = useState(!Array.isArray(cachedRequests));

    const refreshRequests = useCallback(
        async (forceRefresh = false) => {
            if (!myProfileId) return;

            const cached = ConnectCacheManager.getCachedRequests(myProfileId);
            if (Array.isArray(cached)) {
                setReqData(cached);
                setIsLoading(false);
            } else {
                setIsLoading(true);
            }

            try {
                const list = await ConnectCacheManager.fetchWithCache({
                    key: `requests:${myProfileId}`,
                    forceRefresh,
                    setCached: (items) =>
                        ConnectCacheManager.setCachedRequests(myProfileId, items),
                    fetcher: async () => {
                        const res = await api.get("/connects/getRequest/");
                        return Array.isArray(res.data) ? res.data : [];
                    },
                });
                setReqData(list);
            } catch (e) {
                console.log(e);
                if (!Array.isArray(cached)) setReqData([]);
            } finally {
                setIsLoading(false);
            }
        },
        [myProfileId],
    );

    useEffect(() => {
        refreshRequests();
    }, [refreshRequests]);

    useEffect(() => {
        const onCacheUpdate = (event) => {
            if (
                event.detail?.profileId !== myProfileId ||
                event.detail?.list !== "requests"
            ) {
                return;
            }
            setReqData(
                Array.isArray(event.detail.items) ? event.detail.items : [],
            );
            setIsLoading(false);
        };

        window.addEventListener(CONNECT_CACHE_EVENT, onCacheUpdate);
        return () => window.removeEventListener(CONNECT_CACHE_EVENT, onCacheUpdate);
    }, [myProfileId]);

    const showSkeleton = isLoading && reqData.length === 0;

    return (
        <Fragment>
            <div id="connects-container">
                <div className="heading">
                    <h4 className="heading-title">Connect Requests</h4>
                    {!isRequestsPage && (
                        <Link to="/connects/requests" className="view-more-btn">See All</Link>
                    )}
                </div>

                <div className="connect-grid-container">
                    {showSkeleton ? (
                        <CgiSkleton count={8} />
                    ) : reqData.length > 0 ? (
                        reqData.map((req) => (
                            <CGI
                                key={req._id}
                                id={req._id}
                                profilePic={req.profilePic}
                                isVerified={req.isVerified}
                                fullName={`${req.user?.firstName || ""} ${req.user?.surname || ""}`.trim() || "User"}
                                type="req"
                            />
                        ))
                    ) : (
                        <h4 className="data-not-found text-center">
                            You don&apos;t have any connect requests right now
                        </h4>
                    )}
                </div>
            </div>
        </Fragment>
    )
}



export default ConnectRequests;

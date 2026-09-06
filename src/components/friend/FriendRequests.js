import React, { Fragment, useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { useSelector } from "react-redux";
import FGI from "./FGI";
import api from "../../api/api";
import FgiSkleton from "../../skletons/friend/FgiSkleton";
import FriendCacheManager, {
    FRIEND_CACHE_EVENT,
} from "../../utils/friendCacheManager";

let FriendRequests = () => {
    const location = useLocation();
    const isRequestsPage = location.pathname.includes("/friends/requests");
    const myProfileId = useSelector((state) => state.profile?._id);

    const cachedRequests = myProfileId
        ? FriendCacheManager.getCachedRequests(myProfileId)
        : null;
    const [reqData, setReqData] = useState(
        Array.isArray(cachedRequests) ? cachedRequests : [],
    );
    const [isLoading, setIsLoading] = useState(!Array.isArray(cachedRequests));

    const refreshRequests = useCallback(
        async (forceRefresh = false) => {
            if (!myProfileId) return;

            const cached = FriendCacheManager.getCachedRequests(myProfileId);
            if (Array.isArray(cached)) {
                setReqData(cached);
                setIsLoading(false);
            } else {
                setIsLoading(true);
            }

            try {
                const list = await FriendCacheManager.fetchWithCache({
                    key: `requests:${myProfileId}`,
                    forceRefresh,
                    setCached: (items) =>
                        FriendCacheManager.setCachedRequests(myProfileId, items),
                    fetcher: async () => {
                        const res = await api.get("/friend/getRequest/");
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

        window.addEventListener(FRIEND_CACHE_EVENT, onCacheUpdate);
        return () => window.removeEventListener(FRIEND_CACHE_EVENT, onCacheUpdate);
    }, [myProfileId]);

    const showSkeleton = isLoading && reqData.length === 0;

    return (
        <Fragment>
            <div id="friends-container">
                <div className="heading">
                    <h4 className="heading-title">Friend Requests</h4>
                    {!isRequestsPage && (
                        <Link to="/friends/requests" className="view-more-btn">See All</Link>
                    )}
                </div>

                <div className="friend-grid-container">
                    {showSkeleton ? (
                        <FgiSkleton count={8} />
                    ) : reqData.length > 0 ? (
                        reqData.map((req) => (
                            <FGI
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
                            You don&apos;t have any friend requests right now
                        </h4>
                    )}
                </div>
            </div>
        </Fragment>
    )
}



export default FriendRequests;

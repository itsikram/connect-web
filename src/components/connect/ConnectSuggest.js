import React, { Fragment, useCallback, useEffect, useState } from "react";
import CGI from "./CGI";
import { useSelector } from "react-redux";
import api from "../../api/api";
import CgiSkleton from "../../skletons/connect/CgiSkleton";
import ConnectCacheManager, {
    CONNECT_CACHE_EVENT,
} from "../../utils/connectCacheManager";


let ConnectsSuggest = () => {
    let myProfile = useSelector(state => state.profile)
    const myProfileId = myProfile?._id;

    const cachedSuggestions = myProfileId
        ? ConnectCacheManager.getCachedSuggestions(myProfileId)
        : null;
    const [connects, setConnects] = useState(
        Array.isArray(cachedSuggestions) ? cachedSuggestions : [],
    );
    const [isLoading, setIsLoading] = useState(!Array.isArray(cachedSuggestions));

    const refreshSuggestions = useCallback(
        async (forceRefresh = false) => {
            if (!myProfileId) return;

            const cached = ConnectCacheManager.getCachedSuggestions(myProfileId);
            if (Array.isArray(cached)) {
                setConnects(cached);
                setIsLoading(false);
            } else {
                setIsLoading(true);
            }

            try {
                const list = await ConnectCacheManager.fetchWithCache({
                    key: `suggestions:${myProfileId}`,
                    forceRefresh,
                    setCached: (items) =>
                        ConnectCacheManager.setCachedSuggestions(myProfileId, items),
                    fetcher: async () => {
                        const res = await api.get("/connects/getSuggetions/", {
                            params: { profile: myProfileId },
                        });
                        return Array.isArray(res.data) ? res.data : [];
                    },
                });
                setConnects(list);
            } catch (e) {
                console.log(e);
                if (!Array.isArray(cached)) setConnects([]);
            } finally {
                setIsLoading(false);
            }
        },
        [myProfileId],
    );

    useEffect(() => {
        refreshSuggestions();
    }, [refreshSuggestions]);

    useEffect(() => {
        const onCacheUpdate = (event) => {
            if (
                event.detail?.profileId !== myProfileId ||
                event.detail?.list !== "suggestions"
            ) {
                return;
            }
            setConnects(Array.isArray(event.detail.items) ? event.detail.items : []);
            setIsLoading(false);
        };

        window.addEventListener(CONNECT_CACHE_EVENT, onCacheUpdate);
        return () => window.removeEventListener(CONNECT_CACHE_EVENT, onCacheUpdate);
    }, [myProfileId]);

    const showSkeleton = isLoading && connects.length === 0;

    return (
        <Fragment>
            <div id="connects-container" className="mb-5">
                <div className="heading">
                    <h4 className="heading-title">People You May Know</h4>
                </div>

                <div className="connect-grid-container">
                    {showSkeleton ? (
                        <CgiSkleton count={8} />
                    ) : connects.length > 0 ? (
                        connects.map((connect) => {
                            if (!connect.user) return null;

                            const fullName = `${connect.user.firstName || ""} ${connect.user.surname || ""}`.trim() || "User";
                            const isIncomingReq = myProfile.connectReqs?.some((id) =>
                                String(id?._id || id) === String(connect._id)
                            );

                            return (
                                <CGI
                                    key={connect._id}
                                    profileReqs={connect.connectReqs}
                                    type={isIncomingReq ? "req" : "sug"}
                                    id={connect._id}
                                    profilePic={connect.profilePic}
                                    isVerified={connect.isVerified}
                                    fullName={fullName}
                                />
                            );
                        })
                    ) : (
                        <h4 className="data-not-found text-center">
                            No suggestions available right now
                        </h4>
                    )}
                </div>
            </div>
        </Fragment>
    )
}

export default ConnectsSuggest;

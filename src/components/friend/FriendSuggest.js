import React, { Fragment, useCallback, useEffect, useState } from "react";
import FGI from "./FGI";
import { useSelector } from "react-redux";
import api from "../../api/api";
import FgiSkleton from "../../skletons/friend/FgiSkleton";
import FriendCacheManager, {
    FRIEND_CACHE_EVENT,
} from "../../utils/friendCacheManager";


let FriendsSuggest = () => {
    let myProfile = useSelector(state => state.profile)
    const myProfileId = myProfile?._id;

    const cachedSuggestions = myProfileId
        ? FriendCacheManager.getCachedSuggestions(myProfileId)
        : null;
    const [friends, setFriends] = useState(
        Array.isArray(cachedSuggestions) ? cachedSuggestions : [],
    );
    const [isLoading, setIsLoading] = useState(!Array.isArray(cachedSuggestions));

    const refreshSuggestions = useCallback(
        async (forceRefresh = false) => {
            if (!myProfileId) return;

            const cached = FriendCacheManager.getCachedSuggestions(myProfileId);
            if (Array.isArray(cached)) {
                setFriends(cached);
                setIsLoading(false);
            } else {
                setIsLoading(true);
            }

            try {
                const list = await FriendCacheManager.fetchWithCache({
                    key: `suggestions:${myProfileId}`,
                    forceRefresh,
                    setCached: (items) =>
                        FriendCacheManager.setCachedSuggestions(myProfileId, items),
                    fetcher: async () => {
                        const res = await api.get("/friend/getSuggetions/", {
                            params: { profile: myProfileId },
                        });
                        return Array.isArray(res.data) ? res.data : [];
                    },
                });
                setFriends(list);
            } catch (e) {
                console.log(e);
                if (!Array.isArray(cached)) setFriends([]);
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
            setFriends(Array.isArray(event.detail.items) ? event.detail.items : []);
            setIsLoading(false);
        };

        window.addEventListener(FRIEND_CACHE_EVENT, onCacheUpdate);
        return () => window.removeEventListener(FRIEND_CACHE_EVENT, onCacheUpdate);
    }, [myProfileId]);

    const showSkeleton = isLoading && friends.length === 0;

    return (
        <Fragment>
            <div id="friends-container" className="mb-5">
                <div className="heading">
                    <h4 className="heading-title">People You May Know</h4>
                </div>

                <div className="friend-grid-container">
                    {showSkeleton ? (
                        <FgiSkleton count={8} />
                    ) : friends.length > 0 ? (
                        friends.map((friend) => {
                            if (!friend.user) return null;

                            const fullName = `${friend.user.firstName || ""} ${friend.user.surname || ""}`.trim() || "User";
                            const isIncomingReq = myProfile.friendReqs?.includes(friend._id);

                            return (
                                <FGI
                                    key={friend._id}
                                    profileReqs={friend.friendReqs}
                                    type={isIncomingReq ? "req" : "sug"}
                                    id={friend._id}
                                    profilePic={friend.profilePic}
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

export default FriendsSuggest;

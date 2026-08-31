import React, { Fragment, useCallback, useEffect, useState, useRef } from "react";
import { useParams } from "react-router-dom";
import { useSelector } from "react-redux";
import CreatePost from "../post/CreatePost";
import Post from "../post/Post";
import PostSkeleton from "../../skletons/post/PostSkeleton";
import { fetchProfilePostsCached, primeCachedResource } from "../../utils/requestCache";

const PorfilePosts = () => {
    const { profile } = useParams();
    const myProfileData = useSelector((state) => state.profile) || {};
    const isAuth = myProfileData._id === profile || myProfileData.username === profile;
    const [posts, setPosts] = useState([]);
    const postContainer = useRef(null);
    const [hasLoadedPosts, setHasLoadedPosts] = useState(false);
    const [postsLoading, setPostsLoading] = useState(true);

    useEffect(() => {
        if (!profile) return;

        setHasLoadedPosts(false);
        setPostsLoading(true);

        fetchProfilePostsCached(profile, { ttlMs: 60000, storageTtlMs: 180000 })
            .then((postsResponse) => {
                setPosts(Array.isArray(postsResponse) ? postsResponse : []);
            })
            .catch((e) => {
                console.log(e);
                setPosts([]);
            })
            .finally(() => {
                setHasLoadedPosts(true);
                setPostsLoading(false);
            });
    }, [profile]);

    useEffect(() => {
        if (!profile || !hasLoadedPosts) return;
        primeCachedResource(`profilePosts:${profile}`, posts);
    }, [hasLoadedPosts, posts, profile]);

    const handlePostDeleted = useCallback((postId) => {
        setPosts((currentPosts) => currentPosts.filter((post) => post?._id !== postId));
    }, []);

    const handlePostUpdated = useCallback((updatedPost) => {
        if (!updatedPost?._id) return;
        setPosts((currentPosts) =>
            currentPosts.map((post) =>
                post?._id === updatedPost._id ? { ...post, ...updatedPost } : post
            )
        );
    }, []);

    return (
        <Fragment>
            <div id="profile-post-content">
                <div ref={postContainer} className="posts-container">
                    {isAuth && <CreatePost setPosts={setPosts} posts={posts}></CreatePost>}

                    {postsLoading && <PostSkeleton count={3} />}

                    {!postsLoading && posts.length === 0 && (
                        <div className="profile-placeholder-card no-posts-message">
                            {isAuth ? "No posts yet." : "No posts yet."}
                        </div>
                    )}

                    {!postsLoading &&
                        posts.map((data, index) => (
                            <Post
                                key={data._id}
                                myProfile={myProfileData}
                                postContainer={postContainer}
                                data={data}
                                index={index}
                                onPostDeleted={handlePostDeleted}
                                onPostUpdated={handlePostUpdated}
                            ></Post>
                        ))}
                </div>
            </div>
        </Fragment>
    );
};

export default PorfilePosts;

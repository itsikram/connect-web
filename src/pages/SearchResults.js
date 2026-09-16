import React, { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import api from "../api/api";

const SearchResults = () => {
  const [searchParams] = useSearchParams();
  const query = (searchParams.get("input") || "").trim();
  const [data, setData] = useState({ users: [], posts: [], videos: [] });
  const [loading, setLoading] = useState(Boolean(query));
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    if (!query) {
      setData({ users: [], posts: [], videos: [] });
      setLoading(false);
      return () => {
        active = false;
      };
    }

    setLoading(true);
    setError("");
    api
      .get("/search", { params: { input: query } })
      .then((response) => {
        if (!active) return;
        setData({
          users: Array.isArray(response.data?.users) ? response.data.users : [],
          posts: Array.isArray(response.data?.posts) ? response.data.posts : [],
          videos: Array.isArray(response.data?.videos) ? response.data.videos : [],
        });
      })
      .catch(() => {
        if (active) {
          setData({ users: [], posts: [], videos: [] });
          setError("Couldn't load search results. Try again.");
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [query]);

  const hasResults = data.users.length || data.posts.length || data.videos.length;

  return (
    <main className="container py-4">
      <h2>Search results</h2>
      <p className="text-muted mb-4">
        Results for <strong>{query || "your search"}</strong>
      </p>

      {loading && <p>Searching...</p>}
      {!loading && error && <p className="text-danger">{error}</p>}
      {!loading && !error && !hasResults && <p>No results found.</p>}

      {!loading && !error && data.users.length > 0 && (
        <section className="mb-4">
          <h3>People</h3>
          <div className="list-group">
            {data.users.map((user) => (
              <Link key={user._id} to={`/${user._id}`} className="list-group-item list-group-item-action">
                {user.fullName || user.displayName || user.username || "Profile"}
              </Link>
            ))}
          </div>
        </section>
      )}

      {!loading && !error && data.posts.length > 0 && (
        <section className="mb-4">
          <h3>Posts</h3>
          <div className="row g-3">
            {data.posts.map((post) => (
              <div key={post._id} className="col-12 col-md-6">
                <Link to={`/post/${post._id}`} className="text-decoration-none">
                  <article className="card h-100">
                    {post.photos?.[0] && (
                      <img src={post.photos[0]} alt="" className="card-img-top" />
                    )}
                    <div className="card-body">
                      <p className="card-text text-dark mb-0">{post.caption}</p>
                    </div>
                  </article>
                </Link>
              </div>
            ))}
          </div>
        </section>
      )}

      {!loading && !error && data.videos.length > 0 && (
        <section className="mb-4">
          <h3>Videos</h3>
          <div className="list-group">
            {data.videos.map((video) => (
              <Link key={video._id} to={`/watch/${video._id}`} className="list-group-item list-group-item-action">
                {video.caption || "Untitled video"}
              </Link>
            ))}
          </div>
        </section>
      )}
    </main>
  );
};

export default SearchResults;

import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { getServerAddress } from '../utils/offlineUtils';
import config from '../config/config.json';
import '../components/LandingPage.css';

// Logged-out / search-engine view of /:username. Shows only the fields the
// API's /profile/public/:username returns (name, bio, photos), and only for
// profiles whose posts are Public; server.js renders the same data into the
// HTML so crawlers see it without running JS.
const SITE_URL = 'https://connect-bd.online';
const JSON_LD_ID = 'public-profile-structured-data';

// Profile photos are full-size uploads; let Cloudinary resize and convert
// them. Same transforms as server.js so the browser reuses its downloads.
const cloudinarySized = (url, transform) =>
  typeof url === 'string'
    ? url.replace(
        /^(https:\/\/res\.cloudinary\.com\/[^/]+\/image\/upload\/)(?!.*[wfq]_)/,
        `$1${transform}/`
      )
    : url;
const COVER_TRANSFORM = 'f_auto,q_auto,c_fill,w_1080,h_270';
const AVATAR_TRANSFORM = 'f_auto,q_auto,c_fill,w_256,h_256';

const setMeta = (attr, key, content) => {
  let el = document.querySelector(`meta[${attr}="${key}"]`);
  if (!el) {
    el = document.createElement('meta');
    el.setAttribute(attr, key);
    document.head.appendChild(el);
  }
  el.setAttribute('content', content);
};

const applyProfileSeo = (p) => {
  const url = `${SITE_URL}/${p.username}`;
  const title = `${p.name} (@${p.username}) on Connect BD`;
  const description = p.bio
    ? `${p.name} (@${p.username}) is on Connect BD. ${p.bio}`.slice(0, 300)
    : `${p.name} (@${p.username}) is on Connect, the Connect BD social media app. Join Connect to chat, call and share moments with ${p.name}.`;
  const image = p.profilePic || `${SITE_URL}/logo512.png`;

  document.title = title;
  setMeta('name', 'description', description);
  setMeta('name', 'robots', 'index, follow, max-image-preview:large');
  setMeta('property', 'og:type', 'profile');
  setMeta('property', 'og:url', url);
  setMeta('property', 'og:title', title);
  setMeta('property', 'og:description', description);
  setMeta('property', 'og:image', image);
  setMeta('name', 'twitter:title', title);
  setMeta('name', 'twitter:description', description);
  setMeta('name', 'twitter:image', image);
  const canonical = document.querySelector('link[rel="canonical"]');
  if (canonical) canonical.setAttribute('href', url);

  let script = document.getElementById(JSON_LD_ID);
  if (!script) {
    script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = JSON_LD_ID;
    document.head.appendChild(script);
  }
  script.textContent = JSON.stringify({
    '@context': 'https://schema.org',
    '@type': 'ProfilePage',
    url,
    name: title,
    dateCreated: p.joinedAt,
    mainEntity: {
      '@type': 'Person',
      name: p.name,
      alternateName: `@${p.username}`,
      identifier: p.username,
      description: p.bio || undefined,
      image: p.profilePic || undefined,
      url,
    },
  });
};

// server.js embeds the profile it rendered, so the first render matches the
// server HTML instead of flashing a loading card. The head is already set.
const embeddedProfile = (username) => {
  try {
    const p = JSON.parse(document.getElementById('public-profile-data')?.textContent || 'null');
    return p && p.username?.toLowerCase() === String(username).toLowerCase() ? p : null;
  } catch (e) {
    return null;
  }
};

const PublicProfile = () => {
  const { profile: username } = useParams();
  const [state, setState] = useState(() => {
    const p = embeddedProfile(username);
    return p ? { loading: false, profile: p } : { loading: true, profile: null };
  });

  useEffect(() => {
    if (embeddedProfile(username)) return undefined;
    let active = true;
    setState({ loading: true, profile: null });
    // fetch rather than axios: this page is part of the small public bundle.
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);
    fetch(`${getServerAddress()}/api/profile/public/${encodeURIComponent(username)}`, {
      signal: controller.signal,
    })
      .then((res) => (res.ok ? res.json() : null))
      .then((p) => {
        if (!active) return;
        if (p?.indexable) {
          applyProfileSeo(p);
          setState({ loading: false, profile: p });
        } else {
          setMeta('name', 'robots', 'noindex, follow');
          setState({ loading: false, profile: null });
        }
      })
      .catch(() => {
        if (!active) return;
        setMeta('name', 'robots', 'noindex, follow');
        setState({ loading: false, profile: null });
      });
    return () => {
      active = false;
      clearTimeout(timer);
      controller.abort();
      document.getElementById(JSON_LD_ID)?.remove();
    };
  }, [username]);

  const p = state.profile;

  return (
    <div className="landing-page">
      <div className="landing-inner">
        <nav className="landing-nav" aria-label="Main">
          <Link to="/" className="landing-brand">
            <img src="/logo-72.webp" alt="" width="36" height="36" />
            Connect BD
          </Link>
          <div className="landing-nav-links">
            <Link to="/login" state={{ from: `/${username}` }}>Log In</Link>
            <Link to="/signup" className="landing-nav-cta">Sign Up</Link>
          </div>
        </nav>

        <main>
          {state.loading ? (
            <div className="public-profile-card" aria-busy="true" />
          ) : p ? (
            <article className="public-profile-card">
              <div
                className="public-profile-cover"
                style={
                  p.coverPic
                    ? { backgroundImage: `url("${cloudinarySized(p.coverPic, COVER_TRANSFORM)}")` }
                    : undefined
                }
              />
              <img
                className="public-profile-avatar"
                src={p.profilePic ? cloudinarySized(p.profilePic, AVATAR_TRANSFORM) : config.defaultProfile}
                alt={`${p.name} profile picture`}
                width="128"
                height="128"
              />
              <h1>
                {p.name}
                {p.isVerified ? <span className="public-profile-badge" title="Verified"> ✓</span> : null}
              </h1>
              <p className="public-profile-username">@{p.username}</p>
              {p.bio ? <p className="public-profile-bio">{p.bio}</p> : null}
              <div className="hero-buttons">
                <Link to="/login" state={{ from: `/${p.username}` }} className="landing-btn landing-btn--primary">
                  Log in to connect with {p.name.split(' ')[0]}
                </Link>
                <Link to="/signup" className="landing-btn landing-btn--secondary">
                  Join Connect
                </Link>
              </div>
            </article>
          ) : (
            <article className="public-profile-card">
              <h1>This profile isn&apos;t available</h1>
              <p className="public-profile-bio">
                The account may not exist, or its owner keeps it private. Log in to Connect to see more.
              </p>
              <div className="hero-buttons">
                <Link to="/login" state={{ from: `/${username}` }} className="landing-btn landing-btn--primary">
                  Log In
                </Link>
                <Link to="/" className="landing-btn landing-btn--secondary">
                  About Connect BD
                </Link>
              </div>
            </article>
          )}
        </main>
      </div>
    </div>
  );
};

export default PublicProfile;

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useSelector } from "react-redux";
import api from "../../api/api";
import FriendCacheManager from "../../utils/friendCacheManager";
import { openCreatePost } from "../../utils/openComposer";
import {
  formatBilingualPrompt,
  getDailyIcebreaker,
  isoDateKey,
  isoWeekKey,
} from "../../utils/feedPrompts";
import "./FeedBoostCards.css";

const WELCOME_KEY = "feedBoost:welcomeDismissed";
const icebreakerKey = () => `feedBoost:icebreaker:${isoDateKey()}`;
const recapKey = () => `feedBoost:weeklyRecap:${isoWeekKey()}`;
const weekCardKey = () => `feedBoost:weekCard:${isoWeekKey()}`;

const readFlag = (key) => {
  try {
    return window.localStorage.getItem(key) === "1";
  } catch (_) {
    return false;
  }
};

const writeFlag = (key) => {
  try {
    window.localStorage.setItem(key, "1");
  } catch (_) {
    /* ignore */
  }
};

const readHabits = () => {
  try {
    const raw = window.localStorage.getItem("habitsApp");
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
};

const FeedBoostCards = ({ postCount = 0, feedLoaded = false }) => {
  const navigate = useNavigate();
  const myProfile = useSelector((state) => state.profile);
  const myProfileId = myProfile?._id;
  const thinFeed = feedLoaded && postCount < 4;

  const [welcomeHidden, setWelcomeHidden] = useState(() => readFlag(WELCOME_KEY));
  const [icebreakerHidden, setIcebreakerHidden] = useState(() =>
    readFlag(icebreakerKey()),
  );
  const [weekHidden, setWeekHidden] = useState(() => readFlag(weekCardKey()));
  const [recapHidden, setRecapHidden] = useState(() => readFlag(recapKey()));
  const [suggestions, setSuggestions] = useState([]);
  const [digest, setDigest] = useState(null);

  const icebreaker = useMemo(() => getDailyIcebreaker(), []);
  const streakHabits = useMemo(
    () => readHabits().filter((h) => Number(h?.streak) > 0).slice(0, 3),
    [],
  );

  useEffect(() => {
    if (!myProfileId) return undefined;
    let cancelled = false;

    const loadSuggestions = async () => {
      try {
        const list = await FriendCacheManager.fetchWithCache({
          key: `suggestions:${myProfileId}`,
          setCached: (items) =>
            FriendCacheManager.setCachedSuggestions(myProfileId, items),
          fetcher: async () => {
            const res = await api.get("/friend/getSuggetions/", {
              params: { profile: myProfileId },
            });
            return Array.isArray(res.data) ? res.data : [];
          },
        });
        if (!cancelled) {
          setSuggestions(Array.isArray(list) ? list.filter((p) => p?.user).slice(0, 3) : []);
        }
      } catch (_) {
        if (!cancelled) setSuggestions([]);
      }
    };

    loadSuggestions();
    return () => {
      cancelled = true;
    };
  }, [myProfileId]);

  useEffect(() => {
    if (!myProfileId) return undefined;
    let cancelled = false;
    api
      .get("/content/digest")
      .then((res) => {
        if (!cancelled && res.data) setDigest(res.data);
      })
      .catch(() => {
        if (!cancelled) setDigest(null);
      });
    return () => {
      cancelled = true;
    };
  }, [myProfileId]);

  const postPrompt = useCallback(
    (caption) => {
      openCreatePost({ caption, audience: 1, navigate });
    },
    [navigate],
  );

  const dismiss = (key, setter) => {
    writeFlag(key);
    setter(true);
  };

  const showWelcome = thinFeed && !welcomeHidden;
  const showIcebreaker = !icebreakerHidden;
  const showPeople = thinFeed && suggestions.length > 0;
  const showWeek =
    !weekHidden &&
    (streakHabits.length > 0 ||
      Number(digest?.upcomingEvents?.length) > 0 ||
      Number(digest?.notesThisWeek) > 0);
  const showRecap =
    !recapHidden &&
    digest &&
    (Number(digest.postsThisWeek) > 0 || Number(digest.reactsReceived) > 0);

  if (!showWelcome && !showIcebreaker && !showPeople && !showWeek && !showRecap) {
    return null;
  }

  return (
    <div className="feed-boost">
      {showIcebreaker && (
        <section className="feed-boost-card feed-boost-card--prompt">
          <button
            type="button"
            className="feed-boost-dismiss"
            aria-label="Hide today's prompt"
            onClick={() => dismiss(icebreakerKey(), setIcebreakerHidden)}
          >
            <i className="far fa-times" />
          </button>
          <p className="feed-boost-kicker">Today's question</p>
          <h3>{icebreaker.en}</h3>
          <p className="feed-boost-bn">{icebreaker.bn}</p>
          <button
            type="button"
            className="feed-boost-cta"
            onClick={() => postPrompt(formatBilingualPrompt(icebreaker))}
          >
            Post this
          </button>
        </section>
      )}

      {showWelcome && (
        <section className="feed-boost-card">
          <button
            type="button"
            className="feed-boost-dismiss"
            aria-label="Dismiss welcome"
            onClick={() => dismiss(WELCOME_KEY, setWelcomeHidden)}
          >
            <i className="far fa-times" />
          </button>
          <p className="feed-boost-kicker">Welcome to Connect</p>
          <h3>Make this feed yours</h3>
          <div className="feed-boost-actions">
            <Link to="/friends/suggestions" className="feed-boost-chip">
              <i className="fas fa-user-plus" /> Add friends
            </Link>
            <button
              type="button"
              className="feed-boost-chip"
              onClick={() => postPrompt("")}
            >
              <i className="fas fa-camera" /> First photo
            </button>
            <button
              type="button"
              className="feed-boost-chip"
              onClick={() =>
                window.dispatchEvent(new CustomEvent("openAIAgent"))
              }
            >
              <i className="fas fa-magic" /> Try the AI agent
            </button>
            <Link to="/ludo-game" className="feed-boost-chip">
              <i className="fas fa-dice" /> Play Ludo
            </Link>
          </div>
          <p className="feed-boost-hint">Long-press the logo anytime to talk to the agent.</p>
        </section>
      )}

      {showPeople && (
        <section className="feed-boost-card">
          <p className="feed-boost-kicker">People you may know</p>
          <h3>Find someone to follow</h3>
          <div className="feed-boost-people">
            {suggestions.map((person) => {
              const name =
                `${person.user?.firstName || ""} ${person.user?.surname || ""}`.trim() ||
                person.fullName ||
                "User";
              return (
                <Link
                  key={person._id}
                  to={`/${person._id}/`}
                  className="feed-boost-person"
                >
                  <span
                    className="feed-boost-avatar"
                    style={{
                      backgroundImage: person.profilePic
                        ? `url(${person.profilePic})`
                        : undefined,
                    }}
                  />
                  <span className="feed-boost-person-name">{name}</span>
                </Link>
              );
            })}
          </div>
          <Link to="/friends/suggestions" className="feed-boost-link">
            See all suggestions
          </Link>
        </section>
      )}

      {showWeek && (
        <section className="feed-boost-card">
          <button
            type="button"
            className="feed-boost-dismiss"
            aria-label="Hide this week"
            onClick={() => dismiss(weekCardKey(), setWeekHidden)}
          >
            <i className="far fa-times" />
          </button>
          <p className="feed-boost-kicker">Your week</p>
          <h3>Worth sharing?</h3>
          <ul className="feed-boost-list">
            {streakHabits.map((habit) => (
              <li key={habit.id}>
                <span>
                  {habit.name} — {habit.streak}-day streak
                </span>
                <button
                  type="button"
                  className="feed-boost-mini"
                  onClick={() =>
                    postPrompt(
                      `I'm on a ${habit.streak}-day streak with ${habit.name}.`,
                    )
                  }
                >
                  Share
                </button>
              </li>
            ))}
            {(digest?.upcomingEvents || []).slice(0, 2).map((event) => (
              <li key={event._id}>
                <span>Upcoming: {event.title}</span>
                <button
                  type="button"
                  className="feed-boost-mini"
                  onClick={() => postPrompt(`Looking forward to ${event.title}.`)}
                >
                  Share
                </button>
              </li>
            ))}
            {Number(digest?.notesThisWeek) > 0 && (
              <li>
                <span>{digest.notesThisWeek} notes updated this week</span>
                <Link to="/notes" className="feed-boost-mini">
                  Open
                </Link>
              </li>
            )}
          </ul>
        </section>
      )}

      {showRecap && (
        <section className="feed-boost-card feed-boost-card--recap">
          <button
            type="button"
            className="feed-boost-dismiss"
            aria-label="Hide weekly recap"
            onClick={() => dismiss(recapKey(), setRecapHidden)}
          >
            <i className="far fa-times" />
          </button>
          <p className="feed-boost-kicker">Private recap</p>
          <h3>Your week on Connect</h3>
          <p className="feed-boost-stats">
            {digest.postsThisWeek || 0} posts · {digest.reactsReceived || 0} reacts ·{" "}
            {digest.commentsReceived || 0} comments
          </p>
          {digest.topFriendPost?.caption ? (
            <p className="feed-boost-hint">
              Friends are talking about: “{String(digest.topFriendPost.caption).slice(0, 80)}”
            </p>
          ) : null}
          <button
            type="button"
            className="feed-boost-cta"
            onClick={() =>
              postPrompt(
                `This week I posted ${digest.postsThisWeek || 0} times and got ${digest.reactsReceived || 0} reacts.`,
              )
            }
          >
            Share a highlight
          </button>
        </section>
      )}
    </div>
  );
};

export default FeedBoostCards;

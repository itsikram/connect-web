import React, {
  Fragment,
  useState,
  useEffect,
  useCallback,
  useMemo,
  useRef,
} from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import api from "../../api/api";
import UserPP from "../../components/UserPP";
import useIsMobile from "../../utils/useIsMobile";
import AppMenuModal from "./AppMenuModal";
import AIAgentModal from "../../components/modal/AIAgentModal/AIAgentModal";
import config from "../../config/config.json";

const RECENT_SEARCH_KEY = "headerRecentSearches";
const MAX_RECENT_SEARCHES = 8;
const MAX_RESULTS_PER_SECTION = 5;
const SEARCH_DEBOUNCE_MS = 280;
const MIN_QUERY_LENGTH = 1;

const emptySearchData = { users: [], posts: [], videos: [] };

const escapeRegExp = (value) =>
  String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const loadRecentSearches = () => {
  try {
    const stored = localStorage.getItem(RECENT_SEARCH_KEY);
    const parsed = stored ? JSON.parse(stored) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const persistRecentSearches = (items) => {
  try {
    localStorage.setItem(RECENT_SEARCH_KEY, JSON.stringify(items));
  } catch {
    // Ignore quota / private-mode failures.
  }
};

const getDisplayName = (profile) =>
  profile?.fullName ||
  profile?.displayName ||
  profile?.nickname ||
  profile?.username ||
  "Unknown";

const truncateText = (text, wordCount = 8) => {
  if (!text) return "";
  const words = String(text).trim().split(/\s+/);
  if (words.length <= wordCount) return words.join(" ");
  return `${words.slice(0, wordCount).join(" ")}…`;
};

const HighlightMatch = ({ text, query }) => {
  const value = String(text || "");
  const q = String(query || "").trim();
  if (!value || !q) return value;

  const parts = value.split(new RegExp(`(${escapeRegExp(q)})`, "gi"));
  return parts.map((part, index) =>
    part.toLowerCase() === q.toLowerCase() ? (
      <mark key={`${part}-${index}`} className="search-highlight">
        {part}
      </mark>
    ) : (
      <Fragment key={`${part}-${index}`}>{part}</Fragment>
    ),
  );
};

const buildFlatResults = (data) => {
  const users = (data?.users || []).slice(0, MAX_RESULTS_PER_SECTION).map((item) => ({
    id: `user-${item._id}`,
    type: "user",
    label: getDisplayName(item),
    sublabel: item.username
      ? `@${item.username}`
      : item.nickname || "Profile",
    url: `/${item._id}`,
    profilePic: item.profilePic,
    profileId: item._id,
  }));

  const videos = (data?.videos || []).slice(0, MAX_RESULTS_PER_SECTION).map((item) => ({
    id: `video-${item._id}`,
    type: "video",
    label: truncateText(item.caption) || "Untitled video",
    sublabel: item.author ? getDisplayName(item.author) : "Video",
    url: `/watch/${item._id}`,
    profilePic: item.author?.profilePic,
    profileId: item.author?._id,
  }));

  const posts = (data?.posts || []).slice(0, MAX_RESULTS_PER_SECTION).map((item) => ({
    id: `post-${item._id}`,
    type: "post",
    label: truncateText(item.caption) || "Untitled post",
    sublabel: item.author ? getDisplayName(item.author) : "Post",
    url: `/post/${item._id}`,
    profilePic: item.author?.profilePic,
    profileId: item.author?._id,
  }));

  return [...users, ...videos, ...posts];
};

const resultTypeMeta = {
  user: { icon: "fal fa-user", label: "Profile" },
  video: { icon: "fal fa-video", label: "Video" },
  post: { icon: "fal fa-file-alt", label: "Post" },
};

let HeaderLeft = () => {
  let [searchedData, setSearchedData] = useState(emptySearchData);
  let [isSearchOpen, setIsSearchOpen] = useState(false);
  let [mobileSearchMenu, setMobileSearchMenu] = useState(false);
  let [isAppMenuOpen, setIsAppMenuOpen] = useState(false);
  let [isAIAgentModalOpen, setIsAIAgentModalOpen] = useState(false);
  let [searchQuery, setSearchQuery] = useState("");
  let [isSearching, setIsSearching] = useState(false);
  let [searchError, setSearchError] = useState("");
  let [activeResultIndex, setActiveResultIndex] = useState(-1);
  let [recentSearches, setRecentSearches] = useState(loadRecentSearches);
  let location = useLocation();
  let isMobile = useIsMobile();
  let navigate = useNavigate();
  const longPressTimerRef = useRef(null);
  const longPressTriggeredRef = useRef(false);
  const searchRootRef = useRef(null);
  const searchInputRef = useRef(null);
  const searchAbortRef = useRef(null);
  const resultItemRefs = useRef([]);

  useEffect(() => {
    setIsAppMenuOpen(false);
  }, [location]);

  const closeSearch = useCallback(() => {
    searchAbortRef.current?.abort();
    setIsSearching(false);
    setIsSearchOpen(false);
    setMobileSearchMenu(false);
    setActiveResultIndex(-1);
    setSearchError("");
    searchInputRef.current?.blur();
  }, []);

  const openSearch = useCallback(() => {
    setIsSearchOpen(true);
    if (isMobile) setMobileSearchMenu(true);
    const focusInput = () => searchInputRef.current?.focus();
    requestAnimationFrame(() => {
      focusInput();
      requestAnimationFrame(focusInput);
    });
  }, [isMobile]);

  useEffect(() => {
    if (!isMobile || !isSearchOpen) return undefined;

    const syncSearchViewport = () => {
      const viewport = window.visualViewport;
      const top = viewport?.offsetTop ?? 0;
      const height = viewport?.height ?? window.innerHeight;
      document.documentElement.style.setProperty("--search-vv-top", `${top}px`);
      document.documentElement.style.setProperty("--search-vvh", `${height}px`);
    };

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    document.body.classList.add("header-search-open");
    syncSearchViewport();

    window.visualViewport?.addEventListener("resize", syncSearchViewport);
    window.visualViewport?.addEventListener("scroll", syncSearchViewport);
    window.addEventListener("resize", syncSearchViewport);

    return () => {
      document.body.style.overflow = previousOverflow;
      document.body.classList.remove("header-search-open");
      document.documentElement.style.removeProperty("--search-vv-top");
      document.documentElement.style.removeProperty("--search-vvh");
      window.visualViewport?.removeEventListener("resize", syncSearchViewport);
      window.visualViewport?.removeEventListener("scroll", syncSearchViewport);
      window.removeEventListener("resize", syncSearchViewport);
    };
  }, [isMobile, isSearchOpen]);

  useEffect(() => {
    closeSearch();
  }, [location.pathname, closeSearch]);

  const clearLogoLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  }, []);

  const handleOpenAIAgent = useCallback(() => {
    setIsAIAgentModalOpen(true);
  }, []);

  const startLogoLongPress = useCallback(
    (event) => {
      if (event?.button !== undefined && event.button !== 0) return;

      longPressTriggeredRef.current = false;
      clearLogoLongPressTimer();
      longPressTimerRef.current = setTimeout(() => {
        longPressTriggeredRef.current = true;
        handleOpenAIAgent();
        clearLogoLongPressTimer();
      }, 500);
    },
    [clearLogoLongPressTimer, handleOpenAIAgent],
  );

  const handleLogoMouseDown = (event) => {
    startLogoLongPress(event);
  };

  const handleLogoMouseUp = () => {
    clearLogoLongPressTimer();
  };

  const handleLogoMouseLeave = () => {
    clearLogoLongPressTimer();
  };

  const handleLogoTouchStart = (event) => {
    startLogoLongPress(event);
  };

  const handleLogoTouchEnd = (event) => {
    clearLogoLongPressTimer();
    if (!longPressTriggeredRef.current) return;

    event.preventDefault();
    event.stopPropagation();
  };

  const handleLogoTouchMove = () => {
    clearLogoLongPressTimer();
  };

  const handleLogoTouchCancel = () => {
    clearLogoLongPressTimer();
  };

  const handleLogoClick = (event) => {
    if (!longPressTriggeredRef.current) return;

    event.preventDefault();
    event.stopPropagation();
    longPressTriggeredRef.current = false;
  };

  const handleLogoContextMenu = (event) => {
    event.preventDefault();
  };

  const handleLogoDragStart = (event) => {
    event.preventDefault();
  };

  useEffect(() => {
    return () => {
      clearLogoLongPressTimer();
      searchAbortRef.current?.abort();
    };
  }, [clearLogoLongPressTimer]);

  let headerMMClick = () => {
    setIsAppMenuOpen((open) => !open);
  };
  let MenuButton = () => {
    return (
      <Fragment>
        <button
          type="button"
          onClick={headerMMClick}
          className={`header-mm-button ${isAppMenuOpen ? "active" : ""}`}
          aria-label={isAppMenuOpen ? "Close apps menu" : "Open apps menu"}
          aria-expanded={isAppMenuOpen}
          style={{
            lineHeight: 1,
            border: "none",
            background: "transparent",
            padding: 0,
          }}
        >
          <i className="fas fa-th" aria-hidden="true" />
        </button>
      </Fragment>
    );
  };

  const trimmedQuery = searchQuery.trim();
  const liveResults = useMemo(
    () => buildFlatResults(searchedData),
    [searchedData],
  );
  const showingRecents = isSearchOpen && !trimmedQuery && recentSearches.length > 0;
  const keyboardItems = showingRecents ? recentSearches : liveResults;

  const saveRecentSearch = useCallback((item) => {
    if (!item?.url) return;
    setRecentSearches((prev) => {
      const next = [
        item,
        ...prev.filter((entry) => entry.id !== item.id && entry.url !== item.url),
      ].slice(0, MAX_RECENT_SEARCHES);
      persistRecentSearches(next);
      return next;
    });
  }, []);

  const removeRecentSearch = useCallback((id, event) => {
    event?.stopPropagation();
    event?.preventDefault();
    setRecentSearches((prev) => {
      const next = prev.filter((entry) => entry.id !== id);
      persistRecentSearches(next);
      return next;
    });
  }, []);

  const clearRecentSearches = useCallback((event) => {
    event?.stopPropagation();
    setRecentSearches([]);
    persistRecentSearches([]);
  }, []);

  const goToSearchItem = useCallback(
    (item) => {
      if (!item?.url) return;
      saveRecentSearch(item);
      setSearchQuery("");
      setSearchedData(emptySearchData);
      closeSearch();
      navigate(item.url);
    },
    [closeSearch, navigate, saveRecentSearch],
  );

  useEffect(() => {
    if (!isSearchOpen) return undefined;

    const onPointerDown = (event) => {
      if (!searchRootRef.current?.contains(event.target)) {
        closeSearch();
      }
    };

    document.addEventListener("mousedown", onPointerDown);
    document.addEventListener("touchstart", onPointerDown);
    return () => {
      document.removeEventListener("mousedown", onPointerDown);
      document.removeEventListener("touchstart", onPointerDown);
    };
  }, [isSearchOpen, closeSearch]);

  useEffect(() => {
    const q = trimmedQuery;
    if (!isSearchOpen) return undefined;

    if (q.length < MIN_QUERY_LENGTH) {
      searchAbortRef.current?.abort();
      setSearchedData(emptySearchData);
      setIsSearching(false);
      setSearchError("");
      setActiveResultIndex(-1);
      return undefined;
    }

    setIsSearching(true);
    setSearchError("");
    setActiveResultIndex(-1);

    const timeoutId = setTimeout(async () => {
      searchAbortRef.current?.abort();
      const controller = new AbortController();
      searchAbortRef.current = controller;

      try {
        const searchResult = await api.get("search/", {
          params: { input: q },
          signal: controller.signal,
        });

        if (searchResult.status === 200) {
          const data = searchResult.data || {};
          setSearchedData({
            users: Array.isArray(data.users) ? data.users : [],
            posts: Array.isArray(data.posts) ? data.posts : [],
            videos: Array.isArray(data.videos) ? data.videos : [],
          });
        }
      } catch (error) {
        if (error?.code === "ERR_CANCELED" || error?.name === "CanceledError") {
          return;
        }
        setSearchedData(emptySearchData);
        setSearchError("Couldn't load results. Try again.");
      } finally {
        if (!controller.signal.aborted) {
          setIsSearching(false);
        }
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => {
      clearTimeout(timeoutId);
    };
  }, [trimmedQuery, isSearchOpen]);

  useEffect(() => {
    if (activeResultIndex < 0) return;
    resultItemRefs.current[activeResultIndex]?.scrollIntoView({
      block: "nearest",
    });
  }, [activeResultIndex]);

  const handleSearchFocus = () => {
    setIsSearchOpen(true);
    if (isMobile) setMobileSearchMenu(true);
  };

  const handleSearchIconClick = () => {
    if (isSearchOpen && isMobile) {
      closeSearch();
      return;
    }
    openSearch();
  };

  const handleBackButtonClick = () => {
    if (trimmedQuery) {
      setSearchQuery("");
      setSearchedData(emptySearchData);
      searchInputRef.current?.focus();
      return;
    }
    closeSearch();
  };

  const handleClearQuery = (event) => {
    event.preventDefault();
    event.stopPropagation();
    setSearchQuery("");
    setSearchedData(emptySearchData);
    setActiveResultIndex(-1);
    searchInputRef.current?.focus();
  };

  const handleSearchKeyDown = (event) => {
    if (event.key === "Escape") {
      event.preventDefault();
      if (trimmedQuery) {
        setSearchQuery("");
        setSearchedData(emptySearchData);
        setActiveResultIndex(-1);
        return;
      }
      closeSearch();
      return;
    }

    if (!keyboardItems.length) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveResultIndex((prev) =>
        prev < keyboardItems.length - 1 ? prev + 1 : 0,
      );
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveResultIndex((prev) =>
        prev > 0 ? prev - 1 : keyboardItems.length - 1,
      );
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const item =
        activeResultIndex >= 0
          ? keyboardItems[activeResultIndex]
          : keyboardItems[0];
      if (item) goToSearchItem(item);
    }
  };

  const hasAnyLiveResults = liveResults.length > 0;
  const showResultsPanel =
    isSearchOpen &&
    (showingRecents ||
      Boolean(trimmedQuery) ||
      isSearching ||
      Boolean(searchError));

  const renderResultItem = (item, index, { isRecent = false } = {}) => {
    const meta = resultTypeMeta[item.type] || resultTypeMeta.user;
    const isActive = index === activeResultIndex;

    return (
      <li
        key={item.id || `${item.url}-${index}`}
        id={`header-search-option-${index}`}
        className={`search-result-item ${isActive ? "is-active" : ""}`}
        role="option"
        aria-selected={isActive}
        ref={(node) => {
          resultItemRefs.current[index] = node;
        }}
        onMouseEnter={() => setActiveResultIndex(index)}
        onMouseDown={(event) => event.preventDefault()}
        onClick={() => goToSearchItem(item)}
      >
        <div className="item-container">
          <div className="user-profile-pic">
            {item.profilePic ? (
              <UserPP profilePic={item.profilePic} profile={item.profileId} />
            ) : (
              <div className="search-result-fallback-icon">
                <i className={meta.icon} aria-hidden="true" />
              </div>
            )}
          </div>
          <div className="search-result-copy">
            <div className="user-details">
              <HighlightMatch text={item.label} query={trimmedQuery} />
            </div>
            <div className="search-result-sublabel">
              <i className={meta.icon} aria-hidden="true" />
              <span>
                {isRecent ? `Recent · ${meta.label}` : item.sublabel}
              </span>
            </div>
          </div>
          {isRecent && (
            <button
              type="button"
              className="search-recent-remove"
              aria-label={`Remove ${item.label} from recent searches`}
              onMouseDown={(event) => event.preventDefault()}
              onClick={(event) => removeRecentSearch(item.id, event)}
            >
              <i className="fal fa-times" aria-hidden="true" />
            </button>
          )}
        </div>
      </li>
    );
  };

  // Close app menu when AI agent modal opens
  useEffect(() => {
    if (isAIAgentModalOpen) {
      setIsAppMenuOpen(false);
    }
  }, [isAIAgentModalOpen]);

  return (
    <Fragment>
      <div
        className={`header-left ${isSearchOpen ? "header-search-active" : ""}`}
        ref={searchRootRef}
      >
        <div
          className="header-logo-container"
          onMouseDown={handleLogoMouseDown}
          onMouseUp={handleLogoMouseUp}
          onMouseLeave={handleLogoMouseLeave}
          onTouchStart={handleLogoTouchStart}
          onTouchEnd={handleLogoTouchEnd}
          onTouchMove={handleLogoTouchMove}
          onTouchCancel={handleLogoTouchCancel}
          onContextMenu={handleLogoContextMenu}
          title="Long press for AI Agent"
          style={{
            userSelect: "none",
            WebkitUserSelect: "none",
            position: "relative",
          }}
        >
          <Link
            to="/"
            onClick={handleLogoClick}
            onDragStart={handleLogoDragStart}
            onContextMenu={handleLogoContextMenu}
            style={{
              userSelect: "none",
              WebkitUserSelect: "none",
              WebkitTouchCallout: "none",
              WebkitUserDrag: "none",
              touchAction: "manipulation",
            }}
          >
            <img
              className="header-logo"
              src={config?.logo}
              alt="logo"
              draggable={false}
              style={{
                userSelect: "none",
                WebkitUserSelect: "none",
                WebkitTouchCallout: "none",
                WebkitUserDrag: "none",
              }}
            ></img>
          </Link>
          <div
            style={{
              position: "absolute",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              pointerEvents: "none",
            }}
            aria-hidden="true"
          />
        </div>

        <div className="header-app-menu-container">
          <MenuButton />
        </div>
        <AppMenuModal
          isOpen={isAppMenuOpen}
          onRequestClose={() => setIsAppMenuOpen(false)}
          onAIAgentOpen={() => {
            handleOpenAIAgent();
          }}
        />
        <AIAgentModal
          isOpen={isAIAgentModalOpen}
          onClose={() => setIsAIAgentModalOpen(false)}
        />
        <div className="header-search-back-container">
          <button
            type="button"
            className="header-search-back-icon"
            onClick={handleBackButtonClick}
            aria-label={trimmedQuery ? "Clear search" : "Close search"}
          >
            <i className="fal fa-arrow-left" aria-hidden="true" />
          </button>
        </div>
        {isMobile && isSearchOpen && (
          <button
            type="button"
            className="header-search-backdrop"
            aria-label="Close search"
            onClick={closeSearch}
          />
        )}
        <div
          className={`header-search-container ${mobileSearchMenu ? "active-mobile" : ""} ${isSearchOpen ? "is-expanded" : ""}`}
        >
          {isMobile && isSearchOpen && (
            <button
              type="button"
              className="header-search-inline-back"
              onClick={handleBackButtonClick}
              aria-label={trimmedQuery ? "Clear search" : "Close search"}
            >
              <i className="fal fa-arrow-left" aria-hidden="true" />
            </button>
          )}
          <button
            type="button"
            className="header-search-icon-button"
            onClick={handleSearchIconClick}
            aria-label={isMobile && !isSearchOpen ? "Open search" : "Search"}
          >
            {isSearching ? (
              <i className="fal fa-circle-notch fa-spin header-search-icon" aria-hidden="true" />
            ) : (
              <i className="fal fa-search header-search-icon" aria-hidden="true" />
            )}
          </button>
          <div className="header-search-input-wrap">
            <input
              ref={searchInputRef}
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={handleSearchFocus}
              onKeyDown={handleSearchKeyDown}
              id="header-search"
              type="search"
              inputMode="search"
              enterKeyHint="search"
              placeholder={isMobile ? "Search" : "Search people, posts, videos"}
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="none"
              spellCheck={false}
              role="combobox"
              aria-autocomplete="list"
              aria-expanded={showResultsPanel}
              aria-controls="header-search-results"
              aria-activedescendant={
                activeResultIndex >= 0
                  ? `header-search-option-${activeResultIndex}`
                  : undefined
              }
            />
            {trimmedQuery && (
              <button
                type="button"
                className="header-search-clear"
                onMouseDown={(event) => event.preventDefault()}
                onClick={handleClearQuery}
                aria-label="Clear search"
              >
                <i className="fal fa-times" aria-hidden="true" />
              </button>
            )}
          </div>

          {showResultsPanel && (
            <div
              className="header-search-results"
              id="header-search-results"
              role="listbox"
              onMouseDown={(event) => event.preventDefault()}
            >
              {showingRecents && (
                <div className="search-results-section">
                  <div className="search-results-heading">
                    <h3 className="search-result-title">Recent</h3>
                    <button
                      type="button"
                      className="search-results-action"
                      onClick={clearRecentSearches}
                    >
                      Clear all
                    </button>
                  </div>
                  <ul className="search-results-list-container">
                    {recentSearches.map((item, index) =>
                      renderResultItem(item, index, { isRecent: true }),
                    )}
                  </ul>
                </div>
              )}

              {!trimmedQuery && !showingRecents && (
                <div className="search-empty-hint">
                  <i className="fal fa-search" aria-hidden="true" />
                  <p>Search for people, posts, or videos</p>
                </div>
              )}

              {Boolean(trimmedQuery) && isSearching && !hasAnyLiveResults && (
                <div className="search-loading-state">
                  <i className="fal fa-circle-notch fa-spin" aria-hidden="true" />
                  <p>Searching…</p>
                </div>
              )}

              {Boolean(trimmedQuery) && searchError && !isSearching && (
                <div className="search-no-results">
                  <i className="fal fa-exclamation-circle" aria-hidden="true" />
                  <p>{searchError}</p>
                </div>
              )}

              {Boolean(trimmedQuery) &&
                !isSearching &&
                !searchError &&
                !hasAnyLiveResults && (
                  <div className="search-no-results">
                    <i className="fal fa-search" aria-hidden="true" />
                    <p>
                      No results for <strong>{trimmedQuery}</strong>
                    </p>
                    <span>Try a different name or keyword</span>
                  </div>
                )}

              {Boolean(trimmedQuery) &&
                searchedData.users &&
                searchedData.users.length > 0 && (
                  <div className="search-results-section search-results-user">
                    <h3 className="search-result-title">
                      <i className="fal fa-user" aria-hidden="true" />
                      People
                    </h3>
                    <ul className="search-results-list-container">
                      {liveResults
                        .filter((item) => item.type === "user")
                        .map((item) =>
                          renderResultItem(
                            item,
                            keyboardItems.findIndex((entry) => entry.id === item.id),
                          ),
                        )}
                    </ul>
                  </div>
                )}

              {Boolean(trimmedQuery) &&
                searchedData.videos &&
                searchedData.videos.length > 0 && (
                  <div className="search-results-section search-results-videos">
                    <h3 className="search-result-title">
                      <i className="fal fa-video" aria-hidden="true" />
                      Videos
                    </h3>
                    <ul className="search-results-list-container">
                      {liveResults
                        .filter((item) => item.type === "video")
                        .map((item) =>
                          renderResultItem(
                            item,
                            keyboardItems.findIndex((entry) => entry.id === item.id),
                          ),
                        )}
                    </ul>
                  </div>
                )}

              {Boolean(trimmedQuery) &&
                searchedData.posts &&
                searchedData.posts.length > 0 && (
                  <div className="search-results-section search-results-posts">
                    <h3 className="search-result-title">
                      <i className="fal fa-file-alt" aria-hidden="true" />
                      Posts
                    </h3>
                    <ul className="search-results-list-container">
                      {liveResults
                        .filter((item) => item.type === "post")
                        .map((item) =>
                          renderResultItem(
                            item,
                            keyboardItems.findIndex((entry) => entry.id === item.id),
                          ),
                        )}
                    </ul>
                  </div>
                )}
            </div>
          )}
        </div>
      </div>
    </Fragment>
  );
};

export default HeaderLeft;

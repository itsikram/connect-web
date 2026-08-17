import React, { Fragment, useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from 'react-router-dom';
import $ from 'jquery';
import api from "../../api/api";
import UserPP from "../../components/UserPP";
import useIsMobile from "../../utils/useIsMobile";
import AppMenuModal from "./AppMenuModal";
import config from "../../config/config.json";

let HeaderLeft = ({ onAIAgentOpen }) => {
  let [searchedData, setSearchedData] = useState([])
  let [hasSearchResult, setHasSearchResult] = useState(false)
  let [mobileSearchMenu, setMobileSearchMenu] = useState(false)
  let [isAppMenuOpen, setIsAppMenuOpen] = useState(false);
  let [searchQuery, setSearchQuery] = useState('')
  let location = useLocation();
  let isMobile = useIsMobile();
  let navigate = useNavigate();
  let longPressTimer = null;
  useEffect(() => {
    setIsAppMenuOpen(false)
  }, [location])

  const handleLogoMouseDown = () => {
    longPressTimer = setTimeout(() => {
      onAIAgentOpen();
    }, 500); // 500ms long press
  };

  const handleLogoMouseUp = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const handleLogoMouseLeave = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  const handleLogoTouchStart = () => {
    longPressTimer = setTimeout(() => {
      onAIAgentOpen();
    }, 500);
  };

  const handleLogoTouchEnd = () => {
    if (longPressTimer) {
      clearTimeout(longPressTimer);
      longPressTimer = null;
    }
  };

  let headerMMClick = () => {
    setIsAppMenuOpen((open) => !open)
  }
  let MenuButton = () => {
    return (
      <Fragment>
        <button
          type="button"
          onClick={headerMMClick}
          className={`header-mm-button ${isAppMenuOpen ? 'active' : ''}`}
          aria-label={isAppMenuOpen ? 'Close apps menu' : 'Open apps menu'}
          aria-expanded={isAppMenuOpen}
          style={{ lineHeight: 1, border: 'none', background: 'transparent', padding: 0 }}
        >
          <i className="fas fa-th" aria-hidden="true" />
        </button>
      </Fragment>
    )
  }

  const useMediaQuery = (query) => {
    const [matches, setMatches] = useState(window.matchMedia(query).matches);

    useEffect(() => {
      const media = window.matchMedia(query);
      const listener = (e) => setMatches(e.matches);
      media.addEventListener("change", listener);
      return () => media.removeEventListener("change", listener);
    }, [query]);

    return matches;
  };

  let onSearchFocus = () => {

    if (!isMobile) {
      $('.header-search-icon, .header-logo').hide();
      $('.header-search-back-container').fadeIn('slow')
      $('.header-search-icon, .header-logo-container').animate({
        left: '-10px',
        opacity: 0,
      }, 'fast');
      $('#header-search').css({
        width: '100%',
        display: 'block'
      })
    }


  }

  let onSearchFocusOut = () => {

    if (!isMobile) {

      $('.header-search-back-container').hide()
      $('.header-search-icon, .header-logo-container').animate({
        left: '0',
        opacity: 1
      }, 'fast');
      $('.header-search-icon, .header-logo').fadeIn();
      $('#header-search').css({
        width: 'auto',
        display: 'block'
      })
      // if(isMobile) {
      //   $('.header-search-icon').css('display', 'block !important');
      // }
    }
    // setMobileSearchMenu(false)
    // setSearchedUsers([])
    // setSearchQuery('')
    if(searchQuery.length > 0) {
        return  setHasSearchResult(true)

    }
    setHasSearchResult(false)


  }

  let handleKeyUp = async (e) => {
    if (searchQuery.length > 0) {
      let searchResult = await api.get('search/', {
        params: {
          input: searchQuery
        }
      })
      if (searchResult.status === 200) {
        console.log('data', searchResult.data)
        setSearchedData(searchResult.data)
        setHasSearchResult(searchResult.data.users !== null || searchResult.data.posts !== null || searchResult.data.videos !== null)
      }
    } else {
      setSearchedData([])
      setHasSearchResult(false)

    }

  }

  let headerSearchIcon = (e) => {
    if (isMobile) {
      setMobileSearchMenu(!mobileSearchMenu)
      onSearchFocus()
    }
  }

  let handleBackButtonClick = (e) => {
    setMobileSearchMenu(false)
  }

  let goToItem = useCallback(e => {
    navigate(e.currentTarget.dataset.url)
  }, [])

  function truncateToFourWords(text) {
  return text.split(/\s+/).slice(0, 4).join(' ');
}

  return (
    <Fragment>
      <div className="header-left">
        <div className="header-logo-container"
          onMouseDown={handleLogoMouseDown}
          onMouseUp={handleLogoMouseUp}
          onMouseLeave={handleLogoMouseLeave}
          onTouchStart={handleLogoTouchStart}
          onTouchEnd={handleLogoTouchEnd}
          title="Long press for AI Agent"
        >
          <Link to="/">
            <img className="header-logo" src={config?.logo} alt="logo" style={{ userSelect: 'none' }}></img>
          </Link>

        </div>

        <div className="header-app-menu-container">
          <MenuButton />
        </div>
        <AppMenuModal
          isOpen={isAppMenuOpen}
          onRequestClose={() => setIsAppMenuOpen(false)}
        />
        <div className="header-search-back-container">
          <i onClick={handleBackButtonClick} className="fal fa-arrow-left header-search-back-icon"></i>
        </div>
        <div className={`header-search-container ${mobileSearchMenu == true ? 'active-mobile' : ''}`}>

          <i className="fal fa-search header-search-icon" onClick={headerSearchIcon.bind(this)}></i>
          <input value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value) }} onBlur={onSearchFocusOut} onFocus={onSearchFocus} onKeyUp={handleKeyUp.bind(this)} id="header-search" type="search" placeholder="Search ICS"></input>

          {hasSearchResult && (<>
            <div className="header-search-results">

              {/* Show empty state if no results */}
              {(!searchedData.users || searchedData.users.length === 0) && 
               (!searchedData.videos || searchedData.videos.length === 0) && 
               (!searchedData.posts || searchedData.posts.length === 0) && (
                <div className="search-no-results">
                  <i className="fal fa-search" style={{ fontSize: '48px', opacity: 0.3, marginBottom: '12px' }}></i>
                  <p style={{ opacity: 0.6, margin: 0 }}>No results found</p>
                </div>
              )}

              {searchedData.users && searchedData.users.length > 0 && (
                <div className="search-results-user">
                  <h3 className="search-result-title">
                    <i className="fal fa-user" style={{ marginRight: '8px', opacity: 0.7 }}></i>
                    Users
                  </h3>
                  <ul className="search-results-list-container">
                    {searchedData.users.map((item, index) => (
                      <li className="search-result-item" key={index} onClick={() => { setHasSearchResult(false); setMobileSearchMenu(false) }}>
                        <div className="item-container" data-url={`/${item._id}`} onClick={goToItem.bind(this)}>
                          <div className="user-profile-pic">
                            <UserPP profilePic={item.profilePic} profile={item._id}></UserPP>
                          </div>
                          <div className="user-details">
                            {item.fullName}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {searchedData.videos && searchedData.videos.length > 0 && (
                <div className="search-results-videos">
                  <h3 className="search-result-title">
                    <i className="fal fa-video" style={{ marginRight: '8px', opacity: 0.7 }}></i>
                    Videos
                  </h3>
                  <ul className="search-results-list-container">
                    {searchedData.videos.map((item, index) => (
                      <li className="search-result-item" key={index} onClick={() => { setHasSearchResult(false); setMobileSearchMenu(false) }}>
                        <div className="item-container" data-url={`/watch/${item._id}`} onClick={goToItem.bind(this)}>
                          <div className="user-profile-pic">
                            <UserPP profilePic={item.author.profilePic} profile={item.author._id}></UserPP>
                          </div>
                          <div className="user-details">
                            {truncateToFourWords(item.caption)}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

              {searchedData.posts && searchedData.posts.length > 0 && (
                <div className="search-results-posts">
                  <h3 className="search-result-title">
                    <i className="fal fa-file-alt" style={{ marginRight: '8px', opacity: 0.7 }}></i>
                    Posts
                  </h3>
                  <ul className="search-results-list-container">
                    {searchedData.posts.map((item, index) => (
                      <li className="search-result-item" key={index} onClick={() => { setHasSearchResult(false); setMobileSearchMenu(false) }}>
                        <div className="item-container" data-url={`/post/${item._id}`} onClick={goToItem.bind(this)}>
                          <div className="user-profile-pic">
                            <UserPP profilePic={item.author.profilePic} profile={item.author._id}></UserPP>
                          </div>
                          <div className="user-details">
                            {truncateToFourWords(item.caption)}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                </div>
              )}

            </div>
          </>
          )}

        </div>

      </div>
    </Fragment>
  )
}

export default HeaderLeft;
import React, { Fragment, useState, useEffect, useCallback } from "react";
import { Link, useLocation, useNavigate } from 'react-router-dom';
import $ from 'jquery';
import api from "../../api/api";
import UserPP from "../../components/UserPP";
import Ls from "../sidebar/Ls";
import useIsMobile from "../../utils/useIsMobile";
import MegaMC from "../../components/MegaMC";
const logo_src = 'https://programmerikram.com/wp-content/uploads/2025/05/ics_logo.png';


let HeaderLeft = () => {
  let [searchedData, setSearchedData] = useState([])
  let [hasSearchResult, setHasSearchResult] = useState(false)
  let [mobileSearchMenu, setMobileSearchMenu] = useState(false)
  let [isMegaMenu, setIsMegaMenu] = useState(false);
  let [searchQuery, setSearchQuery] = useState('')
  let location = useLocation();
  let isMobile = useIsMobile();
  let navigate = useNavigate();
  useEffect(() => {
    setIsMegaMenu(false)
  }, [location])

  let headerMMClick = (e) => {
    setIsMegaMenu(!isMegaMenu)
  }
  let MenuButton = () => {
    return (
      <Fragment>
        <div onClick={headerMMClick} className="header-mm-button" style={{ lineHeight: 1 }}>
          <i className="fa fa-bars"></i>
        </div>
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
        <div className="header-logo-container">
          <Link to="/">
            <img className="header-logo" src={logo_src} alt="logo"></img>
          </Link>

        </div>

        <div className="header-mobile-menu-button-container">
          {isMobile && <MenuButton />}
          {
            isMegaMenu && (
              <MegaMC className="header-mm-dropdown" style={{ top: '100%', left: 0, width: '300px', zIndex: '999999', display: 'block' }}>
                <Ls />
              </MegaMC>)
          }

        </div>
        <div className="header-search-back-container">
          <i onClick={handleBackButtonClick} className="fal fa-arrow-left header-search-back-icon"></i>
        </div>
        <div className={`header-search-container ${mobileSearchMenu == true ? 'active-mobile' : ''}`}>

          <i className="fal fa-search header-search-icon" onClick={headerSearchIcon.bind(this)}></i>
          <input value={searchQuery} onChange={(e) => { setSearchQuery(e.target.value) }} onBlur={onSearchFocusOut} onFocus={onSearchFocus} onKeyUp={handleKeyUp.bind(this)} id="header-search" type="search" placeholder="Search ICS"></input>

          {hasSearchResult && (<>
            <div className="header-search-results">

              {searchedData.users.length > 0 && (<>

                <div className="search-results-user">

                  <h3 className="search-result-title">Users</h3>
                  <ul className="search-results-list-container">

                    {searchedData.users && searchedData.users.map((item, index) => {

                      return (
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
                      )

                    })}

                   

                  </ul>

                </div>

              </>)}


              {searchedData.videos.length > 0 && (<>

                <div className="search-results-videos">

                  <h3 className="search-result-title">Videos</h3>
                  <ul className="search-results-list-container">

                    {searchedData.videos && searchedData.videos.map((item, index) => {

                      return (
                        <li className="search-result-item" key={index} onClick={() => { setHasSearchResult(false); setMobileSearchMenu(false) }}>
                          <div className="item-container" data-url={`/watch/${item._id}`} onClick={goToItem.bind(this)}>
                            <div className="user-profile-pic">
                              <UserPP profilePic={item.author.profilePic} profile={item.author._id}></UserPP>
                            </div>
                            <div className="user-details fs-6">
                              {truncateToFourWords(item.caption)}

                            </div>

                          </div>
                        </li>
                      )

                    })}


                  </ul>

                </div>

              </>)}

              {searchedData.posts.length > 0 && (<>

                <div className="search-results-posts">

                  <h3 className="search-result-title">Posts</h3>
                  <ul className="search-results-list-container">

                    {searchedData.posts && searchedData.posts.map((item, index) => {

                      return (
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
                      )

                    })}


                  </ul>

                </div>

              </>)}

            </div>

          </>
          )}

        </div>

      </div>
    </Fragment>
  )
}

export default HeaderLeft;
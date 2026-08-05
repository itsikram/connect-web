import React, { Fragment, useEffect, useState } from 'react'
import { Container } from "react-bootstrap";
import MessageList from "../components/Message/MessageList";
import MessageBody from '../components/Message/MessageBody';
import MessageOptions from '../components/Message/MessageOptions.';
import './Message.css';

const Message = (props) => {
    const [isInitialLoad, setIsInitialLoad] = useState(true);
    const [showMobileNav, setShowMobileNav] = useState(false);

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
    
    const isMobile = useMediaQuery("(max-width: 768px)");

    useEffect(() => {
        const timer = setTimeout(() => setIsInitialLoad(false), 300);
        return () => clearTimeout(timer);
    }, []);

    // Fit message UI exactly under the site header on phones (iPhone 12 mini / Android).
    useEffect(() => {
        if (!isMobile) return undefined;

        const root = document.documentElement;
        const body = document.body;
        const prevOverflow = body.style.overflow;
        body.classList.add('message-page-mobile');
        body.style.overflow = 'hidden';

        const syncHeaderHeight = () => {
            const header = document.getElementById('header');
            const headerHeight = header ? Math.ceil(header.getBoundingClientRect().height) : 56;
            root.style.setProperty('--site-header-height', `${headerHeight}px`);

            // Prefer visualViewport on iOS when the browser chrome changes.
            const viewportHeight = window.visualViewport?.height || window.innerHeight;
            const available = Math.max(240, Math.floor(viewportHeight - headerHeight));
            root.style.setProperty('--message-mobile-height', `${available}px`);
        };

        syncHeaderHeight();
        window.addEventListener('resize', syncHeaderHeight);
        window.addEventListener('orientationchange', syncHeaderHeight);
        window.visualViewport?.addEventListener('resize', syncHeaderHeight);
        window.visualViewport?.addEventListener('scroll', syncHeaderHeight);

        const header = document.getElementById('header');
        const ro = typeof ResizeObserver !== 'undefined' && header
            ? new ResizeObserver(syncHeaderHeight)
            : null;
        if (header && ro) ro.observe(header);

        return () => {
            body.classList.remove('message-page-mobile');
            body.style.overflow = prevOverflow;
            window.removeEventListener('resize', syncHeaderHeight);
            window.removeEventListener('orientationchange', syncHeaderHeight);
            window.visualViewport?.removeEventListener('resize', syncHeaderHeight);
            window.visualViewport?.removeEventListener('scroll', syncHeaderHeight);
            if (ro) ro.disconnect();
        };
    }, [isMobile]);

    const handleMobileNavToggle = () => {
        setShowMobileNav(!showMobileNav);
    };

    return (
        <Fragment>
            <div className={`modern-message-container ${isInitialLoad ? 'loading' : 'loaded'}${isMobile ? ' is-mobile' : ''}`}>
                <div className="message-backdrop"></div>
                <Container
                    fluid={isMobile}
                    style={{
                        width: isMobile ? '100%' : '90%',
                        maxWidth: isMobile ? '100%' : '90%',
                        padding: 0,
                        height: '100%'
                    }}
                    className="h-100"
                >
                    <div className="modern-message-layout">
                        {/* Mobile Navigation Toggle */}
                        {isMobile && (
                            <button
                                type="button"
                                className="mobile-nav-toggle"
                                onClick={handleMobileNavToggle}
                                aria-label={showMobileNav ? 'Close conversations' : 'Open conversations'}
                            >
                                <div className="nav-toggle-btn">
                                    <div className={`hamburger ${showMobileNav ? 'active' : ''}`}>
                                        <span></span>
                                        <span></span>
                                        <span></span>
                                    </div>
                                </div>
                            </button>
                        )}

                        {/* Chat List Sidebar */}
                        <div className={`message-sidebar left-sidebar ${isMobile ? (showMobileNav ? 'mobile-active' : 'mobile-hidden') : ''}`}>
                            <div className="sidebar-content">
                                <MessageList onChatSelect={() => setShowMobileNav(false)} />
                            </div>
                        </div>

                        {/* Main Chat Area */}
                        <div className={`message-main-content ${isMobile ? 'mobile-full' : ''}`}>
                            <div className="chat-container">
                                <MessageBody cameraVideoRef={props.cameraVideoRef} />
                            </div>
                        </div>

                        {/* Media Sidebar */}
                        {!isMobile && (
                            <div className="message-sidebar right-sidebar">
                                <div className="sidebar-content">
                                    <MessageOptions />
                                </div>
                            </div>
                        )}

                        {/* Mobile Overlay */}
                        {isMobile && showMobileNav && (
                            <div className="mobile-overlay" onClick={() => setShowMobileNav(false)}></div>
                        )}
                    </div>
                </Container>
            </div>
        </Fragment>
    )
}


export default Message
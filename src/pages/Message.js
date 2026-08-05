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

    // Fit message UI to the visual viewport (critical on iPhone when the keyboard opens).
    useEffect(() => {
        const root = document.documentElement;
        const body = document.body;
        const html = document.documentElement;
        const prev = {
            bodyOverflow: body.style.overflow,
            bodyPosition: body.style.position,
            bodyWidth: body.style.width,
            bodyTop: body.style.top,
            bodyHeight: body.style.height,
            htmlOverflow: html.style.overflow,
        };

        if (isMobile) {
            body.classList.add('message-page-mobile');
            // Lock the document so iOS keyboard focus cannot scroll to a black void.
            body.style.overflow = 'hidden';
            html.style.overflow = 'hidden';
            body.style.position = 'fixed';
            body.style.width = '100%';
            body.style.top = '0';
            body.style.height = '100%';
        }

        const lockScrollTop = () => {
            if (window.scrollY || window.pageYOffset || html.scrollTop || body.scrollTop) {
                window.scrollTo(0, 0);
                html.scrollTop = 0;
                body.scrollTop = 0;
            }
        };

        const syncViewport = () => {
            const header = document.getElementById('header');
            const headerHeight = header
                ? Math.ceil(header.getBoundingClientRect().height)
                : (isMobile ? 56 : 70);
            root.style.setProperty('--site-header-height', `${headerHeight}px`);

            const vv = window.visualViewport;
            const vvHeight = vv?.height || window.innerHeight;
            const vvOffsetTop = vv?.offsetTop || 0;
            const keyboardOpen = isMobile && (window.innerHeight - vvHeight > 100);

            if (keyboardOpen) {
                // Fill the visible viewport while the keyboard is open.
                // Using vv.offsetTop keeps the shell aligned when iOS shifts the visual viewport.
                body.classList.add('message-keyboard-open');
                root.style.setProperty('--message-vv-top', `${Math.round(vvOffsetTop)}px`);
                root.style.setProperty('--message-mobile-height', `${Math.max(200, Math.floor(vvHeight))}px`);
            } else {
                body.classList.remove('message-keyboard-open');
                root.style.setProperty('--message-vv-top', `${Math.round(vvOffsetTop + headerHeight)}px`);
                root.style.setProperty(
                    '--message-mobile-height',
                    `${Math.max(240, Math.floor(vvHeight - headerHeight))}px`
                );
            }

            if (isMobile) lockScrollTop();
        };

        syncViewport();
        window.addEventListener('resize', syncViewport);
        window.addEventListener('orientationchange', syncViewport);
        window.addEventListener('focusin', syncViewport);
        window.addEventListener('focusout', syncViewport);
        window.visualViewport?.addEventListener('resize', syncViewport);
        window.visualViewport?.addEventListener('scroll', syncViewport);

        const header = document.getElementById('header');
        const ro = typeof ResizeObserver !== 'undefined' && header
            ? new ResizeObserver(syncViewport)
            : null;
        if (header && ro) ro.observe(header);

        return () => {
            body.classList.remove('message-page-mobile');
            body.classList.remove('message-keyboard-open');
            body.style.overflow = prev.bodyOverflow;
            body.style.position = prev.bodyPosition;
            body.style.width = prev.bodyWidth;
            body.style.top = prev.bodyTop;
            body.style.height = prev.bodyHeight;
            html.style.overflow = prev.htmlOverflow;
            root.style.removeProperty('--message-vv-top');
            window.removeEventListener('resize', syncViewport);
            window.removeEventListener('orientationchange', syncViewport);
            window.removeEventListener('focusin', syncViewport);
            window.removeEventListener('focusout', syncViewport);
            window.visualViewport?.removeEventListener('resize', syncViewport);
            window.visualViewport?.removeEventListener('scroll', syncViewport);
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
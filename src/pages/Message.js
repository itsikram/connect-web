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
    // Avoid chasing every visualViewport scroll tick — that causes a shake loop with iOS.
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
            window.scrollTo(0, 0);
        }

        let lastHeight = -1;
        let lastTop = -1;
        let wasKeyboardOpen = false;
        let rafId = 0;

        const applyViewport = () => {
            const header = document.getElementById('header');
            const headerHeight = header
                ? Math.ceil(header.getBoundingClientRect().height)
                : (isMobile ? 56 : 70);
            root.style.setProperty('--site-header-height', `${headerHeight}px`);

            const vv = window.visualViewport;
            const vvHeight = Math.round(vv?.height || window.innerHeight);
            // Prefer layout viewport for keyboard detection — more stable than innerHeight alone
            const layoutHeight = Math.round(window.innerHeight || vvHeight);
            const keyboardOpen = isMobile && (layoutHeight - vvHeight > 120);

            let nextTop;
            let nextHeight;

            if (keyboardOpen) {
                body.classList.add('message-keyboard-open');
                // Pin to the visible area from the top; do not chase offsetTop (causes shake).
                nextTop = 0;
                nextHeight = Math.max(200, vvHeight);
            } else {
                body.classList.remove('message-keyboard-open');
                nextTop = headerHeight;
                nextHeight = Math.max(240, vvHeight - headerHeight);
            }

            const heightDelta = Math.abs(nextHeight - lastHeight);
            const topDelta = Math.abs(nextTop - lastTop);
            const stateChanged = keyboardOpen !== wasKeyboardOpen;

            // Only rewrite CSS vars when the change is meaningful — skips animation jitter.
            if (stateChanged || heightDelta >= 16 || topDelta >= 16 || lastHeight < 0) {
                root.style.setProperty('--message-vv-top', `${nextTop}px`);
                root.style.setProperty('--message-mobile-height', `${nextHeight}px`);
                lastHeight = nextHeight;
                lastTop = nextTop;
            }

            wasKeyboardOpen = keyboardOpen;
        };

        const syncViewport = () => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(applyViewport);
        };

        applyViewport();
        window.addEventListener('resize', syncViewport);
        window.addEventListener('orientationchange', syncViewport);
        // visualViewport.resize is enough for keyboard; scroll chasing causes shake
        window.visualViewport?.addEventListener('resize', syncViewport);

        const header = document.getElementById('header');
        const ro = typeof ResizeObserver !== 'undefined' && header
            ? new ResizeObserver(syncViewport)
            : null;
        if (header && ro) ro.observe(header);

        return () => {
            if (rafId) cancelAnimationFrame(rafId);
            body.classList.remove('message-page-mobile');
            body.classList.remove('message-keyboard-open');
            body.style.overflow = prev.bodyOverflow;
            body.style.position = prev.bodyPosition;
            body.style.width = prev.bodyWidth;
            body.style.top = prev.bodyTop;
            body.style.height = prev.bodyHeight;
            html.style.overflow = prev.htmlOverflow;
            root.style.removeProperty('--message-vv-top');
            root.style.removeProperty('--message-mobile-height');
            window.removeEventListener('resize', syncViewport);
            window.removeEventListener('orientationchange', syncViewport);
            window.visualViewport?.removeEventListener('resize', syncViewport);
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
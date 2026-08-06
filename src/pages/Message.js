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
    // Do NOT chase visualViewport.offsetTop while the keyboard is open — that shrinks/shifts
    // the fixed chat shell under the keyboard after the first correct frame.
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
        let settleTimer = 0;
        let focusLockTimer = 0;
        // Baseline layout height while keyboard is closed (more reliable than innerHeight alone)
        let closedBaseline = Math.round(window.visualViewport?.height || window.innerHeight || 0);

        const lockScroll = () => {
            window.scrollTo(0, 0);
            html.scrollTop = 0;
            body.scrollTop = 0;
        };

        // iOS pans the page on focus — cancel it for a short burst so we don't bounce up then down.
        const burstLockScroll = (ms = 400) => {
            lockScroll();
            if (focusLockTimer) window.clearInterval(focusLockTimer);
            const started = Date.now();
            focusLockTimer = window.setInterval(() => {
                lockScroll();
                if (Date.now() - started > ms) {
                    window.clearInterval(focusLockTimer);
                    focusLockTimer = 0;
                }
            }, 16);
        };

        const applyViewport = (opts = {}) => {
            const settle = !!opts.settle;
            const header = document.getElementById('header');
            const headerHeight = header
                ? Math.ceil(header.getBoundingClientRect().height)
                : (isMobile ? 56 : 70);
            root.style.setProperty('--site-header-height', `${headerHeight}px`);

            const vv = window.visualViewport;
            const vvHeight = Math.round(vv?.height || window.innerHeight);
            const layoutHeight = Math.max(
                Math.round(window.innerHeight || 0),
                closedBaseline || 0
            );
            const keyboardOpen = isMobile && (
                layoutHeight - vvHeight > 120 ||
                (closedBaseline > 0 && closedBaseline - vvHeight > 120)
            );

            let nextTop;
            let nextHeight;

            if (keyboardOpen) {
                body.classList.add('message-keyboard-open');
                // Keep top under the site header — do NOT jump to 0 (that slides chat above the header).
                // Only shrink height to the visible area above the keyboard.
                nextTop = headerHeight;
                nextHeight = Math.max(180, vvHeight - headerHeight);
                lockScroll();
            } else {
                body.classList.remove('message-keyboard-open');
                closedBaseline = Math.max(closedBaseline, vvHeight, Math.round(window.innerHeight || 0));
                nextTop = headerHeight;
                nextHeight = Math.max(240, vvHeight - headerHeight);
            }

            const heightDelta = Math.abs(nextHeight - lastHeight);
            const topDelta = Math.abs(nextTop - lastTop);
            const stateChanged = keyboardOpen !== wasKeyboardOpen;

            let shouldApply = stateChanged || lastHeight < 0 || topDelta >= 1;
            if (keyboardOpen && !stateChanged) {
                if (settle) {
                    shouldApply = true;
                } else if (nextHeight > lastHeight + 8) {
                    shouldApply = true;
                } else if (nextHeight < lastHeight - 40) {
                    shouldApply = false;
                } else {
                    shouldApply = heightDelta >= 24;
                }
            } else if (!keyboardOpen) {
                shouldApply = shouldApply || heightDelta >= 8;
            }

            if (shouldApply) {
                root.style.setProperty('--message-vv-top', `${nextTop}px`);
                root.style.setProperty('--message-mobile-height', `${nextHeight}px`);
                lastHeight = nextHeight;
                lastTop = nextTop;
            }

            wasKeyboardOpen = keyboardOpen;
        };

        const syncViewport = () => {
            if (rafId) cancelAnimationFrame(rafId);
            rafId = requestAnimationFrame(() => {
                applyViewport();
                if (settleTimer) window.clearTimeout(settleTimer);
                settleTimer = window.setTimeout(() => {
                    applyViewport({ settle: true });
                    lockScroll();
                }, 180);
            });
        };

        const onVisualViewportScroll = () => {
            if (!isMobile) return;
            lockScroll();
        };

        const onFocusIn = (e) => {
            if (!isMobile) return;
            const t = e.target;
            if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) {
                burstLockScroll(450);
                syncViewport();
            }
        };

        applyViewport({ settle: true });
        window.addEventListener('resize', syncViewport);
        window.addEventListener('orientationchange', syncViewport);
        window.addEventListener('focusin', onFocusIn);
        window.visualViewport?.addEventListener('resize', syncViewport);
        window.visualViewport?.addEventListener('scroll', onVisualViewportScroll);

        const header = document.getElementById('header');
        const ro = typeof ResizeObserver !== 'undefined' && header
            ? new ResizeObserver(syncViewport)
            : null;
        if (header && ro) ro.observe(header);

        return () => {
            if (rafId) cancelAnimationFrame(rafId);
            if (settleTimer) window.clearTimeout(settleTimer);
            if (focusLockTimer) window.clearInterval(focusLockTimer);
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
            window.removeEventListener('focusin', onFocusIn);
            window.visualViewport?.removeEventListener('resize', syncViewport);
            window.visualViewport?.removeEventListener('scroll', onVisualViewportScroll);
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

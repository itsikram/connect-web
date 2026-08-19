import React, { Fragment, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useSelector } from 'react-redux';
import ModalContainer from '../../components/modal/ModalContainer';
import UserPP from '../../components/UserPP';
import useIsMobile from '../../utils/useIsMobile';
import { SIDEBAR_MENU_ITEMS } from '../sidebar/sidebarMenuItems';
import './AppMenuModal.css';

function getProfileDisplayName(profileData) {
    if (!profileData) return 'Your profile';
    if (profileData.fullName) return profileData.fullName;
    const user = profileData.user;
    if (user) {
        const name = [user.firstName, user.surname].filter(Boolean).join(' ').trim();
        if (name) return name;
    }
    return 'Your profile';
}

const AppMenuModal = ({ isOpen, onRequestClose }) => {
    const isMobile = useIsMobile();
    const profileData = useSelector((state) => state.profile);

    const userInfo = (() => {
        try {
            return JSON.parse(localStorage.getItem('user') || '{}');
        } catch {
            return {};
        }
    })();

    const profilePath = userInfo.profile ? `/${userInfo.profile}/` : '/';
    const profileName = getProfileDisplayName(profileData);

    const handleItemClick = useCallback(() => {
        onRequestClose();
    }, [onRequestClose]);

    return (
        <ModalContainer
            isOpen={isOpen}
            onRequestClose={onRequestClose}
            isFullscreen={isMobile}
            id="app-menu-modal"
            style={isMobile
                ? {
                    display: 'flex',
                    flexDirection: 'column',
                    height: '100dvh',
                    maxHeight: '100dvh',
                    overflow: 'hidden',
                }
                : {
                    display: 'flex',
                    flexDirection: 'column',
                    width: 'min(92vw, 520px)',
                    maxHeight: 'min(85dvh, 85vh)',
                    borderRadius: '16px',
                    overflow: 'hidden',
                }}
        >
            <div className="app-menu-modal">
                <div className="app-menu-modal-header">
                    <div>
                        <h2 className="app-menu-modal-title">Connect Apps</h2>
                        <p className="app-menu-modal-subtitle">Shortcuts to features & pages</p>
                    </div>
                    <button
                        type="button"
                        className="app-menu-modal-close"
                        onClick={onRequestClose}
                        aria-label="Close menu"
                    >
                        <i className="far fa-times" aria-hidden="true" />
                    </button>
                </div>

                <div className="app-menu-modal-body">
                    <Link
                        to={profilePath}
                        className="app-menu-profile-card"
                        onClick={handleItemClick}
                    >
                        <div className="app-menu-profile-avatar">
                <UserPP profilePic={profileData?.profilePic}
                  size={48}
                  profile={profileData?._id} />
                        </div>
                        <div className="app-menu-profile-meta">
                            <p className="app-menu-profile-name">{profileName}</p>
                            <p className="app-menu-profile-hint">View your profile</p>
                        </div>
                        <i className="fas fa-chevron-right" style={{ opacity: 0.4, fontSize: '0.85rem' }} aria-hidden="true" />
                    </Link>

                    <div className="app-menu-grid" role="list">
                        {SIDEBAR_MENU_ITEMS.map((item) => {
                            const iconStyle = { color: item.accent || '#29B1A9' };
                            const content = (
                                <Fragment>
                                    <span className="app-menu-icon-wrap" style={{ boxShadow: `inset 0 0 0 1px ${item.accent}22` }}>
                                        <i className={`fas ${item.icon}`} style={iconStyle} aria-hidden="true" />
                                    </span>
                                    <span className="app-menu-grid-label">{item.label}</span>
                                </Fragment>
                            );

                            if (item.disabled || !item.to) {
                                return (
                                    <div
                                        key={item.id}
                                        className="app-menu-grid-item is-disabled"
                                        role="listitem"
                                        aria-disabled="true"
                                        title="Coming soon"
                                    >
                                        {content}
                                    </div>
                                );
                            }

                            return (
                                <Link
                                    key={item.id}
                                    to={item.to}
                                    className="app-menu-grid-item"
                                    role="listitem"
                                    onClick={handleItemClick}
                                >
                                    {content}
                                </Link>
                            );
                        })}
                    </div>
                </div>
            </div>
        </ModalContainer>
    );
};

export default AppMenuModal;

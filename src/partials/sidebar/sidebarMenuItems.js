/** Left sidebar / header app launcher menu items (shared with header grid modal). */

import { MENU_APPS } from '../../constants/menuApps';

const PLATFORM_NAV_ITEMS = [
    { id: 'camera', label: 'Camera', to: '/camera', icon: 'fa-camera', accent: '#3B82F6' },
    { id: 'friends', label: 'Find Friends', to: '/friends/', icon: 'fa-user-friends', accent: '#1877f2' },
    { id: 'watch', label: 'Watch', to: '/watch/', icon: 'fa-tv', accent: '#ef4444' },
    { id: 'saved-videos', label: 'Saved Videos', to: '/downloads/', icon: 'fa-film', accent: '#8b5cf6' },
    { id: 'marketplace', label: 'Marketplace', to: '/marketplace/', icon: 'fa-store', accent: '#10b981' },
];

const MENU_APP_ITEMS = MENU_APPS.filter((app) => app.key !== 'camera').map((app) => ({
    id: app.key,
    label: app.name,
    to: app.href,
    icon: app.faIcon,
    accent: app.colorA,
}));

const COMING_SOON_ITEMS = [
    { id: 'memories', label: 'Memories', icon: 'fa-clock', accent: '#a855f7', disabled: true },
    { id: 'favourites', label: 'Favourites', icon: 'fa-star', accent: '#eab308', disabled: true },
    { id: 'pages', label: 'Pages', icon: 'fa-flag', accent: '#f97316', disabled: true },
    { id: 'saved', label: 'Saved', icon: 'fa-bookmark', accent: '#ec4899', disabled: true },
    { id: 'orders', label: 'Orders & Payments', icon: 'fa-credit-card', accent: '#6366f1', disabled: true },
];

export const SIDEBAR_MENU_ITEMS = [
    ...PLATFORM_NAV_ITEMS,
    ...MENU_APP_ITEMS,
    { id: 'menu', label: 'All Apps', to: '/menu/', icon: 'fa-th-large', accent: '#29B1A9' },
    ...COMING_SOON_ITEMS,
];

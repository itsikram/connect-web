// "default" follows the device's light/dark setting and keeps following it
// while the app is open; "light" and "dark" are fixed.
const systemQuery =
    typeof window !== 'undefined' && window.matchMedia
        ? window.matchMedia('(prefers-color-scheme: light)')
        : null;

let followingSystem = false;

// Phone status bar / browser bar colour, matched to the header so the top of
// the screen reads as one bar (Android and the installed app use this).
const THEME_BAR_COLORS = { dark: '#1e1f20', light: '#ffffff' };

const setThemeBarColor = (mode) => {
    const color = THEME_BAR_COLORS[mode] || THEME_BAR_COLORS.dark;
    document.querySelectorAll('meta[name="theme-color"]').forEach((meta) => {
        meta.setAttribute('content', color);
    });
};

const setTheme = (mode) => {
    document.documentElement.setAttribute('data-theme', mode);
    document.body.setAttribute('data-theme', mode);
    setThemeBarColor(mode);
};

const onSystemThemeChange = (event) => {
    if (followingSystem) setTheme(event.matches ? 'light' : 'dark');
};

if (systemQuery) {
    if (systemQuery.addEventListener) systemQuery.addEventListener('change', onSystemThemeChange);
    else if (systemQuery.addListener) systemQuery.addListener(onSystemThemeChange);
}

export const applyThemeMode = (themeMode) => {
    followingSystem = themeMode === 'default';
    if (followingSystem) {
        setTheme(systemQuery?.matches ? 'light' : 'dark');
        return;
    }
    setTheme(themeMode === 'light' ? 'light' : 'dark');
};

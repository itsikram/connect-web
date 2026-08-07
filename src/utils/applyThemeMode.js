export const applyThemeMode = (themeMode) => {
    const mode = themeMode === 'light' ? 'light' : 'dark';
    document.documentElement.setAttribute('data-theme', mode);
    document.body.setAttribute('data-theme', mode);
};

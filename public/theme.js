// Runs before the stylesheets so a saved light theme never flashes dark.
(() => {
    const key = 'ember-appearance';
    let current = 'dark';
    try {
        if (localStorage.getItem(key) === 'light') current = 'light';
    } catch {
    }

    function apply(theme) {
        current = theme === 'light' ? 'light' : 'dark';
        document.documentElement.dataset.theme = current;
        document.querySelector('meta[name="theme-color"]')?.setAttribute('content', current === 'light' ? '#f8f6f2' : '#101112');
        document.querySelectorAll('[data-theme-choice]').forEach(button => {
            button.setAttribute('aria-pressed', String(button.dataset.themeChoice === current));
        });
    }

    window.EmberTheme = {
        get: () => current,
        set(theme) {
            apply(theme);
            try {
                localStorage.setItem(key, current);
            } catch {
            }
        }
    };
    window.addEventListener('storage', event => {
        if (event.key === key || event.key === null) apply(event.newValue);
    });
    apply(current);
})();

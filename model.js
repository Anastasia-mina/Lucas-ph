/* 署名 Lucas。禁止商业使用、二次传播、二次修改。使用声明见 NOTICE.txt。 */
export const MODES = ['time', 'system', 'light', 'dark'];
export const DEFAULTS = { enabled: true, mode: 'time', dayStart: '07:00', nightStart: '19:00', solid: true, favorites: [], likes: [] };
export function minutes(value, fallback) {
    if (!/^([01]\d|2[0-3]):[0-5]\d$/.test(String(value))) return fallback;
    const [h, m] = value.split(':').map(Number);
    return h * 60 + m;
}
export function normalize(value = {}) {
    return {
        enabled: value.enabled !== false,
        mode: MODES.includes(value.mode) ? value.mode : DEFAULTS.mode,
        dayStart: minutes(value.dayStart, -1) < 0 ? DEFAULTS.dayStart : value.dayStart,
        nightStart: minutes(value.nightStart, -1) < 0 ? DEFAULTS.nightStart : value.nightStart,
        solid: value.solid !== false,
        favorites: Array.isArray(value.favorites) ? [...new Set(value.favorites.filter(key => typeof key === 'string'))] : [],
        likes: Array.isArray(value.likes) ? [...new Set(value.likes.filter(key => typeof key === 'string'))] : [],
    };
}
export function resolveMode(settings, date = new Date(), systemDark = false) {
    if (settings.mode === 'light' || settings.mode === 'dark') return settings.mode;
    if (settings.mode === 'system') return systemDark ? 'dark' : 'light';
    const day = minutes(settings.dayStart, 420), night = minutes(settings.nightStart, 1140);
    const now = date.getHours() * 60 + date.getMinutes();
    if (day === night) return 'dark';
    const light = day < night ? now >= day && now < night : now >= day || now < night;
    return light ? 'light' : 'dark';
}

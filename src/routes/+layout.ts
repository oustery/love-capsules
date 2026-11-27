// Приложение полностью клиентское (SPA): приватные данные не ходят через SSR,
// а PWA-кэширование работает максимально просто.
export const ssr = false;
export const prerender = false;

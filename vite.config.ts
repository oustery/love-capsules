import { sveltekit } from '@sveltejs/kit/vite';
import tailwindcss from '@tailwindcss/vite';
import { SvelteKitPWA } from '@vite-pwa/sveltekit';
import { defineConfig } from 'vite';

// BASE_PATH=/love-capsules — сборка для GitHub Pages (приложение живёт в подпапке).
// Для Cloudflare Pages базовый путь пустой.
const base = process.env.BASE_PATH || '';

export default defineConfig({
	plugins: [
		tailwindcss(),
		SvelteKitPWA({
			registerType: 'autoUpdate',
			includeAssets: ['favicon.svg', 'icons/apple-touch-icon.png'],
			manifest: {
				name: 'Наши капсулы',
				short_name: 'Капсулы',
				description: 'Тёплое место на двоих: таймеры, капсулы, причины и купоны',
				lang: 'ru',
				id: `${base}/`,
				start_url: `${base}/`,
				scope: `${base}/`,
				display: 'standalone',
				orientation: 'portrait',
				background_color: '#FDF8F5',
				theme_color: '#FDF8F5',
				categories: ['lifestyle'],
				icons: [
					{ src: `${base}/icons/pwa-192.png`, sizes: '192x192', type: 'image/png' },
					{ src: `${base}/icons/pwa-512.png`, sizes: '512x512', type: 'image/png' },
					{ src: `${base}/icons/maskable-512.png`, sizes: '512x512', type: 'image/png', purpose: 'maskable' }
				]
			},
			workbox: {
				globPatterns: ['**/*.{js,css,html,svg,png,ico,woff2}'],
				// SPA-оболочка: на GitHub Pages это фолбэк 404.html, на Cloudflare — корень
				navigateFallback: process.env.ADAPTER === 'static' ? `${base}/404.html` : `${base}/`,
				runtimeCaching: [
					{
						urlPattern: /^https:\/\/[^/]+\/storage\/v1\/object\//,
						handler: 'CacheFirst',
						options: {
							cacheName: 'supabase-media',
							expiration: { maxEntries: 300, maxAgeSeconds: 60 * 60 * 24 * 30 },
							cacheableResponse: { statuses: [0, 200] },
							rangeRequests: true
						}
					},
					{
						urlPattern: /^https:\/\/fonts\.googleapis\.com\/.*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'google-fonts-styles',
							expiration: { maxEntries: 10, maxAgeSeconds: 60 * 60 * 24 * 365 },
							cacheableResponse: { statuses: [200] }
						}
					},
					{
						urlPattern: /^https:\/\/fonts\.gstatic\.com\/.*/i,
						handler: 'CacheFirst',
						options: {
							cacheName: 'google-fonts-files',
							expiration: { maxEntries: 20, maxAgeSeconds: 60 * 60 * 24 * 365 },
							cacheableResponse: { statuses: [200] }
						}
					}
				]
			}
		}),
		sveltekit()
	]
});

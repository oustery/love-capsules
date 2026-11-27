import adapterCloudflare from '@sveltejs/adapter-cloudflare';
import adapterStatic from '@sveltejs/adapter-static';
import { vitePreprocess } from '@sveltejs/vite-plugin-svelte';

// ADAPTER=static  — сборка для GitHub Pages (SPA-фолбэк 404.html)
// BASE_PATH=/love-capsules — базовый путь, когда приложение живёт в подпапке
// Без переменных — adapter-cloudflare для Pages (поведение по умолчанию).
const useStatic = process.env.ADAPTER === 'static';
const basePath = process.env.BASE_PATH || '';

/** @type {import('@sveltejs/kit').Config} */
const config = {
	preprocess: vitePreprocess(),
	kit: {
		adapter: useStatic ? adapterStatic({ fallback: '404.html' }) : adapterCloudflare(),
		paths: basePath ? { base: basePath } : undefined
	}
};

export default config;

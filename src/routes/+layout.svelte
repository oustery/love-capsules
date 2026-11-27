<script lang="ts">
	import '../app.css';
	import { page } from '$app/state';
	import { goto } from '$app/navigation';
	import { auth } from '$lib/auth.svelte';
	import BottomNav from '$lib/components/BottomNav.svelte';
	import Toasts from '$lib/components/Toasts.svelte';
	import { registerSW } from 'virtual:pwa-register';

	let { children } = $props();

	// Service worker: автообновление и офлайн-режим
	$effect(() => {
		registerSW({ immediate: true });
	});

	// Страж входа: без сессии — на экран замка, с сессией — с замка домой
	$effect(() => {
		const path = page.url.pathname.replace(/\/+$/, '') || '/';
		const onLogin = path === '/login';
		if (auth.ready && !auth.session && !onLogin) goto('/login', { replaceState: true });
		if (auth.ready && auth.session && onLogin) goto('/', { replaceState: true });
	});
</script>

{@render children()}
<BottomNav />
<Toasts />

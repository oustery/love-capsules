<script lang="ts">
	import { fade, scale } from 'svelte/transition';
	import { backOut } from 'svelte/easing';
	import { supabase } from '$lib/supabase';
	import type { Photo } from '$lib/types';
	import { toast } from '$lib/toast.svelte';
	import { getSignedUrl } from '$lib/storage';
	import { fullDate, shortTime } from '$lib/format';

	let loaded = $state(false);
	let photos = $state<Photo[]>([]);
	let urls = $state<Record<string, string>>({});
	let lightbox = $state<Photo | null>(null);

	$effect(() => {
		if (!loaded) load();
	});

	async function load() {
		const { data, error } = await supabase
			.from('photos')
			.select('*')
			.order('taken_at', { ascending: false, nullsFirst: false })
			.order('created_at', { ascending: false });
		if (error) {
			toast('Галерея не загрузилась 🥺');
		} else {
			photos = (data ?? []) as Photo[];
			resolveUrls();
		}
		loaded = true;
	}

	async function resolveUrls() {
		for (const p of photos) {
			if (urls[p.id]) continue;
			const url = await getSignedUrl(p.storage_path);
			if (url) urls[p.id] = url;
		}
	}

	function when(p: Photo): string {
		return p.taken_at ? fullDate(new Date(p.taken_at + 'T00:00:00')) : fullDate(new Date(p.created_at));
	}
</script>

<svelte:head>
	<title>Наши моменты · Наши капсулы</title>
</svelte:head>

<div class="mx-auto w-full max-w-md px-4 pb-32 pt-5">
	<header>
		<h1 class="text-2xl font-extrabold text-ink">Наши моменты</h1>
		<p class="mt-0.5 text-sm text-ink/55">фото из нашего общего альбома</p>
	</header>

	{#if loaded && photos.length === 0}
		<div class="card mt-5 p-6 text-center">
			<p class="text-4xl">📷</p>
			<p class="mt-2 font-hand text-2xl text-ink/70">Пока пусто</p>
			<p class="mt-1 text-sm text-ink/50">Загрузи первые фото в админке — они сожмутся сами.</p>
		</div>
	{:else}
		<div class="mt-5 grid grid-cols-2 gap-3.5">
			{#each photos as p, i (p.id)}
				<button
					type="button"
					class="rounded-xl bg-ivory p-2.5 pb-3 shadow-lift transition active:scale-[0.97] {i % 2 === 1
						? 'rotate-[1.3deg]'
						: 'rotate-[-1.3deg]'}"
					onclick={() => (lightbox = p)}
				>
					<div class="aspect-square overflow-hidden rounded-lg bg-shell">
						{#if urls[p.id]}
							<img
								src={urls[p.id]}
								alt={p.caption || 'наш момент'}
								loading="lazy"
								class="h-full w-full object-cover"
							/>
						{:else}
							<div class="flex h-full w-full items-center justify-center text-2xl opacity-40">🤍</div>
						{/if}
					</div>
					<p class="mt-2 truncate font-hand text-lg leading-none text-ink/75">
						{p.caption || 'наш момент'}
					</p>
					<p class="mt-1 text-[10px] font-bold text-ink/40">{when(p)}</p>
				</button>
			{/each}
		</div>
	{/if}
</div>

<!-- Лайтбокс -->
{#if lightbox}
	<div class="fixed inset-0 z-[70] flex flex-col items-center justify-center bg-ink/85 p-4 backdrop-blur-sm">
		<button
			type="button"
			aria-label="Закрыть"
			onclick={() => (lightbox = null)}
			class="absolute top-4 right-4 flex h-11 w-11 items-center justify-center rounded-full bg-white/15 text-xl text-white transition active:scale-90"
		>
			✕
		</button>
		{#key lightbox.id}
			<div in:scale={{ duration: 260, easing: backOut, start: 0.92 }}>
				{#if urls[lightbox.id]}
					<img
						src={urls[lightbox.id]}
						alt={lightbox.caption || 'наш момент'}
						class="max-h-[72dvh] max-w-full rounded-xl border-8 border-ivory object-contain shadow-lift"
					/>
				{/if}
				<p in:fade={{ delay: 150 }} class="mt-4 text-center font-hand text-2xl text-cream">
					{lightbox.caption || 'наш момент'}
				</p>
				<p class="mt-1 text-center text-xs font-bold text-cream/60">
					{when(lightbox)} · {shortTime(new Date(lightbox.created_at))}
				</p>
			</div>
		{/key}
	</div>
{/if}
